import type { EmailTemplateLayoutV1 } from '../emailLayout'
import { escapeHtmlPlain, renderAppendBlocksHtml } from './appendBlocksHtml'

export type ArtistTransactionalKind = 'performance_report_received' | 'gig_week_reminder'

/** Human-readable date for email copy when `eventDate` is ISO `yyyy-mm-dd`. */
function formatEventDateForEmail(isoOrLabel: string | null): string | null {
  if (!isoOrLabel?.trim()) return null
  const t = isoOrLabel.trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t)
  if (!m) return t
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December']
  const mo = parseInt(m[2], 10) - 1
  const day = parseInt(m[3], 10)
  return `${months[mo]} ${day}, ${m[1]}`
}

function logoUrls(base: string) {
  const prefix = base.replace(/\/$/, '')
  return {
    logo: prefix ? `${prefix}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png',
  }
}

export function buildArtistTransactionalEmailHtml(
  kind: ArtistTransactionalKind,
  input: {
    artistName: string
    venueName: string
    eventDate: string | null
    managerName: string
  },
  L: EmailTemplateLayoutV1,
  logoBaseUrl: string,
): string {
  const { artistName, venueName, eventDate, managerName } = input
  const firstName = artistName.split(/\s+/)[0] || artistName
  const { logo: logoUrl } = logoUrls(logoBaseUrl)

  const defaultGreeting = `Hi ${escapeHtmlPlain(firstName)},`
  let defaultIntro: string
  let defaultClosing: string

  if (kind === 'performance_report_received') {
    defaultIntro =
      `Thanks for submitting the post-show check-in for <strong>${escapeHtmlPlain(venueName)}</strong>. `
      + `<strong>${escapeHtmlPlain(managerName)}</strong> has your notes and will follow up as needed.`
    defaultClosing = 'If anything else comes to mind, just reply to this email.'
  } else {
    const dateLabel = formatEventDateForEmail(eventDate)
    const when = dateLabel
      ? ` on <strong>${escapeHtmlPlain(dateLabel)}</strong>`
      : ''
    defaultIntro =
      `Quick heads-up: you have <strong>${escapeHtmlPlain(venueName)}</strong>${when} on the calendar. `
      + 'Double-check travel, promo, and any open questions with the venue.'
    defaultClosing = `Reach out if you want <strong>${escapeHtmlPlain(managerName)}</strong> to handle anything with the booker.`
  }

  const greeting = L.greeting?.trim()
    ? escapeHtmlPlain(L.greeting.trim().replace(/\{firstName\}/gi, firstName)).replace(/\n/g, '<br/>')
    : defaultGreeting
  const introRaw = L.intro?.trim()
  const intro = introRaw
    ? escapeHtmlPlain(introRaw).replace(/\n/g, '<br/>')
    : defaultIntro
  const closingRaw = L.closing?.trim()
  const closing = closingRaw
    ? escapeHtmlPlain(closingRaw).replace(/\n/g, '<br/>')
    : defaultClosing

  const companyName = artistName

  const appendHtml = renderAppendBlocksHtml(L.appendBlocks)

  const roleBanner = kind === 'performance_report_received'
    ? `<div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.22);border-radius:8px;padding:11px 16px;margin-bottom:20px;"><span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;margin-right:10px;vertical-align:middle;"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#a3a3a3;vertical-align:middle;">Post-show check-in</span></div>`
    : `<div style="background:rgba(96,165,250,0.07);border:1px solid rgba(96,165,250,0.22);border-radius:8px;padding:11px 16px;margin-bottom:20px;"><span style="display:inline-block;width:6px;height:6px;background:#60a5fa;border-radius:50%;margin-right:10px;vertical-align:middle;"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#a3a3a3;vertical-align:middle;">Gig week</span></div>`

  const gigPrepBlock = kind === 'gig_week_reminder'
    ? `<div style="background:#161616;border:1px solid #252525;border-radius:8px;padding:14px 18px;margin-bottom:22px;"><p style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#888888;margin-bottom:10px;">Quick prep</p><ul style="font-size:13px;color:#c4c4c4;line-height:1.65;padding-left:18px;margin:0;"><li style="margin-bottom:6px;">Travel, parking, and load-in window</li><li style="margin-bottom:6px;">Promo or holding assets if the venue needs them</li><li>Any open logistics questions for the booker</li></ul></div>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
</style>
</head>
<body>
<div style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>
  <div style="padding:28px 32px;">
    ${roleBanner}
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">${greeting}</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:20px;">${intro}</p>
    ${gigPrepBlock}
    ${appendHtml}
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-top:8px;">${closing}</p>
  </div>
  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:4px;">${escapeHtmlPlain(companyName.toUpperCase())}</div>
  </div>
</div>
</body>
</html>`
}
