/**
 * Scheduled (hourly): when America/Los_Angeles is Sunday 05:00–05:59, enqueue one
 * gig_calendar_digest_weekly per eligible user (artist email configured). Dedup via notes.weekStart.
 */
import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { pacificTodayYmd } from '../../src/lib/calendar/pacificWallTime'
import { ARTIST_EMAIL_TYPE_LABELS } from '../../src/types'

const DIGEST_HOUR_PT = 5

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

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
  ) as Record<string, string>
  const hour = parseInt(parts.hour, 10)
  const wday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)

  if (wday !== 0 || hour !== DIGEST_HOUR_PT) {
    return { statusCode: 200, body: JSON.stringify({ skipped: true, reason: 'not_sunday_5am_pt' }) }
  }

  /** Caller only runs on Sunday 5am PT; “week start” is that calendar day in Pacific. */
  const weekStart = pacificTodayYmd()

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
    .in('status', ['pending', 'sent'])

  const seen = new Set<string>()
  for (const row of existing ?? []) {
    try {
      const n = JSON.parse((row.notes as string) ?? '{}') as { weekStart?: string }
      if (n.weekStart && row.user_id) seen.add(`${row.user_id}:${n.weekStart}`)
    } catch { /* ignore */ }
  }

  let enqueued = 0
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
      scheduled_send_at: null,
      notes: JSON.stringify({ kind: 'gig_calendar_digest_weekly' as const, weekStart }),
    })
    if (!insErr) {
      enqueued++
      seen.add(key)
    }
  }

  return { statusCode: 200, body: JSON.stringify({ enqueued, weekStart }) }
}

export { handler }
