/**
 * Scheduled / secret-authenticated batch job: Google calendar import + dedup for all connected users.
 *
 * Auth (same pattern as process-email-queue):
 *   - Netlify scheduled invoke: header netlify-scheduled-function: true
 *   - External cron: X-Queue-Secret matching PROCESS_QUEUE_SECRET
 *
 * Does not accept client userId — eligible users come from the database only.
 */

import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { runGoogleCalendarImportForUser } from './googleCalendarSyncCore'
import { runCalendarDedupForUser } from './googleCalendarDedupCore'

/** Bound invocations vs Google quota / function duration. */
const MAX_USERS_PER_RUN = 35

function headerFirst(headers: Record<string, string | undefined>, name: string): string | undefined {
  const t = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === t && v != null && v !== '') return v
  }
  return undefined
}

function normalizeRequestHeaders(event: Parameters<Handler>[0]): Record<string, string | undefined> {
  const raw = event.headers
  if (raw == null || typeof raw !== 'object') return {}
  return raw as Record<string, string | undefined>
}

export const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server misconfigured' }),
    }
  }

  const hdrs = normalizeRequestHeaders(event)
  const secret = process.env.PROCESS_QUEUE_SECRET
  const provided = headerFirst(hdrs, 'x-queue-secret')
  const scheduledHeader = headerFirst(hdrs, 'netlify-scheduled-function')
  const fromNetlifySchedule = String(scheduledHeader) === 'true'
  const authenticated = fromNetlifySchedule || (!!secret && provided === secret)

  if (!authenticated) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unauthorized' }),
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: credRows, error: credErr } = await supabase
    .from('google_calendar_credentials')
    .select('user_id')
    .not('refresh_token', 'is', null)

  if (credErr) {
    console.error('[google-calendar-background-sync] credentials', credErr.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: credErr.message }),
    }
  }

  const { data: connRows, error: connErr } = await supabase
    .from('google_calendar_connection')
    .select('user_id, source_calendar_id, connected_at')
    .not('connected_at', 'is', null)

  if (connErr) {
    console.error('[google-calendar-background-sync] connection', connErr.message)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: connErr.message }),
    }
  }

  const connectedUserIds = new Set(
    (connRows ?? [])
      .filter(c => (c.source_calendar_id ?? '').trim().length > 0)
      .map(c => c.user_id as string),
  )

  const eligible = (credRows ?? [])
    .map(r => r.user_id as string)
    .filter(id => connectedUserIds.has(id))
    .sort()

  const batch = eligible.slice(0, MAX_USERS_PER_RUN)

  const userResults: {
    user_id: string
    import_ok: boolean
    import_error?: string
    dedup_ok: boolean
    dedup_error?: string
  }[] = []

  for (const userId of batch) {
    let importOk = false
    let importError: string | undefined
    let dedupOk = false
    let dedupError: string | undefined

    try {
      const imp = await runGoogleCalendarImportForUser(supabase, userId)
      if (imp.ok) {
        importOk = true
      } else {
        importError = imp.error
      }
    } catch (e) {
      importError = e instanceof Error ? e.message : String(e)
      console.error('[google-calendar-background-sync] import', userId, e)
    }

    try {
      const ded = await runCalendarDedupForUser(supabase, userId)
      if (ded.ok) {
        dedupOk = true
      } else {
        dedupError = ded.error
      }
    } catch (e) {
      dedupError = e instanceof Error ? e.message : String(e)
      console.error('[google-calendar-background-sync] dedup', userId, e)
    }

    userResults.push({
      user_id: userId,
      import_ok: importOk,
      import_error: importError,
      dedup_ok: dedupOk,
      dedup_error: dedupError,
    })
  }

  const importFailures = userResults.filter(r => !r.import_ok).length
  const dedupFailures = userResults.filter(r => !r.dedup_ok).length

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      eligible_total: eligible.length,
      processed: batch.length,
      capped: eligible.length > MAX_USERS_PER_RUN,
      import_failures: importFailures,
      dedup_failures: dedupFailures,
      users: userResults,
    }),
  }
}
