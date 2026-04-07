import { supabase } from '@/lib/supabase'
import type { ArtistProfile, Deal, GeneratedFile, TaskTemplate } from '@/types'
import type { VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
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
  const siteOrigin = publicSiteOrigin()

  let dealRow: Deal | null = null
  if (dealId) {
    const { data: d } = await supabase.from('deals').select('*').eq('id', dealId).maybeSingle()
    dealRow = (d as Deal | null) ?? null
  }

  for (const item of template.items ?? []) {
    if (!item.email_type || item.days_offset !== 0) continue

    // Performance form is queued only on task completion (needs venue context).
    if (item.email_type === 'performance_report_request') continue

    const customId = parseCustomTemplateId(item.email_type)

    if (customId) {
      const { data: ct0 } = await supabase
        .from('custom_email_templates')
        .select('name, audience')
        .eq('id', customId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (ct0?.audience === 'artist') {
        const { data: profile } = await supabase
          .from('artist_profile')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        const p = profile as ArtistProfile | null
        if (!p?.artist_email || !p.from_email) continue
        if (await hasRecentPendingArtistCustomEmail(user.id, item.email_type, p.artist_email, 45)) continue

        const { error: artistErr } = await supabase.from('venue_emails').insert({
          user_id: user.id,
          venue_id: null,
          deal_id: dealId ?? null,
          contact_id: null,
          email_type: item.email_type,
          recipient_email: p.artist_email,
          subject: `${ct0.name} - ${p.artist_name}`,
          status: 'pending',
          notes: `Auto-queued from template task: ${item.title}`,
        })
        if (artistErr) {
          console.error('[queueEmailsFromTemplate] artist custom insert failed:', artistErr.message)
        } else {
          queued += 1
        }
        continue
      }
    }

    if (!isVenueEmailType(item.email_type) && !customId) continue

    let pinnedFile: GeneratedFile | null = null
    if (item.generated_file_id) {
      const f = await loadGeneratedFileRow(item.generated_file_id)
      if (f && f.user_id === user.id && isGeneratedFileInScopeForTask(f, user.id, venueId, dealId ?? null)) {
        pinnedFile = f
      }
    }
    let dealCanonFile: GeneratedFile | null = null
    if (dealRow?.agreement_generated_file_id) {
      const f = await loadGeneratedFileRow(dealRow.agreement_generated_file_id)
      if (f && isGeneratedFileInScopeForDeal(f, user.id, dealRow.venue_id)) dealCanonFile = f
    }
    const resolution = computeResolvedAgreement({
      siteOrigin,
      progressPanelUrl: null,
      pinnedFile,
      dealFile: dealCanonFile,
      dealAgreementUrl: dealRow?.agreement_url ?? null,
    })
    const syncPatch = dealSyncPatchFromResolution(resolution)
    const shouldPersist =
      dealRow &&
      syncPatch &&
      (item.email_type === 'agreement_ready' || !!customId)
    if (shouldPersist && dealRow) {
      await supabase.from('deals').update(syncPatch).eq('id', dealRow.id)
      dealRow = { ...dealRow, ...syncPatch }
    }

    if (item.email_type === 'agreement_ready' && !resolution.url) continue

    let subject: string
    if (customId) {
      const { data: ct } = await supabase
        .from('custom_email_templates')
        .select('name, audience')
        .eq('id', customId)
        .eq('user_id', user.id)
        .maybeSingle()
      if (!ct || ct.audience !== 'venue') continue
      subject = `${ct.name} - ${venueName}`
    } else {
      const emailType = item.email_type as VenueEmailType
      subject = `${VENUE_EMAIL_TYPE_LABELS[emailType]} - ${venueName}`
    }

    const emailType = item.email_type
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
    if (error) {
      console.error('[queueEmailsFromTemplate] insert failed:', error.message)
    } else {
      queued += 1
    }
  }

  return { queued }
}

/** Avoid queueing the same venue email twice when a task was auto-queued from a template and then completed in Pipeline. */
export async function hasRecentPendingVenueEmail(
  venueId: string,
  emailType: string,
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

/** Dedupe artist custom template rows (venue_id null, same recipient + email_type). */
export async function hasRecentPendingArtistCustomEmail(
  userId: string,
  emailType: string,
  recipientEmail: string,
  withinMinutes: number
): Promise<boolean> {
  const since = new Date(Date.now() - withinMinutes * 60 * 1000).toISOString()
  const { data: rows } = await supabase
    .from('venue_emails')
    .select('id')
    .eq('user_id', userId)
    .is('venue_id', null)
    .eq('email_type', emailType)
    .eq('recipient_email', recipientEmail)
    .eq('status', 'pending')
    .gte('created_at', since)
    .limit(1)
  return (rows?.length ?? 0) > 0
}

/** True if an artist-targeted email is already pending (any age). Avoids stacking duplicates in the queue. */
export async function hasPendingArtistEmail(
  userId: string,
  emailType: string,
  recipientEmail: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from('venue_emails')
    .select('id')
    .eq('user_id', userId)
    .is('venue_id', null)
    .eq('email_type', emailType)
    .eq('recipient_email', recipientEmail)
    .eq('status', 'pending')
    .limit(1)
  return (rows?.length ?? 0) > 0
}
