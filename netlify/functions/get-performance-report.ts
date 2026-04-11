import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { brandingFromArtistProfileRow } from '../../src/lib/publicFormBranding'
import {
  resolveVenuePromiseLinesForDeal,
  resolveArtistPromiseLinesForDeal,
} from '../../src/lib/showReportCatalog'

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
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const token = event.queryStringParameters?.token
  if (!token) {
    return { statusCode: 400, body: JSON.stringify({ valid: false }) }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: JSON.stringify({ valid: false }) }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data, error } = await supabase
    .from('performance_reports')
    .select(
      'id, token, submitted, user_id, venues(name), deals(description, event_date, gross_amount, promise_lines)',
    )
    .eq('token', token)
    .single()

  if (error || !data) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  const venue = data.venues as { name: string } | null
  const deal = data.deals as {
    description: string
    event_date: string | null
    gross_amount: number | null
    promise_lines: unknown
  } | null
  const userId = data.user_id as string
  const branding = await brandingForUser(supabase, userId)
  const venuePromiseLines = resolveVenuePromiseLinesForDeal(deal?.promise_lines ?? null)
  const artistPromiseLines = resolveArtistPromiseLinesForDeal(deal?.promise_lines ?? null)

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      submitted: data.submitted,
      venueName: venue?.name ?? null,
      eventDate: deal?.event_date ?? null,
      dealDescription: deal?.description ?? null,
      dealGrossAmount:
        deal?.gross_amount != null && Number.isFinite(Number(deal.gross_amount))
          ? Number(deal.gross_amount)
          : null,
      promiseLines: venuePromiseLines,
      venuePromiseLines,
      artistPromiseLines,
      branding,
    }),
  }
}

export { handler }
