import type { Deal, Venue } from '@/types'
import { supabase } from '@/lib/supabase'
import { dealQualifiesForCalendar, isCalendarVenueStatus } from '@/lib/calendar/gigCalendarRules'

/**
 * True when the venue should be auto-promoted to `booked` so a newly logged deal
 * can pass `dealQualifiesForCalendar` (see plan: ecosystem audit Finding 1).
 */
export function shouldPromoteVenueForCalendarDeal(
  venue: Pick<Venue, 'id' | 'status'> | null | undefined,
  deal: Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>,
): boolean {
  if (!venue || !deal.venue_id || venue.id !== deal.venue_id) return false
  if (!deal.event_start_at || !deal.event_end_at) return false
  if (deal.event_cancelled_at) return false
  if (venue.status === 'rejected' || venue.status === 'archived') return false
  if (isCalendarVenueStatus(venue.status)) return false
  return dealQualifiesForCalendar(deal, { status: 'booked' })
}

function dealHasCalendarEventWindow(
  deal: Pick<Deal, 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>,
): boolean {
  return Boolean(deal.event_start_at && deal.event_end_at && !deal.event_cancelled_at)
}

export type RefreshVenueForCalendarDealResult = {
  venueAfter: Venue | null
  /** True when venue is rejected/archived but deal has show times — calendar emails will not queue until venue is fixed. */
  calendarEmailsSkippedForTerminalVenue: boolean
}

/**
 * Loads the latest venue row, promotes to `booked` when `shouldPromoteVenueForCalendarDeal`, re-fetches, and returns
 * the row to pass as `venueAfter` into `syncDealCalendarSideEffects`.
 */
export async function refreshVenueAndPromoteForCalendarDeal(
  deal: Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>,
): Promise<RefreshVenueForCalendarDealResult> {
  const vid = deal.venue_id
  if (!vid) {
    return { venueAfter: null, calendarEmailsSkippedForTerminalVenue: false }
  }

  const { data: row0, error: e0 } = await supabase.from('venues').select('*').eq('id', vid).maybeSingle()
  if (e0 || !row0) {
    return { venueAfter: null, calendarEmailsSkippedForTerminalVenue: false }
  }
  let venue = row0 as Venue

  const terminal = venue.status === 'rejected' || venue.status === 'archived'
  const skippedTerminal =
    terminal
    && dealHasCalendarEventWindow(deal)
    && !isCalendarVenueStatus(venue.status)

  if (shouldPromoteVenueForCalendarDeal(venue, deal)) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('venues')
        .update({ status: 'booked' })
        .eq('id', vid)
        .eq('user_id', user.id)
    }
    const { data: row1 } = await supabase.from('venues').select('*').eq('id', vid).maybeSingle()
    if (row1) venue = row1 as Venue
    return { venueAfter: venue, calendarEmailsSkippedForTerminalVenue: false }
  }

  return { venueAfter: venue, calendarEmailsSkippedForTerminalVenue: skippedTerminal }
}
