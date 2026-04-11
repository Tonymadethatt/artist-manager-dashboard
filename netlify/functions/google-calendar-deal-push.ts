import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  getGoogleOAuthEnv,
  refreshAccessToken,
} from './googleCalendarOAuthShared'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import { googleTimedEventFromUtcIso } from '../../src/lib/calendar/pacificWallTime'
import type { DealTerms, OutreachStatus } from '../../src/types/index'
import { formatVenueAddressForGoogleCalendar } from '../../src/lib/calendar/venueAddressForGoogle'

type DealRow = {
  id: string
  user_id: string
  description: string
  venue_id: string | null
  event_start_at: string | null
  event_end_at: string | null
  event_cancelled_at: string | null
  notes: string | null
  google_shared_calendar_event_id: string | null
  google_shared_calendar_event_etag: string | null
}

type VenueRow = {
  id: string
  status: OutreachStatus
  name: string
  location: string | null
  city: string | null
  address_line2: string | null
  region: string | null
  postal_code: string | null
  country: string | null
  deal_terms: DealTerms | null
}

function buildGoogleEventDescription(deal: DealRow, venue: VenueRow | null): string | undefined {
  const parts: string[] = []
  const notes = deal.notes?.trim()
  if (notes) parts.push(notes)

  const dt = venue?.deal_terms
  if (dt && typeof dt === 'object' && !Array.isArray(dt)) {
    const extras: string[] = []
    if (typeof dt.set_length === 'string' && dt.set_length.trim()) {
      extras.push(`Set length: ${dt.set_length.trim()}`)
    }
    if (typeof dt.load_in_time === 'string' && dt.load_in_time.trim()) {
      extras.push(`Load-in: ${dt.load_in_time.trim()}`)
    }
    if (typeof dt.notes === 'string' && dt.notes.trim()) {
      extras.push(dt.notes.trim())
    }
    if (extras.length) parts.push(extras.join('\n'))
  }

  const out = parts.join('\n\n').trim()
  return out.length ? out.slice(0, 8000) : undefined
}

async function ensureAccessToken(args: {
  supabase: ReturnType<typeof createClient>
  userId: string
  clientId: string
  clientSecret: string
}): Promise<string> {
  const { data: cred, error: credErr } = await args.supabase
    .from('google_calendar_credentials')
    .select('refresh_token, access_token, access_token_expires_at')
    .eq('user_id', args.userId)
    .maybeSingle()

  if (credErr || !cred?.refresh_token) {
    throw new Error('Google Calendar is not connected.')
  }

  let accessToken = cred.access_token as string | null
  const exp = cred.access_token_expires_at
    ? new Date(cred.access_token_expires_at).getTime()
    : 0
  if (!accessToken || exp < Date.now() + 60_000) {
    const t = await refreshAccessToken({
      refreshToken: cred.refresh_token,
      clientId: args.clientId,
      clientSecret: args.clientSecret,
    })
    accessToken = t.access_token
    const expiresAt = new Date(Date.now() + t.expires_in * 1000).toISOString()
    await args.supabase
      .from('google_calendar_credentials')
      .update({
        access_token: accessToken,
        access_token_expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', args.userId)
  }
  return accessToken!
}

async function googleDeleteEvent(args: {
  accessToken: string
  calendarId: string
  eventId: string
}): Promise<void> {
  const cal = encodeURIComponent(args.calendarId)
  const eid = encodeURIComponent(args.eventId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${eid}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${args.accessToken}` },
    },
  )
  if (res.status === 204 || res.status === 404) return
  const t = await res.text()
  throw new Error(`events.delete ${res.status}: ${t}`)
}

async function googleInsertEvent(args: {
  accessToken: string
  calendarId: string
  body: Record<string, unknown>
}): Promise<{ id: string; etag?: string }> {
  const cal = encodeURIComponent(args.calendarId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(args.body),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`events.insert ${res.status}: ${t}`)
  }
  return res.json() as Promise<{ id: string; etag?: string }>
}

async function googlePatchEvent(args: {
  accessToken: string
  calendarId: string
  eventId: string
  etag: string | null
  body: Record<string, unknown>
}): Promise<{ id: string; etag?: string }> {
  const cal = encodeURIComponent(args.calendarId)
  const eid = encodeURIComponent(args.eventId)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${args.accessToken}`,
    'Content-Type': 'application/json',
  }
  if (args.etag) headers['If-Match'] = args.etag
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${eid}`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify(args.body),
    },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`events.patch ${res.status}: ${t}`)
  }
  return res.json() as Promise<{ id: string; etag?: string }>
}

function buildEventPayload(deal: DealRow, venue: VenueRow | null): Record<string, unknown> {
  const start = deal.event_start_at ? googleTimedEventFromUtcIso(deal.event_start_at) : null
  const end = deal.event_end_at ? googleTimedEventFromUtcIso(deal.event_end_at) : null
  if (!start || !end) {
    throw new Error('Deal is missing event start/end.')
  }
  const base = deal.description.trim() || 'Gig'
  const summary = venue ? `${base} · ${venue.name}` : base
  const location = formatVenueAddressForGoogleCalendar(venue)
  const description = buildGoogleEventDescription(deal, venue)
  return {
    summary,
    description,
    location,
    start,
    end,
  }
}

/**
 * POST JSON { dealId: string } with Authorization: Bearer <Supabase JWT>.
 * Creates/updates/deletes Google Calendar event on shared source calendar to match deal.
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

  let dealId: string
  try {
    const body = JSON.parse(event.body || '{}') as { dealId?: string }
    dealId = (body.dealId ?? '').trim()
    if (!dealId) throw new Error('dealId required')
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON or missing dealId' }),
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

  const recordConnError = async (msg: string | null) => {
    await supabase
      .from('google_calendar_connection')
      .update({
        last_deal_push_at: new Date().toISOString(),
        last_deal_push_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  const recordConnOk = async () => {
    await supabase
      .from('google_calendar_connection')
      .update({
        last_deal_push_at: new Date().toISOString(),
        last_deal_push_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
  }

  try {
    const { data: conn } = await supabase
      .from('google_calendar_connection')
      .select('source_calendar_id')
      .eq('user_id', userId)
      .maybeSingle()

    const calendarId = (conn?.source_calendar_id ?? '').trim()
    if (!calendarId) {
      await recordConnError('Set your shared calendar ID in Settings before publishing gigs.')
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Shared calendar ID not configured.' }),
      }
    }

    const accessToken = await ensureAccessToken({
      supabase,
      userId,
      clientId,
      clientSecret,
    })

    const { data: deal, error: dealErr } = await supabase
      .from('deals')
      .select(
        'id, user_id, description, venue_id, event_start_at, event_end_at, event_cancelled_at, notes, google_shared_calendar_event_id, google_shared_calendar_event_etag',
      )
      .eq('id', dealId)
      .eq('user_id', userId)
      .maybeSingle()

    if (dealErr || !deal) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Deal not found.' }),
      }
    }

    const d = deal as DealRow

    let venue: VenueRow | null = null
    if (d.venue_id) {
      const { data: v } = await supabase
        .from('venues')
        .select(
          'id, status, name, location, city, address_line2, region, postal_code, country, deal_terms',
        )
        .eq('id', d.venue_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (v) venue = v as VenueRow
    }

    const qualified = dealQualifiesForCalendar(d, venue)

    if (!qualified && d.google_shared_calendar_event_id) {
      await googleDeleteEvent({
        accessToken,
        calendarId,
        eventId: d.google_shared_calendar_event_id,
      })
      await supabase
        .from('deals')
        .update({
          google_shared_calendar_event_id: null,
          google_shared_calendar_event_etag: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .eq('user_id', userId)
      await recordConnOk()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, action: 'deleted' }),
      }
    }

    if (!qualified) {
      await recordConnOk()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, action: 'noop' }),
      }
    }

    const payload = buildEventPayload(d, venue)

    const { data: d2 } = await supabase
      .from('deals')
      .select('google_shared_calendar_event_id, google_shared_calendar_event_etag')
      .eq('id', dealId)
      .eq('user_id', userId)
      .maybeSingle()

    const existingId = (d2 as { google_shared_calendar_event_id?: string | null } | null)
      ?.google_shared_calendar_event_id
    const existingEtag =
      (d2 as { google_shared_calendar_event_etag?: string | null } | null)
        ?.google_shared_calendar_event_etag ?? null

    if (existingId) {
      const patched = await googlePatchEvent({
        accessToken,
        calendarId,
        eventId: existingId,
        etag: existingEtag,
        body: payload,
      })
      await supabase
        .from('deals')
        .update({
          google_shared_calendar_event_etag: patched.etag ?? existingEtag,
          updated_at: new Date().toISOString(),
        })
        .eq('id', dealId)
        .eq('user_id', userId)
      await recordConnOk()
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true, action: 'patched', eventId: existingId }),
      }
    }

    const created = await googleInsertEvent({
      accessToken,
      calendarId,
      body: payload,
    })

    const { data: claimed } = await supabase
      .from('deals')
      .update({
        google_shared_calendar_event_id: created.id,
        google_shared_calendar_event_etag: created.etag ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealId)
      .eq('user_id', userId)
      .is('google_shared_calendar_event_id', null)
      .select('id')
      .maybeSingle()

    let action: string = 'inserted'
    let outEventId = created.id

    if (!claimed) {
      await googleDeleteEvent({ accessToken, calendarId, eventId: created.id }).catch(() => {})
      const { data: other } = await supabase
        .from('deals')
        .select('google_shared_calendar_event_id, google_shared_calendar_event_etag')
        .eq('id', dealId)
        .eq('user_id', userId)
        .maybeSingle()
      const row = other as {
        google_shared_calendar_event_id?: string | null
        google_shared_calendar_event_etag?: string | null
      } | null
      const oid = row?.google_shared_calendar_event_id
      if (oid) {
        await googlePatchEvent({
          accessToken,
          calendarId,
          eventId: oid,
          etag: row?.google_shared_calendar_event_etag ?? null,
          body: payload,
        }).catch(() => {})
        action = 'patched_after_race'
        outEventId = oid
      } else {
        action = 'race_abandoned'
        outEventId = ''
      }
    }

    await recordConnOk()
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, action, eventId: outEventId || undefined }),
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[google-calendar-deal-push]', e)
    await recordConnError(msg.slice(0, 2000))
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: msg }),
    }
  }
}
