import { supabase } from '@/lib/supabase'
import { parseGigCalendarQueueNotes } from '@/lib/email/gigCalendarQueueNotes'
import { pacificWallToUtcIso } from '@/lib/calendar/pacificWallTime'

/** Queue a one-day gig list to the artist (same pipeline as digest; buffer 0). */
export async function queueManualGigDaySummary(ymd: string): Promise<{ ok: true } | { ok: false; message: string }> {
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

  const { data: pending } = await supabase
    .from('venue_emails')
    .select('id, notes')
    .eq('user_id', user.id)
    .in('status', ['pending', 'sending'])
    .eq('email_type', 'gig_day_summary_manual')

  for (const row of pending ?? []) {
    const p = parseGigCalendarQueueNotes(row.notes as string | null)
    if (p?.kind === 'gig_day_summary_manual' && p.ymd === ymd) {
      return { ok: false, message: 'A summary for this day is already queued. Check Email queue.' }
    }
  }

  const noonIso = pacificWallToUtcIso(ymd, '12:00')
  const dayLabel = noonIso
    ? new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'America/Los_Angeles',
    }).format(new Date(noonIso))
    : ymd

  const subject = `Your gigs — ${dayLabel}`

  const { error } = await supabase.from('venue_emails').insert({
    user_id: user.id,
    venue_id: null,
    deal_id: null,
    contact_id: null,
    email_type: 'gig_day_summary_manual',
    recipient_email: profile.artist_email.trim(),
    subject,
    status: 'pending',
    notes: JSON.stringify({ kind: 'gig_day_summary_manual' as const, ymd }),
  })

  if (error) {
    console.error('[queueManualGigDaySummary]', error.message)
    return { ok: false, message: error.message || 'Could not queue email.' }
  }

  return { ok: true }
}
