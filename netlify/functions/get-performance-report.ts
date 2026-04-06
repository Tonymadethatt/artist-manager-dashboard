import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'

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
    .select('id, token, submitted, venues(name), deals(description, event_date)')
    .eq('token', token)
    .single()

  if (error || !data) {
    // Return same response whether token never existed or was exhausted - prevents probing
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  const venue = data.venues as { name: string } | null
  const deal = data.deals as { description: string; event_date: string | null } | null

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      submitted: data.submitted,
      venueName: venue?.name ?? null,
      eventDate: deal?.event_date ?? null,
      dealDescription: deal?.description ?? null,
    }),
  }
}

export { handler }
