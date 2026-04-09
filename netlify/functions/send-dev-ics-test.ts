import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAnonKey, getSupabaseServerEnv } from './supabaseServerEnv'
import { buildDevSampleIcs } from '../../src/lib/calendar/buildDevSampleIcs'

/**
 * POST /.netlify/functions/send-dev-ics-test
 * Authorization: Bearer <supabase access_token>
 * Sends a sample .ics to manager_email (fallback artist_email) for mobile calendar testing.
 */
const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: jsonHeaders(), body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const authHeader = event.headers.authorization ?? event.headers.Authorization
  if (!authHeader || !/^Bearer\s+/i.test(authHeader)) {
    return { statusCode: 401, headers: jsonHeaders(), body: JSON.stringify({ message: 'Unauthorized' }) }
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) {
    return { statusCode: 401, headers: jsonHeaders(), body: JSON.stringify({ message: 'Unauthorized' }) }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  const anonKey = getSupabaseAnonKey()
  const resendKey = process.env.RESEND_API_KEY

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return {
      statusCode: 500,
      headers: jsonHeaders(),
      body: JSON.stringify({ message: 'Server configuration missing (Supabase URL, service role, or anon key)' }),
    }
  }
  if (!resendKey) {
    return { statusCode: 500, headers: jsonHeaders(), body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  const authClient = createClient(supabaseUrl, anonKey)
  const { data: userData, error: userErr } = await authClient.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    return { statusCode: 401, headers: jsonHeaders(), body: JSON.stringify({ message: 'Invalid or expired session' }) }
  }
  const userId = userData.user.id

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data: profile, error: profErr } = await admin
    .from('artist_profile')
    .select('manager_email, artist_email, from_email, reply_to_email, artist_name')
    .eq('user_id', userId)
    .maybeSingle()

  if (profErr) {
    return { statusCode: 500, headers: jsonHeaders(), body: JSON.stringify({ message: profErr.message }) }
  }
  if (!profile) {
    return { statusCode: 400, headers: jsonHeaders(), body: JSON.stringify({ message: 'No artist profile found' }) }
  }

  const toEmail =
    (typeof profile.manager_email === 'string' ? profile.manager_email.trim() : '')
    || (typeof profile.artist_email === 'string' ? profile.artist_email.trim() : '')
  if (!toEmail) {
    return {
      statusCode: 400,
      headers: jsonHeaders(),
      body: JSON.stringify({ message: 'Set Manager email or Artist email in Settings first.' }),
    }
  }

  const fromEmail = typeof profile.from_email === 'string' ? profile.from_email.trim() : ''
  if (!fromEmail) {
    return {
      statusCode: 400,
      headers: jsonHeaders(),
      body: JSON.stringify({ message: 'Set Send reports from (from_email) in Settings first.' }),
    }
  }

  const replyTo =
    (typeof profile.reply_to_email === 'string' && profile.reply_to_email.trim())
      ? profile.reply_to_email.trim()
      : fromEmail

  const artistName =
    (typeof profile.artist_name === 'string' && profile.artist_name.trim())
      ? profile.artist_name.trim()
      : 'Artist'

  const ics = buildDevSampleIcs(new Date(), artistName)
  const content = Buffer.from(ics, 'utf8').toString('base64')

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/></head>
<body style="font-family:system-ui,sans-serif;background:#111;color:#eee;padding:24px;">
<p>This is a <strong>developer test</strong> from Artist Manager.</p>
<p>Open the <strong>.ics</strong> attachment on your phone and choose <strong>Add to calendar</strong> to verify fields and timing.</p>
</body></html>`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      reply_to: [replyTo],
      subject: '[Dev] Test calendar event — Artist Manager',
      html,
      attachments: [
        {
          filename: 'booking-dev-test.ics',
          content,
          content_type: 'text/calendar; charset=UTF-8; method=PUBLISH',
        },
      ],
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.json().catch((): Record<string, unknown> => ({}))
    const msg = typeof err.message === 'string' ? err.message : 'Resend error'
    return { statusCode: resendRes.status, headers: jsonHeaders(), body: JSON.stringify({ message: msg }) }
  }

  return {
    statusCode: 200,
    headers: jsonHeaders(),
    body: JSON.stringify({ message: `Sent test .ics to ${toEmail}` }),
  }
}

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json; charset=utf-8' }
}

export { handler }
