import type { CommissionTier, OutreachTrack, VenueType } from '@/types'
import { SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'

const COMMISSION_TIERS: CommissionTier[] = ['new_doors', 'kept_doors', 'bigger_doors', 'artist_network']

function asCommissionTier(v: unknown, fallback: CommissionTier): CommissionTier {
  return typeof v === 'string' && (COMMISSION_TIERS as string[]).includes(v) ? (v as CommissionTier) : fallback
}

/** Persisted in `booking_intakes.schema_version` and `venue_data._v`. */
export const INTAKE_SCHEMA_VERSION_V3 = 3

export type BookingIntakeSessionMode = 'pre_call' | 'live_call' | 'post_call'

export type VenueSourceV3 = 'new' | 'existing'

export type InquirySourceV3 =
  | 'instagram_dm'
  | 'email'
  | 'phone_text'
  | 'referral'
  | 'website'
  | 'radio'
  | 'other'

export type KnownEventTypeV3 =
  | 'after_party'
  | 'private_event'
  | 'club_night'
  | 'corporate'
  | 'wedding'
  | 'festival'
  | 'concert'
  | 'brand_activation'
  | 'other'

/** Phase 1 — Opening (live-call, shared across shows). */
export type Phase1ConfirmedContactV3 = '' | 'yes' | 'no_different_person'

/** Opening “call energy” — expanded discrete set (legacy JSON values still parse). */
export const CALL_VIBE_KEYS = [
  '',
  'excited',
  'business',
  'rushed',
  'warm_easy',
  'guarded_testing_us',
  'time_crunched',
  'all_over_the_place',
  'very_formal',
] as const

export type Phase1CallVibeV3 = (typeof CALL_VIBE_KEYS)[number]

export const CALL_VIBE_LABELS: Record<Exclude<Phase1CallVibeV3, ''>, string> = {
  excited: 'Excited / upbeat',
  business: 'Businesslike / efficient',
  rushed: 'Rushed — keep it tight',
  warm_easy: 'Warm / easy rapport',
  guarded_testing_us: 'Guarded — feeling us out',
  time_crunched: 'Time-crunched / distracted',
  all_over_the_place: 'Scattered / multi-tasking',
  very_formal: 'Very formal / corporate',
}

/** Single-row chip UI (emoji + one word). Full sentence labels stay in `CALL_VIBE_LABELS` for exports. */
export const CALL_VIBE_CHIP_META: Record<Exclude<Phase1CallVibeV3, ''>, { emoji: string; word: string }> = {
  excited: { emoji: '\u2728', word: 'Excited' },
  business: { emoji: '\u{1F4BC}', word: 'Business' },
  rushed: { emoji: '\u26A1', word: 'Rushed' },
  warm_easy: { emoji: '\u{1F91D}', word: 'Warm' },
  guarded_testing_us: { emoji: '\u{1F6E1}\uFE0F', word: 'Guarded' },
  time_crunched: { emoji: '\u23F0', word: 'Distracted' },
  all_over_the_place: { emoji: '\u{1F300}', word: 'Scattered' },
  very_formal: { emoji: '\u{1F3A9}', word: 'Formal' },
}

export const CALL_VIBE_ORDER_NONEMPTY = CALL_VIBE_KEYS.filter(
  (k): k is Exclude<Phase1CallVibeV3, ''> => k !== '',
)

export type Phase1PhoneConfirmedV3 = '' | 'confirmed' | 'update_needed'
export type Phase1EmailConfirmedV3 = '' | 'confirmed' | 'update_needed' | 'need_to_get'
export type Phase1CompanyConfirmedV3 = '' | 'confirmed' | 'update_needed'

/** Phase 2 — per show (booking_intake_shows.show_data). */
export type Phase2SettingV3 = '' | 'indoor' | 'outdoor' | 'both'
export type Phase2EventNameFlagV3 = '' | 'capture_later' | 'no_name_yet'
export type Phase2VenueNameFlagV3 = '' | 'already_have' | 'capture_later' | 'tbd'
export type Phase2CityFlagV3 = '' | 'already_have' | 'capture_later' | 'tbd'
export type Phase2AddressStatusV3 = '' | 'have_it' | 'theyll_send' | 'tbd_private'
export type Phase2ExactCapacityFlagV3 = '' | 'capture_later' | 'range_ok'

/** Phase 3 — Performance (per-show in `show_data` where noted). */
export type PerformanceRoleV3 =
  | ''
  | 'headliner'
  | 'opener'
  | 'support_mid'
  | 'solo_only'
  | 'resident_regular'
  | 'guest_set'

export type Phase3CustomSetlistV3 = '' | 'djs_call' | 'specific_requests'
export type Phase3MusicRequestsFlagV3 = '' | 'none' | 'capture_later'
export type Phase3OtherPerformersV3 = '' | 'solo_act' | 'multiple_performers'
export type Phase3NumOtherActsV3 = '' | '1' | '2' | '3' | '4plus'
export type Phase3BillingPriorityV3 = '' | 'top_billing' | 'co_headliner' | 'supporting_act'

/** Phase 4 — Technical & logistics */
export type Phase4EquipmentProviderV3 = '' | 'venue_provides' | 'dj_brings' | 'hybrid'
export type Phase4EquipmentDetailsFlagV3 = '' | 'full_confirmed' | 'capture_later' | 'not_discussed'
export type Phase4OnsiteSameContactV3 = '' | 'same' | 'different'
export type Phase4OnsiteFlagV3 = '' | 'capture_later' | 'not_discussed'
export type Phase4LoadInDiscussedV3 = '' | 'yes' | 'tbd'
export type Phase4SoundcheckV3 = '' | 'yes' | 'no' | 'not_discussed'
export type Phase4ParkingStatusV3 = '' | 'confirmed' | 'need_confirm' | 'not_discussed'
export type Phase4ParkingDetailsFlagV3 = '' | 'capture_later' | 'no'
export type Phase4TravelRequiredV3 = '' | 'local' | 'regional' | 'flight'
export type Phase4LodgingStatusV3 = '' | 'not_needed' | 'venue_provides' | 'dj_covers' | 'not_discussed'
export type Phase4TravelNotesFlagV3 = '' | 'capture_later' | 'no'

/** Phase 5 — Money (per-show on `show_data` except 5E on `venue_data`). */
export type Phase5PricingModeV3 = '' | 'package' | 'hourly'
export type Phase5PricingSourceV3 = '' | 'calculated' | 'manual'
export type Phase5DepositPercentV3 = 25 | 50 | 75 | 100
export type Phase5BalanceTimingV3 =
  | ''
  | 'before_event'
  | 'day_of'
  | 'after_event'
  | 'custom'

export type Phase5InvoiceSameContactV3 = '' | 'yes' | 'different'
export type Phase5InvoiceConfirmV3 = '' | 'correct' | 'capture_later'
export type Phase5BillingContactFlagV3 = '' | 'same_main' | 'capture_later'

/** Phase 7 — Close (shared on `venue_data`). */
export type Phase7SendAgreementV3 = '' | 'yes_sending' | 'verbal_only'
export type Phase7DepositOnCallV3 = '' | 'paying_now' | 'sending_invoice'
export type Phase7ClientEnergyV3 = '' | 'very_excited' | 'positive' | 'neutral' | 'uncertain'
export type Phase7HasFollowUpsV3 = '' | 'yes' | 'all_clear'
export type Phase7CallStatusV3 = '' | 'full' | 'partial' | 'voicemail'

/** Phase 1 — substantive context (venue_data). Who’s on the line when not the contact on file. */
export const CONTACT_MISMATCH_CONTEXT_KEYS = [
  '',
  'talent_buyer',
  'event_planner',
  'day_of_coordinator',
  'wedding_planner',
  'agency_rep',
  'venue_manager',
  'production',
  'hospitality_manager',
  'marketing_pr',
  'billing',
  'owner',
  'assistant',
  'security_box',
  'other_party',
] as const

export type Phase1ContactMismatchContextV3 = (typeof CONTACT_MISMATCH_CONTEXT_KEYS)[number]

export const CONTACT_MISMATCH_CONTEXT_LABELS: Record<Exclude<Phase1ContactMismatchContextV3, ''>, string> = {
  talent_buyer: 'Talent buyer / booker',
  event_planner: 'Event planner / producer',
  day_of_coordinator: 'Day-of coordinator',
  wedding_planner: 'Wedding / private planner',
  agency_rep: 'Agency / rep',
  venue_manager: 'Venue manager / ops',
  production: 'Production / tech',
  hospitality_manager: 'Hospitality / F&B',
  marketing_pr: 'Marketing / PR',
  billing: 'Billing / AP',
  owner: 'Owner / principal',
  assistant: 'Assistant / coordinator',
  security_box: 'Security / box office / door',
  other_party: 'Other',
}

/** Non-empty keys in call-flow order (dropdowns). */
export const CONTACT_MISMATCH_ROLE_ORDER = CONTACT_MISMATCH_CONTEXT_KEYS.filter(
  (k): k is Exclude<Phase1ContactMismatchContextV3, ''> => k !== '',
)

export type Phase1PreferredEmailChannelV3 = '' | 'work' | 'personal' | 'billing' | 'production'

export const PREFERRED_EMAIL_CHANNEL_LABELS: Record<Exclude<Phase1PreferredEmailChannelV3, ''>, string> = {
  work: 'Work email (primary)',
  personal: 'Personal email',
  billing: 'Billing email',
  production: 'Production / ops email',
}

/** Phase 2A — event shape beyond type dropdown. */
export const EVENT_ARCHETYPE_KEYS = [
  'weekly_residency',
  'annual_corporate',
  'one_off_private',
  'festival_slot',
  'wedding_reception',
  'afterparty',
  'brand_activation',
  'club_series',
  'private_buyout',
  'other_archetype',
] as const

export type EventArchetypeV3 = (typeof EVENT_ARCHETYPE_KEYS)[number] | ''

export const EVENT_ARCHETYPE_LABELS: Record<Exclude<EventArchetypeV3, ''>, string> = {
  weekly_residency: 'Weekly / residency',
  annual_corporate: 'Annual corporate',
  one_off_private: 'One-off private',
  festival_slot: 'Festival slot',
  wedding_reception: 'Wedding reception',
  afterparty: 'Afterparty',
  brand_activation: 'Brand activation',
  club_series: 'Club series / recurring night',
  private_buyout: 'Private buyout',
  other_archetype: 'Other format',
}

/** Phase 2C — room / venue class (always tappable substance). */
export const VENUE_ARCHETYPE_KEYS = [
  'nightclub',
  'bar',
  'lounge',
  'hotel',
  'banquet_ballroom',
  'restaurant',
  'private_residence',
  'outdoor',
  'festival_grounds',
  'warehouse',
  'theater',
  'rooftop',
  'other_venue_class',
] as const

export type VenueArchetypeV3 = (typeof VENUE_ARCHETYPE_KEYS)[number] | ''

export const VENUE_ARCHETYPE_LABELS: Record<Exclude<VenueArchetypeV3, ''>, string> = {
  nightclub: 'Nightclub',
  bar: 'Bar',
  lounge: 'Lounge',
  hotel: 'Hotel',
  banquet_ballroom: 'Banquet / ballroom',
  restaurant: 'Restaurant',
  private_residence: 'Private residence',
  outdoor: 'Outdoor',
  festival_grounds: 'Festival grounds',
  warehouse: 'Warehouse / industrial',
  theater: 'Theater',
  rooftop: 'Rooftop',
  other_venue_class: 'Other venue class',
}

/** How specific address info is (substance beyond Have/Later/TBD). */
export const ADDRESS_DETAIL_LEVEL_KEYS = [
  'full_address_expected',
  'neighborhood_only',
  'private_undisclosed',
  'pre_call_sufficient',
] as const

export type AddressDetailLevelV3 = (typeof ADDRESS_DETAIL_LEVEL_KEYS)[number] | ''

export const ADDRESS_DETAIL_LEVEL_LABELS: Record<Exclude<AddressDetailLevelV3, ''>, string> = {
  full_address_expected: 'Full address coming (email / follow-up)',
  neighborhood_only: 'Neighborhood / area only (no street yet)',
  private_undisclosed: 'Private — full address withheld for now',
  pre_call_sufficient: 'Pre-call / existing record has enough for now',
}

/** Phase 3B — tappable setlist / music intent. */
export const SETLIST_REQUEST_TAG_KEYS = [
  'must_play_incoming',
  'do_not_play',
  'bpm_energy_discussed',
  'corporate_clean',
  'wedding_moments',
  'open_format_ok',
  'artist_refs_in_message',
  'decade_era_theme',
  'latin_forward',
  'hiphop_forward',
  'edm_forward',
  'no_requests',
] as const

export type SetlistRequestTagV3 = (typeof SETLIST_REQUEST_TAG_KEYS)[number]

export const SETLIST_REQUEST_TAG_LABELS: Record<SetlistRequestTagV3, string> = {
  must_play_incoming: 'Must-play list incoming',
  do_not_play: 'Do-not-play discussed',
  bpm_energy_discussed: 'BPM / energy direction discussed',
  corporate_clean: 'Corporate-clean / radio edit',
  wedding_moments: 'Wedding moments (first dance, etc.)',
  open_format_ok: 'Open format — DJ reads room',
  artist_refs_in_message: 'Reference tracks / artists in writing',
  decade_era_theme: 'Decade / era theme',
  latin_forward: 'Latin-forward',
  hiphop_forward: 'Hip-hop–forward',
  edm_forward: 'EDM-forward',
  no_requests: 'No specific requests',
}

export const MUSIC_DELIVERY_KEYS = [
  '',
  'email_spotify',
  'email_pdf',
  'text_link',
  'verbal_day_of',
  'not_needed_delivery',
] as const

export type MusicDeliveryV3 = (typeof MUSIC_DELIVERY_KEYS)[number]

export const MUSIC_DELIVERY_LABELS: Record<Exclude<MusicDeliveryV3, ''>, string> = {
  email_spotify: 'They’ll email / Spotify list',
  email_pdf: 'They’ll send PDF / run of show',
  text_link: 'Text / DM link later',
  verbal_day_of: 'Verbal day-of only',
  not_needed_delivery: 'Nothing extra coming',
}

/** Phase 3C */
export const LINEUP_FORMAT_KEYS = [
  '',
  'solo_dj',
  'b2b',
  'alternating_djs',
  'band_plus_dj',
  'multi_stage',
] as const

export type LineupFormatV3 = (typeof LINEUP_FORMAT_KEYS)[number]

export const LINEUP_FORMAT_LABELS: Record<Exclude<LineupFormatV3, ''>, string> = {
  solo_dj: 'Solo DJ run',
  b2b: 'B2B set',
  alternating_djs: 'Alternating DJs',
  band_plus_dj: 'Band + DJ',
  multi_stage: 'Multi-stage / roaming',
}

/** Phase 4A — equipment substance (multi-select). */
export const EQUIPMENT_CAPABILITY_KEYS = [
  'cdjs_provided',
  'decks_two',
  'decks_four_plus',
  'club_standard_mixer',
  'booth_monitors',
  'wired_mic',
  'wireless_mic',
  'house_tech_onsite',
  'dj_brings_controller',
  'dj_laptop_only',
  'power_or_generator_note',
  'backup_usb_provided',
] as const

export type EquipmentCapabilityIdV3 = (typeof EQUIPMENT_CAPABILITY_KEYS)[number]

export const EQUIPMENT_CAPABILITY_LABELS: Record<EquipmentCapabilityIdV3, string> = {
  cdjs_provided: 'CDJs / media players provided',
  decks_two: '2-deck setup',
  decks_four_plus: '3+ decks / rotary / extra',
  club_standard_mixer: 'Club-standard mixer',
  booth_monitors: 'Booth monitors OK',
  wired_mic: 'Wired mic',
  wireless_mic: 'Wireless mic',
  house_tech_onsite: 'House tech / A1 on site',
  dj_brings_controller: 'DJ brings controller',
  dj_laptop_only: 'DJ laptop-only (house audio)',
  power_or_generator_note: 'Power / generator concerns',
  backup_usb_provided: 'Backup media / USB plan',
}

/** Phase 4C — load-in access */
export const LOAD_ACCESS_TAG_KEYS = [
  'loading_dock',
  'rear_alley',
  'front_door',
  'freight_elevator',
  'curbside',
  'stairs_carry',
] as const

export type LoadAccessTagV3 = (typeof LOAD_ACCESS_TAG_KEYS)[number]

export const LOAD_ACCESS_TAG_LABELS: Record<LoadAccessTagV3, string> = {
  loading_dock: 'Loading dock',
  rear_alley: 'Rear / alley',
  front_door: 'Front door',
  freight_elevator: 'Freight elevator',
  curbside: 'Curbside / pull-up',
  stairs_carry: 'Stairs / carry-in',
}

/** Phase 4D — parking class (substantive). */
export const PARKING_ACCESS_CLASS_KEYS = [
  '',
  'crew_lot',
  'comped_garage',
  'street',
  'valet',
  'reimburse',
  'dock_only',
  'tbd_parking',
] as const

export type ParkingAccessClassV3 = (typeof PARKING_ACCESS_CLASS_KEYS)[number]

export const PARKING_ACCESS_CLASS_LABELS: Record<Exclude<ParkingAccessClassV3, ''>, string> = {
  crew_lot: 'Dedicated crew lot',
  comped_garage: 'Comped garage / validation',
  street: 'Street parking',
  valet: 'Valet',
  reimburse: 'Reimburse / stipend',
  dock_only: 'Load-in only — parking TBD',
  tbd_parking: 'Parking TBD',
}

/** Phase 4E */
export const TRAVEL_BOOKED_BY_KEYS = ['', 'client_books', 'artist_books', 'split_travel', 'not_discussed_travel'] as const
export type TravelBookedByV3 = (typeof TRAVEL_BOOKED_BY_KEYS)[number]

export const TRAVEL_BOOKED_BY_LABELS: Record<Exclude<TravelBookedByV3, ''>, string> = {
  client_books: 'Client books travel',
  artist_books: 'Artist books travel',
  split_travel: 'Split / case-by-case',
  not_discussed_travel: 'Who books — not nailed down',
}

export const GROUND_TRANSPORT_KEYS = [
  '',
  'rental_car',
  'car_service',
  'rideshare_stipend',
  'venue_shuttle',
  'artist_owns_vehicle',
  'not_discussed_ground',
] as const

export type GroundTransportV3 = (typeof GROUND_TRANSPORT_KEYS)[number]

export const GROUND_TRANSPORT_LABELS: Record<Exclude<GroundTransportV3, ''>, string> = {
  rental_car: 'Rental car',
  car_service: 'Car service / black car',
  rideshare_stipend: 'Rideshare / stipend',
  venue_shuttle: 'Venue shuttle / pickup',
  artist_owns_vehicle: 'Artist drives self',
  not_discussed_ground: 'Ground transport TBD',
}

/** Phase 5C */
export const MANUAL_PRICING_REASON_KEYS = [
  '',
  'friend_rate',
  'bundle',
  'trade',
  'promo',
  'tax_inclusive',
  'client_math',
  'rate_match',
  'other_reason',
] as const

export type ManualPricingReasonV3 = (typeof MANUAL_PRICING_REASON_KEYS)[number]

export const MANUAL_PRICING_REASON_LABELS: Record<Exclude<ManualPricingReasonV3, ''>, string> = {
  friend_rate: 'Friend / relationship rate',
  bundle: 'Bundled with other dates / services',
  trade: 'Trade / contra',
  promo: 'Promo / marketing',
  tax_inclusive: 'Tax- or fee-inclusive quote',
  client_math: 'Matched client’s number',
  rate_match: 'Rate match / competitive',
  other_reason: 'Other (note in post-call)',
}

/** Phase 4B — on-site POC substance (venue_data). */
export const ONSITE_POC_ROLE_KEYS = [
  '',
  'production_manager',
  'gm_ops',
  'talent_buyer',
  'day_of_coordinator',
  'security',
  'artist_handler',
  'owner',
  'venue_staff_other',
] as const

export type OnsitePocRoleV3 = (typeof ONSITE_POC_ROLE_KEYS)[number]

export const ONSITE_POC_ROLE_LABELS: Record<Exclude<OnsitePocRoleV3, ''>, string> = {
  production_manager: 'Production / technical manager',
  gm_ops: 'GM / operations',
  talent_buyer: 'Talent buyer / booker',
  day_of_coordinator: 'Day-of coordinator',
  security: 'Security / door',
  artist_handler: 'Artist handler / tour mgr',
  owner: 'Owner / principal',
  venue_staff_other: 'Other venue staff',
}

export const ONSITE_CONNECT_METHOD_KEYS = [
  '',
  'text_manager',
  'call_day_of',
  'email_intro',
  'whatsapp',
  'meet_at_load_in',
  'group_thread',
  'other_channel',
] as const

export type OnsiteConnectMethodV3 = (typeof ONSITE_CONNECT_METHOD_KEYS)[number]

export const ONSITE_CONNECT_METHOD_LABELS: Record<Exclude<OnsiteConnectMethodV3, ''>, string> = {
  text_manager: 'Text manager / ops line',
  call_day_of: 'Call day-of',
  email_intro: 'Email intro',
  whatsapp: 'WhatsApp / Signal',
  meet_at_load_in: 'Meet at load-in',
  group_thread: 'Group chat / thread',
  other_channel: 'Other channel',
}

export const ONSITE_CONNECT_WINDOW_KEYS = ['', 'morning', 'afternoon', 'evening', 'day_of_only'] as const
export type OnsiteConnectWindowV3 = (typeof ONSITE_CONNECT_WINDOW_KEYS)[number]

export const ONSITE_CONNECT_WINDOW_LABELS: Record<Exclude<OnsiteConnectWindowV3, ''>, string> = {
  morning: 'Morning window',
  afternoon: 'Afternoon window',
  evening: 'Evening window',
  day_of_only: 'Day-of only',
}

/** Phase 7 — close artifacts (multi). */
export const CLOSE_ARTIFACT_TAG_KEYS = [
  'contract_same_day',
  'invoice_same_day',
  'calendar_hold',
  'pending_vendor_approval',
  'verbal_hold_followup',
  'multi_date_packet',
] as const

export type CloseArtifactTagV3 = (typeof CLOSE_ARTIFACT_TAG_KEYS)[number]

export const CLOSE_ARTIFACT_TAG_LABELS: Record<CloseArtifactTagV3, string> = {
  contract_same_day: 'Contract out same day',
  invoice_same_day: 'Invoice out same day',
  calendar_hold: 'Soft hold / penciled',
  pending_vendor_approval: 'Pending internal / vendor approval',
  verbal_hold_followup: 'Verbal — paperwork follows',
  multi_date_packet: 'Multi-date packet together',
}

export const FOLLOW_UP_TOPIC_KEYS = [
  'address',
  'contacts',
  'technical',
  'payment',
  'contract_review',
  'other',
] as const

export type FollowUpTopicKeyV3 = (typeof FOLLOW_UP_TOPIC_KEYS)[number]

export const FOLLOW_UP_TOPIC_LABELS: Record<FollowUpTopicKeyV3, string> = {
  address: 'Address',
  contacts: 'Contacts',
  technical: 'Technical',
  payment: 'Payment',
  contract_review: 'Contract review',
  other: 'Other',
}

export const PAYMENT_METHOD_KEYS = [
  'cash',
  'zelle',
  'venmo',
  'apple_pay',
  'paypal',
  'check',
  'other',
] as const

export type PaymentMethodKeyV3 = (typeof PAYMENT_METHOD_KEYS)[number]

/** §17.6A — venue promise presets (ids align with `SHOW_REPORT_PRESETS` / deal `promise_lines`). */
export type VenuePromiseLineIdV3 = (typeof SHOW_REPORT_PRESETS)[number]['id']

export type VenuePromiseLinesV3 = Record<VenuePromiseLineIdV3, string>

export type VenuePromiseLinesAutoV3 = Record<VenuePromiseLineIdV3, boolean>

const PROMISE_LINE_ALLOWED: Record<VenuePromiseLineIdV3, Set<string>> = {
  guaranteed_fee: new Set(['', 'confirmed', 'not_discussed', 'no']),
  pa_sound: new Set(['', 'venue_provides', 'dj_provides', 'not_discussed']),
  stage_lighting: new Set(['', 'confirmed', 'not_discussed', 'no']),
  set_times: new Set(['', 'confirmed', 'not_discussed']),
  load_in: new Set(['', 'confirmed', 'not_discussed']),
  merch_terms: new Set(['', 'confirmed', 'not_discussed', 'na']),
  hospitality: new Set(['', 'confirmed', 'not_discussed', 'no']),
  lodging: new Set(['', 'confirmed', 'not_needed', 'not_discussed']),
  parking: new Set(['', 'confirmed', 'need_confirm', 'not_discussed']),
  marketing: new Set(['', 'confirmed', 'not_discussed']),
  guest_list: new Set(['', 'confirmed', 'not_discussed', 'na']),
}

export const VENUE_PROMISE_LINE_OPTIONS: Record<
  VenuePromiseLineIdV3,
  { value: string; label: string }[]
> = {
  guaranteed_fee: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
    { value: 'no', label: 'No' },
  ],
  pa_sound: [
    { value: 'venue_provides', label: 'Venue provides' },
    { value: 'dj_provides', label: 'DJ provides' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  stage_lighting: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
    { value: 'no', label: 'No' },
  ],
  set_times: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  load_in: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  merch_terms: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
    { value: 'na', label: 'N/A' },
  ],
  hospitality: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
    { value: 'no', label: 'No' },
  ],
  lodging: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_needed', label: 'Not needed' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  parking: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'need_confirm', label: 'Need to confirm' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  marketing: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
  ],
  guest_list: [
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'not_discussed', label: 'Not discussed' },
    { value: 'na', label: 'N/A' },
  ],
}

export function emptyVenuePromiseLinesV3(): VenuePromiseLinesV3 {
  return Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, ''])) as VenuePromiseLinesV3
}

export function emptyVenuePromiseLinesAutoV3(): VenuePromiseLinesAutoV3 {
  return Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, false])) as VenuePromiseLinesAutoV3
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodKeyV3, string> = {
  cash: 'Cash',
  zelle: 'Zelle',
  venmo: 'Venmo',
  apple_pay: 'Apple Pay',
  paypal: 'PayPal',
  check: 'Check',
  other: 'Other',
}

export const PERFORMANCE_GENRE_VALUES = [
  'latin_house',
  'reggaeton',
  'hip_hop',
  'top_40',
  'edm',
  'cumbia',
  'salsa',
  'afrobeats',
  'open_format',
  'other',
] as const

export type PerformanceGenreV3 = (typeof PERFORMANCE_GENRE_VALUES)[number]

export const PERFORMANCE_GENRE_LABELS: Record<PerformanceGenreV3, string> = {
  latin_house: 'Latin House',
  reggaeton: 'Reggaeton',
  hip_hop: 'Hip-Hop',
  top_40: 'Top 40',
  edm: 'EDM',
  cumbia: 'Cumbia',
  salsa: 'Salsa',
  afrobeats: 'Afrobeats',
  open_format: 'Open Format',
  other: 'Other',
}

export const PERFORMANCE_ROLE_OPTIONS: { value: PerformanceRoleV3; label: string }[] = [
  { value: 'headliner', label: 'Headliner' },
  { value: 'opener', label: 'Opener' },
  { value: 'support_mid', label: 'Support / Mid-Set' },
  { value: 'solo_only', label: 'Solo (Only DJ)' },
  { value: 'resident_regular', label: 'Resident / Regular' },
  { value: 'guest_set', label: 'Guest Set' },
]

export type CapacityRangeV3 =
  | ''
  | 'under_100'
  | '100_300'
  | '300_500'
  | '500_1000'
  | '1000_2000'
  | '2000_5000'
  | '5000_plus'

export const CAPACITY_RANGE_OPTIONS: { value: CapacityRangeV3; label: string }[] = [
  { value: 'under_100', label: 'Under 100' },
  { value: '100_300', label: '100-300' },
  { value: '300_500', label: '300-500' },
  { value: '500_1000', label: '500-1,000' },
  { value: '1000_2000', label: '1,000-2,000' },
  { value: '2000_5000', label: '2,000-5,000' },
  { value: '5000_plus', label: '5,000+' },
]

/** US state / region codes stored in `venues.region`; last = Other / International. */
export const US_STATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
  { value: 'DC', label: 'District of Columbia' },
  { value: '__intl', label: 'Other / International' },
]

/** Shared intake data stored in `booking_intakes.venue_data` (v3). */
export type BookingIntakeVenueDataV3 = {
  _v: 3
  session_mode: BookingIntakeSessionMode
  last_active_section: string
  view_section: string
  venue_source: VenueSourceV3
  existing_venue_id: string | null
  selected_contact_id: string | null
  contact_name: string
  contact_company: string
  contact_role: string
  contact_phone: string
  contact_email: string
  inquiry_source: InquirySourceV3 | ''
  inquiry_summary: string
  known_event_date: string
  known_event_type: KnownEventTypeV3 | ''
  known_venue_name: string
  known_city: string
  pre_call_notes: string
  outreach_track: OutreachTrack
  commission_tier: CommissionTier
  priority: number
  multi_show: boolean
  show_count: 2 | 3
  last_saved_at: string | null
  confirmed_contact: Phase1ConfirmedContactV3
  call_vibe: Phase1CallVibeV3
  phone_confirmed: Phase1PhoneConfirmedV3
  email_confirmed: Phase1EmailConfirmedV3
  company_confirmed: Phase1CompanyConfirmedV3
  /** Substantive: their role/title when `confirmed_contact === 'no_different_person'`. */
  contact_mismatch_context: Phase1ContactMismatchContextV3
  /** Their name on the call when not the contact on file (single line). */
  contact_mismatch_note: string
  /** Preferred channel for the email we’ll use (when multiple in play). */
  preferred_email_channel: Phase1PreferredEmailChannelV3
  /** Per §8.5 — Phase 2 subsection defaults per spec §8.4 */
  same_for_all_2a: boolean
  same_for_all_2b: boolean
  same_for_all_2c: boolean
  same_for_all_2d: boolean
  /** §8.4 — 3A default different per show */
  same_for_all_3a: boolean
  same_for_all_3b: boolean
  same_for_all_3c: boolean
  same_for_all_4a: boolean
  same_for_all_4c: boolean
  same_for_all_4d: boolean
  same_for_all_4e: boolean
  /** §17.6A — default same promise grid for all shows */
  same_for_all_6a: boolean
  onsite_same_contact: Phase4OnsiteSameContactV3
  onsite_name_flag: Phase4OnsiteFlagV3
  onsite_phone_flag: Phase4OnsiteFlagV3
  /** On-site POC role / logistics (substance beyond name capture later). */
  onsite_poc_role: OnsitePocRoleV3
  onsite_connect_method: OnsiteConnectMethodV3
  onsite_connect_window: OnsiteConnectWindowV3
  /** §16.5E — shared invoicing */
  invoice_same_contact: Phase5InvoiceSameContactV3
  invoice_company_confirmed: Phase5InvoiceConfirmV3
  invoice_email_confirmed: Phase5InvoiceConfirmV3
  billing_contact_flag: Phase5BillingContactFlagV3
  /** §18.7A */
  send_agreement: Phase7SendAgreementV3
  deposit_on_call: Phase7DepositOnCallV3
  client_energy: Phase7ClientEnergyV3
  /** §18.7B */
  has_follow_ups: Phase7HasFollowUpsV3
  follow_up_date: string
  follow_up_topics: FollowUpTopicKeyV3[]
  /** §18.7C — ISO timestamp when operator ended live call */
  call_ended_at: string | null
  call_status: Phase7CallStatusV3
  /** Tappable close commitments (in addition to agreement / deposit toggles). */
  close_artifact_tags: CloseArtifactTagV3[]
  /** Suggested venue `status` after close (import / outreach tooling; not auto-written to DB here). */
  suggested_outreach_status: '' | 'agreement_sent' | 'in_discussion'
  /** §19.8B — post-call typing */
  post_call_notes: string
  future_intel: string
  red_flags: string
  /** §19.8A — on-site contact (typed after live flags). */
  onsite_contact_name: string
  onsite_contact_phone: string
  onsite_contact_role: string
  /** §19.8A — invoicing / billing (typed after live flags). */
  invoice_company_text: string
  invoice_email_text: string
  billing_contact_name: string
  billing_contact_email: string
  /** After §8C creates a new venue, stores its id for deal import (Phase 0 existing uses `existing_venue_id`). */
  post_import_venue_id: string | null
}

export type BookingIntakeShowDataV3 = {
  _v: 3
  color: string
  event_type: KnownEventTypeV3 | ''
  venue_type: VenueType | ''
  setting: Phase2SettingV3
  /** Event format / cadence (tappable substance). */
  event_archetype: EventArchetypeV3
  event_name_flag: Phase2EventNameFlagV3
  event_date: string
  event_start_time: string
  event_end_time: string
  overnight_event: boolean
  venue_name_flag: Phase2VenueNameFlagV3
  city_flag: Phase2CityFlagV3
  state_region: string
  address_status: Phase2AddressStatusV3
  venue_archetype: VenueArchetypeV3
  address_detail_level: AddressDetailLevelV3
  capacity_range: CapacityRangeV3
  exact_capacity_flag: Phase2ExactCapacityFlagV3
  approximate_headcount: number
  performance_role: PerformanceRoleV3
  set_start_time: string
  set_end_time: string
  /** True when set_end_time < set_start_time (performance crosses midnight). */
  overnight_set: boolean
  genres: PerformanceGenreV3[]
  custom_setlist: Phase3CustomSetlistV3
  /** Tappable setlist / music intent chips. */
  setlist_request_tags: SetlistRequestTagV3[]
  music_requests_flag: Phase3MusicRequestsFlagV3
  /** How detailed requests will be delivered. */
  music_delivery: MusicDeliveryV3
  other_performers: Phase3OtherPerformersV3
  num_other_acts: Phase3NumOtherActsV3
  billing_priority: Phase3BillingPriorityV3
  lineup_format: LineupFormatV3
  equipment_provider: Phase4EquipmentProviderV3
  equipment_details_flag: Phase4EquipmentDetailsFlagV3
  /** Tappable equipment capabilities discussed. */
  equipment_capability_ids: EquipmentCapabilityIdV3[]
  load_in_discussed: Phase4LoadInDiscussedV3
  load_in_time: string
  soundcheck: Phase4SoundcheckV3
  load_in_access_tags: LoadAccessTagV3[]
  parking_status: Phase4ParkingStatusV3
  parking_details_flag: Phase4ParkingDetailsFlagV3
  parking_access_class: ParkingAccessClassV3
  travel_required: Phase4TravelRequiredV3
  lodging_status: Phase4LodgingStatusV3
  travel_notes_flag: Phase4TravelNotesFlagV3
  travel_booked_by: TravelBookedByV3
  ground_transport: GroundTransportV3
  /** §16.5A–5D — per-show money (no same-for-all). */
  pricing_mode: Phase5PricingModeV3
  package_id: string
  service_id: string
  overtime_service_id: string
  performance_hours: number
  addon_quantities: Record<string, number>
  surcharge_ids: string[]
  discount_ids: string[]
  pricing_source: Phase5PricingSourceV3
  manual_gross: number | null
  manual_pricing_reason: ManualPricingReasonV3
  deposit_percent: Phase5DepositPercentV3
  balance_timing: Phase5BalanceTimingV3
  balance_due_date: string
  payment_methods: PaymentMethodKeyV3[]
  /** §17.6A — venue promise lines (maps to deal `promise_lines` on import). */
  promise_lines_v3: VenuePromiseLinesV3
  promise_lines_auto: VenuePromiseLinesAutoV3
  /** §19.8A — post-call capture (typed after live “capture later” flags). */
  event_name_text: string
  venue_name_text: string
  city_text: string
  street_address: string
  address_line2: string
  postal_code: string
  exact_capacity_number: string
  music_requests_text: string
  /** Phase 3B — typed in post-call when `custom_setlist === 'specific_requests'`. */
  custom_setlist_notes: string
  equipment_details_text: string
  parking_details_text: string
  travel_notes_text: string
}

export const SHOW_COLOR_HEX: [string, string, string] = ['#3B82F6', '#8B5CF6', '#F59E0B']

export function computeOvernightEvent(startHHmm: string, endHHmm: string): boolean {
  if (!startHHmm?.trim() || !endHHmm?.trim()) return false
  return endHHmm < startHHmm
}

export function dayOfWeekFromIsoDate(iso: string): string {
  if (!iso.trim()) return ''
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
  } catch {
    return ''
  }
}

export function showLabelFromEventDate(iso: string): string {
  if (!iso.trim()) return ''
  try {
    const d = new Date(`${iso}T12:00:00`)
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

/** Billable / display hours from set times (15-min wall times, optional overnight set). */
export function computeSetLengthHours(startHHmm: string, endHHmm: string, overnight: boolean): number {
  const parse = (s: string) => {
    const [h, m] = s.split(':').map(x => Number(x))
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : NaN
  }
  const startM = parse(startHHmm)
  const endM = parse(endHHmm)
  if (!Number.isFinite(startM) || !Number.isFinite(endM)) return 0
  let end = endM
  if (overnight) end += 24 * 60
  return Math.max(0, (end - startM) / 60)
}

/** Billable hours suggestion from performance slot (matches deal import rounding). */
export function suggestedBillableHoursFromShow(d: BookingIntakeShowDataV3): number {
  const setHrs = computeSetLengthHours(d.set_start_time, d.set_end_time, d.overnight_set)
  if (setHrs <= 0) return 0
  return Math.max(1, Math.min(12, Math.round(setHrs * 2) / 2))
}

/** Auto-suggestions from Phases 3A–5 (only fill blanks in UI). */
export function suggestedPromiseLinesFromEarlierPhases(
  sd: BookingIntakeShowDataV3,
): Partial<VenuePromiseLinesV3> {
  const out: Partial<VenuePromiseLinesV3> = {}
  const pricingLocked =
    (sd.pricing_source === 'manual' && sd.manual_gross != null && sd.manual_gross > 0) ||
    (sd.pricing_source === 'calculated' &&
      !!(sd.package_id.trim() || sd.service_id.trim()) &&
      (sd.performance_hours > 0 || suggestedBillableHoursFromShow(sd) > 0))
  if (pricingLocked) out.guaranteed_fee = 'confirmed'

  const ep = sd.equipment_provider
  if (ep === 'venue_provides') out.pa_sound = 'venue_provides'
  else if (ep === 'dj_brings') out.pa_sound = 'dj_provides'
  else if (ep === 'hybrid') out.pa_sound = 'not_discussed'

  if (sd.set_start_time.trim() && sd.set_end_time.trim()) out.set_times = 'confirmed'

  if (sd.load_in_discussed === 'yes') out.load_in = 'confirmed'

  const ps = sd.parking_status
  if (ps === 'confirmed') out.parking = 'confirmed'
  else if (ps === 'need_confirm') out.parking = 'need_confirm'
  else if (ps === 'not_discussed') out.parking = 'not_discussed'

  if (sd.travel_required === 'local') {
    out.lodging = 'not_needed'
  } else if (sd.travel_required === 'regional' || sd.travel_required === 'flight') {
    const ls = sd.lodging_status
    if (ls === 'not_needed') out.lodging = 'not_needed'
    else if (ls === 'venue_provides' || ls === 'dj_covers') out.lodging = 'confirmed'
    else if (ls === 'not_discussed') out.lodging = 'not_discussed'
  }

  return out
}

/** Map intake §6A tri-state values → Earnings venue preset toggles for `buildPromiseLinesDocV2FromUi`. */
export function promisePresetsFromVenueLinesV3(pl: VenuePromiseLinesV3): Record<string, boolean> {
  const out: Record<string, boolean> = Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, false]))
  const t = (id: VenuePromiseLineIdV3) => {
    out[id] = true
  }
  if (pl.guaranteed_fee === 'confirmed') t('guaranteed_fee')
  if (pl.pa_sound === 'venue_provides' || pl.pa_sound === 'dj_provides') t('pa_sound')
  if (pl.stage_lighting === 'confirmed') t('stage_lighting')
  if (pl.set_times === 'confirmed') t('set_times')
  if (pl.load_in === 'confirmed') t('load_in')
  if (pl.merch_terms === 'confirmed') t('merch_terms')
  if (pl.hospitality === 'confirmed') t('hospitality')
  if (pl.lodging === 'confirmed') t('lodging')
  if (pl.parking === 'confirmed' || pl.parking === 'need_confirm') t('parking')
  if (pl.marketing === 'confirmed') t('marketing')
  if (pl.guest_list === 'confirmed') t('guest_list')
  return out
}

export function formatSetLengthDisplay(hours: number): string {
  if (hours <= 0) return '—'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (m === 0) return h === 1 ? '1 hr' : `${h} hrs`
  if (h === 0) return `${m} min`
  return `${h} hr${h === 1 ? '' : 's'} ${m} min`
}

export function genresToPerformanceGenreString(genres: PerformanceGenreV3[]): string {
  return genres.map(g => PERFORMANCE_GENRE_LABELS[g] ?? g).filter(Boolean).join(', ')
}

const KNOWN_EVENT_LABELS: Record<KnownEventTypeV3, string> = {
  after_party: 'After-Party',
  private_event: 'Private Event',
  club_night: 'Club Night',
  corporate: 'Corporate',
  wedding: 'Wedding',
  festival: 'Festival',
  concert: 'Concert',
  brand_activation: 'Brand Activation',
  other: 'Other',
}

export function knownEventTypeLabel(v: KnownEventTypeV3 | ''): string {
  return v ? KNOWN_EVENT_LABELS[v] ?? '' : ''
}

const VENUE_TYPES: VenueType[] = ['bar', 'club', 'festival', 'theater', 'lounge', 'other']

export function emptyShowDataV3(sortIndex: number): BookingIntakeShowDataV3 {
  return {
    _v: 3,
    color: SHOW_COLOR_HEX[Math.min(sortIndex, 2)] ?? SHOW_COLOR_HEX[0],
    event_type: '',
    venue_type: '',
    setting: '',
    event_archetype: '',
    event_name_flag: '',
    event_date: '',
    event_start_time: '20:00',
    event_end_time: '23:00',
    overnight_event: false,
    venue_name_flag: '',
    city_flag: '',
    state_region: '',
    address_status: '',
    venue_archetype: '',
    address_detail_level: '',
    capacity_range: '',
    exact_capacity_flag: '',
    approximate_headcount: 0,
    performance_role: '',
    set_start_time: '',
    set_end_time: '',
    overnight_set: false,
    genres: [],
    custom_setlist: '',
    setlist_request_tags: [],
    music_requests_flag: '',
    music_delivery: '',
    other_performers: '',
    num_other_acts: '',
    billing_priority: '',
    lineup_format: '',
    equipment_provider: '',
    equipment_details_flag: '',
    equipment_capability_ids: [],
    load_in_discussed: '',
    load_in_time: '',
    soundcheck: '',
    load_in_access_tags: [],
    parking_status: '',
    parking_details_flag: '',
    parking_access_class: '',
    travel_required: '',
    lodging_status: '',
    travel_notes_flag: '',
    travel_booked_by: '',
    ground_transport: '',
    pricing_mode: 'hourly',
    package_id: '',
    service_id: '',
    overtime_service_id: '',
    performance_hours: 0,
    addon_quantities: {},
    surcharge_ids: [],
    discount_ids: [],
    pricing_source: 'calculated',
    manual_gross: null,
    manual_pricing_reason: '',
    deposit_percent: 50,
    balance_timing: 'before_event',
    balance_due_date: '',
    payment_methods: [],
    promise_lines_v3: emptyVenuePromiseLinesV3(),
    promise_lines_auto: emptyVenuePromiseLinesAutoV3(),
    event_name_text: '',
    venue_name_text: '',
    city_text: '',
    street_address: '',
    address_line2: '',
    postal_code: '',
    exact_capacity_number: '',
    music_requests_text: '',
    custom_setlist_notes: '',
    equipment_details_text: '',
    parking_details_text: '',
    travel_notes_text: '',
  }
}

export function emptyVenueDataV3(): BookingIntakeVenueDataV3 {
  return {
    _v: 3,
    session_mode: 'pre_call',
    last_active_section: '1A',
    view_section: '1A',
    venue_source: 'new',
    existing_venue_id: null,
    selected_contact_id: null,
    contact_name: '',
    contact_company: '',
    contact_role: '',
    contact_phone: '',
    contact_email: '',
    inquiry_source: '',
    inquiry_summary: '',
    known_event_date: '',
    known_event_type: '',
    known_venue_name: '',
    known_city: '',
    pre_call_notes: '',
    outreach_track: 'pipeline',
    commission_tier: 'new_doors',
    priority: 3,
    multi_show: false,
    show_count: 2,
    last_saved_at: null,
    confirmed_contact: '',
    call_vibe: '',
    phone_confirmed: '',
    email_confirmed: '',
    company_confirmed: '',
    contact_mismatch_context: '',
    contact_mismatch_note: '',
    preferred_email_channel: '',
    same_for_all_2a: true,
    same_for_all_2b: false,
    same_for_all_2c: true,
    same_for_all_2d: true,
    same_for_all_3a: false,
    same_for_all_3b: true,
    same_for_all_3c: true,
    same_for_all_4a: true,
    same_for_all_4c: false,
    same_for_all_4d: true,
    same_for_all_4e: true,
    same_for_all_6a: true,
    onsite_same_contact: '',
    onsite_name_flag: '',
    onsite_phone_flag: '',
    onsite_poc_role: '',
    onsite_connect_method: '',
    onsite_connect_window: '',
    invoice_same_contact: '',
    invoice_company_confirmed: '',
    invoice_email_confirmed: '',
    billing_contact_flag: '',
    send_agreement: '',
    deposit_on_call: '',
    client_energy: '',
    has_follow_ups: '',
    follow_up_date: '',
    follow_up_topics: [],
    call_ended_at: null,
    call_status: '',
    close_artifact_tags: [],
    suggested_outreach_status: '',
    post_call_notes: '',
    future_intel: '',
    red_flags: '',
    onsite_contact_name: '',
    onsite_contact_phone: '',
    onsite_contact_role: '',
    invoice_company_text: '',
    invoice_email_text: '',
    billing_contact_name: '',
    billing_contact_email: '',
    post_import_venue_id: null,
  }
}

/** Post-call sub-steps (§19). */
export const POST_CALL_SECTION_ORDER: readonly string[] = ['8A', '8B', '8C']

/** Implemented live sections in order (extend as phases ship). */
export const LIVE_SECTION_ORDER: readonly string[] = [
  '1A',
  '1B',
  '2A',
  '2B',
  '2C',
  '2D',
  '3A',
  '3B',
  '3C',
  '4A',
  '4B',
  '4C',
  '4D',
  '4E',
  '5A',
  '5B',
  '5C',
  '5D',
  '5E',
  '6A',
  '7A',
  '7B',
  '7C',
]

/**
 * Linear path for Next/Back. Omits 4E when primary show state is CA (spec: local market / skip travel section).
 * Use the first show’s `state_region` as primary.
 */
export function livePathSections(primaryStateRegion: string | undefined | null): readonly string[] {
  const r = (primaryStateRegion ?? '').trim().toUpperCase()
  if (r === 'CA') return LIVE_SECTION_ORDER.filter(s => s !== '4E')
  return LIVE_SECTION_ORDER
}

export function liveSectionOrderIndex(sectionId: string): number {
  return LIVE_SECTION_ORDER.indexOf(sectionId)
}

export function liveSectionTitle(sectionId: string): string {
  switch (sectionId) {
    case '1A':
      return 'The greeting'
    case '1B':
      return 'Confirm what you know'
    case '2A':
      return 'Event identity'
    case '2B':
      return 'When'
    case '2C':
      return 'Where'
    case '2D':
      return 'Scale'
    case '3A':
      return 'Role & slot'
    case '3B':
      return 'Music & vibe'
    case '3C':
      return 'Other performers'
    case '4A':
      return 'Equipment'
    case '4B':
      return 'On-site contact'
    case '4C':
      return 'Load-in & soundcheck'
    case '4D':
      return 'Parking & access'
    case '4E':
      return 'Travel & lodging'
    case '5A':
      return 'Pricing setup'
    case '5B':
      return 'Add-ons & adjustments'
    case '5C':
      return 'The number'
    case '5D':
      return 'Deposit & payment'
    case '5E':
      return 'Invoicing'
    case '6A':
      return 'Venue promises'
    case '7A':
      return 'Next steps'
    case '7B':
      return 'Follow-ups'
    case '7C':
      return 'End call'
    case '8A':
      return 'Flagged fields'
    case '8B':
      return 'General notes'
    case '8C':
      return 'Import preview'
    default:
      if (sectionId.startsWith('__stub_')) return 'Coming soon'
      return sectionId
  }
}

/** Sidebar phase index 0–6 (Opening = 0). */
export function livePhaseIndexFromSection(sectionId: string): number {
  if (sectionId.startsWith('__stub_')) {
    const n = parseInt(sectionId.replace('__stub_', ''), 10)
    return Number.isFinite(n) ? Math.min(6, Math.max(0, n - 1)) : 0
  }
  const c = sectionId.charAt(0)
  const p = parseInt(c, 10)
  return Number.isFinite(p) ? Math.min(6, Math.max(0, p - 1)) : 0
}

export function stubSectionId(phaseOneBased: number): string {
  return `__stub_${phaseOneBased}`
}

/** §18.7C — suggested venue outreach status (caller may apply on venue import). */
export function suggestedOutreachStatusFromPhase7Close(
  sendAgreement: Phase7SendAgreementV3,
): '' | 'agreement_sent' | 'in_discussion' {
  if (sendAgreement === 'yes_sending') return 'agreement_sent'
  if (sendAgreement === 'verbal_only') return 'in_discussion'
  return ''
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

function asFollowUpTopicsArray(v: unknown): FollowUpTopicKeyV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(FOLLOW_UP_TOPIC_KEYS as readonly string[])
  const out: FollowUpTopicKeyV3[] = []
  for (const x of v) {
    if (typeof x === 'string' && allowed.has(x)) out.push(x as FollowUpTopicKeyV3)
  }
  return out
}

function asCloseArtifactTagsArray(v: unknown): CloseArtifactTagV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(CLOSE_ARTIFACT_TAG_KEYS as readonly string[])
  const out: CloseArtifactTagV3[] = []
  for (const x of v) {
    if (typeof x === 'string' && allowed.has(x)) out.push(x as CloseArtifactTagV3)
  }
  return out
}

/** Parse JSON from DB; legacy or corrupt rows fall back to fresh v3 defaults. */
export function parseVenueDataV3(raw: unknown, schemaVersion: number): BookingIntakeVenueDataV3 {
  const base = emptyVenueDataV3()
  if (schemaVersion < INTAKE_SCHEMA_VERSION_V3) return base
  if (!isPlainObject(raw) || raw._v !== 3) return base
  const o = raw as Record<string, unknown>
  const session = o.session_mode === 'live_call' || o.session_mode === 'post_call' ? o.session_mode : 'pre_call'
  const showCount = o.show_count === 3 ? 3 : 2
  const onsiteSame = parsePhase1Enum(o.onsite_same_contact, ['', 'same', 'different'], '')
  let onsiteName = parsePhase1Enum(o.onsite_name_flag, ['', 'capture_later', 'not_discussed'], '')
  let onsitePhone = parsePhase1Enum(o.onsite_phone_flag, ['', 'capture_later', 'not_discussed'], '')
  if (onsiteSame !== 'different') {
    onsiteName = ''
    onsitePhone = ''
  }
  let invSame = parsePhase1Enum(o.invoice_same_contact, ['', 'yes', 'different'], '')
  let invCo = parsePhase1Enum(o.invoice_company_confirmed, ['', 'correct', 'capture_later'], '')
  let invEmail = parsePhase1Enum(o.invoice_email_confirmed, ['', 'correct', 'capture_later'], '')
  let billFlag = parsePhase1Enum(o.billing_contact_flag, ['', 'same_main', 'capture_later'], '')
  if (invSame !== 'different') {
    invCo = ''
    invEmail = ''
    billFlag = ''
  }
  const sendAgreement = parsePhase1Enum(o.send_agreement, ['', 'yes_sending', 'verbal_only'], '')
  const depositOnCall = parsePhase1Enum(o.deposit_on_call, ['', 'paying_now', 'sending_invoice'], '')
  const clientEnergy = parsePhase1Enum(
    o.client_energy,
    ['', 'very_excited', 'positive', 'neutral', 'uncertain'],
    '',
  )
  const hasFollowUps = parsePhase1Enum(o.has_follow_ups, ['', 'yes', 'all_clear'], '')
  let followUpDate = typeof o.follow_up_date === 'string' ? o.follow_up_date : ''
  let followUpTopics = asFollowUpTopicsArray(o.follow_up_topics)
  if (hasFollowUps !== 'yes') {
    followUpDate = ''
    followUpTopics = []
  }
  const callEndedAt =
    typeof o.call_ended_at === 'string' && o.call_ended_at.trim() ? o.call_ended_at.trim() : null
  const callStatus = parsePhase1Enum(o.call_status, ['', 'full', 'partial', 'voicemail'], '')
  const suggestedOutreach = parsePhase1Enum(
    o.suggested_outreach_status,
    ['', 'agreement_sent', 'in_discussion'],
    '',
  )
  const parsed: BookingIntakeVenueDataV3 = {
    ...base,
    session_mode: session,
    last_active_section: typeof o.last_active_section === 'string' ? o.last_active_section : base.last_active_section,
    view_section:
      typeof o.view_section === 'string'
        ? o.view_section
        : typeof o.last_active_section === 'string'
          ? o.last_active_section
          : base.view_section,
    venue_source: o.venue_source === 'existing' ? 'existing' : 'new',
    existing_venue_id: typeof o.existing_venue_id === 'string' ? o.existing_venue_id : null,
    selected_contact_id: typeof o.selected_contact_id === 'string' ? o.selected_contact_id : null,
    contact_name: String(o.contact_name ?? ''),
    contact_company: String(o.contact_company ?? ''),
    contact_role: String(o.contact_role ?? ''),
    contact_phone: String(o.contact_phone ?? ''),
    contact_email: String(o.contact_email ?? ''),
    inquiry_source: (o.inquiry_source as BookingIntakeVenueDataV3['inquiry_source']) ?? '',
    inquiry_summary: String(o.inquiry_summary ?? ''),
    known_event_date: String(o.known_event_date ?? ''),
    known_event_type: (o.known_event_type as BookingIntakeVenueDataV3['known_event_type']) ?? '',
    known_venue_name: String(o.known_venue_name ?? ''),
    known_city: String(o.known_city ?? ''),
    pre_call_notes: String(o.pre_call_notes ?? ''),
    outreach_track: o.outreach_track === 'community' ? 'community' : 'pipeline',
    commission_tier: asCommissionTier(o.commission_tier, base.commission_tier),
    priority: typeof o.priority === 'number' && o.priority >= 1 && o.priority <= 5 ? o.priority : base.priority,
    multi_show: Boolean(o.multi_show),
    show_count: showCount,
    last_saved_at: typeof o.last_saved_at === 'string' ? o.last_saved_at : null,
    confirmed_contact: parsePhase1Enum(o.confirmed_contact, ['', 'yes', 'no_different_person'], ''),
    call_vibe: parsePhase1Enum(o.call_vibe, CALL_VIBE_KEYS, ''),
    phone_confirmed: parsePhase1Enum(o.phone_confirmed, ['', 'confirmed', 'update_needed'], ''),
    email_confirmed: parsePhase1Enum(o.email_confirmed, ['', 'confirmed', 'update_needed', 'need_to_get'], ''),
    company_confirmed: parsePhase1Enum(o.company_confirmed, ['', 'confirmed', 'update_needed'], ''),
    contact_mismatch_context: parsePhase1Enum(
      o.contact_mismatch_context,
      [...CONTACT_MISMATCH_CONTEXT_KEYS],
      '',
    ),
    contact_mismatch_note: typeof o.contact_mismatch_note === 'string' ? o.contact_mismatch_note : '',
    preferred_email_channel: parsePhase1Enum(
      o.preferred_email_channel,
      ['', 'work', 'personal', 'billing', 'production'],
      '',
    ),
    same_for_all_2a: o.same_for_all_2a === false ? false : true,
    same_for_all_2b: o.same_for_all_2b === true,
    same_for_all_2c: o.same_for_all_2c === false ? false : true,
    same_for_all_2d: o.same_for_all_2d === false ? false : true,
    same_for_all_3a: o.same_for_all_3a === true,
    same_for_all_3b: o.same_for_all_3b === false ? false : true,
    same_for_all_3c: o.same_for_all_3c === false ? false : true,
    same_for_all_4a: o.same_for_all_4a === false ? false : true,
    same_for_all_4c: o.same_for_all_4c === true,
    same_for_all_4d: o.same_for_all_4d === false ? false : true,
    same_for_all_4e: o.same_for_all_4e === false ? false : true,
    same_for_all_6a: o.same_for_all_6a === false ? false : true,
    onsite_same_contact: onsiteSame,
    onsite_name_flag: onsiteName,
    onsite_phone_flag: onsitePhone,
    onsite_poc_role: parsePhase1Enum(o.onsite_poc_role, ONSITE_POC_ROLE_KEYS, ''),
    onsite_connect_method: parsePhase1Enum(o.onsite_connect_method, ONSITE_CONNECT_METHOD_KEYS, ''),
    onsite_connect_window: parsePhase1Enum(o.onsite_connect_window, ONSITE_CONNECT_WINDOW_KEYS, ''),
    invoice_same_contact: invSame,
    invoice_company_confirmed: invCo,
    invoice_email_confirmed: invEmail,
    billing_contact_flag: billFlag,
    send_agreement: sendAgreement,
    deposit_on_call: depositOnCall,
    client_energy: clientEnergy,
    has_follow_ups: hasFollowUps,
    follow_up_date: followUpDate,
    follow_up_topics: followUpTopics,
    call_ended_at: callEndedAt,
    call_status: callStatus,
    close_artifact_tags: asCloseArtifactTagsArray(o.close_artifact_tags),
    suggested_outreach_status: suggestedOutreach,
    post_call_notes: String(o.post_call_notes ?? ''),
    future_intel: String(o.future_intel ?? ''),
    red_flags: String(o.red_flags ?? ''),
    onsite_contact_name: String(o.onsite_contact_name ?? ''),
    onsite_contact_phone: String(o.onsite_contact_phone ?? ''),
    onsite_contact_role: String(o.onsite_contact_role ?? ''),
    invoice_company_text: String(o.invoice_company_text ?? ''),
    invoice_email_text: String(o.invoice_email_text ?? ''),
    billing_contact_name: String(o.billing_contact_name ?? ''),
    billing_contact_email: String(o.billing_contact_email ?? ''),
    post_import_venue_id: typeof o.post_import_venue_id === 'string' && o.post_import_venue_id.trim()
      ? o.post_import_venue_id.trim()
      : null,
  }
  return finalizeVenuePostCaptures(parsed)
}

function finalizeVenuePostCaptures(v: BookingIntakeVenueDataV3): BookingIntakeVenueDataV3 {
  const out = { ...v }
  if (out.confirmed_contact !== 'no_different_person') {
    out.contact_mismatch_context = ''
    out.contact_mismatch_note = ''
  }
  if (out.onsite_same_contact !== 'different') {
    out.onsite_contact_name = ''
    out.onsite_contact_phone = ''
    out.onsite_contact_role = ''
    out.onsite_poc_role = ''
    out.onsite_connect_method = ''
    out.onsite_connect_window = ''
  } else {
    if (out.onsite_name_flag !== 'capture_later') out.onsite_contact_name = ''
    if (out.onsite_phone_flag !== 'capture_later') out.onsite_contact_phone = ''
    if (out.onsite_name_flag !== 'capture_later' && out.onsite_phone_flag !== 'capture_later') {
      out.onsite_contact_role = ''
    }
  }
  if (out.invoice_same_contact !== 'different') {
    out.invoice_company_text = ''
    out.invoice_email_text = ''
    out.billing_contact_name = ''
    out.billing_contact_email = ''
  } else {
    if (out.invoice_company_confirmed !== 'capture_later') out.invoice_company_text = ''
    if (out.invoice_email_confirmed !== 'capture_later') out.invoice_email_text = ''
    if (out.billing_contact_flag !== 'capture_later') {
      out.billing_contact_name = ''
      out.billing_contact_email = ''
    }
  }
  return out
}

function parsePhase1Enum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

function asVenueType(v: unknown): VenueType | '' {
  return typeof v === 'string' && (VENUE_TYPES as string[]).includes(v) ? (v as VenueType) : ''
}

function asKnownEventType(v: unknown): KnownEventTypeV3 | '' {
  const allowed: KnownEventTypeV3[] = [
    'after_party',
    'private_event',
    'club_night',
    'corporate',
    'wedding',
    'festival',
    'concert',
    'brand_activation',
    'other',
  ]
  return typeof v === 'string' && (allowed as string[]).includes(v) ? (v as KnownEventTypeV3) : ''
}

function asGenreArray(v: unknown): PerformanceGenreV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(PERFORMANCE_GENRE_VALUES as readonly string[])
  const out: PerformanceGenreV3[] = []
  for (const x of v) {
    if (typeof x === 'string' && allowed.has(x)) out.push(x as PerformanceGenreV3)
  }
  return out
}

function asPhase5DepositPercent(v: unknown): Phase5DepositPercentV3 {
  const n = Number(v)
  if (n === 25 || n === 50 || n === 75 || n === 100) return n
  return 50
}

function asAddonQuantitiesV3(v: unknown): Record<string, number> {
  if (!v || typeof v !== 'object') return {}
  const out: Record<string, number> = {}
  for (const [k, q] of Object.entries(v as Record<string, unknown>)) {
    const n = Number(q)
    if (k && Number.isFinite(n) && n > 0) out[k] = Math.min(99, Math.floor(n))
  }
  return out
}

function asStringIdList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.length > 0)
}

function asPaymentMethodsV3(v: unknown): PaymentMethodKeyV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(PAYMENT_METHOD_KEYS as readonly string[])
  const out: PaymentMethodKeyV3[] = []
  for (const x of v) {
    if (typeof x === 'string' && allowed.has(x)) out.push(x as PaymentMethodKeyV3)
  }
  return out
}

function asSetlistRequestTags(v: unknown): SetlistRequestTagV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(SETLIST_REQUEST_TAG_KEYS as readonly string[])
  return v.filter((x): x is SetlistRequestTagV3 => typeof x === 'string' && allowed.has(x as SetlistRequestTagV3))
}

function asEquipmentCapabilityIds(v: unknown): EquipmentCapabilityIdV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(EQUIPMENT_CAPABILITY_KEYS as readonly string[])
  return v.filter(
    (x): x is EquipmentCapabilityIdV3 => typeof x === 'string' && allowed.has(x as EquipmentCapabilityIdV3),
  )
}

function asLoadAccessTags(v: unknown): LoadAccessTagV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(LOAD_ACCESS_TAG_KEYS as readonly string[])
  return v.filter((x): x is LoadAccessTagV3 => typeof x === 'string' && allowed.has(x as LoadAccessTagV3))
}

function parseVenuePromiseLinesV3(raw: unknown): VenuePromiseLinesV3 {
  const base = emptyVenuePromiseLinesV3()
  if (!isPlainObject(raw)) return base
  const o = raw as Record<string, unknown>
  for (const p of SHOW_REPORT_PRESETS) {
    const v = o[p.id]
    const allowed = PROMISE_LINE_ALLOWED[p.id]
    if (typeof v === 'string' && allowed.has(v)) (base as Record<string, string>)[p.id] = v
  }
  return base
}

function parseVenuePromiseLinesAutoV3(raw: unknown): VenuePromiseLinesAutoV3 {
  const base = emptyVenuePromiseLinesAutoV3()
  if (!isPlainObject(raw)) return base
  const o = raw as Record<string, unknown>
  for (const p of SHOW_REPORT_PRESETS) {
    if (o[p.id] === true) (base as Record<string, boolean>)[p.id] = true
  }
  return base
}

function asCapacityRange(v: unknown): CapacityRangeV3 {
  const allowed: CapacityRangeV3[] = [
    '',
    'under_100',
    '100_300',
    '300_500',
    '500_1000',
    '1000_2000',
    '2000_5000',
    '5000_plus',
  ]
  return typeof v === 'string' && (allowed as string[]).includes(v as CapacityRangeV3) ? (v as CapacityRangeV3) : ''
}

export function parseShowDataV3(raw: unknown, sortIndex = 0): BookingIntakeShowDataV3 {
  const base = emptyShowDataV3(sortIndex)
  if (!isPlainObject(raw) || raw._v !== 3) return base
  const o = raw as Record<string, unknown>
  const start = typeof o.event_start_time === 'string' ? o.event_start_time : base.event_start_time
  const end = typeof o.event_end_time === 'string' ? o.event_end_time : base.event_end_time
  const overnight =
    typeof o.overnight_event === 'boolean' ? o.overnight_event : computeOvernightEvent(start, end)
  const color =
    typeof o.color === 'string' && /^#[0-9A-Fa-f]{6}$/.test(o.color) ? o.color : base.color
  const setStart = typeof o.set_start_time === 'string' ? o.set_start_time : base.set_start_time
  const setEnd = typeof o.set_end_time === 'string' ? o.set_end_time : base.set_end_time
  const overnightSet =
    typeof o.overnight_set === 'boolean' ? o.overnight_set : computeOvernightEvent(setStart, setEnd)
  const parsed: BookingIntakeShowDataV3 = {
    ...base,
    color,
    event_type: asKnownEventType(o.event_type),
    venue_type: asVenueType(o.venue_type),
    setting: parsePhase1Enum(o.setting, ['', 'indoor', 'outdoor', 'both'], ''),
    event_archetype: parsePhase1Enum(o.event_archetype, EVENT_ARCHETYPE_KEYS, ''),
    event_name_flag: parsePhase1Enum(o.event_name_flag, ['', 'capture_later', 'no_name_yet'], ''),
    event_date: typeof o.event_date === 'string' ? o.event_date : '',
    event_start_time: start,
    event_end_time: end,
    overnight_event: overnight,
    venue_name_flag: parsePhase1Enum(
      o.venue_name_flag,
      ['', 'already_have', 'capture_later', 'tbd'],
      '',
    ),
    city_flag: parsePhase1Enum(o.city_flag, ['', 'already_have', 'capture_later', 'tbd'], ''),
    state_region: typeof o.state_region === 'string' ? o.state_region : '',
    address_status: parsePhase1Enum(
      o.address_status,
      ['', 'have_it', 'theyll_send', 'tbd_private'],
      '',
    ),
    venue_archetype: parsePhase1Enum(o.venue_archetype, VENUE_ARCHETYPE_KEYS, ''),
    address_detail_level: parsePhase1Enum(o.address_detail_level, ADDRESS_DETAIL_LEVEL_KEYS, ''),
    capacity_range: asCapacityRange(o.capacity_range),
    exact_capacity_flag: parsePhase1Enum(o.exact_capacity_flag, ['', 'capture_later', 'range_ok'], ''),
    approximate_headcount: (() => {
      const n = Number(o.approximate_headcount)
      return Number.isFinite(n) && n >= 0 && n <= 500_000 ? Math.round(n) : 0
    })(),
    performance_role: parsePhase1Enum(
      o.performance_role,
      ['', 'headliner', 'opener', 'support_mid', 'solo_only', 'resident_regular', 'guest_set'],
      '',
    ),
    set_start_time: setStart,
    set_end_time: setEnd,
    overnight_set: overnightSet,
    genres: asGenreArray(o.genres),
    custom_setlist: parsePhase1Enum(
      o.custom_setlist,
      ['', 'djs_call', 'specific_requests'],
      '',
    ),
    setlist_request_tags: asSetlistRequestTags(o.setlist_request_tags),
    music_requests_flag: parsePhase1Enum(o.music_requests_flag, ['', 'none', 'capture_later'], ''),
    music_delivery: parsePhase1Enum(o.music_delivery, MUSIC_DELIVERY_KEYS, ''),
    other_performers: parsePhase1Enum(
      o.other_performers,
      ['', 'solo_act', 'multiple_performers'],
      '',
    ),
    num_other_acts: '',
    billing_priority: '',
    lineup_format: parsePhase1Enum(o.lineup_format, LINEUP_FORMAT_KEYS, ''),
    equipment_provider: parsePhase1Enum(
      o.equipment_provider,
      ['', 'venue_provides', 'dj_brings', 'hybrid'],
      '',
    ),
    equipment_details_flag: parsePhase1Enum(
      o.equipment_details_flag,
      ['', 'full_confirmed', 'capture_later', 'not_discussed'],
      '',
    ),
    equipment_capability_ids: asEquipmentCapabilityIds(o.equipment_capability_ids),
    load_in_discussed: parsePhase1Enum(o.load_in_discussed, ['', 'yes', 'tbd'], ''),
    load_in_time: typeof o.load_in_time === 'string' ? o.load_in_time : '',
    soundcheck: parsePhase1Enum(o.soundcheck, ['', 'yes', 'no', 'not_discussed'], ''),
    load_in_access_tags: asLoadAccessTags(o.load_in_access_tags),
    parking_status: parsePhase1Enum(
      o.parking_status,
      ['', 'confirmed', 'need_confirm', 'not_discussed'],
      '',
    ),
    parking_details_flag: parsePhase1Enum(
      o.parking_details_flag,
      ['', 'capture_later', 'no'],
      '',
    ),
    parking_access_class: parsePhase1Enum(o.parking_access_class, PARKING_ACCESS_CLASS_KEYS, ''),
    travel_required: parsePhase1Enum(
      o.travel_required,
      ['', 'local', 'regional', 'flight'],
      '',
    ),
    lodging_status: parsePhase1Enum(
      o.lodging_status,
      ['', 'not_needed', 'venue_provides', 'dj_covers', 'not_discussed'],
      '',
    ),
    travel_notes_flag: parsePhase1Enum(o.travel_notes_flag, ['', 'capture_later', 'no'], ''),
    travel_booked_by: parsePhase1Enum(o.travel_booked_by, TRAVEL_BOOKED_BY_KEYS, ''),
    ground_transport: parsePhase1Enum(o.ground_transport, GROUND_TRANSPORT_KEYS, ''),
    pricing_mode: parsePhase1Enum(o.pricing_mode, ['', 'package', 'hourly'], 'hourly'),
    package_id: typeof o.package_id === 'string' ? o.package_id : '',
    service_id: typeof o.service_id === 'string' ? o.service_id : '',
    overtime_service_id: typeof o.overtime_service_id === 'string' ? o.overtime_service_id : '',
    performance_hours: typeof o.performance_hours === 'number' && Number.isFinite(o.performance_hours) ? o.performance_hours : 0,
    addon_quantities: asAddonQuantitiesV3(o.addon_quantities),
    surcharge_ids: asStringIdList(o.surcharge_ids),
    discount_ids: asStringIdList(o.discount_ids),
    pricing_source: parsePhase1Enum(o.pricing_source, ['', 'calculated', 'manual'], 'calculated'),
    manual_gross:
      typeof o.manual_gross === 'number' && Number.isFinite(o.manual_gross) && o.manual_gross >= 0
        ? o.manual_gross
        : null,
    manual_pricing_reason: parsePhase1Enum(o.manual_pricing_reason, MANUAL_PRICING_REASON_KEYS, ''),
    deposit_percent: asPhase5DepositPercent(o.deposit_percent),
    balance_timing: parsePhase1Enum(
      o.balance_timing,
      ['', 'before_event', 'day_of', 'after_event', 'custom'],
      'before_event',
    ),
    balance_due_date: typeof o.balance_due_date === 'string' ? o.balance_due_date : '',
    payment_methods: asPaymentMethodsV3(o.payment_methods),
    promise_lines_v3: parseVenuePromiseLinesV3(o.promise_lines_v3),
    promise_lines_auto: parseVenuePromiseLinesAutoV3(o.promise_lines_auto),
    event_name_text: typeof o.event_name_text === 'string' ? o.event_name_text : '',
    venue_name_text: typeof o.venue_name_text === 'string' ? o.venue_name_text : '',
    city_text: typeof o.city_text === 'string' ? o.city_text : '',
    street_address: typeof o.street_address === 'string' ? o.street_address : '',
    address_line2: typeof o.address_line2 === 'string' ? o.address_line2 : '',
    postal_code: typeof o.postal_code === 'string' ? o.postal_code : '',
    exact_capacity_number: typeof o.exact_capacity_number === 'string' ? o.exact_capacity_number : '',
    music_requests_text: typeof o.music_requests_text === 'string' ? o.music_requests_text : '',
    custom_setlist_notes: typeof o.custom_setlist_notes === 'string' ? o.custom_setlist_notes : '',
    equipment_details_text: typeof o.equipment_details_text === 'string' ? o.equipment_details_text : '',
    parking_details_text: typeof o.parking_details_text === 'string' ? o.parking_details_text : '',
    travel_notes_text: typeof o.travel_notes_text === 'string' ? o.travel_notes_text : '',
  }
  const op = parsed.other_performers
  parsed.num_other_acts =
    op === 'multiple_performers'
      ? parsePhase1Enum(o.num_other_acts, ['', '1', '2', '3', '4plus'], '')
      : ''
  parsed.billing_priority =
    op === 'multiple_performers'
      ? parsePhase1Enum(
          o.billing_priority,
          ['', 'top_billing', 'co_headliner', 'supporting_act'],
          '',
        )
      : ''
  if (parsed.load_in_discussed !== 'yes') parsed.load_in_time = ''
  if (parsed.travel_required === 'local') {
    parsed.lodging_status = ''
    parsed.travel_notes_flag = ''
    parsed.travel_booked_by = ''
    parsed.ground_transport = ''
  }
  if (parsed.balance_timing !== 'custom') parsed.balance_due_date = ''
  if (parsed.pricing_source !== 'manual') {
    parsed.manual_gross = null
    parsed.manual_pricing_reason = ''
  }
  if (!parsed.overtime_service_id.trim() && parsed.service_id.trim()) {
    parsed.overtime_service_id = parsed.service_id
  }
  return finalizeShowPostCaptures(parsed)
}

export function finalizeShowPostCaptures(sd: BookingIntakeShowDataV3): BookingIntakeShowDataV3 {
  const out = { ...sd }
  if (out.event_name_flag !== 'capture_later') out.event_name_text = ''
  if (out.venue_name_flag !== 'capture_later' && out.venue_name_flag !== 'tbd') out.venue_name_text = ''
  if (out.city_flag !== 'capture_later' && out.city_flag !== 'tbd') out.city_text = ''
  if (!out.address_status) {
    out.street_address = ''
    out.address_line2 = ''
    out.postal_code = ''
  }
  if (out.exact_capacity_flag !== 'capture_later') out.exact_capacity_number = ''
  if (out.music_requests_flag !== 'capture_later') out.music_requests_text = ''
  if (out.custom_setlist !== 'specific_requests') out.custom_setlist_notes = ''
  if (out.equipment_details_flag !== 'capture_later') out.equipment_details_text = ''
  if (out.parking_details_flag !== 'capture_later') out.parking_details_text = ''
  if (out.travel_notes_flag !== 'capture_later' || out.travel_required === 'local') {
    out.travel_notes_text = ''
  }
  if (out.pricing_source !== 'manual') out.manual_pricing_reason = ''
  if (out.travel_required === 'local') {
    out.travel_booked_by = ''
    out.ground_transport = ''
  }
  return out
}

/** Human lines for deal/venue notes — structured fields captured on the live call. */
export function substantiveShowCaptureLines(sd: BookingIntakeShowDataV3): string[] {
  const lines: string[] = []
  if (sd.event_archetype) {
    lines.push(`Event format: ${EVENT_ARCHETYPE_LABELS[sd.event_archetype as Exclude<EventArchetypeV3, ''>]}`)
  }
  if (sd.venue_archetype) {
    lines.push(`Venue type (discussed): ${VENUE_ARCHETYPE_LABELS[sd.venue_archetype as Exclude<VenueArchetypeV3, ''>]}`)
  }
  if (sd.address_detail_level) {
    lines.push(
      `Location detail: ${ADDRESS_DETAIL_LEVEL_LABELS[sd.address_detail_level as Exclude<AddressDetailLevelV3, ''>]}`,
    )
  }
  if (sd.approximate_headcount > 0) {
    lines.push(`Approx. headcount (discussed): ~${sd.approximate_headcount.toLocaleString()}`)
  }
  if (sd.setlist_request_tags.length) {
    lines.push(
      `Music / setlist: ${sd.setlist_request_tags.map(t => SETLIST_REQUEST_TAG_LABELS[t]).join('; ')}`,
    )
  }
  if (sd.music_delivery) {
    lines.push(`Request delivery: ${MUSIC_DELIVERY_LABELS[sd.music_delivery as Exclude<MusicDeliveryV3, ''>]}`)
  }
  if (sd.lineup_format) {
    lines.push(`Lineup: ${LINEUP_FORMAT_LABELS[sd.lineup_format as Exclude<LineupFormatV3, ''>]}`)
  }
  if (sd.equipment_capability_ids.length) {
    lines.push(
      `Equipment discussed: ${sd.equipment_capability_ids.map(id => EQUIPMENT_CAPABILITY_LABELS[id]).join('; ')}`,
    )
  }
  if (sd.load_in_access_tags.length) {
    lines.push(`Load-in access: ${sd.load_in_access_tags.map(t => LOAD_ACCESS_TAG_LABELS[t]).join('; ')}`)
  }
  if (sd.parking_access_class) {
    lines.push(
      `Parking (class): ${PARKING_ACCESS_CLASS_LABELS[sd.parking_access_class as Exclude<ParkingAccessClassV3, ''>]}`,
    )
  }
  if (sd.travel_booked_by) {
    lines.push(
      `Travel booking: ${TRAVEL_BOOKED_BY_LABELS[sd.travel_booked_by as Exclude<TravelBookedByV3, ''>]}`,
    )
  }
  if (sd.ground_transport) {
    lines.push(
      `Ground transport: ${GROUND_TRANSPORT_LABELS[sd.ground_transport as Exclude<GroundTransportV3, ''>]}`,
    )
  }
  if (sd.pricing_source === 'manual' && sd.manual_pricing_reason) {
    lines.push(
      `Manual price reason: ${MANUAL_PRICING_REASON_LABELS[sd.manual_pricing_reason as Exclude<ManualPricingReasonV3, ''>]}`,
    )
  }
  return lines.filter(Boolean)
}

export function substantiveVenueCaptureLines(v: BookingIntakeVenueDataV3): string[] {
  const lines: string[] = []
  if (v.confirmed_contact === 'no_different_person') {
    const name = v.contact_mismatch_note.trim()
    const roleKey = v.contact_mismatch_context
    const role =
      roleKey ? CONTACT_MISMATCH_CONTEXT_LABELS[roleKey as Exclude<Phase1ContactMismatchContextV3, ''>] : ''
    if (name && role) lines.push(`On-call: ${name} (${role})`)
    else if (name) lines.push(`On-call name: ${name}`)
    else if (role) lines.push(`On-call role: ${role}`)
  }
  if (v.call_vibe) {
    lines.push(`Call energy: ${CALL_VIBE_LABELS[v.call_vibe as Exclude<Phase1CallVibeV3, ''>]}`)
  }
  if (v.preferred_email_channel) {
    lines.push(
      `Email preference: ${PREFERRED_EMAIL_CHANNEL_LABELS[v.preferred_email_channel as Exclude<Phase1PreferredEmailChannelV3, ''>]}`,
    )
  }
  if (v.onsite_same_contact === 'different') {
    if (v.onsite_poc_role) {
      lines.push(
        `On-site role: ${ONSITE_POC_ROLE_LABELS[v.onsite_poc_role as Exclude<OnsitePocRoleV3, ''>]}`,
      )
    }
    if (v.onsite_connect_method) {
      lines.push(
        `On-site reach: ${ONSITE_CONNECT_METHOD_LABELS[v.onsite_connect_method as Exclude<OnsiteConnectMethodV3, ''>]}`,
      )
    }
    if (v.onsite_connect_window) {
      lines.push(
        `Best window: ${ONSITE_CONNECT_WINDOW_LABELS[v.onsite_connect_window as Exclude<OnsiteConnectWindowV3, ''>]}`,
      )
    }
  }
  if (v.close_artifact_tags.length) {
    lines.push(`Close plan: ${v.close_artifact_tags.map(t => CLOSE_ARTIFACT_TAG_LABELS[t]).join('; ')}`)
  }
  return lines.filter(Boolean)
}

export function withShowTimes(
  d: BookingIntakeShowDataV3,
  start: string,
  end: string,
): BookingIntakeShowDataV3 {
  return {
    ...d,
    event_start_time: start,
    event_end_time: end,
    overnight_event: computeOvernightEvent(start, end),
  }
}

export function defaultIntakeTitleV3(contactName: string): string {
  const n = contactName.trim()
  return n ? `${n} — Booking Intake` : 'Booking Intake'
}

/** Commission tier rules when linking an existing venue (spec9.4). */
export async function suggestedCommissionTierForVenue(
  venue: { id: string; outreach_track: OutreachTrack },
  countDealsForVenue: (venueId: string) => Promise<number>,
): Promise<CommissionTier> {
  if (venue.outreach_track === 'community') return 'artist_network'
  const n = await countDealsForVenue(venue.id)
  if (n === 0) return 'new_doors'
  return 'kept_doors'
}
