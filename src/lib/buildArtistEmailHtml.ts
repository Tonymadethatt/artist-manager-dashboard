// Frontend preview builder for artist-facing emails.
// Mirrors send-report.ts and send-reminder.ts HTML structure with mock data.

import { applyPerformanceReportPlaceholders } from '@/lib/performanceReportEmailPlaceholders'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { artistLayoutForSend } from '@/lib/emailLayout'
import { renderAppendBlocksHtml } from '@/lib/email/appendBlocksHtml'
import { buildRetainerReceivedEmailHtml } from '@/lib/email/retainerReceivedEmailDocument'

function escapeHtmlPlain(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const logoUrl = '/dj-luijay-logo.png'
const igIconUrl = '/icons/icon-ig.png'

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function rows(items: Array<[string, string, string?]>): string {
  return items.map(([label, value, valueColor = '#ffffff'], i, arr) => {
    const isLast = i === arr.length - 1
    const border = isLast ? '' : 'border-bottom:1px solid #222222;'
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;${border}"><span style="font-size:13px;color:#888888;line-height:1.4;">${label}</span><span style="font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;">${value}</span></div>`
  }).join('')
}

function sectionCard(title: string, content: string, accentColor = '#60a5fa'): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">${title}</span></div><div style="padding:2px 18px 4px;">${content}</div></div>`
}

const sharedHeader = `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:8px;font-weight:500;color:#555555;letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`

const sharedFooter = `
  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;">Front Office</div>
    <div style="font-size:11px;color:#888888;margin-top:3px;letter-spacing:0.3px;">Front Office&#8482; Brand Growth &amp; Management</div>
    <div style="margin-top:10px;display:flex;align-items:center;flex-wrap:wrap;gap:0;">
      <a href="https://djluijay.com" style="color:#888888;text-decoration:none;font-size:11px;">djluijay.com</a>
      <span style="color:#444444;margin:0 8px;">|</span>
      <a href="https://instagram.com/djluijay" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;vertical-align:middle;">
        <img src="${igIconUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.6;" />
        <span style="font-size:11px;color:#888888;">@djluijay</span>
      </a>
    </div>
  </div>`

const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; }
    .email-body { padding: 22px 18px !important; }
    .hero-val { font-size: 36px !important; }
  }`

// ---------------------------------------------------------------------------
// Management Report preview
// ---------------------------------------------------------------------------

export function buildManagementReportHtml(
  customIntro?: string | null,
  _customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, null, customIntro)
  const startFmt = fmtDate('2026-03-28')
  const endFmt = fmtDate('2026-04-04')

  const outreachSection = sectionCard('Outreach Activity', rows([
    ['New venues added', '4', '#60a5fa'],
    ['Venues engaged', '6', '#60a5fa'],
    ['Active discussions', '3', '#60a5fa'],
    ['Bookings confirmed', '1', '#22c55e'],
  ]), '#60a5fa')

  const dealsSection = sectionCard('Deals and Revenue', rows([
    ['New deals logged', '2', '#60a5fa'],
    ['Total artist revenue', '$1,200.00', '#ffffff'],
    ['Commission earned', '$240.00', '#ffffff'],
    ['Commission received', '$240.00', '#22c55e'],
  ]), '#22c55e')

  const retainerSection = sectionCard('Monthly Retainer', rows([
    ['Total invoiced', '$350.00', '#60a5fa'],
    ['Received so far', '$150.00', '#22c55e'],
  ]), '#ef4444')

  const balanceCallout = `
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:20px 22px;margin-bottom:14px;">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;margin-bottom:10px;">Outstanding Balance</div>
  <div style="font-size:30px;font-weight:800;color:#ef4444;letter-spacing:-1px;line-height:1;margin-bottom:8px;">$200.00</div>
  <div style="font-size:13px;color:#d1d1d1;line-height:1.65;">Outstanding management balance, commission and retainer combined. Details are in the sections above.</div>
</div>`

  const introRaw = L.intro?.trim()
  const opener = introRaw
    ? escapeHtmlPlain(introRaw).replace(/\n/g, '<br/>')
    : `A booking came through this period, the work is paying off. Here is your full management update covering <strong>${startFmt}</strong> through <strong>${endFmt}</strong>.`

  const closer = L.closing?.trim()
    ? escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')
    : 'That is the full picture. Reach out if you want to talk through anything.'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Report</title>
<style>${sharedStyles}</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  ${sharedHeader}
  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:26px;">Hey DJ Luijay,<br><br>${opener}</p>
    <div style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:26px 20px;margin-bottom:22px;">
      <div class="hero-val" style="font-size:44px;font-weight:800;color:#22c55e;letter-spacing:-1.5px;line-height:1;">1</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#888888;margin-top:10px;">Booking Confirmed</div>
      <div style="font-size:12px;color:#d1d1d1;margin-top:5px;">New venue secured this period</div>
    </div>
    ${outreachSection}
    ${dealsSection}
    ${retainerSection}
    ${balanceCallout}
    ${renderAppendBlocksHtml(L.appendBlocks)}
    <p style="font-size:13px;color:#888888;line-height:1.75;margin-top:10px;">${closer}</p>
  </div>
  ${sharedFooter}
</div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Retainer Reminder preview
// ---------------------------------------------------------------------------

export function buildRetainerReminderHtml(
  customIntro?: string | null,
  _customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, null, customIntro)
  const recapLine = L.intro?.trim()
    ? escapeHtmlPlain(L.intro).replace(/\n/g, '<br/>')
    : `We have been heads down on the management side. Outreach is active, conversations are moving, and I am continuing to push the brand forward.`

  const feeRows = [
    { month: 'February 2026', owed: 350, paid: 0,   balance: 350 },
    { month: 'March 2026',    owed: 350, paid: 150,  balance: 200 },
    { month: 'April 2026',    owed: 350, paid: 0,    balance: 350 },
  ].map(f => {
    const isPartial = f.paid > 0
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#ffffff;font-weight:500;">${f.month}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#60a5fa;text-align:right;">${money(f.owed)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:${isPartial ? '#22c55e' : '#444444'};text-align:right;">${isPartial ? money(f.paid) : '-'}</td>
      <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;font-weight:700;color:#ef4444;text-align:right;">${money(f.balance)}</td>
    </tr>`
  }).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Note</title>
<style>${sharedStyles}
  .hide-mobile { display: table-cell; }
  @media only screen and (max-width: 600px) { .hide-mobile { display: none !important; } }
</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  ${sharedHeader}
  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:20px;">Hey DJ Luijay,</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:20px;">${recapLine}</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:28px;">Wanted to do a quick check-in on the management retainer. There is a balance that has not cleared yet. Here is where things stand:</p>

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#161616;padding:10px 18px;border-bottom:1px solid #2a2a2a;">
        <span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">Retainer Balance</span>
      </div>
      <div style="padding:0 18px;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888888;padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Month</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888888;padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Invoiced</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888888;padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Paid</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#888888;padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Balance</th>
            </tr>
          </thead>
          <tbody>${feeRows}</tbody>
        </table>
      </div>
    </div>

    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">
      <p style="font-size:13px;color:#d1d1d1;line-height:1.6;">Partial payments already received are reflected above, thank you for those.</p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:18px 22px;margin-bottom:24px;">
      <div style="font-size:13px;color:#d1d1d1;">Total outstanding</div>
      <div style="font-size:22px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;">${money(900)}</div>
    </div>

    ${renderAppendBlocksHtml(L.appendBlocks)}
    ${L.closing?.trim()
    ? `<p style="font-size:14px;color:#d1d1d1;line-height:1.8;">${escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')}</p>`
    : `<p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:12px;">Whenever you are able to send something over, even a partial, just shoot it through and let me know. Happy to work with whatever works for you right now.</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;">Appreciate you, let us keep this momentum going. Big things ahead.</p>`}
  </div>
  ${sharedFooter}
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Retainer received (paid in full) preview
// ---------------------------------------------------------------------------

export function buildRetainerReceivedHtml(
  customIntro?: string | null,
  customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, customSubject, customIntro)
  const profile = {
    artist_name: 'DJ Luijay',
    manager_name: 'Front Office',
    social_handle: 'djluijay',
    website: 'https://djluijay.com',
    phone: null as string | null,
  }
  const settledFees = [
    { month: 'February 2026', invoiced: 350, paid: 350 },
    { month: 'March 2026', invoiced: 350, paid: 350 },
  ]
  const totalAcknowledged = settledFees.reduce((s, f) => s + f.paid, 0)
  return buildRetainerReceivedEmailHtml(profile, settledFees, totalAcknowledged, L, '')
}

const PERF_PREVIEW_VENUE = 'Skyline Bar & Lounge'
const PERF_PREVIEW_ARTIST = 'DJ Luijay'

export function buildPerformanceReportRequestHtml(
  customIntro?: string | null,
  customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, customSubject, customIntro)
  const formUrl = '#'
  const venueName = PERF_PREVIEW_VENUE
  const artistFull = PERF_PREVIEW_ARTIST
  const firstName = artistFull.split(/\s+/)[0] || artistFull
  const subjectRaw = L.subject?.trim()
  const subject = subjectRaw
    ? applyPerformanceReportPlaceholders(subjectRaw, venueName, artistFull)
    : `Quick check-in: How did the show go at ${venueName}?`

  const defaultCardBody = `<p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:16px;">Quick check-in on how everything went. The form takes less than a minute and helps us keep your momentum going - tracking opportunities, payments, and next steps all in one place.</p>`
  const cardInner = (() => {
    const raw = L.intro?.trim()
    if (!raw) return defaultCardBody
    const applied = applyPerformanceReportPlaceholders(raw, venueName, artistFull)
    if (applied.includes('<')) return applied
    return `<p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:16px;">${escapeHtmlPlain(applied).replace(/\n/g, '<br/>')}</p>`
  })()

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${subject}</title>
<style>${sharedStyles}</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  ${sharedHeader}
  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">Hey ${firstName},</p>
    <p style="font-size:13px;color:#888888;margin-bottom:24px;">Show at <strong style="color:#ffffff;">Skyline Bar &amp; Lounge</strong> &mdash; April 4, 2026</p>

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 22px;margin-bottom:24px;">
      ${cardInner}
      <a href="${formUrl}" style="display:inline-block;background:#ffffff;color:#000000;font-size:14px;font-weight:700;padding:13px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.2px;">Complete Your Show Report</a>
    </div>

    ${renderAppendBlocksHtml(L.appendBlocks)}
    ${L.closing?.trim()
    ? `<p style="font-size:13px;color:#d1d1d1;line-height:1.7;margin-bottom:12px;">${escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')}</p>`
    : ''}

    <p style="font-size:13px;color:#555555;line-height:1.7;">This link is personal to you and only works once. If you have any issues, reply to this email.</p>
  </div>
  ${sharedFooter}
</div>
</body>
</html>`
}
