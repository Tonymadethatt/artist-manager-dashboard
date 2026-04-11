import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  emptyPricingCatalogDoc,
  normalizePricingCatalogDoc,
  type PricingCatalogDoc,
} from '@/types'

export function usePricingCatalog() {
  const [doc, setDoc] = useState<PricingCatalogDoc>(emptyPricingCatalogDoc)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const docRef = useRef(doc)
  docRef.current = doc

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Not authenticated')
      setLoading(false)
      return
    }
    const { data, error: selErr } = await supabase
      .from('user_pricing_catalog')
      .select('doc')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selErr) {
      setError(selErr.message)
      setLoading(false)
      return
    }

    if (!data) {
      const initial = emptyPricingCatalogDoc()
      const { error: insErr } = await supabase
        .from('user_pricing_catalog')
        .insert({ user_id: user.id, doc: initial as unknown as Record<string, unknown> })
      // Concurrent first loads: second insert hits unique user_id — re-select so we load the row
      // that actually exists (never stay on a stale empty doc).
      if (insErr && insErr.code !== '23505') {
        setError(insErr.message)
        setLoading(false)
        return
      }
      const { data: row, error: selAgain } = await supabase
        .from('user_pricing_catalog')
        .select('doc')
        .eq('user_id', user.id)
        .single()
      if (selAgain || !row) {
        setError(selAgain?.message ?? 'Failed to load pricing catalog')
        setLoading(false)
        return
      }
      setDoc(normalizePricingCatalogDoc(row.doc))
      setLastSavedAt(new Date())
    } else {
      setDoc(normalizePricingCatalogDoc(data.doc))
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const saveNow = useCallback(async (next: PricingCatalogDoc) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') as Error }
    setSaving(true)
    setError(null)
    const { error: upErr } = await supabase
      .from('user_pricing_catalog')
      .upsert(
        {
          user_id: user.id,
          doc: next as unknown as Record<string, unknown>,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
    setSaving(false)
    if (upErr) {
      setError(upErr.message)
      return { error: upErr }
    }
    setLastSavedAt(new Date())
    return {}
  }, [])

  const scheduleSave = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flushScheduled = useCallback(() => {
    if (scheduleSave.current) {
      clearTimeout(scheduleSave.current)
      scheduleSave.current = null
    }
  }, [])

  const setDocAndAutosave = useCallback((updater: (d: PricingCatalogDoc) => PricingCatalogDoc) => {
    setDoc(prev => {
      const next = updater(prev)
      flushScheduled()
      scheduleSave.current = setTimeout(() => {
        void saveNow(next)
      }, 650)
      return next
    })
  }, [flushScheduled, saveNow])

  useEffect(() => () => {
    flushScheduled()
  }, [flushScheduled])

  return {
    doc,
    setDoc,
    setDocAndAutosave,
    saveNow: async () => saveNow(docRef.current),
    loading,
    saving,
    error,
    lastSavedAt,
    reload: load,
  }
}

export type PricingCatalogHook = ReturnType<typeof usePricingCatalog>
