import type { BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'
import { FOLLOW_UP_TOPIC_LABELS, type FollowUpTopicKeyV3 } from '@/lib/intake/intakePayloadV3'

/** Activity log entry when operator ends live call (existing Outreach venue only). */
export function buildEndCallOutreachNote(
  data: BookingIntakeVenueDataV3,
  opts: { callEndedAtIso: string; intakeTitle: string; intakeId: string },
): string {
  const lines: string[] = []
  lines.push(`[Booking intake] ${opts.intakeTitle}`)
  lines.push(`Intake id: ${opts.intakeId}`)
  lines.push(`Call ended: ${new Date(opts.callEndedAtIso).toLocaleString()}`)
  if (data.suggested_outreach_status) {
    lines.push(`Suggested venue status: ${data.suggested_outreach_status}`)
  }
  if (data.follow_up_date.trim()) {
    lines.push(`Follow-up date: ${data.follow_up_date.trim()}`)
  }
  if (data.follow_up_topics.length) {
    lines.push(
      `Follow-up topics: ${data.follow_up_topics.map(t => FOLLOW_UP_TOPIC_LABELS[t as FollowUpTopicKeyV3]).join('; ')}`,
    )
  }
  if (data.post_call_notes.trim()) {
    lines.push(`Call notes: ${data.post_call_notes.trim()}`)
  }
  if (data.future_intel.trim()) {
    lines.push(`Intel: ${data.future_intel.trim()}`)
  }
  if (data.red_flags.trim()) {
    lines.push(`Concerns: ${data.red_flags.trim()}`)
  }
  return lines.join('\n').slice(0, 8000)
}

export function buildVenueImportOutreachNote(opts: {
  intakeTitle: string
  intakeId: string
  venueName: string
  isNewVenue: boolean
}): string {
  const action = opts.isNewVenue ? 'Created venue from intake' : 'Updated venue + synced contacts from intake'
  return [`[Booking intake] ${action}`, `Intake: ${opts.intakeTitle} (${opts.intakeId})`, `Venue: ${opts.venueName}`]
    .join('\n')
    .slice(0, 8000)
}
