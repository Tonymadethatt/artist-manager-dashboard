import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'

/**
 * POST with Authorization: Bearer <Supabase JWT>.
 * Removes stored Google tokens (server-side only table).
 */
export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' }),
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

  const userId = userData.user.id

  await supabase.from('google_calendar_credentials').delete().eq('user_id', userId)

  await supabase
    .from('google_calendar_connection')
    .update({
      google_email: null,
      connected_at: null,
      last_sync_at: null,
      last_sync_summary: null,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }
}
