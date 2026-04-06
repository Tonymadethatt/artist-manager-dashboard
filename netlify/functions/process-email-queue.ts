/**
 * process-email-queue
 *
 * Called by an external cron job every minute.
 * Finds pending emails older than BUFFER_MINUTES and sends them automatically.
 *
 * Required environment variables (set in Netlify dashboard → Site configuration → Environment variables):
 *   SUPABASE_URL             – same value as VITE_SUPABASE_URL (without the VITE_ prefix)
 *   SUPABASE_SERVICE_ROLE_KEY – from Supabase dashboard → Settings → API → service_role key
 *   RESEND_API_KEY           – already set for send-venue-email
 *   PROCESS_QUEUE_SECRET     – any random string; add as header X-Queue-Secret in your cron job
 *
 * Cron job setup (cronjob.org or similar):
 *   URL:     https://<your-netlify-site>/.netlify/functions/process-email-queue
 *   Method:  POST
 *   Header:  X-Queue-Secret: <your PROCESS_QUEUE_SECRET value>
 *   Schedule: every 1 minute (set one-minute interval in your cron provider; standard cron is five fields)
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

const BUFFER_MINUTES = 10

type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'booking_confirmed'
  | 'follow_up'
  | 'rebooking_inquiry'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  // Authenticate the cron caller
  const secret = process.env.PROCESS_QUEUE_SECRET
  const provided = event.headers['x-queue-secret']
  if (!secret || provided !== secret) {
    return { statusCode: 401, body: 'Unauthorized' }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const resendApiKey = process.env.RESEND_API_KEY
  const siteUrl = process.env.URL || ''

  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set' }
  }
  if (!resendApiKey) {
    return { statusCode: 500, body: 'RESEND_API_KEY not configured' }
  }

  // Admin client — bypasses RLS
  const supabase = createClient(supabaseUrl, serviceRoleKey)

  // Find pending emails older than the buffer window
  const cutoff = new Date(Date.now() - BUFFER_MINUTES * 60 * 1000).toISOString()

  const { data: emails, error: fetchError } = await supabase
    .from('venue_emails')
    .select(`
      *,
      venue:venues(id, name, city, location),
      deal:deals(id, description, event_date, gross_amount, agreement_url, notes, payment_due_date),
      contact:contacts(id, name, email)
    `)
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(50) // process at most 50 per run to stay within function timeout

  if (fetchError) {
    console.error('[process-email-queue] fetch error:', fetchError.message)
    return { statusCode: 500, body: JSON.stringify({ error: fetchError.message }) }
  }

  const results: Array<{ id: string; result: 'sent' | 'failed'; reason?: string }> = []

  for (const email of (emails ?? [])) {
    // Fetch artist profile for this user
    const { data: profile } = await supabase
      .from('artist_profile')
      .select('*')
      .eq('user_id', email.user_id)
      .maybeSingle()

    if (!profile?.from_email) {
      await supabase
        .from('venue_emails')
        .update({ status: 'failed', notes: 'Auto-send failed: artist profile not configured' })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason: 'no_artist_profile' })
      continue
    }

    const requestBody = {
      type: email.email_type as VenueEmailType,
      profile: {
        artist_name: profile.artist_name,
        company_name: profile.company_name,
        from_email: profile.from_email,
        reply_to_email: profile.reply_to_email,
        website: profile.website,
        phone: profile.phone,
        social_handle: profile.social_handle,
        tagline: profile.tagline,
      },
      recipient: {
        name: (email.contact as { name?: string } | null)?.name || email.recipient_email,
        email: email.recipient_email,
      },
      ...(email.deal ? { deal: email.deal } : {}),
      ...(email.venue ? {
        venue: {
          name: (email.venue as { name: string }).name,
          city: (email.venue as { city?: string | null }).city ?? null,
          location: (email.venue as { location?: string | null }).location ?? null,
        }
      } : {}),
    }

    try {
      const sendRes = await fetch(`${siteUrl}/.netlify/functions/send-venue-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (sendRes.ok) {
        await supabase
          .from('venue_emails')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'sent' })
      } else {
        const err = await sendRes.json().catch(() => ({ message: 'Send failed' }))
        const reason = (err as { message?: string }).message ?? 'Send failed'
        await supabase
          .from('venue_emails')
          .update({ status: 'failed', notes: `Auto-send failed: ${reason}` })
          .eq('id', email.id)
        results.push({ id: email.id, result: 'failed', reason })
      }
    } catch (e) {
      const reason = e instanceof Error ? e.message : 'Unknown error'
      await supabase
        .from('venue_emails')
        .update({ status: 'failed', notes: `Auto-send failed: ${reason}` })
        .eq('id', email.id)
      results.push({ id: email.id, result: 'failed', reason })
    }
  }

  const sent = results.filter(r => r.result === 'sent').length
  const failed = results.filter(r => r.result === 'failed').length
  console.log(`[process-email-queue] processed ${results.length}: ${sent} sent, ${failed} failed`)

  return {
    statusCode: 200,
    body: JSON.stringify({ processed: results.length, sent, failed, results }),
  }
}

export { handler }
