import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  formatFrictionTagsForNote,
  PRODUCTION_FRICTION_OPTIONS,
  timelineToReengageDays,
} from '../../src/lib/performanceReportV1'
import type { CancellationReason } from '../../src/lib/performanceReportV1'

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
  /** Who submitted: public form vs manager dashboard manual entry */
  submittedBy?: 'artist_link' | 'manager_dashboard'
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
      payment_amount: played ? body.paymentAmount ?? null : null,
      venue_interest: body.venueInterest ?? null,
      relationship_quality: body.relationshipQuality ?? null,
      notes: body.notes ?? null,
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
      const partialNote =
        submittedBy === 'manager_dashboard'
          ? `${today}: Partial payment of $${body.paymentAmount ?? '?'} recorded by manager via performance form.`
          : `${today}: Partial payment of $${body.paymentAmount ?? '?'} reported by artist via performance form.`
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
  }

  if (body.wantsBookingCall === 'yes') {
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

  if (played && body.chasePaymentFollowup === 'yes') {
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
    } catch (e) {
      console.error('[submit-performance-report] Chase payment task failed:', e)
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

  if (body.wantsManagerVenueContact === 'yes') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Artist asked you to contact ${venueName}`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'medium',
        due_date: addDays(3),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Manager contact task failed:', e)
    }
  }

  if (body.referralLead === 'yes') {
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Capture referral lead — ${venueName}`,
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
      body.attendance ? `Attendance: approx. ${body.attendance} people.` : null,
      body.artistPaidStatus === 'yes'
        ? submittedBy === 'manager_dashboard'
          ? 'Report indicates full payment received.'
          : 'Artist confirmed full payment received.'
        : body.artistPaidStatus === 'partial'
          ? submittedBy === 'manager_dashboard'
            ? `Report indicates partial payment of $${body.paymentAmount ?? '?'}.`
            : `Artist reported partial payment of $${body.paymentAmount ?? '?'}.`
        : body.artistPaidStatus === 'no'
          ? submittedBy === 'manager_dashboard'
            ? 'Report indicates no payment received yet.'
            : 'Artist reported no payment received.'
        : null,
      played && body.chasePaymentFollowup === 'yes'
        ? submittedBy === 'manager_dashboard'
          ? 'Chase payment follow-up noted on report.'
          : 'Artist asked manager to chase payment.'
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
      body.wantsBookingCall === 'yes' ? 'Wants manager to schedule next booking conversation.' : null,
      body.wantsManagerVenueContact === 'yes' ? 'Wants manager to contact venue on their behalf.' : null,
      body.referralLead === 'yes' ? 'Referral / another buyer mentioned.' : null,
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
