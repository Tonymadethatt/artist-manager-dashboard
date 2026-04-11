import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { getGoogleOAuthEnv } from './googleCalendarOAuthShared'
import { pushAllQualifyingDealsToGoogleCalendar } from './googleCalendarDealPushCore'
import { runGoogleCalendarImportForUser } from './googleCalendarSyncCore'

/**
 * POST with Authorization: Bearer <Supabase JWT>.
 * Imports events from the shared source calendar into the app (calendar_sync_event + Gig calendar),
 * then pushes calendar-qualified deals to Google so new/edited gigs appear on the shared calendar.
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

  const result = await runGoogleCalendarImportForUser(supabase, userData.user.id)
  if (!result.ok) {
    return {
      statusCode: result.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: result.error }),
    }
  }

  const { clientId, clientSecret } = getGoogleOAuthEnv()
  const dealPush =
    clientId && clientSecret
      ? await pushAllQualifyingDealsToGoogleCalendar({
          supabase,
          userId: userData.user.id,
          clientId,
          clientSecret,
        })
      : null

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...result.summary,
      ...(dealPush ?? {}),
    }),
  }
}
