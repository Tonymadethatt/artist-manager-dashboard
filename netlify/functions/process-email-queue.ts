/**
 * process-email-queue
 *
 * Called by an external cron job every minute.
 * Sends pending `venue_emails`: each row waits for the user's `email_queue_buffer_minutes` (5–30; artist_profile), except artist-targeted custom templates and builtin artist rows (`management_report`, `retainer_reminder`, `retainer_received`, `performance_report_received`, gig-calendar builtins) — buffer 0 so the next cron run can send.
 * `gig_reminder_24h` uses `venue_emails.deal_id` → batch `deals.event_start_at` for eligibility (embedded `deal` join is fallback only), and re-checks `shouldSendGigReminderNow` (day-before morning PT vs exact 24h) immediately before Resend.
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
import { isQueueBufferZeroEmailType, isQueuedBuiltinArtistEmailType } from '../../src/lib/email/queuedBuiltinArtistEmail'
import { parsePerfFormQueueNotes } from '../../src/lib/email/performanceFormQueuePayload'
import { parseInvoiceQueueNotes } from '../../src/lib/email/invoiceQueuePayload'
import { parseArtistTxnQueueNotes } from '../../src/lib/email/artistTxnQueuePayload'
import { fetchReportInputsForUser } from '../../src/lib/reports/fetchReportInputsForUser'
import {
  buildManagementReportData,
  buildRetainerReceivedPayload,
  buildRetainerReminderPayload,
  defaultQueuedManagementReportDateRange,
} from '../../src/lib/reports/buildManagementReportData'
import {
  isGeneratedFileInScopeForDeal,
  resolveDealAgreementUrlForEmailPayload,
} from '../../src/lib/resolveAgreementUrl'
import type { GeneratedFile } from '../../src/types'
import { buildEmailAttachmentPayloadFromFile } from '../../src/lib/files/templateEmailAttachmentPayload'
import { ensureQueueCaptureUrl } from '../../src/lib/emailCapture/ensureQueueCaptureUrl'
import { loadCustomEmailBlocksDoc } from '../../src/lib/email/customEmailBlocks'
import { parseGigCalendarQueueNotes } from '../../src/lib/email/gigCalendarQueueNotes'
import { buildBrandedGigCalendarEmail, buildGigCalendarTableRow } from '../../src/lib/email/gigCalendarEmailHtml'
import { buildGigBookedEmailMiddleHtml } from '../../src/lib/email/gigBookedEmailSections'
import { loadOnsiteContactForGigBooked } from '../../src/lib/email/loadOnsiteContactForGigBooked'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import { eventStartAtFromQueueDealEmbed, shouldSendGigReminderNow } from '../../src/lib/calendar/gigReminderSchedule'
import {
  addCalendarDaysPacific,
  pacificDayEndExclusiveUtcIso,
  pacificWallToUtcIso,
  performanceWindowEmailFromDeal,
  whenLineEmailFromDeal,
} from '../../src/lib/calendar/pacificWallTime'
import { parseResendMessageIdFromSendFunctionResponse } from '../../src/lib/email/resendMessageId'
import type { Deal, Venue } from '../../src/types'

/** Keep in sync with src/lib/emailQueueBuffer.ts */
const EMAIL_QUEUE_BUFFER_OPTIONS = [5, 10, 15, 20, 30] as const
const DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES = 10

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
  | 'follow_up'
  | 'rebooking_inquiry'
  | 'first_outreach'
  | 'pre_event_checkin'
  | 'post_show_thanks'
  | 'agreement_followup'
  | 'invoice_sent'
  | 'show_cancelled_or_postponed'
  | 'pass_for_now'

/** Case-insensitive header lookup (Netlify / proxies vary casing; missing headers must not throw). */
function headerFirst(headers: Record<string, string | undefined>, name: string): string | undefined {
  const t = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === t && v != null && v !== '') return v
  }
  return undefined
}

function normalizeRequestHeaders(event: Parameters<Handler>[0]): Record<string, string | undefined> {
  const raw = event.headers
  if (raw == null || typeof raw !== 'object') return {}
  return raw as Record<string, string | undefined>
}

/**
 * Functions need an absolute origin for fetch() to other `/.netlify/functions/*` endpoints.
 * `URL` is usually set on Netlify; fall back so cron-triggered runs never use an empty base.
 */
function resolveSiteUrl(): string {
  const primary = process.env.URL || process.env.DEPLOY_PRIME_URL || process.env.DEPLOY_URL || ''
  const fallback = 'https://artist-manager-dashboard.netlify.app'
  const base = primary.trim() || fallback
  return base.replace(/\/$/, '')
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  try {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const siteUrl = resolveSiteUrl()

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' }
  }
  if (!resendApiKey) {
    return { statusCode: 500, body: 'RESEND_API_KEY not configured' }
  }

  const hdrs = normalizeRequestHeaders(event)

  // Authenticate: Netlify schedule header, external cron secret, OR Supabase JWT (client polling)
  const secret = process.env.PROCESS_QUEUE_SECRET
  const provided = headerFirst(hdrs, 'x-queue-secret')
  const scheduledHeader = headerFirst(hdrs, 'netlify-scheduled-function')
  const fromNetlifySchedule = String(scheduledHeader) === 'true'

  let authenticated = fromNetlifySchedule || (!!secret && provided === secret)

  if (!authenticated) {
    const authHeader = headerFirst(hdrs, 'authorization') || ''
    if (authHeader.startsWith('Bearer ')) {
      const jwt = authHeader.slice(7)
      const authClient = createClient(supabaseUrl, serviceRoleKey)
      const { data: { user }, error: authErr } = await authClient.auth.getUser(jwt)
      if (user && !authErr) authenticated = true
    }
  }

  if (!authenticated) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  // Admin client — bypasses RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  /** Workers that crash after claim leave rows in `sending`; recover so mail is not stuck forever. */
  const staleClaimIso = new Date(Date.now() - 15 * 60 * 1000).toISOString()
  {
    const { error: e1 } = await supabase
      .from('venue_emails')
      .update({ status: 'pending', processing_started_at: null })
      .eq('status', 'sending')
      .lt('processing_started_at', staleClaimIso)
    if (e1) console.warn('[process-email-queue] stale sending reset (timed):', e1.message)
    const { error: e2 } = await supabase
      .from('venue_emails')
      .update({ status: 'pending', processing_started_at: null })
      .eq('status', 'sending')
      .is('processing_started_at', null)
    if (e2) console.warn('[process-email-queue] stale sending reset (null ts):', e2.message)
  }

  // Pending rows are filtered per-user by `email_queue_buffer_minutes`. Artist custom templates use 0 so cron can send on the next run.
  const { data: rawCandidates, error: fetchError } = await supabase
    .from('venue_emails')
    .select(`
      *,
      venue:venues(id, name, city, location),
      deal:deals(id, description, event_date, event_start_at, event_end_at, gross_amount, agreement_url, agreement_generated_file_id, venue_id, user_id, notes, payment_due_date, ics_invite_sent_at),
      contact:contacts(id, name, email)
    `)
    .eq('status', 'pending')
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

  const candidateCustomIds = [...new Set(
    candidates
      .map(e => parseCustomTemplateId(e.email_type as string))
      .filter((x): x is string => !!x),
  )]
  const customAudienceById = new Map<string, string>()
  if (candidateCustomIds.length > 0) {
    const { data: audRows, error: audErr } = await supabase
      .from('custom_email_templates')
      .select('id, audience')
      .in('id', candidateCustomIds)

    if (audErr) {
      console.error('[process-email-queue] custom template audience:', audErr.message)
      return { statusCode: 500, body: JSON.stringify({ error: audErr.message }) }
    }
    for (const r of audRows ?? []) {
      customAudienceById.set(r.id as string, r.audience as string)
    }
  }

  const gigReminderDealIds = [
    ...new Set(
      candidates
        .filter((row) => row.email_type === 'gig_reminder_24h' && row.deal_id)
        .map((row) => row.deal_id as string),
    ),
  ]
  /** Authoritative show start for reminder eligibility (do not rely on embedded `deal` join alone). */
  const eventStartByDealId = new Map<string, string>()
  if (gigReminderDealIds.length > 0) {
    const { data: dealStartRows, error: dealStartErr } = await supabase
      .from('deals')
      .select('id, event_start_at')
      .in('id', gigReminderDealIds)
    if (dealStartErr) {
      console.error('[process-email-queue] deals reminder times:', dealStartErr.message)
      return { statusCode: 500, body: JSON.stringify({ error: dealStartErr.message }) }
    }
    for (const r of dealStartRows ?? []) {
      const id = r.id as string
      const es = r.event_start_at as string | null | undefined
      if (typeof es === 'string' && es.trim()) eventStartByDealId.set(id, es.trim())
    }
  }

  const nowMs = Date.now()
  const emails: typeof candidates = []
  for (const e of candidates) {
    const p = profileByUser.get(e.user_id)
    const cidBuf = parseCustomTemplateId(e.email_type as string)
    const audienceForBuffer = cidBuf ? customAudienceById.get(cidBuf) : null
    const bufferMin = audienceForBuffer === 'artist' || isQueueBufferZeroEmailType(e.email_type as string)
      ? 0
      : clampEmailQueueBufferMinutes(p?.email_queue_buffer_minutes as unknown)
    const ageMs = nowMs - new Date(e.created_at).getTime()
    const schedRaw = e.scheduled_send_at as string | null | undefined
    const schedMs = schedRaw ? new Date(schedRaw).getTime() : null

    if (e.email_type === 'gig_reminder_24h') {
      const dealId = e.deal_id as string | null | undefined
      const batchStart = dealId ? eventStartByDealId.get(dealId) : undefined
      const embedStart = eventStartAtFromQueueDealEmbed(e.deal)
      const startIso = batchStart || embedStart || null
      const eligible = !!startIso && shouldSendGigReminderNow(nowMs, startIso)
      console.log(
        `[gig_reminder_24h:filter] id=${e.id} deal_id=${dealId ?? 'null'}`
        + ` event_start_at=${startIso ?? 'null'} scheduled_send_at=${schedRaw ?? 'null'}`
        + ` batchHit=${!!batchStart} embedHit=${!!embedStart}`
        + ` eligible=${eligible} now=${new Date(nowMs).toISOString()}`,
      )
      if (!startIso || !eligible) {
        continue
      }
      if (ageMs >= bufferMin * 60 * 1000) {
        emails.push(e)
        if (emails.length >= 50) break
      }
      continue
    }

    // Includes gig_calendar_digest_weekly pre-enqueued with Sunday 05:00 PT `scheduled_send_at`.
    if (schedMs != null && Number.isFinite(schedMs) && schedMs > nowMs) {
      continue
    }
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
    const claimNow = new Date().toISOString()
    const { data: claimedRow, error: claimErr } = await supabase
      .from('venue_emails')
      .update({ status: 'sending', processing_started_at: claimNow })
      .eq('id', email.id as string)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle()
    if (claimErr) {
      console.error('[process-email-queue] claim error:', claimErr.message)
      continue
    }
    if (!claimedRow) {
      continue
    }

    const profile = profileByUser.get(email.user_id) as {
      artist_name?: string
      company_name?: string | null
      from_email?: string
      reply_to_email?: string | null
      artist_email?: string | null
      manager_email?: string | null
      manager_name?: string | null
      manager_title?: string | null
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

    if (email.email_type === 'performance_report_request') {
      const perfPayload = parsePerfFormQueueNotes(email.notes as string | null)
      const fullProf = profileByUser.get(email.user_id) as Record<string, unknown> | undefined
      if (!perfPayload?.token) {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: missing performance form payload' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'perf_form_payload' })
        continue
      }
      if (!fullProf?.artist_email) {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: artist email not configured' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'no_artist_email' })
        continue
      }
      const perfTmpl = templateByUserAndType.get(`${email.user_id}:performance_report_request`)
      try {
        const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-performance-form`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: perfPayload.token,
            venueName: perfPayload.venueName,
            eventDate: perfPayload.eventDate,
            artistName: String(fullProf.artist_name ?? ''),
            artistEmail: String(fullProf.artist_email ?? ''),
            fromEmail: String(fullProf.from_email ?? ''),
            replyToEmail: (fullProf.reply_to_email as string | null) || String(fullProf.from_email ?? ''),
            managerName: (fullProf.manager_name as string | null) || 'Your Manager',
            managerTitle: (fullProf.manager_title as string | null) ?? null,
            website: (fullProf.website as string | null) ?? null,
            social_handle: (fullProf.social_handle as string | null) ?? null,
            phone: (fullProf.phone as string | null) ?? null,
            custom_subject: perfTmpl?.custom_subject ?? null,
            custom_intro: perfTmpl?.custom_intro ?? null,
            layout: perfTmpl?.layout ?? null,
            user_id: email.user_id as string,
          }),
        })
        if (sendRes.ok) {
          const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
          await supabase
            .from('venue_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              notes: '[src:queue_cron] Performance form email',
              ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
            })
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
      continue
    }

    const gigCal = parseGigCalendarQueueNotes(email.notes as string | null)
    if (
      gigCal?.kind === 'gig_booked_ics'
      || gigCal?.kind === 'gig_reminder_24h'
      || gigCal?.kind === 'gig_reminder_manual'
      || gigCal?.kind === 'gig_calendar_digest_weekly'
      || gigCal?.kind === 'gig_day_summary_manual'
    ) {
      const row = profileByUser.get(email.user_id) as Record<string, unknown> | undefined
      if (!row?.artist_email || !row.from_email) {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: artist email not configured' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'no_artist_email' })
        continue
      }

      const sendProfile = {
        artist_name: String(row.artist_name ?? ''),
        from_email: String(row.from_email ?? ''),
        reply_to_email: (row.reply_to_email as string | null) ?? null,
        manager_email: (row.manager_email as string | null) ?? null,
      }

      let tmpl = templateByUserAndType.get(`${email.user_id}:${email.email_type}`)
      if (!tmpl && email.email_type === 'gig_reminder_manual') {
        tmpl = templateByUserAndType.get(`${email.user_id}:gig_reminder_24h`)
      }
      const layoutMerged = artistLayoutForSend(
        tmpl?.layout ?? null,
        tmpl?.custom_subject ?? null,
        tmpl?.custom_intro ?? null,
      )
      const shellProf = {
        artistName: String(row.artist_name ?? ''),
        managerName: (row.manager_name as string | null)?.trim() || 'Management',
        managerTitle: (row.manager_title as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        social_handle: (row.social_handle as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
      }

      try {
        if (gigCal.kind === 'gig_calendar_digest_weekly') {
          const inputs = await fetchReportInputsForUser(supabase, email.user_id)
          const venues = inputs.venues as Venue[]
          const deals = inputs.deals as Deal[]
          const vmap = new Map(venues.map(v => [v.id, v]))
          const startIso = pacificWallToUtcIso(gigCal.weekStart, '00:00')
          const endDay = addCalendarDaysPacific(gigCal.weekStart, 14)
          const endExclusiveIso = pacificDayEndExclusiveUtcIso(endDay)
          if (!startIso || !endExclusiveIso) {
            await supabase
              .from('venue_emails')
              .update({ status: 'failed', notes: 'Auto-send failed: bad digest window' })
              .eq('id', email.id)
            results.push({ id: email.id, result: 'failed', reason: 'digest_window' })
            continue
          }
          const t0 = new Date(startIso).getTime()
          const tExclusiveEnd = new Date(endExclusiveIso).getTime()
          const digestDeals: Deal[] = []
          for (const d of deals) {
            const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
            if (!dealQualifiesForCalendar(d, v ?? null)) continue
            if (!d.event_start_at) continue
            const ts = new Date(d.event_start_at).getTime()
            if (ts < t0 || ts >= tExclusiveEnd) continue
            digestDeals.push(d)
          }
          digestDeals.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
          const rows = digestDeals.map(d => {
            const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
            return buildGigCalendarTableRow(
              d,
              d.description?.trim() || 'Gig',
              v?.name?.trim() || '—',
            )
          })
          const html = buildBrandedGigCalendarEmail({
            kind: 'gig_calendar_digest_weekly',
            L: layoutMerged,
            logoBaseUrl: siteUrl,
            ...shellProf,
            digest: { rows },
          })
          const defaultSubj = `Your gigs — next two weeks (${gigCal.weekStart})`
          const subj = layoutMerged.subject?.trim() || email.subject || defaultSubj
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'gig_calendar_digest_weekly',
              profile: sendProfile,
              to: String(row.artist_email ?? ''),
              subject: subj,
              html,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
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
          continue
        }

        if (gigCal.kind === 'gig_day_summary_manual') {
          const inputs = await fetchReportInputsForUser(supabase, email.user_id)
          const venues = inputs.venues as Venue[]
          const deals = inputs.deals as Deal[]
          const vmap = new Map(venues.map(v => [v.id, v]))
          const ymd0 = gigCal.ymd
          const startIso0 = pacificWallToUtcIso(ymd0, '00:00')
          const dayEndExclusive0 = pacificDayEndExclusiveUtcIso(ymd0)
          if (!startIso0 || !dayEndExclusive0) {
            await supabase
              .from('venue_emails')
              .update({ status: 'failed', notes: 'Auto-send failed: bad day summary date' })
              .eq('id', email.id)
            results.push({ id: email.id, result: 'failed', reason: 'day_summary_date' })
            continue
          }
          const tDay0 = new Date(startIso0).getTime()
          const tDayExclusiveEnd = new Date(dayEndExclusive0).getTime()
          const dayDeals: Deal[] = []
          for (const d of deals) {
            const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
            if (!dealQualifiesForCalendar(d, v ?? null)) continue
            if (!d.event_start_at) continue
            const ts = new Date(d.event_start_at).getTime()
            if (ts < tDay0 || ts >= tDayExclusiveEnd) continue
            dayDeals.push(d)
          }
          dayDeals.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
          const rowsDay = dayDeals.map(d => {
            const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
            return buildGigCalendarTableRow(
              d,
              d.description?.trim() || 'Gig',
              v?.name?.trim() || '—',
            )
          })
          const noonIso = pacificWallToUtcIso(ymd0, '12:00')
          const dayLabel = noonIso
            ? new Intl.DateTimeFormat('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
              timeZone: 'America/Los_Angeles',
            }).format(new Date(noonIso))
            : ymd0
          const html = buildBrandedGigCalendarEmail({
            kind: 'gig_day_summary_manual',
            L: layoutMerged,
            logoBaseUrl: siteUrl,
            ...shellProf,
            daySummary: { rows: rowsDay, dayLabel },
          })
          const defaultSubj = `Your gigs — ${dayLabel}`
          const subj = layoutMerged.subject?.trim() || email.subject || defaultSubj
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'gig_day_summary_manual',
              profile: sendProfile,
              to: String(row.artist_email ?? ''),
              subject: subj,
              html,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
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
          continue
        }

        const dealId = gigCal.dealId
        const { data: dealRow, error: dErr } = await supabase
          .from('deals')
          .select('*')
          .eq('id', dealId)
          .eq('user_id', email.user_id)
          .maybeSingle()
        if (dErr || !dealRow) {
          await supabase
            .from('venue_emails')
            .update({ status: 'failed', notes: 'Auto-send failed: deal not found' })
            .eq('id', email.id)
          results.push({ id: email.id, result: 'failed', reason: 'deal_missing' })
          continue
        }
        const deal = dealRow as Deal
        const { data: venueRow } = await supabase
          .from('venues')
          .select('*')
          .eq('id', deal.venue_id as string)
          .eq('user_id', email.user_id)
          .maybeSingle()
        const venue = venueRow as Venue | null

        if (gigCal.kind === 'gig_booked_ics') {
          if (!deal.event_start_at || !deal.event_end_at) {
            await supabase
              .from('venue_emails')
              .update({ status: 'failed', notes: 'Auto-send failed: deal missing show times' })
              .eq('id', email.id)
            results.push({ id: email.id, result: 'failed', reason: 'deal_times' })
            continue
          }

          const onsiteContact = await loadOnsiteContactForGigBooked(supabase, email.user_id as string, deal)

          const middleSectionsHtml = buildGigBookedEmailMiddleHtml({
            deal,
            venue,
            onsiteContact,
            managerName: shellProf.managerName,
          })
          const html = buildBrandedGigCalendarEmail({
            kind: 'gig_booked_ics',
            L: layoutMerged,
            logoBaseUrl: siteUrl,
            ...shellProf,
            icsBody: { middleSectionsHtml },
          })
          const subj = layoutMerged.subject?.trim() || email.subject || 'Booked gig — show details'
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'gig_booked_ics',
              profile: sendProfile,
              to: String(row.artist_email ?? ''),
              subject: subj,
              html,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
              .eq('id', email.id)
            if (!deal.ics_invite_sent_at) {
              await supabase
                .from('deals')
                .update({ ics_invite_sent_at: new Date().toISOString() })
                .eq('id', deal.id)
            }
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
          continue
        }

        // gig_reminder_24h | gig_reminder_manual
        if (!deal.event_start_at || !deal.event_end_at) {
          await supabase
            .from('venue_emails')
            .update({ status: 'failed', notes: 'Auto-send failed: deal missing show times' })
            .eq('id', email.id)
          results.push({ id: email.id, result: 'failed', reason: 'deal_times' })
          continue
        }
        const isManualReminder = gigCal.kind === 'gig_reminder_manual'
        const sendNowCheck = shouldSendGigReminderNow(Date.now(), deal.event_start_at)
        console.log(
          `[gig_reminder_24h:send] id=${email.id} deal_id=${deal.id}`
          + ` event_start_at=${deal.event_start_at} sendNowCheck=${sendNowCheck}`
          + ` manual=${isManualReminder}`
          + ` now=${new Date().toISOString()}`,
        )
        if (!isManualReminder && !sendNowCheck) {
          // Claim set status to `sending`; release so the next cron run can retry when the window opens.
          await supabase
            .from('venue_emails')
            .update({ status: 'pending', processing_started_at: null })
            .eq('id', email.id)
          continue
        }
        const venueName = venue?.name?.trim() || deal.description?.trim() || 'Show'
        const html = buildBrandedGigCalendarEmail({
          kind: 'gig_reminder_24h',
          L: layoutMerged,
          logoBaseUrl: siteUrl,
          ...shellProf,
          reminder: {
            venueName,
            dealDescription: deal.description?.trim() || 'Gig',
            whenLine: whenLineEmailFromDeal(deal) || '',
            setLine: performanceWindowEmailFromDeal(deal),
          },
        })
        const subj = layoutMerged.subject?.trim() || email.subject || `Reminder: ${venueName}${isManualReminder ? '' : ' tomorrow'}`
        const sendKind = isManualReminder ? 'gig_reminder_manual' : 'gig_reminder_24h'
        const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: sendKind,
            profile: sendProfile,
            to: String(row.artist_email ?? ''),
            subject: subj,
            html,
            ...(isManualReminder ? {} : { showStartIso: deal.event_start_at }),
            user_id: email.user_id as string,
          }),
        })
        if (sendRes.ok) {
          const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
          await supabase
            .from('venue_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
            })
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
      continue
    }

    const cid = parseCustomTemplateId(email.email_type as string)
    const customRow = cid ? customRowById.get(cid) : undefined

    if (cid && !customRow) {
      await supabase
        .from('venue_emails')
        .update({
          status: 'failed',
          notes: 'Auto-send failed: custom template not found',
        })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason: 'custom_template_not_found' })
      continue
    }

    if (cid && customRow && customRow.audience !== 'venue' && customRow.audience !== 'artist') {
      await supabase
        .from('venue_emails')
        .update({
          status: 'failed',
          notes: 'Auto-send failed: unsupported custom template audience',
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
      artist_email: profile.artist_email ?? null,
      manager_email: profile.manager_email ?? null,
      manager_name: profile.manager_name ?? null,
      manager_title: profile.manager_title ?? null,
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

    if (cid && customRow && customRow.audience === 'artist') {
      const artistName = profile.artist_name ?? ''
      const artistBody = {
        custom_artist_template: {
          subject_template: customRow.subject_template,
          blocks: customRow.blocks,
        },
        profile: profilePayload,
        recipient: {
          name: artistName.split(/\s+/)[0] || artistName,
          email: email.recipient_email,
        },
        ...(dealForSend
          ? {
            deal: {
              description: String(dealForSend.description ?? ''),
              gross_amount: Number(dealForSend.gross_amount ?? 0),
              event_date: (dealForSend.event_date as string | null) ?? null,
              payment_due_date: (dealForSend.payment_due_date as string | null) ?? null,
              agreement_url: (dealForSend.agreement_url as string | null) ?? null,
              notes: dealForSend.notes != null ? String(dealForSend.notes) : null,
            },
          }
          : {}),
        venue: email.venue
          ? {
            name: (email.venue as { name: string }).name,
            city: (email.venue as { city?: string | null }).city ?? null,
            location: (email.venue as { location?: string | null }).location ?? null,
          }
          : { name: '', city: null, location: null },
        ...(customAttachmentPayload ? { attachment: customAttachmentPayload } : {}),
        user_id: email.user_id as string,
      }
      try {
        const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-venue-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(artistBody),
        })
        if (sendRes.ok) {
          const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
          await supabase
            .from('venue_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
            })
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
      continue
    }

    const builtinArtistType = email.email_type as string
    if (builtinArtistType === 'performance_report_received') {
      const row = profileByUser.get(email.user_id) as Record<string, unknown> | undefined
      if (!row?.artist_email || !row.from_email) {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: artist email not configured' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'no_artist_email' })
        continue
      }

      const txnPayload = parseArtistTxnQueueNotes(email.notes as string | null)
      if (!txnPayload || txnPayload.kind !== 'performance_report_received') {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: missing artist transactional payload' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'artist_txn_payload' })
        continue
      }

      const sendProfile = {
        artist_name: String(row.artist_name ?? ''),
        artist_email: String(row.artist_email ?? ''),
        manager_name: (row.manager_name as string | null) ?? null,
        manager_title: (row.manager_title as string | null) ?? null,
        manager_email: (row.manager_email as string | null) ?? null,
        from_email: String(row.from_email ?? ''),
        company_name: (row.company_name as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        social_handle: (row.social_handle as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        reply_to_email: (row.reply_to_email as string | null) ?? null,
      }

      const txTmpl = templateByUserAndType.get(`${email.user_id}:${builtinArtistType}`)
      try {
        const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-artist-transactional`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: txnPayload.kind,
            profile: sendProfile,
            venueName: txnPayload.venueName,
            eventDate: txnPayload.eventDate,
            custom_subject: txTmpl?.custom_subject ?? null,
            custom_intro: txTmpl?.custom_intro ?? null,
            layout: txTmpl?.layout ?? null,
            user_id: email.user_id as string,
          }),
        })
        if (sendRes.ok) {
          const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
          await supabase
            .from('venue_emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
            })
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
      continue
    }

    if (
      builtinArtistType === 'management_report'
      || builtinArtistType === 'retainer_reminder'
      || builtinArtistType === 'retainer_received'
    ) {
      const row = profileByUser.get(email.user_id) as Record<string, unknown> | undefined
      if (!row?.artist_email || !row.from_email) {
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: 'Auto-send failed: artist email not configured' })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason: 'no_artist_email' })
        continue
      }

      const sendProfile = {
        artist_name: String(row.artist_name ?? ''),
        artist_email: String(row.artist_email ?? ''),
        manager_name: (row.manager_name as string | null) ?? null,
        manager_title: (row.manager_title as string | null) ?? null,
        manager_email: (row.manager_email as string | null) ?? null,
        from_email: String(row.from_email ?? ''),
        company_name: (row.company_name as string | null) ?? null,
        website: (row.website as string | null) ?? null,
        social_handle: (row.social_handle as string | null) ?? null,
        phone: (row.phone as string | null) ?? null,
        reply_to_email: (row.reply_to_email as string | null) ?? null,
      }

      try {
        const inputs = await fetchReportInputsForUser(supabase, email.user_id)

        if (builtinArtistType === 'management_report') {
          const { start, end } = defaultQueuedManagementReportDateRange()
          const report = buildManagementReportData(inputs, start, end)
          const mrTmpl = templateByUserAndType.get(`${email.user_id}:management_report`)
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-report`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: sendProfile,
              report,
              dateRange: { start, end },
              cc: sendProfile.manager_email ? [sendProfile.manager_email] : [],
              custom_subject: mrTmpl?.custom_subject ?? null,
              custom_intro: mrTmpl?.custom_intro ?? null,
              layout: mrTmpl?.layout ?? null,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
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
        } else if (builtinArtistType === 'retainer_reminder') {
          const { unpaidFees, totalOutstanding } = buildRetainerReminderPayload(inputs.fees)
          if (unpaidFees.length === 0) {
            await supabase
              .from('venue_emails')
              .update({
                status: 'failed',
                notes: 'Auto-send skipped: no outstanding retainer balance',
              })
              .eq('id', email.id)
            results.push({ id: email.id, result: 'failed', reason: 'retainer_nothing_owed' })
            continue
          }
          const rrTmpl = templateByUserAndType.get(`${email.user_id}:retainer_reminder`)
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-reminder`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: sendProfile,
              unpaidFees,
              totalOutstanding,
              custom_subject: rrTmpl?.custom_subject ?? null,
              custom_intro: rrTmpl?.custom_intro ?? null,
              layout: rrTmpl?.layout ?? null,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
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
        } else {
          const { settledFees, totalAcknowledged } = buildRetainerReceivedPayload(inputs.fees)
          const rxTmpl = templateByUserAndType.get(`${email.user_id}:retainer_received`)
          const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-retainer-received`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: sendProfile,
              settledFees,
              totalAcknowledged,
              custom_subject: rxTmpl?.custom_subject ?? null,
              custom_intro: rxTmpl?.custom_intro ?? null,
              layout: rxTmpl?.layout ?? null,
              user_id: email.user_id as string,
            }),
          })
          if (sendRes.ok) {
            const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
            await supabase
              .from('venue_emails')
              .update({
                status: 'sent',
                sent_at: new Date().toISOString(),
                ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
              })
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
        }
      } catch (e) {
        const reason = e instanceof Error ? e.message : 'Unknown error'
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: `Auto-send failed: ${reason}` })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason })
      }
      continue
    }

    const invoiceLinkPayload = email.email_type === 'invoice_sent'
      ? parseInvoiceQueueNotes(email.notes as string | null)
      : null
    const invoiceUrlForSend = invoiceLinkPayload?.url?.trim() || null

    let captureUrlForSend: string | null = null
    const customVenueCaptureKind =
      cid && customRow?.audience === 'venue'
        ? loadCustomEmailBlocksDoc(customRow.blocks).captureKind ?? null
        : null
    if (!cid) {
      captureUrlForSend = await ensureQueueCaptureUrl(
        supabase,
        {
          id: email.id as string,
          user_id: email.user_id as string,
          venue_id: (email.venue_id as string | null) ?? null,
          deal_id: (email.deal_id as string | null) ?? null,
          contact_id: (email.contact_id as string | null) ?? null,
          email_type: email.email_type as string,
          notes: email.notes as string | null,
        },
        siteUrl,
      )
    } else if (customVenueCaptureKind) {
      captureUrlForSend = await ensureQueueCaptureUrl(
        supabase,
        {
          id: email.id as string,
          user_id: email.user_id as string,
          venue_id: (email.venue_id as string | null) ?? null,
          deal_id: (email.deal_id as string | null) ?? null,
          contact_id: (email.contact_id as string | null) ?? null,
          email_type: email.email_type as string,
          notes: email.notes as string | null,
        },
        siteUrl,
        customVenueCaptureKind,
      )
    }

    const requestBody = customRow?.audience === 'venue'
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
        ...(captureUrlForSend ? { capture_url: captureUrlForSend } : {}),
        user_id: email.user_id as string,
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
        ...(invoiceUrlForSend ? { invoice_url: invoiceUrlForSend } : {}),
        ...(captureUrlForSend ? { capture_url: captureUrlForSend } : {}),
        user_id: email.user_id as string,
      }

    try {
      const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-venue-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (sendRes.ok) {
        const resendMessageId = await parseResendMessageIdFromSendFunctionResponse(sendRes)
        await supabase
          .from('venue_emails')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
            ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
          })
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
    body: JSON.stringify({ processed: results.length, sent, failed, results, v: '2026-04-09-reminder-guard' }),
  }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[process-email-queue] unhandled_error', msg, e)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: msg, code: 'unhandled_exception' }),
    }
  }
}

export { handler }
