import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { EmailTestModeRow } from '../../src/lib/email/emailTestModeServer'

let client: SupabaseClient | null = null

export function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!client) client = createClient(url, key)
  return client
}

export async function fetchEmailTestModeRow(userId: string | undefined | null): Promise<EmailTestModeRow | null> {
  if (!userId) return null
  const supabase = getServiceSupabase()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('artist_profile')
    .select('email_test_mode, email_test_artist_inbox, email_test_client_inbox')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return {
    email_test_mode: !!data.email_test_mode,
    email_test_artist_inbox: data.email_test_artist_inbox ?? null,
    email_test_client_inbox: data.email_test_client_inbox ?? null,
  }
}
