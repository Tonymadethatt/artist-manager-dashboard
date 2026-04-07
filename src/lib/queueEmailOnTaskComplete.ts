import { supabase } from '@/lib/supabase'
import type { ArtistProfile, Contact, Deal, GeneratedFile, Task, Venue } from '@/types'
import type { VenueEmailType } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS, VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { hasRecentPendingArtistCustomEmail, hasRecentPendingVenueEmail } from '@/lib/queueEmailsFromTemplate'
import { serializePerfFormQueueNotes } from '@/lib/email/performanceFormQueuePayload'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { resolveTaskEmailAudience } from '@/lib/email/resolveTaskEmailAudience'
import { fetchReportInputsForUser } from '@/lib/reports/fetchReportInputsForUser'
import { buildRetainerReminderPayload } from '@/lib/reports/buildManagementReportData'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import {
  computeResolvedAgreement,
  dealSyncPatchFromResolution,
  isGeneratedFileInScopeForDeal,
  isGeneratedFileInScopeForTask,
} from '@/lib/resolveAgreementUrl'

async function loadGeneratedFileRow(id: string | null | undefined): Promise<GeneratedFile | null> {
  if (!id) return null
  const { data } = await supabase.from('generated_files').select('*').eq('id', id).maybeSingle()
  return (data as GeneratedFile | null) ?? null
}

function isVenueEmailType(s: string): s is VenueEmailType {
  return Object.prototype.hasOwnProperty.call(VENUE_EMAIL_TYPE_LABELS, s)
}

async function findOpenPerformanceReportDraft(
  userId: string,
  venueId: string,
  dealId: string | null | undefined,
  withinHours: number,
): Promise<{ token: string } | null> {
  const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString()
  let q = supabase
    .from('performance_reports')
    .select('token')
    .eq('user_id', userId)
    .eq('venue_id', venueId)
    .eq('submitted', false)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1)
  q = dealId ? q.eq('deal_id', dealId) : q.is('deal_id', null)
  const { data } = await q.maybeSingle()
  const row = data as { token: string } | null
  return row?.token ? { token: row.token } : null
}

/** Shown in a success (green) banner after task complete when automation succeeded. */
export function taskEmailAutomationSuccessMessage(reason: string): string | null {
  switch (reason) {
    case 'performance_report_queued':
      return 'Performance form email is in Email queue and will send shortly (buffer off). You can open Email queue to send now or cancel.'
    case 'venue_email_queued':
      return 'Email queued — open Email queue to send now or wait for auto-send.'
    default:
      return null
  }
}

export type QueueEmailOnTaskCompleteOptions = {
  /** When completing agreement_ready from the progress panel, URL is saved to the deal first. */
  agreementUrl?: string | null
}

/** User-visible explanation when `queueEmailAutomationForCompletedTask` returns `ok: false`. */
export function taskEmailAutomationUserMessage(reason: string): string {
  switch (reason) {
    case 'no_artist_email':
      return 'Add your artist email and from email in your profile so artist template emails can send.'
    case 'custom_artist_send_failed':
      return 'The artist email could not be sent from the server. Open Email queue for details or try Send now on the pending row.'
    case 'custom_template_not_found':
    case 'template_not_found':
      return 'That custom email template no longer exists. Edit the task and pick a current template.'
    case 'invalid_custom_id':
      return 'This task references an invalid custom template id. Edit the task and pick a valid template.'
    case 'no_venue_for_venue_email':
      return 'Link this task to a venue or deal so the client email can be queued and sent.'
    case 'performance_report_needs_venue':
      return 'Performance report request needs a linked venue (or deal with a venue) so the form email can include the correct show context.'
    case 'no_contact_email':
      return 'Add a contact with an email address for this venue.'
    case 'not_authenticated':
      return 'You are not signed in.'
    case 'venue_email_insert_failed':
      return 'Could not queue the email. Try again.'
    case 'unsupported_email_type':
      return 'This email type is not supported for task automation. Edit the task and pick a different option.'
    case 'no_artist_profile':
      return 'Complete your artist profile before sending the performance report request.'
    default:
      if (
        reason === 'venue_email_queued'
        || reason === 'performance_report_queued'
        || reason === 'retainer_nothing_owed'
      ) {
        return ''
      }
      return `Email automation: ${reason.replace(/_/g, ' ')}`
  }
}

/** Non-error heads-up after complete (amber), e.g. dedupe skips. */
export function taskEmailAutomationInfoMessage(reason: string): string | null {
  switch (reason) {
    case 'performance_report_recent_duplicate':
      return 'An open performance report already exists for this venue/show. Open Performance reports to copy the link or resend — no duplicate was created.'
    case 'dedupe_recent_pending':
      return 'The same email is already pending in your queue for this venue.'
    case 'agreement_ready_needs_url':
      return 'Agreement is not linked on this deal yet — add a URL or PDF in the progress panel before the agreement email can queue.'
    default:
      return null
  }
}

/**
 * Runs the same email automation as Pipeline's progress confirm (step 5), but callable from any
 * task completion path (board, list, Tasks page, progress panel).
 */
export async function queueEmailAutomationForCompletedTask(
  task: Task,
  options?: QueueEmailOnTaskCompleteOptions
): Promise<{ ok: boolean; reason: string }> {
  if (!task.email_type) {
    return { ok: true, reason: 'no_email_type' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, reason: 'not_authenticated' }
  }

  /** Task may omit venue while still linking a deal — resolve venue from the deal for email + merge context. */
  let resolvedVenueId: string | null = task.venue_id
  if (!resolvedVenueId && task.deal_id) {
    const { data: dealVenueRow } = await supabase
      .from('deals')
      .select('venue_id')
      .eq('id', task.deal_id)
      .maybeSingle()
    resolvedVenueId = (dealVenueRow as { venue_id: string } | null)?.venue_id ?? null
  }

  let v: Venue | null = null
  if (resolvedVenueId) {
    const { data: venue } = await supabase
      .from('venues')
      .select('*')
      .eq('id', resolvedVenueId)
      .maybeSingle()
    if (venue) v = venue as Venue
  }

  let venueDeals: Deal[] = []
  let primaryDeal: Deal | undefined
  if (resolvedVenueId) {
    const { data: deals } = await supabase
      .from('deals')
      .select('*')
      .eq('venue_id', resolvedVenueId)
      .order('created_at', { ascending: false })
    venueDeals = (deals ?? []) as Deal[]
    primaryDeal = task.deal_id
      ? venueDeals.find(d => d.id === task.deal_id) ?? venueDeals[0]
      : venueDeals[0]
  } else if (task.deal_id) {
    const { data: onlyDeal } = await supabase
      .from('deals')
      .select('*')
      .eq('id', task.deal_id)
      .maybeSingle()
    if (onlyDeal) {
      venueDeals = [onlyDeal as Deal]
      primaryDeal = onlyDeal as Deal
    }
  }

  const siteOrigin = publicSiteOrigin()
  let pinnedFile: GeneratedFile | null = null
  if (task.generated_file_id) {
    const f = await loadGeneratedFileRow(task.generated_file_id)
    if (f && isGeneratedFileInScopeForTask(f, user.id, resolvedVenueId ?? task.venue_id, task.deal_id)) {
      pinnedFile = f
    }
  }
  let dealCanonFile: GeneratedFile | null = null
  if (primaryDeal?.agreement_generated_file_id) {
    const f = await loadGeneratedFileRow(primaryDeal.agreement_generated_file_id)
    if (f && isGeneratedFileInScopeForDeal(f, user.id, primaryDeal.venue_id)) dealCanonFile = f
  }
  const agreementResolution = computeResolvedAgreement({
    siteOrigin,
    progressPanelUrl: options?.agreementUrl,
    pinnedFile,
    dealFile: dealCanonFile,
    dealAgreementUrl: primaryDeal?.agreement_url ?? null,
  })
  const agreementSyncPatch = dealSyncPatchFromResolution(agreementResolution)

  const audience = await resolveTaskEmailAudience(task.email_type, user.id)

  if (audience.kind === 'unknown') {
    const r = audience.reason
    if (r === 'template_not_found') return { ok: false, reason: 'custom_template_not_found' }
    return { ok: false, reason: r }
  }

  if (audience.kind === 'special') {
    if (!v || !resolvedVenueId) {
      return { ok: false, reason: 'performance_report_needs_venue' }
    }
    const { data: profile } = await supabase
      .from('artist_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const p = profile as ArtistProfile | null
    if (!p) {
      return { ok: false, reason: 'no_artist_profile' }
    }
    if (!p.artist_email || !p.from_email) {
      return { ok: false, reason: 'no_artist_email' }
    }

    const dealKey = primaryDeal?.id ?? null
    if (await findOpenPerformanceReportDraft(user.id, v.id, dealKey, 48)) {
      return { ok: true, reason: 'performance_report_recent_duplicate' }
    }
    if (await hasRecentPendingVenueEmail(v.id, 'performance_report_request', 45)) {
      return { ok: true, reason: 'dedupe_recent_pending' }
    }

    const eventDate = primaryDeal?.event_date ?? v.deal_terms?.event_date ?? null
    let token: string
    try {
      const { data: reportRow, error: insErr } = await supabase
        .from('performance_reports')
        .insert({ user_id: user.id, venue_id: v.id, deal_id: dealKey })
        .select('token')
        .single()
      if (insErr || !reportRow?.token) {
        console.error('[queueEmailOnTaskComplete] performance_reports insert:', insErr?.message)
        return { ok: false, reason: 'performance_form_failed' }
      }
      token = reportRow.token as string
    } catch (e) {
      console.error('[queueEmailOnTaskComplete] performance form:', e)
      return { ok: false, reason: 'performance_form_failed' }
    }

    const label = ARTIST_EMAIL_TYPE_LABELS.performance_report_request
    const notesPayload = serializePerfFormQueueNotes({
      token,
      venueName: v.name,
      eventDate,
    })
    const { error: qErr } = await supabase.from('venue_emails').insert({
      user_id: user.id,
      venue_id: v.id,
      deal_id: dealKey,
      contact_id: null,
      email_type: 'performance_report_request',
      recipient_email: p.artist_email,
      subject: `${label} · ${v.name}`,
      status: 'pending',
      notes: notesPayload,
    })
    if (qErr) {
      console.error('[queueEmailOnTaskComplete] performance queue insert:', qErr.message)
      return { ok: false, reason: 'venue_email_insert_failed' }
    }
    return { ok: true, reason: 'performance_report_queued' }
  }

  if (audience.kind === 'artist') {
    const { data: profile } = await supabase
      .from('artist_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    const p = profile as ArtistProfile | null
    if (!p?.artist_email || !p.from_email) {
      return { ok: false, reason: 'no_artist_email' }
    }

    if (audience.source === 'custom_artist') {
      const cid = parseCustomTemplateId(task.email_type)
      if (!cid) return { ok: false, reason: 'invalid_custom_id' }

      const { data: ctRow } = await supabase
        .from('custom_email_templates')
        .select('name')
        .eq('id', cid)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!ctRow) {
        return { ok: false, reason: 'custom_template_not_found' }
      }

      if (await hasRecentPendingArtistCustomEmail(user.id, task.email_type, p.artist_email, 45)) {
        return { ok: true, reason: 'dedupe_recent_pending' }
      }

      const { error } = await supabase.from('venue_emails').insert({
        user_id: user.id,
        venue_id: null,
        deal_id: task.deal_id ?? null,
        contact_id: null,
        email_type: task.email_type,
        recipient_email: p.artist_email,
        subject: `${ctRow.name} - ${p.artist_name}`,
        status: 'pending',
        notes: `Auto-queued from task: ${task.title}`,
      })

      if (error) {
        console.error('[queueEmailOnTaskComplete] artist custom insert failed:', error.message)
        return { ok: false, reason: 'venue_email_insert_failed' }
      }
      return { ok: true, reason: 'venue_email_queued' }
    }

    const builtin = audience.builtinType
    if (builtin === 'management_report' || builtin === 'retainer_reminder') {
      if (builtin === 'retainer_reminder') {
        const { fees } = await fetchReportInputsForUser(supabase, user.id)
        const { unpaidFees } = buildRetainerReminderPayload(fees)
        if (unpaidFees.length === 0) {
          return { ok: true, reason: 'retainer_nothing_owed' }
        }
      }

      if (await hasRecentPendingArtistCustomEmail(user.id, task.email_type, p.artist_email, 45)) {
        return { ok: true, reason: 'dedupe_recent_pending' }
      }

      const label = ARTIST_EMAIL_TYPE_LABELS[builtin]
      const { error } = await supabase.from('venue_emails').insert({
        user_id: user.id,
        venue_id: null,
        deal_id: task.deal_id ?? null,
        contact_id: null,
        email_type: task.email_type,
        recipient_email: p.artist_email,
        subject: `${label} - ${p.artist_name}`,
        status: 'pending',
        notes: `Auto-queued from task: ${task.title}`,
      })

      if (error) {
        console.error('[queueEmailOnTaskComplete] builtin artist insert failed:', error.message)
        return { ok: false, reason: 'venue_email_insert_failed' }
      }
      return { ok: true, reason: 'venue_email_queued' }
    }

    return { ok: false, reason: 'unsupported_email_type' }
  }

  // Client (venue) — builtin or custom template to venue contact
  const cid = parseCustomTemplateId(task.email_type)
  let customVenueName: string | null = null

  if (cid) {
    const { data: ctRow } = await supabase
      .from('custom_email_templates')
      .select('id, audience, name')
      .eq('id', cid)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ctRow) {
      return { ok: false, reason: 'custom_template_not_found' }
    }
    if (ctRow.audience !== 'venue') {
      return { ok: false, reason: 'unsupported_email_type' }
    }

    customVenueName = ctRow.name
  }

  if (!resolvedVenueId || !v) {
    return { ok: false, reason: 'no_venue_for_venue_email' }
  }

  const { data: contactRows } = await supabase
    .from('contacts')
    .select('id, email, name')
    .eq('venue_id', resolvedVenueId)
    .order('created_at')

  const contacts = (contactRows ?? []) as Contact[]
  const primaryContact = contacts.find(c => c.email)
  if (!primaryContact?.email) {
    return { ok: false, reason: 'no_contact_email' }
  }

  if (!isVenueEmailType(task.email_type) && !cid) {
    return { ok: false, reason: 'unsupported_email_type' }
  }

  const vType = task.email_type as string

  if (vType === 'agreement_ready' && isVenueEmailType(vType) && !agreementResolution.url) {
    return { ok: true, reason: 'agreement_ready_needs_url' }
  }

  const isVenueCustomEmail = !!cid && customVenueName !== null
  if (
    primaryDeal &&
    agreementSyncPatch &&
    ((vType === 'agreement_ready' && isVenueEmailType(vType)) || isVenueCustomEmail)
  ) {
    await supabase.from('deals').update(agreementSyncPatch).eq('id', primaryDeal.id)
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
    subject: `${customVenueName ?? VENUE_EMAIL_TYPE_LABELS[vType as VenueEmailType] ?? task.email_type} - ${v.name}`,
    status: 'pending',
    notes: `Auto-queued from task: ${task.title}`,
  })

  if (error) {
    console.error('[queueEmailOnTaskComplete] insert failed:', error.message)
    return { ok: false, reason: 'venue_email_insert_failed' }
  }

  return { ok: true, reason: 'venue_email_queued' }
}
