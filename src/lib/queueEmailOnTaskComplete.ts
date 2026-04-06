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
  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:entry', message: 'queueEmailAutomationForCompletedTask', data: { hypothesisId: 'H1', taskId: task.id, hasEmailType: !!task.email_type, hasVenueId: !!task.venue_id, emailType: task.email_type ?? null }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion

  if (!task.email_type || !task.venue_id) {
    return { ok: true, reason: 'no_email_type_or_venue' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:auth', message: 'not_authenticated', data: { hypothesisId: 'H2', taskId: task.id }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
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
      .select('custom_subject, custom_intro')
      .eq('user_id', user.id)
      .eq('email_type', 'performance_report_request')
      .maybeSingle()

    const p = profile as ArtistProfile | null
    if (!p) {
      // #region agent log
      fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:perf', message: 'no_artist_profile', data: { hypothesisId: 'H3', taskId: task.id }, timestamp: Date.now() }) }).catch(() => {})
      // #endregion
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
          }),
        })
      }
    } catch (e) {
      console.error('[queueEmailOnTaskComplete] performance form:', e)
      return { ok: false, reason: 'performance_form_failed' }
    }
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:perf_done', message: 'performance_report_ok', data: { hypothesisId: 'H3', taskId: task.id }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:contact', message: 'no_contact_email', data: { hypothesisId: 'H4', taskId: task.id, venueId: task.venue_id }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:dedupe', message: 'skip_duplicate_pending', data: { hypothesisId: 'H5', taskId: task.id, emailType: vType }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:insert_err', message: error.message, data: { hypothesisId: 'H5', taskId: task.id }, timestamp: Date.now() }) }).catch(() => {})
    // #endregion
    return { ok: false, reason: 'venue_email_insert_failed' }
  }

  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'cfe38b' }, body: JSON.stringify({ sessionId: 'cfe38b', location: 'queueEmailOnTaskComplete.ts:queued', message: 'venue_email_queued', data: { hypothesisId: 'H1', taskId: task.id, emailType: vType }, timestamp: Date.now() }) }).catch(() => {})
  // #endregion
  return { ok: true, reason: 'venue_email_queued' }
}
