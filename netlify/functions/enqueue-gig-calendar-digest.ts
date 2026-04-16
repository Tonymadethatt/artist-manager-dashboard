/**
 * Scheduled (hourly at :05 UTC): pre-enqueue `gig_calendar_digest_weekly` for the next Sunday 05:00 PT
 * so rows appear under Email Queue → Scheduled with a real `scheduled_send_at`.
 *
 * Also on America/Los_Angeles Sunday hour 5, gap-fill any user missing this week's row (send time may
 * already be in the past so process-email-queue sends on the next tick).
 */
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { pacificDateKeyFromUtcIso, pacificWallToUtcIso } from '../../src/lib/calendar/pacificWallTime'
import {
  isPacificSundayDigestHour,
  nextWeeklyDigestSendAfterNow,
} from '../../src/lib/calendar/weeklyDigestSchedule'
import { ARTIST_EMAIL_TYPE_LABELS } from '../../src/types'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }
  const secret = process.env.PROCESS_QUEUE_SECRET
  const provided = event.headers['x-queue-secret']
  const scheduledHeader = Object.entries(event.headers).find(
    ([k]) => k.toLowerCase() === 'netlify-scheduled-function',
  )?.[1]
  const fromNetlifySchedule = String(scheduledHeader) === 'true'
  if (!fromNetlifySchedule && (provided !== secret || !secret)) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: 'Missing Supabase env' }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const now = new Date()

  const jobs: Array<{ weekStart: string; scheduledSendAtIso: string }> = []

  const upcoming = nextWeeklyDigestSendAfterNow(now.getTime())
  if (upcoming) {
    jobs.push(upcoming)
  }

  if (isPacificSundayDigestHour(now)) {
    const todayYmd = pacificDateKeyFromUtcIso(now.toISOString())
    const iso = todayYmd ? pacificWallToUtcIso(todayYmd, '05:00') : null
    if (todayYmd && iso && !jobs.some(j => j.weekStart === todayYmd)) {
      jobs.push({ weekStart: todayYmd, scheduledSendAtIso: iso })
    }
  }

  if (jobs.length === 0) {
    return { statusCode: 200, body: JSON.stringify({ enqueued: 0, jobs: [], reason: 'no_digest_jobs' }) }
  }

  const { data: profiles, error: pErr } = await supabase
    .from('artist_profile')
    .select('user_id, artist_email, artist_name')
    .not('artist_email', 'is', null)
  if (pErr) {
    return { statusCode: 500, body: JSON.stringify({ error: pErr.message }) }
  }

  const { data: existing } = await supabase
    .from('venue_emails')
    .select('id, user_id, notes')
    .eq('email_type', 'gig_calendar_digest_weekly')
    .in('status', ['pending', 'sending', 'sent'])

  const seen = new Set<string>()
  for (const row of existing ?? []) {
    try {
      const n = JSON.parse((row.notes as string) ?? '{}') as { weekStart?: string }
      if (n.weekStart && row.user_id) seen.add(`${row.user_id}:${n.weekStart}`)
    } catch { /* ignore */ }
  }

  let enqueued = 0
  for (const job of jobs) {
    const { weekStart, scheduledSendAtIso } = job
    for (const p of profiles ?? []) {
      const uid = p.user_id as string
      const email = (p.artist_email as string)?.trim()
      if (!email) continue
      const key = `${uid}:${weekStart}`
      if (seen.has(key)) continue

      const { error: insErr } = await supabase.from('venue_emails').insert({
        user_id: uid,
        venue_id: null,
        deal_id: null,
        contact_id: null,
        email_type: 'gig_calendar_digest_weekly',
        recipient_email: email,
        subject: ARTIST_EMAIL_TYPE_LABELS.gig_calendar_digest_weekly,
        status: 'pending',
        scheduled_send_at: scheduledSendAtIso,
        notes: JSON.stringify({ kind: 'gig_calendar_digest_weekly' as const, weekStart }),
      })
      if (!insErr) {
        enqueued++
        seen.add(key)
      }
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      enqueued,
      jobs: jobs.map(j => ({ weekStart: j.weekStart, scheduledSendAt: j.scheduledSendAtIso })),
    }),
  }
}

export { handler }
