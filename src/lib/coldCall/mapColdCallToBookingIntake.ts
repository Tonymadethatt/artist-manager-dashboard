import type { CapacityRangeV3, BookingIntakeShowDataV3, BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'
import {
  emptyShowDataV3,
  emptyVenueDataV3,
  INTAKE_DEFAULT_EVENT_CITY_TEXT,
  INTAKE_DEFAULT_EVENT_STATE_REGION,
  mapVibePresetIdsToGenres,
  MUSIC_VIBE_PRESETS,
  type Phase2RecurrenceIntervalV3,
  type Phase2EventScheduleV3,
} from '@/lib/intake/intakePayloadV3'
import type { Venue, VenueType } from '@/types'
import { VENUE_TYPE_ORDER } from '@/types'
import type { ContactTitleKey } from '@/lib/contacts/contactTitles'
import { COLD_CALL_WEEKDAY_LABELS, type ColdCallCapacityBucket, type ColdCallDataV1, type ColdCallPurpose } from './coldCallPayload'
import { BUDGET_RANGE_OPTIONS } from '@/pages/cold-call/liveFieldOptions'

export type ColdCallIntakeConversionContext = 'mid_call' | 'post_call'

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
  const raw = (d.venue_type_confirm || d.venue_type || '').trim()
  if (raw && (VENUE_TYPE_ORDER as string[]).includes(raw)) return raw as VenueType
  return 'other'
}

/** Match outreach venue by name + city (case-insensitive). */
export function findMatchingOutreachVenue(venues: Venue[], name: string, city: string): Venue | null {
  const nn = name.trim().toLowerCase()
  const cc = city.trim().toLowerCase()
  if (!nn) return null
  return (
    venues.find(v => {
      const vn = (v.name ?? '').trim().toLowerCase()
      if (vn !== nn) return false
      if (!cc) return true
      const vc = (v.city ?? '').trim().toLowerCase()
      return vc === cc
    }) ?? null
  )
}

export function resolveColdCallOutreachVenueId(d: ColdCallDataV1, venues: Venue[]): string | null {
  if (d.existing_venue_id && venues.some(v => v.id === d.existing_venue_id)) return d.existing_venue_id
  const hit = findMatchingOutreachVenue(venues, d.venue_name, d.city)
  return hit?.id ?? null
}

/** Maps cold call purpose to intake §2A schedule fields. */
export function mapCallPurposeToEventSchedule(purpose: ColdCallPurpose): {
  event_schedule_type: Phase2EventScheduleV3
  event_recurrence_interval: Phase2RecurrenceIntervalV3
} {
  switch (purpose) {
    case 'residency':
      return { event_schedule_type: 'recurring', event_recurrence_interval: 'weekly' }
    case 'one_time':
    case 'upcoming_event':
      return { event_schedule_type: 'one_off', event_recurrence_interval: '' }
    case 'availability':
    case 'follow_up':
    case '':
    default:
      return { event_schedule_type: 'one_off', event_recurrence_interval: '' }
  }
}

/**
 * Next occurrence of the first selected weekday (cold call uses full day names like "Thursday").
 * Uses local timezone; returns YYYY-MM-DD or null.
 */
export function suggestDateFromColdCallNights(nights: string[]): string | null {
  if (!nights.length) return null
  const first = nights[0]!.trim()
  const idx = (COLD_CALL_WEEKDAY_LABELS as readonly string[]).indexOf(first)
  if (idx < 0) return null
  const targetDow = idx === 6 ? 0 : idx + 1
  const today = new Date()
  const todayDow = today.getDay()
  let daysUntil = targetDow - todayDow
  if (daysUntil <= 0) daysUntil += 7
  const suggested = new Date(today)
  suggested.setDate(today.getDate() + daysUntil)
  const y = suggested.getFullYear()
  const m = String(suggested.getMonth() + 1).padStart(2, '0')
  const day = String(suggested.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function coldCallBudgetPrefillNote(range: ColdCallDataV1['budget_range']): string {
  if (!range) return ''
  const label = BUDGET_RANGE_OPTIONS.find(o => o.id === range)?.label
  if (!label) return ''
  return `Budget discussed on cold call: ${label}`
}

function primaryIntakeContactName(d: ColdCallDataV1): string {
  return (
    d.decision_maker_name.trim() ||
    d.target_name.trim() ||
    d.flag_captures['decision_maker_name']?.trim() ||
    ''
  )
}

function primaryIntakeContactRole(d: ColdCallDataV1): string {
  if (d.decision_maker_name.trim()) {
    return (d.decision_maker_title_key || d.target_title_key || '').trim()
  }
  return (d.target_title_key || '').trim()
}

export function buildGatekeeperSecondContact(d: ColdCallDataV1): {
  name: string
  title_key: ContactTitleKey | ''
  phone: string
} | null {
  if (d.who_answered !== 'gatekeeper') return null
  const dm = d.decision_maker_name.trim()
  const gk = d.gatekeeper_name.trim()
  if (!dm || !gk) return null
  if (dm.toLowerCase() === gk.toLowerCase()) return null
  return { name: gk, title_key: d.gatekeeper_title_key, phone: d.target_phone.trim() }
}

function inquirySummaryFromCold(d: ColdCallDataV1, callDateIso: string | null): string {
  const bits: string[] = []
  if (callDateIso?.trim()) bits.push(`Call date: ${callDateIso.trim()}`)
  if (d.pitch_angle.trim()) bits.push(`Pitch: ${d.pitch_angle.trim()}`)
  if (d.known_events.trim()) bits.push(`Known for: ${d.known_events.trim()}`)
  if (d.event_nights.length) bits.push(`Nights: ${d.event_nights.join(', ')}`)
  if (d.night_details_note.trim()) bits.push(`Night note: ${d.night_details_note.trim()}`)
  if (d.best_time_specific.trim()) bits.push(`Best time detail: ${d.best_time_specific.trim()}`)
  if (d.decision_maker_direct_phone.trim()) bits.push(`DM phone: ${d.decision_maker_direct_phone.trim()}`)
  if (d.decision_maker_direct_email.trim()) bits.push(`DM email: ${d.decision_maker_direct_email.trim()}`)
  if (d.message_taker_name.trim()) bits.push(`Message with: ${d.message_taker_name.trim()}`)
  if (d.other_dm_name.trim()) bits.push(`Also reach: ${d.other_dm_name.trim()}`)
  if (d.ask_send_channel) bits.push(`Send info via: ${d.ask_send_channel}`)
  if (d.ask_followup_when) bits.push(`Follow up when: ${d.ask_followup_when}`)
  if (d.budget_range) {
    const label = BUDGET_RANGE_OPTIONS.find(o => o.id === d.budget_range)?.label
    if (label) bits.push(`Budget: ${label}`)
  }
  if (d.call_notes.trim()) bits.push(`Notes: ${d.call_notes.trim()}`)
  return bits.join(' · ').slice(0, 4000)
}

function validMusicVibePresetIds(ids: string[]): string[] {
  const allowed = new Set(MUSIC_VIBE_PRESETS.map(p => p.id))
  return ids.filter(id => allowed.has(id))
}

/** Build booking intake bundle after cold call conversion (§15). */
export function buildIntakeBundleFromColdCall(
  d: ColdCallDataV1,
  options: {
    conversionContext: ColdCallIntakeConversionContext
    /** Merged call notes (e.g. DB `notes` + `call_data.call_notes`). */
    mergedCallNotes: string
    /** When known, sets intake venue linkage before commission rules run in the hook. */
    resolvedExistingVenueId: string | null
    callDateIso: string | null
  },
): {
  title: string
  venue: BookingIntakeVenueDataV3
  show: BookingIntakeShowDataV3
} {
  const venue = emptyVenueDataV3()
  const show = emptyShowDataV3(0)

  const contactName = primaryIntakeContactName(d)
  const contactRole = primaryIntakeContactRole(d)
  const venueName = d.venue_name.trim()

  const intakeSession = options.conversionContext === 'mid_call' ? 'live_call' : 'pre_call'

  venue.session_mode = intakeSession
  venue.last_active_section = '1B'
  venue.view_section = '1B'
  venue.venue_source = options.resolvedExistingVenueId ? 'existing' : 'new'
  venue.existing_venue_id = options.resolvedExistingVenueId
  venue.contact_name = contactName
  venue.contact_role = contactRole
  venue.contact_phone = d.decision_maker_direct_phone.trim() || d.target_phone.trim()
  venue.contact_email = d.decision_maker_direct_email.trim() || d.target_email.trim()
  venue.contact_company = venueName
  venue.known_venue_name = venueName
  venue.known_city = d.city.trim()
  venue.outreach_track = 'pipeline'
  venue.commission_tier = 'new_doors'
  venue.priority = d.priority
  venue.inquiry_summary = inquirySummaryFromCold(d, options.callDateIso)
  venue.pre_call_notes = [
    options.mergedCallNotes.trim() ? options.mergedCallNotes.trim() : '',
    d.venue_vibe.trim() ? `Vibe: ${d.venue_vibe.trim()}` : '',
    d.known_events.trim() ? `Known events: ${d.known_events.trim()}` : '',
    d.website.trim() ? `Web: ${d.website.trim()}` : '',
    d.social_handle.trim() ? `Social: ${d.social_handle.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const cap = mapColdCapacityToIntake(d.capacity_range)
  const vtype = venueTypeFromCold(d)
  const presetIds = validMusicVibePresetIds(d.venue_vibes)
  const sched = mapCallPurposeToEventSchedule(d.call_purpose)
  const suggestedDate = suggestDateFromColdCallNights(d.event_nights)

  show.venue_name_text = venueName
  show.city_text = d.city.trim() || INTAKE_DEFAULT_EVENT_CITY_TEXT
  show.state_region = d.state_region.trim() || INTAKE_DEFAULT_EVENT_STATE_REGION
  show.venue_type = vtype
  if (cap) show.capacity_range = cap
  show.music_vibe_preset_ids = presetIds
  show.genres = mapVibePresetIdsToGenres(presetIds)
  show.event_schedule_type = sched.event_schedule_type
  show.event_recurrence_interval = sched.event_recurrence_interval
  if (suggestedDate) show.event_date = suggestedDate
  show.pricing_prefill_note = coldCallBudgetPrefillNote(d.budget_range)

  const title = venueName ? `${venueName} — Booking (from cold call)` : 'Booking (from cold call)'

  return { title, venue, show }
}
