import { supabase } from '@/lib/supabase'
import type { Deal, Venue } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS } from '@/types'
import { backfillDealShowInstantsIfNeeded } from '@/lib/calendar/backfillDealShowInstants'
import { gigReminderScheduledSendAtIso, gigReminderSendAtMs } from '@/lib/calendar/gigReminderSchedule'
import {
  canInsertPendingGigBookedIcs,
  dealQualifiesForCalendar,
  shouldQueueArtistGigBookedConfirmation,
} from '@/lib/calendar/gigCalendarRules'
import {
  shouldRunGoogleCalendarDealPush,
  syncDealToGoogleSharedCalendar,
} from '@/lib/calendar/googleCalendarDealPushClient'

type VenueStatus = Pick<Venue, 'status'> | null | undefined

/**
 * After a deal is saved: queue artist “gig booked” confirmation email on first calendar qualification
 * (no .ics attachment — shared calendar is updated separately); reconcile 24h reminder row.
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

  const queueBookedConfirmation = shouldQueueArtistGigBookedConfirmation({
    beforeDeal,
    afterDeal,
    venueBefore,
    venueAfter,
  })

  if (queueBookedConfirmation) {
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
    const sendAt = gigReminderSendAtMs(afterDeal.event_start_at)
    const schedIso = gigReminderScheduledSendAtIso(afterDeal.event_start_at)
    if (sendAt != null && sendAt > Date.now() && schedIso) {
      await supabase.from('venue_emails').insert({
        user_id: afterDeal.user_id,
        venue_id: afterDeal.venue_id,
        deal_id: afterDeal.id,
        contact_id: null,
        email_type: 'gig_reminder_24h',
        recipient_email: artistEmail.trim(),
        subject: ARTIST_EMAIL_TYPE_LABELS.gig_reminder_24h,
        status: 'pending',
        scheduled_send_at: schedIso,
        notes: JSON.stringify({ kind: 'gig_reminder_24h' as const, dealId: afterDeal.id }),
      })
      await supabase
        .from('deals')
        .update({ reminder_24h_queued_at: new Date().toISOString() })
        .eq('id', afterDeal.id)
    }
  }
}

/**
 * Idempotent: if the deal is calendar-qualified and the booked confirmation email not yet sent, queue `gig_booked_ics`;
 * reconcile pending `gig_reminder_24h`. Use when qualification can happen without an Earnings save
 * (e.g. task completion or venue status change).
 *
 * Requires the parent venue to use a calendar-eligible status (e.g. booked); see `promoteVenueForCalendarDeal`.
 */
export async function ensureDealCalendarEmailsQueued(dealId: string): Promise<void> {
  await backfillDealShowInstantsIfNeeded(dealId)

  const { data: dealRow, error: dErr } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .maybeSingle()
  if (dErr || !dealRow) return
  const afterDeal = dealRow as Deal

  let venueAfter: VenueStatus = null
  if (afterDeal.venue_id) {
    const { data: v } = await supabase
      .from('venues')
      .select('id,status')
      .eq('id', afterDeal.venue_id)
      .maybeSingle()
    venueAfter = v as Pick<Venue, 'status'> | null
  }

  const { data: profileRow } = await supabase
    .from('artist_profile')
    .select('artist_email')
    .eq('user_id', afterDeal.user_id)
    .maybeSingle()
  const artistEmail = (profileRow as { artist_email?: string | null } | null)?.artist_email

  if (artistEmail?.trim()) {
    if (canInsertPendingGigBookedIcs(afterDeal, venueAfter)) {
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
      const sendAt = gigReminderSendAtMs(afterDeal.event_start_at)
      const schedIso = gigReminderScheduledSendAtIso(afterDeal.event_start_at)
      if (sendAt != null && sendAt > Date.now() && schedIso) {
        await supabase.from('venue_emails').insert({
          user_id: afterDeal.user_id,
          venue_id: afterDeal.venue_id,
          deal_id: afterDeal.id,
          contact_id: null,
          email_type: 'gig_reminder_24h',
          recipient_email: artistEmail.trim(),
          subject: ARTIST_EMAIL_TYPE_LABELS.gig_reminder_24h,
          status: 'pending',
          scheduled_send_at: schedIso,
          notes: JSON.stringify({ kind: 'gig_reminder_24h' as const, dealId: afterDeal.id }),
        })
        await supabase
          .from('deals')
          .update({ reminder_24h_queued_at: new Date().toISOString() })
          .eq('id', afterDeal.id)
      }
    }
  }

  if (
    shouldRunGoogleCalendarDealPush({
      beforeDeal: null,
      afterDeal,
      venueAfter: venueAfter,
    })
  ) {
    await syncDealToGoogleSharedCalendar(dealId)
  }
}

export async function ensureCalendarEmailsForVenueDeals(venueId: string): Promise<void> {
  const { data: deals } = await supabase.from('deals').select('id').eq('venue_id', venueId)
  for (const d of deals ?? []) {
    await ensureDealCalendarEmailsQueued(d.id as string)
  }
}

/**
 * After a deal save: ICS/reminder email queue + shared Google Calendar event for the gig.
 */
export async function syncDealCalendarSideEffects(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
  venueBefore: VenueStatus
  venueAfter: VenueStatus
  artistEmail: string | null | undefined
}): Promise<void> {
  await syncDealCalendarEmails(args)
  if (
    shouldRunGoogleCalendarDealPush({
      beforeDeal: args.beforeDeal,
      afterDeal: args.afterDeal,
      venueAfter: args.venueAfter,
    })
  ) {
    await syncDealToGoogleSharedCalendar(args.afterDeal.id)
  }
}
