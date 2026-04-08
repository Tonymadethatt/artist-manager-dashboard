import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { isEmailCaptureKind } from '../../src/lib/emailCapture/kinds'
import { brandingFromArtistProfileRow } from '../../src/lib/publicFormBranding'

const ARTIST_PROFILE_SELECT =
  'company_name, artist_name, tagline, manager_name, manager_title, website, social_handle, phone, reply_to_email, from_email, manager_email'

async function brandingForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data: row } = await supabase
    .from('artist_profile')
    .select(ARTIST_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle()
  return brandingFromArtistProfileRow(row)
}

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
      user_id,
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

  const userId = data.user_id as string

  if (data.consumed_at) {
    const venue = data.venue as { name: string } | null
    const branding = await brandingForUser(supabase, userId)
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        valid: true,
        submitted: true,
        kind: data.kind,
        venueName: venue?.name ?? null,
        branding,
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
  const branding = await brandingForUser(supabase, userId)

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
      branding,
    }),
  }
}

export { handler }
