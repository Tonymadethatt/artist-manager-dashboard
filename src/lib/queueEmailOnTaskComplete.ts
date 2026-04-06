import { supabase } from '@/lib/supabase'
import type { ArtistProfile, Contact, Task, Venue } from '@/types'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { hasRecentPendingVenueEmail } from '@/lib/queueEmailsFromTemplate'

function isVenueEmailType(s: string): s is VenueEmailType {
  return Object.prototype.hasOwnProperty.call(VENUE_EMAIL_TYPE_LABELS, s)
}

export type QueueEmailOnTaskCompleteOptions = {
  /** When completing agreement_ready from the progress panel, URL is saved to the deal first. */
  agreementUrl?: string | null
}

/**
 * Runs the same email automation as Pipeline's progress confirm (step 5), but callable from any
 * task completion path (board, list, Tasks page, progress panel).
 */
export async function queueEmailAutomationForCompletedTask(
  task: Task,
  options?: QueueEmailOnTaskCompleteOptions
): Promise<{ ok: boolean; reason: string }> {
  if (!task.email_type || !task.venue_id) {
    return { ok: true, reason: 'no_email_type_or_venue' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, reason: 'not_authenticated' }
  }

  const { data: venue } = await supabase
    .from('venues')
    .select('*')
    .eq('id', task.venue_id)
    .single()

  if (!venue) {
    return { ok: false, reason: 'venue_not_found' }
  }

  const v = venue as Venue

  const { data: deals } = await supabase
    .from('deals')
    .select('id, event_date, agreement_url, venue_id')
    .eq('venue_id', task.venue_id)
    .order('created_at', { ascending: false })

  const venueDeals = deals ?? []
  const primaryDeal = task.deal_id
    ? venueDeals.find(d => d.id === task.deal_id) ?? venueDeals[0]
    : venueDeals[0]

  if (task.email_type === 'performance_report_request') {
    const { data: profile } = await supabase
      .from('artist_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data: perfTmpl } = await supabase
      .from('email_templates')
      .select('custom_subject, custom_intro, layout')
      .eq('user_id', user.id)
      .eq('email_type', 'performance_report_request')
      .maybeSingle()

    const p = profile as ArtistProfile | null
    if (!p) {
      return { ok: false, reason: 'no_artist_profile' }
    }

    const eventDate = primaryDeal?.event_date ?? v.deal_terms?.event_date ?? null
    try {
      const { data: reportRow } = await supabase
        .from('performance_reports')
        .insert({ user_id: user.id, venue_id: v.id, deal_id: primaryDeal?.id ?? null })
        .select('token')
        .single()
      if (reportRow?.token) {
        await fetch('/.netlify/functions/send-performance-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: reportRow.token,
            venueName: v.name,
            eventDate,
            artistName: p.artist_name,
            artistEmail: p.artist_email,
            fromEmail: p.from_email,
            replyToEmail: p.reply_to_email || p.from_email,
            managerName: p.manager_name || 'Your Manager',
            custom_subject: perfTmpl?.custom_subject ?? null,
            custom_intro: perfTmpl?.custom_intro ?? null,
            layout: perfTmpl?.layout ?? null,
          }),
        })
      }
    } catch (e) {
      console.error('[queueEmailOnTaskComplete] performance form:', e)
      return { ok: false, reason: 'performance_form_failed' }
    }
    return { ok: true, reason: 'performance_report_sent' }
  }

  const { data: contactRows } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('venue_id', task.venue_id)
    .order('created_at')

  const contacts = (contactRows ?? []) as Contact[]
  const primaryContact = contacts.find(c => c.email)
  if (!primaryContact?.email) {
    return { ok: false, reason: 'no_contact_email' }
  }

  if (!isVenueEmailType(task.email_type)) {
    return { ok: true, reason: 'not_venue_email_type' }
  }

  const vType = task.email_type

  // Progress panel passes URL on confirm; board/list completeTask has no URL — skip until URL exists on deal or options.
  if (vType === 'agreement_ready') {
    const url = options?.agreementUrl?.trim()
    if (!url && !primaryDeal?.agreement_url) {
      return { ok: true, reason: 'agreement_ready_needs_url' }
    }
    if (url && primaryDeal) {
      await supabase.from('deals').update({ agreement_url: url }).eq('id', primaryDeal.id)
    }
  }

  if (await hasRecentPendingVenueEmail(v.id, vType, 45)) {
    return { ok: true, reason: 'dedupe_recent_pending' }
  }

  const { error } = await supabase.from('venue_emails').insert({
    user_id: user.id,
    venue_id: v.id,
    deal_id: primaryDeal?.id ?? null,
    contact_id: primaryContact.id,
    email_type: vType,
    recipient_email: primaryContact.email,
    subject: `${VENUE_EMAIL_TYPE_LABELS[vType] ?? task.email_type} - ${v.name}`,
    status: 'pending',
    notes: `Auto-queued from task: ${task.title}`,
  })

  if (error) {
    console.error('[queueEmailOnTaskComplete] insert failed:', error.message)
    return { ok: false, reason: 'venue_email_insert_failed' }
  }

  return { ok: true, reason: 'venue_email_queued' }
}
