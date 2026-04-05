// Mirror of netlify/functions/send-venue-email.ts buildHtml logic, used for frontend previews.
// Keep in sync when the email templates change.

export type PreviewEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'booking_confirmed'
  | 'follow_up'

export interface PreviewProfile {
  artist_name: string
  company_name: string | null
  from_email: string
  reply_to_email: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
}

export interface PreviewDeal {
  description: string
  gross_amount: number
  event_date: string | null
  payment_due_date: string | null
  agreement_url: string | null
  notes: string | null
}

export interface PreviewVenue {
  name: string
  city: string | null
  location: string | null
}

export interface PreviewRecipient {
  name: string
  email: string
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

function row(label: string, value: string, valueColor = '#ffffff'): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #222222;"><span style="font-size:13px;color:#888888;">${label}</span><span style="font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;">${value}</span></div>`
}

function card(title: string, content: string, accentColor = '#60a5fa'): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">${title}</span></div><div style="padding:2px 18px 6px;">${content}</div></div>`
}

export function buildVenueEmailHtml(
  type: PreviewEmailType,
  profile: PreviewProfile,
  recipient: PreviewRecipient,
  deal?: PreviewDeal,
  venue?: PreviewVenue,
  customIntro?: string | null,
  customSubject?: string | null,
): string {
  const artistName = profile.artist_name                        // "DJ Luijay" — body paragraphs
  const artistNameUpper = artistName.toUpperCase()             // "DJ LUIJAY" — subjects & headings
  const companyName = profile.company_name || profile.artist_name // "DJ Luijay LLC" — footer only
  const replyTo = profile.reply_to_email || profile.from_email
  const venueName = venue?.name || (deal?.description ? deal.description : 'your venue')
  const firstName = recipient.name.split(' ')[0]
  // For preview, logo is served from public/ by Vite dev server and Netlify
  const logoUrl = '/dj-luijay-logo.png'

  let subject = ''
  let greeting = ''
  let intro = ''
  let bodyCards = ''
  let closing = ''

  switch (type) {
    case 'booking_confirmation': {
      subject = `Booking Confirmation - ${artistNameUpper} at ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `We are excited to confirm the booking details for ${artistName}. Please review the summary below. A formal agreement will follow shortly.`
      const dealRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Agreed amount', money(deal.gross_amount), '#22c55e') : '',
        deal?.notes ? row('Notes', deal.notes, '#d1d1d1') : '',
      ].filter(Boolean).join('')
      bodyCards = card('Booking Details', dealRows, '#22c55e')
      const nextSteps = [
        '<li style="margin-bottom:8px;">A signed agreement will be sent to you for review.</li>',
        '<li style="margin-bottom:8px;">Payment details and timeline will be outlined in the agreement.</li>',
        `<li>For any questions, reply to this email or contact us at <strong>${replyTo}</strong>.</li>`,
      ].join('')
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;margin-bottom:12px;"><span style="display:inline-block;width:6px;height:6px;background:#60a5fa;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>Next Steps</p><ul style="font-size:13px;color:#d1d1d1;line-height:1.7;padding-left:16px;">${nextSteps}</ul></div>`
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
      bodyCards = `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid rgba(239,68,68,0.2);"><span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">Payment Due</span></div><div style="padding:2px 18px 6px;">${reminderRows}</div></div>`
      closing = `If you have already sent the payment, please disregard this message. If you have any questions or need to arrange a different timeline, reply to this email and we will work something out.`
      break
    }

    case 'agreement_ready': {
      subject = `Agreement Ready for Review - ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `The agreement for your upcoming event with ${artistName} is ready for your review.`
      const agreementContent = `<div style="padding:14px 0;">${deal?.agreement_url ? `<a href="${deal.agreement_url}" style="display:inline-block;background:#22c55e;color:#000000;font-weight:700;font-size:13px;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:0.3px;">View Agreement</a><p style="font-size:12px;color:#888888;margin-top:10px;">Or copy this link: <span style="color:#60a5fa;">${deal.agreement_url}</span></p>` : `<p style="font-size:13px;color:#d1d1d1;">The agreement document will be shared with you directly.</p>`}</div>`
      bodyCards = card('Agreement', agreementContent, '#22c55e')
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:#d1d1d1;line-height:1.7;">Please review and reply to this email with any questions or concerns. Once both parties have agreed to the terms, we will proceed with the booking confirmation.</p></div>`
      closing = `Thank you for your time. We look forward to working with you.`
      break
    }

    case 'booking_confirmed': {
      subject = `Booking Confirmed - ${artistNameUpper} | ${venueName}`
      greeting = `Hi ${firstName},`
      intro = `We are happy to confirm that the booking for ${artistName} at ${venueName} is officially confirmed.`
      const confirmedRows = [
        deal?.event_date ? row('Event date', fmtDate(deal.event_date), '#ffffff') : '',
        row('Venue', venueName, '#ffffff'),
        deal?.gross_amount ? row('Agreed amount', money(deal.gross_amount), '#22c55e') : '',
        row('Status', 'Confirmed', '#22c55e'),
      ].filter(Boolean).join('')
      bodyCards = `<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid rgba(34,197,94,0.2);"><span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">Confirmed</span></div><div style="padding:2px 18px 6px;">${confirmedRows}</div></div>`
      const stepsContent = [
        '<li style="margin-bottom:8px;">You will receive a formal agreement to sign if not already completed.</li>',
        '<li style="margin-bottom:8px;">Payment details will be outlined per the agreed terms.</li>',
        `<li>For any questions, reach us at <strong>${replyTo}</strong>.</li>`,
      ].join('')
      bodyCards += `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;margin-bottom:12px;"><span style="display:inline-block;width:6px;height:6px;background:#60a5fa;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>What Comes Next</p><ul style="font-size:13px;color:#d1d1d1;line-height:1.7;padding-left:16px;">${stepsContent}</ul></div>`
      closing = `Thank you for making this happen. We are excited to bring a great show to your venue.`
      break
    }

    case 'follow_up': {
      subject = `Following Up - ${artistNameUpper}`
      greeting = `Hi ${firstName},`
      intro = `Just wanted to check in and see if you had any updates regarding the potential booking for ${artistName}${venue ? ` at ${venueName}` : ''}.`
      bodyCards = `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:16px 18px;margin-bottom:16px;"><p style="font-size:13px;color:#d1d1d1;line-height:1.7;">We remain very interested in working together and would love to find a date and arrangement that works for both sides. Please let us know if you have any questions or if there is anything we can provide to help move things forward.</p></div>`
      closing = `Looking forward to hearing from you.`
      break
    }
  }

  // Apply custom overrides
  if (customIntro) intro = customIntro
  if (customSubject) subject = customSubject

  const footerLinks = [
    profile.website ? `<a href="${profile.website}" style="color:#888888;text-decoration:none;font-size:11px;">${profile.website.replace(/^https?:\/\//, '')}</a>` : '',
    profile.social_handle ? `<span style="color:#888888;font-size:11px;">${profile.social_handle}</span>` : '',
    profile.phone ? `<span style="color:#888888;font-size:11px;">${profile.phone}</span>` : '',
  ].filter(Boolean).join('<span style="color:#444444;margin:0 8px;">|</span>')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
<div style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">

  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:8px;font-weight:500;color:#555555;letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>

  <div style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">${greeting}</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:24px;">${intro}</p>
    ${bodyCards}
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-top:8px;">${closing}</p>
  </div>

  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:4px;">${companyName.toUpperCase()}</div>
    ${footerLinks ? `<div style="margin-top:4px;">${footerLinks}</div>` : ''}
    <div style="font-size:11px;color:#555555;margin-top:8px;">This is an automated message. To reply, contact <a href="mailto:${replyTo}" style="color:#60a5fa;text-decoration:none;">${replyTo}</a></div>
  </div>

</div>
</body>
</html>`
}

// Mock data used for email preview rendering
export const PREVIEW_MOCK_PROFILE: PreviewProfile = {
  artist_name: 'DJ Luijay',
  company_name: 'DJ Luijay LLC',
  from_email: 'management@updates.djluijay.live',
  reply_to_email: 'management@djluijay.live',
  website: 'https://djluijay.com',
  phone: '(305) 555-0182',
  social_handle: '@djluijay',
  tagline: 'Brand Growth & Management',
}

export const PREVIEW_MOCK_RECIPIENT: PreviewRecipient = {
  name: 'Alex Johnson',
  email: 'alex@skylinebar.com',
}

export const PREVIEW_MOCK_VENUE: PreviewVenue = {
  name: 'Skyline Bar & Lounge',
  city: 'Miami',
  location: 'Downtown Miami',
}

export const PREVIEW_MOCK_DEAL: PreviewDeal = {
  description: 'DJ Set at Skyline Bar & Lounge',
  gross_amount: 500,
  event_date: '2026-05-17',
  payment_due_date: '2026-05-10',
  agreement_url: 'https://docs.google.com/document/d/preview-agreement-link',
  notes: null,
}
