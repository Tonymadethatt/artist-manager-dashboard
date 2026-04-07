import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArtistProfile, AnyEmailType, VenueEmailType, GeneratedFile } from '@/types'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { normalizeEmailTemplateLayout } from '@/lib/emailLayout'
import { PREVIEW_MOCK_DEAL, PREVIEW_MOCK_VENUE } from '@/lib/buildVenueEmailHtml'
import type { CustomEmailTemplateRow } from '@/hooks/useCustomEmailTemplates'
import { fetchReportInputsForUser } from '@/lib/reports/fetchReportInputsForUser'
import {
  buildManagementReportData,
  buildRetainerReceivedPayload,
  buildRetainerReminderPayload,
  defaultQueuedManagementReportDateRange,
} from '@/lib/reports/buildManagementReportData'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import type { CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { loadCustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'

const VENUE_EMAIL_TYPES = new Set<string>([
  'booking_confirmation',
  'booking_confirmed',
  'agreement_ready',
  'payment_reminder',
  'payment_receipt',
  'follow_up',
  'rebooking_inquiry',
])

async function errorFromResponse(res: Response): Promise<string> {
  const text = await res.text()
  try {
    const err = JSON.parse(text) as { message?: string }
    if (err.message) return err.message
  } catch {
    if (text.trim()) return `${res.status}: ${text.slice(0, 240)}`
  }
  return `Request failed (${res.status})`
}

function reportProfileForSend(p: ArtistProfile) {
  return {
    artist_name: p.artist_name,
    artist_email: p.artist_email,
    manager_name: p.manager_name,
    manager_email: p.manager_email,
    from_email: p.from_email,
    company_name: p.company_name,
    website: p.website,
    social_handle: p.social_handle,
    phone: p.phone,
    reply_to_email: p.reply_to_email,
  }
}

function venueProfilePayload(p: ArtistProfile) {
  return {
    artist_name: p.artist_name,
    company_name: p.company_name,
    from_email: p.from_email,
    reply_to_email: p.reply_to_email,
    website: p.website,
    phone: p.phone,
    social_handle: p.social_handle,
    tagline: p.tagline,
  }
}

export type SendEmailTemplateTestParams = {
  supabase: SupabaseClient
  profile: ArtistProfile
  previewLayout: EmailTemplateLayoutV1
  activeGroup: 'client' | 'artist'
  selectedType: AnyEmailType
  selectedCustomId: string | null
  sidebarMode: 'browse' | 'edit' | 'edit-custom'
  customRows: CustomEmailTemplateRow[]
  customBlocksDraft: CustomEmailBlocksDoc
  customSubjectDraft: string
  customAttachmentFileIdDraft: string | null
  generatedFilesForTemplates: GeneratedFile[]
}

export async function sendEmailTemplateTest(
  params: SendEmailTemplateTestParams,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { profile, supabase } = params
  if (!profile.manager_email?.trim()) {
    return { ok: false, message: 'Add your manager email in Settings to send tests.' }
  }
  if (!profile.from_email?.trim()) {
    return { ok: false, message: 'Set a from email in your artist profile.' }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: 'Not signed in.' }
  }

  const managerRecipient = {
    name: profile.manager_name?.trim() || 'Test',
    email: profile.manager_email.trim(),
  }

  const layoutNorm = normalizeEmailTemplateLayout(params.previewLayout) ?? params.previewLayout

  // Custom block templates → send-venue-email
  if (params.selectedCustomId) {
    const row = params.customRows.find(r => r.id === params.selectedCustomId)
    if (!row) {
      return { ok: false, message: 'Custom template not found.' }
    }
    const doc = params.sidebarMode === 'edit-custom'
      ? params.customBlocksDraft
      : loadCustomEmailBlocksDoc(row.blocks)
    const subj = params.sidebarMode === 'edit-custom'
      ? params.customSubjectDraft
      : row.subject_template
    const attachId = params.sidebarMode === 'edit-custom'
      ? params.customAttachmentFileIdDraft
      : (row.attachment_generated_file_id ?? null)

    const payload: Record<string, unknown> = {
      profile: venueProfilePayload(profile),
      deal: PREVIEW_MOCK_DEAL,
      venue: PREVIEW_MOCK_VENUE,
    }

    if (row.audience === 'venue') {
      payload.recipient = managerRecipient
      payload.custom_venue_template = {
        subject_template: subj.trim() || ' ',
        blocks: doc,
      }
    } else {
      const first = (profile.manager_name || 'You').split(/\s+/)[0] || 'You'
      payload.recipient = { name: first, email: managerRecipient.email }
      payload.custom_artist_template = {
        subject_template: subj.trim() || ' ',
        blocks: doc,
      }
    }

    if (attachId) {
      const { data: gf } = await supabase
        .from('generated_files')
        .select('*')
        .eq('id', attachId)
        .eq('user_id', user.id)
        .maybeSingle()
      const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
      if (att) payload.attachment = att
    }

    const res = await fetch('/.netlify/functions/send-venue-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
    return { ok: true }
  }

  if (params.activeGroup === 'artist') {
    if (params.selectedType === 'management_report') {
      const inputs = await fetchReportInputsForUser(supabase, user.id)
      const { start, end } = defaultQueuedManagementReportDateRange()
      const report = buildManagementReportData(inputs, start, end)
      const res = await fetch('/.netlify/functions/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: reportProfileForSend(profile),
          report,
          dateRange: { start, end },
          testOnly: true,
          custom_subject: null,
          custom_intro: null,
          layout: layoutNorm,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'retainer_reminder') {
      const inputs = await fetchReportInputsForUser(supabase, user.id)
      const { unpaidFees, totalOutstanding } = buildRetainerReminderPayload(inputs.fees)
      const res = await fetch('/.netlify/functions/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: reportProfileForSend(profile),
          unpaidFees,
          totalOutstanding,
          custom_subject: null,
          custom_intro: null,
          layout: layoutNorm,
          testOnly: true,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'retainer_received') {
      const inputs = await fetchReportInputsForUser(supabase, user.id)
      const { settledFees, totalAcknowledged } = buildRetainerReceivedPayload(inputs.fees)
      const res = await fetch('/.netlify/functions/send-retainer-received', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: reportProfileForSend(profile),
          settledFees,
          totalAcknowledged,
          custom_subject: null,
          custom_intro: null,
          layout: layoutNorm,
          testOnly: true,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'performance_report_request') {
      const res = await fetch('/.netlify/functions/send-performance-form', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: crypto.randomUUID(),
          venueName: PREVIEW_MOCK_VENUE.name,
          eventDate: PREVIEW_MOCK_DEAL.event_date,
          artistName: profile.artist_name,
          artistEmail: managerRecipient.email,
          fromEmail: profile.from_email,
          replyToEmail: profile.reply_to_email || profile.from_email,
          managerName: profile.manager_name || 'Your Manager',
          custom_subject: layoutNorm.subject ?? null,
          custom_intro: layoutNorm.intro ?? null,
          layout: layoutNorm,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }
  }

  // Client built-in venue types
  const vType = params.selectedType as string
  if (!VENUE_EMAIL_TYPES.has(vType)) {
    return { ok: false, message: 'This template type cannot be sent from here.' }
  }

  const res = await fetch('/.netlify/functions/send-venue-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profile: venueProfilePayload(profile),
      recipient: managerRecipient,
      deal: PREVIEW_MOCK_DEAL,
      venue: PREVIEW_MOCK_VENUE,
      type: vType as VenueEmailType,
      custom_subject: layoutNorm.subject ?? null,
      custom_intro: layoutNorm.intro ?? null,
      layout: layoutNorm,
    }),
  })
  if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
  return { ok: true }
}
