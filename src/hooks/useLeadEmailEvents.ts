import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import type { Database } from '@/types/database'

export type LeadEmailEventRow = Database['public']['Tables']['lead_email_events']['Row']

export type LeadEmailEventWithTemplate = LeadEmailEventRow & {
  template_name: string | null
}

export function useLeadEmailEvents(leadId: string | null) {
  const [rows, setRows] = useState<LeadEmailEventWithTemplate[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!leadId) {
      setRows([])
      return
    }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      setLoading(false)
      return
    }
    const { data, error } = await supabase
      .from('lead_email_events')
      .select('*')
      .eq('user_id', user.id)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })

    if (error || !data) {
      setRows([])
      setLoading(false)
      return
    }

    const base = (data ?? []) as LeadEmailEventRow[]
    const templateIds = [
      ...new Set(
        base
          .map(r => parseCustomTemplateId(r.email_type))
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    ]
    const nameById = new Map<string, string>()
    if (templateIds.length > 0) {
      const { data: trows } = await supabase
        .from('custom_email_templates')
        .select('id, name')
        .eq('user_id', user.id)
        .in('id', templateIds)
      for (const t of trows ?? []) {
        const row = t as { id: string; name: string }
        nameById.set(row.id, row.name)
      }
    }

    setRows(
      base.map(r => ({
        ...r,
        template_name: (() => {
          const tid = parseCustomTemplateId(r.email_type)
          return tid ? (nameById.get(tid) ?? null) : null
        })(),
      })),
    )
    setLoading(false)
  }, [leadId])

  useEffect(() => {
    void load()
  }, [load])

  return { rows, loading, refetch: load }
}
