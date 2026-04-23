import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Task, ArtistProfile, GeneratedFile } from '@/types'

type LeadRow = Database['public']['Tables']['leads']['Row']
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { leadMergeFieldsFromDatabaseLead, recipientNameFromContactEmail } from '@/lib/email/customEmailMerge'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import { hasRecentLeadEmailEventDedupe } from '@/lib/queueEmailsFromTemplate'
import { parseResendMessageIdFromSendFunctionJson } from '@/lib/email/resendMessageId'

function artistProfilePayload(p: ArtistProfile) {
  return {
    artist_name: p.artist_name,
    company_name: p.company_name,
    from_email: p.from_email,
    reply_to_email: p.reply_to_email,
    manager_name: p.manager_name ?? null,
    manager_title: p.manager_title ?? null,
    website: p.website,
    press_kit_url: p.press_kit_url ?? null,
    phone: p.phone,
    social_handle: p.social_handle,
    tagline: p.tagline,
  }
}

type LeadTemplateRow = {
  id: string
  name: string
  subject_template: string | null
  blocks: unknown
  audience: string
  attachment_generated_file_id: string | null
  move_to_folder_id: string | null
}

async function sendLeadTemplateToOneLead(args: {
  userId: string
  task: Task
  leadRow: LeadRow
  template: LeadTemplateRow
  emailType: string
}): Promise<{ ok: boolean; reason: string }> {
  const { userId, task, leadRow, template, emailType } = args
  const cid = template.id
  const recipient = String(leadRow.contact_email ?? '').trim()
  if (!recipient) {
    return { ok: false, reason: 'no_lead_contact_email' }
  }

  if (await hasRecentLeadEmailEventDedupe(userId, leadRow.id, emailType, 45)) {
    return { ok: true, reason: 'dedupe_recent_pending' }
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
    recipient: { name: recipientNameFromContactEmail(recipient), email: recipient },
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
    console.error('[sendLeadTemplateToOneLead]', msg)
    return { ok: false, reason: 'lead_email_send_failed' }
  }

  const resendId = parseResendMessageIdFromSendFunctionJson(rawJson)
  let logSubject = template.name
  if (rawJson && typeof rawJson === 'object' && 'subject' in rawJson) {
    const s = (rawJson as { subject: unknown }).subject
    if (typeof s === 'string' && s.trim()) logSubject = s.trim()
  }

  const folderBefore = leadRow.folder_id
  const moveTo = template.move_to_folder_id

  const { data: inserted, error: insErr } = await supabase
    .from('lead_email_events')
    .insert({
      user_id: userId,
      lead_id: leadRow.id,
      custom_email_template_id: cid,
      email_type: emailType,
      recipient_email: recipient,
      subject: logSubject,
      status: 'sent',
      sent_at: new Date().toISOString(),
      resend_message_id: resendId,
      task_id: task.id,
      notes: `Auto-sent from task: ${task.title}`,
      folder_id_before: folderBefore,
      moved_to_folder_id: null,
    })
    .select('id')
    .single()

  if (insErr || !inserted) {
    console.error('[sendLeadTemplateToOneLead] lead_email_events insert:', insErr?.message)
    return { ok: false, reason: 'lead_email_log_failed' }
  }

  const eventId = inserted.id as string

  if (moveTo && moveTo !== folderBefore) {
    const { error: upLead } = await supabase
      .from('leads')
      .update({ folder_id: moveTo })
      .eq('id', leadRow.id)
      .eq('user_id', userId)
    if (!upLead) {
      await supabase
        .from('lead_email_events')
        .update({ moved_to_folder_id: moveTo })
        .eq('id', eventId)
        .eq('user_id', userId)

      await supabase.from('lead_folder_movements').insert({
        user_id: userId,
        lead_id: leadRow.id,
        from_folder_id: folderBefore,
        to_folder_id: moveTo,
        source: 'email_template_send',
        custom_email_template_id: cid,
        task_id: task.id,
        lead_email_event_id: eventId,
      })
    }
  }

  return { ok: true, reason: 'lead_email_sent' }
}

async function loadLeadTemplate(
  cid: string,
  userId: string,
): Promise<{ ok: true; template: LeadTemplateRow } | { ok: false; reason: string }> {
  const { data: template, error: tErr } = await supabase
    .from('custom_email_templates')
    .select(
      'id, name, subject_template, blocks, audience, attachment_generated_file_id, move_to_folder_id',
    )
    .eq('id', cid)
    .eq('user_id', userId)
    .maybeSingle()
  if (tErr || !template || template.audience !== 'lead') {
    return { ok: false, reason: 'custom_template_not_found' }
  }
  return {
    ok: true,
    template: template as LeadTemplateRow,
  }
}

/**
 * Send lead custom template email immediately and log to `lead_email_events` (task completion automation).
 * Supports single lead, all leads in a folder, or all leads (bulk).
 */
export async function queueLeadCustomEmailOnTaskComplete(
  task: Task,
  userId: string,
): Promise<{ ok: boolean; reason: string }> {
  const cid = parseCustomTemplateId(task.email_type)
  if (!cid) {
    return { ok: false, reason: 'unsupported_email_type' }
  }

  const tload = await loadLeadTemplate(cid, userId)
  if (!tload.ok) return tload

  const { template } = tload
  const emailType = task.email_type!

  /** Single lead */
  if (task.lead_id && !task.lead_send_all && !task.lead_folder_id) {
    const { data: leadRow, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', task.lead_id)
      .eq('user_id', userId)
      .maybeSingle()
    if (leadErr || !leadRow) {
      return { ok: false, reason: 'no_lead_for_lead_email' }
    }
    return sendLeadTemplateToOneLead({
      userId,
      task,
      leadRow: leadRow as LeadRow,
      template,
      emailType,
    })
  }

  /** Folder or all leads */
  if (task.lead_send_all || task.lead_folder_id) {
    let q = supabase.from('leads').select('*').eq('user_id', userId).not('contact_email', 'is', null)
    if (task.lead_folder_id) {
      q = q.eq('folder_id', task.lead_folder_id)
    }
    const { data: rows, error: lerr } = await q
    if (lerr) {
      return { ok: false, reason: 'no_lead_for_lead_email' }
    }
    const list = (rows ?? []) as LeadRow[]
    let sent = 0
    let failed = 0
    let skipped = 0
    for (const leadRow of list) {
      if (!String(leadRow.contact_email ?? '').trim()) {
        skipped += 1
        continue
      }
      const r = await sendLeadTemplateToOneLead({
        userId,
        task,
        leadRow,
        template,
        emailType,
      })
      if (r.ok) {
        if (r.reason === 'dedupe_recent_pending') skipped += 1
        else sent += 1
      } else {
        failed += 1
      }
    }
    if (failed > 0 && sent === 0) {
      return { ok: false, reason: 'lead_bulk_send_all_failed' }
    }
    if (sent === 0 && skipped === list.length) {
      return { ok: true, reason: 'dedupe_recent_pending' }
    }
    return { ok: true, reason: sent > 1 ? 'lead_bulk_email_sent' : 'lead_email_sent' }
  }

  return { ok: false, reason: 'no_lead_for_lead_email' }
}
