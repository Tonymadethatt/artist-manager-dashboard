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

/** Ensure jsonb payload is JSON-serializable (strip undefined, functions, etc.). */
function layoutForDb(layout: EmailTemplateLayoutV1 | null): EmailTemplateLayoutV1 | null {
  if (layout === null) return null
  try {
    return JSON.parse(JSON.stringify(layout)) as EmailTemplateLayoutV1
  } catch {
    return null
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

    const existing = templates.find(t => t.email_type === email_type)

    const base: Record<string, unknown> = {
      user_id: user.id,
      email_type,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) base.id = existing.id

    if (updates.custom_subject !== undefined) base.custom_subject = updates.custom_subject
    if (updates.custom_intro !== undefined) base.custom_intro = updates.custom_intro

    if (updates.layout !== undefined) {
      const layoutStore = layoutForDb(updates.layout)
      const legacy = deriveLegacyColumnsFromLayout(layoutStore)
      base.layout = layoutStore
      base.layout_version = 1
      base.custom_subject = legacy.custom_subject
      base.custom_intro = legacy.custom_intro
    }

    const { data: rows, error } = await supabase
      .from('email_templates')
      .upsert(base as never, { onConflict: 'user_id, email_type' })
      .select()

    if (error) {
      const raw = [error.message, (error as { details?: string }).details, (error as { hint?: string }).hint]
        .filter(Boolean)
        .join(' — ')
      const msg = raw || 'email_templates upsert failed'
      const layoutCache = /layout/i.test(msg) && /schema cache/i.test(msg)
      return {
        error: new Error(
          layoutCache
            ? `${msg} Run the SQL in supabase/migrations/021_ensure_email_templates_layout.sql on your Supabase project (adds layout + layout_version), then wait a minute or use Dashboard → Settings → API → Reload schema.`
            : msg,
        ),
      }
    }
    const tmpl = (Array.isArray(rows) ? rows[0] : null) as EmailTemplate | null
    if (!tmpl) {
      return { error: new Error('Save returned no row (check RLS and email_templates unique on user_id, email_type).') }
    }
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

  const deleteTemplate = async (email_type: AnyEmailType) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { error } = await supabase
      .from('email_templates')
      .delete()
      .eq('user_id', user.id)
      .eq('email_type', email_type)
    if (error) return { error: new Error(error.message) }
    setTemplates(prev => prev.filter(t => t.email_type !== email_type))
    return {}
  }

  const getTemplate = (email_type: AnyEmailType): EmailTemplate | undefined => {
    return templates.find(t => t.email_type === email_type)
  }

  return {
    templates,
    loading,
    upsertTemplate,
    resetTemplate,
    deleteTemplate,
    getTemplate,
    refetch: fetchTemplates,
  }
}
