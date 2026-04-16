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

/**
 * Artist “gig booked” confirmation email (`gig_booked_ics`) may send only after the deal is committed:
 * agreement on file and/or deposit fully paid (when a deposit is due).
 */
export function dealAllowsArtistBookingConfirmationEmail(
  deal: Pick<Deal, 'agreement_url' | 'agreement_generated_file_id' | 'deposit_due_amount' | 'deposit_paid_amount'>,
): boolean {
  const hasAgreement = !!(deal.agreement_url?.trim() || deal.agreement_generated_file_id)
  const due = deal.deposit_due_amount
  const paid = deal.deposit_paid_amount ?? 0
  const depositFullyPaid = typeof due === 'number' && due > 0 && paid >= due
  return hasAgreement || depositFullyPaid
}

export function artistBookingConfirmationGateOpened(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
}): boolean {
  if (!args.beforeDeal) return false
  const afterOk = dealAllowsArtistBookingConfirmationEmail(args.afterDeal)
  if (!afterOk) return false
  return !dealAllowsArtistBookingConfirmationEmail(args.beforeDeal) && afterOk
}

/** When reconciling from DB (no before/after snapshot), allow a pending row if calendar + gate pass and ICS email not already sent. */
export function canInsertPendingGigBookedIcs(
  deal: Deal,
  venue: Pick<Venue, 'status'> | null | undefined,
): boolean {
  return (
    dealQualifiesForCalendar(deal, venue) &&
    dealAllowsArtistBookingConfirmationEmail(deal) &&
    !deal.ics_invite_sent_at
  )
}

/** Queue `gig_booked_ics` when calendar-ready and commitment gate passes, on first calendar qualification or when gate newly opens. */
export function shouldQueueArtistGigBookedConfirmation(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
  venueBefore: Pick<Venue, 'status'> | null | undefined
  venueAfter: Pick<Venue, 'status'> | null | undefined
}): boolean {
  const { beforeDeal, afterDeal, venueBefore, venueAfter } = args
  if (!dealQualifiesForCalendar(afterDeal, venueAfter)) return false
  if (!dealAllowsArtistBookingConfirmationEmail(afterDeal)) return false
  if (afterDeal.ics_invite_sent_at) return false
  const before = beforePatchForCalendar(beforeDeal)
  const after = beforePatchForCalendar(afterDeal)
  const calFirst = calendarQualificationFirstTouch({ before, after, venueBefore, venueAfter })
  const gateOpened = artistBookingConfirmationGateOpened({ beforeDeal, afterDeal })
  return calFirst || gateOpened
}

function beforePatchForCalendar(
  deal: Deal | null,
): Pick<Deal, 'venue_id' | 'event_start_at' | 'event_end_at' | 'event_cancelled_at'> {
  if (!deal) {
    return { venue_id: null, event_start_at: null, event_end_at: null, event_cancelled_at: null }
  }
  return {
    venue_id: deal.venue_id,
    event_start_at: deal.event_start_at,
    event_end_at: deal.event_end_at,
    event_cancelled_at: deal.event_cancelled_at ?? null,
  }
}
