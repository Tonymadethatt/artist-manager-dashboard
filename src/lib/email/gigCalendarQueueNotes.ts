export type GigCalQueueNotes =
  | { kind: 'gig_booked_ics'; dealId: string }
  | { kind: 'gig_reminder_24h'; dealId: string }
  | { kind: 'gig_calendar_digest_weekly'; weekStart: string }

export function parseGigCalendarQueueNotes(raw: string | null): GigCalQueueNotes | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as GigCalQueueNotes
    if (o.kind === 'gig_booked_ics' && typeof o.dealId === 'string') return o
    if (o.kind === 'gig_reminder_24h' && typeof o.dealId === 'string') return o
    if (o.kind === 'gig_calendar_digest_weekly' && typeof o.weekStart === 'string') return o
  } catch { /* ignore */ }
  return null
}
