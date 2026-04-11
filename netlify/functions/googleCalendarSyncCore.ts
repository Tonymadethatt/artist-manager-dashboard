/**
 * Shared Google Calendar → calendar_sync_event import (service-role Supabase client).
 * Used by JWT handler and background sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  fetchGoogleEmail,
  getGoogleOAuthEnv,
  refreshAccessToken,
} from './googleCalendarOAuthShared'
import { matchVenueForCalendarEvent } from '../../src/lib/calendar/googleCalendarVenueMatch'

const DESCRIPTION_MAX_LEN = 32_000

export type GCalDateTime = { dateTime?: string; date?: string; timeZone?: string }
export type GCalEvent = {
  id?: string
  status?: string
  summary?: string
  description?: string
  location?: string
  start?: GCalDateTime
  end?: GCalDateTime
}

export type GoogleCalendarImportSummary = {
  imported: number
  copied: number
  refreshed: number
  skipped: number
  tasksCreated: number
  errors: string[]
  errorCount: number
  listed: number
  timeMin: string
  timeMax: string
}

export type GoogleCalendarImportResult =
  | { ok: true; summary: GoogleCalendarImportSummary }
  | { ok: false; statusCode: number; error: string }

type ExistingSyncRow = {
  id: string
  source_event_id: string
  summary: string | null
  location: string | null
  description: string | null
  matched_venue_id: string | null
  event_start_at: string | null
  event_end_at: string | null
}

export function parseEventBounds(ev: GCalEvent): { start: string | null; end: string | null } {
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

function trimDescription(d: string | undefined | null): string | null {
  if (d == null || typeof d !== 'string') return null
  const t = d.trim()
  if (!t) return null
  return t.length > DESCRIPTION_MAX_LEN ? t.slice(0, DESCRIPTION_MAX_LEN) : t
}

function appendDescriptionToTaskNotes(baseNotes: string, description: string | null): string {
  if (!description) return baseNotes
  const snippet =
    description.length > 500 ? `${description.slice(0, 497)}…` : description
  return `${baseNotes}\n\nNotes (from Google):\n${snippet}`
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
    const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${cal}/events`)
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

/**
 * Full import for one user: refresh token, list Google events, insert new / update mirror fields for existing.
 */
export async function runGoogleCalendarImportForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<GoogleCalendarImportResult> {
  const { clientId, clientSecret } = getGoogleOAuthEnv()
  if (!clientId || !clientSecret) {
    return { ok: false, statusCode: 503, error: 'Google OAuth is not configured.' }
  }

  const { data: cred, error: credErr } = await supabase
    .from('google_calendar_credentials')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (credErr || !cred?.refresh_token) {
    return { ok: false, statusCode: 400, error: 'Google Calendar is not connected.' }
  }

  const { data: conn, error: connErr } = await supabase
    .from('google_calendar_connection')
    .select('source_calendar_id, sync_past_days, sync_future_days')
    .eq('user_id', userId)
    .maybeSingle()

  if (connErr || !conn) {
    return { ok: false, statusCode: 400, error: 'Calendar connection not found.' }
  }

  const sourceCal = (conn.source_calendar_id ?? '').trim()
  if (!sourceCal) {
    return {
      ok: false,
      statusCode: 400,
      error: 'Set your shared source calendar ID in Settings before syncing.',
    }
  }

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
      console.error('[googleCalendarSyncCore] refresh', e)
      return { ok: false, statusCode: 502, error: 'Could not refresh Google access token.' }
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
    console.error('[googleCalendarSyncCore] list', e)
    return {
      ok: false,
      statusCode: 502,
      error: e instanceof Error ? e.message : 'Failed to list source calendar events.',
    }
  }

  const { data: existingRows } = await supabase
    .from('calendar_sync_event')
    .select(
      'id, source_event_id, summary, location, description, matched_venue_id, event_start_at, event_end_at',
    )
    .eq('user_id', userId)
    .eq('source_calendar_id', sourceCal)

  const existingByEid = new Map<string, ExistingSyncRow>(
    (existingRows ?? []).map(r => [r.source_event_id as string, r as ExistingSyncRow]),
  )

  const { data: dealOwnedRows } = await supabase
    .from('deals')
    .select('google_shared_calendar_event_id')
    .eq('user_id', userId)
    .not('google_shared_calendar_event_id', 'is', null)

  const ownedGoogleEventIds = new Set(
    (dealOwnedRows ?? [])
      .map(r => r.google_shared_calendar_event_id as string)
      .filter(Boolean),
  )

  const { data: venueRows } = await supabase
    .from('venues')
    .select('id, name, location, city')
    .eq('user_id', userId)

  const venues = venueRows ?? []

  let imported = 0
  let refreshed = 0
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
    if (ownedGoogleEventIds.has(eid)) {
      skipped++
      continue
    }

    const { start, end } = parseEventBounds(ev)
    const summary = ev.summary ?? '(No title)'
    const location = ev.location ?? null
    const description = trimDescription(ev.description)

    const existing = existingByEid.get(eid)
    if (existing) {
      const textChanged =
        (existing.summary ?? '') !== summary ||
        (existing.location ?? '') !== (location ?? '') ||
        (existing.description ?? '') !== (description ?? '')
      const timesChanged =
        (existing.event_start_at ?? '') !== (start ?? '') ||
        (existing.event_end_at ?? '') !== (end ?? '')

      let nextVenueId: string | null = existing.matched_venue_id
      const shouldRematch = !existing.matched_venue_id || textChanged
      if (shouldRematch) {
        const match = matchVenueForCalendarEvent(summary, location, venues)
        nextVenueId = match?.venueId ?? null
      }

      if (!textChanged && !timesChanged && nextVenueId === existing.matched_venue_id) {
        skipped++
        continue
      }

      const { error: upErr } = await supabase
        .from('calendar_sync_event')
        .update({
          summary,
          location,
          description,
          event_start_at: start,
          event_end_at: end,
          matched_venue_id: nextVenueId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('source_calendar_id', sourceCal)
        .eq('source_event_id', eid)

      if (upErr) {
        errors.push(`${eid}: db update failed ${upErr.message}`)
        continue
      }
      refreshed++
      continue
    }

    const match = matchVenueForCalendarEvent(summary, location, venues)

    const { data: syncRow, error: syncInsErr } = await supabase
      .from('calendar_sync_event')
      .insert({
        user_id: userId,
        source_calendar_id: sourceCal,
        source_event_id: eid,
        destination_calendar_id: null,
        destination_event_id: null,
        event_start_at: start,
        event_end_at: end,
        summary,
        location,
        description,
        matched_venue_id: match?.venueId ?? null,
        follow_up_task_id: null,
      })
      .select('id')
      .single()

    if (syncInsErr || !syncRow) {
      errors.push(`${eid}: db insert failed ${syncInsErr?.message ?? ''}`)
      continue
    }

    existingByEid.set(eid, {
      id: syncRow.id as string,
      source_event_id: eid,
      summary,
      location,
      description,
      matched_venue_id: match?.venueId ?? null,
      event_start_at: start,
      event_end_at: end,
    })
    imported++

    let taskId: string | null = null
    if (!match) {
      const due = ymdFromIso(start)
      let notes = [
        'Synced from Google Calendar (shared calendar).',
        `Event: ${summary}`,
        `When: ${start ?? '—'} → ${end ?? '—'}`,
        `Location: ${location ?? '—'}`,
        `Source event ID: ${eid}`,
        '',
        'Add this venue to the CRM if you plan to reach out.',
      ].join('\n')
      notes = appendDescriptionToTaskNotes(notes, description)

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

  const summaryPayload: GoogleCalendarImportSummary = {
    imported,
    copied: imported,
    refreshed,
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
      last_sync_summary: summaryPayload as unknown as Record<string, unknown>,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  try {
    const email = await fetchGoogleEmail(accessToken!)
    if (email) {
      await supabase.from('google_calendar_connection').update({ google_email: email }).eq('user_id', userId)
    }
  } catch {
    /* ignore */
  }

  return { ok: true, summary: summaryPayload }
}
