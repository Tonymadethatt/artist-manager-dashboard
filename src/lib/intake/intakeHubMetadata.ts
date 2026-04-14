import type { BookingIntakeRow, BookingIntakeShowRow } from '@/hooks/useBookingIntakes'
import {
  liveSectionTitle,
  parseShowDataV3,
  parseVenueDataV3,
  showLabelFromEventDate,
} from '@/lib/intake/intakePayloadV3'

export type IntakeHubStatus = 'draft' | 'pre_call' | 'live' | 'post_call'

export function intakeHubStatus(row: BookingIntakeRow): IntakeHubStatus {
  const v = parseVenueDataV3(row.venue_data, row.schema_version)
  if (v.session_mode === 'post_call') return 'post_call'
  if (v.session_mode === 'live_call') return 'live'
  const hasAny =
    !!v.contact_name?.trim() ||
    !!v.known_venue_name?.trim() ||
    !!v.existing_venue_id ||
    !!v.known_event_date?.trim() ||
    !!v.inquiry_summary?.trim()
  if (!hasAny) return 'draft'
  return 'pre_call'
}

export function intakeHubStatusLabel(s: IntakeHubStatus): string {
  switch (s) {
    case 'draft':
      return 'Draft'
    case 'pre_call':
      return 'Pre-call'
    case 'live':
      return 'On call'
    case 'post_call':
      return 'Post-call'
    default:
      return s
  }
}

export type IntakePreviewSnapshot = {
  contactName: string
  contactPhone: string
  contactEmail: string
  venueLine: string
  eventLine: string
  inquiryLine: string
  sessionLabel: string
  progressSection: string
  showCount: number
}

export function buildIntakePreviewSnapshot(
  row: BookingIntakeRow,
  shows: BookingIntakeShowRow[] | undefined,
  resolveVenueName?: (venueId: string) => string | undefined,
): IntakePreviewSnapshot {
  const v = parseVenueDataV3(row.venue_data, row.schema_version)
  let venueLine = v.known_venue_name?.trim() ?? ''
  if (!venueLine && v.existing_venue_id && resolveVenueName) {
    venueLine = resolveVenueName(v.existing_venue_id)?.trim() ?? ''
  }
  if (!venueLine && v.existing_venue_id) venueLine = 'Venue on file'
  if (!venueLine && v.venue_source === 'new') venueLine = 'New venue (not yet linked)'
  if (!venueLine) venueLine = '—'

  const first = shows?.[0]
  const sd = first ? parseShowDataV3(first.show_data, first.sort_order) : null
  const datePart = sd?.event_date ? showLabelFromEventDate(sd.event_date) || sd.event_date : ''
  const typePart = sd?.event_type
    ? String(sd.event_type).replace(/_/g, ' ')
    : v.known_event_type
      ? String(v.known_event_type).replace(/_/g, ' ')
      : ''
  const namePart = sd?.event_name_text?.trim() ?? ''
  const eventLine = [datePart, typePart, namePart].filter(Boolean).join(' · ') || '—'

  const sessionLabel =
    v.session_mode === 'pre_call'
      ? 'Pre-call workspace'
      : v.session_mode === 'live_call'
        ? 'Live call capture'
        : 'Post-call / import'

  const sec = v.view_section?.trim() || v.last_active_section?.trim() || ''
  const progressSection = sec ? liveSectionTitle(sec) : '—'

  return {
    contactName: v.contact_name?.trim() || '—',
    contactPhone: v.contact_phone?.trim() || '—',
    contactEmail: v.contact_email?.trim() || '—',
    venueLine,
    eventLine,
    inquiryLine: v.inquiry_summary?.trim() || '—',
    sessionLabel,
    progressSection,
    showCount: shows?.length ?? 0,
  }
}
