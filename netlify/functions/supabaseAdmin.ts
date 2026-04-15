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

export type FetchEmailTestModeResult =
  | { ok: true; row: EmailTestModeRow | null }
  | { ok: false; statusCode: number; message: string }

/**
 * Load test-mode flags for a live send. Fail-closed: missing user_id or DB errors abort the send
 * so we never deliver to real recipients while unable to verify whether test mode is enabled.
 * Template previews (`testOnly`) skip the database entirely.
 */
export async function fetchEmailTestModeRowForSend(
  userId: string | undefined | null,
  testOnly: boolean,
): Promise<FetchEmailTestModeResult> {
  if (testOnly) {
    return { ok: true, row: null }
  }
  const uid = typeof userId === 'string' ? userId.trim() : ''
  if (!uid) {
    return {
      ok: false,
      statusCode: 400,
      message: 'user_id is required to send email.',
    }
  }
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      ok: false,
      statusCode: 503,
      message: 'Email send is unavailable: database not configured on server.',
    }
  }
  const { data, error } = await supabase
    .from('artist_profile')
    .select('email_test_mode, email_test_artist_inbox, email_test_client_inbox')
    .eq('user_id', uid)
    .maybeSingle()
  if (error) {
    console.error('[fetchEmailTestModeRowForSend] artist_profile select error:', error.message)
    return {
      ok: false,
      statusCode: 503,
      message: 'Could not verify email safety settings; send aborted. Try again shortly.',
    }
  }
  if (!data) {
    return { ok: true, row: null }
  }
  return {
    ok: true,
    row: {
      email_test_mode: !!data.email_test_mode,
      email_test_artist_inbox: data.email_test_artist_inbox ?? null,
      email_test_client_inbox: data.email_test_client_inbox ?? null,
    },
  }
}
