import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { normalizeTestInbox, type EmailTestModeRow } from '../../src/lib/email/emailTestModeServer'

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
    return {
      ok: false,
      statusCode: 503,
      message:
        'Artist profile not found for this account; cannot verify email test mode. Open Settings once to initialize your profile, then retry.',
    }
  }
  const testModeOn = !!data.email_test_mode
  if (testModeOn) {
    const artistBox = normalizeTestInbox(data.email_test_artist_inbox)
    const clientBox = normalizeTestInbox(data.email_test_client_inbox)
    if (!artistBox || !clientBox) {
      return {
        ok: false,
        statusCode: 400,
        message:
          'Email test mode is on but both test inboxes must be set in Settings (artist + client) before any email can send. Turn test mode off or fill both addresses.',
      }
    }
    if (artistBox.trim().toLowerCase() === clientBox.trim().toLowerCase()) {
      return {
        ok: false,
        statusCode: 400,
        message:
          'Email test mode: artist and client test inboxes must be different addresses so venue and artist sends do not collapse into one mailbox by mistake.',
      }
    }
  }
  return {
    ok: true,
    row: {
      email_test_mode: testModeOn,
      email_test_artist_inbox: data.email_test_artist_inbox ?? null,
      email_test_client_inbox: data.email_test_client_inbox ?? null,
    },
  }
}

/** After a successful Resend POST /emails — powers Email Queue usage for sends without a venue_emails row (e.g. template tests). Idempotent per resend_message_id. */
export async function logResendOutboundSendForUsage(args: {
  userId: string | undefined | null
  resendMessageId: string | null | undefined
  source: string
}): Promise<void> {
  const uid = typeof args.userId === 'string' ? args.userId.trim() : ''
  const rid = typeof args.resendMessageId === 'string' ? args.resendMessageId.trim() : ''
  if (!uid || !rid) return
  const supabase = getServiceSupabase()
  if (!supabase) {
    console.warn('[logResendOutboundSendForUsage] service supabase not configured')
    return
  }
  const src = args.source.trim().slice(0, 200) || 'unknown'
  const { error } = await supabase.from('resend_outbound_send_log').upsert(
    {
      user_id: uid,
      resend_message_id: rid,
      source: src,
      sent_at: new Date().toISOString(),
    },
    { onConflict: 'resend_message_id', ignoreDuplicates: true },
  )
  if (error) {
    console.warn('[logResendOutboundSendForUsage]', error.message)
  }
}
