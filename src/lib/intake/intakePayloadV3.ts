import type { CommissionTier, OutreachTrack, PricingAddon, PricingCatalogDoc, PricingPackage, VenueType } from '@/types'
import { VENUE_TYPE_LABELS, VENUE_TYPE_ORDER } from '@/types'
import { SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'
import { applyGearIntakeNormalization, intakeShowsGearVerification } from '@/lib/gear/gearIntakeDerived'
import { GEAR_MODEL_OTHER_ID, getDeckById, getMixerById } from '@/lib/gear/djGearCatalog'
import {
  CONTACT_MISMATCH_CONTEXT_KEYS,
  CONTACT_MISMATCH_CONTEXT_LABELS,
  type Phase1ContactMismatchContextV3,
} from './contactMismatchCatalog'
import { CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'

export {
  CONTACT_MISMATCH_CONTEXT_KEYS,
  type Phase1ContactMismatchContextV3,
  CONTACT_MISMATCH_CONTEXT_LABELS,
  CONTACT_MISMATCH_ROLE_ORDER,
} from './contactMismatchCatalog'

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

/** Phase 2 — per show (booking_intake_shows.show_data). Indoor/outdoor + common floor levels. */
export type Phase2SettingV3 =
  | ''
  | 'indoor'
  | 'outdoor'
  | 'floor_1'
  | 'floor_2'
  | 'floor_3'
  | 'both'
  | 'other'

export const PHASE2_SETTING_LABELS: Record<Exclude<Phase2SettingV3, ''>, string> = {
  indoor: 'Indoor',
  outdoor: 'Outdoor',
  floor_1: 'First floor',
  floor_2: 'Second floor',
  floor_3: 'Third floor',
  both: 'Both',
  other: 'Other (describe)',
}

const PHASE2_SETTING_PARSE_KEYS: Phase2SettingV3[] = [
  '',
  'indoor',
  'outdoor',
  'floor_1',
  'floor_2',
  'floor_3',
  'both',
  'other',
]

/** Live 2A Setting dropdown order. */
export const PHASE2_SETTING_OPTIONS_ORDER: Exclude<Phase2SettingV3, ''>[] = [
  'indoor',
  'outdoor',
  'floor_1',
  'floor_2',
  'floor_3',
  'both',
  'other',
]

export const PHASE2_SETTING_OPTIONS: { value: Exclude<Phase2SettingV3, ''>; label: string }[] =
  PHASE2_SETTING_OPTIONS_ORDER.map(value => ({ value, label: PHASE2_SETTING_LABELS[value] }))
export type Phase2EventNameFlagV3 = '' | 'capture_later' | 'no_name_yet' | 'other'
export type Phase2VenueNameFlagV3 = '' | 'already_have' | 'capture_later' | 'tbd'
export type Phase2CityFlagV3 = '' | 'already_have' | 'capture_later' | 'tbd'
export type Phase2AddressStatusV3 = '' | 'have_it' | 'theyll_send' | 'tbd_private'
export type Phase2ExactCapacityFlagV3 = '' | 'capture_later' | 'range_ok'

/** Phase 2A — one-off vs recurring (replaces legacy “event format” dropdown in live UI). */
export type Phase2EventScheduleV3 = '' | 'one_off' | 'recurring'
export type Phase2RecurrenceIntervalV3 = '' | 'weekly' | 'biweekly' | 'monthly'

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

export const PHASE3_OTHER_PERFORMERS_LABELS: Record<Exclude<Phase3OtherPerformersV3, ''>, string> = {
  solo_act: 'Bill: solo act',
  multiple_performers: 'Bill: multiple performers / shared lineup',
}

export const PHASE3_NUM_OTHER_ACTS_LABELS: Record<Exclude<Phase3NumOtherActsV3, ''>, string> = {
  '1': 'Other acts on bill: 1',
  '2': 'Other acts on bill: 2',
  '3': 'Other acts on bill: 3',
  '4plus': 'Other acts on bill: 4+',
}

export const PHASE3_BILLING_PRIORITY_LABELS: Record<Exclude<Phase3BillingPriorityV3, ''>, string> = {
  top_billing: 'Billing priority: top billing',
  co_headliner: 'Billing priority: co-headliner',
  supporting_act: 'Billing priority: supporting act',
}

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

export const PHASE4_PARKING_STATUS_LABELS: Record<Exclude<Phase4ParkingStatusV3, ''>, string> = {
  confirmed: 'Parking status: confirmed',
  need_confirm: 'Parking status: needs confirmation',
  not_discussed: 'Parking status: not discussed',
}

export const PHASE4_LODGING_STATUS_LABELS: Record<Exclude<Phase4LodgingStatusV3, ''>, string> = {
  not_needed: 'Lodging: not needed',
  venue_provides: 'Lodging: venue provides',
  dj_covers: 'Lodging: artist covers',
  not_discussed: 'Lodging: not discussed',
}

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

export const PHASE5_INVOICE_SAME_LABELS: Record<Exclude<Phase5InvoiceSameContactV3, ''>, string> = {
  yes: 'Invoicing: same as main contact',
  different: 'Invoicing: different billing contact',
}

export const PHASE5_INVOICE_CONFIRM_LABELS: Record<Exclude<Phase5InvoiceConfirmV3, ''>, string> = {
  correct: 'Invoice company/email: confirmed',
  capture_later: 'Invoice company/email: capture later',
}

export const PHASE5_BILLING_FLAG_LABELS: Record<Exclude<Phase5BillingContactFlagV3, ''>, string> = {
  same_main: 'Billing contact: same as main',
  capture_later: 'Billing contact: capture later',
}

/** Phase 7 — Close (shared on `venue_data`). */
export type Phase7SendAgreementV3 = '' | 'yes_sending' | 'invoice_only' | 'verbal_only'
export type Phase7DepositOnCallV3 = '' | 'paying_now' | 'sending_invoice'
export type Phase7ClientEnergyV3 = '' | 'very_excited' | 'positive' | 'neutral' | 'uncertain'
export type Phase7HasFollowUpsV3 = '' | 'yes' | 'all_clear'
export type Phase7CallStatusV3 = '' | 'full' | 'partial' | 'voicemail'

export const PHASE7_SEND_AGREEMENT_LABELS: Record<Exclude<Phase7SendAgreementV3, ''>, string> = {
  yes_sending: 'Sending agreement + invoice',
  invoice_only: 'Invoice only (no full agreement pack)',
  verbal_only: 'Verbal close — paperwork to follow',
}

export const PHASE7_DEPOSIT_ON_CALL_LABELS: Record<Exclude<Phase7DepositOnCallV3, ''>, string> = {
  paying_now: 'Deposit collected / paying on the call',
  sending_invoice: 'Deposit via invoice',
}

export const PHASE7_CLIENT_ENERGY_LABELS: Record<Exclude<Phase7ClientEnergyV3, ''>, string> = {
  very_excited: 'Client energy: very excited',
  positive: 'Client energy: positive',
  neutral: 'Client energy: neutral',
  uncertain: 'Client energy: uncertain / hesitant',
}

export const PHASE7_HAS_FOLLOW_UPS_LABELS: Record<Exclude<Phase7HasFollowUpsV3, ''>, string> = {
  yes: 'Follow-ups still open',
  all_clear: 'No open follow-ups discussed',
}

export const PHASE7_CALL_STATUS_LABELS: Record<Exclude<Phase7CallStatusV3, ''>, string> = {
  full: 'Call status: full conversation',
  partial: 'Call status: partial — needs follow-up',
  voicemail: 'Call status: voicemail / async',
}

export const INQUIRY_SOURCE_LABELS: Record<Exclude<InquirySourceV3, ''>, string> = {
  instagram_dm: 'Instagram DM',
  email: 'Email',
  phone_text: 'Phone / text',
  referral: 'Referral',
  website: 'Website',
  radio: 'Radio',
  other: 'Other source',
}

export const PHASE1_PHONE_CONFIRMED_LABELS: Record<Exclude<Phase1PhoneConfirmedV3, ''>, string> = {
  confirmed: 'Phone: confirmed on file',
  update_needed: 'Phone: update needed',
}

export const PHASE1_EMAIL_CONFIRMED_LABELS: Record<Exclude<Phase1EmailConfirmedV3, ''>, string> = {
  confirmed: 'Email: confirmed on file',
  update_needed: 'Email: update needed',
  need_to_get: 'Email: still need address',
}

export const PHASE1_COMPANY_CONFIRMED_LABELS: Record<Exclude<Phase1CompanyConfirmedV3, ''>, string> = {
  confirmed: 'Company / org: confirmed',
  update_needed: 'Company / org: update needed',
}

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

/** Phase 4A — gear chips (multi-select) + presets in live UI. */
export const EQUIPMENT_CAPABILITY_KEYS = [
  'cdjs_x2',
  'cdjs_x3_plus',
  'dj_mixer_club_standard',
  'dj_mixer_rotary',
  'dj_controller',
  'turntables_vinyl',
  'laptop',
  'main_pa_speakers',
  'main_pa_speakers_production',
  'subwoofers',
  'subwoofers_production',
  'subwoofer_portable',
  'portable_pa_speakers',
  'booth_monitor',
  'dj_brings_own_booth_monitor',
  'floor_monitors',
  'wired_mic',
  'wired_mic_backup_speeches',
  'wireless_mic',
  'stage_lighting',
  'led_moving_lights',
  'basic_lighting_uplights',
  'fog_haze_machine',
  'cold_sparks',
  'co2_jets',
  'laser_effects',
  'folding_dj_table',
  'branded_dj_booth_facade',
  'power_needs_confirmed',
  'power_generator_extension',
  'all_cables_adapters',
  'house_sound_tech_onsite',
  'dj_brings_own_tech',
  'backup_usb_media',
  'other_capture_in_notes',
] as const

export type EquipmentCapabilityIdV3 = (typeof EQUIPMENT_CAPABILITY_KEYS)[number]

export const EQUIPMENT_CAPABILITY_LABELS: Record<EquipmentCapabilityIdV3, string> = {
  cdjs_x2: 'CDJs (x2)',
  cdjs_x3_plus: 'CDJs (x3+)',
  dj_mixer_club_standard: 'DJ Mixer (Club Standard)',
  dj_mixer_rotary: 'DJ Mixer (Rotary)',
  dj_controller: 'DJ Controller',
  turntables_vinyl: 'Turntables (Vinyl)',
  laptop: 'Laptop',
  main_pa_speakers: 'Main PA Speakers',
  main_pa_speakers_production: 'Main PA Speakers (Production Company)',
  subwoofers: 'Subwoofers',
  subwoofers_production: 'Subwoofers (Production Company)',
  subwoofer_portable: 'Subwoofer (Portable)',
  portable_pa_speakers: 'Portable PA Speakers',
  booth_monitor: 'Booth Monitor',
  dj_brings_own_booth_monitor: 'DJ Brings Own Booth Monitor',
  floor_monitors: 'Floor Monitors',
  wired_mic: 'Wired Mic',
  wired_mic_backup_speeches: 'Wired Mic (Backup / Speeches)',
  wireless_mic: 'Wireless Mic',
  stage_lighting: 'Stage Lighting',
  led_moving_lights: 'LED / Moving Lights',
  basic_lighting_uplights: 'Basic Lighting (LED Uplights)',
  fog_haze_machine: 'Fog / Haze Machine',
  cold_sparks: 'Cold Sparks',
  co2_jets: 'CO2 Jets',
  laser_effects: 'Laser Effects',
  folding_dj_table: 'Folding DJ Table',
  branded_dj_booth_facade: 'Branded DJ Booth / Facade',
  power_needs_confirmed: 'Power Needs Confirmed',
  power_generator_extension: 'Power Generator / Extension',
  all_cables_adapters: 'All Cables & Adapters',
  house_sound_tech_onsite: 'House Sound Tech On Site',
  dj_brings_own_tech: 'DJ Brings Own Tech',
  backup_usb_media: 'Backup USB / Media',
  other_capture_in_notes: 'Other — Capture in Notes',
}

/** Grouped gear list for Phase 4A UI. */
export const EQUIPMENT_GEAR_GROUPS: { title: string; ids: readonly EquipmentCapabilityIdV3[] }[] = [
  {
    title: 'Decks & mixers',
    ids: [
      'cdjs_x2',
      'cdjs_x3_plus',
      'dj_mixer_club_standard',
      'dj_mixer_rotary',
      'dj_controller',
      'turntables_vinyl',
      'laptop',
    ],
  },
  {
    title: 'Sound / PA',
    ids: [
      'main_pa_speakers',
      'main_pa_speakers_production',
      'subwoofers',
      'subwoofers_production',
      'subwoofer_portable',
      'portable_pa_speakers',
      'booth_monitor',
      'dj_brings_own_booth_monitor',
      'floor_monitors',
    ],
  },
  {
    title: 'Microphones',
    ids: ['wired_mic', 'wired_mic_backup_speeches', 'wireless_mic'],
  },
  {
    title: 'Lighting & effects',
    ids: [
      'stage_lighting',
      'led_moving_lights',
      'basic_lighting_uplights',
      'fog_haze_machine',
      'cold_sparks',
      'co2_jets',
      'laser_effects',
    ],
  },
  {
    title: 'Booth & furniture',
    ids: ['folding_dj_table', 'branded_dj_booth_facade'],
  },
  {
    title: 'Power & infrastructure',
    ids: ['power_needs_confirmed', 'power_generator_extension', 'all_cables_adapters'],
  },
  {
    title: 'People',
    ids: ['house_sound_tech_onsite', 'dj_brings_own_tech'],
  },
  {
    title: 'Backup',
    ids: ['backup_usb_media'],
  },
  {
    title: 'Other',
    ids: ['other_capture_in_notes'],
  },
]

export type EquipmentPresetV3 = {
  id: string
  label: string
  capabilities: readonly EquipmentCapabilityIdV3[]
}

/** Tap a preset to replace the gear chip selection (operator can edit after). */
export const EQUIPMENT_PRESETS: readonly EquipmentPresetV3[] = [
  {
    id: 'full_club_industry',
    label: 'Full Club · Industry standard',
    capabilities: [
      'cdjs_x2',
      'dj_mixer_club_standard',
      'main_pa_speakers',
      'subwoofers',
      'booth_monitor',
      'wired_mic',
      'house_sound_tech_onsite',
      'stage_lighting',
    ],
  },
  {
    id: 'premium_club',
    label: 'Premium Club',
    capabilities: [
      'cdjs_x2',
      'dj_mixer_club_standard',
      'main_pa_speakers',
      'subwoofers',
      'booth_monitor',
      'floor_monitors',
      'wireless_mic',
      'house_sound_tech_onsite',
      'stage_lighting',
      'led_moving_lights',
      'fog_haze_machine',
    ],
  },
  {
    id: 'luijay_full_kit',
    label: 'Luijay · Full kit',
    capabilities: [
      'dj_controller',
      'laptop',
      'portable_pa_speakers',
      'subwoofer_portable',
      'wireless_mic',
      'dj_brings_own_booth_monitor',
      'all_cables_adapters',
      'backup_usb_media',
      'power_needs_confirmed',
    ],
  },
  {
    id: 'luijay_essentials',
    label: 'Luijay · Essentials (controller)',
    capabilities: [
      'dj_controller',
      'laptop',
      'main_pa_speakers',
      'subwoofers',
      'booth_monitor',
      'all_cables_adapters',
      'backup_usb_media',
    ],
  },
  {
    id: 'private_backyard_warehouse',
    label: 'Private / Backyard / Warehouse',
    capabilities: [
      'portable_pa_speakers',
      'subwoofer_portable',
      'dj_controller',
      'laptop',
      'wireless_mic',
      'folding_dj_table',
      'power_generator_extension',
      'all_cables_adapters',
      'backup_usb_media',
      'basic_lighting_uplights',
    ],
  },
  {
    id: 'festival_outdoor',
    label: 'Festival / Outdoor stage',
    capabilities: [
      'cdjs_x2',
      'dj_mixer_club_standard',
      'main_pa_speakers_production',
      'subwoofers_production',
      'floor_monitors',
      'booth_monitor',
      'wireless_mic',
      'house_sound_tech_onsite',
      'stage_lighting',
      'led_moving_lights',
      'fog_haze_machine',
      'power_needs_confirmed',
    ],
  },
  {
    id: 'corporate_brand',
    label: 'Corporate / Brand activation',
    capabilities: [
      'dj_controller',
      'laptop',
      'portable_pa_speakers',
      'booth_monitor',
      'wireless_mic',
      'branded_dj_booth_facade',
      'basic_lighting_uplights',
      'all_cables_adapters',
      'backup_usb_media',
      'power_needs_confirmed',
    ],
  },
  {
    id: 'wedding_formal',
    label: 'Wedding / Formal',
    capabilities: [
      'dj_controller',
      'laptop',
      'portable_pa_speakers',
      'subwoofer_portable',
      'wireless_mic',
      'wired_mic_backup_speeches',
      'folding_dj_table',
      'branded_dj_booth_facade',
      'basic_lighting_uplights',
      'all_cables_adapters',
      'backup_usb_media',
      'power_needs_confirmed',
    ],
  },
  {
    id: 'hybrid_venue_pa_dj_decks',
    label: 'Hybrid · Venue PA + DJ decks',
    capabilities: [
      'dj_controller',
      'laptop',
      'main_pa_speakers',
      'subwoofers',
      'booth_monitor',
      'wired_mic',
      'all_cables_adapters',
      'backup_usb_media',
    ],
  },
]

export function equipmentSetsEqual(
  a: readonly EquipmentCapabilityIdV3[],
  b: readonly EquipmentCapabilityIdV3[],
): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false
  }
  return true
}

/** 0 = legacy flat gear chips only; 2 = structured equipment card flow. */
export type EquipmentIntakeFlowVersionV3 = 0 | 2

export type EquipmentMicV3 = '' | 'venue_has_mic' | 'dj_brings_mic' | 'not_discussed'

export type EquipmentSoundTechV3 = '' | 'yes' | 'no' | 'not_discussed'

/** Gear verification — venue / hybrid only (§4A extension). */
export type VenueDeckTypeV3 = '' | 'cdj' | 'controller' | 'turntable' | 'all_in_one' | 'not_sure'

export type VenueMixerBrandV3 =
  | ''
  | 'pioneer_djm'
  | 'rane'
  | 'allen_heath'
  | 'built_in'
  | 'not_sure'
  | 'other'

export type VenueBoothMonitorV3 = '' | 'yes' | 'no' | 'not_sure'

export type VenueLaptopConnectionV3 =
  | ''
  | 'usb_b_mixer'
  | 'usb_drives_only'
  | 'audio_interface'
  | 'other'
  | 'not_sure'

export type VenueUsbFormatV3 = '' | 'fat32' | 'exfat' | 'not_sure'

export type VenueProDjLinkV3 = '' | 'yes' | 'no' | 'not_sure' | 'standalone_usb'

export type VenueSoftwareV3 = '' | 'rekordbox' | 'serato' | 'traktor' | 'engine_dj' | 'not_sure'

export type TechSetupAccessV3 = '' | 'before_doors' | 'during_event' | 'no_soundcheck'

export type GearTechCallStepV3 = '' | 'T1' | 'T2' | 'T3' | 'T4' | 'T5'

export type EquipmentDjPackageInterestV3 = '' | 'yes_walkthrough' | 'no_simple' | 'think_later'

export type EquipmentHybridAdditionsV3 = '' | 'yeah_see' | 'no_good' | 'maybe_later'

export const EQUIPMENT_DJ_PACKAGE_INTEREST_LABELS: Record<Exclude<EquipmentDjPackageInterestV3, ''>, string> = {
  yes_walkthrough: 'Production / walk-through package: interested',
  no_simple: 'Production package: keeping it simple',
  think_later: 'Production package: revisit later',
}

export const EQUIPMENT_HYBRID_ADDITIONS_LABELS: Record<Exclude<EquipmentHybridAdditionsV3, ''>, string> = {
  yeah_see: 'Hybrid add-ons: open to more',
  no_good: 'Hybrid add-ons: not pursuing',
  maybe_later: 'Hybrid add-ons: maybe later',
}

export const EQUIPMENT_VENUE_INCLUDES_KEYS = [
  'full_sound',
  'booth_monitor',
  'stage_lighting',
  'led_moving',
  'fog_haze',
  'not_sure_confirm',
] as const

export type EquipmentVenueIncludesIdV3 = (typeof EQUIPMENT_VENUE_INCLUDES_KEYS)[number]

export const EQUIPMENT_VENUE_INCLUDES_LABELS: Record<EquipmentVenueIncludesIdV3, string> = {
  full_sound: 'Full Sound System',
  booth_monitor: 'Booth Monitor',
  stage_lighting: 'Stage Lighting',
  led_moving: 'LED / Moving Lights',
  fog_haze: 'Fog / Haze',
  not_sure_confirm: 'Not sure — will confirm',
}

export const EQUIPMENT_HYBRID_COVER_KEYS = [
  'sound_system',
  'booth_monitor',
  'lighting',
  'mic',
  'not_sure_confirm',
] as const

export type EquipmentHybridCoverIdV3 = (typeof EQUIPMENT_HYBRID_COVER_KEYS)[number]

export const EQUIPMENT_HYBRID_COVER_LABELS: Record<EquipmentHybridCoverIdV3, string> = {
  sound_system: 'Sound System',
  booth_monitor: 'Booth Monitor',
  lighting: 'Lighting',
  mic: 'Mic',
  not_sure_confirm: 'Not sure — will confirm',
}

/** Derive legacy `equipment_capability_ids` from structured equipment answers (flow v2). */
export function synthesizeEquipmentCapabilityIds(sd: BookingIntakeShowDataV3): EquipmentCapabilityIdV3[] {
  const acc = new Set<EquipmentCapabilityIdV3>()
  const add = (id: EquipmentCapabilityIdV3) => acc.add(id)

  for (const k of sd.equipment_venue_includes) {
    if (k === 'full_sound') {
      add('main_pa_speakers')
      add('subwoofers')
    }
    if (k === 'booth_monitor') add('booth_monitor')
    if (k === 'stage_lighting') add('stage_lighting')
    if (k === 'led_moving') add('led_moving_lights')
    if (k === 'fog_haze') add('fog_haze_machine')
  }
  for (const k of sd.equipment_hybrid_covers) {
    if (k === 'sound_system') {
      add('main_pa_speakers')
      add('subwoofers')
    }
    if (k === 'booth_monitor') add('booth_monitor')
    if (k === 'lighting') add('stage_lighting')
    if (k === 'mic') add('wireless_mic')
  }
  if (sd.equipment_mic === 'venue_has_mic') add('wired_mic')
  if (sd.equipment_mic === 'dj_brings_mic') add('wireless_mic')
  if (sd.equipment_sound_tech === 'yes') add('house_sound_tech_onsite')

  return (EQUIPMENT_CAPABILITY_KEYS as readonly EquipmentCapabilityIdV3[]).filter(id => acc.has(id))
}

export function resolveProductionPackageCandidates(doc: PricingCatalogDoc): {
  premium: PricingPackage | null
  platinum: PricingPackage | null
  exclusive: PricingPackage | null
} {
  const byPrice = (target: number, tol = 250) =>
    doc.packages.find(p => Math.abs(p.price - target) <= tol) ?? null
  let premium = byPrice(2000)
  let platinum = byPrice(2600)
  let exclusive = byPrice(3300)
  if (!premium) premium = doc.packages.find(p => /premium/i.test(p.name)) ?? null
  if (!platinum) platinum = doc.packages.find(p => /platinum/i.test(p.name)) ?? null
  if (!exclusive) exclusive = doc.packages.find(p => /exclusive/i.test(p.name)) ?? null
  if (!premium || !platinum || !exclusive) {
    const sorted = [...doc.packages].sort((a, b) => a.price - b.price)
    if (!premium && sorted[0]) premium = sorted[0]
    if (!platinum && sorted[1]) platinum = sorted[1]
    else if (!platinum && sorted[0]) platinum = sorted[0]
    if (!exclusive && sorted[2]) exclusive = sorted[2]
    else if (!exclusive && sorted[sorted.length - 1]) exclusive = sorted[sorted.length - 1]
  }
  return { premium, platinum, exclusive }
}

export function resolveVenueProductionAddonCandidates(doc: PricingCatalogDoc): {
  lighting: PricingAddon | null
  effects: PricingAddon | null
  danceFloor: PricingAddon | null
} {
  const lower = (s: string) => s.toLowerCase()
  const lighting =
    doc.addons.find(a => /lighting|uplight/i.test(a.name) && !/dance/i.test(a.name)) ??
    doc.addons.find(a => Math.abs(a.price - 350) <= 120) ??
    null
  const effects =
    doc.addons.find(
      a => /co2|spark|cold|visual|haze|effect/i.test(lower(a.name)) || /effect/i.test(lower(a.category ?? '')),
    ) ?? doc.addons.find(a => Math.abs(a.price - 400) <= 150) ?? null
  const danceFloor =
    doc.addons.find(a => /dance\s*floor|dancefloor|sq\.?\s*ft|sqft/i.test(a.name)) ??
    doc.addons.find(a => a.priceType === 'per_sq_ft') ??
    null
  return { lighting, effects, danceFloor }
}

/** BYO / gear rental add-on (~$200) — heuristic match on catalog name or price. */
export function resolveGearRentalAddonCandidate(doc: PricingCatalogDoc): PricingAddon | null {
  const lower = (s: string) => s.toLowerCase()
  const byName =
    doc.addons.find(a =>
      /gear|byo|bring[\s-]*own|controller|deck|rental|dj\s*gear/i.test(lower(a.name)),
    ) ?? null
  if (byName) return byName
  return (
    doc.addons.find(
      a =>
        (a.priceType === 'flat_fee' || a.priceType === 'per_event' || a.priceType === 'per_setup') &&
        Math.abs(a.price - 200) <= 40,
    ) ?? null
  )
}

const VENUE_PA_CAPABILITY_IDS: readonly EquipmentCapabilityIdV3[] = [
  'main_pa_speakers',
  'main_pa_speakers_production',
  'subwoofers',
  'subwoofers_production',
]

const DJ_PORTABLE_PA_CAPABILITY_IDS: readonly EquipmentCapabilityIdV3[] = [
  'portable_pa_speakers',
  'subwoofer_portable',
]

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

/** Setup window after load-in (equipment card, DJ brings / hybrid / festival). */
export const EQUIPMENT_SETUP_WINDOW_KEYS = ['', '30', '60', '120', 'not_discussed'] as const
export type Phase4SetupWindowV3 = (typeof EQUIPMENT_SETUP_WINDOW_KEYS)[number]
export const EQUIPMENT_SETUP_WINDOW_LABELS: Record<Exclude<Phase4SetupWindowV3, ''>, string> = {
  '30': '30 min',
  '60': '1 hr',
  '120': '2 hrs',
  not_discussed: 'Not discussed',
}

/** Night-of arrival intent (on-site contact card). */
export const ARTIST_ARRIVAL_NOTE_KEYS = [
  '',
  'before_doors',
  'during_event',
  'before_set',
  'not_discussed',
] as const
export type Phase4ArtistArrivalNoteV3 = (typeof ARTIST_ARRIVAL_NOTE_KEYS)[number]
export const ARTIST_ARRIVAL_NOTE_LABELS: Record<Exclude<Phase4ArtistArrivalNoteV3, ''>, string> = {
  before_doors: 'Before doors',
  during_event: 'During event',
  before_set: 'Before his set',
  not_discussed: 'Not discussed',
}

/** Phase 2B — “anything about getting to the venue?” (live); default no. */
export type Phase2VenueAccessNotesFlagV3 = 'no' | 'yes'

export const VENUE_ACCESS_NOTE_TAG_KEYS = [
  'gated_property',
  'street_parking_only',
  'dedicated_lot',
  'valet',
  'loading_dock',
  'rear_alley_entrance',
  'stairs_no_elevator',
  'freight_elevator',
  'security_checkpoint',
  'guest_list_entry',
  'id_wristband',
  'noise_curfew',
  'residential_quiet_load_in',
  'other',
] as const
export type VenueAccessNoteTagV3 = (typeof VENUE_ACCESS_NOTE_TAG_KEYS)[number]
export const VENUE_ACCESS_NOTE_TAG_LABELS: Record<VenueAccessNoteTagV3, string> = {
  gated_property: 'Gated property — need code or contact',
  street_parking_only: 'Street parking only',
  dedicated_lot: 'Dedicated parking lot',
  valet: 'Valet available',
  loading_dock: 'Loading dock available',
  rear_alley_entrance: 'Rear / alley entrance',
  stairs_no_elevator: 'Stairs — no elevator',
  freight_elevator: 'Freight elevator available',
  security_checkpoint: 'Security checkpoint',
  guest_list_entry: 'Guest list required for entry',
  id_wristband: 'ID / wristband required',
  noise_curfew: 'Strict noise curfew',
  residential_quiet_load_in: 'Residential area — keep it quiet on load-in',
  other: 'Other',
}

/** Live 4B — DJ parking (single pick, night-of logistics). Default {@link emptyVenueDataV3} is `street`. */
export const DJ_PARKING_V3_KEYS = [
  'street',
  'dedicated_spot',
  'garage',
  'private_parking',
  'valet',
] as const
export type Phase4DjParkingV3 = (typeof DJ_PARKING_V3_KEYS)[number]
export const DJ_PARKING_V3_LABELS: Record<Phase4DjParkingV3, string> = {
  street: 'Street parking',
  dedicated_spot: 'Dedicated spot',
  garage: 'Garage',
  private_parking: 'Private parking',
  valet: 'Valet',
}

/** Festival / outdoor production: soundcheck scheduled with production (equipment card chip). */
export type Phase4ProductionSoundcheckV3 = '' | 'scheduled'

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
  'internal_approval',
  'other',
] as const

export type FollowUpTopicKeyV3 = (typeof FOLLOW_UP_TOPIC_KEYS)[number]

export const FOLLOW_UP_TOPIC_LABELS: Record<FollowUpTopicKeyV3, string> = {
  address: 'Address needed',
  contacts: 'Contact info to confirm',
  technical: 'Technical details TBD',
  payment: 'Payment pending',
  contract_review: 'Contract review',
  internal_approval: 'They need internal approval',
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

/** Live intake money step — selectable chips only (cash/other omitted; empty allowed). */
export const LIVE_PAYMENT_METHOD_KEYS = [
  'zelle',
  'venmo',
  'apple_pay',
  'paypal',
  'check',
] as const satisfies readonly PaymentMethodKeyV3[]

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

/** Alphabetical chip list — union of all vibe presets (Phase 3B). */
export const PERFORMANCE_GENRE_VALUES = [
  'afrobeats',
  'amapiano',
  'bachata',
  'bossa_nova',
  'cumbia',
  'dance_pop',
  'dancehall',
  'deep_house',
  'dembow',
  'downtempo',
  'edm',
  'hip_hop',
  'house',
  'jazz_house',
  'kompa',
  'latin_house',
  'latin_trap',
  'lo_fi',
  'merengue',
  'moombahton',
  'neo_soul',
  'old_school_hip_hop',
  'rnb',
  'reggae',
  'reggaeton',
  'reggaeton_clasico',
  'remix_mashups',
  'salsa',
  'soca',
  'tech_house',
  'throwbacks',
  'top_40',
  'trap',
  'west_coast_hip_hop',
] as const

export type PerformanceGenreV3 = (typeof PERFORMANCE_GENRE_VALUES)[number]

export type MusicVibePresetV3 = {
  id: string
  label: string
  genres: readonly PerformanceGenreV3[]
}

/** Tap a vibe to replace genre chip selection with that preset (operator can edit chips after). */
export const MUSIC_VIBE_PRESETS: readonly MusicVibePresetV3[] = [
  {
    id: 'latin_party',
    label: 'Latin Party',
    genres: [
      'reggaeton',
      'latin_house',
      'cumbia',
      'salsa',
      'bachata',
      'merengue',
      'dembow',
      'moombahton',
      'latin_trap',
      'reggaeton_clasico',
    ],
  },
  {
    id: 'hiphop_rnb',
    label: 'Hip-Hop & R&B',
    genres: [
      'hip_hop',
      'rnb',
      'trap',
      'west_coast_hip_hop',
      'old_school_hip_hop',
      'afrobeats',
      'dancehall',
    ],
  },
  {
    id: 'club_high_energy',
    label: 'Club / High Energy',
    genres: ['edm', 'house', 'tech_house', 'latin_house', 'moombahton', 'dance_pop', 'remix_mashups', 'top_40'],
  },
  {
    id: 'chill_lounge',
    label: 'Chill / Lounge',
    genres: ['rnb', 'deep_house', 'downtempo', 'neo_soul', 'bossa_nova', 'lo_fi', 'jazz_house'],
  },
  {
    id: 'open_format',
    label: 'Open Format / Mix of Everything',
    genres: [
      'top_40',
      'hip_hop',
      'rnb',
      'reggaeton',
      'edm',
      'dance_pop',
      'latin_house',
      'remix_mashups',
      'throwbacks',
    ],
  },
  {
    id: 'afro_caribbean',
    label: 'Afro / Caribbean',
    genres: ['afrobeats', 'dancehall', 'soca', 'amapiano', 'dembow', 'reggae', 'kompa'],
  },
  {
    id: 'latin_x_hiphop',
    label: 'Latin x Hip-Hop',
    genres: [
      'reggaeton',
      'latin_trap',
      'hip_hop',
      'trap',
      'dembow',
      'moombahton',
      'west_coast_hip_hop',
      'old_school_hip_hop',
    ],
  },
  {
    id: 'latin_x_club',
    label: 'Latin x Club',
    genres: [
      'reggaeton',
      'latin_house',
      'moombahton',
      'dembow',
      'tech_house',
      'edm',
      'dance_pop',
      'cumbia',
      'remix_mashups',
    ],
  },
  {
    id: 'rnb_x_latin',
    label: 'R&B x Latin',
    genres: [
      'rnb',
      'bachata',
      'neo_soul',
      'reggaeton_clasico',
      'salsa',
      'deep_house',
      'downtempo',
      'bossa_nova',
    ],
  },
] as const

/** New shows + empty legacy rows: default to Latin Party (specialty). */
export const INTAKE_DEFAULT_GENRES: readonly PerformanceGenreV3[] = MUSIC_VIBE_PRESETS[0].genres

const MUSIC_VIBE_PRESET_ID_SET = new Set(MUSIC_VIBE_PRESETS.map(p => p.id))

/** Union of genres from intake vibe preset ids (same mapping as Music & Vibe chips). */
export function mapVibePresetIdsToGenres(ids: readonly string[]): PerformanceGenreV3[] {
  const out = new Set<PerformanceGenreV3>()
  for (const id of ids) {
    const preset = MUSIC_VIBE_PRESETS.find(p => p.id === id)
    if (preset) for (const g of preset.genres) out.add(g)
  }
  if (out.size === 0) return [...INTAKE_DEFAULT_GENRES]
  return [...out]
}

export function genreSetsEqual(a: readonly PerformanceGenreV3[], b: readonly PerformanceGenreV3[]): boolean {
  if (a.length !== b.length) return false
  const sa = [...a].sort()
  const sb = [...b].sort()
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false
  }
  return true
}

export const PERFORMANCE_GENRE_LABELS: Record<PerformanceGenreV3, string> = {
  afrobeats: 'Afrobeats',
  amapiano: 'Amapiano',
  bachata: 'Bachata',
  bossa_nova: 'Bossa Nova',
  cumbia: 'Cumbia',
  dance_pop: 'Dance Pop',
  dancehall: 'Dancehall',
  deep_house: 'Deep House',
  dembow: 'Dembow',
  downtempo: 'Downtempo',
  edm: 'EDM',
  hip_hop: 'Hip-Hop',
  house: 'House',
  jazz_house: 'Jazz House',
  kompa: 'Kompa',
  latin_house: 'Latin House',
  latin_trap: 'Latin Trap',
  lo_fi: 'Lo-fi',
  merengue: 'Merengue',
  moombahton: 'Moombahton',
  neo_soul: 'Neo-Soul',
  old_school_hip_hop: 'Old School Hip-Hop',
  rnb: 'R&B',
  reggae: 'Reggae',
  reggaeton: 'Reggaeton',
  reggaeton_clasico: 'Reggaeton Clásico',
  remix_mashups: 'Remix / Mashups',
  salsa: 'Salsa',
  soca: 'Soca',
  tech_house: 'Tech House',
  throwbacks: 'Throwbacks',
  top_40: 'Top 40',
  trap: 'Trap',
  west_coast_hip_hop: 'West Coast Hip-Hop',
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
  | 'under_50'
  | '50_100'
  | 'under_100'
  | '100_250'
  | '250_500'
  | '100_300'
  | '300_500'
  | '500_750'
  | '750_1000'
  | '500_1000'
  | '1000_2000'
  | '2000_5000'
  | '5000_10000'
  | '10000_25000'
  | '25000_50000'
  | '50000_100000'
  | '100000_250000'
  | '250000_plus'
  | '5000_plus'

export const CAPACITY_RANGE_OPTIONS: { value: CapacityRangeV3; label: string }[] = [
  { value: 'under_50', label: 'Under 50' },
  { value: '50_100', label: '50-100' },
  { value: 'under_100', label: 'Up to 100' },
  { value: '100_250', label: '100-250' },
  { value: '250_500', label: '250-500' },
  { value: '100_300', label: '100-300' },
  { value: '300_500', label: '300-500' },
  { value: '500_750', label: '500-750' },
  { value: '750_1000', label: '750-1,000' },
  { value: '500_1000', label: '500-1,000' },
  { value: '1000_2000', label: '1,000-2,000' },
  { value: '2000_5000', label: '2,000-5,000' },
  { value: '5000_10000', label: '5,000-10,000' },
  { value: '10000_25000', label: '10,000-25,000' },
  { value: '25000_50000', label: '25,000-50,000' },
  { value: '50000_100000', label: '50,000-100,000' },
  { value: '100000_250000', label: '100,000-250,000' },
  { value: '250000_plus', label: '250,000+ (stadium / festival scale)' },
  { value: '5000_plus', label: '5,000+ (broad)' },
]

/** Default event-address locality for new shows (primary operating market). */
export const INTAKE_DEFAULT_EVENT_CITY_TEXT = 'Los Angeles'
export const INTAKE_DEFAULT_EVENT_STATE_REGION = 'CA'

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
  /** Frozen copy of phone on file when starting 1B “add number” flow (`contact_phone` stays the primary on-file value). */
  contact_phone_on_file: string
  /** Additional phone from live 1B (additive). */
  contact_phone_added: string
  /** `primary_on_file` | `on_call` | venue `contacts.id` for {@link contact_phone_added}. */
  contact_phone_added_owner: string
  contact_email_on_file: string
  contact_email_added: string
  contact_email_added_owner: string
  /** Substantive: their role/title when `confirmed_contact === 'no_different_person'`. */
  contact_mismatch_context: Phase1ContactMismatchContextV3
  /** Their name on the call when not the contact on file (single line). */
  contact_mismatch_note: string
  /**
   * When set, mismatch is satisfied by this `contacts.id` (venue chip pick or row created from Add new).
   * Suppresses redundant name/title UI in live 1A; Add new clears until a new person is saved on advance.
   */
  contact_mismatch_linked_contact_id: string | null
  /**
   * Precise {@link ContactTitleKey} for the on-call person when `confirmed_contact === 'no_different_person'`.
   * Kept in sync with `contact_mismatch_context` (intake mismatch bucket) when set from the title picker.
   */
  contact_mismatch_title_key: string
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
  /**
   * When set, on-site POC is an existing venue `contacts` row (live 4B chip pick).
   * Skips duplicate contact insert on venue import; snapshots still hold name/phone for capture.
   */
  onsite_linked_contact_id: string | null
  /** Title bucket for on-site POC when chosen via Add new (mirrors Phase 1 mismatch context). */
  onsite_title_context: Phase1ContactMismatchContextV3
  /** Night-of: target arrival time for the artist (venue provides / club scenarios). */
  artist_arrival_time: string
  /** When / how arrival relates to doors or set (live 4B). */
  artist_arrival_note: Phase4ArtistArrivalNoteV3
  /** Phase 2B — casual “getting to the venue” capture (chips + optional Phase 8 other). */
  venue_access_notes_flag: Phase2VenueAccessNotesFlagV3
  venue_access_note_tags: VenueAccessNoteTagV3[]
  /** When {@link venue_access_note_tags} includes `other`, typed in Phase 8A. */
  venue_access_other_notes: string
  /** Live 4B — DJ parking (replaces legacy §4D parking card). */
  dj_parking: Phase4DjParkingV3
  /** On-site POC role / logistics (substance beyond name capture later). */
  onsite_poc_role: OnsitePocRoleV3
  onsite_connect_method: OnsiteConnectMethodV3
  onsite_connect_window: OnsiteConnectWindowV3
  /** §16.5E — shared invoicing */
  invoice_same_contact: Phase5InvoiceSameContactV3
  invoice_company_confirmed: Phase5InvoiceConfirmV3
  invoice_email_confirmed: Phase5InvoiceConfirmV3
  billing_contact_flag: Phase5BillingContactFlagV3
  /** When invoice goes to someone already on the venue roster (live §5C picker). */
  billing_linked_contact_id: string | null
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
  /** Precise {@link ContactTitleKey} when on-site POC is not linked to an existing contact row. */
  onsite_contact_title_key: string
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
  /** Freeform when `event_type === 'other'`. */
  event_type_other: string
  venue_type: VenueType | ''
  /** Freeform when `venue_type === 'other'`. */
  venue_type_other: string
  setting: Phase2SettingV3
  /** When `setting === 'other'`. */
  setting_other_detail: string
  /** @deprecated Live2A uses `event_schedule_type` / `event_recurrence_interval`; kept for legacy JSON. */
  event_archetype: EventArchetypeV3
  /** @deprecated */
  event_archetype_other_detail: string
  /** One-off vs recurring engagement. */
  event_schedule_type: Phase2EventScheduleV3
  /** When `event_schedule_type === 'recurring'`. */
  event_recurrence_interval: Phase2RecurrenceIntervalV3
  event_name_flag: Phase2EventNameFlagV3
  event_date: string
  event_start_time: string
  event_end_time: string
  /** Empty = same as {@link event_start_time} for doors (live 2B). */
  doors_open_time: string
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
  /** Selected Music & Vibe preset ids (supports multiple, e.g. from cold call transfer). */
  music_vibe_preset_ids: string[]
  /** Cold call / operator context shown on §5 pricing (not a quoted amount). */
  pricing_prefill_note: string
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
  /** Structured equipment card (v2); v0 keeps legacy chip-only capture without synthesis overwrite. */
  equipment_intake_flow_version: EquipmentIntakeFlowVersionV3
  equipment_mic: EquipmentMicV3
  equipment_sound_tech: EquipmentSoundTechV3
  /** Venue `contacts.id` when the sound tech maps to a saved contact; otherwise null with {@link equipment_sound_tech_name}. */
  equipment_sound_tech_contact_id: string | null
  /** Free-typed sound tech or snapshot name (primary / on-call picks). */
  equipment_sound_tech_name: string
  /** Gear verification (venue provides / hybrid). */
  venue_deck_type: VenueDeckTypeV3
  /** {@link import('@/lib/gear/djGearCatalog').GEAR_MODEL_OTHER_ID} = other — type notes in post-call. */
  venue_deck_model_id: string
  venue_deck_compatible: boolean | null
  venue_mixer_brand: VenueMixerBrandV3
  venue_mixer_model_id: string
  venue_mixer_compatible: boolean | null
  venue_booth_monitor: VenueBoothMonitorV3
  venue_laptop_connection: VenueLaptopConnectionV3
  venue_usb_format: VenueUsbFormatV3
  venue_pro_dj_link: VenueProDjLinkV3
  venue_software: VenueSoftwareV3
  gear_compatible: boolean | null
  gear_bring_own_fee: boolean
  gear_flagged_for_discussion: boolean
  gear_tech_followup_needed: boolean
  gear_tech_followup_completed: boolean
  gear_tech_call_active: boolean
  gear_tech_call_step: GearTechCallStepV3
  tech_soundcheck_time: string
  tech_setup_access: TechSetupAccessV3
  venue_deck_other_notes: string
  venue_mixer_other_notes: string
  equipment_venue_includes: EquipmentVenueIncludesIdV3[]
  equipment_hybrid_covers: EquipmentHybridCoverIdV3[]
  equipment_dj_package_interest: EquipmentDjPackageInterestV3
  equipment_hybrid_additions: EquipmentHybridAdditionsV3
  /** Phase 5B nudge: client deferred production upsell. */
  equipment_revisit_production_5b: boolean
  equipment_setup_window: Phase4SetupWindowV3
  equipment_production_soundcheck: Phase4ProductionSoundcheckV3
  /** @deprecated Legacy 4C gate; unused in live flow. */
  load_in_discussed: Phase4LoadInDiscussedV3
  load_in_time: string
  /** @deprecated Removed from live flow. */
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
  /** Add-on ids turned on by equipment / intake autopop rules — drives “Auto” badge on §5B. */
  addon_autopop_ids: string[]
  /** Operator dismissed autopop for these add-on ids on §5B — autopop won’t re-apply them. */
  addon_autopop_dismissed_ids: string[]
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
  venue?: Pick<BookingIntakeVenueDataV3, 'dj_parking'> | null,
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
  else if (sd.equipment_capability_ids.length > 0) {
    const ids = new Set(sd.equipment_capability_ids)
    const venuePa = VENUE_PA_CAPABILITY_IDS.some(id => ids.has(id))
    const djPortable = DJ_PORTABLE_PA_CAPABILITY_IDS.some(id => ids.has(id))
    const djController = ids.has('dj_controller')
    if (venuePa && !djPortable && !djController) out.pa_sound = 'venue_provides'
    else if ((djPortable || djController) && !venuePa) out.pa_sound = 'dj_provides'
    else if (venuePa && (djPortable || djController)) out.pa_sound = 'not_discussed'
  }

  if (sd.set_start_time.trim() && sd.set_end_time.trim()) out.set_times = 'confirmed'

  if (sd.load_in_time.trim()) out.load_in = 'confirmed'

  const dp = venue?.dj_parking
  if (dp) out.parking = 'confirmed'
  else {
    const ps = sd.parking_status
    if (ps === 'confirmed') out.parking = 'confirmed'
    else if (ps === 'need_confirm') out.parking = 'need_confirm'
    else if (ps === 'not_discussed') out.parking = 'not_discussed'
  }

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

export function knownEventTypeLabel(v: KnownEventTypeV3 | '', otherDetail?: string): string {
  if (v === 'other' && otherDetail?.trim()) return otherDetail.trim()
  return v ? KNOWN_EVENT_LABELS[v] ?? '' : ''
}

/** Venue / entity type labels in Phase 2A — disambiguate *event* “Festival” from venue “Festival”. */
export const VENUE_TYPE_INTAKE_2A_LABELS: Record<VenueType, string> = {
  ...VENUE_TYPE_LABELS,
  festival: 'Festival grounds / outdoor site',
}

/** When true, Phase 2A uses full entity-type lists and does not narrow options by event type. */
export function intakePhase2aRelaxDynamicFilters(sd: BookingIntakeShowDataV3): boolean {
  return sd.event_type === 'other' || sd.venue_type === 'other' || sd.setting === 'other'
}

/** All entity types allowed in 2A (filtering is by suggestion order only). */
export function venueTypesForIntake2a(_eventType: KnownEventTypeV3 | '', _relax: boolean): VenueType[] {
  return [...VENUE_TYPE_ORDER]
}

/**
 * Single row in the live 2A entity-type picker. Maps to DB `venue_type` (+ `venue_type_other` when `other`).
 */
export type IntakeVenuePickOptionV3 = {
  id: string
  label: string
  venueType: VenueType
  /** When `venueType === 'other'`, persisted verbatim to `venue_type_other` (except `other_describe`). */
  otherDetail?: string
}

/** Maps legacy freeform `venue_type_other` strings (pre–expanded enum) to enum slugs for picker + display. */
export const LEGACY_INTAKE_VENUE_OTHER_DETAIL_TO_SLUG: Record<string, VenueType> = {
  'Conference / convention center': 'convention_center',
  'Hotel / resort': 'hotel',
  'Hotel ballroom / event hall': 'hotel',
  'Office / coworking event space': 'office_coworking',
  'Restaurant (private dining)': 'restaurant',
  'Rooftop / terrace': 'rooftop',
  'Warehouse / industrial': 'warehouse',
  'Gallery / museum': 'gallery',
  'Country club / golf club': 'country_club',
  'Casino / gaming venue': 'casino',
  'Stadium / arena': 'stadium',
  'Boat / yacht': 'yacht_boat',
  'Private estate / home': 'private_estate',
  'Park / outdoor venue': 'park_public_space',
  'Retail / pop-up space': 'retail_popup',
}

const INTAKE_VENUE_MASTER_LIST: IntakeVenuePickOptionV3[] = [
  ...VENUE_TYPE_ORDER.filter(t => t !== 'other').map(t => ({
    id: t,
    label: VENUE_TYPE_INTAKE_2A_LABELS[t],
    venueType: t,
  })),
  { id: 'other_describe', label: 'Other (describe)', venueType: 'other' },
]

/** Priority order for 2A suggestions by event type (ids from `INTAKE_VENUE_MASTER_LIST`). */
const EVENT_VENUE_SUGGESTED_IDS: Partial<Record<KnownEventTypeV3, string[]>> = {
  corporate: [
    'convention_center',
    'hotel',
    'office_coworking',
    'bar',
    'restaurant',
    'lounge',
    'rooftop',
    'theater',
    'club',
  ],
  club_night: ['club', 'bar', 'lounge', 'theater', 'warehouse', 'rooftop'],
  wedding: [
    'hotel',
    'private_estate',
    'country_club',
    'restaurant',
    'gallery',
    'lounge',
    'bar',
    'theater',
    'club',
  ],
  festival: ['festival', 'park_public_space', 'stadium', 'bar', 'club', 'theater', 'lounge'],
  concert: ['theater', 'stadium', 'bar', 'club', 'lounge', 'festival', 'warehouse'],
  private_event: [
    'private_estate',
    'hotel',
    'restaurant',
    'gallery',
    'bar',
    'lounge',
    'theater',
    'club',
    'convention_center',
  ],
  brand_activation: [
    'retail_popup',
    'gallery',
    'warehouse',
    'rooftop',
    'bar',
    'club',
    'lounge',
    'theater',
    'sponsor_brand',
  ],
  after_party: ['club', 'bar', 'lounge', 'theater', 'warehouse', 'rooftop', 'yacht_boat'],
}

function filterIntakeVenuePicksByAllowed(
  opts: IntakeVenuePickOptionV3[],
  allowed: Set<VenueType>,
): IntakeVenuePickOptionV3[] {
  return opts.filter(o => o.venueType === 'other' || allowed.has(o.venueType))
}

export function findIntakeVenuePickById(id: string): IntakeVenuePickOptionV3 | undefined {
  return INTAKE_VENUE_MASTER_LIST.find(o => o.id === id)
}

/** Value for the 2A venue Select, or `__none__` / `__custom__` / `other_describe` for freeform. */
export function intakeVenuePickValueFromShow(sd: BookingIntakeShowDataV3): string {
  if (!sd.venue_type) return '__none__'
  if (sd.venue_type !== 'other') {
    const slug = sd.venue_type as VenueType
    if (INTAKE_VENUE_MASTER_LIST.some(o => o.id === slug)) return slug
    return '__custom__'
  }
  const t = sd.venue_type_other.trim()
  if (!t) return 'other_describe'
  const legacySlug = LEGACY_INTAKE_VENUE_OTHER_DETAIL_TO_SLUG[t]
  if (legacySlug && INTAKE_VENUE_MASTER_LIST.some(o => o.id === legacySlug)) return legacySlug
  return '__custom__'
}

export function intakeVenuePickOptionsForEvent(
  eventType: KnownEventTypeV3 | '',
  relax: boolean,
): { suggested: IntakeVenuePickOptionV3[]; rest: IntakeVenuePickOptionV3[] } {
  const allowed = new Set(venueTypesForIntake2a(eventType, relax))
  const filtered = filterIntakeVenuePicksByAllowed(INTAKE_VENUE_MASTER_LIST, allowed)
  if (relax || !eventType || eventType === 'other') {
    return {
      suggested: [],
      rest: [...filtered].sort((a, b) => a.label.localeCompare(b.label)),
    }
  }
  const order = EVENT_VENUE_SUGGESTED_IDS[eventType] ?? []
  const suggested: IntakeVenuePickOptionV3[] = []
  const seen = new Set<string>()
  for (const id of order) {
    const o = INTAKE_VENUE_MASTER_LIST.find(m => m.id === id)
    if (!o) continue
    if (o.venueType !== 'other' && !allowed.has(o.venueType)) continue
    if (seen.has(id)) continue
    suggested.push(o)
    seen.add(id)
  }
  const rest = filtered.filter(o => !seen.has(o.id)).sort((a, b) => a.label.localeCompare(b.label))
  return { suggested, rest }
}

/** First non–freeform suggestion for auto-fill when event type changes or pre-call seed. */
export function intakeVenueDefaultPickForEventType(
  eventType: KnownEventTypeV3 | '',
  relax: boolean,
): IntakeVenuePickOptionV3 | null {
  const { suggested } = intakeVenuePickOptionsForEvent(eventType, relax)
  const first = suggested.find(o => o.id !== 'other_describe')
  if (first) return first
  const { rest } = intakeVenuePickOptionsForEvent(eventType, relax)
  return rest.find(o => o.id !== 'other_describe') ?? null
}

export function intakeVenueTypeDisplay(v: VenueType | '', otherDetail?: string): string {
  if (v === 'other' && otherDetail?.trim()) return otherDetail.trim()
  return v ? VENUE_TYPE_INTAKE_2A_LABELS[v] ?? VENUE_TYPE_LABELS[v] : ''
}

export function emptyShowDataV3(sortIndex: number): BookingIntakeShowDataV3 {
  return {
    _v: 3,
    color: SHOW_COLOR_HEX[Math.min(sortIndex, 2)] ?? SHOW_COLOR_HEX[0],
    event_type: '',
    event_type_other: '',
    venue_type: '',
    venue_type_other: '',
    setting: '',
    setting_other_detail: '',
    event_archetype: '',
    event_archetype_other_detail: '',
    event_schedule_type: 'one_off',
    event_recurrence_interval: '',
    event_name_flag: '',
    event_date: '',
    event_start_time: '20:00',
    event_end_time: '23:00',
    doors_open_time: '',
    overnight_event: false,
    venue_name_flag: 'already_have',
    city_flag: 'already_have',
    state_region: INTAKE_DEFAULT_EVENT_STATE_REGION,
    address_status: 'have_it',
    venue_archetype: '',
    address_detail_level: '',
    capacity_range: '',
    exact_capacity_flag: '',
    approximate_headcount: 0,
    performance_role: '',
    set_start_time: '',
    set_end_time: '',
    overnight_set: false,
    genres: [...INTAKE_DEFAULT_GENRES],
    music_vibe_preset_ids: [],
    pricing_prefill_note: '',
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
    equipment_intake_flow_version: 2,
    equipment_mic: '',
    equipment_sound_tech: '',
    equipment_sound_tech_contact_id: null,
    equipment_sound_tech_name: '',
    venue_deck_type: '',
    venue_deck_model_id: '',
    venue_deck_compatible: null,
    venue_mixer_brand: '',
    venue_mixer_model_id: '',
    venue_mixer_compatible: null,
    venue_booth_monitor: '',
    venue_laptop_connection: '',
    venue_usb_format: '',
    venue_pro_dj_link: '',
    venue_software: '',
    gear_compatible: null,
    gear_bring_own_fee: false,
    gear_flagged_for_discussion: false,
    gear_tech_followup_needed: false,
    gear_tech_followup_completed: false,
    gear_tech_call_active: false,
    gear_tech_call_step: '',
    tech_soundcheck_time: '',
    tech_setup_access: '',
    venue_deck_other_notes: '',
    venue_mixer_other_notes: '',
    equipment_venue_includes: [],
    equipment_hybrid_covers: [],
    equipment_dj_package_interest: '',
    equipment_hybrid_additions: '',
    equipment_revisit_production_5b: false,
    equipment_setup_window: '',
    equipment_production_soundcheck: '',
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
    addon_autopop_ids: [],
    addon_autopop_dismissed_ids: [],
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
    city_text: INTAKE_DEFAULT_EVENT_CITY_TEXT,
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

/** Reset all gear verification fields (e.g. DJ brings own, or clearing show). */
export function emptyGearVerificationSlice(): Pick<
  BookingIntakeShowDataV3,
  | 'venue_deck_type'
  | 'venue_deck_model_id'
  | 'venue_deck_compatible'
  | 'venue_mixer_brand'
  | 'venue_mixer_model_id'
  | 'venue_mixer_compatible'
  | 'venue_booth_monitor'
  | 'venue_laptop_connection'
  | 'venue_usb_format'
  | 'venue_pro_dj_link'
  | 'venue_software'
  | 'gear_compatible'
  | 'gear_bring_own_fee'
  | 'gear_flagged_for_discussion'
  | 'gear_tech_followup_needed'
  | 'gear_tech_followup_completed'
  | 'gear_tech_call_active'
  | 'gear_tech_call_step'
  | 'tech_soundcheck_time'
  | 'tech_setup_access'
  | 'venue_deck_other_notes'
  | 'venue_mixer_other_notes'
> {
  return {
    venue_deck_type: '',
    venue_deck_model_id: '',
    venue_deck_compatible: null,
    venue_mixer_brand: '',
    venue_mixer_model_id: '',
    venue_mixer_compatible: null,
    venue_booth_monitor: '',
    venue_laptop_connection: '',
    venue_usb_format: '',
    venue_pro_dj_link: '',
    venue_software: '',
    gear_compatible: null,
    gear_bring_own_fee: false,
    gear_flagged_for_discussion: false,
    gear_tech_followup_needed: false,
    gear_tech_followup_completed: false,
    gear_tech_call_active: false,
    gear_tech_call_step: '',
    tech_soundcheck_time: '',
    tech_setup_access: '',
    venue_deck_other_notes: '',
    venue_mixer_other_notes: '',
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
    contact_phone_on_file: '',
    contact_phone_added: '',
    contact_phone_added_owner: '',
    contact_email_on_file: '',
    contact_email_added: '',
    contact_email_added_owner: '',
    contact_mismatch_context: '',
    contact_mismatch_note: '',
    contact_mismatch_linked_contact_id: null,
    contact_mismatch_title_key: '',
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
    onsite_linked_contact_id: null,
    onsite_title_context: '',
    artist_arrival_time: '',
    artist_arrival_note: '',
    venue_access_notes_flag: 'no',
    venue_access_note_tags: [],
    venue_access_other_notes: '',
    dj_parking: 'street',
    onsite_poc_role: '',
    onsite_connect_method: '',
    onsite_connect_window: '',
    invoice_same_contact: '',
    invoice_company_confirmed: '',
    invoice_email_confirmed: '',
    billing_contact_flag: '',
    billing_linked_contact_id: null,
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
    onsite_contact_title_key: '',
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
  '2C',
  '2B',
  '3B',
  '4A',
  '4B',
  '4E',
  '5A',
  '5B',
  '5C',
  '7A',
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
      return 'Event address'
    case '2D':
      return 'Scale (legacy)'
    case '3A':
      return 'Role & slot (legacy)'
    case '3B':
      return 'Music & vibe'
    case '4A':
      return 'Equipment'
    case '4B':
      return 'On-site contact'
    case '4D':
      return 'Parking & access'
    case '4E':
      return 'Travel & lodging'
    case '5A':
      return 'Pricing setup'
    case '5B':
      return 'Add-ons & upgrades'
    case '5C':
      return 'The Deal'
    case '5D':
      return 'Deposit & payment (legacy)'
    case '5E':
      return 'Invoicing (legacy)'
    case '6A':
      return 'Venue promises (legacy)'
    case '7A':
      return 'The Close'
    case '7B':
      return 'Follow-ups (legacy)'
    case '7C':
      return 'End call (legacy)'
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

/** Sidebar phase index 0–5 (Opening = 0, Close = 5). Legacy §6 merged into Close. */
export function livePhaseIndexFromSection(sectionId: string): number {
  if (sectionId.startsWith('__stub_')) {
    const n = parseInt(sectionId.replace('__stub_', ''), 10)
    return Number.isFinite(n) ? Math.min(5, Math.max(0, n - 1)) : 0
  }
  const c = sectionId.charAt(0)
  const p = parseInt(c, 10)
  if (!Number.isFinite(p)) return 0
  if (p >= 7) return 5
  if (p === 6) return 5
  if (p === 5) return 4
  return Math.min(3, Math.max(0, p - 1))
}

export function stubSectionId(phaseOneBased: number): string {
  return `__stub_${phaseOneBased}`
}

/** §18.7C — suggested venue outreach status (caller may apply on venue import). */
export function suggestedOutreachStatusFromPhase7Close(
  sendAgreement: Phase7SendAgreementV3,
): '' | 'agreement_sent' | 'in_discussion' {
  if (sendAgreement === 'yes_sending' || sendAgreement === 'invoice_only') return 'agreement_sent'
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
  let billingLinkedId =
    typeof o.billing_linked_contact_id === 'string' && o.billing_linked_contact_id.trim()
      ? o.billing_linked_contact_id.trim()
      : null
  if (invSame !== 'different') {
    invCo = ''
    invEmail = ''
    billFlag = ''
    billingLinkedId = null
  }
  const sendAgreement = parsePhase1Enum(o.send_agreement, ['', 'yes_sending', 'invoice_only', 'verbal_only'], '')
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
    contact_phone_on_file: typeof o.contact_phone_on_file === 'string' ? o.contact_phone_on_file : '',
    contact_phone_added: typeof o.contact_phone_added === 'string' ? o.contact_phone_added : '',
    contact_phone_added_owner: typeof o.contact_phone_added_owner === 'string' ? o.contact_phone_added_owner : '',
    contact_email_on_file: typeof o.contact_email_on_file === 'string' ? o.contact_email_on_file : '',
    contact_email_added: typeof o.contact_email_added === 'string' ? o.contact_email_added : '',
    contact_email_added_owner: typeof o.contact_email_added_owner === 'string' ? o.contact_email_added_owner : '',
    contact_mismatch_context: parsePhase1Enum(
      o.contact_mismatch_context,
      [...CONTACT_MISMATCH_CONTEXT_KEYS],
      '',
    ),
    contact_mismatch_note: typeof o.contact_mismatch_note === 'string' ? o.contact_mismatch_note : '',
    contact_mismatch_linked_contact_id:
      typeof o.contact_mismatch_linked_contact_id === 'string' && o.contact_mismatch_linked_contact_id.trim()
        ? o.contact_mismatch_linked_contact_id.trim()
        : null,
    contact_mismatch_title_key: typeof o.contact_mismatch_title_key === 'string' ? o.contact_mismatch_title_key : '',
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
    onsite_linked_contact_id:
      typeof o.onsite_linked_contact_id === 'string' && o.onsite_linked_contact_id.trim()
        ? o.onsite_linked_contact_id.trim()
        : null,
    onsite_title_context: parsePhase1Enum(
      o.onsite_title_context,
      [...CONTACT_MISMATCH_CONTEXT_KEYS],
      '',
    ),
    artist_arrival_time: typeof o.artist_arrival_time === 'string' ? o.artist_arrival_time : '',
    artist_arrival_note: parsePhase1Enum(o.artist_arrival_note, [...ARTIST_ARRIVAL_NOTE_KEYS], ''),
    venue_access_notes_flag: parsePhase1Enum(o.venue_access_notes_flag, ['no', 'yes'], 'no'),
    venue_access_note_tags: asVenueAccessNoteTags(o.venue_access_note_tags),
    venue_access_other_notes: typeof o.venue_access_other_notes === 'string' ? o.venue_access_other_notes : '',
    dj_parking: parsePhase1Enum(o.dj_parking, [...DJ_PARKING_V3_KEYS], 'street'),
    onsite_poc_role: parsePhase1Enum(o.onsite_poc_role, ONSITE_POC_ROLE_KEYS, ''),
    onsite_connect_method: parsePhase1Enum(o.onsite_connect_method, ONSITE_CONNECT_METHOD_KEYS, ''),
    onsite_connect_window: parsePhase1Enum(o.onsite_connect_window, ONSITE_CONNECT_WINDOW_KEYS, ''),
    invoice_same_contact: invSame,
    invoice_company_confirmed: invCo,
    invoice_email_confirmed: invEmail,
    billing_contact_flag: billFlag,
    billing_linked_contact_id: billingLinkedId,
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
    onsite_contact_title_key: typeof o.onsite_contact_title_key === 'string' ? o.onsite_contact_title_key : '',
    onsite_contact_role: String(o.onsite_contact_role ?? ''),
    invoice_company_text: String(o.invoice_company_text ?? ''),
    invoice_email_text: String(o.invoice_email_text ?? ''),
    billing_contact_name: String(o.billing_contact_name ?? ''),
    billing_contact_email: String(o.billing_contact_email ?? ''),
    post_import_venue_id: typeof o.post_import_venue_id === 'string' && o.post_import_venue_id.trim()
      ? o.post_import_venue_id.trim()
      : null,
  }
  let remapped: BookingIntakeVenueDataV3 =
    parsed.view_section === '3C' || parsed.last_active_section === '3C'
      ? {
          ...parsed,
          view_section: parsed.view_section === '3C' ? '4A' : parsed.view_section,
          last_active_section: parsed.last_active_section === '3C' ? '4A' : parsed.last_active_section,
        }
      : parsed
  if (remapped.view_section === '4C' || remapped.last_active_section === '4C') {
    remapped = {
      ...remapped,
      view_section: remapped.view_section === '4C' ? '4E' : remapped.view_section,
      last_active_section: remapped.last_active_section === '4C' ? '4E' : remapped.last_active_section,
    }
  }
  if (remapped.view_section === '4D' || remapped.last_active_section === '4D') {
    remapped = {
      ...remapped,
      view_section: remapped.view_section === '4D' ? '4E' : remapped.view_section,
      last_active_section: remapped.last_active_section === '4D' ? '4E' : remapped.last_active_section,
    }
  }
  const bumpMoneyClose = (s: string) => {
    if (s === '5D' || s === '5E') return '5C'
    if (s === '6A') return '7A'
    if (s === '7B' || s === '7C') return '7A'
    return s
  }
  remapped = {
    ...remapped,
    view_section: bumpMoneyClose(remapped.view_section),
    last_active_section: bumpMoneyClose(remapped.last_active_section),
  }
  return finalizeVenuePostCaptures(remapped)
}

function finalizeVenuePostCaptures(v: BookingIntakeVenueDataV3): BookingIntakeVenueDataV3 {
  const out = { ...v }
  if (out.confirmed_contact !== 'no_different_person') {
    out.contact_mismatch_context = ''
    out.contact_mismatch_note = ''
    out.contact_mismatch_linked_contact_id = null
    out.contact_mismatch_title_key = ''
  }
  if (out.onsite_same_contact !== 'different') {
    out.onsite_contact_name = ''
    out.onsite_contact_phone = ''
    out.onsite_contact_role = ''
    out.onsite_contact_title_key = ''
    out.onsite_poc_role = ''
    out.onsite_connect_method = ''
    out.onsite_connect_window = ''
    out.onsite_linked_contact_id = null
    out.onsite_title_context = ''
  } else if (!out.onsite_linked_contact_id) {
    if (out.onsite_name_flag !== 'capture_later') out.onsite_contact_name = ''
    if (out.onsite_phone_flag !== 'capture_later') out.onsite_contact_phone = ''
    if (out.onsite_name_flag !== 'capture_later' && out.onsite_phone_flag !== 'capture_later') {
      out.onsite_contact_role = ''
      out.onsite_contact_title_key = ''
      out.onsite_title_context = ''
    }
  }
  if (out.onsite_same_contact === 'different') {
    out.onsite_poc_role = ''
    out.onsite_connect_method = ''
    out.onsite_connect_window = ''
  }
  if (out.invoice_same_contact !== 'different') {
    out.invoice_company_text = ''
    out.invoice_email_text = ''
    out.billing_contact_name = ''
    out.billing_contact_email = ''
    out.billing_linked_contact_id = null
  } else {
    if (out.invoice_company_confirmed !== 'capture_later') out.invoice_company_text = ''
    if (out.invoice_email_confirmed !== 'capture_later') out.invoice_email_text = ''
    if (out.billing_linked_contact_id) {
      out.billing_contact_flag = ''
      out.billing_contact_name = ''
      out.billing_contact_email = ''
    } else if (out.billing_contact_flag !== 'capture_later') {
      out.billing_contact_name = ''
      out.billing_contact_email = ''
    }
  }
  out.artist_arrival_time = ''
  if (out.venue_access_notes_flag !== 'yes') {
    out.venue_access_note_tags = []
  }
  if (!out.venue_access_note_tags.includes('other')) {
    out.venue_access_other_notes = ''
  }
  return out
}

function parsePhase1Enum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback
}

function asVenueType(v: unknown): VenueType | '' {
  return typeof v === 'string' && (VENUE_TYPE_ORDER as string[]).includes(v) ? (v as VenueType) : ''
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

function asEquipmentVenueIncludesIds(v: unknown): EquipmentVenueIncludesIdV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(EQUIPMENT_VENUE_INCLUDES_KEYS as readonly string[])
  return v.filter(
    (x): x is EquipmentVenueIncludesIdV3 =>
      typeof x === 'string' && allowed.has(x as EquipmentVenueIncludesIdV3),
  )
}

function asEquipmentHybridCoverIds(v: unknown): EquipmentHybridCoverIdV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(EQUIPMENT_HYBRID_COVER_KEYS as readonly string[])
  return v.filter(
    (x): x is EquipmentHybridCoverIdV3 => typeof x === 'string' && allowed.has(x as EquipmentHybridCoverIdV3),
  )
}

function asLoadAccessTags(v: unknown): LoadAccessTagV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(LOAD_ACCESS_TAG_KEYS as readonly string[])
  return v.filter((x): x is LoadAccessTagV3 => typeof x === 'string' && allowed.has(x as LoadAccessTagV3))
}

function asVenueAccessNoteTags(v: unknown): VenueAccessNoteTagV3[] {
  if (!Array.isArray(v)) return []
  const allowed = new Set(VENUE_ACCESS_NOTE_TAG_KEYS as readonly string[])
  return v.filter(
    (x): x is VenueAccessNoteTagV3 => typeof x === 'string' && allowed.has(x as VenueAccessNoteTagV3),
  )
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
    'under_50',
    '50_100',
    'under_100',
    '100_250',
    '250_500',
    '100_300',
    '300_500',
    '500_750',
    '750_1000',
    '500_1000',
    '1000_2000',
    '2000_5000',
    '5000_10000',
    '10000_25000',
    '25000_50000',
    '50000_100000',
    '100000_250000',
    '250000_plus',
    '5000_plus',
  ]
  return typeof v === 'string' && (allowed as string[]).includes(v as CapacityRangeV3) ? (v as CapacityRangeV3) : ''
}

/** Infer `event_schedule_type` from legacy `event_archetype` when new fields are absent. */
export function hydrateEventScheduleFromLegacy(sd: BookingIntakeShowDataV3): BookingIntakeShowDataV3 {
  if (sd.event_schedule_type === 'one_off' || sd.event_schedule_type === 'recurring') return sd
  const a = sd.event_archetype
  if (a === 'weekly_residency') {
    return { ...sd, event_schedule_type: 'recurring', event_recurrence_interval: 'weekly' }
  }
  if (a === 'club_series') {
    return { ...sd, event_schedule_type: 'recurring', event_recurrence_interval: 'biweekly' }
  }
  if (a === 'annual_corporate') {
    return { ...sd, event_schedule_type: 'recurring', event_recurrence_interval: 'monthly' }
  }
  return { ...sd, event_schedule_type: 'one_off', event_recurrence_interval: '' }
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
    event_type_other: typeof o.event_type_other === 'string' ? o.event_type_other : '',
    venue_type: asVenueType(o.venue_type),
    venue_type_other: typeof o.venue_type_other === 'string' ? o.venue_type_other : '',
    setting: parsePhase1Enum(o.setting, PHASE2_SETTING_PARSE_KEYS, ''),
    setting_other_detail: typeof o.setting_other_detail === 'string' ? o.setting_other_detail : '',
    event_archetype: parsePhase1Enum(o.event_archetype, EVENT_ARCHETYPE_KEYS, ''),
    event_archetype_other_detail:
      typeof o.event_archetype_other_detail === 'string' ? o.event_archetype_other_detail : '',
    event_schedule_type: parsePhase1Enum(o.event_schedule_type, ['', 'one_off', 'recurring'], ''),
    event_recurrence_interval: parsePhase1Enum(
      o.event_recurrence_interval,
      ['', 'weekly', 'biweekly', 'monthly'],
      '',
    ),
    event_name_flag: parsePhase1Enum(o.event_name_flag, ['', 'capture_later', 'no_name_yet', 'other'], ''),
    event_date: typeof o.event_date === 'string' ? o.event_date : '',
    event_start_time: start,
    event_end_time: end,
    doors_open_time: typeof o.doors_open_time === 'string' ? o.doors_open_time : '',
    overnight_event: overnight,
    venue_name_flag: (() => {
      const f = parsePhase1Enum(
        o.venue_name_flag,
        ['', 'already_have', 'capture_later', 'tbd'],
        '',
      )
      if (f !== '') return f
      return base.venue_name_flag
    })(),
    city_flag: (() => {
      const f = parsePhase1Enum(o.city_flag, ['', 'already_have', 'capture_later', 'tbd'], '')
      if (f !== '') return f
      return base.city_flag
    })(),
    state_region: (() => {
      const v = o.state_region
      if (typeof v === 'string' && v.trim() !== '') return v.trim()
      return base.state_region
    })(),
    address_status: (() => {
      const a = parsePhase1Enum(
        o.address_status,
        ['', 'have_it', 'theyll_send', 'tbd_private'],
        '',
      )
      if (a !== '') return a
      return base.address_status
    })(),
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
    music_vibe_preset_ids: (() => {
      if (!Array.isArray(o.music_vibe_preset_ids)) return []
      return o.music_vibe_preset_ids.filter(
        (x): x is string => typeof x === 'string' && MUSIC_VIBE_PRESET_ID_SET.has(x),
      )
    })(),
    pricing_prefill_note: typeof o.pricing_prefill_note === 'string' ? o.pricing_prefill_note : '',
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
    equipment_intake_flow_version: o.equipment_intake_flow_version === 2 ? 2 : 0,
    equipment_mic: parsePhase1Enum(o.equipment_mic, ['', 'venue_has_mic', 'dj_brings_mic', 'not_discussed'], ''),
    equipment_sound_tech: (() => {
      const v = parsePhase1Enum(o.equipment_sound_tech, ['', 'yes', 'no', 'not_discussed'], '')
      return v === 'not_discussed' ? '' : v
    })(),
    equipment_sound_tech_contact_id:
      typeof o.equipment_sound_tech_contact_id === 'string' && o.equipment_sound_tech_contact_id.trim()
        ? o.equipment_sound_tech_contact_id.trim()
        : null,
    equipment_sound_tech_name:
      typeof o.equipment_sound_tech_name === 'string' ? o.equipment_sound_tech_name : '',
    venue_deck_type: parsePhase1Enum(
      o.venue_deck_type,
      ['', 'cdj', 'controller', 'turntable', 'all_in_one', 'not_sure'],
      '',
    ),
    venue_deck_model_id: typeof o.venue_deck_model_id === 'string' ? o.venue_deck_model_id : '',
    venue_deck_compatible:
      o.venue_deck_compatible === true ? true : o.venue_deck_compatible === false ? false : null,
    venue_mixer_brand: parsePhase1Enum(
      o.venue_mixer_brand,
      ['', 'pioneer_djm', 'rane', 'allen_heath', 'built_in', 'not_sure', 'other'],
      '',
    ),
    venue_mixer_model_id: typeof o.venue_mixer_model_id === 'string' ? o.venue_mixer_model_id : '',
    venue_mixer_compatible:
      o.venue_mixer_compatible === true ? true : o.venue_mixer_compatible === false ? false : null,
    venue_booth_monitor: parsePhase1Enum(o.venue_booth_monitor, ['', 'yes', 'no', 'not_sure'], ''),
    venue_laptop_connection: parsePhase1Enum(
      o.venue_laptop_connection,
      ['', 'usb_b_mixer', 'usb_drives_only', 'audio_interface', 'other', 'not_sure'],
      '',
    ),
    venue_usb_format: parsePhase1Enum(o.venue_usb_format, ['', 'fat32', 'exfat', 'not_sure'], ''),
    venue_pro_dj_link: parsePhase1Enum(
      o.venue_pro_dj_link,
      ['', 'yes', 'no', 'not_sure', 'standalone_usb'],
      '',
    ),
    venue_software: parsePhase1Enum(
      o.venue_software,
      ['', 'rekordbox', 'serato', 'traktor', 'engine_dj', 'not_sure'],
      '',
    ),
    gear_compatible: o.gear_compatible === true ? true : o.gear_compatible === false ? false : null,
    gear_bring_own_fee: o.gear_bring_own_fee === true,
    gear_flagged_for_discussion: o.gear_flagged_for_discussion === true,
    gear_tech_followup_needed: o.gear_tech_followup_needed === true,
    gear_tech_followup_completed: o.gear_tech_followup_completed === true,
    gear_tech_call_active: o.gear_tech_call_active === true,
    gear_tech_call_step: parsePhase1Enum(o.gear_tech_call_step, ['', 'T1', 'T2', 'T3', 'T4', 'T5'], ''),
    tech_soundcheck_time: typeof o.tech_soundcheck_time === 'string' ? o.tech_soundcheck_time : '',
    tech_setup_access: parsePhase1Enum(
      o.tech_setup_access,
      ['', 'before_doors', 'during_event', 'no_soundcheck'],
      '',
    ),
    venue_deck_other_notes: typeof o.venue_deck_other_notes === 'string' ? o.venue_deck_other_notes : '',
    venue_mixer_other_notes: typeof o.venue_mixer_other_notes === 'string' ? o.venue_mixer_other_notes : '',
    equipment_venue_includes: asEquipmentVenueIncludesIds(o.equipment_venue_includes),
    equipment_hybrid_covers: asEquipmentHybridCoverIds(o.equipment_hybrid_covers),
    equipment_dj_package_interest: parsePhase1Enum(
      o.equipment_dj_package_interest,
      ['', 'yes_walkthrough', 'no_simple', 'think_later'],
      '',
    ),
    equipment_hybrid_additions: parsePhase1Enum(
      o.equipment_hybrid_additions,
      ['', 'yeah_see', 'no_good', 'maybe_later'],
      '',
    ),
    equipment_revisit_production_5b: o.equipment_revisit_production_5b === true,
    equipment_setup_window: parsePhase1Enum(o.equipment_setup_window, [...EQUIPMENT_SETUP_WINDOW_KEYS], ''),
    equipment_production_soundcheck: o.equipment_production_soundcheck === 'scheduled' ? 'scheduled' : '',
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
    addon_autopop_ids: asStringIdList(o.addon_autopop_ids),
    addon_autopop_dismissed_ids: asStringIdList(o.addon_autopop_dismissed_ids),
    surcharge_ids: asStringIdList(o.surcharge_ids),
    discount_ids: asStringIdList(o.discount_ids),
    pricing_source: parsePhase1Enum(o.pricing_source, ['calculated', 'manual'], 'calculated'),
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
    city_text: (() => {
      const v = o.city_text
      if (typeof v === 'string' && v.trim() !== '') return v
      return base.city_text
    })(),
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
  if (parsed.travel_required === 'local') {
    parsed.lodging_status = ''
    parsed.travel_notes_flag = ''
    parsed.travel_booked_by = ''
    parsed.ground_transport = ''
  }
  if (parsed.balance_timing !== 'custom') parsed.balance_due_date = ''
  if (parsed.pricing_source !== 'manual') {
    parsed.pricing_source = 'calculated'
    parsed.manual_gross = null
    parsed.manual_pricing_reason = ''
  }
  if (!parsed.overtime_service_id.trim() && parsed.service_id.trim()) {
    parsed.overtime_service_id = parsed.service_id
  }
  return finalizeShowPostCaptures(hydrateEventScheduleFromLegacy(parsed))
}

export function intakeShowIsFestivalLikeProduction(sd: BookingIntakeShowDataV3): boolean {
  return sd.event_type === 'festival' || sd.setting === 'outdoor' || sd.setting === 'both'
}

/** DJ brings / hybrid, or festival-outdoor production — show load-in block on equipment card. */
export function intakeShowNeedsEquipmentArrivalSetup(sd: BookingIntakeShowDataV3): boolean {
  const ep = sd.equipment_provider
  if (ep === 'dj_brings' || ep === 'hybrid') return true
  return intakeShowIsFestivalLikeProduction(sd)
}

export function finalizeShowPostCaptures(sd: BookingIntakeShowDataV3): BookingIntakeShowDataV3 {
  const out = { ...sd }
  if (out.event_type !== 'other') out.event_type_other = ''
  if (out.venue_type !== 'other') out.venue_type_other = ''
  if (out.setting !== 'other') out.setting_other_detail = ''
  if (out.event_archetype !== 'other_archetype') out.event_archetype_other_detail = ''
  if (out.event_schedule_type !== 'recurring') out.event_recurrence_interval = ''
  if (out.event_schedule_type === 'one_off' || out.event_schedule_type === 'recurring') {
    out.event_archetype = ''
    out.event_archetype_other_detail = ''
  }
  if (!out.venue_name_flag) out.venue_name_text = ''
  if (!out.city_flag) out.city_text = ''
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
  if (out.pricing_source !== 'manual') {
    out.pricing_source = 'calculated'
    out.manual_gross = null
    out.manual_pricing_reason = ''
  }
  if (out.travel_required === 'local') {
    out.travel_booked_by = ''
    out.ground_transport = ''
  }
  const relax2a = intakePhase2aRelaxDynamicFilters(out)
  const allowedVenues = new Set(venueTypesForIntake2a(out.event_type, relax2a))
  if (out.venue_type && out.venue_type !== 'other' && !allowedVenues.has(out.venue_type)) {
    out.venue_type = ''
    out.venue_type_other = ''
  }
  if (out.equipment_intake_flow_version === 2 && out.equipment_provider) {
    const syn = synthesizeEquipmentCapabilityIds(out)
    const merged = new Set(out.equipment_capability_ids)
    for (const id of syn) merged.add(id)
    out.equipment_capability_ids = (EQUIPMENT_CAPABILITY_KEYS as readonly EquipmentCapabilityIdV3[]).filter(id =>
      merged.has(id),
    )
  }
  if (out.equipment_sound_tech !== 'yes') {
    out.equipment_sound_tech_contact_id = null
    out.equipment_sound_tech_name = ''
  }
  if (out.equipment_provider !== 'venue_provides' && out.equipment_provider !== 'hybrid') {
    Object.assign(out, emptyGearVerificationSlice())
  }
  const needsGearArrival = intakeShowNeedsEquipmentArrivalSetup(out)
  if (!needsGearArrival) {
    out.load_in_time = ''
    out.equipment_setup_window = ''
    out.load_in_access_tags = []
    out.equipment_production_soundcheck = ''
  } else if (!intakeShowIsFestivalLikeProduction(out)) {
    out.equipment_production_soundcheck = ''
  }
  out.soundcheck = ''
  out.load_in_discussed = ''
  return applyGearIntakeNormalization(out)
}

/** Human lines for deal/venue notes — structured fields captured on the live call. */
export function substantiveShowCaptureLines(sd: BookingIntakeShowDataV3): string[] {
  const lines: string[] = []
  if (sd.event_schedule_type === 'recurring') {
    const freq =
      sd.event_recurrence_interval === 'weekly'
        ? 'Weekly'
        : sd.event_recurrence_interval === 'biweekly'
          ? 'Bi-weekly'
          : sd.event_recurrence_interval === 'monthly'
            ? 'Monthly'
            : ''
    lines.push(freq ? `Event cadence: Recurring (${freq})` : 'Event cadence: Recurring')
  } else if (sd.event_schedule_type === 'one_off') {
    lines.push('Event cadence: One-off')
  } else if (sd.event_archetype === 'other_archetype') {
    const d = sd.event_archetype_other_detail.trim()
    lines.push(d ? `Event format: ${d}` : `Event format: ${EVENT_ARCHETYPE_LABELS.other_archetype}`)
  } else if (sd.event_archetype) {
    lines.push(`Event format: ${EVENT_ARCHETYPE_LABELS[sd.event_archetype as Exclude<EventArchetypeV3, ''>]}`)
  }
  if (sd.setting === 'other' && sd.setting_other_detail.trim()) {
    lines.push(`Setting: ${sd.setting_other_detail.trim()}`)
  } else if (sd.setting) {
    lines.push(`Setting: ${PHASE2_SETTING_LABELS[sd.setting as Exclude<Phase2SettingV3, ''>]}`)
  }
  if (sd.venue_archetype) {
    lines.push(`Venue type (discussed): ${VENUE_ARCHETYPE_LABELS[sd.venue_archetype as Exclude<VenueArchetypeV3, ''>]}`)
  }
  if (sd.event_type === 'other' && sd.event_type_other.trim()) {
    lines.push(`Event type (other): ${sd.event_type_other.trim()}`)
  }
  if (sd.venue_type === 'other' && sd.venue_type_other.trim()) {
    lines.push(`Venue category (other): ${sd.venue_type_other.trim()}`)
  }
  if (sd.address_detail_level) {
    lines.push(
      `Location detail: ${ADDRESS_DETAIL_LEVEL_LABELS[sd.address_detail_level as Exclude<AddressDetailLevelV3, ''>]}`,
    )
  }
  if (sd.approximate_headcount > 0) {
    lines.push(`Approx. headcount (discussed): ~${sd.approximate_headcount.toLocaleString()}`)
  }
  {
    const est = sd.event_start_time.trim()
    const ddoor = sd.doors_open_time.trim()
    if (ddoor) {
      if (est && ddoor !== est) lines.push(`Doors open: ${ddoor} (event start ${est})`)
      else lines.push(`Doors open: ${ddoor}`)
    }
  }
  if (sd.overnight_event) {
    lines.push('Event timing: crosses midnight (doors/event window).')
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
  if (sd.other_performers) {
    lines.push(PHASE3_OTHER_PERFORMERS_LABELS[sd.other_performers as Exclude<Phase3OtherPerformersV3, ''>])
  }
  if (sd.num_other_acts) {
    lines.push(PHASE3_NUM_OTHER_ACTS_LABELS[sd.num_other_acts as Exclude<Phase3NumOtherActsV3, ''>])
  }
  if (sd.billing_priority) {
    lines.push(PHASE3_BILLING_PRIORITY_LABELS[sd.billing_priority as Exclude<Phase3BillingPriorityV3, ''>])
  }
  if (sd.equipment_provider) {
    const ep = sd.equipment_provider as Exclude<Phase4EquipmentProviderV3, ''>
    lines.push(
      ep === 'venue_provides'
        ? 'DJ equipment: Venue provides'
        : ep === 'dj_brings'
          ? 'DJ equipment: DJ brings own'
          : 'DJ equipment: Hybrid',
    )
  }
  if (sd.equipment_mic) {
    const m = sd.equipment_mic as Exclude<EquipmentMicV3, ''>
    lines.push(
      `Mic: ${m === 'venue_has_mic' ? 'Venue has mic' : m === 'dj_brings_mic' ? 'DJ brings mic' : 'Not discussed'}`,
    )
  }
  if (sd.equipment_sound_tech === 'yes') {
    const id = sd.equipment_sound_tech_contact_id?.trim()
    const nm = sd.equipment_sound_tech_name.trim()
    if (nm) lines.push(`Sound tech on site: Yes — ${nm}`)
    else if (id) lines.push('Sound tech on site: Yes — linked venue contact')
    else lines.push('Sound tech on site: Yes')
  } else if (sd.equipment_sound_tech === 'no') {
    lines.push('Sound tech on site: No')
  }
  if (intakeShowsGearVerification(sd) && (sd.venue_deck_type || sd.venue_mixer_brand || sd.venue_booth_monitor)) {
    const g: string[] = []
    if (sd.venue_deck_type === 'not_sure') g.push('Decks: not sure — confirm with tech')
    else if (sd.venue_deck_type) {
      const deckLabel =
        sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID
          ? sd.venue_deck_other_notes.trim() || 'Other (post-call)'
          : sd.venue_deck_model_id.trim()
            ? getDeckById(sd.venue_deck_model_id)?.display ?? sd.venue_deck_model_id
            : '(model TBD)'
      g.push(`Decks (${sd.venue_deck_type}): ${deckLabel}`)
    }
    if (sd.venue_mixer_brand === 'not_sure') g.push('Mixer: not sure — confirm with tech')
    else if (sd.venue_mixer_brand === 'built_in') g.push('Mixer: built-in on controller')
    else if (sd.venue_mixer_brand === 'other') {
      g.push(
        `Mixer: other${sd.venue_mixer_other_notes.trim() ? ` — ${sd.venue_mixer_other_notes.trim()}` : ''}`,
      )
    } else if (sd.venue_mixer_brand) {
      const mx =
        sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID
          ? sd.venue_mixer_other_notes.trim() || 'Other (post-call)'
          : sd.venue_mixer_model_id.trim()
            ? getMixerById(sd.venue_mixer_model_id)?.display ?? sd.venue_mixer_model_id
            : '(model TBD)'
      g.push(`Mixer: ${mx}`)
    }
    if (sd.venue_booth_monitor === 'yes') g.push('Booth monitor: yes')
    else if (sd.venue_booth_monitor === 'no') g.push('Booth monitor: no — needs arrangement')
    else if (sd.venue_booth_monitor === 'not_sure') g.push('Booth monitor: not sure')
    if (sd.gear_bring_own_fee) g.push('BYO decks/controller fee ($200) agreed')
    if (sd.gear_flagged_for_discussion) g.push('Gear: flagged for discussion')
    if (sd.tech_soundcheck_time.trim() && sd.tech_setup_access) {
      g.push(`Tech soundcheck: ${sd.tech_soundcheck_time.trim()} (${sd.tech_setup_access})`)
    }
    if (g.length) lines.push(`Gear / tech: ${g.join(' · ')}`)
  }
  if (sd.equipment_venue_includes.length) {
    lines.push(
      `Venue setup includes: ${sd.equipment_venue_includes.map(id => EQUIPMENT_VENUE_INCLUDES_LABELS[id]).join('; ')}`,
    )
  }
  if (sd.equipment_hybrid_covers.length) {
    lines.push(
      `Venue covers (hybrid): ${sd.equipment_hybrid_covers.map(id => EQUIPMENT_HYBRID_COVER_LABELS[id]).join('; ')}`,
    )
  }
  if (sd.equipment_dj_package_interest) {
    lines.push(
      EQUIPMENT_DJ_PACKAGE_INTEREST_LABELS[sd.equipment_dj_package_interest as Exclude<EquipmentDjPackageInterestV3, ''>],
    )
  }
  if (sd.equipment_hybrid_additions) {
    lines.push(
      EQUIPMENT_HYBRID_ADDITIONS_LABELS[sd.equipment_hybrid_additions as Exclude<EquipmentHybridAdditionsV3, ''>],
    )
  }
  if (sd.equipment_revisit_production_5b) {
    lines.push('Production upsell: flagged to revisit in §5B')
  }
  if (sd.equipment_capability_ids.length) {
    lines.push(
      `Equipment discussed: ${sd.equipment_capability_ids.map(id => EQUIPMENT_CAPABILITY_LABELS[id]).join('; ')}`,
    )
  }
  if (sd.load_in_time.trim()) {
    lines.push(`Load-in time: ${sd.load_in_time.trim()}`)
  }
  if (sd.equipment_setup_window) {
    const w = sd.equipment_setup_window as Exclude<Phase4SetupWindowV3, ''>
    lines.push(`Setup window: ${EQUIPMENT_SETUP_WINDOW_LABELS[w]}`)
  }
  if (sd.equipment_production_soundcheck === 'scheduled') {
    lines.push('Production soundcheck: scheduled')
  }
  if (sd.load_in_access_tags.length) {
    lines.push(`Load-in access: ${sd.load_in_access_tags.map(t => LOAD_ACCESS_TAG_LABELS[t]).join('; ')}`)
  }
  if (sd.parking_access_class) {
    lines.push(
      `Parking (class): ${PARKING_ACCESS_CLASS_LABELS[sd.parking_access_class as Exclude<ParkingAccessClassV3, ''>]}`,
    )
  }
  if (sd.parking_status) {
    lines.push(PHASE4_PARKING_STATUS_LABELS[sd.parking_status as Exclude<Phase4ParkingStatusV3, ''>])
  }
  if (sd.lodging_status) {
    lines.push(PHASE4_LODGING_STATUS_LABELS[sd.lodging_status as Exclude<Phase4LodgingStatusV3, ''>])
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

export function phase1CaptureOwnerLabel(data: BookingIntakeVenueDataV3, ownerRaw: string): string {
  const owner = ownerRaw.trim()
  if (!owner) return 'unspecified'
  if (owner === 'primary_on_file') {
    const n = data.contact_name.trim()
    return n ? `${n} (on file)` : 'Primary on file'
  }
  if (owner === 'on_call') {
    const n = data.contact_mismatch_note.trim()
    return n ? `${n} (on call)` : 'On call'
  }
  return `contact id ${owner}`
}

export function substantiveVenueCaptureLines(v: BookingIntakeVenueDataV3): string[] {
  const lines: string[] = []
  if (v.inquiry_source) {
    lines.push(`Lead source: ${INQUIRY_SOURCE_LABELS[v.inquiry_source as Exclude<InquirySourceV3, ''>]}`)
  }
  if (v.inquiry_summary.trim()) {
    lines.push(`Inquiry summary: ${v.inquiry_summary.trim()}`)
  }
  if (v.pre_call_notes.trim()) {
    lines.push(`Pre-call notes: ${v.pre_call_notes.trim()}`)
  }
  if (v.known_venue_name.trim()) {
    lines.push(`Known venue (pre-call): ${v.known_venue_name.trim()}`)
  }
  if (v.known_city.trim()) {
    lines.push(`Known city (pre-call): ${v.known_city.trim()}`)
  }
  if (v.known_event_date.trim()) {
    lines.push(`Known date (pre-call): ${v.known_event_date.trim()}`)
  }
  if (v.known_event_type) {
    lines.push(`Known event type (pre-call): ${knownEventTypeLabel(v.known_event_type, '')}`)
  }
  if (v.phone_confirmed) {
    lines.push(PHASE1_PHONE_CONFIRMED_LABELS[v.phone_confirmed as Exclude<Phase1PhoneConfirmedV3, ''>])
  }
  if (v.email_confirmed) {
    lines.push(PHASE1_EMAIL_CONFIRMED_LABELS[v.email_confirmed as Exclude<Phase1EmailConfirmedV3, ''>])
  }
  if (v.company_confirmed) {
    lines.push(PHASE1_COMPANY_CONFIRMED_LABELS[v.company_confirmed as Exclude<Phase1CompanyConfirmedV3, ''>])
  }
  if (v.confirmed_contact === 'no_different_person') {
    const name = v.contact_mismatch_note.trim()
    const tk = v.contact_mismatch_title_key.trim()
    const roleKey = v.contact_mismatch_context
    const role =
      tk && tk in CONTACT_TITLE_LABELS
        ? CONTACT_TITLE_LABELS[tk as ContactTitleKey]
        : roleKey
          ? CONTACT_MISMATCH_CONTEXT_LABELS[roleKey as Exclude<Phase1ContactMismatchContextV3, ''>]
          : ''
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
  if (v.contact_phone_added.trim()) {
    lines.push(
      `Additional phone (${phase1CaptureOwnerLabel(v, v.contact_phone_added_owner)}): ${v.contact_phone_added.trim()}`,
    )
  }
  if (v.contact_email_added.trim()) {
    lines.push(
      `Additional email (${phase1CaptureOwnerLabel(v, v.contact_email_added_owner)}): ${v.contact_email_added.trim()}`,
    )
  }
  if (v.onsite_same_contact === 'different') {
    const onName = v.onsite_contact_name.trim()
    const onTk = v.onsite_contact_title_key.trim()
    const onCtx = v.onsite_title_context.trim()
    const onRoleLbl =
      onTk && onTk in CONTACT_TITLE_LABELS
        ? CONTACT_TITLE_LABELS[onTk as ContactTitleKey]
        : onCtx && (CONTACT_MISMATCH_CONTEXT_KEYS as readonly string[]).includes(onCtx)
          ? CONTACT_MISMATCH_CONTEXT_LABELS[onCtx as Exclude<Phase1ContactMismatchContextV3, ''>]
          : ''
    if (onName && onRoleLbl) lines.push(`On-site contact: ${onName} (${onRoleLbl})`)
    else if (onName) lines.push(`On-site contact: ${onName}`)
    else if (onRoleLbl) lines.push(`On-site contact: ${onRoleLbl}`)
  }
  if (v.onsite_poc_role) {
    lines.push(`On-site role (logistics): ${ONSITE_POC_ROLE_LABELS[v.onsite_poc_role as Exclude<OnsitePocRoleV3, ''>]}`)
  }
  if (v.onsite_connect_method) {
    lines.push(
      `On-site connect: ${ONSITE_CONNECT_METHOD_LABELS[v.onsite_connect_method as Exclude<OnsiteConnectMethodV3, ''>]}`,
    )
  }
  if (v.onsite_connect_window) {
    lines.push(
      `On-site connect window: ${ONSITE_CONNECT_WINDOW_LABELS[v.onsite_connect_window as Exclude<OnsiteConnectWindowV3, ''>]}`,
    )
  }
  if (v.invoice_same_contact === 'different') {
    lines.push(PHASE5_INVOICE_SAME_LABELS.different)
    if (v.invoice_company_confirmed) {
      lines.push(PHASE5_INVOICE_CONFIRM_LABELS[v.invoice_company_confirmed as Exclude<Phase5InvoiceConfirmV3, ''>])
    }
    if (v.invoice_email_confirmed) {
      lines.push(
        `Invoice email status: ${PHASE5_INVOICE_CONFIRM_LABELS[v.invoice_email_confirmed as Exclude<Phase5InvoiceConfirmV3, ''>]}`,
      )
    }
    if (v.billing_contact_flag) {
      lines.push(PHASE5_BILLING_FLAG_LABELS[v.billing_contact_flag as Exclude<Phase5BillingContactFlagV3, ''>])
    }
    if (v.invoice_company_text.trim()) {
      lines.push(`Invoice company (typed): ${v.invoice_company_text.trim()}`)
    }
    if (v.invoice_email_text.trim()) {
      lines.push(`Invoice email (typed): ${v.invoice_email_text.trim()}`)
    }
    if (v.billing_contact_name.trim()) {
      lines.push(`Billing contact name: ${v.billing_contact_name.trim()}`)
    }
    if (v.billing_contact_email.trim()) {
      lines.push(`Billing contact email: ${v.billing_contact_email.trim()}`)
    }
  }
  const arrNote = v.artist_arrival_note.trim()
  if (
    arrNote &&
    (ARTIST_ARRIVAL_NOTE_KEYS as readonly string[]).includes(arrNote as Phase4ArtistArrivalNoteV3) &&
    arrNote !== ''
  ) {
    lines.push(
      `Artist arrival: ${ARTIST_ARRIVAL_NOTE_LABELS[arrNote as Exclude<Phase4ArtistArrivalNoteV3, ''>]}`,
    )
  } else if (v.artist_arrival_time.trim()) {
    lines.push(`Artist arrival: ${v.artist_arrival_time.trim()}`)
  }
  if (v.venue_access_notes_flag === 'yes' && v.venue_access_note_tags.length) {
    lines.push(
      `Venue access: ${v.venue_access_note_tags.map(t => VENUE_ACCESS_NOTE_TAG_LABELS[t]).join('; ')}`,
    )
  }
  if (v.venue_access_other_notes.trim()) {
    lines.push(`Venue access (other): ${v.venue_access_other_notes.trim()}`)
  }
  if (v.dj_parking) {
    lines.push(`DJ parking: ${DJ_PARKING_V3_LABELS[v.dj_parking]}`)
  }
  if (v.close_artifact_tags.length) {
    lines.push(`Close plan: ${v.close_artifact_tags.map(t => CLOSE_ARTIFACT_TAG_LABELS[t]).join('; ')}`)
  }
  if (v.send_agreement) {
    lines.push(`Close — paperwork: ${PHASE7_SEND_AGREEMENT_LABELS[v.send_agreement as Exclude<Phase7SendAgreementV3, ''>]}`)
  }
  if (v.deposit_on_call) {
    lines.push(PHASE7_DEPOSIT_ON_CALL_LABELS[v.deposit_on_call as Exclude<Phase7DepositOnCallV3, ''>])
  }
  if (v.client_energy) {
    lines.push(PHASE7_CLIENT_ENERGY_LABELS[v.client_energy as Exclude<Phase7ClientEnergyV3, ''>])
  }
  if (v.has_follow_ups) {
    lines.push(PHASE7_HAS_FOLLOW_UPS_LABELS[v.has_follow_ups as Exclude<Phase7HasFollowUpsV3, ''>])
  }
  if (v.follow_up_topics.length) {
    lines.push(
      `Follow-up topics: ${v.follow_up_topics.map(t => FOLLOW_UP_TOPIC_LABELS[t as FollowUpTopicKeyV3]).join('; ')}`,
    )
  }
  if (v.follow_up_date.trim()) {
    lines.push(`Follow-up date (discussed): ${v.follow_up_date.trim()}`)
  }
  if (v.call_status) {
    lines.push(PHASE7_CALL_STATUS_LABELS[v.call_status as Exclude<Phase7CallStatusV3, ''>])
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
