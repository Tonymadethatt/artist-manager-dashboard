export type GigCalQueueNotes =
  | { kind: 'gig_booked_ics'; dealId: string }
  | { kind: 'gig_reminder_24h'; dealId: string }
  /** Same layout/template as day-before reminder; sends on demand (no morning-before window). */
  | { kind: 'gig_reminder_manual'; dealId: string }
  | { kind: 'gig_calendar_digest_weekly'; weekStart: string }
  | { kind: 'gig_day_summary_manual'; ymd: string }

export function parseGigCalendarQueueNotes(raw: string | null): GigCalQueueNotes | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as GigCalQueueNotes
    if (o.kind === 'gig_booked_ics' && typeof o.dealId === 'string') return o
    if (o.kind === 'gig_reminder_24h' && typeof o.dealId === 'string') return o
    if (o.kind === 'gig_reminder_manual' && typeof o.dealId === 'string') return o
    if (o.kind === 'gig_calendar_digest_weekly' && typeof o.weekStart === 'string') return o
    if (o.kind === 'gig_day_summary_manual' && typeof o.ymd === 'string') return o
  } catch { /* ignore */ }
  return null
}
