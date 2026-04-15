import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import { renderAppendBlocksHtml } from '../../src/lib/email/appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_FOOTER_MUTED,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
} from '../../src/lib/email/emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from '../../src/lib/email/artistBrandedEmailFooterHtml'
import { resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { fetchEmailTestModeRow } from './supabaseAdmin'

function escapeHtmlEnt(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

interface ArtistProfile {
  artist_name: string
  artist_email: string
  manager_name: string | null
  manager_title?: string | null
  manager_email: string | null
  from_email: string
  company_name: string | null
  website: string | null
  social_handle: string | null
  phone: string | null
  reply_to_email: string | null
}

interface UnpaidFee {
  month: string
  owed: number
  paid: number
  balance: number
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function buildReminderHtml(profile: ArtistProfile, unpaidFees: UnpaidFee[], totalOutstanding: number, L: EmailTemplateLayoutV1): string {
  const managerName = profile.manager_name || 'Management'
  const siteUrl = process.env.URL || ''
  const logoUrl = `${siteUrl}/dj-luijay-logo-email.png`
  const monthCount = unpaidFees.length
  const hasPartials = unpaidFees.some(f => f.paid > 0)

  // Value recap opener, relationship-first, no specific numbers (no em dashes)
  const recapLine = monthCount === 1
    ? `We have been heads down on the management side. Outreach is active, conversations are moving, and I am continuing to push the brand forward.`
    : `We have been heads down on the management side across the last ${monthCount} months. Outreach is active, we have live conversations with venues, and I am continuing to push the brand forward.`

  const feeRows = unpaidFees.map(f => {
    const isPartial = f.paid > 0
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#ffffff;font-weight:500;">${f.month}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#60a5fa;text-align:right;">${money(f.owed)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:${isPartial ? '#22c55e' : '#444444'};text-align:right;">${isPartial ? money(f.paid) : '-'}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;font-weight:700;color:#ef4444;text-align:right;">${money(f.balance)}</td>
    </tr>`
  }).join('')

  // Green tint note when partial payments exist (positive acknowledgment)
  const partialNote = hasPartials
    ? `<div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:12px 16px;margin-top:12px;">
        <p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.6;">Partial payments already received are reflected above, thank you for those.</p>
      </div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Note</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-header { padding: 24px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .fee-table { font-size: 12px !important; }
    .hide-mobile { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">

  <!-- Header -->
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:${EMAIL_META_TAGLINE};letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>

  <!-- Body -->
  <div class="email-body" style="padding:28px 32px;">

    <!-- Greeting and value recap -->
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:20px;">Hey ${profile.artist_name},</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:20px;">${L.intro?.trim()
    ? escapeHtmlEnt(L.intro).replace(/\n/g, '<br/>')
    : recapLine}</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:28px;">Wanted to do a quick check-in on the management retainer. There is a balance that has not cleared yet. Here is where things stand:</p>

    <!-- Fee breakdown table -->
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#161616;padding:10px 18px;border-bottom:1px solid #2a2a2a;">
        <span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">Retainer Balance</span>
      </div>
      <div style="padding:0 18px;">
        <table class="fee-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Month</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Invoiced</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Paid</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Balance</th>
            </tr>
          </thead>
          <tbody>${feeRows}</tbody>
        </table>
      </div>
    </div>

    ${partialNote}

    <!-- Total outstanding callout — red tint -->
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;margin:${hasPartials ? '16px' : '4px'} 0 24px;border-collapse:collapse;">
      <tr>
        <td style="padding:18px 22px;font-size:13px;color:${EMAIL_BODY_SECONDARY};vertical-align:middle;">Total outstanding</td>
        <td style="padding:18px 22px;font-size:22px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;text-align:right;vertical-align:middle;">${money(totalOutstanding)}</td>
      </tr>
    </table>

    ${renderAppendBlocksHtml(L.appendBlocks)}

    <!-- Closing, warm and no pressure -->
    ${L.closing?.trim()
    ? `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">${escapeHtmlEnt(L.closing).replace(/\n/g, '<br/>')}</p>`
    : `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:12px;">Whenever you are able to send something over, even a partial, just shoot it through and let me know. Happy to work with whatever works for you right now.</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">Appreciate you, let us keep this momentum going. Big things ahead.</p>`}

  </div>

  ${buildArtistBrandedEmailFooterHtml({
    logoBaseUrl: siteUrl,
    managerName,
    managerTitle: profile.manager_title,
    website: profile.website,
    social_handle: profile.social_handle,
    phone: profile.phone,
  })}

</div>
</body>
</html>`
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: {
    profile: ArtistProfile
    unpaidFees: UnpaidFee[]
    totalOutstanding: number
    custom_subject?: string | null
    custom_intro?: string | null
    layout?: unknown | null
    testOnly?: boolean
    user_id?: string
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const {
    profile,
    unpaidFees,
    totalOutstanding,
    custom_subject,
    custom_intro,
    layout: layoutRaw,
    testOnly = false,
    user_id: rawUserId,
  } = body
  const userId = typeof rawUserId === 'string' ? rawUserId.trim() || undefined : undefined
  const testModeRow = await fetchEmailTestModeRow(userId)
  const L = artistLayoutForSend(layoutRaw, custom_subject, custom_intro)
  if (!profile?.from_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }
  if (testOnly) {
    if (!profile.manager_email) {
      return { statusCode: 400, body: JSON.stringify({ message: 'manager_email not set. Add it in Settings.' }) }
    }
  } else if (!profile?.artist_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }

  const demoRow: UnpaidFee = {
    month: 'January 2026 (sample)',
    owed: 350,
    paid: 0,
    balance: 350,
  }
  const feesForHtml = testOnly && unpaidFees.length === 0 ? [demoRow] : unpaidFees
  const totalForHtml = testOnly && unpaidFees.length === 0 ? demoRow.balance : totalOutstanding

  const html = buildReminderHtml(profile, feesForHtml, totalForHtml, L)

  // Subject is casual, does not signal urgency or debt
  const firstName = profile.artist_name.split(' ')[0]
  const defaultSubjectBase = `Hey ${firstName}, quick note from management`
  const defaultSubject = testOnly ? `[TEST] ${defaultSubjectBase}` : defaultSubjectBase
  const subject = L.subject?.trim() || defaultSubject

  let to = testOnly ? [profile.manager_email!] : [profile.artist_email]
  let cc = testOnly ? [] : (profile.manager_email ? [profile.manager_email] : [])
  const resolved = resolveArtistFacingResend({
    row: testModeRow,
    testOnly,
    to,
    cc,
    subject,
  })
  if (!resolved.ok) {
    return { statusCode: 400, body: JSON.stringify({ message: resolved.message }) }
  }
  to = resolved.to
  cc = resolved.cc
  const subjectOut = resolved.subject

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: profile.from_email,
      to,
      ...(cc.length > 0 ? { cc } : {}),
      subject: subjectOut,
      html,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}))
    return {
      statusCode: resendRes.status,
      body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend API error' }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Reminder sent successfully' }),
  }
}

export { handler }
