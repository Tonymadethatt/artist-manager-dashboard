import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { LeadImportPickedFields } from '@/lib/leadIntake/parseLeadResearchImport'

export type LeadRow = Database['public']['Tables']['leads']['Row']

export type LeadWithMeta = LeadRow & {
  folder_name: string | null
  last_contacted_at: string | null
  /** From embedded `venues` for `promoted_venue_id`, for list/detail labels. */
  promoted_venue_name: string | null
}

type LeadRowWithVenue = LeadRow & {
  promoted_venue?: { id: string; name: string } | null
}

function toLeadWithMeta(
  raw: LeadRowWithVenue,
  folderNameById: Map<string, string>,
  lastContactedAt: string | null,
): LeadWithMeta {
  const { promoted_venue, ...rest } = raw
  return {
    ...rest,
    folder_name: folderNameById.get(rest.folder_id) ?? null,
    last_contacted_at: lastContactedAt,
    promoted_venue_name: promoted_venue?.name ?? null,
  }
}

function buildLastContactedMap(
  rows: { lead_id: string; sent_at: string | null }[],
): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of rows) {
    if (!r.sent_at) continue
    const prev = m.get(r.lead_id)
    if (!prev || r.sent_at > prev) m.set(r.lead_id, r.sent_at)
  }
  return m
}

export function useLeads(folderNameById: Map<string, string>) {
  const [leads, setLeads] = useState<LeadWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setLeads([])
      setLoading(false)
      return
    }

    const { data: leadRows, error: le } = await supabase
      .from('leads')
      .select(`
        *,
        promoted_venue:venues!leads_promoted_venue_fkey (id, name)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (le) {
      setError(le.message)
      setLoading(false)
      return
    }

    const list = (leadRows ?? []) as LeadRowWithVenue[]
    const ids = list.map(l => l.id)
    let lastMap = new Map<string, string>()
    if (ids.length > 0) {
      const { data: evs, error: ee } = await supabase
        .from('lead_email_events')
        .select('lead_id, sent_at')
        .eq('user_id', user.id)
        .eq('status', 'sent')
        .in('lead_id', ids)
        .not('sent_at', 'is', null)

      if (!ee && evs) {
        lastMap = buildLastContactedMap(evs as { lead_id: string; sent_at: string | null }[])
      }
    }

    const enriched: LeadWithMeta[] = list.map(l =>
      toLeadWithMeta(l, folderNameById, lastMap.get(l.id) ?? null),
    )

    setLeads(enriched)
    setLoading(false)
  }, [folderNameById])

  useEffect(() => {
    void load()
  }, [load])

  const insertLeads = useCallback(
    async (rows: LeadImportPickedFields[], folderId: string) => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { error: new Error('Not signed in'), count: 0 }
      const payload = rows.map(r => ({
        user_id: user.id,
        folder_id: folderId,
        venue_name: r.venue_name || null,
        instagram_handle: r.instagram_handle || null,
        genre: r.genre || null,
        event_name: r.event_name || null,
        crowd_type: r.crowd_type || null,
        resident_dj: r.resident_dj || null,
        city: r.city || null,
        contact_email: r.contact_email || null,
        contact_phone: r.contact_phone || null,
        website: r.website || null,
        research_notes: r.research_notes || null,
      }))
      const { error: insErr } = await supabase.from('leads').insert(payload)
      if (insErr) return { error: new Error(insErr.message), count: 0 }
      await load()
      return { count: payload.length, error: null as null }
    },
    [load],
  )

  const addLead = useCallback(
    async (r: LeadImportPickedFields, folderId: string) => {
      const res = await insertLeads([r], folderId)
      return res
    },
    [insertLeads],
  )

  const updateLead = useCallback(
    async (id: string, patch: Partial<Omit<LeadRow, 'id' | 'user_id' | 'created_at'>>) => {
      const { error: u, data } = await supabase
        .from('leads')
        .update(patch)
        .eq('id', id)
        .select(`
          *,
          promoted_venue:venues!leads_promoted_venue_fkey (id, name)
        `)
        .single()
      if (u) return { error: new Error(u.message) }
      const row = data as LeadRowWithVenue
      let lastContact: string | null = null
      setLeads(prev => {
        lastContact = prev.find(x => x.id === id)?.last_contacted_at ?? null
        return prev.map(l => (l.id === id
          ? toLeadWithMeta(row, folderNameById, lastContact)
          : l))
      })
      return { data: toLeadWithMeta(row, folderNameById, lastContact) }
    },
    [folderNameById],
  )

  const deleteLead = useCallback(
    async (id: string) => {
      const { error: d } = await supabase.from('leads').delete().eq('id', id)
      if (d) return { error: new Error(d.message) }
      setLeads(prev => prev.filter(l => l.id !== id))
      return {}
    },
    [],
  )

  return {
    leads,
    loading,
    error,
    refetch: load,
    insertLeads,
    addLead,
    updateLead,
    deleteLead,
  }
}
