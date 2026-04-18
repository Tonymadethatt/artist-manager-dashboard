import { supabase } from '@/lib/supabase'
import { parseGigCalendarQueueNotes } from '@/lib/email/gigCalendarQueueNotes'
import type { ArtistEmailType } from '@/types'

/** Queue one show reminder to the artist (same HTML path as automated day-before; sends on next queue run). */
export async function queueManualGigReminderForDeal(
  dealId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not signed in.' }

  const { data: profile } = await supabase
    .from('artist_profile')
    .select('artist_email, from_email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!profile?.artist_email?.trim() || !profile?.from_email?.trim()) {
    return { ok: false, message: 'Set artist email and from address in Settings first.' }
  }

  const emailType: ArtistEmailType = 'gig_reminder_manual'
  const { data: pending } = await supabase
    .from('venue_emails')
    .select('id, notes')
    .eq('user_id', user.id)
    .in('status', ['pending', 'sending'])
    .eq('email_type', emailType)

  for (const row of pending ?? []) {
    const p = parseGigCalendarQueueNotes(row.notes as string | null)
    if (p?.kind === 'gig_reminder_manual' && p.dealId === dealId) {
      return { ok: false, message: 'A manual reminder for this gig is already queued. Check Email queue.' }
    }
  }

  const { data: dealRow } = await supabase
    .from('deals')
    .select('description, venue_id')
    .eq('id', dealId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!dealRow) return { ok: false, message: 'Gig not found.' }

  let venueName = (dealRow.description as string | null)?.trim() || 'Show'
  if (dealRow.venue_id) {
    const { data: v } = await supabase.from('venues').select('name').eq('id', dealRow.venue_id).maybeSingle()
    const n = (v as { name?: string } | null)?.name?.trim()
    if (n) venueName = n
  }

  const subject = `Reminder: ${venueName}`

  const { error } = await supabase.from('venue_emails').insert({
    user_id: user.id,
    venue_id: null,
    deal_id: dealId,
    contact_id: null,
    email_type: emailType,
    recipient_email: profile.artist_email.trim(),
    subject,
    status: 'pending',
    notes: JSON.stringify({ kind: 'gig_reminder_manual' as const, dealId }),
  })

  if (error) {
    console.error('[queueManualGigReminderForDeal]', error.message)
    return { ok: false, message: error.message || 'Could not queue email.' }
  }

  return { ok: true }
}
