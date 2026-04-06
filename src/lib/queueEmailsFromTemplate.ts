import { supabase } from '@/lib/supabase'
import type { TaskTemplate } from '@/types'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

function isVenueEmailType(s: string): s is VenueEmailType {
  return Object.prototype.hasOwnProperty.call(VENUE_EMAIL_TYPE_LABELS, s)
}

/**
 * When a task template creates immediate tasks (days_offset === 0) with a venue email action,
 * queue those emails automatically. Pipeline previously only queued when a task was *completed*.
 */
export async function queueImmediateEmailsForTemplate(
  venueId: string,
  template: TaskTemplate,
  dealId: string | null | undefined
): Promise<{ queued: number; skippedReason?: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { queued: 0, skippedReason: 'not_authenticated' }

  const { data: contacts } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('venue_id', venueId)
    .order('created_at')

  const primary = contacts?.find(c => c.email) ?? contacts?.[0]
  if (!primary?.email) return { queued: 0, skippedReason: 'no_contact_email' }

  const { data: venueRow } = await supabase.from('venues').select('name').eq('id', venueId).single()
  const venueName = venueRow?.name ?? 'Venue'

  let queued = 0
  for (const item of template.items ?? []) {
    if (!item.email_type || item.days_offset !== 0) continue

    // Artist-only flows (performance form, etc.) stay on Pipeline task completion.
    if (item.email_type === 'performance_report_request') continue

    if (!isVenueEmailType(item.email_type)) continue

    const emailType = item.email_type
    const subject = `${VENUE_EMAIL_TYPE_LABELS[emailType]} - ${venueName}`
    const { error } = await supabase.from('venue_emails').insert({
      user_id: user.id,
      venue_id: venueId,
      deal_id: dealId ?? null,
      contact_id: primary.id,
      email_type: emailType,
      recipient_email: primary.email,
      subject,
      status: 'pending',
      notes: `Auto-queued from template task: ${item.title}`,
    })
    if (!error) queued += 1
  }

  return { queued }
}

/** Avoid queueing the same venue email twice when a task was auto-queued from a template and then completed in Pipeline. */
export async function hasRecentPendingVenueEmail(
  venueId: string,
  emailType: VenueEmailType,
  withinMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('venue_emails')
    .select('id')
    .eq('venue_id', venueId)
    .eq('email_type', emailType)
    .eq('status', 'pending')
    .gte('created_at', since)
    .limit(1)
  return (rows?.length ?? 0) > 0
}
