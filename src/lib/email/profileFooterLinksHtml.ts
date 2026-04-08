import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_FOOTER_MUTED } from './emailDarkSurfacePalette'

/** Website / IG / phone row used in artist-facing and matching venue footers. */
export function buildProfileFooterLinksRowHtml(
  igUrl: string,
  website: string | null | undefined,
  socialHandle: string | null | undefined,
  phone: string | null | undefined,
): string {
  const handle = socialHandle ? socialHandle.replace(/^@/, '') : ''
  const footerLinks = [
    website
      ? `<a href="${escapeHtmlPlain(website)}" style="color:${EMAIL_FOOTER_MUTED};text-decoration:none;font-size:11px;">${escapeHtmlPlain(website.replace(/^https?:\/\//, ''))}</a>`
      : '',
    handle
      ? `<a href="https://instagram.com/${escapeHtmlPlain(handle)}" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;vertical-align:middle;"><img src="${igUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.75;" /><span style="font-size:11px;color:${EMAIL_FOOTER_MUTED};">@${escapeHtmlPlain(handle)}</span></a>`
      : '',
    phone ? `<span style="font-size:11px;color:${EMAIL_FOOTER_MUTED};">${escapeHtmlPlain(phone)}</span>` : '',
  ].filter(Boolean).join('<span style="color:#6a6a6a;margin:0 8px;">|</span>')

  return footerLinks
    ? `<div style="margin-top:10px;display:flex;align-items:center;flex-wrap:wrap;gap:0;">${footerLinks}</div>`
    : ''
}
