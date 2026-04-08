const PREFIX = '[capture:v1:'
const SUFFIX = ']'

/** Append capture token uuid to venue_emails.notes (preserves existing text). */
export function appendEmailCaptureTokenNote(existingNotes: string | null | undefined, tokenUuid: string): string {
  const raw = (existingNotes ?? '').trimEnd()
  const tag = `${PREFIX}${tokenUuid}${SUFFIX}`
  if (raw.includes(tag)) return raw || tag
  return raw ? `${raw}\n${tag}` : tag
}

/** First matching token in notes, or null. */
export function parseEmailCaptureTokenFromNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const idx = notes.indexOf(PREFIX)
  if (idx === -1) return null
  const start = idx + PREFIX.length
  const end = notes.indexOf(SUFFIX, start)
  if (end === -1) return null
  const token = notes.slice(start, end).trim()
  return /^[0-9a-f-]{36}$/i.test(token) ? token : null
}

/** Strip capture tag lines for display. */
export function stripEmailCaptureTokenNote(notes: string | null | undefined): string {
  if (!notes) return ''
  return notes
    .split('\n')
    .filter(line => !line.startsWith(PREFIX))
    .join('\n')
    .trim()
}
