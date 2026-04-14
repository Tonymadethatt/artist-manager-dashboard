import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { seedPartnershipRollIfEmpty } from '@/lib/partnerships/seedPartnershipRollIfEmpty'
import type { Database } from '@/types/database'

export type PartnershipRollEntry = Database['public']['Tables']['artist_partnership_roll_entries']['Row']

export function usePartnershipRoll(userId: string | null) {
  const [entries, setEntries] = useState<PartnershipRollEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    const { data, error: qErr } = await supabase
      .from('artist_partnership_roll_entries')
      .select('*')
      .eq('user_id', userId)
      .eq('cohort', 'recent')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (qErr) {
      setError(qErr.message)
      setLoading(false)
      return
    }
    setError(null)
    setEntries((data ?? []) as PartnershipRollEntry[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setEntries([])
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { count, error: cErr } = await supabase
        .from('artist_partnership_roll_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)

      if (!cancelled && !cErr && (count ?? 0) === 0) {
        const { error: seedErr } = await seedPartnershipRollIfEmpty(userId)
        if (seedErr && !cancelled) setError(seedErr)
      }

      if (cancelled) return
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [userId, load])

  useEffect(() => {
    if (!userId) return
    const t = window.setInterval(() => void load(), 5000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    const ch = supabase
      .channel(`partnership-roll-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artist_partnership_roll_entries',
          filter: `user_id=eq.${userId}`,
        },
        () => void load(),
      )
      .subscribe()
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
      void supabase.removeChannel(ch)
    }
  }, [userId, load])

  const addEntry = useCallback(
    async (name: string, cohort: 'recent' | 'older', source: 'dj' | 'admin') => {
      if (!userId || !name.trim()) return { error: 'Name required' }
      const maxSort =
        entries.filter(e => e.cohort === cohort).reduce((m, e) => Math.max(m, e.sort_order), -1) + 1
      const { error: e } = await supabase.from('artist_partnership_roll_entries').insert({
        user_id: userId,
        name: name.trim(),
        cohort,
        source,
        sort_order: maxSort,
      })
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, entries, load],
  )

  const updateName = useCallback(
    async (id: string, name: string) => {
      if (!userId || !name.trim()) return { error: 'Name required' }
      const { error: e } = await supabase
        .from('artist_partnership_roll_entries')
        .update({ name: name.trim() })
        .eq('id', id)
        .eq('user_id', userId)
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, load],
  )

  const setCohort = useCallback(
    async (id: string, cohort: 'recent' | 'older') => {
      if (!userId) return { error: 'Not signed in' }
      const { error: e } = await supabase
        .from('artist_partnership_roll_entries')
        .update({ cohort })
        .eq('id', id)
        .eq('user_id', userId)
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, load],
  )

  const confirm = useCallback(
    async (id: string) => {
      if (!userId) return { error: 'Not signed in' }
      const { error: e } = await supabase
        .from('artist_partnership_roll_entries')
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', userId)
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, load],
  )

  const unconfirm = useCallback(
    async (id: string) => {
      if (!userId) return { error: 'Not signed in' }
      const { error: e } = await supabase
        .from('artist_partnership_roll_entries')
        .update({ is_confirmed: false, confirmed_at: null })
        .eq('id', id)
        .eq('user_id', userId)
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, load],
  )

  const remove = useCallback(
    async (id: string) => {
      if (!userId) return { error: 'Not signed in' }
      const { error: e } = await supabase
        .from('artist_partnership_roll_entries')
        .delete()
        .eq('id', id)
        .eq('user_id', userId)
      if (e) return { error: e.message }
      await load()
      return {}
    },
    [userId, load],
  )

  return {
    entries,
    loading,
    error,
    reload: load,
    addEntry,
    updateName,
    setCohort,
    confirm,
    unconfirm,
    remove,
  }
}
