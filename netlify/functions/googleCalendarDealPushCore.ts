/**
 * Shared Google Calendar deal push (service-role Supabase client).
 * Used by google-calendar-deal-push and post-import batch push from google-calendar-sync.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { refreshAccessToken } from './googleCalendarOAuthShared'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import { googleTimedEventFromUtcIso } from '../../src/lib/calendar/pacificWallTime'
import type { CommissionTier, DealTerms, OutreachStatus } from '../../src/types/index'
import { formatVenueAddressForGoogleCalendar } from '../../src/lib/calendar/venueAddressForGoogle'
import { buildGoogleCalendarDealDescription } from '../../src/lib/calendar/googleCalendarDealDescription'

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
  gross_amount: number
  payment_due_date: string | null
  commission_tier: CommissionTier
  promise_lines: unknown | null
  pricing_snapshot: unknown | null
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

/** Non-PII diagnostics for calendar sync (embed vs explicit venue lookup). */
export type DealPushScan = {
  dealsLoaded: number
  queryError: string | null
  qualifiedByEmbed: number
  qualifiedByLookup: number
  mismatchEmbFailLookupOk: number
  pushQueueSource: 'embed' | 'lookup'
}

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
  dealPushScan: DealPushScan
  /** False when GOOGLE_CLIENT_ID / SECRET missing on the server. */
  dealPushOAuthConfigured: boolean
}

const DEFAULT_BATCH_MAX = 80

function normalizeEmbeddedVenue(raw: unknown): { status: OutreachStatus } | null {
  if (raw == null) return null
  if (Array.isArray(raw)) {
    const first = raw[0] as { status?: OutreachStatus } | undefined
    return first?.status != null ? { status: first.status } : null
  }
  if (typeof raw === 'object' && 'status' in (raw as object)) {
    return { status: (raw as { status: OutreachStatus }).status }
  }
  return null
}

function buildGoogleEventDescription(deal: DealPushRow, venue: VenuePushRow | null): string | undefined {
  const dt = venue?.deal_terms ?? null
  return buildGoogleCalendarDealDescription(
    {
      notes: deal.notes,
      gross_amount: deal.gross_amount,
      payment_due_date: deal.payment_due_date,
      commission_tier: deal.commission_tier,
      promise_lines: deal.promise_lines,
      pricing_snapshot: deal.pricing_snapshot,
    },
    dt,
    { maxLength: 8000 },
  )
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

async function googleGetEvent(args: {
  accessToken: string
  calendarId: string
  eventId: string
}): Promise<{ id: string; etag?: string }> {
  const cal = encodeURIComponent(args.calendarId)
  const eid = encodeURIComponent(args.eventId)
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${eid}`,
    { headers: { Authorization: `Bearer ${args.accessToken}` } },
  )
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`events.get ${res.status}: ${t}`)
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

/**
 * Stale stored etag (edits in Google UI, import, etc.) yields 412 Precondition Failed.
 * Refresh etag via GET, retry PATCH; if still 412, PATCH without If-Match (last resort).
 */
async function googlePatchEventWithStaleEtagRetry(args: {
  accessToken: string
  calendarId: string
  eventId: string
  etag: string | null
  body: Record<string, unknown>
}): Promise<{ id: string; etag?: string }> {
  const patch = (etag: string | null) =>
    googlePatchEvent({
      accessToken: args.accessToken,
      calendarId: args.calendarId,
      eventId: args.eventId,
      etag,
      body: args.body,
    })

  try {
    return await patch(args.etag)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (!msg.includes('412')) throw e
    const fresh = await googleGetEvent({
      accessToken: args.accessToken,
      calendarId: args.calendarId,
      eventId: args.eventId,
    })
    try {
      return await patch(fresh.etag ?? null)
    } catch (e2) {
      const msg2 = e2 instanceof Error ? e2.message : String(e2)
      if (!msg2.includes('412')) throw e2
      return await patch(null)
    }
  }
}

function buildEventPayload(deal: DealPushRow, venue: VenuePushRow | null): Record<string, unknown> {
  const start = deal.event_start_at ? googleTimedEventFromUtcIso(deal.event_start_at) : null
  const end = deal.event_end_at ? googleTimedEventFromUtcIso(deal.event_end_at) : null
  if (!start || !end) {
    throw new Error('Deal is missing event start/end.')
  }
  const base = deal.description.trim() || 'Gig'
  const summary = venue ? `${base} · ${venue.name}` : base
  const description = buildGoogleEventDescription(deal, venue)
  const payload: Record<string, unknown> = {
    summary,
    description,
    start,
    end,
  }
  if (venue != null) {
    payload.location =
      (formatVenueAddressForGoogleCalendar(venue)?.trim() || venue.name.trim()) || 'Venue'
  }
  return payload
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
        'id, user_id, description, venue_id, event_start_at, event_end_at, event_cancelled_at, notes, google_shared_calendar_event_id, google_shared_calendar_event_etag, gross_amount, payment_due_date, commission_tier, promise_lines, pricing_snapshot',
      )
      .eq('id', dealId)
      .eq('user_id', userId)
      .maybeSingle()

    if (dealErr || !deal) {
      return { ok: false, httpStatus: 404, error: 'Deal not found.' }
    }

    const dr = deal as Record<string, unknown>
    const d: DealPushRow = {
      ...(deal as DealPushRow),
      gross_amount: Number(dr.gross_amount ?? 0) || 0,
      payment_due_date: (dr.payment_due_date as string | null | undefined) ?? null,
      commission_tier: (dr.commission_tier as CommissionTier | undefined) ?? 'artist_network',
      promise_lines: dr.promise_lines ?? null,
      pricing_snapshot: dr.pricing_snapshot ?? null,
    }

    /**
     * Use `select('*')` so qualification/payload work even when optional address columns
     * from newer migrations are not present on the remote DB (explicit column lists can 400).
     * Batch qualification only uses `id, status`; this path must match that outcome.
     */
    let venue: VenuePushRow | null = null
    if (d.venue_id) {
      const { data: v, error: venueErr } = await supabase
        .from('venues')
        .select('*')
        .eq('id', d.venue_id)
        .eq('user_id', userId)
        .maybeSingle()
      if (venueErr) {
        console.error('[performGoogleCalendarDealPush] venue load error', dealId, venueErr.message)
      }
      if (v) {
        const row = v as Record<string, unknown>
        venue = {
          id: String(row.id),
          status: row.status as OutreachStatus,
          name: typeof row.name === 'string' ? row.name : '',
          location: (row.location as string | null) ?? null,
          city: (row.city as string | null) ?? null,
          address_line2: (row.address_line2 as string | null) ?? null,
          region: (row.region as string | null) ?? null,
          postal_code: (row.postal_code as string | null) ?? null,
          country: (row.country as string | null) ?? null,
          deal_terms: (row.deal_terms as DealTerms | null) ?? null,
        }
      }
    }

    const qualified = dealQualifiesForCalendar(d, venue ? { status: venue.status } : null)

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
      const patched = await googlePatchEventWithStaleEtagRetry({
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
        await googlePatchEventWithStaleEtagRetry({
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
  venue?: unknown
}

function emptyBatchSummary(oauthConfigured: boolean): DealPushBatchSummary {
  return {
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
    dealPushOAuthConfigured: oauthConfigured,
    dealPushScan: {
      dealsLoaded: 0,
      queryError: null,
      qualifiedByEmbed: 0,
      qualifiedByLookup: 0,
      mismatchEmbFailLookupOk: 0,
      pushQueueSource: 'lookup',
    },
  }
}

/**
 * After importing from Google, push all calendar-qualified deals so new/edited gigs appear on the shared calendar.
 * Qualification uses an explicit `venues` lookup (same as single-deal push), not only the optional embed row.
 * Limited per request to stay within serverless timeouts.
 */
export async function pushAllQualifyingDealsToGoogleCalendar(args: {
  supabase: SupabaseClient
  userId: string
  clientId: string | undefined
  clientSecret: string | undefined
  maxDeals?: number
}): Promise<DealPushBatchSummary> {
  const maxDeals = args.maxDeals ?? DEFAULT_BATCH_MAX
  const oauthConfigured = !!(args.clientId && args.clientSecret)
  const out = emptyBatchSummary(oauthConfigured)
  const { clientId, clientSecret } = args

  const { data: rows, error } = await args.supabase
    .from('deals')
    .select(
      'id, venue_id, event_start_at, event_end_at, event_cancelled_at, venue:venues(status)',
    )
    .eq('user_id', args.userId)

  if (error) {
    out.dealPushScan.queryError = error.message
    return out
  }
  if (!rows?.length) {
    return out
  }

  out.dealPushScan.dealsLoaded = rows.length

  const venueIds = [...new Set(rows.map(r => r.venue_id).filter(Boolean))] as string[]
  const venueLookup = new Map<string, { status: OutreachStatus }>()
  if (venueIds.length > 0) {
    const { data: venueRows } = await args.supabase
      .from('venues')
      .select('id, status')
      .eq('user_id', args.userId)
      .in('id', venueIds)
    for (const v of venueRows ?? []) {
      venueLookup.set(v.id, { status: v.status as OutreachStatus })
    }
  }

  const embedQualified: string[] = []
  const lookupQualified: string[] = []
  let mismatchEmbFailLookupOk = 0

  for (const row of rows as DealListRow[]) {
    const embVenue = normalizeEmbeddedVenue(row.venue)
    const lkVenue = row.venue_id ? venueLookup.get(row.venue_id) ?? null : null
    const qEmb = dealQualifiesForCalendar(row, embVenue)
    const qLk = dealQualifiesForCalendar(row, lkVenue)
    if (qEmb) embedQualified.push(row.id)
    if (qLk) lookupQualified.push(row.id)
    if (!qEmb && qLk) mismatchEmbFailLookupOk += 1
  }

  out.dealPushScan.qualifiedByEmbed = embedQualified.length
  out.dealPushScan.qualifiedByLookup = lookupQualified.length
  out.dealPushScan.mismatchEmbFailLookupOk = mismatchEmbFailLookupOk
  out.dealPushScan.pushQueueSource = 'lookup'

  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58b41d' },
    body: JSON.stringify({
      sessionId: '58b41d',
      hypothesisId: 'B',
      location: 'googleCalendarDealPushCore.ts:pushAllQualifyingDealsToGoogleCalendar',
      message: 'deal push scan',
      data: {
        dealsLoaded: out.dealPushScan.dealsLoaded,
        qualifiedByEmbed: out.dealPushScan.qualifiedByEmbed,
        qualifiedByLookup: out.dealPushScan.qualifiedByLookup,
        mismatchEmbFailLookupOk: out.dealPushScan.mismatchEmbFailLookupOk,
        oauthConfigured: out.dealPushOAuthConfigured,
        queryError: out.dealPushScan.queryError,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  if (!oauthConfigured || !clientId || !clientSecret) {
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58b41d' },
      body: JSON.stringify({
        sessionId: '58b41d',
        hypothesisId: 'A',
        location: 'googleCalendarDealPushCore.ts:pushAllQualifyingDealsToGoogleCalendar',
        message: 'push skipped — oauth not configured on server',
        data: { oauthConfigured: false },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    return out
  }

  const qualifiedIds = lookupQualified
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
    out.dealPushAttempted += 1
    if (!r.ok) {
      out.dealPushErrors += 1
      if (!dealPushErrorSample) dealPushErrorSample = r.error
      continue
    }
    switch (r.action) {
      case 'inserted':
        out.dealPushInserted += 1
        break
      case 'patched':
        out.dealPushPatched += 1
        break
      case 'patched_after_race':
        out.dealPushPatchedAfterRace += 1
        break
      case 'noop':
        out.dealPushNoop += 1
        break
      case 'deleted':
        out.dealPushDeleted += 1
        break
      case 'race_abandoned':
        out.dealPushRaceAbandoned += 1
        break
      default:
        break
    }
  }

  out.dealPushErrorSample = dealPushErrorSample
  out.dealPushTruncated = truncated

  if (ids.length > 0) {
    if (out.dealPushErrors > 0) {
      await recordBatchConnError((dealPushErrorSample ?? 'One or more deal pushes failed.').slice(0, 2000))
    } else {
      await recordBatchConnOk()
    }
  }

  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58b41d' },
    body: JSON.stringify({
      sessionId: '58b41d',
      hypothesisId: 'E',
      location: 'googleCalendarDealPushCore.ts:pushAllQualifyingDealsToGoogleCalendar:exit',
      message: 'batch push finished',
      data: {
        dealPushAttempted: out.dealPushAttempted,
        dealPushInserted: out.dealPushInserted,
        dealPushPatched: out.dealPushPatched,
        dealPushErrors: out.dealPushErrors,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return out
}
