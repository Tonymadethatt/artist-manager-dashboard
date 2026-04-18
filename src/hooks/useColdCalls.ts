import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import {
  coldCallTemperatureToDb,
  emptyColdCallDataV1,
  parseColdCallData,
  type ColdCallDataV1,
} from '@/lib/coldCall/coldCallPayload'

export type ColdCallRow = Database['public']['Tables']['cold_calls']['Row']

const DEBOUNCE_MS = 400

type Pending = { callData?: ColdCallDataV1; title?: string }

function rowSnapshotFromData(data: ColdCallDataV1): Partial<ColdCallRow> {
  const temp = (data.final_temperature || data.operator_temperature || '').trim()
  return {
    temperature: coldCallTemperatureToDb(temp as ColdCallDataV1['operator_temperature']),
    outcome: data.outcome || '',
    call_purpose: data.call_purpose || '',
    duration_feel: data.call_duration_feel || '',
    who_answered: data.who_answered || '',
    rejection_reason: data.rejection_reason || null,
    save_to_pipeline: data.save_to_pipeline,
    follow_up_date: data.follow_up_date.trim() || null,
    next_actions: data.next_actions.length ? (data.next_actions as unknown as Database['public']['Tables']['cold_calls']['Row']['next_actions']) : null,
    notes: data.call_notes.trim() || null,
  }
}

export function useColdCalls() {
  const [calls, setCalls] = useState<ColdCallRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const pendingRef = useRef<Map<string, Pending>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleRef = useRef<((id: string) => void) | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setCalls([])
      setLoading(false)
      return
    }
    const { data, error: qe } = await supabase
      .from('cold_calls')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (qe) {
      setError(qe.message)
      setLoading(false)
      return
    }
    setCalls((data ?? []) as ColdCallRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [load])

  const flush = useCallback(
    async (id: string) => {
      const pending = pendingRef.current.get(id)
      if (!pending || (pending.callData === undefined && pending.title === undefined)) return
      pendingRef.current.delete(id)
      const patch: Record<string, unknown> = {}
      if (pending.title !== undefined) patch.title = pending.title
      if (pending.callData !== undefined) {
        patch.call_data = pending.callData as unknown as Record<string, unknown>
        Object.assign(patch, rowSnapshotFromData(pending.callData))
      }
      const { error: up } = await supabase.from('cold_calls').update(patch).eq('id', id)
      if (up) {
        setError(up.message)
        await load()
        return
      }
      setError(null)
      const { data: meta } = await supabase.from('cold_calls').select('updated_at').eq('id', id).maybeSingle()
      if (meta?.updated_at) {
        setCalls(prev => prev.map(c => (c.id === id ? { ...c, updated_at: meta.updated_at! } : c)))
      }
      const next = pendingRef.current.get(id)
      if (next && (next.callData !== undefined || next.title !== undefined)) scheduleRef.current?.(id)
    },
    [load],
  )

  const schedule = useCallback(
    (id: string) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        void flush(id)
      }, DEBOUNCE_MS)
    },
    [flush],
  )
  scheduleRef.current = schedule

  const flushImmediate = useCallback(
    async (id: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      await flush(id)
    },
    [flush],
  )

  const updateCallData = useCallback(
    (id: string, updater: (prev: ColdCallDataV1) => ColdCallDataV1) => {
      setCalls(prev => {
        const row = prev.find(c => c.id === id)
        if (!row) return prev
        const cur = parseColdCallData(row.call_data)
        const next = updater(cur)
        const p = pendingRef.current.get(id) ?? {}
        pendingRef.current.set(id, { ...p, callData: next })
        return prev.map(c => (c.id === id ? { ...c, call_data: next as unknown } : c))
      })
      schedule(id)
    },
    [schedule],
  )

  const replaceCallData = useCallback(
    (id: string, data: ColdCallDataV1) => {
      const p = pendingRef.current.get(id) ?? {}
      pendingRef.current.set(id, { ...p, callData: data })
      setCalls(prev => prev.map(c => (c.id === id ? { ...c, call_data: data as unknown } : c)))
      schedule(id)
    },
    [schedule],
  )

  const updateTitle = useCallback(
    (id: string, title: string) => {
      const p = pendingRef.current.get(id) ?? {}
      pendingRef.current.set(id, { ...p, title })
      setCalls(prev => prev.map(c => (c.id === id ? { ...c, title } : c)))
      schedule(id)
    },
    [schedule],
  )

  const patchRow = useCallback(
    async (id: string, patch: Partial<ColdCallRow>) => {
      const { error: up } = await supabase.from('cold_calls').update(patch).eq('id', id)
      if (up) setError(up.message)
      else await load()
    },
    [load],
  )

  const createColdCall = useCallback(async (): Promise<ColdCallRow | null> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const callData = emptyColdCallDataV1()
    const { data, error: ins } = await supabase
      .from('cold_calls')
      .insert({
        user_id: user.id,
        title: 'Cold call',
        call_data: callData as unknown as Database['public']['Tables']['cold_calls']['Insert']['call_data'],
        ...rowSnapshotFromData(callData),
      })
      .select()
      .single()
    if (ins || !data) {
      setError(ins?.message ?? 'Could not create cold call')
      return null
    }
    await load()
    return data as ColdCallRow
  }, [load])

  const deleteColdCall = useCallback(
    async (id: string) => {
      const { error: de } = await supabase.from('cold_calls').delete().eq('id', id)
      if (de) setError(de.message)
      else await load()
    },
    [load],
  )

  const parseData = useCallback((row: ColdCallRow) => parseColdCallData(row.call_data), [])

  const flushAllPending = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const ids = [...pendingRef.current.keys()]
    for (const id of ids) await flush(id)
  }, [flush])

  return {
    calls,
    loading,
    error,
    refetch: load,
    parseData,
    createColdCall,
    deleteColdCall,
    updateCallData,
    replaceCallData,
    updateTitle,
    patchRow,
    flushImmediate,
    flushAllPending,
  }
}
