import { supabase } from '@/lib/supabase'
import type { ArtistProfile, Contact, Deal, Task, Venue } from '@/types'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { hasRecentPendingVenueEmail } from '@/lib/queueEmailsFromTemplate'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'

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
    .select('*')
    .eq('venue_id', task.venue_id)
    .order('created_at', { ascending: false })

  const venueDeals = (deals ?? []) as Deal[]
  const primaryDeal: Deal | undefined = task.deal_id
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

  const cid = parseCustomTemplateId(task.email_type)
  let customVenueName: string | null = null

  if (cid) {
    const { data: ctRow } = await supabase
      .from('custom_email_templates')
      .select('id, audience, name, subject_template, blocks')
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
      const dealPayload = primaryDeal
        ? {
          description: primaryDeal.description ?? '',
          gross_amount: primaryDeal.gross_amount,
          event_date: primaryDeal.event_date,
          payment_due_date: primaryDeal.payment_due_date,
          agreement_url: primaryDeal.agreement_url,
          notes: primaryDeal.notes,
        }
        : undefined

      try {
        const res = await fetch(`${origin}/.netlify/functions/send-custom-artist-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            custom_artist_template: {
              subject_template: ctRow.subject_template,
              blocks: ctRow.blocks,
            },
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
              name: v.name,
              city: v.city ?? null,
              location: v.location ?? null,
            },
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Send failed' }))
          console.error('[queueEmailOnTaskComplete] custom artist:', err)
          return { ok: false, reason: 'custom_artist_send_failed' }
        }
      } catch (e) {
        console.error('[queueEmailOnTaskComplete] custom artist:', e)
        return { ok: false, reason: 'custom_artist_send_failed' }
      }
      return { ok: true, reason: 'custom_artist_sent' }
    }

    customVenueName = ctRow.name
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

  if (!isVenueEmailType(task.email_type) && !cid) {
    return { ok: true, reason: 'not_venue_email_type' }
  }

  const vType = task.email_type as string

  // Progress panel passes URL on confirm; board/list completeTask has no URL — skip until URL exists on deal or options.
  if (vType === 'agreement_ready' && isVenueEmailType(vType)) {
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
