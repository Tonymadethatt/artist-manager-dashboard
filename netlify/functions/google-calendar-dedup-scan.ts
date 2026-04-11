import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import {
  computeCalendarDedupUpdates,
  type CalendarDedupDealRow,
  type CalendarSyncDedupRow,
} from '../../src/lib/calendar/calendarDedupRules'
import type { Deal, Venue } from '../../src/types/index'

/**
 * POST with Authorization: Bearer <Supabase JWT>.
 * Recomputes calendar_sync_event display_status / dedup fields (rules-only).
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
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

  const { data: syncRows, error: sErr } = await supabase
    .from('calendar_sync_event')
    .select(
      'id, source_calendar_id, source_event_id, event_start_at, event_end_at, summary, location, matched_venue_id',
    )
    .eq('user_id', userId)

  if (sErr) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: sErr.message }),
    }
  }

  const { data: dealRows, error: dErr } = await supabase
    .from('deals')
    .select('id, venue_id, description, event_start_at, event_end_at, event_cancelled_at, venue:venues(id, status)')
    .eq('user_id', userId)

  if (dErr) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: dErr.message }),
    }
  }

  const dealsForDedup: CalendarDedupDealRow[] = []
  for (const raw of dealRows ?? []) {
    const d = raw as Deal & { venue?: Pick<Venue, 'status'> | null }
    if (dealQualifiesForCalendar(d, d.venue ?? null)) {
      dealsForDedup.push({
        id: d.id,
        venue_id: d.venue_id,
        description: d.description,
        event_start_at: d.event_start_at,
        event_end_at: d.event_end_at,
      })
    }
  }

  const updates = computeCalendarDedupUpdates(
    (syncRows ?? []) as CalendarSyncDedupRow[],
    dealsForDedup,
  )

  let updated = 0
  for (const u of updates) {
    const { error: uErr } = await supabase
      .from('calendar_sync_event')
      .update({
        display_status: u.display_status,
        dedup_pair_deal_id: u.dedup_pair_deal_id,
        dedup_rule: u.dedup_rule,
        dedup_score: u.dedup_score,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id)
      .eq('user_id', userId)
    if (!uErr) updated++
  }

  const hidden = updates.filter(u => u.display_status === 'hidden_duplicate').length
  const review = updates.filter(u => u.display_status === 'needs_review').length

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      scanned: updates.length,
      updated,
      hidden_duplicates: hidden,
      needs_review: review,
    }),
  }
}
