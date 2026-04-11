import { escapeHtmlPlain } from './appendBlocksHtml'
import { emailFooterArtistPersonaSublineHtml } from './emailFooterPersonaLines'
import { buildProfileFooterLinksRowHtml } from './profileFooterLinksHtml'

function igIconUrlFromBase(logoBaseUrl: string): string {
  const prefix = logoBaseUrl.replace(/\/$/, '')
  return prefix ? `${prefix}/icons/icon-ig.png` : '/icons/icon-ig.png'
}

/**
 * Footer block shared by artist-facing “Front Office” emails (branded shell, management report,
 * retainer emails, etc.): bold name, title/subline, profile links row.
 */
export function buildArtistBrandedEmailFooterHtml(args: {
  logoBaseUrl: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
}): string {
  const igUrl = igIconUrlFromBase(args.logoBaseUrl)
  const links = buildProfileFooterLinksRowHtml(igUrl, args.website, args.social_handle, args.phone)
  return `<div class="email-footer" style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;">${escapeHtmlPlain(args.managerName)}</div>
    ${emailFooterArtistPersonaSublineHtml(args.managerTitle ?? null)}
    ${links}
  </div>`
}
