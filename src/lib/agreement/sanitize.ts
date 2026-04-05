/** Escape text for safe insertion into HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Safe ASCII-ish filename stem for downloads. */
export function sanitizeFilenameStem(name: string): string {
  return name.replace(/[^a-zA-Z0-9\s-_]/g, '').trim() || 'document'
}
