/**
 * Artist-facing gig calendar emails: booked-gig notice (no attachment), 24h reminder, weekly digest.
 * Invoked from process-email-queue (server-to-server).
 */
import type { Handler } from '@netlify/functions'
import { shouldSendGigReminderNow } from '../../src/lib/calendar/gigReminderSchedule'

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
  }
  | {
    kind: 'gig_reminder_24h'
    profile: Profile
    to: string
    subject: string
    html: string
    /** UTC ISO of deal.event_start_at — send function verifies timing before Resend. */
    showStartIso?: string
  }
  | {
    kind: 'gig_calendar_digest_weekly'
    profile: Profile
    to: string
    subject: string
    html: string
  }
  | {
    kind: 'gig_day_summary_manual'
    profile: Profile
    to: string
    subject: string
    html: string
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

  // Defense-in-depth: reject premature 24h reminders regardless of caller.
  if (payload.kind === 'gig_reminder_24h') {
    const iso = 'showStartIso' in payload ? payload.showStartIso : undefined
    if (iso) {
      if (!shouldSendGigReminderNow(Date.now(), iso)) {
        console.warn(
          `[send-artist-gig-calendar-email] BLOCKED premature gig_reminder_24h — showStartIso=${iso}, now=${new Date().toISOString()}`,
        )
        return {
          statusCode: 409,
          body: JSON.stringify({
            message: `24h reminder not due yet (event_start_at=${iso})`,
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
        to: [payload.to],
        ...(cc.length ? { cc } : {}),
        reply_to: [replyTo],
        subject: payload.subject,
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
    return { statusCode: 200, body: JSON.stringify({ ok: true }) }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return { statusCode: 500, body: JSON.stringify({ message: msg }) }
  }
}

export { handler }
