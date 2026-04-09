import { escapeHtmlPlain, renderAppendBlocksHtml } from './appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
} from './emailDarkSurfacePalette'
import { emailFooterArtistPersonaSublineHtml } from './emailFooterPersonaLines'
import { buildProfileFooterLinksRowHtml } from './profileFooterLinksHtml'
import type { EmailTemplateLayoutV1 } from '../emailLayout'

function logoUrls(base: string) {
  const prefix = base.replace(/\/$/, '')
  return {
    logo: prefix ? `${prefix}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png',
    ig: prefix ? `${prefix}/icons/icon-ig.png` : '/icons/icon-ig.png',
  }
}

const mobileStyles = `
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; }
    .email-body { padding: 22px 18px !important; }
  }`

export type ArtistBrandedEmailShellInput = {
  logoBaseUrl: string
  roleBannerHtml: string
  /** First paragraph (already safe HTML inside body, e.g. greeting line). */
  greetingInnerHtml: string
  /** Second paragraph — intro copy (safe HTML). */
  introInnerHtml: string
  /** Optional block between intro and append blocks (safe HTML: tables, cards). */
  middleHtml: string
  layout: EmailTemplateLayoutV1
  /** Closing paragraph (safe HTML). */
  closingInnerHtml: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
}

/**
 * Shared “Front Office” wrapper for artist-facing transactional + gig calendar sends.
 */
export function buildArtistBrandedEmailHtml(input: ArtistBrandedEmailShellInput): string {
  const {
    logoBaseUrl,
    roleBannerHtml,
    greetingInnerHtml,
    introInnerHtml,
    middleHtml,
    layout,
    closingInnerHtml,
    managerName,
    managerTitle,
    website,
    social_handle: socialHandle,
    phone,
  } = input

  const { logo: logoUrl, ig: igUrl } = logoUrls(logoBaseUrl)
  const appendHtml = renderAppendBlocksHtml(layout.appendBlocks)
  const footerLinksHtml = buildProfileFooterLinksRowHtml(igUrl, website, socialHandle, phone)
  const footerSubline = emailFooterArtistPersonaSublineHtml(managerTitle)

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
${mobileStyles}
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
    ${roleBannerHtml}
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">${greetingInnerHtml}</p>
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-bottom:20px;">${introInnerHtml}</p>
    ${middleHtml}
    ${appendHtml}
    <p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.8;margin-top:8px;">${closingInnerHtml}</p>
  </div>
  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;">${escapeHtmlPlain(managerName)}</div>
    ${footerSubline}
    ${footerLinksHtml}
  </div>
</div>
</body>
</html>`
}
