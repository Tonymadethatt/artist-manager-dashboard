import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_FOOTER_MUTED } from './emailDarkSurfacePalette'

/**
 * Raw inline link elements (website | IG | phone) joined by pipe separators.
 * Returns '' when every field is empty.
 * Uses only email-client-safe CSS (no flex, no gap).
 */
export function buildProfileFooterLinksHtml(
  igUrl: string,
  website: string | null | undefined,
  socialHandle: string | null | undefined,
  phone: string | null | undefined,
): string {
  const handle = socialHandle ? socialHandle.replace(/^@/, '') : ''
  return [
    website
      ? `<a href="${escapeHtmlPlain(website)}" style="color:${EMAIL_FOOTER_MUTED};text-decoration:none;font-size:11px;">${escapeHtmlPlain(website.replace(/^https?:\/\//, ''))}</a>`
      : '',
    handle
      ? `<a href="https://instagram.com/${escapeHtmlPlain(handle)}" style="text-decoration:none;vertical-align:middle;"><img src="${igUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.75;margin-right:4px;" /><span style="font-size:11px;color:${EMAIL_FOOTER_MUTED};vertical-align:middle;">@${escapeHtmlPlain(handle)}</span></a>`
      : '',
    phone ? `<span style="font-size:11px;color:${EMAIL_FOOTER_MUTED};">${escapeHtmlPlain(phone)}</span>` : '',
  ].filter(Boolean).join('<span style="color:#6a6a6a;margin:0 8px;">|</span>')
}

/** Full row with wrapper div — used by artist audience footer. */
export function buildProfileFooterLinksRowHtml(
  igUrl: string,
  website: string | null | undefined,
  socialHandle: string | null | undefined,
  phone: string | null | undefined,
): string {
  const links = buildProfileFooterLinksHtml(igUrl, website, socialHandle, phone)
  return links
    ? `<div style="margin-top:10px;">${links}</div>`
    : ''
}
