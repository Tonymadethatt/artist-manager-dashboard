/**
 * process-email-queue
 *
 * Called by an external cron job every minute.
 * Finds pending emails older than each user's email_queue_buffer_minutes (5–30; see artist_profile) and sends them automatically.
 *
 * Required environment variables (set in Netlify dashboard → Site configuration → Environment variables):
 *   SUPABASE_URL             – same value as VITE_SUPABASE_URL (without the VITE_ prefix)
 *   SUPABASE_SERVICE_ROLE_KEY – from Supabase dashboard → Settings → API → service_role key
 *   RESEND_API_KEY           – already set for send-venue-email
 *   PROCESS_QUEUE_SECRET     – any random string; add as header X-Queue-Secret in your cron job
 *
 * Cron job setup (cronjob.org or similar):
 *   URL:     https://<your-netlify-site>/.netlify/functions/process-email-queue
 *   Method:  POST
 *   Header:  X-Queue-Secret: <your PROCESS_QUEUE_SECRET value>
 *   Schedule: every 1 minute (set one-minute interval in your cron provider; standard cron is five fields)
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { parseCustomTemplateId } from '../../src/lib/email/customTemplateId'
import {
  isGeneratedFileInScopeForDeal,
  resolveDealAgreementUrlForEmailPayload,
} from '../../src/lib/resolveAgreementUrl'
import type { GeneratedFile } from '../../src/types'
import { buildEmailAttachmentPayloadFromFile } from '../../src/lib/files/templateEmailAttachmentPayload'

/** Keep in sync with src/lib/emailQueueBuffer.ts */
const EMAIL_QUEUE_BUFFER_OPTIONS = [5, 10, 15, 20, 30] as const
const DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES = 10
const MIN_EMAIL_QUEUE_BUFFER_MINUTES = EMAIL_QUEUE_BUFFER_OPTIONS[0]

function clampEmailQueueBufferMinutes(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value)
    ? value
    : parseInt(String(value), 10)
  if ((EMAIL_QUEUE_BUFFER_OPTIONS as readonly number[]).includes(n)) return n
  return DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES
}

type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'booking_confirmed'
  | 'follow_up'
  | 'rebooking_inquiry'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // Authenticate the cron caller
  const secret = process.env.PROCESS_QUEUE_SECRET
  const provided = event.headers['x-queue-secret']
  if (!secret || provided !== secret) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const siteUrl = process.env.URL || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' }
  }
  if (!resendApiKey) {
    return { statusCode: 500, body: 'RESEND_API_KEY not configured' }
  }

  // Admin client — bypasses RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Fetch candidates at least as old as the shortest allowed buffer; filter per-user below.
  const cutoff = new Date(Date.now() - MIN_EMAIL_QUEUE_BUFFER_MINUTES * 60 * 1000).toISOString()

  const { data: rawCandidates, error: fetchError } = await supabase
    .from('venue_emails')
    .select(`
      *,
      venue:venues(id, name, city, location),
      deal:deals(id, description, event_date, gross_amount, agreement_url, agreement_generated_file_id, venue_id, user_id, notes, payment_due_date),
      contact:contacts(id, name, email)
    `)
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(150)

  if (fetchError) {
    console.error('[process-email-queue] fetch error:', fetchError.message)
    return { statusCode: 500, body: JSON.stringify({ error: fetchError.message }) }
  }

  const candidates = rawCandidates ?? []
  const userIds = [...new Set(candidates.map(e => e.user_id))]

  const profileByUser = new Map<string, Record<string, unknown>>()

  if (userIds.length > 0) {
    const { data: profilesRows, error: profilesError } = await supabase
      .from('artist_profile')
      .select('*')
      .in('user_id', userIds)

    if (profilesError) {
      console.error('[process-email-queue] artist_profile error:', profilesError.message)
      return { statusCode: 500, body: JSON.stringify({ error: profilesError.message }) }
    }

    for (const p of profilesRows ?? []) {
      profileByUser.set(p.user_id, p as Record<string, unknown>)
    }
  }

  const nowMs = Date.now()
  const emails: typeof candidates = []
  for (const e of candidates) {
    const p = profileByUser.get(e.user_id)
    const bufferMin = clampEmailQueueBufferMinutes(p?.email_queue_buffer_minutes as unknown)
    const ageMs = nowMs - new Date(e.created_at).getTime()
    if (ageMs >= bufferMin * 60 * 1000) {
      emails.push(e)
      if (emails.length >= 50) break
    }
  }

  const templateByUserAndType = new Map<string, {
    custom_subject: string | null
    custom_intro: string | null
    layout: unknown | null
  }>()
  const templateUserIds = [...new Set(emails.map(e => e.user_id))]
  if (templateUserIds.length > 0) {
    const { data: tmplRows, error: tmplErr } = await supabase
      .from('email_templates')
      .select('user_id, email_type, custom_subject, custom_intro, layout')
      .in('user_id', templateUserIds)

    if (tmplErr) {
      console.error('[process-email-queue] email_templates error:', tmplErr.message)
      return { statusCode: 500, body: JSON.stringify({ error: tmplErr.message }) }
    }

    for (const row of tmplRows ?? []) {
      const uid = row.user_id as string
      const et = row.email_type as string
      templateByUserAndType.set(`${uid}:${et}`, {
        custom_subject: row.custom_subject as string | null,
        custom_intro: row.custom_intro as string | null,
        layout: row.layout ?? null,
      })
    }
  }

  const customIds = [...new Set(
    emails
      .map(e => parseCustomTemplateId(e.email_type as string))
      .filter((x): x is string => !!x),
  )]

  const customRowById = new Map<string, {
    subject_template: string
    blocks: unknown
    audience: string
    attachment_generated_file_id: string | null
  }>()
  if (customIds.length > 0) {
    const { data: cRows, error: cErr } = await supabase
      .from('custom_email_templates')
      .select('id, subject_template, blocks, audience, attachment_generated_file_id')
      .in('id', customIds)

    if (cErr) {
      console.error('[process-email-queue] custom_email_templates:', cErr.message)
      return { statusCode: 500, body: JSON.stringify({ error: cErr.message }) }
    }

    for (const r of cRows ?? []) {
      customRowById.set(r.id as string, {
        subject_template: r.subject_template as string,
        blocks: r.blocks,
        audience: r.audience as string,
        attachment_generated_file_id: (r.attachment_generated_file_id as string | null) ?? null,
      })
    }
  }

  const results: Array<{ id: string; result: 'sent' | 'failed'; reason?: string }> = []

  // Sending does not delete or archive `generated_files`; pending rows only read deal + file joins for URLs.
  for (const email of emails) {
    const profile = profileByUser.get(email.user_id) as {
      artist_name?: string
      company_name?: string | null
      from_email?: string
      reply_to_email?: string | null
      website?: string | null
      phone?: string | null
      social_handle?: string | null
      tagline?: string | null
    } | undefined

    if (!profile?.from_email) {
      await supabase
        .from('venue_emails')
        .update({ status: 'failed', notes: 'Auto-send failed: artist profile not configured' })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason: 'no_artist_profile' })
      continue
    }

    const cid = parseCustomTemplateId(email.email_type as string)
    const customRow = cid ? customRowById.get(cid) : undefined

    if (cid && (!customRow || customRow.audience !== 'venue')) {
      await supabase
        .from('venue_emails')
        .update({
          status: 'failed',
          notes: 'Auto-send failed: custom venue template missing or invalid audience',
        })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason: 'custom_template_invalid' })
      continue
    }

    const tmpl = templateByUserAndType.get(`${email.user_id}:${email.email_type}`)

    const profilePayload = {
      artist_name: profile.artist_name,
      company_name: profile.company_name,
      from_email: profile.from_email,
      reply_to_email: profile.reply_to_email,
      website: profile.website,
      phone: profile.phone,
      social_handle: profile.social_handle,
      tagline: profile.tagline,
    }

    const recipientPayload = {
      name: (email.contact as { name?: string } | null)?.name || email.recipient_email,
      email: email.recipient_email,
    }

    const siteOrigin = (siteUrl || '').replace(/\/$/, '')

    let dealForSend: Record<string, unknown> | null = email.deal
      ? { ...(email.deal as Record<string, unknown>) }
      : null
    if (dealForSend && email.deal) {
      const d = email.deal as {
        agreement_generated_file_id?: string | null
        agreement_url?: string | null
        venue_id?: string | null
        user_id?: string
      }
      const resolvedUrl = await resolveDealAgreementUrlForEmailPayload(
        async fid => {
          const { data: gf } = await supabase
            .from('generated_files')
            .select('*')
            .eq('id', fid)
            .maybeSingle()
          const file = gf as GeneratedFile | null
          if (!file || file.user_id !== email.user_id) return null
          if (!isGeneratedFileInScopeForDeal(file, email.user_id, d.venue_id)) return null
          return file
        },
        d,
        siteOrigin
      )
      if (resolvedUrl) dealForSend = { ...dealForSend, agreement_url: resolvedUrl }
    }

    const dealPayload = dealForSend ? { deal: dealForSend } : {}
    const venuePayload = email.venue
      ? {
        venue: {
          name: (email.venue as { name: string }).name,
          city: (email.venue as { city?: string | null }).city ?? null,
          location: (email.venue as { location?: string | null }).location ?? null,
        },
      }
      : {}

    let customAttachmentPayload: { url: string; fileName: string } | undefined
    if (customRow?.attachment_generated_file_id) {
      const { data: gfRow } = await supabase
        .from('generated_files')
        .select('*')
        .eq('id', customRow.attachment_generated_file_id)
        .maybeSingle()
      const gf = gfRow as GeneratedFile | null
      if (gf && gf.user_id === email.user_id) {
        const p = buildEmailAttachmentPayloadFromFile(gf, siteOrigin)
        if (p) customAttachmentPayload = p
      }
    }

    const requestBody = customRow
      ? {
        profile: profilePayload,
        recipient: recipientPayload,
        ...dealPayload,
        ...venuePayload,
        custom_venue_template: {
          subject_template: customRow.subject_template,
          blocks: customRow.blocks,
        },
        ...(customAttachmentPayload ? { attachment: customAttachmentPayload } : {}),
      }
      : {
        type: email.email_type as VenueEmailType,
        profile: profilePayload,
        recipient: recipientPayload,
        ...dealPayload,
        ...venuePayload,
        ...(tmpl
          ? {
            custom_subject: tmpl.custom_subject,
            custom_intro: tmpl.custom_intro,
            layout: tmpl.layout,
          }
          : {}),
      }

    try {
      const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-venue-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (sendRes.ok) {
        await supabase
          .from('venue_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'sent' })
      } else {
        const err = await sendRes.json().catch(() => ({ message: 'Send failed' }))
        const reason = (err as { message?: string }).message ?? 'Send failed'
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: `Auto-send failed: ${reason}` })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason })
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown error'
      await supabase
        .from('venue_emails')
        .update({ status: 'failed', notes: `Auto-send failed: ${reason}` })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason })
    }
  }

  const sent = results.filter(r => r.result === 'sent').length
  const failed = results.filter(r => r.result === 'failed').length
  console.log(`[process-email-queue] processed ${results.length}: ${sent} sent, ${failed} failed`)

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: results.length, sent, failed, results }),
  }
}

export { handler }
