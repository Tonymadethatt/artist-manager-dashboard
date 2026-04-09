/**
 * V1 performance report extensions: answer → automation matrix (server: submit-performance-report.ts).
 * Do not add fields without a defined effect there.
 *
 * Matrix (v1):
 * - artistPaidStatus=no (played) → task "Chase payment — {venue}" (high, today) + optional payment_reminder email
 * - artistPaidStatus=partial (played) → task "Follow up remaining balance — {venue}" (high, today); no auto payment_reminder email
 * - paymentDispute=yes (played) → task "Payment discrepancy — {venue}" (medium, today)
 * - productionIssueLevel=serious (played) → task "Production / safety follow-up — {venue}" (high, today)
 * - venueInterest=yes → venue_emails rebooking_inquiry OR find-contact task; re-engage task; task "Schedule rebooking call — {venue}" (+2d)
 * - referralLead=yes → task "Capture referral lead — {venue}" (medium, +5d)
 * - venueInterest≠yes → single follow-up task "Performance report follow-up" (+7d played, +3d cancelled/postponed)
 * - venue status: interest=yes → rebooking; played && poor+no interest → closed_lost; else post_follow_up
 * - cancellationReason → outreach note line; played-only money/production fields null in DB
 * - merchIncome=yes + merchIncomeAmount → structured note / outreach line only (no separate DB column)
 * - feeTotal + amountReceived → performance_reports.fee_total / amount_received; commission reconciliation vs deals.gross_amount
 */

export type ChasePaymentFollowup = 'no' | 'unsure' | 'yes'
export type YesNo = 'no' | 'yes'
export type ProductionIssueLevel = 'none' | 'minor' | 'serious'
export type RebookingTimeline = 'this_month' | 'this_quarter' | 'later' | 'not_discussed'
export type WouldPlayAgain = 'yes' | 'maybe' | 'no'
export type CancellationReason =
  | 'venue_cancelled'
  | 'weather'
  | 'low_turnout'
  | 'illness'
  | 'logistics'
  | 'other'

export const PRODUCTION_FRICTION_OPTIONS = [
  { id: 'sound', label: 'Sound / audio' },
  { id: 'load_in', label: 'Load-in & parking' },
  { id: 'staff', label: 'Staff & hospitality' },
  { id: 'stage', label: 'Stage & lights' },
  { id: 'crowd', label: 'Crowd / room energy' },
] as const

export type ProductionFrictionId = (typeof PRODUCTION_FRICTION_OPTIONS)[number]['id']

/** Midpoint of attendance band for metrics row (must be > 0 for metric insert). */
export const ATTENDANCE_BAND_TO_NUMBER: Record<string, number> = {
  under_50: 40,
  '50_150': 100,
  '150_300': 225,
  '300_500': 400,
  over_500: 600,
  skip: 0,
}

export function timelineToReengageDays(t: RebookingTimeline | null | undefined): number {
  switch (t) {
    case 'this_month':
      return 7
    case 'this_quarter':
      return 21
    case 'later':
      return 45
    case 'not_discussed':
    default:
      return 3
  }
}

export const CANCELLATION_REASON_LABELS: Record<CancellationReason, string> = {
  venue_cancelled: 'Venue cancelled or pulled the show',
  weather: 'Weather / safety',
  low_turnout: 'Low turnout / ticket sales',
  illness: 'Illness or emergency',
  logistics: 'Travel or logistics',
  other: 'Something else',
}

const FRICTION_LABEL_BY_ID = Object.fromEntries(
  PRODUCTION_FRICTION_OPTIONS.map(o => [o.id, o.label])
) as Record<string, string>

export function formatFrictionTagsForNote(ids: string[]): string {
  return ids.map(id => FRICTION_LABEL_BY_ID[id]).filter(Boolean).join(', ')
}
