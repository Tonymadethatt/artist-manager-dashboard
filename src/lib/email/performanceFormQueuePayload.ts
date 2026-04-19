/** Prefix for `venue_emails.notes` when a row is waiting for `send-performance-form` via the queue worker. */
export const PERF_FORM_PENDING_NOTES_PREFIX = 'perf_form_pending:' as const

export type PerfFormQueuePayload = {
  token: string
  venueName: string
  eventDate: string | null
}

export function serializePerfFormQueueNotes(p: PerfFormQueuePayload): string {
  return PERF_FORM_PENDING_NOTES_PREFIX + JSON.stringify(p)
}

export function parsePerfFormQueueNotes(notes: string | null | undefined): PerfFormQueuePayload | null {
  if (!notes?.trim()) return null
  /** One line per record; after send we append `[src:…]` audit lines — find the payload line. */
  for (const line of notes.split('\n')) {
    const t = line.trim()
    if (!t.startsWith(PERF_FORM_PENDING_NOTES_PREFIX)) continue
    try {
      return JSON.parse(t.slice(PERF_FORM_PENDING_NOTES_PREFIX.length)) as PerfFormQueuePayload
    } catch {
      return null
    }
  }
  return null
}
