import { supabase } from '@/lib/supabase'
import type { Deal, Venue } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS } from '@/types'
import { calendarQualificationFirstTouch, dealQualifiesForCalendar } from '@/lib/calendar/gigCalendarRules'

type VenueStatus = Pick<Venue, 'status'> | null | undefined

function beforePatch(
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

/**
 * After a deal is saved: queue ICS on first calendar qualification; reconcile 24h reminder row.
 */
export async function syncDealCalendarEmails(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
  venueBefore: VenueStatus
  venueAfter: VenueStatus
  artistEmail: string | null | undefined
}): Promise<void> {
  const { beforeDeal, afterDeal, venueBefore, venueAfter, artistEmail } = args
  if (!artistEmail?.trim()) return

  const before = beforePatch(beforeDeal)
  const after = {
    venue_id: afterDeal.venue_id,
    event_start_at: afterDeal.event_start_at,
    event_end_at: afterDeal.event_end_at,
    event_cancelled_at: afterDeal.event_cancelled_at ?? null,
  }

  const icsFirst =
    calendarQualificationFirstTouch({ before, after, venueBefore, venueAfter }) &&
    !afterDeal.ics_invite_sent_at

  if (icsFirst) {
    const { data: pending } = await supabase
      .from('venue_emails')
      .select('id')
      .eq('deal_id', afterDeal.id)
      .eq('email_type', 'gig_booked_ics')
      .eq('status', 'pending')
      .maybeSingle()
    if (!pending) {
      await supabase.from('venue_emails').insert({
        user_id: afterDeal.user_id,
        venue_id: afterDeal.venue_id,
        deal_id: afterDeal.id,
        contact_id: null,
        email_type: 'gig_booked_ics',
        recipient_email: artistEmail.trim(),
        subject: ARTIST_EMAIL_TYPE_LABELS.gig_booked_ics,
        status: 'pending',
        scheduled_send_at: null,
        notes: JSON.stringify({ kind: 'gig_booked_ics' as const, dealId: afterDeal.id }),
      })
    }
  }

  await supabase
    .from('venue_emails')
    .delete()
    .eq('deal_id', afterDeal.id)
    .eq('email_type', 'gig_reminder_24h')
    .eq('status', 'pending')

  if (dealQualifiesForCalendar(afterDeal, venueAfter) && afterDeal.event_start_at) {
    const startMs = new Date(afterDeal.event_start_at).getTime()
    const sendAt = startMs - 24 * 60 * 60 * 1000
    if (sendAt > Date.now()) {
      await supabase.from('venue_emails').insert({
        user_id: afterDeal.user_id,
        venue_id: afterDeal.venue_id,
        deal_id: afterDeal.id,
        contact_id: null,
        email_type: 'gig_reminder_24h',
        recipient_email: artistEmail.trim(),
        subject: ARTIST_EMAIL_TYPE_LABELS.gig_reminder_24h,
        status: 'pending',
        scheduled_send_at: new Date(sendAt).toISOString(),
        notes: JSON.stringify({ kind: 'gig_reminder_24h' as const, dealId: afterDeal.id }),
      })
      await supabase
        .from('deals')
        .update({ reminder_24h_queued_at: new Date().toISOString() })
        .eq('id', afterDeal.id)
    }
  }
}
