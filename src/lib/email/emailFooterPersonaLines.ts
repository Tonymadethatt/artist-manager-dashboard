import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_FOOTER_MUTED } from './emailDarkSurfacePalette'

const DEFAULT_BRAND_SUBLINE_HTML = 'Front Office&#8482; Brand Growth &amp; Management'

/**
 * Venue / custom-venue footers: optional sender name + title (company name lives in header).
 */
export function emailFooterVenueSenderAttributionHtml(
  managerName: string | null | undefined,
  managerTitle: string | null | undefined,
): string {
  const name = managerName?.trim() || ''
  const title = managerTitle?.trim() || ''
  if (!name && !title) return ''
  const parts: string[] = []
  if (name) {
    parts.push(
      `<div style="font-size:12px;font-weight:600;color:#e5e5e5;margin-top:0;line-height:1.4;">${escapeHtmlPlain(name)}</div>`,
    )
  }
  if (title) {
    parts.push(
      `<div style="font-size:11px;color:${EMAIL_FOOTER_MUTED};margin-top:${name ? '3' : '0'}px;line-height:1.4;letter-spacing:0.2px;">${escapeHtmlPlain(title)}</div>`,
    )
  }
  return parts.join('')
}

/**
 * Second line under the bold name in artist-facing footers — title or default product line.
 */
export function emailFooterArtistPersonaSublineHtml(managerTitle: string | null | undefined): string {
  const t = managerTitle?.trim()
  const inner = t ? escapeHtmlPlain(t) : DEFAULT_BRAND_SUBLINE_HTML
  return `<div style="font-size:11px;color:${EMAIL_FOOTER_MUTED};margin-top:3px;letter-spacing:0.3px;">${inner}</div>`
}
