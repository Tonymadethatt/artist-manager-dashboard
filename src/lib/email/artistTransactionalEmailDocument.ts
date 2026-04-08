import type { EmailTemplateLayoutV1 } from '../emailLayout'
import { escapeHtmlPlain, renderAppendBlocksHtml } from './appendBlocksHtml'

export type ArtistTransactionalKind = 'performance_report_received' | 'gig_week_reminder'

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
    const when = eventDate
      ? ` on <strong>${escapeHtmlPlain(eventDate)}</strong>`
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
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">${greeting}</p>
    <p style="font-size:14px;color:#d1d1d1;line-height:1.8;margin-bottom:24px;">${intro}</p>
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
