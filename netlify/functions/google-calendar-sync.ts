import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  fetchGoogleEmail,
  getGoogleOAuthEnv,
  refreshAccessToken,
} from './googleCalendarOAuthShared'
import { matchVenueForCalendarEvent } from '../../src/lib/calendar/googleCalendarVenueMatch'

type GCalDateTime = { dateTime?: string; date?: string; timeZone?: string }
type GCalEvent = {
  id?: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start?: GCalDateTime
  end?: GCalDateTime
}

function parseEventBounds(ev: GCalEvent): { start: string | null; end: string | null } {
  const s = ev.start
  const e = ev.end
  if (!s || !e) return { start: null, end: null }
  if (s.dateTime) {
    return {
      start: new Date(s.dateTime).toISOString(),
      end: e.dateTime ? new Date(e.dateTime).toISOString() : null,
    }
  }
  if (s.date) {
    return {
      start: `${s.date}T12:00:00.000Z`,
      end: e.date ? `${e.date}T12:00:00.000Z` : null,
    }
  }
  return { start: null, end: null }
}

function ymdFromIso(iso: string | null): string | null {
  if (!iso) return null
  return iso.slice(0, 10)
}

function appendDescriptionFooter(desc: string | undefined, summary: string): string {
  const base = (desc ?? '').trim()
  const line = '\n\n— Synced via Artist Manager from your shared Google calendar.'
  if (!base) return `${summary}${line}`
  return `${base}${line}`
}

async function listAllEvents(args: {
  accessToken: string
  calendarId: string
  timeMin: string
  timeMax: string
}): Promise<GCalEvent[]> {
  const out: GCalEvent[] = []
  let pageToken: string | undefined
  const cal = encodeURIComponent(args.calendarId)
  do {
    const u = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
    )
    u.searchParams.set('timeMin', args.timeMin)
    u.searchParams.set('timeMax', args.timeMax)
    u.searchParams.set('singleEvents', 'true')
    u.searchParams.set('orderBy', 'startTime')
    u.searchParams.set('maxResults', '250')
    if (pageToken) u.searchParams.set('pageToken', pageToken)
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${args.accessToken}` },
    })
    if (!res.ok) {
      const t = await res.text()
      throw new Error(`events.list ${res.status}: ${t}`)
    }
    const data = (await res.json()) as { items?: GCalEvent[]; nextPageToken?: string }
    if (data.items?.length) out.push(...data.items)
    pageToken = data.nextPageToken
  } while (pageToken)
  return out
}

async function insertDestinationEvent(args: {
  accessToken: string
  calendarId: string
  source: GCalEvent
}): Promise<{ id: string }> {
  const cal = encodeURIComponent(args.calendarId)
  const body = {
    summary: args.source.summary ?? '(No title)',
    description: appendDescriptionFooter(
      args.source.description,
      args.source.summary ?? '(No title)',
    ),
    location: args.source.location ?? undefined,
    start: args.source.start,
    end: args.source.end,
  }
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`events.insert ${res.status}: ${t}`)
  }
  return res.json() as Promise<{ id: string }>
}

/**
 * POST with Authorization: Bearer <Supabase JWT>.
 * Copies events from source_calendar_id to destination_calendar_id within configured window.
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const { clientId, clientSecret } = getGoogleOAuthEnv()
  if (!clientId || !clientSecret) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Google OAuth is not configured.' }),
    }
  }

  const auth =
    event.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    event.headers.Authorization?.replace(/^Bearer\s+/i, '')
  if (!auth) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Authorization' }),
    }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server misconfigured' }),
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userErr } = await supabase.auth.getUser(auth)
  if (userErr || !userData.user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid session' }),
    }
  }

  const userId = userData.user.id

  const { data: cred, error: credErr } = await supabase
    .from('google_calendar_credentials')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (credErr || !cred?.refresh_token) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Google Calendar is not connected.' }),
    }
  }

  const { data: conn, error: connErr } = await supabase
    .from('google_calendar_connection')
    .select(
      'source_calendar_id, destination_calendar_id, sync_past_days, sync_future_days',
    )
    .eq('user_id', userId)
    .maybeSingle()

  if (connErr || !conn) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Calendar connection not found.' }),
    }
  }

  const sourceCal = (conn.source_calendar_id ?? '').trim()
  if (!sourceCal) {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Set your shared source calendar ID in Settings before syncing.',
      }),
    }
  }

  const destCal = (conn.destination_calendar_id ?? 'primary').trim() || 'primary'
  const pastDays = Math.max(0, Math.min(365, Number(conn.sync_past_days ?? 7)))
  const futureDays = Math.max(0, Math.min(730, Number(conn.sync_future_days ?? 180)))

  let accessToken = cred.access_token as string | null
  const exp = cred.access_token_expires_at
    ? new Date(cred.access_token_expires_at).getTime()
    : 0
  if (!accessToken || exp < Date.now() + 60_000) {
    try {
      const t = await refreshAccessToken({
        refreshToken: cred.refresh_token,
        clientId,
        clientSecret,
      })
      accessToken = t.access_token
      const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString()
      await supabase
        .from('google_calendar_credentials')
        .update({
          access_token: accessToken,
          access_token_expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
    } catch (e) {
      console.error('[google-calendar-sync] refresh', e)
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Could not refresh Google access token.' }),
      }
    }
  }

  const now = new Date()
  const timeMin = new Date(now)
  timeMin.setUTCDate(timeMin.getUTCDate() - pastDays)
  const timeMax = new Date(now)
  timeMax.setUTCDate(timeMax.getUTCDate() + futureDays)
  const timeMinStr = timeMin.toISOString()
  const timeMaxStr = timeMax.toISOString()

  let sourceEvents: GCalEvent[]
  try {
    sourceEvents = await listAllEvents({
      accessToken: accessToken!,
      calendarId: sourceCal,
      timeMin: timeMinStr,
      timeMax: timeMaxStr,
    })
  } catch (e) {
    console.error('[google-calendar-sync] list', e)
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: e instanceof Error ? e.message : 'Failed to list source calendar events.',
      }),
    }
  }

  const { data: existingRows } = await supabase
    .from('calendar_sync_event')
    .select('source_event_id')
    .eq('user_id', userId)
    .eq('source_calendar_id', sourceCal)

  const mapped = new Set((existingRows ?? []).map(r => r.source_event_id as string))

  const { data: venueRows } = await supabase
    .from('venues')
    .select('id, name, location, city')
    .eq('user_id', userId)

  const venues = venueRows ?? []

  let copied = 0
  let skipped = 0
  let tasksCreated = 0
  const errors: string[] = []

  for (const ev of sourceEvents) {
    const eid = ev.id
    if (!eid) continue
    if (ev.status === 'cancelled') {
      skipped++
      continue
    }
    if (mapped.has(eid)) {
      skipped++
      continue
    }

    const { start, end } = parseEventBounds(ev)
    const summary = ev.summary ?? '(No title)'
    const location = ev.location ?? null

    let destId: string
    try {
      const created = await insertDestinationEvent({
        accessToken: accessToken!,
        calendarId: destCal,
        source: ev,
      })
      destId = created.id
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      errors.push(`${eid}: ${msg}`)
      continue
    }

    const match = matchVenueForCalendarEvent(summary, location, venues)

    const { data: syncRow, error: syncInsErr } = await supabase
      .from('calendar_sync_event')
      .insert({
        user_id: userId,
        source_calendar_id: sourceCal,
        source_event_id: eid,
        destination_calendar_id: destCal,
        destination_event_id: destId,
        event_start_at: start,
        event_end_at: end,
        summary,
        location,
        matched_venue_id: match?.venueId ?? null,
        follow_up_task_id: null,
      })
      .select('id')
      .single()

    if (syncInsErr || !syncRow) {
      errors.push(`${eid}: db insert failed ${syncInsErr?.message ?? ''}`)
      continue
    }

    mapped.add(eid)
    copied++

    let taskId: string | null = null
    if (!match) {
      const due = ymdFromIso(start)
      const notes = [
        'Synced from Google Calendar (shared calendar).',
        `Event: ${summary}`,
        `When: ${start ?? '—'} → ${end ?? '—'}`,
        `Location: ${location ?? '—'}`,
        `Source event ID: ${eid}`,
        '',
        'Add this venue to the CRM if you plan to reach out.',
      ].join('\n')

      const { data: taskRow, error: taskErr } = await supabase
        .from('tasks')
        .insert({
          user_id: userId,
          title:
            summary.length > 70
              ? `Set up venue from calendar: ${summary.slice(0, 67)}…`
              : `Set up venue from calendar: ${summary}`,
          notes,
          due_date: due,
          completed: false,
          priority: 'medium',
          recurrence: 'none',
        })
        .select('id')
        .single()

      if (!taskErr && taskRow?.id) {
        taskId = taskRow.id as string
        tasksCreated++
        await supabase
          .from('calendar_sync_event')
          .update({ follow_up_task_id: taskId, updated_at: new Date().toISOString() })
          .eq('id', syncRow.id)
      } else if (taskErr) {
        errors.push(`${eid}: task ${taskErr.message}`)
      }
    }
  }

  const summaryPayload = {
    copied,
    skipped,
    tasksCreated,
    errors: errors.slice(0, 12),
    errorCount: errors.length,
    listed: sourceEvents.length,
    timeMin: timeMinStr,
    timeMax: timeMaxStr,
  }

  await supabase
    .from('google_calendar_connection')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_summary: summaryPayload,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  // Refresh google_email if we can (optional)
  try {
    const email = await fetchGoogleEmail(accessToken!)
    if (email) {
      await supabase.from('google_calendar_connection').update({ google_email: email }).eq('user_id', userId)
    }
  } catch {
    /* ignore */
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(summaryPayload),
  }
}
