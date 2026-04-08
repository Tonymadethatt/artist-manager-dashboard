/** Prefix for queued artist transactional emails (`performance_report_received`, `gig_week_reminder`). */
export const ARTIST_TXN_PENDING_PREFIX = 'artist_txn:' as const

export type ArtistTxnQueuePayload = {
  kind: 'performance_report_received' | 'gig_week_reminder'
  venueName: string
  eventDate: string | null
}

export function serializeArtistTxnQueueNotes(p: ArtistTxnQueuePayload): string {
  return ARTIST_TXN_PENDING_PREFIX + JSON.stringify(p)
}

export function parseArtistTxnQueueNotes(notes: string | null | undefined): ArtistTxnQueuePayload | null {
  if (!notes?.startsWith(ARTIST_TXN_PENDING_PREFIX)) return null
  try {
    const raw = JSON.parse(notes.slice(ARTIST_TXN_PENDING_PREFIX.length)) as ArtistTxnQueuePayload
    if (raw?.kind !== 'performance_report_received' && raw?.kind !== 'gig_week_reminder') return null
    if (typeof raw.venueName !== 'string') return null
    return {
      kind: raw.kind,
      venueName: raw.venueName,
      eventDate: typeof raw.eventDate === 'string' ? raw.eventDate : null,
    }
  } catch {
    return null
  }
}
