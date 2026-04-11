import type { Handler } from '@netlify/functions'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import { renderAppendBlocksHtml } from '../../src/lib/email/appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_HINT,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
  EMAIL_ROW_LABEL,
} from '../../src/lib/email/emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from '../../src/lib/email/artistBrandedEmailFooterHtml'

interface RequestBody {
  token: string
  venueName: string
  eventDate: string | null
  artistName: string
  artistEmail: string
  fromEmail: string
  replyToEmail: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
  custom_subject?: string | null
  custom_intro?: string | null
  layout?: unknown | null
}

function escapeHtmlEnt(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function applyPerformanceReportPlaceholders(text: string, venueName: string, artistFullName: string): string {
  const first = artistFullName.split(/\s+/)[0] || artistFullName
  return text
    .replace(/\{venue\}/g, venueName)
    .replace(/\{artist\}/g, first)
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function buildPerformanceCardInner(
  customIntro: string | null | undefined,
  venueName: string,
  artistName: string,
): string {
  const defaultP = 'Quick check-in on how everything went. The form takes less than a minute and helps us keep your momentum going - tracking opportunities, payments, and next steps all in one place.'
  const raw = customIntro?.trim()
  if (!raw) {
    return `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:16px;">${defaultP}</p>`
  }
  const applied = applyPerformanceReportPlaceholders(raw, venueName, artistName)
  if (applied.includes('<')) return applied
  const withBreaks = escapeHtml(applied).replace(/\n/g, '<br/>')
  return `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:16px;">${withBreaks}</p>`
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
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON' }) }
  }

  const required = ['token', 'venueName', 'artistName', 'artistEmail', 'fromEmail', 'replyToEmail', 'managerName']
  for (const field of required) {
    if (!body[field as keyof RequestBody]) {
      return { statusCode: 400, body: JSON.stringify({ message: `Missing field: ${field}` }) }
    }
  }

  const siteUrl = process.env.URL || 'https://localhost:8888'
  const formUrl = `${siteUrl}/performance-report/${body.token}`
  const firstName = body.artistName.split(' ')[0]
  const logoUrl = `${siteUrl}/dj-luijay-logo-email.png`

  function fmtDate(iso: string) {
    const [y, m, d] = iso.split('-')
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
  }

  const eventDateLine = body.eventDate
    ? `<p style="font-size:13px;color:${EMAIL_ROW_LABEL};margin-bottom:24px;">Show at <strong style="color:#ffffff;">${body.venueName}</strong> &mdash; ${fmtDate(body.eventDate)}</p>`
    : `<p style="font-size:13px;color:${EMAIL_ROW_LABEL};margin-bottom:24px;">Show at <strong style="color:#ffffff;">${body.venueName}</strong></p>`

  const L = artistLayoutForSend(body.layout, body.custom_subject, body.custom_intro)
  const subjectRaw = L.subject?.trim()
  const subject = subjectRaw
    ? applyPerformanceReportPlaceholders(subjectRaw, body.venueName, body.artistName)
    : `Quick check-in: How did the show go at ${body.venueName}?`

  const cardInner = buildPerformanceCardInner(L.intro ?? body.custom_intro, body.venueName, body.artistName)
  const appendHtml = renderAppendBlocksHtml(L.appendBlocks)
  const closingExtra = L.closing?.trim()
    ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;margin-bottom:12px;">${escapeHtmlEnt(L.closing).replace(/\n/g, '<br/>')}</p>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-header { padding: 24px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
  }
</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">

  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:${EMAIL_META_TAGLINE};letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>

  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">Hey ${firstName},</p>
    ${eventDateLine}

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 22px;margin-bottom:24px;">
      ${cardInner}
      <a href="${formUrl}" style="display:inline-block;background:#ffffff;color:#000000;font-size:14px;font-weight:700;padding:13px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.2px;">Complete Your Show Report</a>
    </div>

    ${appendHtml}
    ${closingExtra}

    <p style="font-size:13px;color:${EMAIL_HINT};line-height:1.7;">This link is personal to you and only works once. If you have any issues, reply to this email.</p>
  </div>

  ${buildArtistBrandedEmailFooterHtml({
    logoBaseUrl: siteUrl,
    managerName: body.managerName,
    managerTitle: body.managerTitle ?? null,
    website: body.website ?? null,
    social_handle: body.social_handle ?? null,
    phone: body.phone ?? null,
  })}

</div>
</body>
</html>`

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: body.fromEmail,
      to: [body.artistEmail],
      reply_to: body.replyToEmail,
      subject,
      html,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.text()
    console.error('[send-performance-form] Resend error:', err)
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to send email', detail: err }) }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, formUrl }),
  }
}

export { handler }
