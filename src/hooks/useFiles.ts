import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GeneratedFile } from '@/types'

export function useFiles() {
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [loading, setLoading] = useState(true)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('generated_files')
      .select(`
        *,
        venue:venues(id, name),
        template:templates(id, name)
      `)
      .order('created_at', { ascending: false })
    setFiles((data ?? []) as GeneratedFile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const addFile = async (file: Omit<GeneratedFile, 'id' | 'created_at' | 'venue' | 'template'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('generated_files')
      .insert({ ...file, user_id: user!.id })
      .select(`
        *,
        venue:venues(id, name),
        template:templates(id, name)
      `)
      .single()
    if (error) return { error }
    setFiles(prev => [data as GeneratedFile, ...prev])
    return { data: data as GeneratedFile }
  }

  const deleteFile = async (id: string) => {
    const { error } = await supabase.from('generated_files').delete().eq('id', id)
    if (error) return { error }
    setFiles(prev => prev.filter(f => f.id !== id))
    return {}
  }

  return { files, loading, refetch: fetchFiles, addFile, deleteFile }
}
