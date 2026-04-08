import { escapeHtmlPlain } from './appendBlocksHtml'

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
      ? `<a href="${escapeHtmlPlain(website)}" style="color:#888888;text-decoration:none;font-size:11px;">${escapeHtmlPlain(website.replace(/^https?:\/\//, ''))}</a>`
      : '',
    handle
      ? `<a href="https://instagram.com/${escapeHtmlPlain(handle)}" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;vertical-align:middle;"><img src="${igUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.6;" /><span style="font-size:11px;color:#888888;">@${escapeHtmlPlain(handle)}</span></a>`
      : '',
    phone ? `<span style="font-size:11px;color:#888888;">${escapeHtmlPlain(phone)}</span>` : '',
  ].filter(Boolean).join('<span style="color:#444444;margin:0 8px;">|</span>')

  return footerLinks
    ? `<div style="margin-top:10px;display:flex;align-items:center;flex-wrap:wrap;gap:0;">${footerLinks}</div>`
    : ''
}
