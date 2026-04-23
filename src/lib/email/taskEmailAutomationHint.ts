import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { VENUE_EMAIL_TYPE_LABELS, type VenueEmailType } from '@/types'

function isBuiltinVenueEmailType(emailType: string): emailType is VenueEmailType {
  return Object.prototype.hasOwnProperty.call(VENUE_EMAIL_TYPE_LABELS, emailType)
}

/** Static hint from `email_type` (builtin or unknown custom id shape). */
export function taskEmailAutomationHint(emailType: string): string | null {
  if (!emailType || emailType === '__none__') return null

  if (emailType === 'performance_report_request') {
    return 'Requires a linked venue or deal with a venue. Email goes to the venue contact (performance form link).'
  }

  if (emailType === 'booking_commission_reminder') {
    return 'Not auto-queued from tasks yet. Use Email Templates to edit, preview, and send a test.'
  }

  if (
    emailType === 'management_report'
    || emailType === 'retainer_reminder'
    || emailType === 'retainer_received'
  ) {
    return 'Sent to your artist email when you complete the task. No venue required.'
  }

  if (parseCustomTemplateId(emailType)) return null

  if (isBuiltinVenueEmailType(emailType)) {
    return 'Requires a venue with a contact email when you complete the task.'
  }

  return null
}

/** Include custom template audience when `email_type` is `custom:…`. */
export function taskEmailAutomationHintWithCustom(
  emailType: string,
  customAudience: 'venue' | 'artist' | 'lead' | null | undefined,
): string | null {
  if (!emailType || emailType === '__none__') return null
  if (parseCustomTemplateId(emailType)) {
    if (customAudience === 'artist') {
      return 'Sent to your artist email when you complete the task. No venue required.'
    }
    if (customAudience === 'venue') {
      return 'Requires a venue with a contact email when you complete the task.'
    }
    if (customAudience === 'lead') {
      return 'Lead template: not auto-queued from tasks until a lead is linked on the task. Send from Lead Intake when that flow is connected.'
    }
    return null
  }
  return taskEmailAutomationHint(emailType)
}
