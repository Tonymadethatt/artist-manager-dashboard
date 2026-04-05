import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

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
}

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
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

  // Step 0: Look up by token
  const { data: row, error: lookupError } = await supabase
    .from('performance_reports')
    .select('id, user_id, venue_id, deal_id, submitted, token_used')
    .eq('token', body.token)
    .single()

  // Return success regardless of whether token was not found or already submitted
  // This prevents token probing and gives DJ Luijay a clean experience
  if (lookupError || !row || row.submitted) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true }),
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // Step 1: Commit the submission — this must succeed before any automation
  const { error: submitError } = await supabase
    .from('performance_reports')
    .update({
      submitted: true,
      token_used: true,
      submitted_at: new Date().toISOString(),
      event_happened: body.eventHappened,
      event_rating: body.eventRating ?? null,
      attendance: body.attendance ?? null,
      artist_paid_status: body.artistPaidStatus ?? null,
      payment_amount: body.paymentAmount ?? null,
      venue_interest: body.venueInterest ?? null,
      relationship_quality: body.relationshipQuality ?? null,
      notes: body.notes ?? null,
      media_links: body.mediaLinks ?? null,
    })
    .eq('id', row.id)

  if (submitError) {
    // If we can't save the submission, surface the error so DJ Luijay can retry
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to save report. Please try again.' }) }
  }

  // All remaining steps are best-effort — failures are logged but don't affect DJ Luijay's response

  // Step 2: Get venue name for log entries
  let venueName = 'venue'
  try {
    const { data: venue } = await supabase.from('venues').select('name').eq('id', row.venue_id).single()
    if (venue) venueName = venue.name
  } catch { /* non-critical */ }

  // Step 3: Update venue status
  try {
    let newStatus: string
    if (body.venueInterest === 'yes') {
      newStatus = 'rebooking'
    } else if (body.relationshipQuality === 'poor' && body.venueInterest === 'no') {
      newStatus = 'closed_lost'
    } else {
      newStatus = 'post_follow_up'
    }
    await supabase.from('venues').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', row.venue_id)
  } catch (e) {
    console.error('[submit-performance-report] Step 3 venue status update failed:', e)
  }

  // Step 4: Log event attendance metric
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
      console.error('[submit-performance-report] Step 4 metric insert failed:', e)
    }
  }

  // Step 5: Update deal if artist was fully paid
  if (body.artistPaidStatus === 'yes' && row.deal_id) {
    try {
      await supabase.from('deals').update({ artist_paid: true, artist_paid_date: today }).eq('id', row.deal_id)
    } catch (e) {
      console.error('[submit-performance-report] Step 5 deal update (full paid) failed:', e)
    }
  }

  // Step 6: Append partial payment note to deal
  if (body.artistPaidStatus === 'partial' && row.deal_id) {
    try {
      const { data: deal } = await supabase.from('deals').select('notes').eq('id', row.deal_id).single()
      const existingNotes = deal?.notes || ''
      const appendNote = `${today}: Partial payment of $${body.paymentAmount ?? '?'} reported by artist via performance form.`
      const newNotes = existingNotes ? `${existingNotes}\n${appendNote}` : appendNote
      await supabase.from('deals').update({ notes: newNotes }).eq('id', row.deal_id)
    } catch (e) {
      console.error('[submit-performance-report] Step 6 deal partial payment note failed:', e)
    }
  }

  // Step 7: Flag commission if artist reported payment
  if (body.artistPaidStatus === 'yes' || body.artistPaidStatus === 'partial') {
    try {
      await supabase.from('performance_reports').update({ commission_flagged: true }).eq('id', row.id)
    } catch (e) {
      console.error('[submit-performance-report] Step 7 commission flag failed:', e)
    }
  }

  // Step 8: Rebooking actions (if venue showed interest)
  if (body.venueInterest === 'yes') {
    try {
      // Try to find a contact email for the venue
      const { data: contact } = await supabase
        .from('contacts')
        .select('email')
        .eq('venue_id', row.venue_id)
        .not('email', 'is', null)
        .limit(1)
        .single()

      if (contact?.email) {
        // Queue rebooking inquiry email to venue contact
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
        // No email on file — create a task to add it and send manually
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
      console.error('[submit-performance-report] Step 8 rebooking email/task failed:', e)
    }

    // Create a rebooking follow-up task
    try {
      await supabase.from('tasks').insert({
        user_id: row.user_id,
        title: `Re-engage ${venueName} for rebooking`,
        venue_id: row.venue_id,
        deal_id: row.deal_id ?? null,
        priority: 'high',
        due_date: addDays(3),
        recurrence: 'none',
        completed: false,
      })
    } catch (e) {
      console.error('[submit-performance-report] Step 8 rebooking task failed:', e)
    }
  }

  // Step 9: Log performance report summary as outreach note
  try {
    const parts = [
      `Performance report submitted (${today}).`,
      body.eventHappened === 'no' ? 'Event did not happen.' : body.eventHappened === 'postponed' ? 'Event was postponed.' : null,
      body.eventRating ? `Rating: ${body.eventRating}/5.` : null,
      body.attendance ? `Attendance: approx. ${body.attendance} people.` : null,
      body.artistPaidStatus === 'yes' ? 'Artist confirmed full payment received.' :
        body.artistPaidStatus === 'partial' ? `Artist reported partial payment of $${body.paymentAmount ?? '?'}.` :
        body.artistPaidStatus === 'no' ? 'Artist reported no payment received.' : null,
      body.venueInterest === 'yes' ? 'Venue expressed interest in rebooking.' :
        body.venueInterest === 'no' ? 'Venue not interested in rebooking.' :
        body.venueInterest === 'unsure' ? 'Venue unsure about rebooking.' : null,
      body.relationshipQuality ? `Relationship quality: ${body.relationshipQuality}.` : null,
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
    console.error('[submit-performance-report] Step 9 outreach note failed:', e)
  }

  // Step 10: Create post-show follow-up task
  try {
    await supabase.from('tasks').insert({
      user_id: row.user_id,
      title: `Post-show follow-up: ${venueName}`,
      venue_id: row.venue_id,
      deal_id: row.deal_id ?? null,
      priority: 'medium',
      due_date: addDays(7),
      recurrence: 'none',
      completed: false,
    })
  } catch (e) {
    console.error('[submit-performance-report] Step 10 follow-up task failed:', e)
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true }),
  }
}

export { handler }
