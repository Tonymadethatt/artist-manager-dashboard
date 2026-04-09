import type { VenueEmailType } from '../../types'
import type { EmailTemplateLayoutV1 } from '../emailLayout'
import { effectiveTemplateLayout } from '../emailLayout'
import { captureLinkLabel, venueEmailTypeToCaptureKind } from '../emailCapture/kinds'
import { escapeHtmlPlain, renderAppendBlocksHtml } from './appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_FOOTER_MUTED,
  EMAIL_HINT,
  EMAIL_LABEL,
  EMAIL_ROW_LABEL,
  EMAIL_TEXT_PRIMARY,
} from './emailDarkSurfacePalette'
import { VENUE_EMAIL_CAPTURE_BUTTON_STYLE, VENUE_EMAIL_DOC_BUTTON_STYLE } from './venueEmailCtaStyles'
import { emailFooterVenueSenderAttributionHtml } from './emailFooterPersonaLines'
import { buildProfileFooterLinksHtml } from './profileFooterLinksHtml'
import {
  buildVenueClientEmailHeaderBrandInnerHtml,
  venueClientEmailLogoAlt,
} from './venueClientEmailHeaderBrandHtml'

function hrefAttr(u: string): string {
  return u.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export type VenueRenderEmailType =
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

export interface VenueRenderProfile {
  artist_name: string
  company_name: string | null
  from_email: string
  reply_to_email: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
  /** Artist-facing custom templates: sign-off line in footer. */
  manager_name?: string | null
  /** Job title shown with manager_name in footers (client and custom venue emails). */
  manager_title?: string | null
}

export interface VenueRenderDeal {
  description: string
  gross_amount: number
  event_date: string | null
  payment_due_date: string | null
  agreement_url: string | null
  notes: string | null
}

export interface VenueRenderVenue {
  name: string
  city: string | null
  location: string | null
}

export interface VenueRenderRecipient {
  name: string
  email: string
}

export interface BuildVenueEmailDocumentOptions {
  type: VenueRenderEmailType
  profile: VenueRenderProfile
  recipient: VenueRenderRecipient
  deal?: VenueRenderDeal
  venue?: VenueRenderVenue
  /** Legacy column overrides (merged with layout) */
  customIntro?: string | null
  customSubject?: string | null
  layout?: EmailTemplateLayoutV1 | null
  /** '' = relative URLs for dev/preview; production Netlify passes site origin */
  logoBaseUrl: string
  /** Include responsive wrapper classes (Netlify sends true) */
  responsiveClasses?: boolean
  /** Resolved billing / invoice link for `invoice_sent` (from queue notes or send payload). */
  invoiceUrl?: string | null
  /** Public one-tap confirmation URL (GET → Netlify function → thank-you HTML; no form POST). */
  captureUrl?: string | null
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function row(label: string, value: string, valueColor = EMAIL_TEXT_PRIMARY): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;font-size:13px;color:${EMAIL_ROW_LABEL};border-bottom:1px solid #222222;vertical-align:middle;">${label}</td><td style="padding:10px 0;font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;border-bottom:1px solid #222222;vertical-align:middle;">${value}</td></tr></table>`
}

function card(title: string, content: string, accentColor = '#60a5fa'): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${title}</span></div><div style="padding:2px 18px 6px;">${content}</div></div>`
}

function applyGreetingTemplate(greeting: string, firstName: string): string {
  return greeting.replace(/\{firstName\}/gi, firstName)
}

const replyMap: Record<VenueRenderEmailType, { label: string; bodyText: string }> = {
  follow_up:            { label: 'Reply',               bodyText: 'Hi,\n\nThanks for reaching out. Here is my update on the potential booking:\n\n' },
  booking_confirmation: { label: 'Reply',               bodyText: 'Hi,\n\nThank you for the booking confirmation. Here are my notes:\n\n' },
  agreement_ready:      { label: 'Reply',               bodyText: 'Hi,\n\nI have reviewed the agreement. Here is my response:\n\n' },
  payment_reminder:     { label: 'Reply',               bodyText: 'Hi,\n\nI am writing to confirm payment for the upcoming event.\n\n' },
  payment_receipt:      { label: 'Reply',               bodyText: 'Hi,\n\nThank you for confirming receipt of the payment.\n\n' },
  rebooking_inquiry:    { label: 'Reply',               bodyText: 'Hi,\n\nThank you for the interest in a future booking. Here are my thoughts:\n\n' },
  first_outreach:       { label: 'Reply',               bodyText: 'Hi,\n\nThanks for your note. Here is more about the booking opportunity:\n\n' },
  pre_event_checkin:    { label: 'Reply',               bodyText: 'Hi,\n\nHere are details on load-in, settlement, and our onsite contact:\n\n' },
  post_show_thanks:     { label: 'Reply',               bodyText: 'Hi,\n\nThank you — glad the show went well. Notes:\n\n' },
  agreement_followup:   { label: 'Reply',               bodyText: 'Hi,\n\nFollowing up on the agreement — here is our update:\n\n' },
  invoice_sent:         { label: 'Reply',               bodyText: 'Hi,\n\nRegarding the invoice — here is our note:\n\n' },
  show_cancelled_or_postponed: { label: 'Reply', bodyText: 'Hi,\n\nThanks for the update on the date change / cancellation. Here is our side:\n\n' },
  pass_for_now:         { label: 'Reply',               bodyText: 'Hi,\n\nThank you for the clear note. Here is our reply:\n\n' },
}

function logoUrls(base: string) {
  const prefix = base.replace(/\/$/, '')
  return {
    logo: prefix ? `${prefix}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png',
    ig: prefix ? `${prefix}/icons/icon-ig.png` : '/icons/icon-ig.png',
  }
}

export function buildVenueEmailDocument(opts: BuildVenueEmailDocumentOptions): string {
  const {
    type,
    profile,
    recipient,
    deal,
    venue,
    customIntro,
    customSubject,
    layout: layoutRaw,
    logoBaseUrl,
    responsiveClasses = false,
    invoiceUrl: invoiceUrlOpt = null,
    captureUrl: captureUrlOpt = null,
  } = opts

  const layout = effectiveTemplateLayout(layoutRaw, customSubject, customIntro)

  const artistName = profile.artist_name ?? ''
  const artistNameUpper = artistName.toUpperCase()
  const replyTo = profile.reply_to_email || profile.from_email
  const venueName = venue?.name || (deal?.description ? deal.description : 'your venue')
  const firstName = (recipient.name ?? '').split(' ')[0]
  const { logo: logoUrl, ig: igUrl } = logoUrls(logoBaseUrl)

  let subject = ''
  let greeting = ''
  let intro = ''
  let bodyCards = ''
  let closing = ''

  switch (type) {
    case 'booking_confirmation': {
      subject = `Booking Confirmation - ${artistNameUpper} at ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `We are excited to confirm the booking for ${artistName} at ${venueName}. Please review the summary below. A formal agreement will follow shortly.`
      const dealRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Agreed amount', money(deal.gross_amount), '#22c55e') : '',
        deal?.notes ? row('Notes', deal.notes, EMAIL_BODY_SECONDARY) : '',
      ].filter(Boolean).join('')
      bodyCards = card('Booking Details', dealRows, '#22c55e')
      const nextSteps = [
        '<li style="margin-bottom:8px;">A signed agreement will be sent to you for review.</li>',
        '<li style="margin-bottom:8px;">Payment details and timeline will be outlined in the agreement.</li>',
        `<li>For any questions, reply to this email or contact us at <strong>${replyTo}</strong>.</li>`,
      ].join('')
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};margin-bottom:12px;"><span style="display:inline-block;width:6px;height:6px;background:#60a5fa;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>Next Steps</p><ul style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;padding-left:16px;">${nextSteps}</ul></div>`
      closing = `Looking forward to a great show. We will be in touch soon.`
      break
    }

    case 'payment_receipt': {
      subject = `Payment Received - Thank You | ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `We wanted to confirm that we have received your payment. Thank you for completing this promptly.`
      const receiptRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Amount received', money(deal.gross_amount), '#22c55e') : '',
        row('Status', 'Payment confirmed', '#22c55e'),
      ].filter(Boolean).join('')
      bodyCards = card('Payment Summary', receiptRows, '#22c55e')
      closing = `We appreciate you and look forward to continuing to work together.`
      break
    }

    case 'payment_reminder': {
      subject = `Payment Reminder - ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `Just a friendly reminder about the outstanding payment for the upcoming event. Please see the details below.`
      const reminderRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Amount due', money(deal.gross_amount), '#ef4444') : '',
        deal?.payment_due_date ? row('Due date', fmtDate(deal.payment_due_date), '#ef4444') : '',
      ].filter(Boolean).join('')
      bodyCards = `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid rgba(239,68,68,0.2);"><span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">Payment Due</span></div><div style="padding:2px 18px 6px;">${reminderRows}</div></div>`
      closing = `If you have already sent the payment, please disregard this message. If you have any questions or need to arrange a different timeline, reply to this email and we will work something out.`
      break
    }

    case 'agreement_ready': {
      subject = `Agreement Ready for Review - ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `The agreement for your upcoming event with ${artistName} is ready for your review.`
      const agreementContent = `<div style="padding:14px 0;">${deal?.agreement_url ? `<a href="${deal.agreement_url}" style="${VENUE_EMAIL_DOC_BUTTON_STYLE}">Open agreement</a>` : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};">The agreement document will be shared with you directly.</p>`}</div>`
      bodyCards = card('Agreement', agreementContent, '#22c55e')
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">Please review and reply to this email with any questions or concerns. Once both parties have agreed to the terms, we will proceed with the booking confirmation.</p></div>`
      closing = `Thank you for your time. We look forward to working with you.`
      break
    }

    case 'follow_up': {
      subject = `Following Up - ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `Just wanted to check in and see if you had any updates regarding the potential booking for ${artistName}${venue ? ` at ${venueName}` : ''}.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">We remain very interested in working together and would love to find a date and arrangement that works for both sides. Please let us know if you have any questions or if there is anything we can provide to help move things forward.</p></div>`
      closing = `Looking forward to hearing from you.`
      break
    }

    case 'rebooking_inquiry': {
      subject = `Rebooking Inquiry - ${artistNameUpper} at ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `We had a great experience at ${venueName} and wanted to reach out about the possibility of booking ${artistName} again.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">Based on the positive reception from the previous event, we believe there is a strong opportunity to continue this partnership. We would love to discuss available dates and terms that work for your venue.</p></div>`
      const rebookDetails = [
        deal?.event_date ? row('Previous event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
      ].filter(Boolean).join('')
      if (rebookDetails) bodyCards += card('Previous Event', rebookDetails, '#60a5fa')
      closing = `Please let us know your availability and we will make it work.`
      break
    }

    case 'first_outreach': {
      subject = `${artistNameUpper} — booking inquiry | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `${artistName} would love to explore a fit at ${venueName}. This is a first note from our team to see if there is interest and the right timing for a date.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">We can share an electronic press kit, sample mixes, and availability on request. If bookings go through a buyer or agency, feel free to loop them in or point us to the right contact.</p></div>`
      closing = `If this is not the right inbox, a quick pointer to the right person would be appreciated.`
      break
    }

    case 'pre_event_checkin': {
      subject = `Pre-event check-in — ${artistNameUpper} | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `As the date approaches for ${artistName} at ${venueName}, we wanted to align on logistics and any open details.`
      const preRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Agreed amount', money(deal.gross_amount), '#22c55e') : '',
      ].filter(Boolean).join('')
      bodyCards = preRows ? card('Event summary', preRows, '#60a5fa') : ''
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">Please confirm load-in or soundcheck window, settlement method, and the best onsite day-of contact. If there is a tech rider or parking note we should have, send it over and we will match it.</p></div>`
      closing = `Thanks for hosting the show — we are looking forward to it.`
      break
    }

    case 'post_show_thanks': {
      subject = `Thank you — ${artistNameUpper} at ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `Thank you for having ${artistName} at ${venueName}. We appreciate the teamwork that goes into a successful night.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">If anything is pending on your side (final settlement paperwork, assets, or follow-up), let us know and we will close the loop quickly.</p></div>`
      closing = `We appreciate the partnership and hope to stay in touch.`
      break
    }

    case 'agreement_followup': {
      subject = `Following up — agreement | ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `Circling back on the agreement for ${artistName}${venue ? ` at ${venueName}` : ''}. When you have a moment, a quick status on review or signature would help us keep the date on track.`
      const agreeUrl = deal?.agreement_url
      const agreementContent = `<div style="padding:14px 0;">${agreeUrl ? `<a href="${agreeUrl}" style="${VENUE_EMAIL_DOC_BUTTON_STYLE}">Open agreement</a>` : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};">If you need the document resent, reply to this email.</p>`}</div>`
      bodyCards = card('Agreement', agreementContent, '#60a5fa')
      closing = `Happy to adjust language if anything needs clarification.`
      break
    }

    case 'invoice_sent': {
      subject = `Invoice — ${artistNameUpper} | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `Please find the invoice / billing summary for ${artistName} for the engagement at ${venueName}.`
      const inv = invoiceUrlOpt?.trim()
      const invoiceContent = `<div style="padding:14px 0;">${inv ? `<a href="${inv}" style="${VENUE_EMAIL_DOC_BUTTON_STYLE}">Open invoice</a><p style="font-size:12px;color:${EMAIL_FOOTER_MUTED};margin-top:10px;">Or copy this link: <span style="color:#60a5fa;">${inv}</span></p>` : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};">The document will be shared separately if no link is on file yet.</p>`}</div>`
      bodyCards = card('Billing', invoiceContent, '#22c55e')
      const invRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        deal?.gross_amount ? row('Amount', money(deal.gross_amount), '#ffffff') : '',
      ].filter(Boolean).join('')
      if (invRows) bodyCards += card('Reference', invRows, '#60a5fa')
      closing = `If anything on the invoice needs to match your AP process, reply here and we will adjust.`
      break
    }

    case 'show_cancelled_or_postponed': {
      subject = `Update — date change / cancellation | ${artistNameUpper} | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `Reaching out regarding the booking for ${artistName} at ${venueName}. We understand plans can shift and want to stay aligned on timing and next steps.`
      const noteBlock = deal?.notes?.trim()
        ? card('Context', `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;white-space:pre-wrap;">${escapeHtmlPlain(deal.notes)}</p>`, '#f59e0b')
        : ''
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">Please confirm the revised plan on your side (new date, refund path, or mutual release) so our records stay accurate. We appreciate you keeping us in the loop.</p></div>${noteBlock}`
      closing = `Thank you for the partnership and clear communication.`
      break
    }

    case 'pass_for_now': {
      subject = `Thanks — ${artistNameUpper} | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `Thank you for the time and consideration around ${artistName} for ${venueName}. We will step back on this opportunity for now.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;">If circumstances change or you would like to reconnect in a future season, we would be glad to hear from you.</p></div>`
      closing = `Wishing you a strong run of shows.`
      break
    }
  }

  const subjOverride = layout.subject?.trim()
  if (subjOverride) subject = subjOverride

  const introOverride = layout.intro?.trim()
  if (introOverride) {
    intro = escapeHtmlPlain(introOverride).replace(/\n/g, '<br/>')
  }

  const greetOverride = layout.greeting?.trim()
  if (greetOverride) {
    greeting = escapeHtmlPlain(applyGreetingTemplate(greetOverride, firstName)).replace(/\n/g, '<br/>')
  }

  const closingOverride = layout.closing?.trim()
  if (closingOverride) {
    closing = escapeHtmlPlain(closingOverride).replace(/\n/g, '<br/>')
  }

  const appendHtml = renderAppendBlocksHtml(layout.appendBlocks)

  const capKind = venueEmailTypeToCaptureKind(type as VenueEmailType)
  const captureTrim = captureUrlOpt?.trim() || ''

  /** CTA label: hire/follow-up types use artist name; others use generic copy. */
  function captureCtaLabel(kind: ReturnType<typeof venueEmailTypeToCaptureKind>, name: string): string {
    if (!kind) return 'Open form'
    const disp = (name || '').trim()
    switch (kind) {
      case 'first_outreach':
      case 'follow_up':
        return disp ? `Book ${disp} now` : 'Book now'
      case 'rebooking_inquiry':
        return disp ? `Rebook ${disp}` : 'Rebook'
      case 'post_show_thanks':
        return 'Send feedback'
      case 'pre_event_checkin':
        return 'Logistics form'
      case 'payment_reminder_ack':
        return 'Payment sent'
      case 'payment_receipt':
        return 'Next steps'
      case 'booking_confirmation':
      case 'booking_confirmed':
        return 'Confirm details'
      case 'invoice_sent':
        return 'Confirm invoice'
      case 'show_cancelled_or_postponed':
        return 'Send update'
      case 'agreement_ready':
      case 'agreement_followup':
        return 'Agreement reply'
      case 'pass_for_now':
        return 'Acknowledge'
      default:
        return captureLinkLabel(kind)
    }
  }

  const captureCtaHtml = captureTrim && capKind
    ? `<div style="text-align:center;margin-bottom:24px;margin-top:4px;">
        <a href="${hrefAttr(captureTrim)}" style="${VENUE_EMAIL_CAPTURE_BUTTON_STYLE}">${escapeHtmlPlain(captureCtaLabel(capKind, artistName))}</a>
        <p style="font-size:11px;color:${EMAIL_HINT};margin-top:10px;">One tap to confirm &mdash; no account required</p>
      </div>`
    : ''

  const { label: defaultReplyLabel, bodyText: replyBody } = replyMap[type]
  const replyLabel = layout.footer?.replyButtonLabel?.trim() || defaultReplyLabel
  const hasPrimaryCaptureCta = Boolean(captureTrim && capKind)
  const showReply = layout.footer?.showReplyButton !== false && !hasPrimaryCaptureCta
  const mailtoHref = `mailto:${replyTo}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent(replyBody)}`

  const footerLinks = buildProfileFooterLinksHtml(igUrl, profile.website, profile.social_handle, profile.phone)
  const senderAttribution = emailFooterVenueSenderAttributionHtml(
    profile.manager_name,
    profile.manager_title,
  )

  const replyBlock = showReply
    ? `<a href="${mailtoHref}" style="display:inline-block;background:#1e1e1e;color:${EMAIL_BODY_SECONDARY};font-size:12px;font-weight:500;padding:9px 18px;border-radius:6px;border:1px solid #333333;text-decoration:none;margin-top:12px;">${escapeHtmlPlain(replyLabel)}</a>`
    : ''

  const mobileStyles = responsiveClasses ? `
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
  }` : ''

  const wrapperClass = responsiveClasses ? ' class="wrapper"' : ''
  const bodyClass = responsiveClasses ? ' class="email-body"' : ''
  const footerClass = responsiveClasses ? ' class="email-footer"' : ''
  const headerBrandInner = buildVenueClientEmailHeaderBrandInnerHtml(profile)
  const logoAlt = venueClientEmailLogoAlt(profile)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlPlain(subject)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
${mobileStyles}
</style>
</head>
<body>
<div${wrapperClass} style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">

  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="${escapeHtmlPlain(logoAlt)}" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      ${headerBrandInner}
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>

  <div${bodyClass} style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">${greeting}</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:24px;">${intro}</p>
    ${bodyCards}
    ${appendHtml}
    ${captureCtaHtml}
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-top:8px;">${closing}</p>
  </div>

  <div${footerClass} style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    ${senderAttribution}
    ${footerLinks ? `<div style="margin-top:8px;">${footerLinks}</div>` : ''}
    ${replyBlock}
  </div>

</div>
</body>
</html>`
}
