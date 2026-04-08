import type { SupabaseClient } from '@supabase/supabase-js'
import type { VenueEmailStatus } from '@/types'

export type OutboundEmailSource =
  | 'task_automation'
  | 'performance_form'
  | 'reports_manual'
  | 'earnings_manual'
  | 'modal_immediate'
  | 'queue_cron'
  | 'email_queue_send_now'

const SOURCE_TAG = (s: OutboundEmailSource) => `[src:${s}]`

/** Format outbound-audit note so History and support can see provenance without a new table. */
export function formatOutboundEmailNotes(source: OutboundEmailSource, detail?: string | null): string {
  const tag = SOURCE_TAG(source)
  const d = detail?.trim()
  return d ? `${tag} ${d}` : tag
}

export async function recordOutboundEmail(
  client: SupabaseClient,
  params: {
    user_id: string
    venue_id?: string | null
    deal_id?: string | null
    contact_id?: string | null
    email_type: string
    recipient_email: string
    subject: string
    status: VenueEmailStatus
    source: OutboundEmailSource
    detail?: string | null
    notes?: string | null
  },
): Promise<{ error: Error | null; id?: string }> {
  const sentAt = params.status === 'sent' ? new Date().toISOString() : null
  const notesBase = formatOutboundEmailNotes(params.source, params.detail)
  const notes = params.notes != null && params.notes.trim()
    ? `${notesBase}\n${params.notes.trim()}`
    : notesBase
  const { data, error } = await client.from('venue_emails').insert({
    user_id: params.user_id,
    venue_id: params.venue_id ?? null,
    deal_id: params.deal_id ?? null,
    contact_id: params.contact_id ?? null,
    email_type: params.email_type,
    recipient_email: params.recipient_email,
    subject: params.subject,
    status: params.status,
    sent_at: sentAt,
    notes,
  }).select('id').single()
  return { error: error ? new Error(error.message) : null, id: data?.id as string | undefined }
}
