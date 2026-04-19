/**
 * Artist-facing booking commission reminder — one card per show (gig gross, rate, commission).
 * Used by Email Templates preview, test send, and (later) queue/automation.
 */

import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { artistLayoutForSend } from '@/lib/emailLayout'
import { renderAppendBlocksHtml } from '@/lib/email/appendBlocksHtml'
import { decorateProgrammaticSectionCardTitle } from '@/lib/email/emailSectionCardEmoji'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
  EMAIL_ROW_LABEL,
  EMAIL_TEXT_PRIMARY,
} from '@/lib/email/emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from '@/lib/email/artistBrandedEmailFooterHtml'
import { formatPacificWeekdayMdYyFromYmd } from '@/lib/calendar/pacificWallTime'
import { formatUsdDisplayCeil } from '@/lib/format/displayCurrency'
import { artistTransactionalGreetingFirstName } from '@/lib/email/artistTransactionalEmailDocument'

export type BookingCommissionLineItem = {
  venueName: string
  /** YYYY-MM-DD */
  eventDateYmd: string
  gigGross: number
  commissionRatePercent: number
  commissionAmount: number
}

/** Sample rows for template preview and test send when no live data is passed. */
export const PREVIEW_BOOKING_COMMISSION_LINE_ITEMS: BookingCommissionLineItem[] = [
  {
    venueName: 'Skyline Bar & Lounge',
    eventDateYmd: '2026-05-17',
    gigGross: 2500,
    commissionRatePercent: 15,
    commissionAmount: 375,
  },
  {
    venueName: 'Harbor Room',
    eventDateYmd: '2026-06-03',
    gigGross: 1800,
    commissionRatePercent: 15,
    commissionAmount: 270,
  },
]

export type BookingCommissionReminderFooter = {
  logoBaseUrl: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
}

function escapeHtmlPlain(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function money(n: number) {
  return formatUsdDisplayCeil(n)
}

function formatRatePct(n: number): string {
  if (Number.isInteger(n)) return `${n}%`
  return `${Math.round(n * 10) / 10}%`
}

function rows(items: Array<[string, string, string?]>): string {
  return items.map(([label, value, valueColor = EMAIL_TEXT_PRIMARY], i, arr) => {
    const isLast = i === arr.length - 1
    const border = isLast ? '' : 'border-bottom:1px solid #222222;'
    return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:11px 0;${border}"><span style="font-size:13px;color:${EMAIL_ROW_LABEL};line-height:1.45;max-width:52%;">${label}</span><span style="font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;">${value}</span></div>`
  }).join('')
}

function sectionCard(title: string, content: string): string {
  const safeTitle = escapeHtmlPlain(decorateProgrammaticSectionCardTitle(title))
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${safeTitle}</span></div><div style="padding:2px 18px 8px;">${content}</div></div>`
}

const sharedStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; }
    .email-body { padding: 22px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
  }`

function sharedHeader(logoSrc: string): string {
  return `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoSrc}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:${EMAIL_META_TAGLINE};letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`
}

export function buildBookingCommissionReminderEmailHtml(input: {
  artistName: string
  footer: BookingCommissionReminderFooter
  lineItems: BookingCommissionLineItem[]
  customSubject?: string | null
  customIntro?: string | null
  layout?: EmailTemplateLayoutV1 | null
}): string {
  const { artistName, footer, lineItems, customSubject, customIntro, layout } = input
  const L = artistLayoutForSend(layout ?? null, customSubject ?? null, customIntro ?? null)
  const firstName = artistTransactionalGreetingFirstName(artistName)
  const base = footer.logoBaseUrl.replace(/\/$/, '')
  const logoSrc = base ? `${base}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png'

  const roleBannerLabel = escapeHtmlPlain(decorateProgrammaticSectionCardTitle('Booking commission'))
  const roleBanner =
    `<div style="background:rgba(96,165,250,0.07);border:1px solid rgba(96,165,250,0.22);border-radius:8px;padding:11px 16px;margin-bottom:20px;">`
    + `<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${EMAIL_LABEL};vertical-align:middle;">${roleBannerLabel}</span>`
    + `</div>`

  const introDefault =
    `Here is a simple breakdown of booking commission we are tracking. Each card is one show so it is clear what the numbers refer to. `
    + `This is just housekeeping so we stay aligned—no pressure.`

  const introHtml = L.intro?.trim()
    ? escapeHtmlPlain(L.intro).replace(/\n/g, '<br/>')
    : introDefault

  const cardsHtml = lineItems.map(item => {
    const ymd = item.eventDateYmd.trim()
    const dateLine = /^\d{4}-\d{2}-\d{2}$/.test(ymd) ? formatPacificWeekdayMdYyFromYmd(ymd) : ymd
    const cardTitle = `${item.venueName} · ${dateLine}`
    const inner = rows([
      ['Gig fee (your gross on this show)', money(item.gigGross), '#ffffff'],
      ['Commission rate', formatRatePct(item.commissionRatePercent), '#60a5fa'],
      ['Commission for this show', money(item.commissionAmount), '#22c55e'],
    ])
    return sectionCard(cardTitle, inner)
  }).join('')

  const totalCommission = lineItems.reduce((s, x) => s + (Number.isFinite(x.commissionAmount) ? x.commissionAmount : 0), 0)
  const totalRounded = Math.round(totalCommission * 100) / 100

  const totalStrip =
    lineItems.length > 0
      ? `<div style="display:flex;justify-content:space-between;align-items:center;background:rgba(96,165,250,0.08);border:1px solid rgba(96,165,250,0.2);border-radius:8px;padding:16px 20px;margin-bottom:20px;">
      <div style="font-size:13px;color:${EMAIL_BODY_SECONDARY};">Total commission (this note)</div>
      <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${money(totalRounded)}</div>
    </div>`
      : ''

  const closingDefault =
    `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:12px;">`
    + `If you already sent payment for any of these, you can ignore those lines—our records may just be catching up. `
    + `If something looks off or you want to talk it through, reply to this email and we will sort it out.</p>`
    + `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">Thanks for keeping everything moving.</p>`

  const closingBlock = L.closing?.trim()
    ? `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">${escapeHtmlPlain(L.closing).replace(/\n/g, '<br/>')}</p>`
    : closingDefault

  const footerHtml = buildArtistBrandedEmailFooterHtml({
    logoBaseUrl: footer.logoBaseUrl,
    managerName: footer.managerName,
    managerTitle: footer.managerTitle ?? null,
    website: footer.website ?? null,
    social_handle: footer.social_handle ?? null,
    phone: footer.phone ?? null,
  })

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Booking commission</title>
<style>${sharedStyles}</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  ${sharedHeader(logoSrc)}
  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:8px;">Hey ${escapeHtmlPlain(firstName)},</p>
    ${roleBanner}
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:22px;">${introHtml}</p>
    ${cardsHtml}
    ${totalStrip}
    ${renderAppendBlocksHtml(L.appendBlocks)}
    ${closingBlock}
  </div>
  ${footerHtml}
</div>
</body>
</html>`
}
