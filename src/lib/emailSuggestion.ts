import type { Venue, Deal, Contact, VenueEmail, VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

export interface EmailSuggestion {
  type: VenueEmailType
  label: string
  reason: string
}

/**
 * Pure function — reads current venue/deal/contact/email state and returns
 * the single most logical next email to send, or null if nothing is needed.
 * Priority: first match wins.
 */
export function getNextEmailSuggestion(
  venue: Venue,
  deals: Deal[],
  contacts: Contact[],
  sentEmails: VenueEmail[]
): EmailSuggestion | null {
  const today = new Date().toISOString().split('T')[0]
  const primaryContact = contacts.find(c => c.email) ?? null
  if (!primaryContact?.email) return null

  const hasSent = (type: VenueEmailType) =>
    sentEmails.some(e => e.email_type === type && e.status === 'sent')

  const venueDeals = deals.filter(d => d.venue_id === venue.id)

  // 1. Booked but booking confirmation not yet sent
  if (venue.status === 'booked' && !hasSent('booking_confirmation')) {
    return {
      type: 'booking_confirmation',
      label: VENUE_EMAIL_TYPE_LABELS.booking_confirmation,
      reason: 'Venue is booked — send the booking confirmation email.',
    }
  }

  // 2. Agreement URL exists but agreement_ready not yet sent
  const dealWithAgreement = venueDeals.find(d => d.agreement_url)
  if (dealWithAgreement && !hasSent('agreement_ready')) {
    return {
      type: 'agreement_ready',
      label: VENUE_EMAIL_TYPE_LABELS.agreement_ready,
      reason: 'Agreement is ready to share.',
    }
  }

  // 3. Payment overdue and unpaid
  const overdueDeal = venueDeals.find(
    d => d.payment_due_date && d.payment_due_date < today && !d.artist_paid
  )
  if (overdueDeal) {
    return {
      type: 'payment_reminder',
      label: VENUE_EMAIL_TYPE_LABELS.payment_reminder,
      reason: `Payment due date has passed (${overdueDeal.payment_due_date}).`,
    }
  }

  // 4. Follow-up date passed and still in early stages
  const isOpen = venue.status === 'reached_out' || venue.status === 'in_discussion'
  if (isOpen && venue.follow_up_date && venue.follow_up_date <= today) {
    return {
      type: 'follow_up',
      label: VENUE_EMAIL_TYPE_LABELS.follow_up,
      reason: `Follow-up was due ${venue.follow_up_date === today ? 'today' : 'on ' + venue.follow_up_date}.`,
    }
  }

  // 5. Artist paid — send receipt if not yet sent
  const paidDeal = venueDeals.find(d => d.artist_paid)
  if (paidDeal && !hasSent('payment_receipt')) {
    return {
      type: 'payment_receipt',
      label: VENUE_EMAIL_TYPE_LABELS.payment_receipt,
      reason: 'Deal was marked paid — send a receipt.',
    }
  }

  return null
}
