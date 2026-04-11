import type { Deal, OutreachStatus, Venue } from '../../types'

/** Venue is far enough along that a gig on the calendar counts as “officially booked.” */
export const CALENDAR_VENUE_STATUSES: readonly OutreachStatus[] = [
  'booked',
  'performed',
  'post_follow_up',
  'rebooking',
  'closed_won',
] as const

export function isCalendarVenueStatus(status: OutreachStatus | undefined | null): boolean {
  if (!status) return false
  return (CALENDAR_VENUE_STATUSES as readonly string[]).includes(status)
}

/** Eligible for calendar grid + artist automations tied to “on calendar.” */
export function dealQualifiesForCalendar(
  deal: Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>,
  venue: Pick<Venue, 'status'> | null | undefined,
): boolean {
  if (!deal.venue_id || !venue) return false
  if (!isCalendarVenueStatus(venue.status)) return false
  if (!deal.event_start_at || !deal.event_end_at) return false
  if (deal.event_cancelled_at) return false
  return true
}

/** First time deal becomes calendar-qualified (for ICS trigger): was not qualified before patch. */
export function calendarQualificationFirstTouch(args: {
  before: Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>
  after: Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'>
  venueBefore: Pick<Venue, 'status'> | null | undefined
  venueAfter: Pick<Venue, 'status'> | null | undefined
}): boolean {
  const was = dealQualifiesForCalendar(args.before, args.venueBefore)
  const now = dealQualifiesForCalendar(args.after, args.venueAfter)
  return !was && now
}
