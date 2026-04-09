import type { VenueEmailOneTapAckKind } from './kinds'

export type OneTapThanksCopy = { heading: string; lines: string[] }

export function oneTapThanksAlreadyReceived(): OneTapThanksCopy {
  return {
    heading: 'Thanks',
    lines: ['We already have your confirmation on file.'],
  }
}

/** Thank-you page copy keyed by one-tap acknowledgment kind (first successful click only). */
export function oneTapThanksForKind(
  kind: VenueEmailOneTapAckKind,
  alreadyReceived: boolean,
): OneTapThanksCopy {
  if (alreadyReceived) return oneTapThanksAlreadyReceived()

  switch (kind) {
    case 'payment_reminder_ack':
      return {
        heading: 'Thank you',
        lines: [
          "We've noted that payment may be on the way.",
          "Our team will confirm receipt on our end — you don't need to do anything else here.",
        ],
      }
    case 'invoice_sent':
      return {
        heading: 'Thank you',
        lines: ["We've recorded that you reviewed the invoice."],
      }
    case 'booking_confirmation':
      return {
        heading: 'Thank you',
        lines: ["We've received your confirmation of the booking details."],
      }
    case 'booking_confirmed':
      return {
        heading: 'Thank you',
        lines: ["We've recorded your confirmation."],
      }
  }
}

type TaskRow = { deal_id: string | null; token_id: string }

export function oneTapTaskSpec(
  kind: VenueEmailOneTapAckKind,
  venueName: string,
  row: TaskRow,
): { title: string; notes: string; priority: 'low' | 'medium' | 'high' } {
  const dealLine = row.deal_id ? `deal_id: ${row.deal_id}` : 'deal_id: (none)'
  const baseNotes = `Created from venue email one-tap acknowledgment.\nemail_capture_token_id: ${row.token_id}\n${dealLine}\nVerify on your end — venue self-service only.`

  if (kind === 'payment_reminder_ack') {
    return {
      title: `Verify payment — ${venueName}`,
      notes: `${baseNotes}\n\nVenue indicated they may have sent payment — confirm receipt outside this system.`,
      priority: 'high',
    }
  }
  if (kind === 'invoice_sent') {
    return {
      title: `Verify invoice acknowledgment — ${venueName}`,
      notes: `${baseNotes}\n\nVenue confirmed they reviewed the invoice.`,
      priority: 'medium',
    }
  }
  if (kind === 'booking_confirmed') {
    return {
      title: `Booking confirmed — ${venueName}`,
      notes: `${baseNotes}\n\nVenue confirmed the booking via email link.`,
      priority: 'medium',
    }
  }
  return {
    title: `Verify booking confirmation — ${venueName}`,
    notes: `${baseNotes}\n\nVenue confirmed details via email link.`,
    priority: 'medium',
  }
}

export function oneTapOutreachNote(kind: VenueEmailOneTapAckKind, venueName: string): string {
  if (kind === 'payment_reminder_ack') {
    return `[Email] ${venueName} tapped "Payment sent" — verify funds.`
  }
  if (kind === 'invoice_sent') {
    return `[Email] ${venueName} confirmed invoice reviewed.`
  }
  if (kind === 'booking_confirmed') {
    return `[Email] ${venueName} confirmed the booking via link.`
  }
  return `[Email] ${venueName} confirmed booking details via link.`
}
