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
