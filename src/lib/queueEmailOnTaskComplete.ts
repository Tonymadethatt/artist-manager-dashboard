import { supabase } from '@/lib/supabase'
import type { ArtistProfile, Contact, Deal, GeneratedFile, Task, Venue } from '@/types'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { hasRecentPendingVenueEmail } from '@/lib/queueEmailsFromTemplate'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
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
      return 'The artist email could not be sent. On localhost, run Netlify Dev and use that URL (Vite alone cannot reach functions). Check the browser Network tab for send-custom-artist-email.'
    case 'custom_template_not_found':
      return 'That custom email template no longer exists. Edit the task and pick a current template.'
    case 'no_venue_for_venue_email':
      return 'Link this task to a venue or deal so the client email can be queued and sent.'
    case 'no_contact_email':
      return 'Add a contact with an email address for this venue.'
    case 'not_authenticated':
      return 'You are not signed in.'
    case 'venue_email_insert_failed':
      return 'Could not queue the email. Try again.'
    default:
      if (reason === 'custom_artist_sent' || reason === 'venue_email_queued' || reason === 'performance_report_sent') {
        return ''
      }
      return `Email automation: ${reason.replace(/_/g, ' ')}`
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
  const dealForMerge: Deal | undefined =
    primaryDeal && agreementSyncPatch ? { ...primaryDeal, ...agreementSyncPatch } : primaryDeal

  if (task.email_type === 'performance_report_request') {
    if (!v || !resolvedVenueId) {
      return { ok: true, reason: 'performance_report_needs_venue' }
    }
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

  const cid = parseCustomTemplateId(task.email_type)
  let customVenueName: string | null = null

  if (cid) {
    const { data: ctRow } = await supabase
      .from('custom_email_templates')
      .select('id, audience, name, subject_template, blocks, attachment_generated_file_id')
      .eq('id', cid)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!ctRow) {
      return { ok: false, reason: 'custom_template_not_found' }
    }

    if (ctRow.audience === 'artist') {
      const { data: profile } = await supabase
        .from('artist_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      const p = profile as ArtistProfile | null
      if (!p?.artist_email || !p.from_email) {
        return { ok: false, reason: 'no_artist_email' }
      }

      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      const dealPayload = dealForMerge
        ? {
          description: dealForMerge.description ?? '',
          gross_amount: dealForMerge.gross_amount,
          event_date: dealForMerge.event_date,
          payment_due_date: dealForMerge.payment_due_date,
          agreement_url: dealForMerge.agreement_url,
          notes: dealForMerge.notes,
        }
        : undefined

      let attachment: { url: string; fileName: string } | undefined
      const attachId = ctRow.attachment_generated_file_id as string | null | undefined
      if (attachId) {
        const gf = await loadGeneratedFileRow(attachId)
        const att = gf && gf.user_id === user.id ? buildEmailAttachmentPayloadFromFile(gf, siteOrigin) : null
        if (att) attachment = att
      }

      try {
        const res = await fetch(`${origin}/.netlify/functions/send-custom-artist-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            custom_artist_template: {
              subject_template: ctRow.subject_template,
              blocks: ctRow.blocks,
            },
            ...(attachment ? { attachment } : {}),
            profile: {
              artist_name: p.artist_name,
              company_name: p.company_name,
              from_email: p.from_email,
              reply_to_email: p.reply_to_email,
              website: p.website,
              phone: p.phone,
              social_handle: p.social_handle,
              tagline: p.tagline,
            },
            recipient: {
              name: p.artist_name.split(/\s+/)[0] || p.artist_name,
              email: p.artist_email,
            },
            deal: dealPayload,
            venue: {
              name: v?.name ?? '',
              city: v?.city ?? null,
              location: v?.location ?? null,
            },
          }),
        })
        const rawText = await res.text()
        let parsed: { message?: string; subject?: string } | null = null
        try {
          parsed = rawText ? (JSON.parse(rawText) as { message?: string; subject?: string }) : null
        } catch {
          parsed = null
        }
        const sentOk = res.ok && parsed?.message === 'Email sent successfully'
        if (!sentOk) {
          console.error('[queueEmailOnTaskComplete] custom artist: bad response', res.status, rawText.slice(0, 300))
          return { ok: false, reason: 'custom_artist_send_failed' }
        }
        const subjectLine =
          typeof parsed?.subject === 'string' && parsed.subject.trim()
            ? parsed.subject.trim()
            : `${ctRow.name} (artist template)`
        const { error: logErr } = await supabase.from('venue_emails').insert({
          user_id: user.id,
          venue_id: null,
          deal_id: task.deal_id ?? null,
          contact_id: null,
          email_type: task.email_type,
          recipient_email: p.artist_email,
          subject: subjectLine,
          status: 'sent',
          sent_at: new Date().toISOString(),
          notes: `Sent immediately (artist custom template: ${ctRow.name}). Task: ${task.title}`,
        })
        if (logErr) {
          console.warn('[queueEmailOnTaskComplete] custom artist: email sent but history log failed:', logErr.message)
        }
      } catch (e) {
        console.error('[queueEmailOnTaskComplete] custom artist:', e)
        return { ok: false, reason: 'custom_artist_send_failed' }
      }
      return { ok: true, reason: 'custom_artist_sent' }
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
    return { ok: true, reason: 'not_venue_email_type' }
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
