import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { ProfileFieldPresetKey } from '@/types'

export interface ProfileFieldPresetRow {
  id: string
  user_id: string
  field_key: ProfileFieldPresetKey
  value: string
  created_at: string
}

export function useProfileFieldPresets(userId: string | null) {
  const [rows, setRows] = useState<ProfileFieldPresetRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPresets = useCallback(async () => {
    if (!userId) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('profile_field_preset')
      .select('id, user_id, field_key, value, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      setRows([])
      setLoading(false)
      return
    }
    setRows((data ?? []) as ProfileFieldPresetRow[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    void fetchPresets()
  }, [fetchPresets])

  const presetsFor = useCallback(
    (fieldKey: ProfileFieldPresetKey): ProfileFieldPresetRow[] =>
      rows.filter(r => r.field_key === fieldKey),
    [rows]
  )

  const addPreset = useCallback(
    async (fieldKey: ProfileFieldPresetKey, valueWrittenToProfile: string | null | undefined) => {
      if (!userId) return { ok: false as const, error: new Error('Not signed in') }
      const trimmed =
        valueWrittenToProfile === null || valueWrittenToProfile === undefined
          ? ''
          : String(valueWrittenToProfile).trim()
      if (!trimmed) return { ok: true as const }

      const { error } = await supabase.from('profile_field_preset').insert({
        user_id: userId,
        field_key: fieldKey,
        value: trimmed,
      })

      if (error) {
        if (error.code === '23505') return { ok: true as const }
        return { ok: false as const, error }
      }
      await fetchPresets()
      return { ok: true as const }
    },
    [userId, fetchPresets]
  )

  const deletePreset = useCallback(
    async (id: string) => {
      const { error } = await supabase.from('profile_field_preset').delete().eq('id', id)
      if (error) return { error }
      await fetchPresets()
      return {}
    },
    [fetchPresets]
  )

  return { loading, rows, presetsFor, refresh: fetchPresets, addPreset, deletePreset }
}
