import { useState, useCallback, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export type NavBadgeCounts = {
  pipeline: number
  'show-reports': number
  'email-queue': number
}

const ALL_SECTIONS = ['pipeline', 'show-reports'] as const

/**
 * Fetches nav badge counts and manages seen_at persistence.
 *
 * - pipeline / show-reports: "new since last visit" model — count rows created
 *   after seen_at[section]. Cleared when you visit the page (markSeen).
 * - email-queue: "live actionable count" model — count of pending emails right
 *   now. No seen_at needed; badge disappears when the queue empties.
 *
 * @param pathname  Pass location.pathname so counts refresh on navigation.
 */
export function useNavBadgesData(pathname: string) {
  const [counts, setCounts] = useState<NavBadgeCounts>({
    pipeline: 0,
    'show-reports': 0,
    'email-queue': 0,
  })

  // Stable ref so the fetch closure always reads the latest without re-creating
  const countsRef = useRef(counts)
  countsRef.current = counts

  const fetchCounts = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // --- 1. Load seen_at row (may not exist yet) ---
    const { data: badgeRow } = await supabase
      .from('nav_badges')
      .select('seen_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const seenAt = (badgeRow?.seen_at ?? {}) as Record<string, string>

    // If the row doesn't exist yet, initialize it now so existing data
    // doesn't flood with stale badges on first visit.
    if (!badgeRow) {
      const initialSeenAt: Record<string, string> = {}
      for (const s of ALL_SECTIONS) initialSeenAt[s] = new Date().toISOString()
      await supabase
        .from('nav_badges')
        .insert({ user_id: user.id, seen_at: initialSeenAt })
      setCounts({ pipeline: 0, 'show-reports': 0, 'email-queue': 0 })
      return
    }

    // --- 2. Pipeline: incomplete tasks created after seen_at.pipeline ---
    const pipelineSince = seenAt['pipeline'] ?? new Date(0).toISOString()
    const { count: pipelineCount } = await supabase
      .from('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('completed', false)
      .gt('created_at', pipelineSince)

    // --- 3. Show Reports: submitted reports after seen_at.show-reports ---
    const reportsSince = seenAt['show-reports'] ?? new Date(0).toISOString()
    const { count: reportsCount } = await supabase
      .from('performance_reports')
      .select('id', { count: 'exact', head: true })
      .eq('submitted', true)
      .gt('submitted_at', reportsSince)

    // --- 4. Email Queue: all currently pending emails (live count, no seen_at) ---
    const { count: queueCount } = await supabase
      .from('venue_emails')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')

    setCounts({
      pipeline: pipelineCount ?? 0,
      'show-reports': reportsCount ?? 0,
      'email-queue': queueCount ?? 0,
    })
  }, [])

  // Fetch on mount
  useEffect(() => {
    void fetchCounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-fetch on every navigation so counts update after markSeen clears a section
  const prevPathname = useRef<string | null>(null)
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname
      void fetchCounts()
    }
  }, [pathname, fetchCounts])

  // Poll every 30 seconds so badges appear promptly after background events
  // (template auto-tasks, artist form submissions, emails added to queue)
  // without requiring the user to navigate to a different page first.
  useEffect(() => {
    const id = setInterval(() => { void fetchCounts() }, 30_000)
    return () => clearInterval(id)
  }, [fetchCounts])

  /**
   * Call when user visits a section. Atomically sets seen_at[section] = now()
   * via a Postgres RPC (no fetch-merge-write race). Then re-fetches counts so
   * the badge in the sidebar clears immediately.
   */
  const markSeen = useCallback(async (section: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.rpc('update_nav_badge_seen', { p_section: section })

    // Re-fetch so the badge count in the sidebar drops to 0 right away
    await fetchCounts()
  }, [fetchCounts])

  return { counts, markSeen, refresh: fetchCounts }
}
