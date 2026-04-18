/**
 * Artist-facing gig calendar emails: booked-gig notice (no attachment), day-before reminder, weekly digest.
 * Invoked from process-email-queue (server-to-server).
 */
import type { Handler } from '@netlify/functions'
import { shouldSendGigReminderNow } from '../../src/lib/calendar/gigReminderSchedule'
import { dedupeCcAgainstTo, resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { parseResendMessageIdFromResendApiJson } from '../../src/lib/email/resendMessageId'
import { fetchEmailTestModeRowForSend } from './supabaseAdmin'

type Profile = {
  artist_name?: string
  from_email: string
  reply_to_email?: string | null
  manager_email?: string | null
}

export type GigCalendarEmailPayload =
  | {
    kind: 'gig_booked_ics'
    profile: Profile
    to: string
    subject: string
    html: string
    user_id?: string
  }
  | {
    kind: 'gig_reminder_24h'
    profile: Profile
    to: string
    subject: string
    html: string
    /** UTC ISO of deal.event_start_at — send function verifies timing before Resend. */
    showStartIso?: string
    user_id?: string
  }
  | {
    kind: 'gig_reminder_manual'
    profile: Profile
    to: string
    subject: string
    html: string
    user_id?: string
  }
  | {
    kind: 'gig_calendar_digest_weekly'
    profile: Profile
    to: string
    subject: string
    html: string
    user_id?: string
  }
  | {
    kind: 'gig_day_summary_manual'
    profile: Profile
    to: string
    subject: string
    html: string
    user_id?: string
  }

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let payload: GigCalendarEmailPayload
  try {
    payload = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) }
  }

  // Defense-in-depth: reject premature day-before reminders regardless of caller (`gig_reminder_manual` skips this).
  if (payload.kind === 'gig_reminder_24h') {
    const iso = 'showStartIso' in payload ? payload.showStartIso : undefined
    if (iso) {
      if (!shouldSendGigReminderNow(Date.now(), iso)) {
        console.warn(
          `[send-artist-gig-calendar-email] BLOCKED premature gig_reminder_24h (day-before window) — showStartIso=${iso}, now=${new Date().toISOString()}`,
        )
        return {
          statusCode: 409,
          body: JSON.stringify({
            message: `Gig reminder not due yet (day-before send window; event_start_at=${iso})`,
          }),
        }
      }
    } else {
      console.warn(
        '[send-artist-gig-calendar-email] gig_reminder_24h called without showStartIso — timing not verified at send boundary',
      )
    }
  }

  const replyTo = payload.profile.reply_to_email?.trim() || payload.profile.from_email
  const cc: string[] = []
  const mgr = payload.profile.manager_email?.trim()
  if (mgr && mgr.toLowerCase() !== payload.to.toLowerCase()) cc.push(mgr)

  const userId = typeof payload.user_id === 'string' ? payload.user_id.trim() || undefined : undefined
  const testModeFetch = await fetchEmailTestModeRowForSend(userId, false)
  if (!testModeFetch.ok) {
    return { statusCode: testModeFetch.statusCode, body: JSON.stringify({ message: testModeFetch.message }) }
  }
  const testModeRow = testModeFetch.row
  let resendTo = [payload.to]
  let resendCc = [...cc]
  const resolved = resolveArtistFacingResend({
    row: testModeRow,
    testOnly: false,
    to: resendTo,
    cc: resendCc,
    subject: payload.subject,
  })
  if (!resolved.ok) {
    return { statusCode: 400, body: JSON.stringify({ message: resolved.message }) }
  }
  resendTo = resolved.to
  resendCc = dedupeCcAgainstTo(resolved.to, resolved.cc)
  const subjectOut = resolved.subject

  if (process.env.EMAIL_TEST_MODE_DEBUG === '1') {
    const mask = (e: string) => {
      const t = e.trim()
      const at = t.indexOf('@')
      if (at <= 0) return '[empty]'
      return `${t.slice(0, 1)}***${t.slice(at)}`
    }
    console.log(
      `[send-artist-gig-calendar-email] kind=${payload.kind} test_mode=${String(!!testModeRow?.email_test_mode)} to=${resendTo.map(mask).join(',')}`,
    )
  }

  const attachments: { filename: string; content: string }[] = []

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: payload.profile.from_email,
        to: resendTo,
        ...(resendCc.length ? { cc: resendCc } : {}),
        reply_to: [replyTo],
        subject: subjectOut,
        html: payload.html,
        ...(attachments.length ? { attachments } : {}),
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}))
      return {
        statusCode: 502,
        body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend error' }),
      }
    }
    const resendPayload = await resendRes.json().catch(() => null)
    const resendMessageId = parseResendMessageIdFromResendApiJson(resendPayload)
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
      }),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { statusCode: 500, body: JSON.stringify({ message: msg }) }
  }
}

export { handler }
