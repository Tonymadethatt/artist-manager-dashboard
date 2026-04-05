import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Template } from '@/types'

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('templates')
      .select('*')
      .order('updated_at', { ascending: false })
    setTemplates((data ?? []) as Template[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const addTemplate = async (template: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...template, user_id: user!.id })
      .select()
      .single()
    if (error) return { error }
    setTemplates(prev => [data as Template, ...prev])
    return { data: data as Template }
  }

  const updateTemplate = async (id: string, updates: Partial<Omit<Template, 'id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    setTemplates(prev => prev.map(t => t.id === id ? data as Template : t))
    return { data: data as Template }
  }

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('templates').delete().eq('id', id)
    if (error) return { error }
    setTemplates(prev => prev.filter(t => t.id !== id))
    return {}
  }

  return { templates, loading, refetch: fetchTemplates, addTemplate, updateTemplate, deleteTemplate }
}
