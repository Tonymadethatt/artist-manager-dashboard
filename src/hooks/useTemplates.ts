import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Template } from '@/types'

type TemplateUpdate = Database['public']['Tables']['templates']['Update']

export function useTemplates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('updated_at', { ascending: false })
    if (error) setError(error.message)
    else setTemplates((data ?? []) as Template[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const addTemplate = async (template: Omit<Template, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('templates')
      .insert({
        user_id: user!.id,
        name: template.name,
        type: template.type,
        sections: template.sections,
      })
      .select()
      .single()
    if (error) return { error }
    setTemplates(prev => [data as Template, ...prev])
    return { data: data as Template }
  }

  const updateTemplate = async (id: string, updates: Omit<TemplateUpdate, 'id' | 'user_id'>) => {
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

  return { templates, loading, error, refetch: fetchTemplates, addTemplate, updateTemplate, deleteTemplate }
}
