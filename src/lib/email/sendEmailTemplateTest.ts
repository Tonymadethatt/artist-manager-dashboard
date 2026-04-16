import type { SupabaseClient } from '@supabase/supabase-js'
import type { ArtistProfile, AnyEmailType, VenueEmailType, GeneratedFile } from '@/types'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { artistLayoutForSend, normalizeEmailTemplateLayout } from '@/lib/emailLayout'
import { EMAIL_TEMPLATE_PREVIEW_INVOICE_URL, PREVIEW_MOCK_DEAL, PREVIEW_MOCK_VENUE } from '@/lib/buildVenueEmailHtml'
import {
  venueEmailTypeToCaptureKind,
  isVenueEmailOneTapAckKind,
  venueEmailAckPublicUrl,
} from '@/lib/emailCapture/kinds'
import { defaultEmailCaptureExpiresAt } from '@/lib/emailCapture/expiry'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import type { CustomEmailTemplateRow } from '@/hooks/useCustomEmailTemplates'
import { fetchReportInputsForUser } from '@/lib/reports/fetchReportInputsForUser'
import {
  buildManagementReportData,
  buildRetainerReceivedPayload,
  buildRetainerReminderPayload,
  defaultQueuedManagementReportDateRange,
} from '@/lib/reports/buildManagementReportData'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import type { CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { loadCustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { buildBrandedGigCalendarEmail, buildGigCalendarTableRow } from '@/lib/email/gigCalendarEmailHtml'
import { buildGigBookedEmailMiddleHtml, buildGigBookedPreviewBundle } from '@/lib/email/gigBookedEmailSections'
import {
  formatPacificTimeRangeCompact,
  pacificWallToUtcIso,
  performanceWindowCompactFromDeal,
} from '@/lib/calendar/pacificWallTime'

const VENUE_EMAIL_TYPES = new Set<string>([
  'booking_confirmation',
  'agreement_ready',
  'agreement_followup',
  'payment_reminder',
  'payment_receipt',
  'follow_up',
  'rebooking_inquiry',
  'first_outreach',
  'pre_event_checkin',
  'post_show_thanks',
  'invoice_sent',
  'show_cancelled_or_postponed',
  'pass_for_now',
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
    manager_title: p.manager_title,
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
    manager_name: p.manager_name ?? null,
    manager_title: p.manager_title ?? null,
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

    if (row.audience === 'venue' && doc.captureKind && isVenueEmailOneTapAckKind(doc.captureKind)) {
      const { data: tokRow, error: capErr } = await supabase.from('email_capture_tokens').insert({
        user_id: user.id,
        kind: doc.captureKind,
        venue_id: null,
        deal_id: null,
        contact_id: null,
        expires_at: defaultEmailCaptureExpiresAt(),
      }).select('token').single()
      if (!capErr && tokRow?.token) {
        payload.capture_url = venueEmailAckPublicUrl(publicSiteOrigin(), tokRow.token as string)
      }
    }

    payload.user_id = user.id

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
          user_id: user.id,
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
          user_id: user.id,
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
          user_id: user.id,
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
          managerTitle: profile.manager_title ?? null,
          website: profile.website ?? null,
          social_handle: profile.social_handle ?? null,
          phone: profile.phone ?? null,
          custom_subject: layoutNorm.subject ?? null,
          custom_intro: layoutNorm.intro ?? null,
          layout: layoutNorm,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'performance_report_received') {
      const res = await fetch('/.netlify/functions/send-artist-transactional', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'performance_report_received',
          profile: reportProfileForSend(profile),
          venueName: PREVIEW_MOCK_VENUE.name,
          eventDate: null,
          custom_subject: layoutNorm.subject ?? null,
          custom_intro: layoutNorm.intro ?? null,
          layout: layoutNorm,
          testOnly: true,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    const previewEventDay = PREVIEW_MOCK_DEAL.event_date ?? '2026-05-17'
    const startIso = pacificWallToUtcIso(previewEventDay, '20:00')
    const endIso = pacificWallToUtcIso(previewEventDay, '23:00')
    const previewPerfStart = pacificWallToUtcIso(previewEventDay, '21:00')
    const previewPerfEnd = pacificWallToUtcIso(previewEventDay, '22:30')
    const Lsend = artistLayoutForSend(layoutNorm, null, null)
    const gigShell = {
      artistName: profile.artist_name ?? '',
      managerName: profile.manager_name?.trim() || profile.company_name?.trim() || 'Management',
      managerTitle: profile.manager_title ?? null,
      website: profile.website ?? null,
      social_handle: profile.social_handle ?? null,
      phone: profile.phone ?? null,
    }
    if (params.selectedType === 'gig_reminder_24h') {
      const html = buildBrandedGigCalendarEmail({
        kind: 'gig_reminder_24h',
        L: Lsend,
        logoBaseUrl: publicSiteOrigin(),
        ...gigShell,
        reminder: {
          venueName: PREVIEW_MOCK_VENUE.name,
          dealDescription: PREVIEW_MOCK_DEAL.description,
          whenLine: startIso && endIso ? formatPacificTimeRangeCompact(startIso, endIso) : '',
          setLine: performanceWindowCompactFromDeal({
            performance_start_at: previewPerfStart,
            performance_end_at: previewPerfEnd,
          }),
        },
      })
      const res = await fetch('/.netlify/functions/send-artist-gig-calendar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'gig_reminder_24h',
          profile: {
            artist_name: profile.artist_name,
            from_email: profile.from_email,
            reply_to_email: profile.reply_to_email,
            manager_email: profile.manager_email,
          },
          to: managerRecipient.email,
          subject: Lsend.subject?.trim() || layoutNorm.subject?.trim() || `Reminder: ${PREVIEW_MOCK_VENUE.name}`,
          html,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'gig_booked_ics' && startIso && endIso) {
      const { deal: bookedDeal, venue: bookedVenue, catalog: bookedCat } = buildGigBookedPreviewBundle({
        event_start_at: startIso,
        event_end_at: endIso,
        event_date: previewEventDay,
        performance_start_at: previewPerfStart,
        performance_end_at: previewPerfEnd,
        description: PREVIEW_MOCK_DEAL.description,
        gross_amount: PREVIEW_MOCK_DEAL.gross_amount,
        payment_due_date: PREVIEW_MOCK_DEAL.payment_due_date,
        notes: PREVIEW_MOCK_DEAL.notes,
        venue: {
          name: PREVIEW_MOCK_VENUE.name,
          city: PREVIEW_MOCK_VENUE.city,
          location: PREVIEW_MOCK_VENUE.location ?? null,
          address_line2: null,
          region: 'FL',
          postal_code: '33130',
          country: 'USA',
          deal_terms: {
            set_length: '90 minutes',
            load_in_time: '6:00 PM',
            notes: 'Green room + guest list at door.',
          },
        },
      })
      const middleSectionsHtml = buildGigBookedEmailMiddleHtml({
        deal: bookedDeal,
        venue: bookedVenue,
        catalog: bookedCat,
      })
      const html = buildBrandedGigCalendarEmail({
        kind: 'gig_booked_ics',
        L: Lsend,
        logoBaseUrl: publicSiteOrigin(),
        ...gigShell,
        icsBody: { middleSectionsHtml },
      })
      const res = await fetch('/.netlify/functions/send-artist-gig-calendar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'gig_booked_ics',
          profile: {
            artist_name: profile.artist_name,
            from_email: profile.from_email,
            reply_to_email: profile.reply_to_email,
            manager_email: profile.manager_email,
          },
          to: managerRecipient.email,
          subject: Lsend.subject?.trim() || layoutNorm.subject?.trim() || 'Booked gig — show details (test)',
          html,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'gig_calendar_digest_weekly') {
      const html = buildBrandedGigCalendarEmail({
        kind: 'gig_calendar_digest_weekly',
        L: Lsend,
        logoBaseUrl: publicSiteOrigin(),
        ...gigShell,
        digest: {
          rows: [buildGigCalendarTableRow(
            {
              event_start_at: startIso,
              event_end_at: endIso,
              event_date: previewEventDay,
              performance_start_at: previewPerfStart,
              performance_end_at: previewPerfEnd,
            },
            PREVIEW_MOCK_DEAL.description,
            PREVIEW_MOCK_VENUE.name,
          )],
        },
      })
      const res = await fetch('/.netlify/functions/send-artist-gig-calendar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'gig_calendar_digest_weekly',
          profile: {
            artist_name: profile.artist_name,
            from_email: profile.from_email,
            reply_to_email: profile.reply_to_email,
            manager_email: profile.manager_email,
          },
          to: managerRecipient.email,
          subject: Lsend.subject?.trim() || layoutNorm.subject?.trim() || 'Your gigs — next two weeks (test)',
          html,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }

    if (params.selectedType === 'gig_day_summary_manual') {
      const html = buildBrandedGigCalendarEmail({
        kind: 'gig_day_summary_manual',
        L: Lsend,
        logoBaseUrl: publicSiteOrigin(),
        ...gigShell,
        daySummary: {
          dayLabel: 'Sample show day',
          rows: [buildGigCalendarTableRow(
            {
              event_start_at: startIso,
              event_end_at: endIso,
              event_date: previewEventDay,
              performance_start_at: previewPerfStart,
              performance_end_at: previewPerfEnd,
            },
            PREVIEW_MOCK_DEAL.description,
            PREVIEW_MOCK_VENUE.name,
          )],
        },
      })
      const res = await fetch('/.netlify/functions/send-artist-gig-calendar-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'gig_day_summary_manual',
          profile: {
            artist_name: profile.artist_name,
            from_email: profile.from_email,
            reply_to_email: profile.reply_to_email,
            manager_email: profile.manager_email,
          },
          to: managerRecipient.email,
          subject: Lsend.subject?.trim() || layoutNorm.subject?.trim() || 'Your gigs — one day (test)',
          html,
          user_id: user.id,
        }),
      })
      if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
      return { ok: true }
    }
  }

  // Client built-in venue types — same capture + invoice inputs as a live send (SendVenueEmailModal + send-venue-email).
  const vType = params.selectedType as string
  if (!VENUE_EMAIL_TYPES.has(vType)) {
    return { ok: false, message: 'This template type cannot be sent from here.' }
  }

  const venuePayload: Record<string, unknown> = {
    profile: venueProfilePayload(profile),
    recipient: managerRecipient,
    deal: PREVIEW_MOCK_DEAL,
    venue: PREVIEW_MOCK_VENUE,
    type: vType as VenueEmailType,
    custom_subject: layoutNorm.subject ?? null,
    custom_intro: layoutNorm.intro ?? null,
    layout: layoutNorm,
  }

  const capKind = venueEmailTypeToCaptureKind(vType as VenueEmailType)
  if (capKind && isVenueEmailOneTapAckKind(capKind)) {
    const { data: tokRow, error: capErr } = await supabase
      .from('email_capture_tokens')
      .insert({
        user_id: user.id,
        kind: capKind,
        venue_id: null,
        deal_id: null,
        contact_id: null,
        expires_at: defaultEmailCaptureExpiresAt(),
      })
      .select('token')
      .single()
    if (!capErr && tokRow?.token) {
      venuePayload.capture_url = venueEmailAckPublicUrl(publicSiteOrigin(), tokRow.token as string)
    }
  }

  if (vType === 'invoice_sent') {
    venuePayload.invoice_url = EMAIL_TEMPLATE_PREVIEW_INVOICE_URL
  }

  venuePayload.user_id = user.id

  const res = await fetch('/.netlify/functions/send-venue-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(venuePayload),
  })
  if (!res.ok) return { ok: false, message: await errorFromResponse(res) }
  return { ok: true }
}
