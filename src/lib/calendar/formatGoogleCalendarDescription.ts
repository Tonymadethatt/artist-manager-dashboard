import { isHtmlContent, stripHtmlToText } from '@/lib/agreement/sanitize'

/** True when Google-style event description is likely HTML, not plain text. */
function looksLikeGoogleCalendarHtmlDescription(s: string): boolean {
  if (isHtmlContent(s)) return true
  return /<\s*(div|span|table|a|b|i|u|ul|ol|li)\b/i.test(s)
}

/**
 * Turn Google Calendar description HTML into readable plain text (line breaks, decoded entities).
 * Plain-text descriptions are returned unchanged.
 */
export function formatGoogleCalendarDescription(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (!looksLikeGoogleCalendarHtmlDescription(t)) return t
  return stripHtmlToText(t)
}
