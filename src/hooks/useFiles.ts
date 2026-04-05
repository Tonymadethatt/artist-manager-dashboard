import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GeneratedFile } from '@/types'

export function useFiles() {
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('generated_files')
      .select(`
        *,
        venue:venues(id, name),
        template:templates(id, name)
      `)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setFiles((data ?? []) as GeneratedFile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  const addFile = async (file: Omit<GeneratedFile, 'id' | 'user_id' | 'created_at' | 'venue' | 'template'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('generated_files')
      .insert({
        user_id: user!.id,
        name: file.name,
        content: file.content,
        template_id: file.template_id,
        venue_id: file.venue_id,
      })
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

  return { files, loading, error, refetch: fetchFiles, addFile, deleteFile }
}
