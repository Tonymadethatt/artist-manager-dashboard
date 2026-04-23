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
import { fetchVenueEmailSentCountsForUser } from '@/lib/email/emailQueueSendUsage'
import type { TaskEmailAutomationResult } from '@/lib/taskEmailAutomationResult'

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

/** Space out Netlify/Resend calls in the browser bulk path to reduce rate spikes and 429s. */
const BULK_LEAD_INTER_SEND_MS = 400

function sleepMs(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

export function isBulkLeadCustomEmailTask(task: Task): boolean {
  if (!task.email_type) return false
  if (!parseCustomTemplateId(task.email_type)) return false
  return !!(task.lead_send_all || task.lead_folder_id)
}

/** @returns null if no headroom, else min(remaining day, month) (how many new sends we allow at most). */
async function maxSendsHeadroomForUser(userId: string): Promise<{ max: number; skippedCheck: boolean }> {
  const u = await fetchVenueEmailSentCountsForUser(userId)
  if (!u) {
    console.warn('[queueLeadCustomEmail] usage fetch failed — cap guard skipped')
    return { max: Number.MAX_SAFE_INTEGER, skippedCheck: true }
  }
  const remainingDay = Math.max(0, u.caps.daily - u.today)
  const remainingMonth = Math.max(0, u.caps.monthly - u.month)
  return { max: Math.min(remainingDay, remainingMonth), skippedCheck: false }
}

async function loadProfileAndAttachment(
  userId: string,
  template: LeadTemplateRow,
): Promise<
  { ok: true; profile: ArtistProfile; attachment: unknown | null }
  | { ok: false; reason: 'no_from_email' }
> {
  const { data: profile } = await supabase
    .from('artist_profile')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  const p = profile as ArtistProfile | null
  if (!p?.from_email?.trim()) {
    return { ok: false, reason: 'no_from_email' }
  }

  const aid = template.attachment_generated_file_id
  if (!aid) {
    return { ok: true, profile: p, attachment: null }
  }
  const { data: gf } = await supabase
    .from('generated_files')
    .select('*')
    .eq('id', aid)
    .eq('user_id', userId)
    .maybeSingle()
  const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
  return { ok: true, profile: p, attachment: att }
}

type PreloadedLeadSend = { profile: ArtistProfile; attachment: unknown | null }

async function sendLeadTemplateToOneLead(args: {
  userId: string
  task: Task
  leadRow: LeadRow
  template: LeadTemplateRow
  emailType: string
  preloaded: PreloadedLeadSend
}): Promise<{ ok: boolean; reason: string }> {
  const { userId, task, leadRow, template, emailType, preloaded } = args
  const cid = template.id
  const p = preloaded.profile
  const recipient = String(leadRow.contact_email ?? '').trim()
  if (!recipient) {
    return { ok: false, reason: 'no_lead_contact_email' }
  }

  if (await hasRecentLeadEmailEventDedupe(userId, leadRow.id, emailType, 45)) {
    return { ok: true, reason: 'lead_dedupe_recent' }
  }

  if (!p.from_email?.trim()) {
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

  const att = preloaded.attachment
  if (att) {
    payload.attachment = att
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
): Promise<TaskEmailAutomationResult> {
  const cid = parseCustomTemplateId(task.email_type)
  if (!cid) {
    return { ok: false, reason: 'unsupported_email_type' }
  }

  const tload = await loadLeadTemplate(cid, userId)
  if (!tload.ok) return tload

  const { template } = tload
  const emailType = task.email_type!

  const pre = await loadProfileAndAttachment(userId, template)
  if (!pre.ok) return { ok: false, reason: pre.reason }
  const preloaded: PreloadedLeadSend = { profile: pre.profile, attachment: pre.attachment }

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

    const { max: head, skippedCheck: skipCap } = await maxSendsHeadroomForUser(userId)
    if (!skipCap && head < 1) {
      return { ok: false, reason: 'lead_resend_cap_exceeded' }
    }

    return sendLeadTemplateToOneLead({
      userId,
      task,
      leadRow: leadRow as LeadRow,
      template,
      emailType,
      preloaded,
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
    if (list.length === 0) {
      return { ok: false, reason: 'no_lead_for_lead_email' }
    }
    const { max: head, skippedCheck: skipCap } = await maxSendsHeadroomForUser(userId)
    const withEmail = list.filter(lead => String(lead.contact_email ?? '').trim()).length
    if (!skipCap && withEmail > head) {
      return { ok: false, reason: 'lead_bulk_resend_cap_exceeded' }
    }

    const indicesWithEmail: number[] = []
    for (let i = 0; i < list.length; i += 1) {
      if (String(list[i].contact_email ?? '').trim()) indicesWithEmail.push(i)
    }
    const skippedNoEmail = list.length - indicesWithEmail.length

    let sent = 0
    let failed = 0
    let skipped = skippedNoEmail
    for (let k = 0; k < indicesWithEmail.length; k += 1) {
      const leadRow = list[indicesWithEmail[k]]
      const r = await sendLeadTemplateToOneLead({
        userId,
        task,
        leadRow,
        template,
        emailType,
        preloaded,
      })
      if (r.ok) {
        if (r.reason === 'lead_dedupe_recent') skipped += 1
        else sent += 1
      } else {
        failed += 1
      }
      if (k < indicesWithEmail.length - 1) {
        await sleepMs(BULK_LEAD_INTER_SEND_MS)
      }
    }
    if (failed > 0 && sent === 0) {
      return { ok: false, reason: 'lead_bulk_send_all_failed' }
    }
    const stats: { sent: number; failed: number; skipped: number } = { sent, failed, skipped }
    if (sent === 0 && skipped === list.length) {
      return { ok: true, reason: 'lead_dedupe_recent', leadBulkStats: stats }
    }
    if (failed > 0 && sent > 0) {
      return { ok: true, reason: 'lead_bulk_email_partial', leadBulkStats: stats }
    }
    return {
      ok: true,
      reason: sent > 1 ? 'lead_bulk_email_sent' : 'lead_email_sent',
      leadBulkStats: stats,
    }
  }

  return { ok: false, reason: 'no_lead_for_lead_email' }
}
