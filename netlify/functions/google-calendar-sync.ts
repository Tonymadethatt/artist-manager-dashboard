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
  const dealPush = await pushAllQualifyingDealsToGoogleCalendar({
    supabase,
    userId: userData.user.id,
    clientId,
    clientSecret,
  })

  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58b41d' },
    body: JSON.stringify({
      sessionId: '58b41d',
      hypothesisId: 'D',
      location: 'google-calendar-sync.ts:handler',
      message: 'sync response summary',
      data: {
        imported: result.summary.imported,
        dealPushOAuthConfigured: dealPush.dealPushOAuthConfigured,
        dealsLoaded: dealPush.dealPushScan.dealsLoaded,
        qualifiedByLookup: dealPush.dealPushScan.qualifiedByLookup,
        dealPushAttempted: dealPush.dealPushAttempted,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...result.summary,
      ...dealPush,
    }),
  }
}
