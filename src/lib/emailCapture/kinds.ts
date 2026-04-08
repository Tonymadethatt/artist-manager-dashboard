import type { VenueEmailType } from '../../types'

/** Rows in `email_capture_tokens.kind` (DB check constraint). */
export type EmailCaptureKind =
  | 'pre_event_checkin'
  | 'first_outreach'
  | 'follow_up'
  | 'show_cancelled_or_postponed'
  | 'agreement_followup'
  | 'booking_confirmation'
  | 'booking_confirmed'
  | 'invoice_sent'
  | 'post_show_thanks'
  | 'pass_for_now'
  | 'rebooking_inquiry'
  | 'agreement_ready'
  | 'payment_reminder_ack'
  | 'payment_receipt'

const CAPTURE_KIND_SET = new Set<string>([
  'pre_event_checkin',
  'first_outreach',
  'follow_up',
  'show_cancelled_or_postponed',
  'agreement_followup',
  'booking_confirmation',
  'booking_confirmed',
  'invoice_sent',
  'post_show_thanks',
  'pass_for_now',
  'rebooking_inquiry',
  'agreement_ready',
  'payment_reminder_ack',
  'payment_receipt',
])

export function isEmailCaptureKind(s: string): s is EmailCaptureKind {
  return CAPTURE_KIND_SET.has(s)
}

/** Builtin venue email types that get a capture link (custom templates excluded). */
export function venueEmailTypeToCaptureKind(t: VenueEmailType): EmailCaptureKind | null {
  switch (t) {
    case 'payment_reminder':
      return 'payment_reminder_ack'
    case 'payment_receipt':
      return 'payment_receipt'
    case 'pre_event_checkin':
    case 'first_outreach':
    case 'follow_up':
    case 'show_cancelled_or_postponed':
    case 'agreement_followup':
    case 'booking_confirmation':
    case 'invoice_sent':
    case 'post_show_thanks':
    case 'pass_for_now':
    case 'rebooking_inquiry':
    case 'agreement_ready':
      return t
    default:
      return null
  }
}

/** Dashboard / history labels (manager-facing). */
export const EMAIL_CAPTURE_KIND_LABELS: Record<EmailCaptureKind, string> = {
  pre_event_checkin: 'Pre-event logistics',
  first_outreach: 'First outreach reply',
  follow_up: 'Follow-up reply',
  show_cancelled_or_postponed: 'Show cancelled / postponed',
  agreement_followup: 'Agreement follow-up',
  booking_confirmation: 'Booking confirmation',
  booking_confirmed: 'Booking confirmed',
  invoice_sent: 'Invoice',
  post_show_thanks: 'Post-show',
  pass_for_now: 'Pass acknowledged',
  rebooking_inquiry: 'Rebooking',
  agreement_ready: 'Agreement ready',
  payment_reminder_ack: 'Payment reminder',
  payment_receipt: 'Payment receipt — rebook interest',
}

/** Public capture form — centered title (shorter than dashboard labels). */
export const EMAIL_CAPTURE_KIND_FORM_TITLES: Record<EmailCaptureKind, string> = {
  pre_event_checkin: 'Pre-event details',
  first_outreach: 'Your reply',
  follow_up: 'Follow-up',
  show_cancelled_or_postponed: 'Show update',
  agreement_followup: 'Agreement follow-up',
  agreement_ready: 'Agreement ready',
  booking_confirmation: 'Confirm booking',
  booking_confirmed: 'Booking confirmed',
  invoice_sent: 'Invoice details',
  post_show_thanks: 'Post-show feedback',
  pass_for_now: 'Thanks for letting us know',
  rebooking_inquiry: 'Rebooking',
  payment_reminder_ack: 'Payment status',
  payment_receipt: 'Payment receipt',
}

/** Eyebrow / descriptor under the title. */
export const EMAIL_CAPTURE_KIND_FORM_DESCRIPTORS: Record<EmailCaptureKind, string> = {
  pre_event_checkin: 'Logistics for your date — takes about a minute',
  first_outreach: 'Let the team know where things stand',
  follow_up: 'Quick check-in on the conversation',
  show_cancelled_or_postponed: 'What should we know about the change',
  agreement_followup: 'Paperwork or terms follow-up',
  agreement_ready: 'Confirm or flag anything on the agreement',
  booking_confirmation: 'Lock in the details we sent',
  booking_confirmed: 'Acknowledge the confirmed date',
  invoice_sent: 'Confirm you received the invoice',
  post_show_thanks: 'How was the night?',
  pass_for_now: 'Acknowledge — no pressure',
  rebooking_inquiry: 'Share timing if you want another date',
  payment_reminder_ack: 'Update payment status',
  payment_receipt: 'Next steps after payment',
}

export function captureLinkLabel(kind: EmailCaptureKind): string {
  switch (kind) {
    case 'pre_event_checkin':
      return 'Logistics form'
    case 'first_outreach':
    case 'follow_up':
      return 'Respond'
    case 'show_cancelled_or_postponed':
      return 'Send update'
    case 'agreement_followup':
    case 'agreement_ready':
      return 'Agreement reply'
    case 'booking_confirmation':
    case 'booking_confirmed':
      return 'Confirm details'
    case 'invoice_sent':
      return 'Confirm invoice'
    case 'post_show_thanks':
      return 'Send feedback'
    case 'pass_for_now':
      return 'Acknowledge'
    case 'rebooking_inquiry':
      return 'Share dates'
    case 'payment_reminder_ack':
      return 'Payment status'
    case 'payment_receipt':
      return 'Next steps'
    default:
      return 'Open form'
  }
}
