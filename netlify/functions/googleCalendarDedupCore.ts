/**
 * Shared calendar_sync_event dedup recompute (service-role Supabase client).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { dealQualifiesForCalendar } from '../../src/lib/calendar/gigCalendarRules'
import {
  computeCalendarDedupUpdates,
  type CalendarDedupDealRow,
  type CalendarSyncDedupRow,
} from '../../src/lib/calendar/calendarDedupRules'
import type { Deal, Venue } from '../../src/types/index'

export type CalendarDedupRunSummary = {
  ok: true
  scanned: number
  updated: number
  hidden_duplicates: number
  needs_review: number
}

export type CalendarDedupRunResult =
  | CalendarDedupRunSummary
  | { ok: false; error: string; statusCode: number }

export async function runCalendarDedupForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<CalendarDedupRunResult> {
  const { data: syncRows, error: sErr } = await supabase
    .from('calendar_sync_event')
    .select(
      'id, source_calendar_id, source_event_id, event_start_at, event_end_at, summary, location, matched_venue_id',
    )
    .eq('user_id', userId)

  if (sErr) {
    return { ok: false, error: sErr.message, statusCode: 500 }
  }

  const { data: dealRows, error: dErr } = await supabase
    .from('deals')
    .select('id, venue_id, description, event_start_at, event_end_at, event_cancelled_at, venue:venues(id, status)')
    .eq('user_id', userId)

  if (dErr) {
    return { ok: false, error: dErr.message, statusCode: 500 }
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
    ok: true,
    scanned: updates.length,
    updated,
    hidden_duplicates: hidden,
    needs_review: review,
  }
}
