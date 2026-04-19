import { formatPacificWeekdayMdYyFromYmd } from './calendar/pacificWallTime'

export type ShowReportShareFields = {
  dealDescription: string | null
  venueName: string | null
  eventDate: string | null
  submitted: boolean
}

/** Human-readable show label for titles and descriptions (no "Show Report for" prefix). */
export function resolveShowReportShareLabel(fields: ShowReportShareFields): string {
  const desc = fields.dealDescription?.trim()
  if (desc) return desc
  const venue = fields.venueName?.trim()
  const date = fields.eventDate?.trim()
  if (venue && date) {
    const fd = formatPacificWeekdayMdYyFromYmd(date)
    return `${venue} · ${fd}`
  }
  if (venue) return venue
  if (date) return formatPacificWeekdayMdYyFromYmd(date)
  return 'this show'
}

export function showReportSharePageTitle(fields: ShowReportShareFields): string {
  return `Show Report for ${resolveShowReportShareLabel(fields)}`
}

export function showReportShareDescription(fields: ShowReportShareFields): string {
  const label = resolveShowReportShareLabel(fields)
  if (fields.submitted) {
    return `The performance report for ${label} has already been submitted.`
  }
  return `Use this link to complete and submit the performance report for ${label}.`
}

export function showReportGenericShareHead(): { title: string; description: string } {
  return {
    title: 'Show Report',
    description: 'Open this link to access a performance report form.',
  }
}

export function showReportCanonicalPath(token: string): string {
  return `/performance-report/${token}`
}
