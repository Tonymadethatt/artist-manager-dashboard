import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Task, ArtistProfile, GeneratedFile } from '@/types'

type LeadRow = Database['public']['Tables']['leads']['Row']
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { leadMergeFieldsFromDatabaseLead } from '@/lib/email/customEmailMerge'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import { hasRecentLeadEmailEventDedupe } from '@/lib/queueEmailsFromTemplate'
import { parseResendMessageIdFromSendFunctionJson } from '@/lib/email/resendMessageId'

function recipientNameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'there'
  const first = local.split(/[._-]/)[0] ?? local
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'there'
}

function artistProfilePayload(p: ArtistProfile) {
  return {
    artist_name: p.artist_name,
    company_name: p.company_name,
    from_email: p.from_email,
    reply_to_email: p.reply_to_email,
    manager_name: p.manager_name ?? null,
    manager_title: p.manager_title ?? null,
    website: p.website,
    phone: p.phone,
    social_handle: p.social_handle,
    tagline: p.tagline,
  }
}

/**
 * Send lead custom template email immediately and log to `lead_email_events` (task completion automation).
 */
export async function queueLeadCustomEmailOnTaskComplete(
  task: Task,
  userId: string,
): Promise<{ ok: boolean; reason: string }> {
  if (!task.lead_id) {
    return { ok: false, reason: 'no_lead_for_lead_email' }
  }
  const cid = parseCustomTemplateId(task.email_type)
  if (!cid) {
    return { ok: false, reason: 'unsupported_email_type' }
  }

  const { data: leadRow, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', task.lead_id)
    .eq('user_id', userId)
    .maybeSingle()
  if (leadErr || !leadRow) {
    return { ok: false, reason: 'no_lead_for_lead_email' }
  }

  const recipient = String(leadRow.contact_email ?? '').trim()
  if (!recipient) {
    return { ok: false, reason: 'no_lead_contact_email' }
  }

  if (await hasRecentLeadEmailEventDedupe(userId, task.lead_id, task.email_type!, 45)) {
    return { ok: true, reason: 'dedupe_recent_pending' }
  }

  const { data: template, error: tErr } = await supabase
    .from('custom_email_templates')
    .select('id, name, subject_template, blocks, audience, attachment_generated_file_id')
    .eq('id', cid)
    .eq('user_id', userId)
    .maybeSingle()
  if (tErr || !template || template.audience !== 'lead') {
    return { ok: false, reason: 'custom_template_not_found' }
  }

  const { data: profile } = await supabase
    .from('artist_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const p = profile as ArtistProfile | null
  if (!p?.from_email?.trim()) {
    return { ok: false, reason: 'no_from_email' }
  }

  const leadMerge = leadMergeFieldsFromDatabaseLead(leadRow as LeadRow)
  const payload: Record<string, unknown> = {
    user_id: userId,
    profile: artistProfilePayload(p),
    recipient: { name: recipientNameFromEmail(recipient), email: recipient },
    custom_lead_template: {
      subject_template: template.subject_template?.trim() || ' ',
      blocks: template.blocks,
    },
    lead: leadMerge,
  }

  const aid = template.attachment_generated_file_id as string | null | undefined
  if (aid) {
    const { data: gf } = await supabase
      .from('generated_files')
      .select('*')
      .eq('id', aid)
      .eq('user_id', userId)
      .maybeSingle()
    const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
    if (att) payload.attachment = att
  }

  const res = await fetch('/.netlify/functions/send-venue-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const rawJson = await res.json().catch(() => null)
  if (!res.ok) {
    const msg =
      rawJson && typeof rawJson === 'object' && 'message' in rawJson
        ? String((rawJson as { message: unknown }).message)
        : 'Send failed'
    console.error('[queueLeadCustomEmailOnTaskComplete]', msg)
    return { ok: false, reason: 'lead_email_send_failed' }
  }

  const resendId = parseResendMessageIdFromSendFunctionJson(rawJson)
  let logSubject = template.name
  if (rawJson && typeof rawJson === 'object' && 'subject' in rawJson) {
    const s = (rawJson as { subject: unknown }).subject
    if (typeof s === 'string' && s.trim()) logSubject = s.trim()
  }

  const { error: insErr } = await supabase.from('lead_email_events').insert({
    user_id: userId,
    lead_id: task.lead_id,
    custom_email_template_id: cid,
    email_type: task.email_type!,
    recipient_email: recipient,
    subject: logSubject,
    status: 'sent',
    sent_at: new Date().toISOString(),
    resend_message_id: resendId,
    task_id: task.id,
    notes: `Auto-sent from task: ${task.title}`,
  })
  if (insErr) {
    console.error('[queueLeadCustomEmailOnTaskComplete] lead_email_events insert:', insErr.message)
    return { ok: false, reason: 'lead_email_log_failed' }
  }

  return { ok: true, reason: 'lead_email_sent' }
}
