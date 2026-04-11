import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { getGoogleOAuthEnv } from './googleCalendarOAuthShared'
import { performGoogleCalendarDealPush } from './googleCalendarDealPushCore'

/**
 * POST JSON { dealId: string } with Authorization: Bearer <Supabase JWT>.
 * Creates/updates/deletes Google Calendar event on shared source calendar to match deal.
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  const { clientId, clientSecret } = getGoogleOAuthEnv()
  if (!clientId || !clientSecret) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Google OAuth is not configured.' }),
    }
  }

  const auth =
    event.headers.authorization?.replace(/^Bearer\s+/i, '') ||
    event.headers.Authorization?.replace(/^Bearer\s+/i, '')
  if (!auth) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing Authorization' }),
    }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server misconfigured' }),
    }
  }

  let dealId: string
  try {
    const body = JSON.parse(event.body || '{}') as { dealId?: string }
    dealId = (body.dealId ?? '').trim()
    if (!dealId) throw new Error('dealId required')
  } catch {
    return {
      statusCode: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON or missing dealId' }),
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userErr } = await supabase.auth.getUser(auth)
  if (userErr || !userData.user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid session' }),
    }
  }

  const r = await performGoogleCalendarDealPush({
    supabase,
    userId: userData.user.id,
    dealId,
    clientId,
    clientSecret,
  })

  if (!r.ok) {
    return {
      statusCode: r.httpStatus,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: r.error }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, action: r.action, eventId: r.eventId }),
  }
}
