import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { loadPerformanceReportPublicForToken } from './performanceReportPublicLoad'

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
  const loaded = await loadPerformanceReportPublicForToken(supabase, token)

  if (!loaded) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valid: false }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      valid: true,
      ...loaded,
    }),
  }
}

export { handler }
