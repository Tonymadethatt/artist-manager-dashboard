import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { isEmailCaptureKind } from '../../src/lib/emailCapture/kinds'

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ valid: false }) }
  }

  const token = event.queryStringParameters?.token?.trim()
  if (!token) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await supabase
    .from('email_capture_tokens')
    .select(`
      id,
      kind,
      consumed_at,
      expires_at,
      venue:venues(name),
      deal:deals(description, event_date)
    `)
    .eq('token', token)
    .single()

  if (error || !data || !isEmailCaptureKind(data.kind as string)) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  if (data.consumed_at) {
    const venue = data.venue as { name: string } | null
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: true,
        submitted: true,
        kind: data.kind,
        venueName: venue?.name ?? null,
      }),
    }
  }

  const exp = new Date(data.expires_at as string).getTime()
  if (Number.isFinite(exp) && exp < Date.now()) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  const venue = data.venue as { name: string } | null
  const deal = data.deal as { description: string; event_date: string | null } | null

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      submitted: false,
      kind: data.kind,
      venueName: venue?.name ?? null,
      dealDescription: deal?.description ?? null,
      eventDate: deal?.event_date ?? null,
    }),
  }
}

export { handler }
