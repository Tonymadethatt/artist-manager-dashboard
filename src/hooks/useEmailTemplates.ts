import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import type { EmailTemplate, AnyEmailType } from '@/types'

export type UpsertEmailTemplateInput = {
  custom_subject?: string | null
  custom_intro?: string | null
  layout?: EmailTemplateLayoutV1 | null
}

/** Sync legacy columns from layout so older code paths still see subject/intro. */
function deriveLegacyColumnsFromLayout(layout: EmailTemplateLayoutV1 | null | undefined): {
  custom_subject: string | null
  custom_intro: string | null
} {
  if (!layout) {
    return { custom_subject: null, custom_intro: null }
  }
  return {
    custom_subject: layout.subject?.trim() || null,
    custom_intro: layout.intro?.trim() || null,
  }
}

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

  const upsertTemplate = async (email_type: AnyEmailType, updates: UpsertEmailTemplateInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const base: Record<string, unknown> = {
      user_id: user.id,
      email_type,
      updated_at: new Date().toISOString(),
    }

    if (updates.custom_subject !== undefined) base.custom_subject = updates.custom_subject
    if (updates.custom_intro !== undefined) base.custom_intro = updates.custom_intro

    if (updates.layout !== undefined) {
      const legacy = deriveLegacyColumnsFromLayout(updates.layout)
      base.layout = updates.layout
      base.layout_version = 1
      base.custom_subject = legacy.custom_subject
      base.custom_intro = legacy.custom_intro
    }

    const { data, error } = await supabase
      .from('email_templates')
      .upsert(base as never, { onConflict: 'user_id,email_type' })
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

  const resetTemplate = async (email_type: AnyEmailType) => {
    return upsertTemplate(email_type, {
      custom_subject: null,
      custom_intro: null,
      layout: null,
    })
  }

  const getTemplate = (email_type: AnyEmailType): EmailTemplate | undefined => {
    return templates.find(t => t.email_type === email_type)
  }

  return { templates, loading, upsertTemplate, resetTemplate, getTemplate, refetch: fetchTemplates }
}
