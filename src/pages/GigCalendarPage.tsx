import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { GigCalendar, type CalendarSyncEventChip } from '@/components/dashboard/GigCalendar'
import type { GoogleCalendarSyncResponseBody } from '@/lib/calendar/googleCalendarSyncToast'
import { googleCalendarSyncSuccessMessageGigPage } from '@/lib/calendar/googleCalendarSyncToast'
import { logGoogleCalendarSyncClient } from '@/lib/calendar/logGoogleCalendarSyncClient'
import { useNavBadges } from '@/context/NavBadgesContext'
import { supabase } from '@/lib/supabase'

function netlifyFunctionPath(name: string): string {
  return `/.netlify/functions/${name}`
}

export default function GigCalendarPage() {
  const { user } = useAuth()
  const { deals, loading: dealsLoading } = useDeals()
  const { venues, loading: venuesLoading } = useVenues()
  const { markSeen } = useNavBadges()
  const loading = dealsLoading || venuesLoading
  const [calendarSyncEvents, setCalendarSyncEvents] = useState<CalendarSyncEventChip[]>([])
  const [gcalConn, setGcalConn] = useState<{
    connected_at: string | null
    source_calendar_id: string
  } | null>(null)
  const [gcalConnLoading, setGcalConnLoading] = useState(true)
  const [googleSyncing, setGoogleSyncing] = useState(false)
  const [googleDedupScanning, setGoogleDedupScanning] = useState(false)
  const [gcalToast, setGcalToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const gcalToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showGcalToast = useCallback((msg: string, type: 'ok' | 'err') => {
    if (gcalToastTimer.current) clearTimeout(gcalToastTimer.current)
    setGcalToast({ msg, type })
    gcalToastTimer.current = setTimeout(() => setGcalToast(null), 3200)
  }, [])

  useEffect(
    () => () => {
      if (gcalToastTimer.current) clearTimeout(gcalToastTimer.current)
    },
    [],
  )

  const loadGcalConnection = useCallback(async () => {
    if (!user?.id) {
      setGcalConn(null)
      setGcalConnLoading(false)
      return
    }
    setGcalConnLoading(true)
    const { data, error } = await supabase
      .from('google_calendar_connection')
      .select('connected_at, source_calendar_id')
      .eq('user_id', user.id)
      .maybeSingle()
    setGcalConnLoading(false)
    if (error) {
      console.warn('[GigCalendarPage] google_calendar_connection', error)
      setGcalConn(null)
      return
    }
    setGcalConn(
      data
        ? {
            connected_at: data.connected_at ?? null,
            source_calendar_id: data.source_calendar_id ?? '',
          }
        : null,
    )
  }, [user?.id])

  useEffect(() => {
    void loadGcalConnection()
  }, [loadGcalConnection])

  const loadSync = useCallback(async () => {
    if (!user?.id) {
      setCalendarSyncEvents([])
      return
    }
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - 120)
    const end = new Date()
    end.setUTCDate(end.getUTCDate() + 400)
    const { data, error } = await supabase
      .from('calendar_sync_event')
      .select('id, event_start_at, event_end_at, summary, location, description, matched_venue_id, display_status, dedup_pair_deal_id')
      .eq('user_id', user.id)
      .neq('display_status', 'hidden_duplicate')
      .gte('event_start_at', start.toISOString())
      .lte('event_start_at', end.toISOString())
      .order('event_start_at', { ascending: true })
    if (error) {
      console.warn('[GigCalendarPage] calendar_sync_event', error)
      setCalendarSyncEvents([])
      return
    }
    setCalendarSyncEvents(
      (data ?? [])
        .filter(row => row.event_start_at)
        .map(row => ({
          id: row.id,
          event_start_at: row.event_start_at as string,
          event_end_at: row.event_end_at,
          summary: row.summary,
          location: row.location,
          description: row.description ?? null,
          matched_venue_id: row.matched_venue_id,
          display_status: (row.display_status ?? 'visible') as 'visible' | 'hidden_duplicate' | 'needs_review',
          dedup_pair_deal_id: row.dedup_pair_deal_id ?? null,
        })),
    )
  }, [user?.id])

  useEffect(() => {
    void markSeen('calendar')
  }, [markSeen])

  useEffect(() => {
    void loadSync()
  }, [loadSync])

  useEffect(() => {
    const onChange = () => void loadSync()
    window.addEventListener('calendar-sync-events-changed', onChange)
    return () => window.removeEventListener('calendar-sync-events-changed', onChange)
  }, [loadSync])

  /** Light polling while tab visible so scheduled server sync shows up without a full refresh. */
  useEffect(() => {
    if (!user?.id) return
    const intervalMs = 120_000
    const id = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return
      void loadSync()
    }, intervalMs)
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadSync()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [user?.id, loadSync])

  const googleConnected = !!gcalConn?.connected_at
  const sourceCalReady = !!(gcalConn?.source_calendar_id ?? '').trim()

  const handleGoogleToolbarSync = useCallback(async () => {
    if (!googleConnected || !sourceCalReady) {
      showGcalToast('Connect Google Calendar in Settings and set a shared calendar ID.', 'err')
      return
    }
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      showGcalToast('Sign in again to sync.', 'err')
      return
    }
    setGoogleSyncing(true)
    const res = await fetch(netlifyFunctionPath('google-calendar-sync'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
    const j = (await res.json().catch(() => ({}))) as GoogleCalendarSyncResponseBody & {
      error?: string
    }
    logGoogleCalendarSyncClient('GigCalendarPage', res, j)
    setGoogleSyncing(false)
    if (!res.ok) {
      showGcalToast(j.error ?? 'Sync failed.', 'err')
      return
    }
    showGcalToast(googleCalendarSyncSuccessMessageGigPage(j), 'ok')
    void loadSync()
    void loadGcalConnection()
    window.dispatchEvent(new CustomEvent('calendar-sync-events-changed'))
  }, [googleConnected, sourceCalReady, loadSync, loadGcalConnection, showGcalToast])

  const handleGoogleToolbarDedup = useCallback(async () => {
    if (!googleConnected) {
      showGcalToast('Connect Google Calendar in Settings first.', 'err')
      return
    }
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) {
      showGcalToast('Sign in again.', 'err')
      return
    }
    setGoogleDedupScanning(true)
    const res = await fetch(netlifyFunctionPath('google-calendar-dedup-scan'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    })
    const j = (await res.json().catch(() => ({}))) as {
      error?: string
      scanned?: number
      hidden_duplicates?: number
      needs_review?: number
    }
    setGoogleDedupScanning(false)
    if (!res.ok) {
      showGcalToast(j.error ?? 'Duplicate scan failed.', 'err')
      return
    }
    showGcalToast(
      `Duplicates: ${j.hidden_duplicates ?? 0} hidden, ${j.needs_review ?? 0} need review (${j.scanned ?? 0} rows).`,
      'ok',
    )
    void loadSync()
    window.dispatchEvent(new CustomEvent('calendar-sync-events-changed'))
  }, [googleConnected, loadSync, showGcalToast])

  return (
    <div className="max-w-5xl space-y-4 relative">
      {gcalToast && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-[min(20rem,calc(100vw-2rem))] px-3 py-2 rounded-lg text-xs font-medium shadow-lg border ${
            gcalToast.type === 'ok'
              ? 'bg-neutral-900 border-emerald-500/30 text-emerald-300'
              : 'bg-neutral-900 border-red-500/30 text-red-300'
          }`}
          role="status"
        >
          {gcalToast.msg}
        </div>
      )}
      <GigCalendar
        deals={deals}
        venues={venues}
        calendarSyncEvents={calendarSyncEvents}
        loading={loading}
        googleCalendarToolbar={{
          onSync: () => void handleGoogleToolbarSync(),
          onDedup: () => void handleGoogleToolbarDedup(),
          syncing: googleSyncing,
          dedupScanning: googleDedupScanning,
          syncDisabled: gcalConnLoading || !googleConnected || !sourceCalReady,
          dedupDisabled: gcalConnLoading || !googleConnected,
        }}
      />
    </div>
  )
}
