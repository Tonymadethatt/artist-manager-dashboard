import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  formatFrictionTagsForNote,
  PRODUCTION_FRICTION_OPTIONS,
  timelineToReengageDays,
} from '../../src/lib/performanceReportV1'
import { serializeArtistTxnQueueNotes } from '../../src/lib/email/artistTxnQueuePayload'
import type { CancellationReason } from '../../src/lib/performanceReportV1'
import {
  formatDealGrossReconciliationNotes,
} from '../../src/lib/dealGrossReconciliationTask'

const FRICTION_IDS = new Set(PRODUCTION_FRICTION_OPTIONS.map(o => o.id))

function normalizeFrictionTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((x): x is string => typeof x === 'string' && FRICTION_IDS.has(x))
}

interface SubmitBody {
  token: string
  eventHappened: 'yes' | 'no' | 'postponed'
  eventRating?: number | null
  attendance?: number | null
  artistPaidStatus?: 'yes' | 'no' | 'partial'
  /** Total gig fee (exact); drives commission reconciliation vs deal.gross_amount. */
  feeTotal?: number | null
  /** Amount received from venue for this gig. */
  amountReceived?: number | null
  /** Optional artist claim when payment_dispute = yes */
  paymentDisputeClaimedAmount?: number | null
  /** @deprecated Use amountReceived; kept for backward compatibility. */
  paymentAmount?: number | null
  venueInterest?: 'yes' | 'no' | 'unsure'
  relationshipQuality?: 'good' | 'neutral' | 'poor'
  notes?: string | null
  mediaLinks?: string | null
  chasePaymentFollowup?: 'no' | 'unsure' | 'yes' | null
  paymentDispute?: 'no' | 'yes' | null
  productionIssueLevel?: 'none' | 'minor' | 'serious' | null
  productionFrictionTags?: string[] | null
  rebookingTimeline?: 'this_month' | 'this_quarter' | 'later' | 'not_discussed' | null
  wantsBookingCall?: 'no' | 'yes' | null
  wantsManagerVenueContact?: 'no' | 'yes' | null
  wouldPlayAgain?: 'yes' | 'maybe' | 'no' | null
  cancellationReason?: CancellationReason | null
  referralLead?: 'no' | 'yes' | null
  referralDetail?: string | null
  crowdEnergy?: 'electric' | 'warm' | 'flat' | 'hostile' | null
  /** Legacy banded tips/merch; superseded by merchIncome + merchIncomeAmount from current form. */
  supplementalIncome?: 'none' | 'under_50' | '50_150' | 'over_150' | null
  merchIncome?: 'yes' | 'no' | null
  merchIncomeAmount?: number | null
  venueDelivered?: 'yes_good' | 'mostly_off' | 'significant_gaps' | null
  /** Who submitted: public form vs manager dashboard manual entry */
  submittedBy?: 'artist_link' | 'manager_dashboard'
}

function crowdEnergyLabel(v: string): string {
  const m: Record<string, string> = {
    electric: 'Electric — they were into it',
    warm: 'Warm — decent energy',
    flat: 'Flat — tough crowd',
    hostile: 'Hostile — rough night',
  }
  return m[v] ?? v
}

function supplementalIncomeLabel(v: string): string {
  const m: Record<string, string> = {
    none: 'None',
    under_50: 'Under $50',
    '50_150': '$50–$150',
    over_150: '$150+',
  }
  return m[v] ?? v
}

function parseMoneyField(v: unknown): number | null {
  if (v == null) return null
  const n = typeof v === 'number' ? v : parseFloat(String(v))
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function validatePlayedEconomics(body: SubmitBody): { ok: true } | { ok: false; message: string } {
  const fee = parseMoneyField(body.feeTotal)
  const recv = parseMoneyField(body.amountReceived ?? body.paymentAmount)
  if (fee == null || fee <= 0) {
    return { ok: false, message: 'Missing or invalid fee total (feeTotal).' }
  }
  if (recv == null || recv < 0) {
    return { ok: false, message: 'Missing or invalid amount received.' }
  }
  const st = body.artistPaidStatus
  if (st === 'no' && Math.abs(recv) > 0.005) {
    return { ok: false, message: 'Amount received must be zero when not paid yet.' }
  }
  if (st === 'yes' && Math.abs(recv - fee) > 0.02) {
    return { ok: false, message: 'Amount received must match fee for full payment.' }
  }
  if (st === 'partial' && (recv <= 0.005 || recv >= fee - 0.005)) {
    return { ok: false, message: 'Partial payment must be strictly between zero and total fee.' }
  }
  if (body.paymentDispute === 'yes') {
    const raw = body.paymentDisputeClaimedAmount
    if (raw !== null && raw !== undefined && `${raw}`.trim() !== '') {
      const claim = parseMoneyField(raw)
      if (claim == null || claim <= 0) {
        return { ok: false, message: 'Disputed owed amount must be positive if provided.' }
      }
    }
  }
  return { ok: true }
}

async function applyReportedGrossToDeal(
  supabase: ReturnType<typeof createClient>,
  dealId: string,
  newGross: number,
) {
  const { data: deal } = await supabase
    .from('deals')
    .select('commission_rate')
    .eq('id', dealId)
    .maybeSingle()
  const rate = deal?.commission_rate != null ? Number(deal.commission_rate) : 0
  const comm = Number.isFinite(rate) ? Math.round(newGross * rate * 100) / 100 : 0
  await supabase
    .from('deals')
    .update({ gross_amount: newGross, commission_amount: comm })
    .eq('id', dealId)
}

function venueDeliveredLabel(v: string): string {
  const m: Record<string, string> = {
    yes_good: 'Yes — everything was good',
    mostly_off: 'Mostly — a few things were off',
    significant_gaps: 'No — significant gaps',
  }
  return m[v] ?? v
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function venueStatusForReport(body: SubmitBody): string {
  const played = body.eventHappened === 'yes'
  if (body.venueInterest === 'yes') return 'rebooking'
  if (played && body.relationshipQuality === 'poor' && body.venueInterest === 'no') {
    return 'closed_lost'
  }
  return 'post_follow_up'
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Server configuration error' }) }
  }

  let body: SubmitBody
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) }
  }

  if (!body.token) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing token' }) }
  }

  const playedCheck = body.eventHappened === 'yes'
  if (playedCheck) {
    if (!body.artistPaidStatus) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'artistPaidStatus is required when the event happened.' }),
      }
    }
    const econ = validatePlayedEconomics(body)
    if (!econ.ok) {
      return { statusCode: 400, body: JSON.stringify({ message: econ.message }) }
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const frictionTags = normalizeFrictionTags(body.productionFrictionTags)
  const submittedBy =
    body.submittedBy === 'manager_dashboard' ? 'manager_dashboard' : 'artist_link'

  const { data: row, error: lookupError } = await supabase
    .from('performance_reports')
    .select('id, user_id, venue_id, deal_id, submitted, token_used')
    .eq('token', body.token)
    .single()

  if (lookupError || !row || row.submitted) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  }

  const today = new Date().toISOString().split('T')[0]

  const played = body.eventHappened === 'yes'
  const feeTotalSaved = played && body.artistPaidStatus ? parseMoneyField(body.feeTotal) : null
  const amountReceivedSaved =
    played && body.artistPaidStatus
      ? parseMoneyField(body.amountReceived ?? body.paymentAmount)
      : null
  const disputeClaimSaved =
    played && body.paymentDispute === 'yes'
      ? parseMoneyField(body.paymentDisputeClaimedAmount ?? null)
      : null

  const merchIncomeLine =
    played &&
    body.merchIncome === 'yes' &&
    body.merchIncomeAmount != null &&
    Number.isFinite(Number(body.merchIncomeAmount)) &&
    Number(body.merchIncomeAmount) > 0
      ? `Merch income: $${body.merchIncomeAmount}.`
      : null
  const legacySupplementalLine =
    played && body.supplementalIncome && body.supplementalIncome !== 'none'
      ? `Tips / merch income: ${supplementalIncomeLabel(body.supplementalIncome)}`
      : null

  const balanceLine =
    played &&
    feeTotalSaved != null &&
    amountReceivedSaved != null &&
    feeTotalSaved > 0
      ? `Gig fee $${feeTotalSaved}; received $${amountReceivedSaved}; balance $${Math.round((feeTotalSaved - amountReceivedSaved) * 100) / 100}.`
      : null
  const disputeClaimLine =
    played &&
    body.paymentDispute === 'yes' &&
    disputeClaimSaved != null &&
    disputeClaimSaved > 0
      ? `Artist-reported amount owed (dispute): $${disputeClaimSaved}.`
      : null

  const structuredNoteLines = [
    played && body.crowdEnergy ? `Crowd energy: ${crowdEnergyLabel(body.crowdEnergy)}` : null,
    balanceLine,
    disputeClaimLine,
    merchIncomeLine ?? legacySupplementalLine,
    played && body.venueDelivered
      ? `Venue delivered on promises: ${venueDeliveredLabel(body.venueDelivered)}`
      : null,
    body.referralLead === 'yes' && body.referralDetail?.trim()
      ? `Referral detail: ${body.referralDetail.trim()}`
      : null,
  ].filter(Boolean) as string[]
  const mergedNotes = [body.notes?.trim() || '', ...structuredNoteLines].filter(Boolean).join('\n\n') || null

  const { error: submitError } = await supabase
    .from('performance_reports')
    .update({
      submitted: true,
      token_used: true,
      submitted_at: new Date().toISOString(),
      event_happened: body.eventHappened,
      event_rating: played ? body.eventRating ?? null : null,
      attendance: played ? body.attendance ?? null : null,
      artist_paid_status: played ? body.artistPaidStatus ?? null : null,
      payment_amount: played ? amountReceivedSaved ?? null : null,
      fee_total: played ? feeTotalSaved ?? null : null,
      amount_received: played ? amountReceivedSaved ?? null : null,
      payment_dispute_claimed_amount:
        played && body.paymentDispute === 'yes' && disputeClaimSaved != null && disputeClaimSaved > 0
          ? disputeClaimSaved
          : null,
      venue_interest: body.venueInterest ?? null,
      relationship_quality: body.relationshipQuality ?? null,
      notes: mergedNotes,
      media_links: body.mediaLinks ?? null,
      chase_payment_followup: played ? body.chasePaymentFollowup ?? null : null,
      payment_dispute: played ? body.paymentDispute ?? null : null,
      production_issue_level: played ? body.productionIssueLevel ?? null : null,
      production_friction_tags: frictionTags,
      rebooking_timeline: body.rebookingTimeline ?? null,
      wants_booking_call: body.wantsBookingCall ?? null,
      wants_manager_venue_contact: body.wantsManagerVenueContact ?? null,
      would_play_again: body.wouldPlayAgain ?? null,
      cancellation_reason: !played ? body.cancellationReason ?? null : null,
      referral_lead: body.referralLead ?? null,
      submitted_by: submittedBy,
    })
    .eq('id', row.id)

  if (submitError) {
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to save report. Please try again.' }) }
  }

  let venueName = 'venue'
  /** pipeline = commission on booked deals applies; community = artist network, no booking commission */
  let venueOutreachTrack: 'pipeline' | 'community' = 'pipeline'
  try {
    const { data: venue } = await supabase
      .from('venues')
      .select('name, outreach_track')
      .eq('id', row.venue_id)
      .single()
    if (venue) {
      venueName = venue.name
      venueOutreachTrack = venue.outreach_track === 'community' ? 'community' : 'pipeline'
    }
  } catch { /* non-critical */ }

  if (played && row.deal_id && feeTotalSaved != null && submittedBy === 'manager_dashboard') {
    try {
      const { data: dealG } = await supabase
        .from('deals')
        .select('gross_amount')
        .eq('id', row.deal_id)
        .maybeSingle()
      const onFile = dealG?.gross_amount != null ? Number(dealG.gross_amount) : null
      if (onFile == null || !Number.isFinite(onFile) || Math.abs(onFile - feeTotalSaved) > 0.01) {
        await applyReportedGrossToDeal(supabase, row.deal_id, feeTotalSaved)
      }
    } catch (e) {
      console.error('[submit-performance-report] Manager gross sync failed:', e)
    }
  }

  if (
    played &&
    row.deal_id &&
    feeTotalSaved != null &&
    submittedBy === 'artist_link' &&
    venueOutreachTrack === 'pipeline'
  ) {
    try {
      const { data: dealG } = await supabase
        .from('deals')
        .select('gross_amount')
        .eq('id', row.deal_id)
        .maybeSingle()
      const onFile = dealG?.gross_amount != null ? Number(dealG.gross_amount) : null
      if (
        onFile != null &&
        Number.isFinite(onFile) &&
        Math.abs(onFile - feeTotalSaved) > 0.01
      ) {
        await supabase.from('tasks').insert({
          user_id: row.user_id,
          title: `Reconcile deal gross — ${venueName}`,
          notes: formatDealGrossReconciliationNotes({
            performance_report_id: row.id,
            deal_id: row.deal_id,
            gross_on_file: onFile,
            reported_fee_total: feeTotalSaved,
          }),
          venue_id: row.venue_id,
          deal_id: row.deal_id,
          priority: 'high',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
    } catch (e) {
      console.error('[submit-performance-report] Gross reconciliation task failed:', e)
    }
  }

  try {
    const newStatus = venueStatusForReport(body)
    await supabase.from('venues').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', row.venue_id)
  } catch (e) {
    console.error('[submit-performance-report] Venue status update failed:', e)
  }

  if (body.attendance && body.attendance > 0) {
    try {
      await supabase.from('metrics').insert({
        user_id: row.user_id,
        date: today,
        category: 'event_attendance',
        title: `Event attendance: ${venueName}`,
        numeric_value: body.attendance,
        description: `Reported via performance form for ${venueName}`,
      })
    } catch (e) {
      console.error('[submit-performance-report] Metric insert failed:', e)
    }
  }

  if (body.artistPaidStatus === 'yes' && row.deal_id) {
    try {
      await supabase.from('deals').update({ artist_paid: true, artist_paid_date: today }).eq('id', row.deal_id)
    } catch (e) {
      console.error('[submit-performance-report] Deal full paid update failed:', e)
    }
  }

  if (body.artistPaidStatus === 'partial' && row.deal_id) {
    try {
      const { data: deal } = await supabase.from('deals').select('notes').eq('id', row.deal_id).single()
      const existingNotes = deal?.notes || ''
      const recv = amountReceivedSaved ?? body.paymentAmount ?? '?'
      const fee = feeTotalSaved ?? '?'
      const bal =
        feeTotalSaved != null && amountReceivedSaved != null
          ? Math.round((feeTotalSaved - amountReceivedSaved) * 100) / 100
          : '?'
      const partialNote =
        submittedBy === 'manager_dashboard'
          ? `${today}: Partial payment $${recv} of $${fee} (balance $${bal}) recorded by manager via performance form.`
          : `${today}: Partial payment $${recv} of $${fee} (balance $${bal}) reported by artist via performance form.`
      const appendNote = partialNote
      const newNotes = existingNotes ? `${existingNotes}\n${appendNote}` : appendNote
      await supabase.from('deals').update({ notes: newNotes }).eq('id', row.deal_id)
    } catch (e) {
      console.error('[submit-performance-report] Deal partial note failed:', e)
    }
  }

  const commissionRelevantToManager =
    venueOutreachTrack === 'pipeline' &&
    (body.artistPaidStatus === 'yes' || body.artistPaidStatus === 'partial')

  if (commissionRelevantToManager) {
    try {
      await supabase.from('performance_reports').update({ commission_flagged: true }).eq('id', row.id)
    } catch (e) {
      console.error('[submit-performance-report] Commission flag failed:', e)
    }
  }

  const reengageDays = timelineToReengageDays(body.rebookingTimeline)

  if (body.venueInterest === 'yes') {
    try {
      const { data: contact } = await supabase
        .from('contacts')
        .select('email')
        .eq('venue_id', row.venue_id)
        .not('email', 'is', null)
        .limit(1)
        .single()

      if (contact?.email) {
        await supabase.from('venue_emails').insert({
          user_id: row.user_id,
          venue_id: row.venue_id,
          deal_id: row.deal_id ?? null,
          email_type: 'rebooking_inquiry',
          recipient_email: contact.email,
          subject: `Rebooking Inquiry - ${venueName}`,
          status: 'pending',
          notes: 'Auto-queued from performance report submission.',
        })
      } else {
        await supabase.from('tasks').insert({
          user_id: row.user_id,
          title: `Find contact email and send rebooking inquiry to ${venueName}`,
          venue_id: row.venue_id,
          priority: 'high',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
    } catch (e) {
      console.error('[submit-performance-report] Rebooking email/contact task failed:', e)
    }

    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Re-engage ${venueName} for rebooking`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: addDays(reengageDays),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Re-engage task failed:', e)
    }

    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Schedule rebooking call — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: addDays(2),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Booking call task failed:', e)
    }
  }

  if (played && body.artistPaidStatus === 'no') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Chase payment — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
      if (row.deal_id) {
        const { data: chaseContact } = await supabase
          .from('contacts')
          .select('email')
          .eq('venue_id', row.venue_id)
          .not('email', 'is', null)
          .limit(1)
          .maybeSingle()
        if (chaseContact?.email) {
          await supabase.from('venue_emails').insert({
            user_id: row.user_id,
            venue_id: row.venue_id,
            deal_id: row.deal_id,
            email_type: 'payment_reminder',
            recipient_email: chaseContact.email,
            subject: `Payment Reminder — ${venueName}`,
            status: 'pending',
            notes: 'Auto-queued from performance report (payment not received).',
          })
        }
      }
    } catch (e) {
      console.error('[submit-performance-report] Chase payment task failed:', e)
    }
  }

  if (played && body.artistPaidStatus === 'partial') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Follow up remaining balance — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Partial balance task failed:', e)
    }
  }

  if (played && body.paymentDispute === 'yes') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Payment discrepancy — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'medium',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Payment dispute task failed:', e)
    }
  }

  if (played && body.productionIssueLevel === 'serious') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Production / safety follow-up — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Production follow-up task failed:', e)
    }
  }

  if (body.referralLead === 'yes') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Capture referral lead — ${venueName}`,
        notes: body.referralDetail?.trim() || null,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'medium',
        due_date: addDays(5),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Referral task failed:', e)
    }
  }

  if (played && body.venueDelivered === 'significant_gaps') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Address venue delivery issues — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Venue delivery task failed:', e)
    }
  }

  if (played && body.crowdEnergy === 'hostile') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Review hostile crowd report — ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'medium',
        due_date: today,
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Hostile crowd task failed:', e)
    }
  }

  const cancellationLabels: Record<string, string> = {
    venue_cancelled: 'Venue cancelled',
    weather: 'Weather',
    low_turnout: 'Low turnout',
    illness: 'Illness/emergency',
    logistics: 'Logistics',
    other: 'Other',
  }

  try {
    const frictionLine = frictionTags.length ? formatFrictionTagsForNote(frictionTags) : null
    const mgrNote =
      submittedBy === 'manager_dashboard'
        ? 'Submitted by manager from dashboard (on behalf of artist).'
        : null
    const parts = [
      `Performance report submitted (${today}).`,
      mgrNote,
      body.eventHappened === 'no' ? 'Event did not happen.' : body.eventHappened === 'postponed' ? 'Event was postponed.' : null,
      body.cancellationReason && !played
        ? `Cancellation/postpone reason: ${cancellationLabels[body.cancellationReason] ?? body.cancellationReason}.`
        : null,
      body.eventRating ? `Rating: ${body.eventRating}/5.` : null,
      body.attendance != null
        ? `Attendance: ${body.attendance} people.`
        : null,
      played && body.crowdEnergy ? `Crowd energy: ${crowdEnergyLabel(body.crowdEnergy)}.` : null,
      played &&
      body.merchIncome === 'yes' &&
      body.merchIncomeAmount != null &&
      Number.isFinite(Number(body.merchIncomeAmount)) &&
      Number(body.merchIncomeAmount) > 0
        ? `Merch income: $${body.merchIncomeAmount}.`
        : played && body.supplementalIncome && body.supplementalIncome !== 'none'
          ? `Tips/merch income: ${supplementalIncomeLabel(body.supplementalIncome)}.`
          : null,
      played && body.venueDelivered
        ? `Venue delivered on promises: ${venueDeliveredLabel(body.venueDelivered)}.`
        : null,
      body.artistPaidStatus === 'yes'
        ? submittedBy === 'manager_dashboard'
          ? `Report indicates full payment ($${feeTotalSaved ?? '?'}) received.`
          : `Artist confirmed full payment ($${feeTotalSaved ?? '?'}) received.`
        : body.artistPaidStatus === 'partial'
          ? submittedBy === 'manager_dashboard'
            ? `Partial payment: received $${amountReceivedSaved ?? '?'} of $${feeTotalSaved ?? '?'}.`
            : `Partial payment: received $${amountReceivedSaved ?? '?'} of $${feeTotalSaved ?? '?'}.`
        : body.artistPaidStatus === 'no'
          ? submittedBy === 'manager_dashboard'
            ? `No payment received yet (gig fee $${feeTotalSaved ?? '?'}).`
            : `Artist reported no payment yet (gig fee $${feeTotalSaved ?? '?'}).`
        : null,
      played && body.artistPaidStatus === 'no'
        ? 'Payment chase / reminder may be auto-queued for manager review.'
        : null,
      played && body.artistPaidStatus === 'partial'
        ? 'Partial payment reported — remaining balance follow-up may be queued.'
        : null,
      played && body.paymentDispute === 'yes'
        ? submittedBy === 'manager_dashboard'
          ? 'Payment amount disagreement noted on report.'
          : 'Artist reported a payment amount dispute.'
        : null,
      played && body.productionIssueLevel && body.productionIssueLevel !== 'none'
        ? `Production/safety: ${body.productionIssueLevel}.`
        : null,
      frictionLine ? `Friction areas: ${frictionLine}.` : null,
      body.venueInterest === 'yes' ? 'Venue expressed interest in rebooking.' :
        body.venueInterest === 'no' ? 'Venue not interested in rebooking.' :
        body.venueInterest === 'unsure' ? 'Venue unsure about rebooking.' : null,
      body.rebookingTimeline && body.venueInterest === 'yes'
        ? `Rebooking timeline hint: ${body.rebookingTimeline.replace(/_/g, ' ')}.`
        : null,
      body.relationshipQuality ? `Relationship quality: ${body.relationshipQuality}.` : null,
      body.wouldPlayAgain ? `Would play again: ${body.wouldPlayAgain}.` : null,
      body.referralLead === 'yes' ? 'Referral / another buyer mentioned.' : null,
      body.referralLead === 'yes' && body.referralDetail?.trim()
        ? `Referral detail: ${body.referralDetail.trim()}`
        : null,
      body.notes ? `Notes: ${body.notes}` : null,
      body.mediaLinks ? `Media links: ${body.mediaLinks}` : null,
    ].filter(Boolean)

    await supabase.from('outreach_notes').insert({
      user_id: row.user_id,
      venue_id: row.venue_id,
      note: parts.join(' '),
      category: 'other',
    })
  } catch (e) {
    console.error('[submit-performance-report] Outreach note failed:', e)
  }

  try {
    const { data: ackProf } = await supabase
      .from('artist_profile')
      .select('artist_email')
      .eq('user_id', row.user_id)
      .maybeSingle()
    if (ackProf?.artist_email) {
      let ackEventDate: string | null = null
      if (row.deal_id) {
        const { data: ackDeal } = await supabase
          .from('deals')
          .select('event_date')
          .eq('id', row.deal_id)
          .maybeSingle()
        ackEventDate = (ackDeal as { event_date?: string | null } | null)?.event_date ?? null
      }
      await supabase.from('venue_emails').insert({
        user_id: row.user_id,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        email_type: 'performance_report_received',
        recipient_email: ackProf.artist_email as string,
        subject: `Got it — thanks for the update · ${venueName}`,
        status: 'pending',
        notes: serializeArtistTxnQueueNotes({
          kind: 'performance_report_received',
          venueName,
          eventDate: ackEventDate,
        }),
      })
    }
  } catch (e) {
    console.error('[submit-performance-report] Artist ack email failed:', e)
  }

  if (body.venueInterest !== 'yes') {
    try {
      const due = played ? 7 : 3
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Performance report follow-up: ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'medium',
        due_date: addDays(due),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Generic follow-up task failed:', e)
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}

export { handler }
