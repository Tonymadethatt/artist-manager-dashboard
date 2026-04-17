import type { CapacityRangeV3, BookingIntakeShowDataV3, BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'
import {
  emptyShowDataV3,
  emptyVenueDataV3,
  INTAKE_DEFAULT_EVENT_CITY_TEXT,
  INTAKE_DEFAULT_EVENT_STATE_REGION,
  MUSIC_VIBE_PRESETS,
} from '@/lib/intake/intakePayloadV3'
import type { VenueType } from '@/types'
import {
  COLD_CALL_TARGET_ROLE_LABELS,
  type ColdCallCapacityBucket,
  type ColdCallDataV1,
  type ColdCallTargetRole,
  defaultColdCallTitle,
} from './coldCallPayload'

function targetRoleLabel(role: ColdCallTargetRole): string {
  if (!role) return ''
  return COLD_CALL_TARGET_ROLE_LABELS[role as Exclude<ColdCallTargetRole, ''>] ?? role
}

function mapColdCapacityToIntake(bucket: ColdCallCapacityBucket): CapacityRangeV3 {
  switch (bucket) {
    case 'under_100':
      return 'under_100'
    case '100_300':
      return '100_300'
    case '300_500':
      return '300_500'
    case '500_1000':
      return '500_1000'
    case '1000_2000':
      return '1000_2000'
    case '2000_plus':
      return '2000_5000'
    default:
      return ''
  }
}

function venueTypeFromCold(d: ColdCallDataV1): VenueType {
  const v = d.venue_type_confirm || (d.venue_type as VenueType)
  if (
    v === 'bar' ||
    v === 'club' ||
    v === 'festival' ||
    v === 'theater' ||
    v === 'lounge' ||
    v === 'other'
  )
    return v
  if (d.venue_type === 'bar' || d.venue_type === 'club') return d.venue_type as VenueType
  return 'other'
}

function genresFromVibeIds(ids: string[]): BookingIntakeShowDataV3['genres'] {
  const out = new Set<string>()
  for (const id of ids) {
    const preset = MUSIC_VIBE_PRESETS.find(p => p.id === id)
    if (preset) for (const g of preset.genres) out.add(g)
  }
  if (out.size === 0) return [...MUSIC_VIBE_PRESETS[0].genres]
  return [...out] as BookingIntakeShowDataV3['genres']
}

function primaryContactName(d: ColdCallDataV1): string {
  return (
    d.target_name.trim() ||
    d.decision_maker_name.trim() ||
    d.different_name_note.trim() ||
    d.flag_captures['decision_maker_name']?.trim() ||
    ''
  )
}

function inquirySummaryFromCold(d: ColdCallDataV1): string {
  const bits: string[] = []
  if (d.pitch_angle.trim()) bits.push(`Pitch: ${d.pitch_angle.trim()}`)
  if (d.known_events.trim()) bits.push(`Known for: ${d.known_events.trim()}`)
  if (d.event_nights.length) bits.push(`Nights: ${d.event_nights.join(', ')}`)
  if (d.budget_range) bits.push(`Budget (cold call): ${d.budget_range}`)
  if (d.call_notes.trim()) bits.push(`Notes: ${d.call_notes.trim()}`)
  return bits.join(' · ').slice(0, 4000)
}

/** Build booking intake bundle after cold call conversion (§15). */
export function buildIntakeBundleFromColdCall(d: ColdCallDataV1): {
  title: string
  venue: BookingIntakeVenueDataV3
  show: BookingIntakeShowDataV3
} {
  const venue = emptyVenueDataV3()
  const show = emptyShowDataV3(0)

  const contactName = primaryContactName(d)
  const contactRole = targetRoleLabel(d.decision_maker_role || d.target_role)

  venue.session_mode = 'live_call'
  venue.last_active_section = '2A'
  venue.view_section = '2A'
  venue.venue_source = d.existing_venue_id ? 'existing' : 'new'
  venue.existing_venue_id = d.existing_venue_id
  venue.contact_name = contactName
  venue.contact_role = contactRole
  venue.contact_phone = d.target_phone.trim()
  venue.contact_email = d.target_email.trim()
  venue.known_venue_name = d.venue_name.trim()
  venue.known_city = d.city.trim()
  venue.outreach_track = 'pipeline'
  venue.commission_tier = 'new_doors'
  venue.priority = d.priority
  venue.inquiry_summary = inquirySummaryFromCold(d)
  venue.pre_call_notes = [
    d.venue_vibe.trim() ? `Vibe: ${d.venue_vibe.trim()}` : '',
    d.website.trim() ? `Web: ${d.website.trim()}` : '',
    d.social_handle.trim() ? `Social: ${d.social_handle.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const cap = mapColdCapacityToIntake(d.capacity_range)
  const vtype = venueTypeFromCold(d)

  show.venue_name_text = d.venue_name.trim()
  show.city_text = d.city.trim() || INTAKE_DEFAULT_EVENT_CITY_TEXT
  show.state_region = d.state_region.trim() || INTAKE_DEFAULT_EVENT_STATE_REGION
  show.venue_type = vtype
  if (cap) show.capacity_range = cap
  show.genres = genresFromVibeIds(d.venue_vibes)

  const title = defaultColdCallTitle(d.venue_name.trim())

  return { title, venue, show }
}
