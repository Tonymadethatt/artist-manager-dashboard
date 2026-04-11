import type { Deal, Venue } from '@/types'
import { formatVenueAddressForGoogleCalendar } from './venueAddressForGoogle'

const CRLF = '\r\n'

function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

function fmtUtc(dt: Date): string {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  const h = String(dt.getUTCHours()).padStart(2, '0')
  const min = String(dt.getUTCMinutes()).padStart(2, '0')
  const sec = String(dt.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${d}T${h}${min}${sec}Z`
}

export function buildDealIcsBlob(args: {
  deal: Pick<Deal, 'id' | 'description' | 'event_start_at' | 'event_end_at' | 'notes'>
  venue: Pick<
    Venue,
    'name' | 'city' | 'location' | 'address_line2' | 'region' | 'postal_code' | 'country'
  > | null | undefined
  artistDisplayName: string
}): string {
  const start = args.deal.event_start_at ? new Date(args.deal.event_start_at) : null
  const end = args.deal.event_end_at ? new Date(args.deal.event_end_at) : null
  if (!start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new Error('deal missing valid event_start_at / event_end_at')
  }

  const mapsLine = formatVenueAddressForGoogleCalendar(args.venue ?? null)
  const location = mapsLine ? escapeIcsText(mapsLine) : escapeIcsText('TBA')
  const summary = escapeIcsText(args.deal.description.trim() || 'Gig')
  const descParts = [
    args.deal.description.trim(),
    args.venue?.name?.trim() ? `Venue: ${args.venue.name.trim()}` : '',
    args.deal.notes?.trim() ? `Notes: ${args.deal.notes.trim()}` : '',
  ].filter(Boolean)
  const description = escapeIcsText(descParts.join('\\n'))

  const stamp = fmtUtc(new Date())
  const uid = `${args.deal.id}@artist-manager-calendar`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Artist Manager//Gig//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${fmtUtc(start)}`,
    `DTEND:${fmtUtc(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join(CRLF)
}
