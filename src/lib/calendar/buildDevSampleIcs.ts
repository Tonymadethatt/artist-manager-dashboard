/**
 * Builds a minimal RFC 5545 VEVENT for dev/testing (Add to calendar from email attachment).
 * Uses UTC (Zulu) timestamps. Output uses CRLF line endings.
 */

function toIcsUtcDate(d: Date): string {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const h = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  const s = String(d.getUTCSeconds()).padStart(2, '0')
  return `${y}${m}${day}T${h}${min}${s}Z`
}

/** Escape TEXT values for SUMMARY, DESCRIPTION, LOCATION. */
function escapeIcsText(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
}

export function buildDevSampleIcs(now: Date = new Date(), artistDisplayName = 'Artist'): string {
  const dtstamp = toIcsUtcDate(now)
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() + 7)
  start.setUTCHours(20, 0, 0, 0)
  const end = new Date(start)
  end.setUTCHours(end.getUTCHours() + 3)

  const uid = `dev-sample-${now.getTime()}@artist-manager.local`
  const summary = `Confirmed show — ${artistDisplayName} @ The Venue (dev test)`
  const location = 'The Venue, Los Angeles, CA'
  const description = [
    'Artist Manager — dev ICS test',
    '',
    'This is a sample booking so you can verify Add to calendar on your phone.',
    '',
    'Notes: load-in 6pm · soundcheck 7pm · doors 9pm',
    '',
    'Fake agreement link: https://example.com/agreement/dev-test',
  ].join('\n')

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ArtistManager//Dev Ics Test//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${toIcsUtcDate(start)}`,
    `DTEND:${toIcsUtcDate(end)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lines.join('\r\n')
}
