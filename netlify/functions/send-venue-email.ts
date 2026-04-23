import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { normalizeEmailTemplateLayout } from '../../src/lib/emailLayout'
import { sanitizeEmailAttachmentPayload } from '../../src/lib/email/validateAttachmentUrl'
import { buildVenueEmailDocument } from '../../src/lib/email/renderVenueEmail'
import { buildCustomEmailDocument } from '../../src/lib/email/renderCustomEmail'
import { PREVIEW_MOCK_LEAD, type LeadMergeFields } from '../../src/lib/email/customEmailMerge'
import { loadCustomEmailBlocksDoc } from '../../src/lib/email/customEmailBlocks'
import { captureLinkLabel } from '../../src/lib/emailCapture/kinds'
import {
  dedupeCcAgainstTo,
  resolveArtistFacingResend,
  resolveVenueFacingResend,
} from '../../src/lib/email/emailTestModeServer'
import { parseResendMessageIdFromResendApiJson } from '../../src/lib/email/resendMessageId'
import { fetchEmailTestModeRowForSend, logResendOutboundSendForUsage } from './supabaseAdmin'

type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'follow_up'
  | 'rebooking_inquiry'
  | 'first_outreach'
  | 'pre_event_checkin'
  | 'post_show_thanks'
  | 'agreement_followup'
  | 'invoice_sent'
  | 'show_cancelled_or_postponed'
  | 'pass_for_now'

interface ArtistProfile {
  artist_name: string
  company_name: string | null
  from_email: string
  reply_to_email: string | null
  artist_email?: string | null
  manager_email?: string | null
  manager_name?: string | null
  manager_title?: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
}

interface DealData {
  description: string
  gross_amount: number
  event_date: string | null
  payment_due_date: string | null
  agreement_url: string | null
  notes: string | null
  amount_due_now?: number
  total_paid_toward_gross?: number
  remaining_client_balance?: number
}

interface VenueData {
  name: string
  city: string | null
  location: string | null
}

interface Recipient {
  name: string
  email: string
}

interface CustomVenueTemplatePayload {
  subject_template: string
  blocks: unknown
  show_reply_button?: boolean
  reply_button_label?: string | null
  capture_cta_label?: string | null
}

interface CustomArtistTemplatePayload {
  subject_template: string
  blocks: unknown
}

interface CustomLeadTemplatePayload {
  subject_template: string
  blocks: unknown
}

interface RequestBody {
  type?: VenueEmailType
  custom_venue_template?: CustomVenueTemplatePayload
  /** Artist-targeted custom template (same pipeline as venue custom; avoids a separate function bundle). */
  custom_artist_template?: CustomArtistTemplatePayload
  /** Lead / research outreach (Lead Intake); merge namespace `lead.*`. */
  custom_lead_template?: CustomLeadTemplatePayload
  attachment?: unknown
  profile: ArtistProfile
  recipient: Recipient
  deal?: DealData
  venue?: VenueData
  custom_subject?: string | null
  custom_intro?: string | null
  layout?: EmailTemplateLayoutV1 | null
  invoice_url?: string | null
  capture_url?: string | null
  /** Authenticated user — used to load email_test_mode from DB (service role). */
  user_id?: string
  /** Optional `lead.*` merge payload for `custom_lead_template` sends. */
  lead?: unknown
}

const VENUE_TYPES = new Set<string>([
  'booking_confirmation',
  'payment_receipt',
  'payment_reminder',
  'agreement_ready',
  'follow_up',
  'rebooking_inquiry',
  'first_outreach',
  'pre_event_checkin',
  'post_show_thanks',
  'agreement_followup',
  'invoice_sent',
  'show_cancelled_or_postponed',
  'pass_for_now',
])

function leadPayloadFromBody(raw: unknown): LeadMergeFields {
  if (!raw || typeof raw !== 'object') return PREVIEW_MOCK_LEAD
  const o = raw as Record<string, unknown>
  const s = (k: keyof LeadMergeFields): string => {
    const v = o[k as string]
    return typeof v === 'string' ? v : ''
  }
  return {
    venue_name: s('venue_name') || PREVIEW_MOCK_LEAD.venue_name,
    instagram_handle: s('instagram_handle') || PREVIEW_MOCK_LEAD.instagram_handle,
    genre: s('genre') || PREVIEW_MOCK_LEAD.genre,
    event_name: s('event_name') || PREVIEW_MOCK_LEAD.event_name,
    crowd_type: s('crowd_type') || PREVIEW_MOCK_LEAD.crowd_type,
    resident_dj: s('resident_dj') || PREVIEW_MOCK_LEAD.resident_dj,
    city: s('city') || PREVIEW_MOCK_LEAD.city,
    contact_email: s('contact_email') || PREVIEW_MOCK_LEAD.contact_email,
    contact_phone: s('contact_phone') || PREVIEW_MOCK_LEAD.contact_phone,
    website: s('website') || PREVIEW_MOCK_LEAD.website,
    research_notes: s('research_notes') || PREVIEW_MOCK_LEAD.research_notes,
  }
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: RequestBody
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const {
    type,
    profile,
    recipient,
    deal,
    venue,
    custom_subject,
    custom_intro,
    layout: rawLayout,
  custom_venue_template,
  custom_artist_template,
  custom_lead_template,
  attachment: rawAttachment,
    invoice_url: rawInvoiceUrl,
    capture_url: rawCaptureUrl,
    user_id: rawUserId,
    lead: rawLead,
  } = body

  const userId = typeof rawUserId === 'string' ? rawUserId.trim() || undefined : undefined
  const testModeFetch = await fetchEmailTestModeRowForSend(userId, false)
  if (!testModeFetch.ok) {
    return {
      statusCode: testModeFetch.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testModeFetch.message }),
    }
  }
  const testModeRow = testModeFetch.row

  if (!profile?.from_email || !recipient?.email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: profile.from_email, recipient.email' }) }
  }

  const hasArtistCustom = !!custom_artist_template
  const hasVenueCustom = !!custom_venue_template
  const hasLeadCustom = !!custom_lead_template
  const customCount = [hasArtistCustom, hasVenueCustom, hasLeadCustom].filter(Boolean).length
  if (customCount > 1) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Provide only one of custom_venue_template, custom_artist_template, or custom_lead_template' }) }
  }
  if (!hasArtistCustom && !hasVenueCustom && !hasLeadCustom && (!type || !VENUE_TYPES.has(type))) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing or invalid type (or provide a custom_*_template)' }) }
  }

  const siteUrl = process.env.URL || ''
  const replyTo = profile.reply_to_email || profile.from_email

  let html: string
  let subject: string

  try {
    if (custom_artist_template) {
      const supabaseUrl = process.env.SUPABASE_URL || ''
      const attachment = sanitizeEmailAttachmentPayload(rawAttachment, { supabaseUrl, siteUrl })
      const built = buildCustomEmailDocument({
        audience: 'artist',
        subjectTemplate: custom_artist_template.subject_template ?? '',
        blocksRaw: custom_artist_template.blocks,
        profile: {
          ...profile,
          artist_name: profile.artist_name ?? '',
          company_name: profile.company_name ?? null,
          manager_name: profile.manager_name ?? null,
        },
        recipient,
        deal,
        venue,
        logoBaseUrl: siteUrl,
        responsiveClasses: true,
        ...(attachment ? { attachment } : {}),
      })
      html = built.html
      subject = built.subject
    } else if (custom_lead_template) {
      const supabaseUrl = process.env.SUPABASE_URL || ''
      const attachment = sanitizeEmailAttachmentPayload(rawAttachment, { supabaseUrl, siteUrl })
      const leadData = leadPayloadFromBody(rawLead)
      const built = buildCustomEmailDocument({
        audience: 'lead',
        subjectTemplate: custom_lead_template.subject_template ?? '',
        blocksRaw: custom_lead_template.blocks,
        profile: {
          ...profile,
          artist_name: profile.artist_name ?? '',
          company_name: profile.company_name ?? null,
          manager_name: profile.manager_name ?? null,
        },
        recipient,
        lead: leadData,
        logoBaseUrl: siteUrl,
        responsiveClasses: true,
        showReplyButton: true,
        ...(attachment ? { attachment } : {}),
      })
      html = built.html
      subject = built.subject
    } else if (custom_venue_template) {
      const supabaseUrl = process.env.SUPABASE_URL || ''
      const attachment = sanitizeEmailAttachmentPayload(rawAttachment, { supabaseUrl, siteUrl })
      const captureUrl = typeof rawCaptureUrl === 'string' ? rawCaptureUrl.trim() || null : null
      const customCtaTrim = custom_venue_template.capture_cta_label?.trim() || null
      const captureKind = loadCustomEmailBlocksDoc(custom_venue_template.blocks).captureKind ?? null
      const captureCTALabelResolved =
        customCtaTrim || (captureKind ? captureLinkLabel(captureKind) : null)
      const built = buildCustomEmailDocument({
        audience: 'venue',
        subjectTemplate: custom_venue_template.subject_template ?? '',
        blocksRaw: custom_venue_template.blocks,
        profile: {
          ...profile,
          artist_name: profile.artist_name ?? '',
          company_name: profile.company_name ?? null,
        },
        recipient,
        deal,
        venue,
        logoBaseUrl: siteUrl,
        responsiveClasses: true,
        showReplyButton: custom_venue_template.show_reply_button !== false,
        replyButtonLabel: custom_venue_template.reply_button_label ?? null,
        ...(attachment ? { attachment } : {}),
        ...(captureUrl
          ? { captureUrl, captureCTALabel: captureCTALabelResolved }
          : {}),
      })
      html = built.html
      subject = built.subject
    } else {
      const artistNameUpper = (profile.artist_name ?? '').toUpperCase()
      const venueName = venue?.name || deal?.description || 'your venue'
      const layout = normalizeEmailTemplateLayout(rawLayout)
      const invoiceUrl = typeof rawInvoiceUrl === 'string' ? rawInvoiceUrl.trim() || null : null
      const captureUrl = typeof rawCaptureUrl === 'string' ? rawCaptureUrl.trim() || null : null
      html = buildVenueEmailDocument({
        type: type!,
        profile: {
          ...profile,
          artist_name: profile.artist_name ?? '',
          company_name: profile.company_name ?? null,
        },
        recipient,
        deal,
        venue,
        customIntro: custom_intro,
        customSubject: custom_subject,
        layout,
        logoBaseUrl: siteUrl,
        responsiveClasses: true,
        invoiceUrl,
        captureUrl,
      })

      const subjectMap: Record<VenueEmailType, string> = {
        booking_confirmation: `Booking Confirmation - ${artistNameUpper} at ${venueName}`,
        payment_receipt: `Payment Received - Thank You | ${artistNameUpper}`,
        payment_reminder: `Payment Reminder - ${artistNameUpper}`,
        agreement_ready: `Agreement Ready for Review - ${artistNameUpper}`,
        follow_up: `Following Up - ${artistNameUpper}`,
        rebooking_inquiry: `Rebooking Inquiry - ${artistNameUpper} at ${venueName}`,
        first_outreach: `${artistNameUpper} — booking inquiry | ${venueName}`,
        pre_event_checkin: `Pre-event check-in — ${artistNameUpper} | ${venueName}`,
        post_show_thanks: `Thank you — ${artistNameUpper} at ${venueName}`,
        agreement_followup: `Following up — agreement | ${artistNameUpper}`,
        invoice_sent: `Invoice — ${artistNameUpper} | ${venueName}`,
        show_cancelled_or_postponed: `Update — date change / cancellation | ${artistNameUpper} | ${venueName}`,
        pass_for_now: `Thanks — ${artistNameUpper} | ${venueName}`,
      }
      subject = custom_subject?.trim() || layout?.subject?.trim() || subjectMap[type!]
    }
  } catch (renderErr) {
    const msg = renderErr instanceof Error ? renderErr.message : String(renderErr)
    const stack = renderErr instanceof Error ? renderErr.stack : undefined
    console.error('[send-venue-email] render error:', msg, stack)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Email render failed: ${msg}` }),
    }
  }

  // CC the manager on all outgoing emails (may be cleared when test mode redirects)
  const cc: string[] = []
  if (profile.manager_email && profile.manager_email !== recipient.email) {
    cc.push(profile.manager_email)
  }

  let resendTo: string[] = [recipient.email]
  let resendCc: string[] = [...cc]
  let resendSubject = subject
  if (custom_artist_template) {
    const r = resolveArtistFacingResend({
      row: testModeRow,
      testOnly: false,
      to: resendTo,
      cc: resendCc,
      subject: resendSubject,
    })
    if (!r.ok) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: r.message }) }
    }
    resendTo = r.to
    resendCc = dedupeCcAgainstTo(r.to, r.cc)
    resendSubject = r.subject
  } else {
    const r = resolveVenueFacingResend({
      row: testModeRow,
      to: resendTo,
      cc: resendCc,
      subject: resendSubject,
    })
    if (!r.ok) {
      return { statusCode: 400, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: r.message }) }
    }
    resendTo = r.to
    resendCc = dedupeCcAgainstTo(r.to, r.cc)
    resendSubject = r.subject
  }

  // For invoice_sent: attempt to fetch the PDF and attach it server-side.
  // Resend limit is 40 MB total; we cap at 8 MB to stay safe.
  const INVOICE_ATTACH_MAX_BYTES = 8 * 1024 * 1024
  type ResendAttachment = { filename: string; content: string }
  const attachments: ResendAttachment[] = []
  const invoiceUrlToAttach = type === 'invoice_sent'
    ? (typeof rawInvoiceUrl === 'string' ? rawInvoiceUrl.trim() || null : null)
    : null

  if (invoiceUrlToAttach) {
    try {
      const pdfRes = await fetch(invoiceUrlToAttach, { redirect: 'follow' })
      if (pdfRes.ok) {
        const buf = await pdfRes.arrayBuffer()
        if (buf.byteLength <= INVOICE_ATTACH_MAX_BYTES) {
          const b64 = Buffer.from(buf).toString('base64')
          const filename = invoiceUrlToAttach.split('/').pop()?.split('?')[0] || 'invoice.pdf'
          attachments.push({ filename: filename.endsWith('.pdf') ? filename : `${filename}.pdf`, content: b64 })
        } else {
          console.warn(`[send-venue-email] invoice PDF too large (${buf.byteLength} bytes), skipping attachment`)
        }
      } else {
        console.warn(`[send-venue-email] invoice PDF fetch failed: ${pdfRes.status} ${invoiceUrlToAttach}`)
      }
    } catch (fetchErr) {
      console.warn('[send-venue-email] invoice PDF fetch error:', fetchErr instanceof Error ? fetchErr.message : fetchErr)
    }
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: profile.from_email,
        to: resendTo,
        ...(resendCc.length > 0 ? { cc: resendCc } : {}),
        reply_to: [replyTo],
        subject: resendSubject,
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}))
      return {
        statusCode: resendRes.status,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend API error' }),
      }
    }

    const resendPayload = await resendRes.json().catch(() => null)
    const resendMessageId = parseResendMessageIdFromResendApiJson(resendPayload)
    await logResendOutboundSendForUsage({ userId, resendMessageId, source: 'send_venue_email' })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Email sent successfully',
        subject: resendSubject,
        ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
      }),
    }
  } catch (sendErr) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr)
    console.error('[send-venue-email] send error:', msg)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: `Email send failed: ${msg}` }),
    }
  }
}

export { handler }
