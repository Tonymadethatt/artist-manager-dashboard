import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import {
  emptyShowDataV3,
  emptyVenueDataV3,
  INTAKE_SCHEMA_VERSION_V3,
  parseShowDataV3,
  parseVenueDataV3,
  type BookingIntakeShowDataV3,
  type BookingIntakeVenueDataV3,
} from '@/lib/intake/intakePayloadV3'

export type BookingIntakeRow = Database['public']['Tables']['booking_intakes']['Row']
export type BookingIntakeShowRow = Database['public']['Tables']['booking_intake_shows']['Row']

const DEBOUNCE_MS = 400

export function isV3IntakeRow(row: BookingIntakeRow): boolean {
  return row.schema_version >= INTAKE_SCHEMA_VERSION_V3
}

type IntakePending = { venue?: BookingIntakeVenueDataV3; title?: string }

export function useBookingIntakes() {
  const [intakes, setIntakes] = useState<BookingIntakeRow[]>([])
  const [showsByIntake, setShowsByIntake] = useState<Record<string, BookingIntakeShowRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pendingIntakeRef = useRef<Map<string, IntakePending>>(new Map())
  const pendingShowRef = useRef<Map<string, BookingIntakeShowDataV3>>(new Map())
  const timersRef = useRef<{
    intake: ReturnType<typeof setTimeout> | null
    show: ReturnType<typeof setTimeout> | null
  }>({ intake: null, show: null })
  const scheduleIntakeSaveRef = useRef<((intakeId: string) => void) | null>(null)

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

  const flushIntake = useCallback(
    async (intakeId: string) => {
      const pending = pendingIntakeRef.current.get(intakeId)
      if (!pending || (pending.venue === undefined && pending.title === undefined)) return
      pendingIntakeRef.current.delete(intakeId)
      const patch: Record<string, unknown> = { schema_version: INTAKE_SCHEMA_VERSION_V3 }
      if (pending.venue !== undefined) patch.venue_data = pending.venue as unknown as Record<string, unknown>
      if (pending.title !== undefined) patch.title = pending.title
      const { error: up } = await supabase.from('booking_intakes').update(patch).eq('id', intakeId)
      if (up) {
        setError(up.message)
        await load()
        return
      }
      // Do not call full `load()` here: it replaces all intakes from the server and can briefly
      // overwrite newer optimistic edits (e.g. fast Yes / Different person toggles) if the
      // refetch returns before a follow-up save or races with in-flight local state.
      const { data: meta } = await supabase
        .from('booking_intakes')
        .select('updated_at')
        .eq('id', intakeId)
        .maybeSingle()
      if (meta?.updated_at != null) {
        setIntakes(prev =>
          prev.map(i => (i.id === intakeId ? { ...i, updated_at: meta.updated_at! } : i)),
        )
      }
      const nextPending = pendingIntakeRef.current.get(intakeId)
      if (nextPending && (nextPending.venue !== undefined || nextPending.title !== undefined)) {
        scheduleIntakeSaveRef.current?.(intakeId)
      }
    },
    [load],
  )

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
  scheduleIntakeSaveRef.current = scheduleIntakeSave

  const flushIntakeImmediate = useCallback(
    async (intakeId: string) => {
      if (timersRef.current.intake) {
        clearTimeout(timersRef.current.intake)
        timersRef.current.intake = null
      }
      await flushIntake(intakeId)
    },
    [flushIntake],
  )

  const updateVenueData = useCallback(
    (intakeId: string, patch: Partial<BookingIntakeVenueDataV3>) => {
      setIntakes(prev => {
        const row = prev.find(i => i.id === intakeId)
        if (!row) return prev
        const cur = parseVenueDataV3(row.venue_data, row.schema_version)
        const next: BookingIntakeVenueDataV3 = { ...cur, ...patch, _v: 3 }
        const p = pendingIntakeRef.current.get(intakeId) ?? {}
        pendingIntakeRef.current.set(intakeId, { ...p, venue: next })
        return prev.map(i => (i.id === intakeId ? { ...i, venue_data: next as unknown, schema_version: INTAKE_SCHEMA_VERSION_V3 } : i))
      })
      scheduleIntakeSave(intakeId)
    },
    [scheduleIntakeSave],
  )

  const replaceVenueData = useCallback(
    (intakeId: string, data: BookingIntakeVenueDataV3) => {
      const next = { ...data, _v: 3 as const }
      const p = pendingIntakeRef.current.get(intakeId) ?? {}
      pendingIntakeRef.current.set(intakeId, { ...p, venue: next })
      setIntakes(prev =>
        prev.map(i => (i.id === intakeId ? { ...i, venue_data: next as unknown, schema_version: INTAKE_SCHEMA_VERSION_V3 } : i)),
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

  const updateShowData = useCallback(
    (showId: string, intakeId: string, data: BookingIntakeShowDataV3) => {
      const next = { ...data, _v: 3 as const }
      pendingShowRef.current.set(showId, next)
      setShowsByIntake(prev => ({
        ...prev,
        [intakeId]: (prev[intakeId] ?? []).map(s => (s.id === showId ? { ...s, show_data: next as unknown } : s)),
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

  const flushAllPending = useCallback(async () => {
    if (timersRef.current.intake) {
      clearTimeout(timersRef.current.intake)
      timersRef.current.intake = null
    }
    if (timersRef.current.show) {
      clearTimeout(timersRef.current.show)
      timersRef.current.show = null
    }
    const intakeIds = [...pendingIntakeRef.current.keys()]
    for (const id of intakeIds) await flushIntake(id)
    const showIds = [...pendingShowRef.current.keys()]
    for (const showId of showIds) {
      const { data: row } = await supabase.from('booking_intake_shows').select('intake_id').eq('id', showId).maybeSingle()
      const intakeId = row?.intake_id
      if (intakeId) await flushShow(showId, intakeId)
    }
  }, [flushIntake, flushShow])

  const createIntake = useCallback(async (): Promise<BookingIntakeRow | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const venuePayload = emptyVenueDataV3()
    const showPayload = emptyShowDataV3(0)
    const { data: intake, error: ie } = await supabase
      .from('booking_intakes')
      .insert({
        user_id: user.id,
        title: 'Booking Intake',
        venue_data: venuePayload as unknown as Database['public']['Tables']['booking_intakes']['Insert']['venue_data'],
        schema_version: INTAKE_SCHEMA_VERSION_V3,
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
      await load()
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

  /** Ensures exactly `count` show rows (sort_order 0..count-1). Creates or deletes as needed. */
  const ensureShowCount = useCallback(
    async (intakeId: string, count: 1 | 2 | 3) => {
      const { data: rows } = await supabase
        .from('booking_intake_shows')
        .select('*')
        .eq('intake_id', intakeId)
        .order('sort_order', { ascending: true })
      const list = (rows ?? []) as BookingIntakeShowRow[]
      if (list.length === count) return

      if (list.length > count) {
        for (const s of list.slice(count)) {
          const { error: de } = await supabase.from('booking_intake_shows').delete().eq('id', s.id)
          if (de) setError(de.message)
        }
      } else {
        for (let i = list.length; i < count; i++) {
          const showPayload = emptyShowDataV3(i)
          const { error: ins } = await supabase.from('booking_intake_shows').insert({
            intake_id: intakeId,
            label: `Show ${i + 1}`,
            sort_order: i,
            show_data: showPayload as unknown as Database['public']['Tables']['booking_intake_shows']['Insert']['show_data'],
          })
          if (ins) setError(ins.message)
        }
      }

      const { data: after } = await supabase
        .from('booking_intake_shows')
        .select('*')
        .eq('intake_id', intakeId)
        .order('sort_order', { ascending: true })
      const sorted = (after ?? []) as BookingIntakeShowRow[]
      for (let idx = 0; idx < sorted.length; idx++) {
        if (sorted[idx].sort_order !== idx) {
          await supabase.from('booking_intake_shows').update({ sort_order: idx }).eq('id', sorted[idx].id)
        }
      }
      await load()
    },
    [load],
  )

  const setImportedDealId = useCallback(
    async (showId: string, dealId: string | null) => {
      const { error: up } = await supabase
        .from('booking_intake_shows')
        .update({ imported_deal_id: dealId })
        .eq('id', showId)
      if (up) setError(up.message)
      else await load()
    },
    [load],
  )

  const parseVenue = useCallback((row: BookingIntakeRow) => parseVenueDataV3(row.venue_data, row.schema_version), [])
  const parseShow = useCallback(
    (row: BookingIntakeShowRow) => parseShowDataV3(row.show_data, row.sort_order),
    [],
  )

  return {
    intakes,
    showsByIntake,
    loading,
    error,
    refetch: load,
    parseVenue,
    parseShow,
    createIntake,
    deleteIntake,
    updateVenueData,
    replaceVenueData,
    updateTitle,
    updateShowData,
    updateShowLabel,
    ensureShowCount,
    setImportedDealId,
    flushIntakeImmediate,
    flushAllPending,
  }
}
