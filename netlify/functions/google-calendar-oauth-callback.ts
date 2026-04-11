import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  calendarOAuthBaseUrl,
  exchangeCodeForTokens,
  fetchGoogleEmail,
  getGoogleOAuthEnv,
  verifyOAuthState,
} from './googleCalendarOAuthShared'

/**
 * Google redirects here with ?code=&state=
 */
export const handler: Handler = async event => {
  const base = calendarOAuthBaseUrl()
  const settingsUrl = `${base}/settings?calendar_oauth=`

  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const { clientId, clientSecret, stateSecret } = getGoogleOAuthEnv()
  if (!clientId || !clientSecret || !stateSecret) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}misconfigured` },
      body: '',
    }
  }

  const qs = event.queryStringParameters ?? {}
  const err = qs.error
  if (err) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}denied` },
      body: '',
    }
  }

  const code = qs.code
  const state = qs.state
  if (!code || !state) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}invalid` },
      body: '',
    }
  }

  const verified = verifyOAuthState(state, stateSecret)
  if (!verified) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}bad_state` },
      body: '',
    }
  }

  const redirectUri = `${base}/.netlify/functions/google-calendar-oauth-callback`

  let accessToken: string
  let refreshToken: string | undefined
  let expiresIn: number
  try {
    const tokens = await exchangeCodeForTokens({
      code,
      clientId,
      clientSecret,
      redirectUri,
    })
    accessToken = tokens.access_token
    refreshToken = tokens.refresh_token
    expiresIn = tokens.expires_in
  } catch {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}token_failed` },
      body: '',
    }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}server` },
      body: '',
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const userId = verified.uid

  const { data: existingCred } = await supabase
    .from('google_calendar_credentials')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  const refresh = refreshToken ?? existingCred?.refresh_token
  if (!refresh) {
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}no_refresh` },
      body: '',
    }
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()

  const { error: credErr } = await supabase.from('google_calendar_credentials').upsert(
    {
      user_id: userId,
      refresh_token: refresh,
      access_token: accessToken,
      access_token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )
  if (credErr) {
    console.error('[google-calendar-oauth-callback] credentials', credErr)
    return {
      statusCode: 302,
      headers: { Location: `${settingsUrl}db` },
      body: '',
    }
  }

  const email = await fetchGoogleEmail(accessToken)

  const { data: existingConn } = await supabase
    .from('google_calendar_connection')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingConn) {
    const { error: insErr } = await supabase.from('google_calendar_connection').insert({
      user_id: userId,
      google_email: email,
      source_calendar_id: '',
      destination_calendar_id: 'primary',
      sync_past_days: 7,
      sync_future_days: 180,
      connected_at: new Date().toISOString(),
    })
    if (insErr) {
      console.error('[google-calendar-oauth-callback] connection insert', insErr)
      return {
        statusCode: 302,
        headers: { Location: `${settingsUrl}db` },
        body: '',
      }
    }
  } else {
    const { error: upErr } = await supabase
      .from('google_calendar_connection')
      .update({
        google_email: email,
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (upErr) {
      console.error('[google-calendar-oauth-callback] connection update', upErr)
    }
  }

  return {
    statusCode: 302,
    headers: { Location: `${settingsUrl}success` },
    body: '',
  }
}
