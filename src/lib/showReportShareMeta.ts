import { formatPacificWeekdayMdYyFromYmd } from './calendar/pacificWallTime'

/** Public asset in `/public` — encoded path for URLs (Open Graph, WhatsApp). */
export const SHOW_REPORT_SOCIAL_IMAGE_PATH = '/Show%20Report.jpg' as const

export const SHOW_REPORT_SOCIAL_IMAGE_ALT = 'Show report' as const

export type ShowReportShareFields = {
  dealDescription: string | null
  venueName: string | null
  eventDate: string | null
  submitted: boolean
}

/** Event / show line for the social title (deal title, or venue + date, etc.). */
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

/**
 * One-line explanation for Open Graph / WhatsApp (same for every show).
 * Describes what a show report is, not submission status.
 */
export const SHOW_REPORT_SOCIAL_DESCRIPTION =
  'A short post-show check-in for your manager: crowd, payment, promises, and how the night went—all in one place.'

export function showReportSharePageTitle(fields: ShowReportShareFields): string {
  return `Show Report - ${resolveShowReportShareLabel(fields)}`
}

/** Social preview description is intentionally static; `fields` kept for stable call sites. */
export function showReportShareDescription(_fields: ShowReportShareFields): string {
  return SHOW_REPORT_SOCIAL_DESCRIPTION
}

export function showReportGenericShareHead(): { title: string; description: string } {
  return {
    title: 'Show Report - Check-in',
    description: SHOW_REPORT_SOCIAL_DESCRIPTION,
  }
}

export function showReportCanonicalPath(token: string): string {
  return `/performance-report/${token}`
}
