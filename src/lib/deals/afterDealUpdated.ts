import type { Deal, Venue } from '@/types'
import { syncDealCalendarSideEffects } from '@/lib/calendar/queueGigCalendarEmails'
import { reverseSyncDealTimesToIntakeShow } from '@/lib/intake/reverseSyncDealTimesToIntakeShow'

type VenueStatus = Pick<Venue, 'status'> | null | undefined

/**
 * Single post-save hook: artist calendar emails, Google Calendar push, gig reminders,
 * and reverse-sync of wall times onto any linked intake show.
 */
export async function afterDealUpdated(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
  venueBefore: VenueStatus
  venueAfter: VenueStatus
  artistEmail: string | null | undefined
}): Promise<void> {
  await syncDealCalendarSideEffects({
    beforeDeal: args.beforeDeal,
    afterDeal: args.afterDeal,
    venueBefore: args.venueBefore,
    venueAfter: args.venueAfter,
    artistEmail: args.artistEmail,
  })
  await reverseSyncDealTimesToIntakeShow(args.afterDeal)
}
