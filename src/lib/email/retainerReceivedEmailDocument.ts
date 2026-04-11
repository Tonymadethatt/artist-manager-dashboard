import type { EmailTemplateLayoutV1 } from '../emailLayout'
import { renderAppendBlocksHtml } from './appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
} from './emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from './artistBrandedEmailFooterHtml'

function escapeHtmlEnt(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

export type RetainerReceivedProfile = {
  artist_name: string
  manager_name: string | null
  manager_title: string | null
  social_handle: string | null
  website: string | null
  phone: string | null
}

export type RetainerReceivedSettledRow = { month: string; invoiced: number; paid: number }

/**
 * Live send and in-app preview share this HTML (pass `siteUrl` from Netlify `URL` or `''` for relative assets in dev preview).
 */
export function buildRetainerReceivedEmailHtml(
  profile: RetainerReceivedProfile,
  settledFees: RetainerReceivedSettledRow[],
  totalAcknowledged: number,
  L: EmailTemplateLayoutV1,
  siteUrl: string,
): string {
  const managerName = profile.manager_name || 'Management'
  const logoUrl = `${siteUrl}/dj-luijay-logo-email.png`

  const defaultRecap =
    'Just confirming on our side: your management retainer payment is accounted for. Thank you for staying on top of it.'

  const feeTableBlock = settledFees.length > 0
    ? `
    <div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#161616;padding:10px 18px;border-bottom:1px solid #2a2a2a;">
        <span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">Retainer received in full</span>
      </div>
      <div style="padding:0 18px;">
        <table class="fee-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Month</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Invoiced</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:${EMAIL_LABEL};padding:10px 0 6px;border-bottom:1px solid #2a2a2a;">Paid</th>
            </tr>
          </thead>
          <tbody>${settledFees.map(f => `
            <tr>
              <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#ffffff;font-weight:500;">${escapeHtmlEnt(f.month)}</td>
              <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#60a5fa;text-align:right;">${money(f.invoiced)}</td>
              <td style="padding:12px 0;border-bottom:1px solid #222222;font-size:13px;color:#22c55e;text-align:right;font-weight:600;">${money(f.paid)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>`
    : `
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.75;margin-bottom:24px;">Your retainer is all caught up on our side. Thank you.</p>`

  const totalCallout = settledFees.length > 0
    ? `
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;margin:4px 0 24px;border-collapse:collapse;">
      <tr>
        <td style="padding:18px 22px;font-size:13px;color:${EMAIL_BODY_SECONDARY};vertical-align:middle;">Total acknowledged</td>
        <td style="padding:18px 22px;font-size:22px;font-weight:800;color:#22c55e;letter-spacing:-0.5px;text-align:right;vertical-align:middle;">${money(totalAcknowledged)}</td>
      </tr>
    </table>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Retainer received</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-header { padding: 24px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .fee-table { font-size: 12px !important; }
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
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:20px;">Hey ${escapeHtmlEnt(profile.artist_name)},</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:20px;">${L.intro?.trim()
    ? escapeHtmlEnt(L.intro).replace(/\n/g, '<br/>')
    : defaultRecap}</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:28px;">Here is a quick confirmation for your records:</p>

    ${feeTableBlock}
    ${totalCallout}

    ${renderAppendBlocksHtml(L.appendBlocks)}

    ${L.closing?.trim()
    ? `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">${escapeHtmlEnt(L.closing).replace(/\n/g, '<br/>')}</p>`
    : `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:12px;">Thanks again. If anything looks off on your side, reply and we will sort it.</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;">${escapeHtmlEnt(managerName)}</p>`}
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
