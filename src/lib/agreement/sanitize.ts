/** Escape text for safe insertion into HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Escape a string for use inside a double-quoted HTML attribute. */
export function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Allow only http(s) or data:image URLs for img src attributes. */
export function isSafeImageUrl(url: string): boolean {
  const u = url.trim()
  return /^https?:\/\//i.test(u) || /^data:image\//i.test(u)
}

/** Safe ASCII-ish filename stem for downloads. */
export function sanitizeFilenameStem(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'document'
}

/**
 * URL/storage-safe slug for agreement PDF share links: readable name + short id from file UUID.
 * Example: blue-room-agreement-march-2026-a1b2c3d4e5f6
 */
export function makeAgreementPdfSlug(fileName: string, fileId: string): string {
  const stem =
    fileName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'agreement'
  const idPart = fileId.replace(/-/g, '').slice(0, 12)
  return `${stem}-${idPart}`
}

/** Detect whether a content string was authored as HTML (TipTap output) vs plain text. */
export function isHtmlContent(content: string): boolean {
  return /<\s*(p|ul|ol|li|table|h[1-6]|strong|em|br\s*\/?)[\s>/]/i.test(content)
}

/** Strip HTML tags and decode basic entities to produce readable plain text. */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex) => {
      const cp = Number.parseInt(hex, 16)
      if (!Number.isFinite(cp) || cp < 0) return ''
      try {
        return String.fromCodePoint(cp)
      } catch {
        return ''
      }
    })
    .replace(/&#(\d{1,7});/g, (_, dec) => {
      const cp = Number.parseInt(dec, 10)
      if (!Number.isFinite(cp) || cp < 0) return ''
      try {
        return String.fromCodePoint(cp)
      } catch {
        return ''
      }
    })
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
