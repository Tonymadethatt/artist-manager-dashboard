import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  calendarOAuthBaseUrl,
  getGoogleOAuthEnv,
  GOOGLE_CALENDAR_EVENTS_SCOPE,
  signOAuthState,
} from './googleCalendarOAuthShared'

/**
 * POST with Authorization: Bearer <Supabase JWT>.
 * Returns { url } to open in the same window for Google consent.
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { clientId, clientSecret, stateSecret } = getGoogleOAuthEnv()
  if (!clientId || !clientSecret || !stateSecret) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Google OAuth is not configured on the server.' }),
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

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const { data: userData, error: userErr } = await supabase.auth.getUser(auth)
  if (userErr || !userData.user) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid session' }),
    }
  }

  const base = calendarOAuthBaseUrl()
  const redirectUri = `${base}/.netlify/functions/google-calendar-oauth-callback`
  const state = signOAuthState(userData.user.id, stateSecret)
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: GOOGLE_CALENDAR_EVENTS_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  })
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }
}
