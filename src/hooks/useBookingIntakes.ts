import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import {
  emptyShowBundle,
  emptyVenueBundle,
  parseShowBundle,
  parseVenueBundle,
  type ShowIntakeBundle,
  type VenueIntakeBundle,
} from '@/lib/intake/intakePayload'

export type BookingIntakeRow = Database['public']['Tables']['booking_intakes']['Row']
export type BookingIntakeShowRow = Database['public']['Tables']['booking_intake_shows']['Row']

const DEBOUNCE_MS = 400

export function useBookingIntakes() {
  const [intakes, setIntakes] = useState<BookingIntakeRow[]>([])
  const [showsByIntake, setShowsByIntake] = useState<Record<string, BookingIntakeShowRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  type IntakePending = { venue?: VenueIntakeBundle; title?: string }
  const pendingIntakeRef = useRef<Map<string, IntakePending>>(new Map())
  const pendingShowRef = useRef<Map<string, ShowIntakeBundle>>(new Map())
  const timersRef = useRef<{
    intake: ReturnType<typeof setTimeout> | null
    show: ReturnType<typeof setTimeout> | null
  }>({ intake: null, show: null })

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setIntakes([])
      setShowsByIntake({})
      setLoading(false)
      return
    }
    const { data: intakesData, error: ie } = await supabase
      .from('booking_intakes')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (ie) {
      setError(ie.message)
      setLoading(false)
      return
    }
    const list = (intakesData ?? []) as BookingIntakeRow[]
    setIntakes(list)
    if (list.length === 0) {
      setShowsByIntake({})
      setLoading(false)
      return
    }
    const ids = list.map(i => i.id)
    const { data: showsData, error: se } = await supabase
      .from('booking_intake_shows')
      .select('*')
      .in('intake_id', ids)
      .order('sort_order', { ascending: true })
    if (se) {
      setError(se.message)
      setLoading(false)
      return
    }
    const map: Record<string, BookingIntakeShowRow[]> = {}
    for (const row of (showsData ?? []) as BookingIntakeShowRow[]) {
      if (!map[row.intake_id]) map[row.intake_id] = []
      map[row.intake_id].push(row)
    }
    setShowsByIntake(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (timersRef.current.intake) clearTimeout(timersRef.current.intake)
      if (timersRef.current.show) clearTimeout(timersRef.current.show)
    }
  }, [load])

  const flushIntake = useCallback(async (intakeId: string) => {
    const pending = pendingIntakeRef.current.get(intakeId)
    if (!pending || (pending.venue === undefined && pending.title === undefined)) return
    pendingIntakeRef.current.delete(intakeId)
    const patch: Record<string, unknown> = {}
    if (pending.venue !== undefined) patch.venue_data = pending.venue as unknown as Record<string, unknown>
    if (pending.title !== undefined) patch.title = pending.title
    const { error: up } = await supabase.from('booking_intakes').update(patch).eq('id', intakeId)
    if (up) setError(up.message)
    else await load()
  }, [load])

  const scheduleIntakeSave = useCallback(
    (intakeId: string) => {
      if (timersRef.current.intake) clearTimeout(timersRef.current.intake)
      timersRef.current.intake = setTimeout(() => {
        timersRef.current.intake = null
        void flushIntake(intakeId)
      }, DEBOUNCE_MS)
    },
    [flushIntake],
  )

  const updateVenueBundle = useCallback(
    (intakeId: string, bundle: VenueIntakeBundle) => {
      const cur = pendingIntakeRef.current.get(intakeId) ?? {}
      pendingIntakeRef.current.set(intakeId, { ...cur, venue: bundle })
      setIntakes(prev =>
        prev.map(i => (i.id === intakeId ? { ...i, venue_data: bundle as unknown } : i)),
      )
      scheduleIntakeSave(intakeId)
    },
    [scheduleIntakeSave],
  )

  const updateTitle = useCallback(
    (intakeId: string, title: string) => {
      const cur = pendingIntakeRef.current.get(intakeId) ?? {}
      pendingIntakeRef.current.set(intakeId, { ...cur, title })
      setIntakes(prev => prev.map(i => (i.id === intakeId ? { ...i, title } : i)))
      scheduleIntakeSave(intakeId)
    },
    [scheduleIntakeSave],
  )

  const flushShow = useCallback(
    async (showId: string, intakeId: string) => {
      const bundle = pendingShowRef.current.get(showId)
      if (!bundle) return
      pendingShowRef.current.delete(showId)
      const { error: up } = await supabase
        .from('booking_intake_shows')
        .update({ show_data: bundle as unknown })
        .eq('id', showId)
      if (up) setError(up.message)
      else {
        setShowsByIntake(prev => ({
          ...prev,
          [intakeId]: (prev[intakeId] ?? []).map(s =>
            s.id === showId ? { ...s, show_data: bundle as unknown } : s,
          ),
        }))
      }
    },
    [],
  )

  const scheduleShowSave = useCallback(
    (showId: string, intakeId: string) => {
      if (timersRef.current.show) clearTimeout(timersRef.current.show)
      timersRef.current.show = setTimeout(() => {
        timersRef.current.show = null
        void flushShow(showId, intakeId)
      }, DEBOUNCE_MS)
    },
    [flushShow],
  )

  const updateShowBundle = useCallback(
    (showId: string, intakeId: string, bundle: ShowIntakeBundle) => {
      pendingShowRef.current.set(showId, bundle)
      setShowsByIntake(prev => ({
        ...prev,
        [intakeId]: (prev[intakeId] ?? []).map(s =>
          s.id === showId ? { ...s, show_data: bundle as unknown } : s,
        ),
      }))
      scheduleShowSave(showId, intakeId)
    },
    [scheduleShowSave],
  )

  const updateShowLabel = useCallback(
    async (showId: string, intakeId: string, label: string) => {
      const { error: up } = await supabase.from('booking_intake_shows').update({ label }).eq('id', showId)
      if (up) {
        setError(up.message)
        return
      }
      setShowsByIntake(prev => ({
        ...prev,
        [intakeId]: (prev[intakeId] ?? []).map(s => (s.id === showId ? { ...s, label } : s)),
      }))
    },
    [],
  )

  const createIntake = useCallback(async (): Promise<BookingIntakeRow | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const venuePayload = emptyVenueBundle()
    const showPayload = emptyShowBundle()
    const { data: intake, error: ie } = await supabase
      .from('booking_intakes')
      .insert({
        user_id: user.id,
        title: 'New intake',
        venue_data: venuePayload as unknown as Database['public']['Tables']['booking_intakes']['Insert']['venue_data'],
      })
      .select()
      .single()
    if (ie || !intake) {
      setError(ie?.message ?? 'Could not create intake')
      return null
    }
    const row = intake as BookingIntakeRow
    const { data: showRow, error: se } = await supabase
      .from('booking_intake_shows')
      .insert({
        intake_id: row.id,
        label: 'Show 1',
        sort_order: 0,
        show_data: showPayload as unknown as Database['public']['Tables']['booking_intake_shows']['Insert']['show_data'],
      })
      .select()
      .single()
    if (se || !showRow) {
      setError(se?.message ?? 'Could not create show draft')
      return row
    }
    await load()
    return row
  }, [load])

  const deleteIntake = useCallback(
    async (intakeId: string) => {
      const { error: de } = await supabase.from('booking_intakes').delete().eq('id', intakeId)
      if (de) setError(de.message)
      else await load()
    },
    [load],
  )

  const addShowDraft = useCallback(
    async (intakeId: string) => {
      const list = showsByIntake[intakeId] ?? []
      const nextOrder = list.length === 0 ? 0 : Math.max(...list.map(s => s.sort_order)) + 1
      const showPayload = emptyShowBundle()
      const { data, error: ie } = await supabase
        .from('booking_intake_shows')
        .insert({
          intake_id: intakeId,
          label: `Show ${list.length + 1}`,
          sort_order: nextOrder,
          show_data: showPayload as unknown as Database['public']['Tables']['booking_intake_shows']['Insert']['show_data'],
        })
        .select()
        .single()
      if (ie || !data) {
        setError(ie?.message ?? 'Could not add show')
        return null
      }
      await load()
      return data as BookingIntakeShowRow
    },
    [load, showsByIntake],
  )

  const setImportedDealId = useCallback(async (showId: string, dealId: string | null) => {
    const { error: up } = await supabase
      .from('booking_intake_shows')
      .update({ imported_deal_id: dealId })
      .eq('id', showId)
    if (up) setError(up.message)
    else await load()
  }, [load])

  return {
    intakes,
    showsByIntake,
    loading,
    error,
    refetch: load,
    parseVenue: (row: BookingIntakeRow) => parseVenueBundle(row.venue_data),
    parseShow: (row: BookingIntakeShowRow) => parseShowBundle(row.show_data),
    createIntake,
    deleteIntake,
    updateVenueBundle,
    updateTitle,
    updateShowBundle,
    updateShowLabel,
    addShowDraft,
    setImportedDealId,
  }
}
