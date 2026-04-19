// Frontend preview builder for artist-facing emails.
// Mirrors send-report.ts and send-reminder.ts HTML structure with mock data.

import { applyPerformanceReportPlaceholders } from '@/lib/performanceReportEmailPlaceholders'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { artistLayoutForSend } from '@/lib/emailLayout'
import { renderAppendBlocksHtml } from '@/lib/email/appendBlocksHtml'
import { decorateProgrammaticSectionCardTitle } from '@/lib/email/emailSectionCardEmoji'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_FOOTER_MUTED,
  EMAIL_HINT,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
  EMAIL_ROW_LABEL,
  EMAIL_TEXT_PRIMARY,
} from '@/lib/email/emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from '@/lib/email/artistBrandedEmailFooterHtml'
import { buildRetainerReceivedEmailHtml } from '@/lib/email/retainerReceivedEmailDocument'
import { formatPacificWeekdayMdYyFromYmd } from '@/lib/calendar/pacificWallTime'
import { formatUsdDisplayCeil } from '@/lib/format/displayCurrency'

function escapeHtmlPlain(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Match live artist transactional emails: prefer given name when billing as "DJ …". */
function artistEmailPreviewGreetingName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && /^DJ\.?$/i.test(parts[0] ?? '')) {
    return parts.slice(1).join(' ') || fullName.trim()
  }
  return parts[0] ?? fullName.trim()
}

const logoUrl = '/dj-luijay-logo-email.png'

function money(n: number) {
  return formatUsdDisplayCeil(n)
}

function rows(items: Array<[string, string, string?]>): string {
  return items.map(([label, value, valueColor = EMAIL_TEXT_PRIMARY], i, arr) => {
    const isLast = i === arr.length - 1
    const border = isLast ? '' : 'border-bottom:1px solid #222222;'
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:11px 0;${border}"><span style="font-size:13px;color:${EMAIL_ROW_LABEL};line-height:1.4;">${label}</span><span style="font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;">${value}</span></div>`
  }).join('')
}

function sectionCard(title: string, content: string): string {
  const safeTitle = escapeHtmlPlain(decorateProgrammaticSectionCardTitle(title))
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${safeTitle}</span></div><div style="padding:2px 18px 4px;">${content}</div></div>`
}

const sharedHeader = `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:${EMAIL_META_TAGLINE};letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`

/** Live manager profile fields for the branded email footer in the template preview panel (matches production sends). */
export type ArtistEmailHtmlPreviewFooter = {
  logoBaseUrl: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
}

function brandedFooterHtml(footer: ArtistEmailHtmlPreviewFooter): string {
  return buildArtistBrandedEmailFooterHtml({
    logoBaseUrl: footer.logoBaseUrl,
    managerName: footer.managerName,
    managerTitle: footer.managerTitle ?? null,
    website: footer.website ?? null,
    social_handle: footer.social_handle ?? null,
    phone: footer.phone ?? null,
  })
}

const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; }
    .email-body { padding: 22px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .hero-val { font-size: 36px !important; }
  }`

const PERF_PREVIEW_VENUE = 'Skyline Bar & Lounge'
const PERF_PREVIEW_ARTIST = 'DJ Luijay'

// ---------------------------------------------------------------------------
// Management Report preview
// ---------------------------------------------------------------------------

export function buildManagementReportHtml(
  footer: ArtistEmailHtmlPreviewFooter,
  customIntro?: string | null,
  _customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, null, customIntro)
  const startFmt = formatPacificWeekdayMdYyFromYmd('2026-03-28')
  const endFmt = formatPacificWeekdayMdYyFromYmd('2026-04-04')

  const outreachSection = sectionCard('Outreach Activity', rows([
    ['New venues added', '4', '#60a5fa'],
    ['Venues engaged', '6', '#60a5fa'],
    ['Active discussions', '3', '#60a5fa'],
    ['Bookings confirmed', '1', '#22c55e'],
  ]))

  const dealsSection = sectionCard('Deals and Revenue', rows([
    ['New deals logged', '2', '#60a5fa'],
    ['Total artist revenue', '$1,200.00', '#ffffff'],
    ['Commission earned', '$240.00', '#ffffff'],
    ['Commission received', '$240.00', '#22c55e'],
  ]))

  const retainerSection = sectionCard('Monthly Retainer', rows([
    ['Total invoiced', '$350.00', '#60a5fa'],
    ['Received so far', '$150.00', '#22c55e'],
  ]))

  const balanceCallout = `
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:20px 22px;margin-bottom:14px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};margin-bottom:10px;">${escapeHtmlPlain(decorateProgrammaticSectionCardTitle('Outstanding Balance'))}</div>
  <div style="font-size:30px;font-weight:800;color:#ef4444;letter-spacing:-1px;line-height:1;margin-bottom:8px;">$200.00</div>
  <div style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.65;">Outstanding management balance, commission and retainer combined. Details are in the sections above.</div>
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
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:26px;">Hey ${escapeHtmlPlain(artistEmailPreviewGreetingName(PERF_PREVIEW_ARTIST))},<br><br>${opener}</p>
    <div style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:26px 20px;margin-bottom:22px;">
      <div class="hero-val" style="font-size:44px;font-weight:800;color:#22c55e;letter-spacing:-1.5px;line-height:1;">1</div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${EMAIL_LABEL};margin-top:10px;">Booking Confirmed</div>
      <div style="font-size:12px;color:${EMAIL_BODY_SECONDARY};margin-top:5px;">New venue secured this period</div>
    </div>
    ${outreachSection}
    ${dealsSection}
    ${retainerSection}
    ${balanceCallout}
    ${renderAppendBlocksHtml(L.appendBlocks)}
    <p style="font-size:13px;color:${EMAIL_FOOTER_MUTED};line-height:1.75;margin-top:10px;">${closer}</p>
  </div>
  ${brandedFooterHtml(footer)}
</div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Retainer Reminder preview
// ---------------------------------------------------------------------------

export function buildRetainerReminderHtml(
  footer: ArtistEmailHtmlPreviewFooter,
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
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:20px;">Hey ${escapeHtmlPlain(artistEmailPreviewGreetingName(PERF_PREVIEW_ARTIST))},</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:20px;">${recapLine}</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:28px;">Wanted to do a quick check-in on the management retainer. There is a balance that has not cleared yet. Here is where things stand:</p>

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#161616;padding:10px 18px;border-bottom:1px solid #2a2a2a;">
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${escapeHtmlPlain(decorateProgrammaticSectionCardTitle('Retainer Balance'))}</span>
      </div>
      <div style="padding:0 18px;">
        <table style="width:100%;border-collapse:collapse;">
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

    <div style="background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:6px;padding:12px 16px;margin-bottom:16px;">
      <p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.6;">Partial payments already received are reflected above, thank you for those.</p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:18px 22px;margin-bottom:24px;">
      <div style="font-size:13px;color:${EMAIL_BODY_SECONDARY};">Total outstanding</div>
      <div style="font-size:22px;font-weight:800;color:#ef4444;letter-spacing:-0.5px;">${money(900)}</div>
    </div>

    ${renderAppendBlocksHtml(L.appendBlocks)}
    ${L.closing?.trim()
    ? `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">${escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')}</p>`
    : `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:12px;">Whenever you are able to send something over, even a partial, just shoot it through and let me know. Happy to work with whatever works for you right now.</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">Appreciate you, let us keep this momentum going. Big things ahead.</p>`}
  </div>
  ${brandedFooterHtml(footer)}
  </div>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Retainer received (paid in full) preview
// ---------------------------------------------------------------------------

export function buildRetainerReceivedHtml(
  footer: ArtistEmailHtmlPreviewFooter,
  customIntro?: string | null,
  customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, customSubject, customIntro)
  const profile = {
    artist_name: 'DJ Luijay',
    manager_name: footer.managerName,
    manager_title: footer.managerTitle ?? null,
    social_handle: footer.social_handle ?? null,
    website: footer.website ?? null,
    phone: footer.phone ?? null,
  }
  const settledFees = [
    { month: 'February 2026', invoiced: 350, paid: 350 },
    { month: 'March 2026', invoiced: 350, paid: 350 },
  ]
  const totalAcknowledged = settledFees.reduce((s, f) => s + f.paid, 0)
  return buildRetainerReceivedEmailHtml(profile, settledFees, totalAcknowledged, L, footer.logoBaseUrl)
}

export function buildPerformanceReportRequestHtml(
  footer: ArtistEmailHtmlPreviewFooter,
  customIntro?: string | null,
  customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
): string {
  const L = artistLayoutForSend(layout ?? null, customSubject, customIntro)
  const formUrl = '#'
  const venueName = PERF_PREVIEW_VENUE
  const artistFull = PERF_PREVIEW_ARTIST
  const firstName = artistEmailPreviewGreetingName(artistFull)
  const subjectRaw = L.subject?.trim()
  const subject = subjectRaw
    ? applyPerformanceReportPlaceholders(subjectRaw, venueName, artistFull)
    : `Quick check-in: How did the show go at ${venueName}?`

  const defaultCardBody = `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:16px;">Quick check-in on how everything went. The form takes less than a minute and helps us keep your momentum going - tracking opportunities, payments, and next steps all in one place.</p>`
  const cardInner = (() => {
    const raw = L.intro?.trim()
    if (!raw) return defaultCardBody
    const applied = applyPerformanceReportPlaceholders(raw, venueName, artistFull)
    if (applied.includes('<')) return applied
    return `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:16px;">${escapeHtmlPlain(applied).replace(/\n/g, '<br/>')}</p>`
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
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">Hey ${escapeHtmlPlain(firstName)},</p>
    <p style="font-size:13px;color:${EMAIL_ROW_LABEL};margin-bottom:24px;">Show at <strong style="color:#ffffff;">Skyline Bar &amp; Lounge</strong> &mdash; April 4, 2026</p>

    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;padding:20px 22px;margin-bottom:24px;">
      ${cardInner}
      <a href="${formUrl}" style="display:inline-block;background:#ffffff;color:#000000;font-size:14px;font-weight:600;padding:13px 28px;border-radius:6px;text-decoration:none;letter-spacing:0.2px;">Complete Your Show Report</a>
    </div>

    ${renderAppendBlocksHtml(L.appendBlocks)}
    ${L.closing?.trim()
    ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.7;margin-bottom:12px;">${escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')}</p>`
    : ''}

    <p style="font-size:13px;color:${EMAIL_HINT};line-height:1.7;">This link is personal to you and only works once. If you have any issues, reply to this email.</p>
  </div>
  ${brandedFooterHtml(footer)}
</div>
</body>
</html>`
}
