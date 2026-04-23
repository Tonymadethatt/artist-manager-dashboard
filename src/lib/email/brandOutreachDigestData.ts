import { FIRST_OUTREACH_LEAD_NAME } from '@/lib/email/firstOutreachLeadTemplate'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

type LeadRow = Database['public']['Tables']['leads']['Row']
type Lero = SupabaseClient<Database>

const PAGE = 1000
const MAX_EVENT_PAGES = 20

/**
 * Resolves a single display string for a lead (never the word "leads").
 * venue_name → event_name → @instagram → contact local part → city → neutral fallback.
 */
export function brandDisplayNameForLead(
  lead: Pick<LeadRow, 'venue_name' | 'event_name' | 'instagram_handle' | 'contact_email' | 'city'>,
): string {
  const v = lead.venue_name?.trim()
  if (v) return v
  const e = lead.event_name?.trim()
  if (e) return e
  const ig = lead.instagram_handle?.trim()
  if (ig) return ig.startsWith('@') ? ig : `@${ig}`
  const em = lead.contact_email?.trim()
  if (em) {
    const at = em.indexOf('@')
    if (at > 0) return em.slice(0, at)
    return em
  }
  const c = lead.city?.trim()
  if (c) return c
  return 'New contact'
}

export async function fetchFirstOutreachLeadTemplateIds(ero: Lero, userId: string): Promise<string[]> {
  const { data, error } = await ero
    .from('custom_email_templates')
    .select('id')
    .eq('user_id', userId)
    .eq('audience', 'lead')
    .eq('name', FIRST_OUTREACH_LEAD_NAME)
  if (error) {
    console.error('[fetchFirstOutreachLeadTemplateIds]', error.message)
    return []
  }
  return (data ?? []).map(r => r.id as string).filter(Boolean)
}

export type BrandOutreachDigestPayload = {
  brandNames: string[]
  uniqueTotal: number
  notShownCount: number
  hasData: boolean
}

/**
 * Aggregates lead_email_events for the First Outreach template: unique leads by
 * max(sent_at), up to 50 display names, total distinct count, and "not shown" remainder.
 * Events are read in pages; leads are still joined for current names (delete cascades).
 */
export async function loadBrandOutreachDigestData(
  ero: Lero,
  userId: string,
  templateIds: string[],
): Promise<BrandOutreachDigestPayload> {
  if (templateIds.length === 0) {
    return { brandNames: [], uniqueTotal: 0, notShownCount: 0, hasData: false }
  }

  const byLeadMax: Map<string, string> = new Map()

  for (let p = 0; p < MAX_EVENT_PAGES; p += 1) {
    const from = p * PAGE
    const to = from + PAGE - 1
    const { data, error } = await ero
      .from('lead_email_events')
      .select('lead_id, sent_at')
      .eq('user_id', userId)
      .in('custom_email_template_id', templateIds)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
      .order('sent_at', { ascending: true })
      .range(from, to)
    if (error) {
      console.error('[loadBrandOutreachDigestData] lead_email_events', error.message)
      return { brandNames: [], uniqueTotal: 0, notShownCount: 0, hasData: false }
    }
    const rows = data ?? []
    for (const row of rows) {
      const lid = row.lead_id as string
      const t = (row.sent_at as string) ?? ''
      const prev = byLeadMax.get(lid)
      if (!prev || t > prev) byLeadMax.set(lid, t)
    }
    if (rows.length < PAGE) break
  }

  const uniqueTotal = byLeadMax.size
  if (uniqueTotal === 0) {
    return { brandNames: [], uniqueTotal: 0, notShownCount: 0, hasData: false }
  }

  const sorted = [...byLeadMax.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]))
  const top = sorted.slice(0, 50).map(([id]) => id)
  const notShownCount = Math.max(0, uniqueTotal - 50)

  const { data: leadRows, error: lErr } = await ero
    .from('leads')
    .select('id, venue_name, event_name, instagram_handle, contact_email, city')
    .eq('user_id', userId)
    .in('id', top)

  if (lErr) {
    console.error('[loadBrandOutreachDigestData] leads', lErr.message)
    return { brandNames: [], uniqueTotal: 0, notShownCount: 0, hasData: false }
  }

  type LPick = Pick<LeadRow, 'venue_name' | 'event_name' | 'instagram_handle' | 'contact_email' | 'city'>
  const byId = new Map<string, LPick>(
    (leadRows ?? []).map(l => [l.id as string, l as LPick] as [string, LPick]),
  )
  const brandNames = top.map(lid => {
    const l = byId.get(lid)
    if (!l) return '…'
    return brandDisplayNameForLead(l)
  })

  return {
    brandNames,
    uniqueTotal,
    notShownCount,
    hasData: true,
  }
}

export async function hasFirstOutreachSentEvent(
  ero: Lero,
  userId: string,
  templateIds: string[],
): Promise<boolean> {
  if (templateIds.length === 0) return false
  const { data, error } = await ero
    .from('lead_email_events')
    .select('id')
    .eq('user_id', userId)
    .in('custom_email_template_id', templateIds)
    .eq('status', 'sent')
    .limit(1)
  if (error) return false
  return (data?.length ?? 0) > 0
}
