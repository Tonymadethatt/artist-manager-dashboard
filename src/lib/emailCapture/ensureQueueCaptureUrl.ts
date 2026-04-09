import type { SupabaseClient } from '@supabase/supabase-js'
import type { VenueEmailType } from '../../types'
import type { EmailCaptureKind } from './kinds'
import { isVenueEmailOneTapAckKind, venueEmailAckPublicUrl, venueEmailTypeToCaptureKind } from './kinds'
import { appendEmailCaptureTokenNote, parseEmailCaptureTokenFromNotes } from './tokenNotes'
import { defaultEmailCaptureExpiresAt } from './expiry'

export async function ensureQueueCaptureUrl(
  supabase: SupabaseClient,
  email: {
    id: string
    user_id: string
    venue_id: string | null
    deal_id: string | null
    contact_id: string | null
    email_type: string
    notes: string | null
  },
  siteUrl: string,
  /** When `email_type` is `custom:<uuid>`, use capture kind from saved template blocks. */
  kindOverride?: EmailCaptureKind | null,
): Promise<string | null> {
  const kind =
    venueEmailTypeToCaptureKind(email.email_type as VenueEmailType)
    ?? (kindOverride ?? null)
  if (!kind || !isVenueEmailOneTapAckKind(kind)) return null

  let tokenUuid = parseEmailCaptureTokenFromNotes(email.notes)
  if (!tokenUuid) {
    const { data: ins, error } = await supabase
      .from('email_capture_tokens')
      .insert({
        user_id: email.user_id,
        kind,
        venue_id: email.venue_id,
        deal_id: email.deal_id,
        contact_id: email.contact_id,
        venue_emails_id: email.id,
        expires_at: defaultEmailCaptureExpiresAt(),
      })
      .select('token')
      .single()

    if (error || !ins?.token) {
      console.error('[ensureQueueCaptureUrl] insert:', error?.message)
      return null
    }
    tokenUuid = ins.token as string
    const newNotes = appendEmailCaptureTokenNote(email.notes, tokenUuid)
    await supabase.from('venue_emails').update({ notes: newNotes }).eq('id', email.id)
  } else {
    await supabase
      .from('email_capture_tokens')
      .update({ venue_emails_id: email.id })
      .eq('token', tokenUuid)
      .is('venue_emails_id', null)
  }

  return venueEmailAckPublicUrl(siteUrl, tokenUuid)
}
