/**
 * Shared Google Calendar deal push (service-role Supabase client).
 * Used by google-calendar-deal-push and post-import batch push from google-calendar-sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshAccessToken } from './googleCalendarOAuthShared'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import { googleTimedEventFromUtcIso } from '../../src/lib/calendar/pacificWallTime'
import type { DealTerms, OutreachStatus } from '../../src/types/index'
import { formatVenueAddressForGoogleCalendar } from '../../src/lib/calendar/venueAddressForGoogle'

export type DealPushRow = {
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

export type VenuePushRow = {
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

export type DealPushResult =
  | {
      ok: true
      action: 'noop' | 'deleted' | 'patched' | 'inserted' | 'patched_after_race' | 'race_abandoned'
      eventId?: string
    }
  | { ok: false; httpStatus: number; error: string }

export type DealPushBatchSummary = {
  dealPushAttempted: number
  dealPushInserted: number
  dealPushPatched: number
  dealPushPatchedAfterRace: number
  dealPushNoop: number
  dealPushDeleted: number
  dealPushRaceAbandoned: number
  dealPushErrors: number
  dealPushErrorSample: string | null
  dealPushTruncated: boolean
}

const DEFAULT_BATCH_MAX = 80

function buildGoogleEventDescription(deal: DealPushRow, venue: VenuePushRow | null): string | undefined {
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
  supabase: SupabaseClient
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

function buildEventPayload(deal: DealPushRow, venue: VenuePushRow | null): Record<string, unknown> {
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
 * Creates/updates/deletes the Google event for one deal on the user's shared source calendar.
 */
export async function performGoogleCalendarDealPush(args: {
  supabase: SupabaseClient
  userId: string
  dealId: string
  clientId: string
  clientSecret: string
  /** When false, skip `google_calendar_connection` last_deal_push_* updates (e.g. batch sync sets them once). */
  updateConnectionTelemetry?: boolean
}): Promise<DealPushResult> {
  const { supabase, userId, dealId, clientId, clientSecret } = args
  const updateConn = args.updateConnectionTelemetry !== false

  const recordConnError = async (msg: string | null) => {
    if (!updateConn) return
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
    if (!updateConn) return
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
        ok: false,
        httpStatus: 400,
        error: 'Shared calendar ID not configured.',
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
      return { ok: false, httpStatus: 404, error: 'Deal not found.' }
    }

    const d = deal as DealPushRow

    let venue: VenuePushRow | null = null
    if (d.venue_id) {
      const { data: v } = await supabase
        .from('venues')
        .select(
          'id, status, name, location, city, address_line2, region, postal_code, country, deal_terms',
        )
        .eq('id', d.venue_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (v) venue = v as VenuePushRow
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
      return { ok: true, action: 'deleted' }
    }

    if (!qualified) {
      await recordConnOk()
      return { ok: true, action: 'noop' }
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
      return { ok: true, action: 'patched', eventId: existingId }
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

    let action: 'inserted' | 'patched_after_race' | 'race_abandoned' = 'inserted'
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
    return { ok: true, action, eventId: outEventId || undefined }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[performGoogleCalendarDealPush]', e)
    await recordConnError(msg.slice(0, 2000))
    return { ok: false, httpStatus: 502, error: msg }
  }
}

type DealListRow = Pick<
  DealPushRow,
  'id' | 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'
> & {
  venue: { status: OutreachStatus } | null
}

/**
 * After importing from Google, push all calendar-qualified deals so new/edited gigs appear on the shared calendar.
 * Limited per request to stay within serverless timeouts.
 */
export async function pushAllQualifyingDealsToGoogleCalendar(args: {
  supabase: SupabaseClient
  userId: string
  clientId: string
  clientSecret: string
  maxDeals?: number
}): Promise<DealPushBatchSummary> {
  const maxDeals = args.maxDeals ?? DEFAULT_BATCH_MAX
  const empty: DealPushBatchSummary = {
    dealPushAttempted: 0,
    dealPushInserted: 0,
    dealPushPatched: 0,
    dealPushPatchedAfterRace: 0,
    dealPushNoop: 0,
    dealPushDeleted: 0,
    dealPushRaceAbandoned: 0,
    dealPushErrors: 0,
    dealPushErrorSample: null,
    dealPushTruncated: false,
  }

  const { clientId, clientSecret } = args
  if (!clientId || !clientSecret) {
    return empty
  }

  const { data: rows, error } = await args.supabase
    .from('deals')
    .select(
      'id, venue_id, event_start_at, event_end_at, event_cancelled_at, venue:venues(status)',
    )
    .eq('user_id', args.userId)

  if (error || !rows?.length) {
    return empty
  }

  const qualifiedIds: string[] = []
  for (const row of rows as DealListRow[]) {
    if (
      dealQualifiesForCalendar(row, row.venue ? { status: row.venue.status } : null)
    ) {
      qualifiedIds.push(row.id)
    }
  }

  const truncated = qualifiedIds.length > maxDeals
  const ids = qualifiedIds.slice(0, maxDeals)

  let dealPushErrorSample: string | null = null

  const recordBatchConnError = async (msg: string | null) => {
    await args.supabase
      .from('google_calendar_connection')
      .update({
        last_deal_push_at: new Date().toISOString(),
        last_deal_push_error: msg,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', args.userId)
  }

  const recordBatchConnOk = async () => {
    await args.supabase
      .from('google_calendar_connection')
      .update({
        last_deal_push_at: new Date().toISOString(),
        last_deal_push_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', args.userId)
  }

  for (const dealId of ids) {
    const r = await performGoogleCalendarDealPush({
      supabase: args.supabase,
      userId: args.userId,
      dealId,
      clientId,
      clientSecret,
      updateConnectionTelemetry: false,
    })
    empty.dealPushAttempted += 1
    if (!r.ok) {
      empty.dealPushErrors += 1
      if (!dealPushErrorSample) dealPushErrorSample = r.error
      continue
    }
    switch (r.action) {
      case 'inserted':
        empty.dealPushInserted += 1
        break
      case 'patched':
        empty.dealPushPatched += 1
        break
      case 'patched_after_race':
        empty.dealPushPatchedAfterRace += 1
        break
      case 'noop':
        empty.dealPushNoop += 1
        break
      case 'deleted':
        empty.dealPushDeleted += 1
        break
      case 'race_abandoned':
        empty.dealPushRaceAbandoned += 1
        break
      default:
        break
    }
  }

  empty.dealPushErrorSample = dealPushErrorSample
  empty.dealPushTruncated = truncated

  if (ids.length > 0) {
    if (empty.dealPushErrors > 0) {
      await recordBatchConnError((dealPushErrorSample ?? 'One or more deal pushes failed.').slice(0, 2000))
    } else {
      await recordBatchConnOk()
    }
  }

  return empty
}
