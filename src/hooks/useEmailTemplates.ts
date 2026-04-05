import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { EmailTemplate, VenueEmailType } from '@/types'

export function useEmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('email_templates')
      .select('*')
      .order('email_type')
    setTemplates((data ?? []) as EmailTemplate[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const upsertTemplate = async (
    email_type: VenueEmailType,
    updates: { custom_subject?: string | null; custom_intro?: string | null }
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('email_templates')
      .upsert(
        { user_id: user.id, email_type, ...updates, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,email_type' }
      )
      .select()
      .single()

    if (error) return { error: new Error(error.message) }
    const tmpl = data as EmailTemplate
    setTemplates(prev => {
      const exists = prev.find(t => t.email_type === email_type)
      if (exists) return prev.map(t => t.email_type === email_type ? tmpl : t)
      return [...prev, tmpl]
    })
    return { data: tmpl }
  }

  const resetTemplate = async (email_type: VenueEmailType) => {
    return upsertTemplate(email_type, { custom_subject: null, custom_intro: null })
  }

  const getTemplate = (email_type: VenueEmailType): EmailTemplate | undefined => {
    return templates.find(t => t.email_type === email_type)
  }

  return { templates, loading, upsertTemplate, resetTemplate, getTemplate, refetch: fetchTemplates }
}
