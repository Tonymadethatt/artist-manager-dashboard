/**
 * Lightweight HTML sanitizer for email templates.
 *
 * Replaces `isomorphic-dompurify` which depends on `jsdom` — jsdom crashes
 * at import time in Netlify Functions because it reads a CSS file from
 * `/var/browser/default-stylesheet.css` that doesn't exist in serverless.
 *
 * Since the input comes from TipTap's rich-text editor (well-formed HTML)
 * and the output goes into an email (where clients strip scripts anyway),
 * a simple tag/attribute whitelist approach is sufficient.
 */

const ALLOWED_TAGS = new Set([
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
])

const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'colspan', 'rowspan', 'style'])

/** Parse attributes from an opening tag's attribute string, keeping only allowed ones. */
function filterAttrs(raw: string): string {
  const parts: string[] = []
  // Match name="value", name='value', or bare name attributes
  const re = /([a-zA-Z][\w-]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(raw)) !== null) {
    const name = m[1].toLowerCase()
    if (!ALLOWED_ATTRS.has(name)) continue
    const value = m[2] ?? m[3] ?? m[4] ?? ''
    // Block javascript: protocol in href
    if (name === 'href' && /^\s*javascript\s*:/i.test(value)) continue
    parts.push(`${name}="${value.replace(/"/g, '&quot;')}"`)
  }
  return parts.length ? ' ' + parts.join(' ') : ''
}

function sanitizeHtml(html: string): string {
  // Strip <script> and <style> blocks entirely (tag + contents)
  let s = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '')
  // Strip HTML comments
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Process each tag: keep allowed tags with filtered attrs, drop the rest
  s = s.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g, (_match, slash, tag, attrs, selfClose) => {
    const lower = (tag as string).toLowerCase()
    if (!ALLOWED_TAGS.has(lower)) return ''
    if (slash === '/') return `</${lower}>`
    const cleanAttrs = filterAttrs(attrs as string)
    return `<${lower}${cleanAttrs}${selfClose === '/' ? ' /' : ''}>`
  })
  return s
}

export function sanitizeMergedEmailHtml(html: string): string {
  const s = html ?? ''
  try {
    return sanitizeHtml(s)
  } catch (e) {
    console.error('[sanitizeMergedEmailHtml] sanitize failed, using escaped fallback:', e)
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
