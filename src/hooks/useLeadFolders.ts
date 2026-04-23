import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

export type LeadFolderRow = Database['public']['Tables']['lead_folders']['Row']

const DEFAULT_SEED: { name: string; sort_order: number; is_system: boolean }[] = [
  { name: 'Not Contacted', sort_order: 0, is_system: true },
  { name: 'Reached Out', sort_order: 1, is_system: true },
  { name: 'In Discussion', sort_order: 2, is_system: true },
]

export function useLeadFolders() {
  const [folders, setFolders] = useState<LeadFolderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFolders([])
      setLoading(false)
      return
    }

    const { count, error: countErr } = await supabase
      .from('lead_folders')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)

    if (countErr) {
      setError(countErr.message)
      setLoading(false)
      return
    }

    if (count === 0) {
      const { error: insErr } = await supabase.from('lead_folders').insert(
        DEFAULT_SEED.map(s => ({
          user_id: user.id,
          name: s.name,
          sort_order: s.sort_order,
          is_system: s.is_system,
        })),
      )
      if (insErr) {
        setError(insErr.message)
        setLoading(false)
        return
      }
    }

    const { data, error: qe } = await supabase
      .from('lead_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (qe) {
      setError(qe.message)
      setLoading(false)
      return
    }
    setFolders((data ?? []) as LeadFolderRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createFolder = useCallback(async (name: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not signed in') as Error }
    const trimmed = name.trim()
    if (!trimmed) return { error: new Error('Folder name is required') as Error }
    const maxSort = folders.reduce((m, f) => Math.max(m, f.sort_order), -1)
    const { data, error: e } = await supabase
      .from('lead_folders')
      .insert({
        user_id: user.id,
        name: trimmed,
        sort_order: maxSort + 1,
        is_system: false,
      })
      .select('*')
      .single()
    if (e) return { error: new Error(e.message) }
    setFolders(prev => [...prev, data as LeadFolderRow].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)))
    return { data: data as LeadFolderRow }
  }, [folders])

  const notContactedFolderId = folders.find(f => f.name === 'Not Contacted')?.id ?? null

  /**
   * Removes a user-created folder. Leads in that folder are moved to the built-in
   * "Not Contacted" folder (never deleted). System folders cannot be removed.
   */
  const deleteFolder = useCallback(
    async (folderId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: new Error('Not signed in') as Error, movedLeadCount: 0 }
      const folder = folders.find(f => f.id === folderId)
      if (!folder) return { error: new Error('Folder not found'), movedLeadCount: 0 }
      if (folder.is_system) {
        return { error: new Error('Built-in folders cannot be deleted.'), movedLeadCount: 0 }
      }
      const fallback = folders.find(f => f.name === 'Not Contacted')?.id ?? null
      if (!fallback) {
        return {
          error: new Error('Default folder “Not Contacted” is missing — try refreshing the page.'),
          movedLeadCount: 0,
        }
      }
      if (folderId === fallback) {
        return { error: new Error('Cannot delete the default intake folder.'), movedLeadCount: 0 }
      }

      const { count, error: countErr } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
      if (countErr) return { error: new Error(countErr.message), movedLeadCount: 0 }
      const movedLeadCount = count ?? 0

      const { error: uErr } = await supabase
        .from('leads')
        .update({ folder_id: fallback })
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
      if (uErr) return { error: new Error(uErr.message), movedLeadCount: 0 }

      const { error: dErr } = await supabase
        .from('lead_folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id)
      if (dErr) return { error: new Error(dErr.message), movedLeadCount: 0 }

      setFolders(prev => prev.filter(f => f.id !== folderId))
      return { error: null as null, movedLeadCount, fallbackFolderId: fallback }
    },
    [folders],
  )

  return {
    folders,
    loading,
    error,
    refetch: load,
    createFolder,
    deleteFolder,
    notContactedFolderId,
  }
}
