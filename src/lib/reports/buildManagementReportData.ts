import type { Deal, Metric, MonthlyFee, PerformanceReport, Task, Venue } from '../../types'

/** Body.report shape for `/.netlify/functions/send-report`. */
export type ManagementReportEmailData = {
  outreach: {
    venuesContacted: number
    venuesUpdated: number
    inDiscussion: number
    venuesBooked: number
    pipelineAdded: number
    communityAdded: number
    pipelineBooked: number
    communityBooked: number
    /** Distinct leads with at least one outbound email logged in the period (Lead Intake). */
    leadsReached: number
    /** Total lead outbound emails with `sent` status in the period (can exceed leadsReached). */
    leadEmailsSent: number
  }
  /**
   * Artist booking gross from logged deals (not manager commission).
   * `grossBookedInPeriod` / `dealsBookedInPeriod` use deal created_at in range.
   * `grossArtistPaidInPeriod` uses artist_paid_date in range when artist_paid (operational toggle accuracy).
   */
  artistEarnings: {
    grossBookedInPeriod: number
    dealsBookedInPeriod: number
    grossArtistPaidInPeriod: number
    dealsArtistPaidInPeriod: number
    /** Period deals with linked pipeline venue (or community venue excluded from these two) */
    grossPipelineBooked: number
    grossCommunityBooked: number
    /** Period deals with no venue_id / missing embed */
    grossUnlinkedBooked: number
  }
  deals: {
    count: number
    /** Same as artistEarnings.grossBookedInPeriod; kept for backward compatibility. */
    totalGross: number
    totalCommission: number
    commissionEarned: number
    commissionReceived: number
    allOutstanding: number
  }
  retainer: {
    feeTotal: number
    feePaid: number
    feeOutstanding: number
    unpaidMonths: number
  }
  metrics: {
    partnerships: number
    partnershipValue: number
    attendance: number
    totalAttendance: number
    press: number
    totalReach: number
  }
  tasks: { completedTasks: number }
  performance?: {
    showsPerformed: number
    rebookingLeads: number
    avgRating: number | null
    totalAttendance: number
  }
}

function toRangeDate(isoDay: string) {
  return new Date(isoDay + 'T00:00:00')
}

/** Last N days ending on `endDay` (YYYY-MM-DD), inclusive. Matches Reports “7d” preset intent. */
export function computeRollingReportDateRange(endDay: string, days: number): { start: string; end: string } {
  const end = toRangeDate(endDay)
  const start = new Date(end)
  start.setDate(start.getDate() - (days - 1))
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    start: `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`,
    end: endDay,
  }
}

/** Default when a queued management report sends: rolling 7 days ending today (local calendar day). */
export function defaultQueuedManagementReportDateRange(): { start: string; end: string } {
  const end = new Date().toISOString().split('T')[0]
  return computeRollingReportDateRange(end, 7)
}

export function buildManagementReportData(
  input: {
    venues: Venue[]
    deals: Deal[]
    metrics: Metric[]
    fees: MonthlyFee[]
    tasks: Task[]
    perfReports: PerformanceReport[]
    /** Sent lead emails (`lead_email_events`); used for Lead Intake outreach stats. */
    leadEmailEvents?: { lead_id: string; sent_at: string }[]
  },
  startDate: string,
  endDate: string,
): ManagementReportEmailData {
  const inRange = (dateStr: string) => {
    const d = toRangeDate(dateStr)
    return d >= toRangeDate(startDate) && d <= toRangeDate(endDate)
  }

  const { venues, deals, metrics, fees, tasks, perfReports, leadEmailEvents: leadEmailEventsRaw } = input
  const leadEmailEvents = leadEmailEventsRaw ?? []
  const leadSentInPeriod = leadEmailEvents.filter(e => {
    if (!e.sent_at) return false
    const day = e.sent_at.split('T')[0]
    return inRange(day)
  })
  const leadEmailsSent = leadSentInPeriod.length
  const leadsReached = new Set(leadSentInPeriod.map(e => e.lead_id)).size

  const pipelineVenues = venues.filter(v => (v.outreach_track ?? 'pipeline') === 'pipeline')
  const communityVenues = venues.filter(v => v.outreach_track === 'community')
  const venuesContacted = venues.filter(v => inRange(v.created_at)).length
  const pipelineAdded = pipelineVenues.filter(v => inRange(v.created_at)).length
  const communityAdded = communityVenues.filter(v => inRange(v.created_at)).length
  const venuesUpdated = venues.filter(v =>
    v.status !== 'not_contacted' && inRange(v.updated_at),
  ).length
  const venuesBooked = venues.filter(v => v.status === 'booked' && inRange(v.updated_at)).length
  const pipelineBooked = pipelineVenues.filter(v => v.status === 'booked' && inRange(v.updated_at)).length
  const communityBooked = communityVenues.filter(v => v.status === 'booked' && inRange(v.updated_at)).length
  const inDiscussion = venues.filter(v =>
    ['in_discussion', 'agreement_sent'].includes(v.status) && inRange(v.updated_at),
  ).length

  const periodDeals = deals.filter(d => inRange(d.created_at))
  const totalGross = periodDeals.reduce((s, d) => s + d.gross_amount, 0)
  const dealTrack = (d: Deal) => {
    if (!d.venue_id || !d.venue) return 'unlinked' as const
    return (d.venue.outreach_track ?? 'pipeline') === 'community' ? 'community' as const : 'pipeline' as const
  }
  const grossPipelineBooked = periodDeals.filter(d => dealTrack(d) === 'pipeline').reduce((s, d) => s + d.gross_amount, 0)
  const grossCommunityBooked = periodDeals.filter(d => dealTrack(d) === 'community').reduce((s, d) => s + d.gross_amount, 0)
  const grossUnlinkedBooked = periodDeals.filter(d => dealTrack(d) === 'unlinked').reduce((s, d) => s + d.gross_amount, 0)

  const paidInPeriodDeals = deals.filter(
    d => d.artist_paid && d.artist_paid_date && inRange(d.artist_paid_date),
  )
  const grossArtistPaidInPeriod = paidInPeriodDeals.reduce((s, d) => s + d.gross_amount, 0)

  const totalCommission = periodDeals.reduce((s, d) => s + d.commission_amount, 0)
  const commissionEarned = deals
    .filter(d => d.artist_paid && d.artist_paid_date && inRange(d.artist_paid_date))
    .reduce((s, d) => s + d.commission_amount, 0)
  const commissionReceived = deals
    .filter(d => d.manager_paid && d.manager_paid_date && inRange(d.manager_paid_date))
    .reduce((s, d) => s + d.commission_amount, 0)
  const allOutstanding = deals
    .filter(d => d.artist_paid && !d.manager_paid)
    .reduce((s, d) => s + d.commission_amount, 0)

  const feeTotal = fees.reduce((s, f) => s + f.amount, 0)
  const feePaid = fees.reduce((s, f) => s + (f.payments ?? []).reduce((p, pay) => p + pay.amount, 0), 0)
  const feeOutstanding = feeTotal - feePaid
  const unpaidMonths = fees.filter(f => {
    const paid = (f.payments ?? []).reduce((ps, p) => ps + p.amount, 0)
    return paid < f.amount
  }).length

  const periodMetrics = metrics.filter(m => inRange(m.date))
  const partnerships = periodMetrics.filter(m => m.category === 'brand_partnership')
  const partnershipValue = partnerships.reduce((s, m) => s + (m.numeric_value ?? 0), 0)
  const attendance = periodMetrics.filter(m => m.category === 'event_attendance')
  const totalAttendance = attendance.reduce((s, m) => s + (m.numeric_value ?? 0), 0)
  const press = periodMetrics.filter(m => m.category === 'press_mention')
  const totalReach = press.reduce((s, m) => s + (m.numeric_value ?? 0), 0)

  const completedTasks = tasks.filter(t =>
    t.completed && t.completed_at && inRange(t.completed_at.split('T')[0]),
  ).length

  const perfInPeriod = perfReports.filter(
    r => r.submitted && r.submitted_at && inRange(r.submitted_at.split('T')[0]),
  )
  const showsPerformed = perfInPeriod.length
  const rebookingLeads = perfInPeriod.filter(r => r.venue_interest === 'yes').length
  const ratedShows = perfInPeriod.filter(r => r.event_rating !== null)
  const avgRating = ratedShows.length > 0
    ? Math.round((ratedShows.reduce((s, r) => s + (r.event_rating ?? 0), 0) / ratedShows.length) * 10) / 10
    : null
  const totalReportedAttendance = perfInPeriod.reduce((s, r) => s + (r.attendance ?? 0), 0)

  const report: ManagementReportEmailData = {
    outreach: {
      venuesContacted,
      venuesUpdated,
      inDiscussion,
      venuesBooked,
      pipelineAdded,
      communityAdded,
      pipelineBooked,
      communityBooked,
      leadsReached,
      leadEmailsSent,
    },
    artistEarnings: {
      grossBookedInPeriod: totalGross,
      dealsBookedInPeriod: periodDeals.length,
      grossArtistPaidInPeriod,
      dealsArtistPaidInPeriod: paidInPeriodDeals.length,
      grossPipelineBooked,
      grossCommunityBooked,
      grossUnlinkedBooked,
    },
    deals: {
      count: periodDeals.length,
      totalGross,
      totalCommission,
      commissionEarned,
      commissionReceived,
      allOutstanding,
    },
    retainer: { feeTotal, feePaid, feeOutstanding, unpaidMonths },
    metrics: {
      partnerships: partnerships.length,
      partnershipValue,
      attendance: attendance.length,
      totalAttendance,
      press: press.length,
      totalReach,
    },
    tasks: { completedTasks },
  }

  if (showsPerformed > 0 || rebookingLeads > 0 || avgRating !== null || totalReportedAttendance > 0) {
    report.performance = {
      showsPerformed,
      rebookingLeads,
      avgRating,
      totalAttendance: totalReportedAttendance,
    }
  }

  return report
}

const REMINDER_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const

function fmtReminderMonth(dateStr: string) {
  const [y, m] = dateStr.split('-')
  return `${REMINDER_MONTHS[parseInt(m, 10) - 1]} ${y}`
}

export type RetainerReminderFeeRow = { month: string; owed: number; paid: number; balance: number }

export function buildRetainerReminderPayload(fees: MonthlyFee[]): {
  unpaidFees: RetainerReminderFeeRow[]
  totalOutstanding: number
} {
  const feesWithTotals = fees.map(f => {
    const totalPaid = (f.payments ?? []).reduce((s, p) => s + p.amount, 0)
    return { ...f, totalPaid, balance: f.amount - totalPaid }
  })
  const unpaidFees = feesWithTotals
    .filter(f => f.balance > 0)
    .map(f => ({
      month: fmtReminderMonth(f.month),
      owed: f.amount,
      paid: f.totalPaid,
      balance: f.balance,
    }))
  const totalOutstanding = feesWithTotals.reduce((s, f) => s + f.balance, 0)
  return { unpaidFees, totalOutstanding }
}

export type RetainerReceivedFeeRow = { month: string; invoiced: number; paid: number }

/** Months with a positive invoice that are paid in full (balance <= 0). */
export function buildRetainerReceivedPayload(fees: MonthlyFee[]): {
  settledFees: RetainerReceivedFeeRow[]
  totalAcknowledged: number
} {
  const feesWithTotals = fees.map(f => {
    const totalPaid = (f.payments ?? []).reduce((s, p) => s + p.amount, 0)
    return { ...f, totalPaid, balance: f.amount - totalPaid }
  })
  const settledFees = feesWithTotals
    .filter(f => f.amount > 0 && f.balance <= 0)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(f => ({
      month: fmtReminderMonth(f.month),
      invoiced: f.amount,
      paid: f.totalPaid,
    }))
  const totalAcknowledged = settledFees.reduce((s, f) => s + f.paid, 0)
  return { settledFees, totalAcknowledged }
}
