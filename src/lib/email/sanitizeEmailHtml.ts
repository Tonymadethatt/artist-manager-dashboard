import DOMPurify from 'isomorphic-dompurify'

/** Aligned with TipTap StarterKit + table; merge happens before sanitize. */
const SANITIZE = {
  ALLOWED_TAGS: [
    'p',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    's',
    'strike',
    'a',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'span',
    'div',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'colspan', 'rowspan', 'style'],
  ALLOW_DATA_ATTR: false,
}

export function sanitizeMergedEmailHtml(html: string): string {
  const s = html ?? ''
  try {
    return DOMPurify.sanitize(s, SANITIZE)
  } catch (e) {
    console.error('[sanitizeMergedEmailHtml] DOMPurify failed, using escaped fallback:', e)
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}

export function mergedBodyLooksLikeHtml(merged: string): boolean {
  return /^\s*</.test(merged)
}
