import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronLeft,
  Loader2,
  Mic2,
  Pin,
  Save,
  Search,
  Undo2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBookingIntakes, type BookingIntakeShowRow } from '@/hooks/useBookingIntakes'
import { usePricingCatalog } from '@/hooks/usePricingCatalog'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useNavBadges } from '@/context/NavBadgesContext'
import { SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'
import { supabase } from '@/lib/supabase'
import {
  catalogHasMinimumForDealLogging,
  computeDealPrice,
  computeDealPriceBreakdown,
  type ComputeDealPriceInput,
  isWeekendDate,
  roundUsd,
} from '@/lib/pricing/computeDealPrice'
import {
  computeIntakePricingSetupAutopop,
  intakeServiceLooksDjOnlyUsb,
} from '@/lib/pricing/intakePricingAutopop'
import { cn } from '@/lib/utils'
import {
  CAPACITY_RANGE_OPTIONS,
  CONTACT_MISMATCH_CONTEXT_LABELS,
  CONTACT_MISMATCH_ROLE_ORDER,
  computeOvernightEvent,
  computeSetLengthHours,
  defaultIntakeTitleV3,
  formatSetLengthDisplay,
  INTAKE_SCHEMA_VERSION_V3,
  INTAKE_DEFAULT_EVENT_CITY_TEXT,
  INTAKE_DEFAULT_EVENT_STATE_REGION,
  livePathSections,
  livePhaseIndexFromSection,
  liveSectionTitle,
  genreSetsEqual,
  INTAKE_DEFAULT_GENRES,
  MUSIC_VIBE_PRESETS,
  PERFORMANCE_ROLE_OPTIONS,
  PERFORMANCE_GENRE_LABELS,
  PERFORMANCE_GENRE_VALUES,
  finalizeShowPostCaptures,
  intakePhase2aRelaxDynamicFilters,
  parseShowDataV3,
  parseVenueDataV3,
  phase1CaptureOwnerLabel,
  LIVE_PAYMENT_METHOD_KEYS,
  PAYMENT_METHOD_LABELS,
  PHASE2_SETTING_OPTIONS,
  POST_CALL_SECTION_ORDER,
  showLabelFromEventDate,
  stubSectionId,
  suggestedBillableHoursFromShow,
  suggestedCommissionTierForVenue,
  suggestedOutreachStatusFromPhase7Close,
  suggestedPromiseLinesFromEarlierPhases,
  US_STATE_OPTIONS,
  findIntakeVenuePickById,
  intakeVenueDefaultPickForEventType,
  intakeVenuePickOptionsForEvent,
  intakeVenuePickValueFromShow,
  knownEventTypeLabel,
  venueTypesForIntake2a,
  VENUE_PROMISE_LINE_OPTIONS,
  VENUE_ACCESS_NOTE_TAG_KEYS,
  VENUE_ACCESS_NOTE_TAG_LABELS,
  FOLLOW_UP_TOPIC_KEYS,
  FOLLOW_UP_TOPIC_LABELS,
  GROUND_TRANSPORT_KEYS,
  GROUND_TRANSPORT_LABELS,
  MANUAL_PRICING_REASON_KEYS,
  DJ_PARKING_V3_KEYS,
  DJ_PARKING_V3_LABELS,
  TRAVEL_BOOKED_BY_KEYS,
  TRAVEL_BOOKED_BY_LABELS,
  type BookingIntakeShowDataV3,
  type BookingIntakeVenueDataV3,
  type CapacityRangeV3,
  type KnownEventTypeV3,
  type PerformanceGenreV3,
  type Phase1ContactMismatchContextV3,
  type Phase2SettingV3,
  type Phase4LodgingStatusV3,
  type Phase4OnsiteSameContactV3,
  type Phase4DjParkingV3,
  type Phase2VenueAccessNotesFlagV3,
  type Phase4TravelNotesFlagV3,
  type Phase4TravelRequiredV3,
  type Phase5BalanceTimingV3,
  type Phase5DepositPercentV3,
  type Phase7CallStatusV3,
  type Phase7ClientEnergyV3,
  type Phase7SendAgreementV3,
  type Phase7DepositOnCallV3,
  type Phase7HasFollowUpsV3,
  type PaymentMethodKeyV3,
  type FollowUpTopicKeyV3,
  type ManualPricingReasonV3,
  type VenuePromiseLineIdV3,
  type VenueAccessNoteTagV3,
} from '@/lib/intake/intakePayloadV3'
import {
  contactRoleForDisplay,
  contactToMismatchContext,
  isVenueSoundTechContact,
} from '@/lib/contacts/contactTitles'
import type {
  CommissionTier,
  Contact,
  Deal,
  OutreachTrack,
  PricingCatalogDoc,
  PricingDiscount,
  Venue,
} from '@/types'
import {
  COMMISSION_TIER_LABELS,
  COMMISSION_TIER_RATES,
  OUTREACH_STATUS_LABELS,
  OUTREACH_TRACK_LABELS,
  VENUE_TYPE_LABELS,
} from '@/types'
import { mapShowBundleToEarningsImport } from '@/lib/intake/mapIntakeToDealForm'
import { mapIntakeVenueDataV3ToVenueRow, intakeContactsFromVenueDataV3 } from '@/lib/intake/mapIntakeToVenue'
import { buildEndCallOutreachNote, buildVenueImportOutreachNote } from '@/lib/intake/intakeOutreachActivity'
import { upsertIntakeVenueContactsForVenue } from '@/lib/intake/syncIntakeVenueContacts'
import { importDealFromIntakeShow } from '@/lib/intake/importDealFromIntakeShow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  IntakeCallVibeChips,
  IntakeCompactChipRow,
  IntakeCompactDual,
  IntakeLiveScriptCaptureStack,
  IntakeYesNoPair,
} from '@/pages/booking-intake/intakeLivePrimitives'
import {
  EquipmentIntakeFlowCapture,
  type EquipmentSoundTechPickOption,
  type SoundTechUiContext,
} from '@/pages/booking-intake/EquipmentIntakeFlowCapture'
import { Intake2bSchedulePanel } from '@/pages/booking-intake/Intake2bSchedulePanel'
import { addHoursToQuarterHm, INTAKE_DEFAULT_EVENT_DURATION_HOURS } from '@/lib/intake/quarterHourTimes'
import { IntakeQuarterHourTimeField } from '@/pages/booking-intake/IntakeQuarterHourTimeField'

async function insertIntakeOutreachActivityNote(venueId: string, note: string): Promise<void> {
  const t = note.trim()
  if (!t) return
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user?.id) return
  await supabase.from('outreach_notes').insert({
    venue_id: venueId,
    user_id: auth.user.id,
    note: t,
    category: 'intake',
  })
}

function intakeHmKey(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t.trim())
  if (!m) return t.trim()
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function postCallPromiseLineUi(
  rawVal: string,
  lineId: VenuePromiseLineIdV3,
): { status: 'set' | 'open' | 'warn'; summary: string } {
  const opts = VENUE_PROMISE_LINE_OPTIONS[lineId]
  const found = rawVal ? opts.find(o => o.value === rawVal) : undefined
  const summary = found?.label ?? (rawVal ? rawVal : 'Not discussed')
  if (!rawVal || rawVal === 'not_discussed') {
    return { status: 'open', summary }
  }
  if (rawVal === 'no' || rawVal === 'need_confirm') {
    return { status: 'warn', summary }
  }
  return { status: 'set', summary }
}

const LIVE_PHASES = [
  { id: '1', label: 'Opening' },
  { id: '2', label: 'Event' },
  { id: '3', label: 'Performance' },
  { id: '4', label: 'Technical' },
  { id: '5', label: 'Money' },
  { id: '6', label: 'Close' },
] as const

/** Compact chip copy for §5C manual override (spec wording). */
const MANUAL_PRICING_CHIP_LABELS: Record<Exclude<ManualPricingReasonV3, ''>, string> = {
  friend_rate: 'Friend rate',
  bundle: 'Bundled dates',
  trade: 'Trade / contra',
  promo: 'Promo',
  tax_inclusive: 'Tax-inclusive',
  client_math: 'Matched their budget',
  rate_match: 'Rate match',
  other_reason: 'Other',
}

/** Max venue contacts shown as chips; “Type name” is an extra chip → dropdown when names would exceed 4 chips total. */
const BILLING_CONTACT_CHIP_MAX_NAMES = 3
const BILLING_CONTACT_PICK_MANUAL = '__billing_manual__'
const BILLING_CONTACT_PICK_UNSET = '__billing_unset__'

/** Brand / semantic tint on live payment chips (Apple Pay + Check = yellow). */
function paymentMethodChipTextClass(k: PaymentMethodKeyV3, selected: boolean): string {
  if (selected) {
    switch (k) {
      case 'zelle':
        return 'text-violet-700'
      case 'venmo':
        return 'text-sky-700'
      case 'paypal':
        return 'text-blue-800'
      case 'apple_pay':
      case 'check':
        return 'text-amber-900'
      default:
        return 'text-neutral-950'
    }
  }
  switch (k) {
    case 'zelle':
      return 'text-violet-400 hover:text-violet-300'
    case 'venmo':
      return 'text-sky-400 hover:text-sky-300'
    case 'paypal':
      return 'text-blue-600 hover:text-blue-500'
    case 'apple_pay':
    case 'check':
      return 'text-amber-200 hover:text-amber-100'
    default:
      return 'text-neutral-400 hover:text-neutral-200'
  }
}

function addBusinessDaysFromToday(weekdays: number): string {
  const d = new Date()
  d.setHours(12, 0, 0, 0)
  let n = 0
  while (n < weekdays) {
    d.setDate(d.getDate() + 1)
    const w = d.getDay()
    if (w !== 0 && w !== 6) n += 1
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Fri–Mon window around US Memorial Day (last Monday of May). */
function eventDateInMemorialDayWeekendBand(eventIso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventIso)) return false
  const [Y, M, D] = eventIso.split('-').map(Number)
  const t = new Date(Y, M - 1, D)
  t.setHours(12, 0, 0, 0)
  const lastMon = new Date(Y, 4, 31)
  lastMon.setHours(12, 0, 0, 0)
  while (lastMon.getDay() !== 1) {
    lastMon.setDate(lastMon.getDate() - 1)
  }
  const fri = new Date(lastMon)
  fri.setDate(fri.getDate() - 3)
  fri.setHours(12, 0, 0, 0)
  const mon = new Date(lastMon)
  mon.setHours(12, 0, 0, 0)
  return t >= fri && t <= mon
}

/** Subtle hint only — operator still chooses surcharges. */
function peakSeasonHintLabel(eventIso: string | undefined): string | null {
  if (!eventIso || !/^\d{4}-\d{2}-\d{2}$/.test(eventIso)) return null
  const [Y, M, D] = eventIso.split('-').map(Number)
  const t = new Date(Y, M - 1, D)
  const m = t.getMonth() + 1
  const d = t.getDate()
  const md = m * 100 + d
  if (m === 12 && d >= 20) return 'Peak season window (Christmas / NYE)'
  if (m === 1 && d <= 2) return 'Peak season window (Christmas / NYE)'
  if (md >= 1025 && md <= 1101) return 'Peak season window (Halloween week)'
  if (m === 4 && d >= 10 && d <= 25) return 'Peak season window (festival week — check Coachella)'
  if (m === 6 && d >= 28) return 'Peak season window (July 4th week)'
  if (m === 7 && d <= 6) return 'Peak season window (July 4th week)'
  if (m === 2 && md >= 213 && md <= 215) return 'Peak season window (Valentine’s weekend)'
  const feb1 = new Date(Y, 1, 1)
  const febDow0 = feb1.getDay()
  const firstSundayFeb = 1 + ((7 - febDow0) % 7)
  if (m === 2 && d >= firstSundayFeb - 2 && d <= firstSundayFeb + 1)
    return 'Peak season window (early Feb — Super Bowl / Grammy — verify dates)'
  const nov1 = new Date(Y, 10, 1)
  const novDow = nov1.getDay()
  const firstThuNov = 1 + ((4 - novDow + 7) % 7)
  const thanksgivingDay = firstThuNov + 21
  if (m === 11 && d >= thanksgivingDay - 3 && d <= thanksgivingDay + 3)
    return 'Peak season window (Thanksgiving week)'
  if ((m === 5 && d >= 24 && d <= 27) || (m === 9 && d >= 1 && d <= 7) || (m === 7 && d >= 3 && d <= 5))
    return 'Peak season window (holiday weekend)'
  if (eventDateInMemorialDayWeekendBand(eventIso)) return 'Peak season window (Memorial Day weekend)'
  return null
}

function eventTypeSuggestsExclusivitySurcharge(eventType: KnownEventTypeV3 | ''): boolean {
  return eventType === 'corporate' || eventType === 'wedding' || eventType === 'brand_activation'
}

function surchargeAutopopBadge(
  sd: BookingIntakeShowDataV3,
  s: { id: string; name: string },
  eventDate: string,
): string | null {
  const n = addonNameNorm(s.name)
  const peak = peakSeasonHintLabel(eventDate.trim())
  if (peak && /peak/i.test(n)) return 'Peak season'
  if (eventTypeSuggestsExclusivitySurcharge(sd.event_type) && (n.includes('exclusiv') || n.includes('nda')))
    return 'Often paired'
  return null
}

function isLargeCapacityForPackageHint(sd: BookingIntakeShowDataV3): boolean {
  if (sd.approximate_headcount >= 2000) return true
  const r = sd.capacity_range
  return (
    r === '2000_5000' ||
    r === '5000_10000' ||
    r === '10000_25000' ||
    r === '25000_50000' ||
    r === '50000_100000' ||
    r === '100000_250000' ||
    r === '250000_plus' ||
    r === '5000_plus'
  )
}

function addonNameNorm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

function shouldHideAddonTile(
  addon: { id: string; name: string },
  sd: BookingIntakeShowDataV3,
): boolean {
  const n = addonNameNorm(addon.name)
  const isHighEndSound =
    (n.includes('sound') || n.includes('pa')) && (n.includes('high') || n.includes('premium') || n.includes('upgrade'))
  if (isHighEndSound) {
    if (sd.equipment_provider === 'venue_provides') return true
    if (sd.equipment_provider === 'dj_brings' && sd.pricing_mode === 'package' && sd.package_id.trim()) return true
  }
  if (sd.event_type === 'club_night') {
    if (n.includes('karaoke')) return true
    if (n.includes('photo') && n.includes('booth')) return true
    if (n.includes('dance floor') || (n.includes('led') && n.includes('floor'))) return true
  }
  return false
}

function isVisualEffectsAddon(addon: { name: string }): boolean {
  const n = addonNameNorm(addon.name)
  return n.includes('visual') || n.includes('effect') || n.includes('spark') || n.includes('co2')
}

function isCustomSetlistAddon(addon: { name: string }): boolean {
  const n = addonNameNorm(addon.name)
  return n.includes('setlist') || (n.includes('custom') && n.includes('set'))
}

function isMcAddon(addon: { name: string }): boolean {
  const n = addonNameNorm(addon.name)
  return /\bmc\b/.test(n) || n.includes('emcee') || n.includes('host ')
}

function isGuestArtistAddon(addon: { name: string }): boolean {
  const n = addonNameNorm(addon.name)
  return (
    n.includes('guest artist') ||
    n.includes('guest ') ||
    n.includes('additional performer') ||
    n.includes('second operator')
  )
}

/** Live 4B — new on-site POC (artist arrival / night-of) saved to `contacts.role` when operator adds a name. */
const INTAKE_4B_NEW_ONSITE_CONTACT_TITLE: Exclude<Phase1ContactMismatchContextV3, ''> = 'day_of_coordinator'

const EVENT_TYPE_OPTIONS: { value: KnownEventTypeV3; label: string }[] = [
  { value: 'after_party', label: 'After-Party' },
  { value: 'private_event', label: 'Private Event' },
  { value: 'club_night', label: 'Club Night' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'wedding', label: 'Wedding' },
  { value: 'festival', label: 'Festival' },
  { value: 'concert', label: 'Concert' },
  { value: 'brand_activation', label: 'Brand Activation' },
  { value: 'other', label: 'Other' },
]

function pick2a(d: BookingIntakeShowDataV3): Pick<
  BookingIntakeShowDataV3,
  | 'event_type'
  | 'event_type_other'
  | 'venue_type'
  | 'venue_type_other'
  | 'setting'
  | 'setting_other_detail'
  | 'event_schedule_type'
  | 'event_recurrence_interval'
  | 'event_name_text'
> {
  return {
    event_type: d.event_type,
    event_type_other: d.event_type_other,
    venue_type: d.venue_type,
    venue_type_other: d.venue_type_other,
    setting: d.setting,
    setting_other_detail: d.setting_other_detail,
    event_schedule_type: d.event_schedule_type,
    event_recurrence_interval: d.event_recurrence_interval,
    event_name_text: d.event_name_text,
  }
}

/** “Other” free-text: chevron back inside the field so row height matches dropdowns. */
function Intake2aOtherFieldInput({
  placeholder,
  value,
  onValueChange,
  onBackToPresets,
}: {
  placeholder: string
  value: string
  onValueChange: (v: string) => void
  onBackToPresets: () => void
}) {
  return (
    <div className="relative">
      <Input
        className="h-11 border-neutral-800 bg-neutral-950/80 pr-10"
        placeholder={placeholder}
        value={value}
        onChange={e => onValueChange(e.target.value)}
      />
      <button
        type="button"
        onClick={onBackToPresets}
        className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-white/[0.06] hover:text-neutral-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400"
        aria-label="Back to preset options"
        title="Back to presets"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
    </div>
  )
}

function pick2b(d: BookingIntakeShowDataV3): Pick<
  BookingIntakeShowDataV3,
  | 'event_date'
  | 'event_start_time'
  | 'event_end_time'
  | 'doors_open_time'
  | 'overnight_event'
  | 'set_start_time'
  | 'set_end_time'
  | 'overnight_set'
> {
  return {
    event_date: d.event_date,
    event_start_time: d.event_start_time,
    event_end_time: d.event_end_time,
    doors_open_time: d.doors_open_time,
    overnight_event: d.overnight_event,
    set_start_time: d.set_start_time,
    set_end_time: d.set_end_time,
    overnight_set: d.overnight_set,
  }
}

function pick2c(d: BookingIntakeShowDataV3): Pick<
  BookingIntakeShowDataV3,
  | 'venue_name_flag'
  | 'venue_name_text'
  | 'city_flag'
  | 'city_text'
  | 'state_region'
  | 'address_status'
  | 'street_address'
  | 'address_line2'
  | 'postal_code'
  | 'capacity_range'
> {
  return {
    venue_name_flag: d.venue_name_flag,
    venue_name_text: d.venue_name_text,
    city_flag: d.city_flag,
    city_text: d.city_text,
    state_region: d.state_region,
    address_status: d.address_status,
    street_address: d.street_address,
    address_line2: d.address_line2,
    postal_code: d.postal_code,
    capacity_range: d.capacity_range,
  }
}

function pick3b(d: BookingIntakeShowDataV3): Pick<BookingIntakeShowDataV3, 'genres'> {
  return { genres: [...d.genres] }
}

function pick4a(
  d: BookingIntakeShowDataV3,
): Pick<
  BookingIntakeShowDataV3,
  | 'equipment_provider'
  | 'equipment_capability_ids'
  | 'equipment_intake_flow_version'
  | 'equipment_mic'
  | 'equipment_sound_tech'
  | 'equipment_sound_tech_contact_id'
  | 'equipment_sound_tech_name'
  | 'equipment_venue_includes'
  | 'equipment_hybrid_covers'
  | 'equipment_dj_package_interest'
  | 'equipment_hybrid_additions'
  | 'equipment_revisit_production_5b'
  | 'pricing_mode'
  | 'package_id'
  | 'addon_quantities'
  | 'addon_autopop_ids'
  | 'addon_autopop_dismissed_ids'
  | 'load_in_time'
  | 'equipment_setup_window'
  | 'load_in_access_tags'
  | 'equipment_production_soundcheck'
> {
  return {
    equipment_provider: d.equipment_provider,
    equipment_capability_ids: [...d.equipment_capability_ids],
    equipment_intake_flow_version: d.equipment_intake_flow_version,
    equipment_mic: d.equipment_mic,
    equipment_sound_tech: d.equipment_sound_tech,
    equipment_sound_tech_contact_id: d.equipment_sound_tech_contact_id,
    equipment_sound_tech_name: d.equipment_sound_tech_name,
    equipment_venue_includes: [...d.equipment_venue_includes],
    equipment_hybrid_covers: [...d.equipment_hybrid_covers],
    equipment_dj_package_interest: d.equipment_dj_package_interest,
    equipment_hybrid_additions: d.equipment_hybrid_additions,
    equipment_revisit_production_5b: d.equipment_revisit_production_5b,
    pricing_mode: d.pricing_mode,
    package_id: d.package_id,
    addon_quantities: { ...d.addon_quantities },
    addon_autopop_ids: [...d.addon_autopop_ids],
    addon_autopop_dismissed_ids: [...d.addon_autopop_dismissed_ids],
    load_in_time: d.load_in_time,
    equipment_setup_window: d.equipment_setup_window,
    load_in_access_tags: [...d.load_in_access_tags],
    equipment_production_soundcheck: d.equipment_production_soundcheck,
  }
}

function pick4e(d: BookingIntakeShowDataV3): Pick<
  BookingIntakeShowDataV3,
  | 'travel_required'
  | 'lodging_status'
  | 'travel_notes_flag'
  | 'travel_booked_by'
  | 'ground_transport'
> {
  if (d.travel_required === 'local') {
    return {
      travel_required: d.travel_required,
      lodging_status: '',
      travel_notes_flag: '',
      travel_booked_by: '',
      ground_transport: '',
    }
  }
  return {
    travel_required: d.travel_required,
    lodging_status: d.lodging_status,
    travel_notes_flag: d.travel_notes_flag,
    travel_booked_by: d.travel_booked_by,
    ground_transport: d.ground_transport,
  }
}

function servicesForEventDate(catalog: PricingCatalogDoc, eventDate: string) {
  const weekend = isWeekendDate(eventDate)
  return catalog.services.filter(s => {
    if (s.dayType === 'any') return true
    if (s.dayType === 'weekend') return weekend
    return !weekend
  })
}

/** Catalog row for “Radio / ongoing engagement” — no longer offered in live intake. */
function discountIsRadioStation(d: PricingDiscount): boolean {
  const ct = (d.clientType ?? '').toLowerCase()
  if (ct === 'radio_stations' || ct === 'radio_station') return true
  const n = d.name.toLowerCase()
  return n.includes('radio station') || n.includes('ongoing engagement')
}

/** Repeat-booking / returning-venue row — auto-applied when commission tier is kept doors. */
function discountIsRepeatBooking(d: PricingDiscount): boolean {
  const ct = (d.clientType ?? '').toLowerCase()
  if (ct === 'returning') return true
  const n = d.name.toLowerCase()
  return n.includes('repeat')
}

function repeatBookingDiscountId(catalog: PricingCatalogDoc): string | null {
  const row = catalog.discounts.find(discountIsRepeatBooking)
  return row?.id ?? null
}

function discountIdListsEqualAsSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const bs = new Set(b)
  return a.every(id => bs.has(id))
}

function buildPriceInputForShow(
  sd: BookingIntakeShowDataV3,
  catalog: PricingCatalogDoc,
): ComputeDealPriceInput | null {
  if (!catalogHasMinimumForDealLogging(catalog)) return null
  const hrs =
    sd.performance_hours > 0 ? sd.performance_hours : suggestedBillableHoursFromShow(sd)
  const baseMode = sd.pricing_mode === 'package' ? 'package' : 'hourly'
  return {
    catalog,
    eventDate: sd.event_date.trim() || null,
    baseMode,
    packageId: sd.package_id.trim() || null,
    serviceId: sd.service_id.trim() || null,
    overtimeServiceId: sd.overtime_service_id.trim() || sd.service_id.trim() || null,
    performanceHours: hrs,
    addonQuantities: { ...sd.addon_quantities },
    surchargeIds: [...sd.surcharge_ids],
    discountIds: [...sd.discount_ids],
  }
}

/** Bright gradient text on dark chips (selected = stronger rim, still dark ground for contrast). */
const VIBE_PRESET_LABEL_GRADIENT: Record<string, string> = {
  latin_party: 'from-orange-400 via-amber-300 to-yellow-300',
  open_format: 'from-sky-400 via-blue-400 to-indigo-400',
  hiphop_rnb: 'from-rose-400 via-fuchsia-500 to-purple-400',
  club_high_energy: 'from-purple-400 via-violet-400 to-yellow-300',
  afro_caribbean: 'from-emerald-400 via-yellow-300 to-red-400',
  chill_lounge: 'from-cyan-400 via-sky-400 to-blue-400',
  latin_x_hiphop: 'from-yellow-300 via-amber-400 to-red-500',
  latin_x_club: 'from-yellow-300 via-amber-400 to-purple-500',
  rnb_x_latin: 'from-purple-400 via-fuchsia-400 to-yellow-300',
}

function MusicVibePresetRow({
  selectedGenres,
  onApplyPreset,
}: {
  selectedGenres: PerformanceGenreV3[]
  onApplyPreset: (genres: readonly PerformanceGenreV3[]) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-neutral-400 text-xs">Vibe preset</Label>
      <div className="flex flex-wrap gap-1.5">
        {MUSIC_VIBE_PRESETS.map(p => {
          const on = genreSetsEqual(selectedGenres, p.genres)
          const grad = VIBE_PRESET_LABEL_GRADIENT[p.id] ?? 'from-neutral-200 to-neutral-100'
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onApplyPreset(p.genres)}
              className={cn(
                'min-h-9 px-2.5 py-1.5 text-[11px] sm:text-xs rounded-md border transition-colors leading-snug text-left',
                on
                  ? 'border-white/35 bg-neutral-950/75 ring-1 ring-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'border-white/[0.1] bg-neutral-900/40 hover:border-white/20',
              )}
            >
              <span
                className={cn(
                  'inline font-semibold bg-gradient-to-r bg-clip-text text-transparent',
                  grad,
                )}
              >
                {p.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function GenreChipRow({
  selected,
  onChange,
}: {
  selected: PerformanceGenreV3[]
  onChange: (next: PerformanceGenreV3[]) => void
}) {
  const toggle = (g: PerformanceGenreV3) => {
    if (selected.includes(g)) onChange(selected.filter(x => x !== g))
    else onChange([...selected, g])
  }
  return (
    <div className="flex flex-wrap gap-1">
      {PERFORMANCE_GENRE_VALUES.map(g => (
        <button
          key={g}
          type="button"
          onClick={() => toggle(g)}
          className={cn(
            'min-h-[32px] px-2 text-xs font-medium rounded-md border transition-colors',
            selected.includes(g)
              ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
              : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
          )}
        >
          {PERFORMANCE_GENRE_LABELS[g]}
        </button>
      ))}
    </div>
  )
}

const COMMISSION_ORDER: CommissionTier[] = ['new_doors', 'kept_doors', 'bigger_doors', 'artist_network']

function commissionLabel(tier: CommissionTier): string {
  const pct = Math.round(COMMISSION_TIER_RATES[tier] * 100)
  const base = COMMISSION_TIER_LABELS[tier]
  return tier === 'artist_network' ? `${base} (0%)` : `${base} (${pct}%)`
}

function ToggleN<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: { value: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-white/[0.08] p-0.5 bg-neutral-900/50">
      {options.map(opt => (
        <button
          key={String(opt.value)}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'min-h-10 px-2.5 text-xs font-medium rounded-md transition-colors leading-tight shrink-0',
            value === opt.value ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function fmtKnownDate(iso: string): string {
  if (!iso.trim()) return ''
  try {
    const d = new Date(`${iso}T12:00:00`)
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function BookingIntakePage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const intakeIdParam = searchParams.get('intakeId')
  const booking = useBookingIntakes()
  const { venues, addVenue, updateVenue, refetch: refetchVenues } = useVenues()
  const { deals, addDeal, refetch: refetchDeals } = useDeals()
  const { profile } = useArtistProfile()
  const { refreshNavBadges } = useNavBadges()
  const { doc: pricingCatalog } = usePricingCatalog()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [venueSearch, setVenueSearch] = useState('')
  const [contactsForVenue, setContactsForVenue] = useState<Contact[]>([])
  const [precallError, setPrecallError] = useState<string | null>(null)
  const [savingUi, setSavingUi] = useState(false)
  const [endCallBusy, setEndCallBusy] = useState(false)
  const [importBusyKey, setImportBusyKey] = useState<string | null>(null)
  const [importBanner, setImportBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [advanceNudge, setAdvanceNudge] = useState<string | null>(null)
  /** Live 1A: user chose “Add new” for different-person flow (skip venue contact chips). */
  const [mismatchAddNewChosen, setMismatchAddNewChosen] = useState(false)
  /** Live 4B: user chose “Add new” for different on-site POC (skip venue contact chips). */
  const [onsiteAddNewChosen, setOnsiteAddNewChosen] = useState(false)

  const selectedRow = useMemo(
    () => booking.intakes.find(i => i.id === selectedId) ?? null,
    [booking.intakes, selectedId],
  )

  const data: BookingIntakeVenueDataV3 | null = useMemo(
    () => (selectedRow ? parseVenueDataV3(selectedRow.venue_data, selectedRow.schema_version) : null),
    [selectedRow],
  )

  const showsSorted = useMemo(
    () =>
      (booking.showsByIntake[selectedId ?? ''] ?? [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order),
    [booking.showsByIntake, selectedId],
  )

  const primaryStateRegion = useMemo(() => {
    const row = showsSorted[0]
    if (!row) return ''
    return parseShowDataV3(row.show_data, row.sort_order).state_region
  }, [showsSorted])

  const primaryShowSd = useMemo(() => {
    const row = showsSorted[0]
    if (!row) return null
    return parseShowDataV3(row.show_data, row.sort_order)
  }, [showsSorted])

  const venueImportPreview = useMemo(
    () => (data ? mapIntakeVenueDataV3ToVenueRow(data, primaryShowSd) : null),
    [data, primaryShowSd],
  )

  const postCallSection =
    data?.session_mode === 'post_call'
      ? (POST_CALL_SECTION_ORDER as readonly string[]).includes(data.view_section)
        ? data.view_section
        : '8A'
      : '8A'

  const pathSections = useMemo(
    () => [...livePathSections(primaryStateRegion)],
    [primaryStateRegion],
  )

  const existingVenue = useMemo(
    () => (data?.existing_venue_id ? venues.find(v => v.id === data.existing_venue_id) : undefined),
    [venues, data?.existing_venue_id],
  )

  const linkedVenueIdForDeals = useMemo(() => {
    if (!data) return null
    return data.existing_venue_id ?? data.post_import_venue_id ?? null
  }, [data?.existing_venue_id, data?.post_import_venue_id])

  const canImportDeals = catalogHasMinimumForDealLogging(pricingCatalog)

  const postCallImportAllDisabled = useMemo(() => {
    if (!data || !venueImportPreview) return true
    const pending = showsSorted.filter(s => !s.imported_deal_id)
    if (data.venue_source === 'existing' && !data.existing_venue_id) return true
    const linked = data.existing_venue_id ?? data.post_import_venue_id
    if (pending.length === 0 && linked) return true
    if (pending.length > 0 && !canImportDeals) return true
    return false
  }, [data, showsSorted, venueImportPreview, canImportDeals])

  const pre2aRef = useRef(false)
  const pre2bRef = useRef(false)
  const pre2cRef = useRef(false)
  const pre2bSetSeedRef = useRef(false)
  const genreDefaultSeededShowIdsRef = useRef(new Set<string>())

  useEffect(() => {
    document.title = 'The Office — Call intake'
  }, [])

  useEffect(() => {
    if (booking.loading || booking.intakes.length === 0) return
    if (intakeIdParam && !booking.intakes.some(i => i.id === intakeIdParam)) {
      setSearchParams({}, { replace: true })
    }
  }, [booking.loading, booking.intakes, intakeIdParam, setSearchParams])

  useEffect(() => {
    if (booking.loading || booking.intakes.length === 0) return
    setSelectedId(prev => {
      if (intakeIdParam && booking.intakes.some(i => i.id === intakeIdParam)) return intakeIdParam
      if (prev && booking.intakes.some(i => i.id === prev)) return prev
      return booking.intakes[0]?.id ?? null
    })
  }, [booking.loading, booking.intakes, intakeIdParam])

  useEffect(() => {
    if (!selectedId || !data || !selectedRow) return
    if (selectedRow.schema_version < INTAKE_SCHEMA_VERSION_V3) return
    const target: 1 | 2 | 3 = data.multi_show ? data.show_count : 1
    void booking.ensureShowCount(selectedId, target)
  }, [selectedId, selectedRow, data?.multi_show, data?.show_count, booking.ensureShowCount])

  useEffect(() => {
    const vid = data?.existing_venue_id
    if (!vid) {
      setContactsForVenue([])
      return
    }
    void (async () => {
      const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', vid).order('created_at')
      setContactsForVenue((rows ?? []) as Contact[])
    })()
  }, [data?.existing_venue_id])

  /** Venue contacts excluding the intake’s primary selected contact — candidates for “who’s on the line”. */
  const otherVenueContactsForMismatch = useMemo(() => {
    if (!data?.existing_venue_id) return []
    const sid = data.selected_contact_id
    return contactsForVenue.filter(c => (sid ? c.id !== sid : true))
  }, [data?.existing_venue_id, data?.selected_contact_id, contactsForVenue])

  /**
   * §5C invoice “Different person” — omit anyone who is already the main contact on the toggle
   * (`selected_contact_id` and/or same name + email as on-file primary).
   */
  const contactsForBillingPicker = useMemo(() => {
    if (!data) return []
    const sid = data.selected_contact_id
    const mainNameNorm = data.contact_name.trim()
    const mainEmailNorm = data.contact_email.trim().toLowerCase()
    return contactsForVenue.filter(c => {
      if (sid && c.id === sid) return false
      if (!mainNameNorm) return true
      if (c.name.trim() !== mainNameNorm) return true
      const ce = (c.email ?? '').trim().toLowerCase()
      if (mainEmailNorm && ce) return mainEmailNorm !== ce
      if (mainEmailNorm && !ce) return true
      if (!mainEmailNorm && !ce) return false
      if (!mainEmailNorm && ce) return true
      return false
    })
  }, [contactsForVenue, data])

  /** Live 1B: chips for who an added phone/email belongs to. */
  const live1bDetailOwnerChips = useMemo(() => {
    if (!data) return []
    const rows: { key: string; label: string }[] = []
    rows.push({
      key: 'primary_on_file',
      label: data.contact_name.trim() ? `${data.contact_name.trim()} · on file` : 'Primary · on file',
    })
    if (data.confirmed_contact === 'no_different_person' && data.contact_mismatch_note.trim()) {
      const first = data.contact_mismatch_note.trim().split(/\s+/)[0] ?? data.contact_mismatch_note.trim()
      rows.push({ key: 'on_call', label: `${first} · on the call` })
    }
    for (const c of contactsForVenue) {
      const r = contactRoleForDisplay(c)
      rows.push({ key: c.id, label: r ? `${c.name} · ${r}` : c.name })
    }
    return rows
  }, [data, contactsForVenue])

  const venueSoundTechContacts = useMemo(
    () => contactsForVenue.filter(isVenueSoundTechContact),
    [contactsForVenue],
  )

  const soundTechUiContextForEquipment = useMemo((): SoundTechUiContext => {
    if (venueSoundTechContacts.length === 1) {
      const c = venueSoundTechContacts[0]
      const full = c.name.trim()
      const first = full.split(/\s+/)[0] ?? full
      return {
        confirmFirstName: first,
        confirmFullName: full,
        multipleOnFile: false,
        preferredVenueContactId: c.id,
      }
    }
    if (venueSoundTechContacts.length > 1) {
      return {
        confirmFirstName: null,
        confirmFullName: null,
        multipleOnFile: true,
        preferredVenueContactId: null,
      }
    }
    return {
      confirmFirstName: null,
      confirmFullName: null,
      multipleOnFile: false,
      preferredVenueContactId: null,
    }
  }, [venueSoundTechContacts])

  const ensureSoundTechContact = useCallback(
    async (rawName: string): Promise<string | null> => {
      const vid = data?.existing_venue_id
      const name = rawName.trim()
      if (!vid || !name) return null
      const { data: dup } = await supabase
        .from('contacts')
        .select('id')
        .eq('venue_id', vid)
        .ilike('name', name)
        .maybeSingle()
      if (dup?.id) return dup.id
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: row, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          venue_id: vid,
          name,
          title_key: 'on_site_tech',
          role: null,
          email: null,
          phone: null,
          company: null,
        })
        .select('id')
        .single()
      if (error || !row) return null
      const { data: fresh } = await supabase.from('contacts').select('*').eq('venue_id', vid).order('created_at')
      setContactsForVenue((fresh ?? []) as Contact[])
      return row.id as string
    },
    [data?.existing_venue_id],
  )

  /** Phase 4A — sound tech picks (primary, on-call, venue contacts; FOH-ish rows first). */
  const equipmentSoundTechPickOptions = useMemo((): EquipmentSoundTechPickOption[] => {
    if (!data) return []
    const prefix: EquipmentSoundTechPickOption[] = []
    if (data.contact_name.trim()) {
      prefix.push({
        id: '__primary__',
        label: `${data.contact_name.trim()} · on file`,
        contactId: null,
        name: data.contact_name.trim(),
      })
    }
    if (data.confirmed_contact === 'no_different_person' && data.contact_mismatch_note.trim()) {
      const full = data.contact_mismatch_note.trim()
      const first = full.split(/\s+/)[0] ?? full
      prefix.push({
        id: '__on_call__',
        label: `${first} · on the call`,
        contactId: null,
        name: full,
      })
    }
    const st: EquipmentSoundTechPickOption[] = []
    const rest: EquipmentSoundTechPickOption[] = []
    for (const c of contactsForVenue) {
      const r = contactRoleForDisplay(c)
      const opt: EquipmentSoundTechPickOption = {
        id: c.id,
        label: r ? `${c.name} · ${r}` : c.name,
        contactId: c.id,
        name: '',
      }
      if (isVenueSoundTechContact(c)) st.push(opt)
      else rest.push(opt)
    }
    return [...prefix, ...st, ...rest]
  }, [data, contactsForVenue])

  useEffect(() => {
    if (data?.confirmed_contact !== 'no_different_person') setMismatchAddNewChosen(false)
  }, [data?.confirmed_contact])

  useEffect(() => {
    if (data?.onsite_same_contact !== 'different') setOnsiteAddNewChosen(false)
  }, [data?.onsite_same_contact])

  /** Venue contact chips row (stays visible after a chip is selected so you can switch or use Add new). */
  const live1aShowVenueMismatchChips = useMemo(() => {
    if (!data || data.view_section !== '1A' || data.confirmed_contact !== 'no_different_person') return false
    return otherVenueContactsForMismatch.length > 0 && !mismatchAddNewChosen
  }, [data, data?.view_section, data?.confirmed_contact, otherVenueContactsForMismatch, mismatchAddNewChosen])

  /** Advance blocked until user picks a venue contact or chooses Add new (legacy: note+context already set counts as done). */
  const live1aShowVenueContactPick = useMemo(() => {
    if (!live1aShowVenueMismatchChips || mismatchAddNewChosen) return false
    if (data?.contact_mismatch_linked_contact_id) return false
    const note = data?.contact_mismatch_note?.trim() ?? ''
    const ctx = data?.contact_mismatch_context?.trim() ?? ''
    if (note && ctx) return false
    return true
  }, [
    live1aShowVenueMismatchChips,
    data?.contact_mismatch_linked_contact_id,
    data?.contact_mismatch_note,
    data?.contact_mismatch_context,
    mismatchAddNewChosen,
  ])

  const live1aShowMismatchForm = useMemo(() => {
    if (!data || data.view_section !== '1A') return false
    if (data.confirmed_contact !== 'no_different_person' || live1aShowVenueContactPick) return false
    if (data.contact_mismatch_linked_contact_id) return false
    if (data.contact_mismatch_note.trim() && data.contact_mismatch_context.trim()) return false
    return mismatchAddNewChosen || otherVenueContactsForMismatch.length === 0
  }, [
    data,
    data?.view_section,
    data?.confirmed_contact,
    data?.contact_mismatch_note,
    data?.contact_mismatch_context,
    data?.contact_mismatch_linked_contact_id,
    live1aShowVenueContactPick,
    mismatchAddNewChosen,
    otherVenueContactsForMismatch.length,
  ])

  const live4bShowVenueOnsiteChips = useMemo(() => {
    if (!data || data.view_section !== '4B' || data.onsite_same_contact !== 'different') return false
    return otherVenueContactsForMismatch.length > 0 && !onsiteAddNewChosen
  }, [data, data?.view_section, data?.onsite_same_contact, otherVenueContactsForMismatch, onsiteAddNewChosen])

  const live4bVenueOnsiteContactPick = useMemo(() => {
    if (!live4bShowVenueOnsiteChips || onsiteAddNewChosen) return false
    if (data?.onsite_linked_contact_id) return false
    const note = data?.onsite_contact_name?.trim() ?? ''
    if (note) return false
    return true
  }, [
    live4bShowVenueOnsiteChips,
    onsiteAddNewChosen,
    data?.onsite_linked_contact_id,
    data?.onsite_contact_name,
  ])

  const live4bShowOnsiteMismatchForm = useMemo(() => {
    if (!data || data.view_section !== '4B') return false
    if (data.onsite_same_contact !== 'different' || live4bVenueOnsiteContactPick) return false
    if (data.onsite_linked_contact_id) return false
    if (data.onsite_contact_name.trim()) return false
    return onsiteAddNewChosen || otherVenueContactsForMismatch.length === 0
  }, [
    data,
    data?.view_section,
    data?.onsite_same_contact,
    data?.onsite_contact_name,
    data?.onsite_linked_contact_id,
    live4bVenueOnsiteContactPick,
    onsiteAddNewChosen,
    otherVenueContactsForMismatch.length,
  ])

  const filteredVenues = useMemo(() => {
    const q = venueSearch.trim().toLowerCase()
    if (!q) return venues.slice(0, 50)
    return venues
      .filter(v => `${v.name} ${v.city ?? ''}`.toLowerCase().includes(q))
      .slice(0, 50)
  }, [venues, venueSearch])

  const patch = useCallback(
    (p: Partial<BookingIntakeVenueDataV3>) => {
      if (!selectedId) return
      let next = { ...p }
      if (p.outreach_track === 'community') {
        next = { ...next, commission_tier: 'artist_network' }
      }
      booking.updateVenueData(selectedId, next)
    },
    [selectedId, booking],
  )

  /** Drop billing link if it points at the main contact (no longer in picker list). */
  useEffect(() => {
    if (!selectedId || !data) return
    if (data.invoice_same_contact !== 'different') return
    const bid = data.billing_linked_contact_id
    if (!bid) return
    const allowed = new Set(contactsForBillingPicker.map(c => c.id))
    if (!allowed.has(bid)) {
      patch({
        billing_linked_contact_id: null,
        billing_contact_flag: 'capture_later',
        billing_contact_name: '',
        billing_contact_email: '',
      })
    }
  }, [selectedId, data, contactsForBillingPicker, patch])

  const applyShowPatch = useCallback(
    (
      showId: string,
      partial: Partial<BookingIntakeShowDataV3>,
      section:
        | '2a'
        | '2b'
        | '2c'
        | '3b'
        | '4a'
        | '4e'
        | '5a'
        | '5b'
        | '5c'
        | '5d'
        | '6a'
        | 'post',
    ) => {
      if (!selectedId || !data) return
      const row = showsSorted.find(s => s.id === showId)
      if (!row) return
      const cur = parseShowDataV3(row.show_data, row.sort_order)
      if (section === 'post') {
        booking.updateShowData(showId, selectedId, finalizeShowPostCaptures({ ...cur, ...partial }))
        return
      }
      let next: BookingIntakeShowDataV3 = { ...cur, ...partial }
      if ('event_start_time' in partial || 'event_end_time' in partial) {
        next.overnight_event = computeOvernightEvent(next.event_start_time, next.event_end_time)
      }
      if (
        section === '2b' &&
        ('set_start_time' in partial || 'set_end_time' in partial)
      ) {
        if (!next.set_start_time.trim() || !next.set_end_time.trim()) {
          next.overnight_set = false
        } else {
          next.overnight_set = computeOvernightEvent(next.set_start_time, next.set_end_time)
        }
      }
      if (section === '4e') {
        if (partial.travel_required === 'local' || next.travel_required === 'local') {
          next.lodging_status = ''
          next.travel_notes_flag = ''
          next.travel_booked_by = ''
          next.ground_transport = ''
        }
      }
      if (section === '5c') {
        if (partial.pricing_source === 'calculated' || next.pricing_source === 'calculated') {
          next.manual_gross = null
        }
      }
      if (section === '5d') {
        if (next.balance_timing !== 'custom') next.balance_due_date = ''
      }
      if (section === '2a') {
        if ('event_type' in partial && partial.event_type !== cur.event_type) {
          /** Use event/setting only so an existing “other” venue doesn’t widen the list and pick the wrong default (e.g. Bar). */
          const relaxForVenueDefault =
            next.event_type === 'other' || next.setting === 'other'
          const defPick = intakeVenueDefaultPickForEventType(next.event_type, relaxForVenueDefault)
          const curPick = intakeVenuePickValueFromShow(cur)
          /** Match legacy behavior: changing event type snaps venue to this type’s default unless the operator typed a custom “other” line. */
          const userTypedCustomVenue = curPick === '__custom__'
          if (defPick && !userTypedCustomVenue) {
            next.venue_type = defPick.venueType
            next.venue_type_other =
              defPick.venueType === 'other' ? (defPick.otherDetail ?? '') : ''
          }
        }
        const relax = intakePhase2aRelaxDynamicFilters(next)
        const allowed = new Set(venueTypesForIntake2a(next.event_type, relax))
        if (next.venue_type && !allowed.has(next.venue_type)) {
          next.venue_type = ''
          next.venue_type_other = ''
        }
      }
      if (section === '6a') {
        if (partial.promise_lines_v3) {
          next.promise_lines_v3 = { ...cur.promise_lines_v3, ...partial.promise_lines_v3 }
        }
        if (partial.promise_lines_auto) {
          next.promise_lines_auto = { ...cur.promise_lines_auto, ...partial.promise_lines_auto }
        }
      }
      booking.updateShowData(showId, selectedId, finalizeShowPostCaptures(next))

      const sync =
        data.multi_show &&
        ((section === '2a' && data.same_for_all_2a) ||
          (section === '2b' && data.same_for_all_2b) ||
          (section === '2c' && data.same_for_all_2c) ||
          (section === '3b' && data.same_for_all_3b) ||
          (section === '4a' && data.same_for_all_4a) ||
          (section === '4e' && data.same_for_all_4e))

      if (sync) {
        for (const s of showsSorted) {
          if (s.id === showId) continue
          const oc = parseShowDataV3(s.show_data, s.sort_order)
          let merged: BookingIntakeShowDataV3 =
            section === '2a'
              ? { ...oc, ...pick2a(next) }
              : section === '2b'
                ? { ...oc, ...pick2b(next) }
                : section === '2c'
                  ? { ...oc, ...pick2c(next) }
                  : section === '3b'
                    ? { ...oc, ...pick3b(next) }
                    : section === '4a'
                      ? { ...oc, ...pick4a(next) }
                      : section === '4e'
                      ? { ...oc, ...pick4e(next) }
                      : oc
          if (section === '2b') {
            merged.overnight_event = computeOvernightEvent(merged.event_start_time, merged.event_end_time)
            merged.overnight_set =
              !merged.set_start_time.trim() || !merged.set_end_time.trim()
                ? false
                : computeOvernightEvent(merged.set_start_time, merged.set_end_time)
          }
          booking.updateShowData(s.id, selectedId, finalizeShowPostCaptures(merged))
          if (section === '2b') {
            const lbl = showLabelFromEventDate(merged.event_date)
            if (lbl) void booking.updateShowLabel(s.id, selectedId, lbl)
          }
        }
      }

      if (section === '2b' && partial.event_date !== undefined) {
        const lbl = showLabelFromEventDate(next.event_date)
        if (lbl) void booking.updateShowLabel(showId, selectedId, lbl)
      }
    },
    [selectedId, data, showsSorted, booking],
  )

  /** Strip legacy radio discount; sync repeat-booking discount with kept-doors tier (not manually toggled). */
  useEffect(() => {
    if (!selectedId || !data) return
    const repeatId = repeatBookingDiscountId(pricingCatalog)
    const radioIds = new Set(
      pricingCatalog.discounts.filter(discountIsRadioStation).map(d => d.id),
    )
    for (const row of showsSorted) {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      let nextIds = sd.discount_ids.filter(id => !radioIds.has(id))
      if (data.commission_tier === 'kept_doors' && repeatId && !nextIds.includes(repeatId)) {
        nextIds = [...nextIds, repeatId]
      }
      if (data.commission_tier !== 'kept_doors' && repeatId && sd.event_schedule_type !== 'recurring') {
        nextIds = nextIds.filter(id => id !== repeatId)
      }
      if (!discountIdListsEqualAsSet(nextIds, sd.discount_ids)) {
        applyShowPatch(row.id, { discount_ids: nextIds }, '5a')
      }
    }
  }, [selectedId, data?.commission_tier, showsSorted, pricingCatalog, applyShowPatch])

  useEffect(() => {
    if (!selectedId || !data || data.view_section !== '3B') return
    for (const row of showsSorted) {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      if (sd.genres.length > 0) continue
      if (genreDefaultSeededShowIdsRef.current.has(row.id)) continue
      genreDefaultSeededShowIdsRef.current.add(row.id)
      applyShowPatch(row.id, { genres: [...INTAKE_DEFAULT_GENRES] }, '3b')
    }
  }, [selectedId, data?.view_section, showsSorted, applyShowPatch])

  const onSameForAllChange = useCallback(
    (
      key:
        | 'same_for_all_2a'
        | 'same_for_all_2b'
        | 'same_for_all_2c'
        | 'same_for_all_3b'
        | 'same_for_all_4a'
        | 'same_for_all_4e',
      v: boolean,
      pick: (d: BookingIntakeShowDataV3) => Partial<BookingIntakeShowDataV3>,
    ) => {
      if (!selectedId) return
      patch({ [key]: v })
      if (!v || !showsSorted[0]) return
      const primary = showsSorted[0]
      const p = parseShowDataV3(primary.show_data, primary.sort_order)
      const part = pick(p)
      for (const s of showsSorted.slice(1)) {
        const oc = parseShowDataV3(s.show_data, s.sort_order)
        let merged: BookingIntakeShowDataV3 = { ...oc, ...part }
        if (key === 'same_for_all_2b') {
          merged.overnight_event = computeOvernightEvent(merged.event_start_time, merged.event_end_time)
          merged.overnight_set =
            !merged.set_start_time.trim() || !merged.set_end_time.trim()
              ? false
              : computeOvernightEvent(merged.set_start_time, merged.set_end_time)
        }
        booking.updateShowData(s.id, selectedId, merged)
        if (key === 'same_for_all_2b') {
          const lbl = showLabelFromEventDate(merged.event_date)
          if (lbl) void booking.updateShowLabel(s.id, selectedId, lbl)
        }
      }
    },
    [selectedId, showsSorted, patch, booking],
  )

  useEffect(() => {
    if (data?.view_section !== '2A') {
      pre2aRef.current = false
      return
    }
    if (pre2aRef.current || !selectedId || !data.known_event_type) return
    const primary = showsSorted[0]
    if (!primary) return
    const sd = parseShowDataV3(primary.show_data, primary.sort_order)
    if (sd.event_type) {
      pre2aRef.current = true
      return
    }
    pre2aRef.current = true
    const relaxSeed = sd.setting === 'other'
    const defPick = intakeVenueDefaultPickForEventType(data.known_event_type, relaxSeed)
    let next: BookingIntakeShowDataV3 = { ...sd, event_type: data.known_event_type }
    const sdVenuePick = intakeVenuePickValueFromShow(sd)
    const needVenueSeed =
      !sd.venue_type ||
      sdVenuePick === 'other_describe' ||
      (sd.venue_type === 'other' && !sd.venue_type_other.trim())
    if (defPick && needVenueSeed && sdVenuePick !== '__custom__') {
      next = {
        ...next,
        venue_type: defPick.venueType,
        venue_type_other:
          defPick.venueType === 'other' ? (defPick.otherDetail ?? '') : '',
      }
    }
    booking.updateShowData(primary.id, selectedId, finalizeShowPostCaptures(next))
    if (data.multi_show && data.same_for_all_2a) {
      for (const s of showsSorted.slice(1)) {
        const oc = parseShowDataV3(s.show_data, s.sort_order)
        let merged: BookingIntakeShowDataV3 = { ...oc, event_type: data.known_event_type }
        const ocVenuePick = intakeVenuePickValueFromShow(oc)
        const ocNeedVenueSeed =
          !oc.venue_type ||
          ocVenuePick === 'other_describe' ||
          (oc.venue_type === 'other' && !oc.venue_type_other.trim())
        if (defPick && ocNeedVenueSeed && ocVenuePick !== '__custom__') {
          merged = {
            ...merged,
            venue_type: defPick.venueType,
            venue_type_other:
              defPick.venueType === 'other' ? (defPick.otherDetail ?? '') : '',
          }
        }
        booking.updateShowData(s.id, selectedId, finalizeShowPostCaptures(merged))
      }
    }
  }, [
    data?.view_section,
    data?.known_event_type,
    data?.multi_show,
    data?.same_for_all_2a,
    selectedId,
    showsSorted,
    booking,
  ])

  useEffect(() => {
    if (data?.view_section !== '2B') {
      pre2bRef.current = false
      return
    }
    if (pre2bRef.current || !selectedId || !data.known_event_date?.trim()) return
    const primary = showsSorted[0]
    if (!primary) return
    const sd = parseShowDataV3(primary.show_data, primary.sort_order)
    if (sd.event_date.trim()) {
      pre2bRef.current = true
      return
    }
    pre2bRef.current = true
    const next: BookingIntakeShowDataV3 = { ...sd, event_date: data.known_event_date }
    booking.updateShowData(primary.id, selectedId, next)
    if (data.multi_show && data.same_for_all_2b) {
      for (const s of showsSorted.slice(1)) {
        const oc = parseShowDataV3(s.show_data, s.sort_order)
        booking.updateShowData(s.id, selectedId, { ...oc, event_date: data.known_event_date })
        const lbl = showLabelFromEventDate(data.known_event_date)
        if (lbl) void booking.updateShowLabel(s.id, selectedId, lbl)
      }
    }
    const lbl = showLabelFromEventDate(data.known_event_date)
    if (lbl) void booking.updateShowLabel(primary.id, selectedId, lbl)
  }, [
    data?.view_section,
    data?.known_event_date,
    data?.multi_show,
    data?.same_for_all_2b,
    selectedId,
    showsSorted,
    booking,
  ])

  /** When (2B): if set times empty, seed from event window (same behavior as former 3A step). */
  useEffect(() => {
    if (data?.view_section !== '2B') {
      pre2bSetSeedRef.current = false
      return
    }
    if (pre2bSetSeedRef.current || !selectedId) return
    const primary = showsSorted[0]
    if (!primary) return
    const sd = parseShowDataV3(primary.show_data, primary.sort_order)
    if (sd.set_start_time.trim() && sd.set_end_time.trim()) {
      pre2bSetSeedRef.current = true
      return
    }
    const es = sd.event_start_time.trim()
    const ee = sd.event_end_time.trim()
    if (!es && !ee) {
      pre2bSetSeedRef.current = true
      return
    }
    pre2bSetSeedRef.current = true
    const setStart = es || '20:00'
    const setEnd = ee || '23:00'
    const ovn = computeOvernightEvent(setStart, setEnd)
    booking.updateShowData(primary.id, selectedId, {
      ...sd,
      set_start_time: setStart,
      set_end_time: setEnd,
      overnight_set: ovn,
    })
    if (data.multi_show && data.same_for_all_2b) {
      for (const s of showsSorted.slice(1)) {
        const oc = parseShowDataV3(s.show_data, s.sort_order)
        const st = oc.event_start_time.trim() || setStart
        const en = oc.event_end_time.trim() || setEnd
        const ov = computeOvernightEvent(st, en)
        booking.updateShowData(s.id, selectedId, {
          ...oc,
          set_start_time: st,
          set_end_time: en,
          overnight_set: ov,
        })
      }
    }
  }, [
    data?.view_section,
    data?.multi_show,
    data?.same_for_all_2b,
    selectedId,
    showsSorted,
    booking,
  ])

  useEffect(() => {
    if (data?.view_section !== '2C') {
      pre2cRef.current = false
      return
    }
    if (pre2cRef.current || !selectedId) return
    pre2cRef.current = true

    const run = (row: (typeof showsSorted)[0]) => {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      const p: Partial<BookingIntakeShowDataV3> = {}
      if (!sd.venue_name_flag) p.venue_name_flag = 'already_have'
      if (!sd.venue_name_text.trim() && data?.known_venue_name?.trim()) {
        p.venue_name_text = data.known_venue_name.trim()
      }
      if (!sd.city_flag) p.city_flag = 'already_have'
      if (!sd.address_status) p.address_status = 'have_it'
      if (!sd.state_region && existingVenue?.region) p.state_region = existingVenue.region
      else if (!sd.state_region) p.state_region = INTAKE_DEFAULT_EVENT_STATE_REGION
      if (!sd.city_text.trim()) p.city_text = INTAKE_DEFAULT_EVENT_CITY_TEXT
      if (Object.keys(p).length === 0) return
      booking.updateShowData(row.id, selectedId, { ...sd, ...p })
    }

    if (!data.multi_show || data.same_for_all_2c) {
      if (showsSorted[0]) run(showsSorted[0])
    } else {
      for (const s of showsSorted) run(s)
    }
  }, [
    data?.view_section,
    data?.multi_show,
    data?.same_for_all_2c,
    data?.known_venue_name,
    existingVenue,
    selectedId,
    showsSorted,
    booking,
  ])

  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    if (pathSections.includes('4E')) return
    const u: Partial<BookingIntakeVenueDataV3> = {}
    if (data.last_active_section === '4E') u.last_active_section = '5A'
    if (data.view_section === '4E') u.view_section = '5A'
    if (Object.keys(u).length) booking.updateVenueData(selectedId, u)
  }, [
    selectedId,
    data?.session_mode,
    data?.last_active_section,
    data?.view_section,
    pathSections,
    booking,
    data,
  ])

  /** Removed 2D / 3A; bump stale bookmarks to the next live step. */
  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    const u: Partial<BookingIntakeVenueDataV3> = {}
    if (data.last_active_section === '2D' || data.last_active_section === '3A') {
      u.last_active_section = '3B'
    }
    if (data.last_active_section === '3C') u.last_active_section = '4A'
    if (data.view_section === '2D' || data.view_section === '3A') u.view_section = '3B'
    if (data.view_section === '3C') u.view_section = '4A'
    if (Object.keys(u).length) booking.updateVenueData(selectedId, u)
  }, [selectedId, data?.session_mode, data?.last_active_section, data?.view_section, booking, data])

  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    if (data.view_section !== '5A') return
    for (const row of showsSorted) {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      const p: Partial<BookingIntakeShowDataV3> = {}
      if (sd.performance_hours <= 0) {
        const sug = suggestedBillableHoursFromShow(sd)
        if (sug > 0) p.performance_hours = sug
      }
      const merged = { ...sd, ...p }
      const auto = computeIntakePricingSetupAutopop(merged, pricingCatalog)
      const combined = { ...p, ...auto }
      if (Object.keys(combined).length === 0) continue
      booking.updateShowData(
        row.id,
        selectedId,
        finalizeShowPostCaptures({ ...sd, ...combined }),
      )
    }
  }, [selectedId, data?.session_mode, data?.view_section, showsSorted, booking, pricingCatalog])

  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    if (data.view_section !== '5C') return
    for (const row of showsSorted) {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      const sug = suggestedPromiseLinesFromEarlierPhases(sd, data)
      const nextLines = { ...sd.promise_lines_v3 }
      const nextAuto = { ...sd.promise_lines_auto }
      let changed = false
      for (const p of SHOW_REPORT_PRESETS) {
        const id = p.id as VenuePromiseLineIdV3
        const s = sug[id]
        if (s && nextLines[id] === '') {
          nextLines[id] = s
          nextAuto[id] = true
          changed = true
        }
      }
      if (changed) {
        booking.updateShowData(row.id, selectedId, {
          ...sd,
          promise_lines_v3: nextLines,
          promise_lines_auto: nextAuto,
        })
      }
    }
  }, [selectedId, data?.session_mode, data?.view_section, showsSorted, booking, data])

  /** Drop legacy / disallowed methods (e.g. cash, other) so hidden selections cannot persist. */
  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    if (data.view_section !== '5C') return
    const allowed = new Set(LIVE_PAYMENT_METHOD_KEYS as readonly string[])
    for (const row of showsSorted) {
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      if (!sd.payment_methods.some(m => !allowed.has(m))) continue
      const next = sd.payment_methods.filter(m => allowed.has(m))
      booking.updateShowData(row.id, selectedId, { ...sd, payment_methods: next })
    }
  }, [selectedId, data?.session_mode, data?.view_section, showsSorted, booking, data])

  const patchPromiseLine = useCallback(
    (showId: string, lineId: VenuePromiseLineIdV3, value: string) => {
      if (!selectedId || !data) return
      const row = showsSorted.find(s => s.id === showId)
      if (!row) return
      const sd = parseShowDataV3(row.show_data, row.sort_order)
      applyShowPatch(
        showId,
        {
          promise_lines_v3: { [lineId]: value },
          promise_lines_auto: { ...sd.promise_lines_auto, [lineId]: false },
        },
        '6a',
      )
    },
    [selectedId, data, showsSorted, applyShowPatch],
  )

  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'live_call') return
    if (data.view_section !== '7A') return
    if (data.has_follow_ups !== 'yes') return
    if (!data.follow_up_topics.includes('internal_approval')) return
    if (data.follow_up_date.trim()) return
    patch({ follow_up_date: addBusinessDaysFromToday(4) })
  }, [
    selectedId,
    data?.session_mode,
    data?.view_section,
    data?.has_follow_ups,
    data?.follow_up_topics,
    data?.follow_up_date,
    patch,
    data,
  ])

  const toggleFollowTopic = useCallback(
    (k: FollowUpTopicKeyV3) => {
      if (!selectedId || !data) return
      const has = data.follow_up_topics.includes(k)
      const nextTopics = has ? data.follow_up_topics.filter(x => x !== k) : [...data.follow_up_topics, k]
      const extra: Partial<BookingIntakeVenueDataV3> = { follow_up_topics: nextTopics }
      if (!has && k === 'internal_approval' && !data.follow_up_date.trim()) {
        extra.follow_up_date = addBusinessDaysFromToday(4)
      }
      patch(extra)
    },
    [selectedId, data, patch],
  )

  const applyVenuePick = useCallback(
    async (venue: Venue) => {
      if (!selectedId) return
      const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', venue.id).order('created_at')
      const list = (rows ?? []) as Contact[]
      const primary = list[0]
      const tier = await suggestedCommissionTierForVenue(venue, async id => {
        const { count } = await supabase.from('deals').select('id', { count: 'exact', head: true }).eq('venue_id', id)
        return count ?? 0
      })
      const forcedTier = venue.outreach_track === 'community' ? 'artist_network' : tier
      booking.updateVenueData(selectedId, {
        venue_source: 'existing',
        existing_venue_id: venue.id,
        selected_contact_id: primary?.id ?? null,
        contact_name: primary?.name ?? '',
        contact_role: primary?.role ?? '',
        contact_email: primary?.email ?? '',
        contact_phone: primary?.phone ?? '',
        contact_company: primary?.company ?? '',
        known_venue_name: venue.name,
        known_city: venue.city ?? '',
        outreach_track: venue.outreach_track,
        priority: venue.priority,
        commission_tier: forcedTier,
      })
      booking.updateTitle(selectedId, defaultIntakeTitleV3(primary?.name ?? ''))

      const vt = venue.venue_type
      if (vt) {
        const { data: showRows } = await supabase
          .from('booking_intake_shows')
          .select('id, show_data, sort_order')
          .eq('intake_id', selectedId)
        for (const r of (showRows ?? []) as BookingIntakeShowRow[]) {
          const sd = parseShowDataV3(r.show_data, r.sort_order)
          if (sd.venue_type) continue
          booking.updateShowData(r.id, selectedId, { ...sd, venue_type: vt })
        }
      }
    },
    [selectedId, booking],
  )

  const onContactSelect = useCallback(
    (contactId: string) => {
      if (!selectedId) return
      const c = contactsForVenue.find(x => x.id === contactId)
      if (!c) return
      booking.updateVenueData(selectedId, {
        selected_contact_id: contactId,
        contact_name: c.name,
        contact_role: c.role ?? '',
        contact_email: c.email ?? '',
        contact_phone: c.phone ?? '',
        contact_company: c.company ?? '',
      })
      booking.updateTitle(selectedId, defaultIntakeTitleV3(c.name))
    },
    [selectedId, contactsForVenue, booking],
  )

  const handleSave = async () => {
    setSavingUi(true)
    try {
      await booking.flushAllPending()
    } finally {
      setSavingUi(false)
    }
  }

  const handleExit = async () => {
    if (!window.confirm('Leave call intake? Changes will be saved first.')) return
    await booking.flushAllPending()
    navigate('/forms/intakes')
  }

  const handleBeginCall = async () => {
    if (!selectedId || !data) return
    if (!data.contact_name.trim() || !data.contact_phone.trim()) {
      setPrecallError('Add the contact’s name and phone before you start the call.')
      return
    }
    setPrecallError(null)
    await booking.flushIntakeImmediate(selectedId)
    booking.updateVenueData(selectedId, {
      session_mode: 'live_call',
      last_active_section: '1A',
      view_section: '1A',
    })
    await booking.flushIntakeImmediate(selectedId)
  }

  const handleLiveNext = useCallback(async () => {
    if (!selectedId || !data) return
    const v = data.view_section
    const l = data.last_active_section
    if (v.startsWith('__stub_')) return
    if (v === '7A') return

    if (v === '1A' && data.confirmed_contact === 'no_different_person') {
      if (live1aShowVenueContactPick) {
        setAdvanceNudge('Pick who is on the line, or Add new.')
        return
      }
      let linkedId = data.contact_mismatch_linked_contact_id
      const note = data.contact_mismatch_note.trim()
      const ctxRaw = data.contact_mismatch_context.trim()
      const needsPersist =
        !linkedId &&
        !!data.existing_venue_id?.trim() &&
        !!note &&
        !!ctxRaw &&
        (mismatchAddNewChosen || otherVenueContactsForMismatch.length === 0)
      if (needsPersist) {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) {
          setAdvanceNudge('Sign in to save this contact to the venue.')
          return
        }
        const ctxKey = ctxRaw as Exclude<Phase1ContactMismatchContextV3, ''>
        const roleLabel = CONTACT_MISMATCH_CONTEXT_LABELS[ctxKey] ?? ctxRaw
        const { data: ins, error: insErr } = await supabase
          .from('contacts')
          .insert({
            user_id: uid,
            venue_id: data.existing_venue_id!.trim(),
            name: note,
            role: roleLabel,
            email: null,
            phone: null,
            company: null,
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) {
          setAdvanceNudge(insErr?.message ? `Could not save contact: ${insErr.message}` : 'Could not save contact.')
          return
        }
        linkedId = ins.id
        booking.updateVenueData(selectedId, { contact_mismatch_linked_contact_id: linkedId })
        await booking.flushIntakeImmediate(selectedId)
        const vid = data.existing_venue_id!.trim()
        const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', vid).order('created_at')
        setContactsForVenue((rows ?? []) as Contact[])
      }
      const hasMismatch = !!linkedId || (!!note && !!ctxRaw)
      if (!hasMismatch) {
        const gaps: string[] = []
        if (!note) gaps.push('Enter the caller’s name.')
        if (!ctxRaw) gaps.push('Select their title / role.')
        setAdvanceNudge(gaps.length ? gaps.join(' ') : null)
        return
      }
      setAdvanceNudge(null)
    } else if (v === '4B' && data.onsite_same_contact === 'different') {
      if (live4bVenueOnsiteContactPick) {
        setAdvanceNudge('Pick who is on site, or Add new.')
        return
      }
      let linkedId = data.onsite_linked_contact_id
      const note = data.onsite_contact_name.trim()
      const needsPersist =
        !linkedId &&
        !!data.existing_venue_id?.trim() &&
        !!note &&
        (onsiteAddNewChosen || otherVenueContactsForMismatch.length === 0)
      if (needsPersist) {
        const { data: auth } = await supabase.auth.getUser()
        const uid = auth.user?.id
        if (!uid) {
          setAdvanceNudge('Sign in to save this contact to the venue.')
          return
        }
        const ctxKey = INTAKE_4B_NEW_ONSITE_CONTACT_TITLE
        const roleLabel = CONTACT_MISMATCH_CONTEXT_LABELS[ctxKey]
        const { data: ins, error: insErr } = await supabase
          .from('contacts')
          .insert({
            user_id: uid,
            venue_id: data.existing_venue_id!.trim(),
            name: note,
            role: roleLabel,
            email: null,
            phone: null,
            company: null,
          })
          .select('id')
          .single()
        if (insErr || !ins?.id) {
          setAdvanceNudge(insErr?.message ? `Could not save contact: ${insErr.message}` : 'Could not save contact.')
          return
        }
        linkedId = ins.id
        booking.updateVenueData(selectedId, {
          onsite_linked_contact_id: linkedId,
          onsite_title_context: ctxKey,
          onsite_contact_role: roleLabel,
        })
        await booking.flushIntakeImmediate(selectedId)
        const vid = data.existing_venue_id!.trim()
        const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', vid).order('created_at')
        setContactsForVenue((rows ?? []) as Contact[])
      }
      const hasOnsite = !!linkedId || !!note
      if (!hasOnsite) {
        setAdvanceNudge('Enter the on-site contact’s name.')
        return
      }
      setAdvanceNudge(null)
    } else {
      setAdvanceNudge(null)
    }

    const iv = pathSections.indexOf(v)
    const il = pathSections.indexOf(l)
    if (iv < 0 || il < 0) return

    if (iv < il) {
      const n = pathSections[iv + 1]
      if (n) booking.updateVenueData(selectedId, { view_section: n })
      return
    }

    if (iv === il) {
      const n = pathSections[iv + 1]
      if (n) {
        booking.updateVenueData(selectedId, { last_active_section: n, view_section: n })
      }
      return
    }

    if (iv > il) {
      const n = pathSections[iv + 1]
      if (n) {
        booking.updateVenueData(selectedId, { last_active_section: v, view_section: n })
      } else {
        booking.updateVenueData(selectedId, { last_active_section: v, view_section: v })
      }
    }
  }, [
    selectedId,
    data,
    booking,
    pathSections,
    live1aShowVenueContactPick,
    live4bVenueOnsiteContactPick,
    mismatchAddNewChosen,
    onsiteAddNewChosen,
    otherVenueContactsForMismatch.length,
  ])

  const handleLiveBack = useCallback(() => {
    if (!selectedId || !data) return
    const v = data.view_section
    if (v.startsWith('__stub_')) {
      booking.updateVenueData(selectedId, { view_section: data.last_active_section })
      return
    }
    const iv = pathSections.indexOf(v)
    if (iv > 0) {
      booking.updateVenueData(selectedId, { view_section: pathSections[iv - 1]! })
    }
  }, [selectedId, data, booking, pathSections])

  const handleJumpPhase = useCallback(
    (phaseIdx: number) => {
      if (!selectedId) return
      const jump: Record<number, string> = {
        0: '1A',
        1: '2A',
        2: '3B',
        3: '4A',
        4: '5A',
        5: '7A',
      }
      const section = jump[phaseIdx]
      if (section) booking.updateVenueData(selectedId, { view_section: section })
      else booking.updateVenueData(selectedId, { view_section: stubSectionId(phaseIdx + 1) })
    },
    [selectedId, booking],
  )

  const handleJumpReturn = useCallback(() => {
    if (!selectedId || !data) return
    booking.updateVenueData(selectedId, { view_section: data.last_active_section })
  }, [selectedId, data, booking])

  useEffect(() => {
    if (!data || data.session_mode !== 'live_call') return
    setAdvanceNudge(null)
  }, [data?.view_section, data?.session_mode])

  useEffect(() => {
    if (!data || data.session_mode !== 'live_call') return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void handleLiveNext()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [data?.session_mode, handleLiveNext])

  const handleNewIntake = async () => {
    const row = await booking.createIntake()
    if (row) {
      setSelectedId(row.id)
      setSearchParams({ intakeId: row.id }, { replace: true })
    }
  }

  const handleEndCall = async () => {
    if (!selectedId || !data) return
    setEndCallBusy(true)
    try {
      await booking.flushAllPending()
      const suggested = suggestedOutreachStatusFromPhase7Close(data.send_agreement)
      const ended = new Date().toISOString()
      booking.updateVenueData(selectedId, {
        session_mode: 'post_call',
        call_ended_at: ended,
        last_active_section: '7A',
        view_section: '8A',
        suggested_outreach_status: suggested,
      })
      await booking.flushIntakeImmediate(selectedId)
      if (data.existing_venue_id && suggested) {
        const ur = await updateVenue(data.existing_venue_id, { status: suggested })
        if (!ur.error) await refetchVenues()
      }
      try {
        if (data.existing_venue_id && selectedRow) {
          await insertIntakeOutreachActivityNote(
            data.existing_venue_id,
            buildEndCallOutreachNote(data, {
              callEndedAtIso: ended,
              intakeTitle: selectedRow.title?.trim() || 'Booking intake',
              intakeId: selectedId,
            }),
          )
        }
      } catch {
        /* activity log is best-effort */
      }
    } finally {
      setEndCallBusy(false)
    }
  }

  const executeImportVenue = useCallback(async (): Promise<{
    ok: boolean
    message: string
    venueId: string | null
  }> => {
    if (!selectedId || !data || !venueImportPreview) {
      return { ok: false, message: 'Nothing to import.', venueId: null }
    }
    await booking.flushAllPending()
    const row = venueImportPreview
    const isPhaseExisting = data.venue_source === 'existing' && !!data.existing_venue_id

    const venuePatch = {
      name: row.name,
      location: row.location,
      city: row.city,
      address_line2: row.address_line2,
      region: row.region,
      postal_code: row.postal_code,
      venue_type: row.venue_type,
      priority: row.priority,
      status: row.status,
      outreach_track: row.outreach_track,
      follow_up_date: row.follow_up_date,
      capacity: row.capacity,
      deal_terms: row.deal_terms,
    }

    const syncContactsAndNote = async (venueId: string, isNewVenue: boolean): Promise<string> => {
      let extra = ''
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const { data: existingRows } = await supabase.from('contacts').select('*').eq('venue_id', venueId)
        const existing = (existingRows ?? []) as Contact[]
        const pending = intakeContactsFromVenueDataV3(data, existing)
        if (pending.length > 0) {
          const sync = await upsertIntakeVenueContactsForVenue({
            venueId,
            userId: auth.user.id,
            derived: pending,
            existingContacts: existing,
          })
          if (!sync.ok) extra = ` Contact sync: ${sync.error}.`
          else if (data.existing_venue_id === venueId || data.post_import_venue_id === venueId) {
            setContactsForVenue(sync.contacts)
          }
        }
      }
      try {
        await insertIntakeOutreachActivityNote(
          venueId,
          buildVenueImportOutreachNote({
            intakeTitle: selectedRow?.title?.trim() || 'Booking intake',
            intakeId: selectedId,
            venueName: row.name,
            isNewVenue,
          }),
        )
      } catch {
        /* best-effort */
      }
      return extra
    }

    if (isPhaseExisting && data.existing_venue_id) {
      const ur = await updateVenue(data.existing_venue_id, venuePatch)
      if (ur.error) return { ok: false, message: ur.error.message ?? 'Update failed', venueId: null }
      await refetchVenues()
      const extra = await syncContactsAndNote(data.existing_venue_id, false)
      return { ok: true, message: `Venue updated in Outreach.${extra}`, venueId: data.existing_venue_id }
    }

    if (data.post_import_venue_id) {
      const ur = await updateVenue(data.post_import_venue_id, venuePatch)
      if (ur.error) return { ok: false, message: ur.error.message ?? 'Update failed', venueId: null }
      await refetchVenues()
      const extra = await syncContactsAndNote(data.post_import_venue_id, false)
      return { ok: true, message: `Venue updated in Outreach.${extra}`, venueId: data.post_import_venue_id }
    }

    const vr = await addVenue(row)
    if (vr.error) return { ok: false, message: vr.error.message ?? 'Create failed', venueId: null }
    const newId = vr.data?.id
    if (!newId) return { ok: false, message: 'No venue id returned.', venueId: null }

    const { data: auth } = await supabase.auth.getUser()
    const userRow = auth.user
    if (userRow) {
      const pending = intakeContactsFromVenueDataV3(data, [])
      if (pending.length > 0) {
        const sync = await upsertIntakeVenueContactsForVenue({
          venueId: newId,
          userId: userRow.id,
          derived: pending,
          existingContacts: [],
        })
        if (!sync.ok) {
          try {
            await insertIntakeOutreachActivityNote(
              newId,
              buildVenueImportOutreachNote({
                intakeTitle: selectedRow?.title?.trim() || 'Booking intake',
                intakeId: selectedId,
                venueName: row.name,
                isNewVenue: true,
              }),
            )
          } catch {
            /* best-effort */
          }
          booking.updateVenueData(selectedId, { post_import_venue_id: newId })
          await booking.flushIntakeImmediate(selectedId)
          await refetchVenues()
          return {
            ok: true,
            message: `Venue created; contacts could not be saved: ${sync.error}`,
            venueId: newId,
          }
        }
        setContactsForVenue(sync.contacts)
      }
    }
    try {
      await insertIntakeOutreachActivityNote(
        newId,
        buildVenueImportOutreachNote({
          intakeTitle: selectedRow?.title?.trim() || 'Booking intake',
          intakeId: selectedId,
          venueName: row.name,
          isNewVenue: true,
        }),
      )
    } catch {
      /* best-effort */
    }
    booking.updateVenueData(selectedId, { post_import_venue_id: newId })
    await booking.flushIntakeImmediate(selectedId)
    await refetchVenues()
    return { ok: true, message: 'Venue created in Outreach and linked for deals.', venueId: newId }
  }, [selectedId, selectedRow, data, venueImportPreview, booking, addVenue, updateVenue, refetchVenues])

  const handleImportVenueClick = useCallback(async () => {
    setImportBusyKey('venue')
    setImportBanner(null)
    try {
      const r = await executeImportVenue()
      setImportBanner({ tone: r.ok ? 'ok' : 'err', text: r.message })
    } finally {
      setImportBusyKey(null)
    }
  }, [executeImportVenue])

  const handleImportDealClick = useCallback(
    async (showRow: BookingIntakeShowRow) => {
      if (!selectedId || !data) return
      setImportBusyKey(`deal-${showRow.id}`)
      setImportBanner(null)
      try {
        await booking.flushAllPending()
        const venueId = data.existing_venue_id ?? data.post_import_venue_id ?? null
        if (!venueId) {
          setImportBanner({ tone: 'err', text: 'Import the venue first.' })
          return
        }
        const { data: vcRows } = await supabase.from('contacts').select('*').eq('venue_id', venueId)
        const venueContacts = (vcRows ?? []) as Contact[]
        const tryImport = (allowOverlap: boolean) =>
          importDealFromIntakeShow({
            rawShowData: showRow.show_data,
            venueData: data,
            venueId,
            showId: showRow.id,
            catalog: pricingCatalog,
            venues,
            deals,
            addDeal,
            updateVenue: async (id, u) => updateVenue(id, u),
            refetchVenues,
            artistEmail: profile?.artist_email,
            allowOverlap,
            venueContacts,
          })
        let r = await tryImport(false)
        if (!r.ok && 'needsOverlapConfirm' in r && r.needsOverlapConfirm) {
          if (!window.confirm('This show overlaps another deal in Pacific time. Save anyway?')) return
          r = await tryImport(true)
        }
        if (!r.ok) {
          setImportBanner({ tone: 'err', text: 'error' in r ? r.error : 'Import failed' })
          return
        }
        setImportBanner({ tone: 'ok', text: `Deal logged: ${r.deal.description}` })
        await booking.refetch()
        await refetchDeals()
        void refreshNavBadges()
      } finally {
        setImportBusyKey(null)
      }
    },
    [
      selectedId,
      data,
      booking,
      pricingCatalog,
      venues,
      deals,
      addDeal,
      updateVenue,
      refetchVenues,
      refetchDeals,
      profile?.artist_email,
      refreshNavBadges,
    ],
  )

  const handleImportAllClick = useCallback(async () => {
    if (!selectedId || !data) return
    setImportBusyKey('all')
    setImportBanner(null)
    try {
      await booking.flushAllPending()
      let venueId: string | null = data.existing_venue_id ?? data.post_import_venue_id ?? null
      if (!venueId) {
        const vr = await executeImportVenue()
        if (!vr.ok || !vr.venueId) {
          setImportBanner({ tone: 'err', text: vr.message })
          return
        }
        venueId = vr.venueId
      }
      const rows = showsSorted.filter(s => !s.imported_deal_id)
      if (rows.length === 0) {
        if (venueId) {
          setImportBanner({ tone: 'ok', text: 'All shows already linked to deals.' })
          return
        }
        const vrOnly = await executeImportVenue()
        setImportBanner({
          tone: vrOnly.ok ? 'ok' : 'err',
          text: vrOnly.ok ? vrOnly.message : vrOnly.message,
        })
        return
      }
      if (!venueId) {
        setImportBanner({ tone: 'err', text: 'Import the venue first.' })
        return
      }
      const { data: vcAll } = await supabase.from('contacts').select('*').eq('venue_id', venueId)
      const venueContactsAll = (vcAll ?? []) as Contact[]
      let dealsAcc: Deal[] = [...deals]
      let lastDeal = ''
      for (const showRow of rows) {
        const tryImport = (allowOverlap: boolean) =>
          importDealFromIntakeShow({
            rawShowData: showRow.show_data,
            venueData: data,
            venueId,
            showId: showRow.id,
            catalog: pricingCatalog,
            venues,
            deals: dealsAcc,
            addDeal,
            updateVenue: async (id, u) => updateVenue(id, u),
            refetchVenues,
            artistEmail: profile?.artist_email,
            allowOverlap,
            venueContacts: venueContactsAll,
          })
        let r = await tryImport(false)
        if (!r.ok && 'needsOverlapConfirm' in r && r.needsOverlapConfirm) {
          if (
            !window.confirm(
              `A show overlaps another deal in Pacific time. Save this show anyway?`,
            )
          ) {
            setImportBanner({ tone: 'err', text: 'Import all stopped at overlap.' })
            return
          }
          r = await tryImport(true)
        }
        if (!r.ok) {
          setImportBanner({
            tone: 'err',
            text: 'error' in r ? r.error : 'Failed on a show draft.',
          })
          return
        }
        dealsAcc = [r.deal, ...dealsAcc]
        lastDeal = r.deal.description
        await refetchDeals()
        await booking.refetch()
        void refreshNavBadges()
      }
      setImportBanner({
        tone: 'ok',
        text: `Imported ${rows.length} deal(s). Last: ${lastDeal}`,
      })
    } finally {
      setImportBusyKey(null)
    }
  }, [
    selectedId,
    data,
    showsSorted,
    executeImportVenue,
    pricingCatalog,
    venues,
    deals,
    addDeal,
    updateVenue,
    refetchVenues,
    refetchDeals,
    booking,
    profile?.artist_email,
    refreshNavBadges,
  ])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (booking.loading && booking.intakes.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!selectedRow || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <header className="h-12 border-b border-neutral-800 flex items-center px-4 shrink-0">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link to="/forms/intakes">
              <ArrowLeft className="h-4 w-4" />
              All intakes
            </Link>
          </Button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Mic2 className="h-10 w-10 text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-sm mb-4 text-center max-w-sm">
            Start a booking intake to prep before the call.
          </p>
          <Button type="button" onClick={() => void handleNewIntake()}>
            New intake
          </Button>
          <Button variant="link" className="mt-3 text-neutral-500 text-xs h-auto p-0" asChild>
            <Link to="/forms/intakes">View intake list</Link>
          </Button>
          {booking.error ? <p className="text-red-400 text-xs mt-4">{booking.error}</p> : null}
        </div>
      </div>
    )
  }

  const viewPhaseIndex = livePhaseIndexFromSection(data.view_section)
  const bookmarkPhaseIndex = livePhaseIndexFromSection(data.last_active_section)
  const showJumpReturn = data.view_section !== data.last_active_section
  const lastPathSection = pathSections[pathSections.length - 1] ?? '7A'

  const knownTypeLabel = data.known_event_type
    ? EVENT_TYPE_OPTIONS.find(o => o.value === data.known_event_type)?.label
    : undefined
  const knownDateFmt = fmtKnownDate(data.known_event_date)
  const greetingMid =
    knownTypeLabel && knownDateFmt
      ? ` about ${knownTypeLabel} on ${knownDateFmt}`
      : knownTypeLabel
        ? ` about ${knownTypeLabel}`
        : knownDateFmt
          ? ` for ${knownDateFmt}`
          : ''
  /** Person actually on the call — on-file contact, or mismatch pick / “Add new” name when different person. */
  const liveScriptAddressee = (() => {
    if (data.confirmed_contact === 'no_different_person') {
      const onCall = data.contact_mismatch_note.trim()
      if (onCall) return onCall
    }
    return data.contact_name.trim()
  })()
  const liveScriptAddresseeHey = liveScriptAddressee.split(/\s+/)[0] ?? ''
  const greetingTalking = liveScriptAddresseeHey
    ? `“Hey ${liveScriptAddresseeHey}, this is Tony with DJ Luijay’s team — thanks for reaching out${greetingMid}. I wanted to get on the phone with you personally to make sure we take care of everything. How’s it going?”`
    : `“Hey — this is Tony with DJ Luijay’s team — thanks for reaching out${greetingMid}. I wanted to get on the phone with you personally to make sure we take care of everything. How’s it going?”`

  const confirmTalking =
    (() => {
      const body = `Just checking — is the contact information you gave us last time still valid, or has anything changed?`
      if (!liveScriptAddresseeHey) return `“${body}”`
      const lowerLead = body.charAt(0).toLowerCase() + body.slice(1)
      return `“${liveScriptAddresseeHey}, ${lowerLead}”`
    })()

  const totalUsdForShow = (sd: BookingIntakeShowDataV3): number => {
    if (sd.pricing_source === 'manual' && sd.manual_gross != null && Number.isFinite(sd.manual_gross)) {
      return roundUsd(sd.manual_gross)
    }
    const inp = buildPriceInputForShow(sd, pricingCatalog)
    if (!inp) return 0
    try {
      return computeDealPrice(inp).gross
    } catch {
      return 0
    }
  }

  const talking2a = `“I just want to make sure I've got everything right — what's the official name of the event, and tell me a little about the venue and how often you guys do this?”`
  const talking3b = `“What kind of music are you envisioning for that night?”`
  const talking4a = `“On the equipment side — does the venue have a full setup, or is Luijay bringing the production?”`
  const talking4b = `“On the night of the event — who's the person we reach out to when Luijay arrives? Is that you, or is there someone else on site handling things? And real quick — where should he plan to park?”`
  const talking4e = `“Is this local to the area, or are we looking at travel?”`
  const talking5a = (() => {
    if (data.multi_show && showsSorted.length > 1) {
      return `“Let me break down the pricing for each date.”`
    }
    const sd = primaryShowSd
    const first = liveScriptAddresseeHey
    const fallback = first
      ? `“Alright ${first}, so based on everything you've described — let me walk you through what this looks like.”`
      : `“Alright, so based on everything you've described — let me walk you through what this looks like.”`
    if (!sd) return fallback
    const etLabel =
      EVENT_TYPE_OPTIONS.find(o => o.value === sd.event_type)?.label?.toLowerCase() ?? ''
    const setH = computeSetLengthHours(sd.set_start_time, sd.set_end_time, sd.overnight_set)
    const setPhrase = setH > 0 ? `${formatSetLengthDisplay(setH)} set` : ''
    let dow = ''
    if (sd.event_date.trim() && /^\d{4}-\d{2}-\d{2}$/.test(sd.event_date.trim())) {
      try {
        dow = new Date(`${sd.event_date.trim()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })
      } catch {
        dow = ''
      }
    }
    const bits: string[] = []
    if (etLabel) bits.push(`the ${etLabel}`)
    if (setPhrase) bits.push(`the ${setPhrase}`)
    if (dow) bits.push(`${dow} night`)
    const mid = bits.length ? bits.join(', ') : `everything`
    if (first) {
      return `“Alright ${first}, so based on ${mid} — let me walk you through what this looks like.”`
    }
    return `“Alright, so based on ${mid} — let me walk you through what this looks like.”`
  })()
  const talking5b = `“We also offer some upgrades if you want to take the night up a notch — anything from MC services to lighting and effects. Want me to run through what's available?”`
  const talking5c = (() => {
    const sd = primaryShowSd
    const email = data.contact_email.trim()
    const total =
      sd != null
        ? totalUsdForShow(sd)
        : showsSorted[0]
          ? totalUsdForShow(parseShowDataV3(showsSorted[0].show_data, showsSorted[0].sort_order))
          : 0
    const setH = sd ? computeSetLengthHours(sd.set_start_time, sd.set_end_time, sd.overnight_set) : 0
    const setPhrase = setH > 0 ? formatSetLengthDisplay(setH) : ''
    const roleLabel = sd
      ? PERFORMANCE_ROLE_OPTIONS.find(o => o.value === sd.performance_role)?.label ?? ''
      : ''
    let dow = ''
    let dateHuman = ''
    if (sd?.event_date.trim() && /^\d{4}-\d{2}-\d{2}$/.test(sd.event_date.trim())) {
      const dt = new Date(`${sd.event_date.trim()}T12:00:00`)
      try {
        dow = dt.toLocaleDateString(undefined, { weekday: 'long' })
        dateHuman = dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      } catch {
        /* ignore */
      }
    }
    const parts: string[] = []
    if (setPhrase && roleLabel) parts.push(`the ${setPhrase} ${roleLabel} set`)
    else if (setPhrase) parts.push(`the ${setPhrase} set`)
    else if (roleLabel) parts.push(`the ${roleLabel} set`)
    if (dow && dateHuman) parts.push(`on ${dow} ${dateHuman}`)
    else if (dateHuman) parts.push(`on ${dateHuman}`)
    const slot = parts.join(' ')
    if (slot && total > 0 && email) {
      return `“So here's where we're at — for ${slot}, the total comes to $${total}. We do a deposit to lock in the date, and I'll send the agreement and invoice over to ${email}. What's the easiest way for you to send that — Zelle, Venmo?”`
    }
    return `“So here's the total — and we'll do a deposit to lock in the date. I'll send everything right over. What's easiest for payment — Zelle, Venmo?”`
  })()
  const talking7close = (() => {
    const name = liveScriptAddressee
    const email = data.contact_email.trim()
    if (name && email) {
      return `“${name}, here's what happens from here — I'm sending over the agreement and invoice to ${email}. Once the deposit's in, the date is officially locked and we'll start coordinating everything on our end. Anything else you need from us?”`
    }
    return `“Here's what happens next — agreement and invoice headed your way. Once the deposit lands, we're locked in. Anything else you need?”`
  })()

  const liveScriptParagraph = (() => {
    const s = data.view_section
    if (s === '1A') return greetingTalking
    if (s === '1B') return confirmTalking
    if (s === '2A') return talking2a
    if (s === '2B')
      return `“What date and time are we looking at, and when do you want Luijay on? And is there anything we should know about getting to the venue — gated community, parking, anything like that?”`
    if (s === '2C') return `“And what's the address for the venue?”`
    if (s === '3B') return talking3b
    if (s === '4A') return talking4a
    if (s === '4B') return talking4b
    if (s === '4E') return talking4e
    if (s === '5A') return talking5a
    if (s === '5B') return talking5b
    if (s === '5C') return talking5c
    if (s === '7A') return talking7close
    if (s === '5D' || s === '5E' || s === '6A' || s === '7B' || s === '7C') return talking7close
    if (s.startsWith('__stub_'))
      return `This phase isn’t wired yet — use the sidebar to stay on an earlier step.`
    return `Work through ${liveSectionTitle(s)} with the client, then capture the details in the section below.`
  })()

  const depositOptions: { value: Phase5DepositPercentV3; label: string }[] = [
    { value: 25, label: '25%' },
    { value: 50, label: '50%' },
    { value: 75, label: '75%' },
    { value: 100, label: '100% upfront' },
  ]
  const balanceTimingOptions: { value: Exclude<Phase5BalanceTimingV3, ''>; label: string }[] = [
    { value: 'before_event', label: 'Before event' },
    { value: 'day_of', label: 'Day of event' },
    { value: 'after_event', label: 'After event' },
    { value: 'custom', label: 'Custom date' },
  ]

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      <header className="h-12 border-b border-neutral-800 flex items-center gap-3 px-3 shrink-0 bg-neutral-950 z-20">
        <Button variant="ghost" size="sm" className="gap-1 text-neutral-400 shrink-0" asChild>
          <Link to="/forms/intakes" title="All intakes">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Select
            value={selectedId ?? ''}
            onValueChange={v => {
              setSelectedId(v)
              setSearchParams({ intakeId: v }, { replace: true })
            }}
          >
            <SelectTrigger className="h-9 max-w-[220px] border-neutral-800 bg-neutral-900/80 text-sm">
              <SelectValue placeholder="Intake" />
            </SelectTrigger>
            <SelectContent>
              {booking.intakes.map(i => (
                <SelectItem key={i.id} value={i.id}>
                  {i.title || 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 border-neutral-700" onClick={() => void handleNewIntake()}>
            New
          </Button>
        </div>
        <Input
          className="h-9 max-w-md border-neutral-800 bg-neutral-900/80 text-sm hidden md:block"
          value={selectedRow.title}
          onChange={e => booking.updateTitle(selectedId!, e.target.value)}
          placeholder="Intake title"
        />
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-neutral-500 hidden sm:inline">Auto-saved</span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-9 gap-1"
            disabled={savingUi}
            onClick={() => void handleSave()}
          >
            {savingUi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 text-neutral-400" onClick={() => void handleExit()}>
            Exit
          </Button>
        </div>
      </header>

      {data.session_mode === 'pre_call' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-24">
            {precallError ? (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{precallError}</div>
            ) : null}

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Venue source</h2>
              <IntakeCompactDual
                value={data.venue_source === 'existing'}
                onChange={v => {
                  if (v) patch({ venue_source: 'existing' })
                  else {
                    booking.updateVenueData(selectedId!, {
                      venue_source: 'new',
                      existing_venue_id: null,
                      selected_contact_id: null,
                    })
                  }
                }}
                a={{ id: 'new', label: 'New venue' }}
                b={{ id: 'ex', label: 'Existing venue' }}
              />
              {data.venue_source === 'existing' ? (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
                    <Input
                      className="pl-8 h-10 border-neutral-800 bg-neutral-950/80"
                      placeholder="Search venues…"
                      value={venueSearch}
                      onChange={e => setVenueSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
                    {filteredVenues.length === 0 ? (
                      <p className="p-3 text-sm text-neutral-500">No venues match.</p>
                    ) : (
                      filteredVenues.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          className={cn(
                            'w-full text-left px-3 py-2.5 text-sm hover:bg-neutral-800/80 transition-colors',
                            data.existing_venue_id === v.id && 'bg-neutral-800/60',
                          )}
                          onClick={() => void applyVenuePick(v)}
                        >
                          <span className="font-medium text-neutral-100">{v.name}</span>
                          <span className="block text-xs text-neutral-500">
                            {[v.city, v.region].filter(Boolean).join(', ') || '—'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  {data.existing_venue_id && contactsForVenue.length > 0 ? (
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Speaking with</Label>
                      <Select value={data.selected_contact_id ?? ''} onValueChange={onContactSelect}>
                        <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                          <SelectValue placeholder="Contact" />
                        </SelectTrigger>
                        <SelectContent>
                          {contactsForVenue.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {c.role ? ` · ${c.role}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Who am I calling?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Contact name *</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    value={data.contact_name}
                    onChange={e => patch({ contact_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Company / brand</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    value={data.contact_company}
                    onChange={e => patch({ contact_company: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Role / title</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    value={data.contact_role}
                    onChange={e => patch({ contact_role: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Phone *</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    type="tel"
                    value={data.contact_phone}
                    onChange={e => patch({ contact_phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Email</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    type="email"
                    value={data.contact_email}
                    onChange={e => patch({ contact_email: e.target.value })}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pipeline & commission</h2>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-neutral-400 text-xs">Lead source *</Label>
                  <IntakeCompactDual
                    value={data.outreach_track === 'community'}
                    onChange={v => patch({ outreach_track: (v ? 'community' : 'pipeline') as OutreachTrack })}
                    a={{ id: 'pipe', label: OUTREACH_TRACK_LABELS.pipeline }}
                    b={{ id: 'comm', label: OUTREACH_TRACK_LABELS.community }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Commission tier *</Label>
                  <Select
                    value={data.commission_tier}
                    disabled={data.outreach_track === 'community'}
                    onValueChange={v => patch({ commission_tier: v as CommissionTier })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMISSION_ORDER.map(t => (
                        <SelectItem key={t} value={t}>{commissionLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {data.outreach_track === 'community' ? (
                    <p className="text-[11px] text-neutral-500">Community leads use artist network (0%).</p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label className="text-neutral-400 text-xs">Priority</Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => patch({ priority: n })}
                        className={cn(
                          'h-11 w-11 rounded-lg border text-sm font-medium transition-colors',
                          data.priority === n
                            ? 'border-neutral-200 bg-neutral-200 text-neutral-950'
                            : 'border-neutral-700 text-neutral-400 hover:border-neutral-500',
                        )}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Shows on this call</h2>
              <IntakeCompactDual
                value={data.multi_show}
                onChange={v => patch({ multi_show: v })}
                a={{ id: 'single', label: 'Single show' }}
                b={{ id: 'multi', label: 'Multiple shows' }}
              />
              {data.multi_show ? (
                <div className="space-y-1.5 max-w-xs">
                  <Label className="text-neutral-400 text-xs">How many?</Label>
                  <Select
                    value={String(data.show_count)}
                    onValueChange={v => patch({ show_count: Number(v) as 2 | 3 })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </section>

            <div className="flex justify-center pt-4">
              <Button
                type="button"
                size="lg"
                className="min-h-[52px] px-8 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => void handleBeginCall()}
              >
                Begin call
              </Button>
            </div>
          </div>
        </div>
      ) : data.session_mode === 'live_call' ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
          <aside className="w-full md:w-[248px] shrink-0 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col py-2 md:py-3 px-2 bg-neutral-950">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 mb-1.5 md:mb-2 shrink-0">
              Call
            </p>
            <nav className="flex md:flex-col flex-row gap-0.5 md:space-y-0.5 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mx-0.5 px-0.5 md:mx-0 md:px-0 flex-1 md:min-h-0">
              {LIVE_PHASES.map((ph, idx) => (
                <button
                  key={ph.id}
                  type="button"
                  onClick={() => handleJumpPhase(idx)}
                  className={cn(
                    'shrink-0 md:w-full text-left rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                    idx === viewPhaseIndex
                      ? 'bg-neutral-100 text-neutral-950 font-semibold'
                      : 'text-neutral-400 hover:bg-neutral-900/80 hover:text-neutral-200',
                  )}
                >
                  <span className="text-neutral-500 font-mono text-xs w-4 shrink-0">{ph.id}</span>
                  <span className="flex-1 min-w-0">{ph.label}</span>
                  {idx === bookmarkPhaseIndex && showJumpReturn ? (
                    <span className="shrink-0 inline-flex" title="Your place in the flow">
                      <Pin className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                    </span>
                  ) : null}
                </button>
              ))}
            </nav>
            {showJumpReturn ? (
              <div className="shrink-0 mt-2 pt-2 border-t border-white/[0.08] px-1">
                <button
                  type="button"
                  onClick={() => handleJumpReturn()}
                  title={`Return to ${liveSectionTitle(data.last_active_section)}`}
                  aria-label={`Return to ${liveSectionTitle(data.last_active_section)}`}
                  className={cn(
                    'flex h-10 w-full items-center justify-center rounded-lg border-2 border-orange-500',
                    'bg-black text-orange-500 hover:border-orange-400 hover:text-orange-400',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950',
                  )}
                >
                  <Undo2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
          </aside>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 pb-24 sm:p-6 items-start">
              <div
                key={data.view_section}
                className="w-full max-w-2xl shrink-0 rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 sm:p-5 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <IntakeLiveScriptCaptureStack
                  stepTitle={liveSectionTitle(data.view_section)}
                  script={<p>{liveScriptParagraph}</p>}
                  capture={
                    <>
                      {data.view_section.startsWith('__stub_') ? (
                        <>
                          <p className="text-sm text-neutral-300">
                            This part of the call flow is not built yet. Use Return or the sidebar to go back to
                            Opening.
                          </p>
                        </>
                      ) : data.view_section === '1A' ? (
                        <>
                          <div className="space-y-3">
                            <div className="space-y-1.5 min-w-0">
                              <Label className="text-neutral-400 text-xs">
                                Speaking with the right person?
                              </Label>
                              <div className="flex min-w-0 flex-col gap-3 sm:gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                                <div className="shrink-0">
                                  <IntakeYesNoPair
                                    value={data.confirmed_contact}
                                    onChange={v => {
                                      setMismatchAddNewChosen(false)
                                      patch(
                                        v === 'yes'
                                          ? {
                                              confirmed_contact: v,
                                              contact_mismatch_context: '',
                                              contact_mismatch_note: '',
                                              contact_mismatch_linked_contact_id: null,
                                            }
                                          : {
                                              confirmed_contact: v,
                                              contact_mismatch_context: '',
                                              contact_mismatch_note: '',
                                              contact_mismatch_linked_contact_id: null,
                                            },
                                      )
                                    }}
                                    yesValue="yes"
                                    noValue="no_different_person"
                                    yesLabel="Yes"
                                    noLabel="Different person"
                                  />
                                </div>
                                {live1aShowVenueMismatchChips ? (
                                  <div className="flex min-w-0 flex-wrap items-end gap-1.5">
                                    {otherVenueContactsForMismatch.map(c => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        title={
                                          contactRoleForDisplay(c)
                                            ? `${c.name} · ${contactRoleForDisplay(c)}`
                                            : c.name
                                        }
                                        onClick={() => {
                                          setMismatchAddNewChosen(false)
                                          patch({
                                            contact_mismatch_note: c.name,
                                            contact_mismatch_context: contactToMismatchContext(c),
                                            contact_mismatch_linked_contact_id: c.id,
                                          })
                                        }}
                                        className={cn(
                                          'max-w-[9.5rem] truncate rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                          data.contact_mismatch_linked_contact_id === c.id
                                            ? 'border-white/[0.35] bg-neutral-800/80 text-neutral-100'
                                            : 'border-white/[0.08] bg-neutral-900/50 text-neutral-300 hover:border-white/[0.14] hover:text-neutral-100',
                                        )}
                                      >
                                        {c.name}
                                      </button>
                                    ))}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMismatchAddNewChosen(true)
                                        patch({
                                          contact_mismatch_context: '',
                                          contact_mismatch_note: '',
                                          contact_mismatch_linked_contact_id: null,
                                        })
                                      }}
                                      className={cn(
                                        'rounded-md border border-dashed border-white/[0.18] bg-neutral-900/30 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200',
                                      )}
                                    >
                                      Add new
                                    </button>
                                  </div>
                                ) : null}
                                {live1aShowMismatchForm ? (
                                  <>
                                    <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[6.5rem] sm:flex-initial sm:w-36">
                                      <Label className="text-neutral-400 text-[10px] sm:text-xs">Name</Label>
                                      <Input
                                        className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                        value={data.contact_mismatch_note}
                                        onChange={e => patch({ contact_mismatch_note: e.target.value })}
                                        placeholder="Their name"
                                        autoComplete="name"
                                        aria-label="Name of person on the call"
                                      />
                                    </div>
                                    <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[11rem] sm:max-w-md sm:flex-1">
                                      <Label className="text-neutral-400 text-[10px] sm:text-xs">Title</Label>
                                      <Select
                                        value={
                                          data.contact_mismatch_context.trim()
                                            ? data.contact_mismatch_context
                                            : '__none__'
                                        }
                                        onValueChange={v =>
                                          patch({
                                            contact_mismatch_context:
                                              v === '__none__' ? '' : (v as Phase1ContactMismatchContextV3),
                                          })
                                        }
                                      >
                                        <SelectTrigger
                                          className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                          aria-label="Their title or role"
                                        >
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">—</SelectItem>
                                          {CONTACT_MISMATCH_ROLE_ORDER.map(key => (
                                            <SelectItem key={key} value={key}>
                                              {CONTACT_MISMATCH_CONTEXT_LABELS[key]}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-neutral-400 text-xs">Call energy</Label>
                              <IntakeCallVibeChips
                                value={data.call_vibe}
                                onChange={v => patch({ call_vibe: v })}
                              />
                            </div>
                          </div>
                        </>
                      ) : data.view_section === '1B' ? (
                        <>
                          <div className="space-y-3">
                            {(() => {
                              const phoneOnFile =
                                data.contact_phone_on_file.trim() || data.contact_phone.trim()
                              const phoneAdding = data.phone_confirmed === 'update_needed'
                              const emailOnFile =
                                data.contact_email_on_file.trim() || data.contact_email.trim()
                              const emailAdding =
                                data.email_confirmed === 'update_needed' ||
                                data.email_confirmed === 'need_to_get'
                              return (
                                <>
                                  <div className="rounded-lg border border-white/[0.08] bg-neutral-950/40 p-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                                        <div className="space-y-0.5 shrink-0">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {phoneAdding ? 'Add phone number' : 'Phone on file'}
                                          </p>
                                          {phoneAdding ? (
                                            <Input
                                              className="h-9 w-44 max-w-full border-neutral-800 bg-neutral-950/80 text-sm tabular-nums"
                                              type="tel"
                                              inputMode="tel"
                                              autoComplete="tel"
                                              value={data.contact_phone_added}
                                              onChange={e =>
                                                patch({ contact_phone_added: e.target.value })
                                              }
                                              placeholder="e.g. 9514989147"
                                              aria-label="Phone number to add"
                                            />
                                          ) : (
                                            <p className="text-sm text-neutral-100 tabular-nums break-all">
                                              {phoneOnFile || '—'}
                                            </p>
                                          )}
                                        </div>
                                        {phoneAdding ? (
                                          <div className="min-w-0 flex-1 sm:max-w-[min(100%,16rem)]">
                                            <Select
                                              value={
                                                data.contact_phone_added_owner.trim()
                                                  ? data.contact_phone_added_owner
                                                  : '__none__'
                                              }
                                              onValueChange={v =>
                                                patch({
                                                  contact_phone_added_owner:
                                                    v === '__none__' ? '' : v,
                                                })
                                              }
                                            >
                                              <SelectTrigger
                                                className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                                aria-label="Whose phone number"
                                              >
                                                <SelectValue placeholder="Whose number?" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="__none__">— Choose person</SelectItem>
                                                {live1bDetailOwnerChips.map(chip => (
                                                  <SelectItem key={`ph-${chip.key}`} value={chip.key}>
                                                    {chip.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-end sm:pb-0.5">
                                        <span className="text-[11px] text-neutral-500 sm:order-2">
                                          Add / update
                                        </span>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={phoneAdding}
                                          onClick={() => {
                                            const on = !phoneAdding
                                            patch({
                                              phone_confirmed: on ? 'update_needed' : 'confirmed',
                                              contact_phone_on_file: on
                                                ? data.contact_phone_on_file.trim() ||
                                                  data.contact_phone.trim()
                                                : data.contact_phone_on_file,
                                            })
                                          }}
                                          className={cn(
                                            'relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400',
                                            phoneAdding
                                              ? 'border-neutral-300 bg-neutral-200'
                                              : 'border-white/[0.12] bg-neutral-800',
                                          )}
                                        >
                                                                                   <span
                                            className={cn(
                                              'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                                              phoneAdding ? 'translate-x-[1.125rem]' : 'translate-x-0',
                                            )}
                                            aria-hidden
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  <div className="rounded-lg border border-white/[0.08] bg-neutral-950/40 p-3">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                                      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
                                        <div className="space-y-0.5 shrink-0">
                                          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                                            {emailAdding ? 'Add email' : 'Email on file'}
                                          </p>
                                          {emailAdding ? (
                                            <Input
                                              className="h-9 w-56 max-w-full border-neutral-800 bg-neutral-950/80 text-sm"
                                              type="email"
                                              autoComplete="email"
                                              value={data.contact_email_added}
                                              onChange={e => {
                                                const v = e.target.value
                                                const t = v.trim()
                                                patch(
                                                  t
                                                    ? { contact_email_added: v, contact_email: t }
                                                    : { contact_email_added: v },
                                                )
                                              }}
                                              placeholder="Email they gave on the call"
                                              aria-label="Email to add"
                                            />
                                          ) : (
                                            <p className="text-sm text-neutral-100 break-all">
                                              {emailOnFile || '—'}
                                            </p>
                                          )}
                                        </div>
                                        {emailAdding ? (
                                          <div className="min-w-0 flex-1 sm:max-w-[min(100%,16rem)]">
                                            <Select
                                              value={
                                                data.contact_email_added_owner.trim()
                                                  ? data.contact_email_added_owner
                                                  : '__none__'
                                              }
                                              onValueChange={v =>
                                                patch({
                                                  contact_email_added_owner:
                                                    v === '__none__' ? '' : v,
                                                })
                                              }
                                            >
                                              <SelectTrigger
                                                className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                                aria-label="Whose email"
                                              >
                                                <SelectValue placeholder="Whose email?" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="__none__">— Choose person</SelectItem>
                                                {live1bDetailOwnerChips.map(chip => (
                                                  <SelectItem key={`em-${chip.key}`} value={chip.key}>
                                                    {chip.label}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : null}
                                      </div>
                                      <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-end sm:pb-0.5">
                                        <span className="text-[11px] text-neutral-500 sm:order-2">
                                          Add / update
                                        </span>
                                        <button
                                          type="button"
                                          role="switch"
                                          aria-checked={emailAdding}
                                          onClick={() => {
                                            const on = !emailAdding
                                            patch({
                                              email_confirmed: on ? 'update_needed' : 'confirmed',
                                              contact_email_on_file: on
                                                ? data.contact_email_on_file.trim() ||
                                                  data.contact_email.trim()
                                                : data.contact_email_on_file,
                                            })
                                          }}
                                          className={cn(
                                            'relative h-5 w-9 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400',
                                            emailAdding
                                              ? 'border-neutral-300 bg-neutral-200'
                                              : 'border-white/[0.12] bg-neutral-800',
                                          )}
                                        >
                                          <span
                                            className={cn(
                                              'absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                                              emailAdding ? 'translate-x-[1.125rem]' : 'translate-x-0',
                                            )}
                                            aria-hidden
                                          />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </>
                              )
                            })()}
                          </div>
                        </>
                      ) : data.view_section === '2A' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same details for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_2a}
                          onChange={v => onSameForAllChange('same_for_all_2a', v, pick2a)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_2a ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_2a ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                Show {idx + 1}
                              </p>
                            ) : null}
                            {(() => {
                              const relax2a = intakePhase2aRelaxDynamicFilters(sd)
                              const { suggested: venueSuggested, rest: venueRest } =
                                intakeVenuePickOptionsForEvent(sd.event_type, relax2a)
                              const venuePickVal = intakeVenuePickValueFromShow(sd)
                              const showVenueFreeform =
                                sd.venue_type === 'other' &&
                                (venuePickVal === 'other_describe' ||
                                  venuePickVal === '__custom__')
                              return (
                                <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
                                  <div className="min-w-0 space-y-1.5 sm:col-span-2">
                                    <Label className="text-neutral-400 text-xs">Event name</Label>
                                    <Input
                                      className="h-11 border-neutral-800 bg-neutral-950/80"
                                      placeholder="Title or working name — leave blank if they didn't give one yet"
                                      value={sd.event_name_text}
                                      onChange={e =>
                                        applyShowPatch(
                                          row.id,
                                          { event_name_text: e.target.value, event_name_flag: '' },
                                          '2a',
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="min-w-0 space-y-1.5">
                                    <Label className="text-neutral-400 text-xs">Event type</Label>
                                    {sd.event_type === 'other' ? (
                                      <Intake2aOtherFieldInput
                                        placeholder="Describe event type"
                                        value={sd.event_type_other}
                                        onValueChange={v =>
                                          applyShowPatch(row.id, { event_type_other: v }, '2a')
                                        }
                                        onBackToPresets={() =>
                                          applyShowPatch(row.id, { event_type: '', event_type_other: '' }, '2a')
                                        }
                                      />
                                    ) : (
                                      <Select
                                        value={sd.event_type || '__none__'}
                                        onValueChange={v =>
                                          applyShowPatch(
                                            row.id,
                                            { event_type: v === '__none__' ? '' : (v as KnownEventTypeV3) },
                                            '2a',
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">—</SelectItem>
                                          {EVENT_TYPE_OPTIONS.map(o => (
                                            <SelectItem key={o.value} value={o.value}>
                                              {o.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-1.5">
                                    <Label className="text-neutral-400 text-xs">Venue type</Label>
                                    {showVenueFreeform ? (
                                      <Intake2aOtherFieldInput
                                        placeholder="Describe venue type"
                                        value={sd.venue_type_other}
                                        onValueChange={v =>
                                          applyShowPatch(row.id, { venue_type_other: v }, '2a')
                                        }
                                        onBackToPresets={() =>
                                          applyShowPatch(row.id, { venue_type: '', venue_type_other: '' }, '2a')
                                        }
                                      />
                                    ) : (
                                      <Select
                                        value={
                                          !sd.venue_type
                                            ? '__none__'
                                            : venuePickVal === '__custom__' ||
                                                venuePickVal === 'other_describe'
                                              ? '__none__'
                                              : venuePickVal
                                        }
                                        onValueChange={v => {
                                          if (v === '__none__') {
                                            applyShowPatch(
                                              row.id,
                                              { venue_type: '', venue_type_other: '' },
                                              '2a',
                                            )
                                            return
                                          }
                                          const opt = findIntakeVenuePickById(v)
                                          if (!opt) return
                                          applyShowPatch(
                                            row.id,
                                            {
                                              venue_type: opt.venueType,
                                              venue_type_other:
                                                opt.venueType === 'other'
                                                  ? opt.id === 'other_describe'
                                                    ? ''
                                                    : (opt.otherDetail ?? '')
                                                  : '',
                                            },
                                            '2a',
                                          )
                                        }}
                                      >
                                        <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">—</SelectItem>
                                          {venueSuggested.length > 0 ? (
                                            <SelectGroup>
                                              <SelectLabel>
                                                Popular for{' '}
                                                {knownEventTypeLabel(
                                                  sd.event_type as KnownEventTypeV3,
                                                )}
                                              </SelectLabel>
                                              {venueSuggested.map(o => (
                                                <SelectItem key={o.id} value={o.id}>
                                                  {o.label}
                                                </SelectItem>
                                              ))}
                                            </SelectGroup>
                                          ) : null}
                                          {venueSuggested.length > 0 && venueRest.length > 0 ? (
                                            <SelectSeparator />
                                          ) : null}
                                          {venueRest.length > 0 ? (
                                            <SelectGroup>
                                              {venueSuggested.length > 0 ? (
                                                <SelectLabel>More options</SelectLabel>
                                              ) : null}
                                              {venueRest.map(o => (
                                                <SelectItem key={o.id} value={o.id}>
                                                  {o.label}
                                                </SelectItem>
                                              ))}
                                            </SelectGroup>
                                          ) : null}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-1.5">
                                    <Label className="text-neutral-400 text-xs">Setting</Label>
                                    {sd.setting === 'other' ? (
                                      <Intake2aOtherFieldInput
                                        placeholder="Describe setting"
                                        value={sd.setting_other_detail}
                                        onValueChange={v =>
                                          applyShowPatch(row.id, { setting_other_detail: v }, '2a')
                                        }
                                        onBackToPresets={() =>
                                          applyShowPatch(
                                            row.id,
                                            { setting: '', setting_other_detail: '' },
                                            '2a',
                                          )
                                        }
                                      />
                                    ) : (
                                      <Select
                                        value={sd.setting.trim() ? sd.setting : '__none__'}
                                        onValueChange={v =>
                                          applyShowPatch(
                                            row.id,
                                            { setting: v === '__none__' ? '' : (v as Phase2SettingV3) },
                                            '2a',
                                          )
                                        }
                                      >
                                        <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                          <SelectValue placeholder="Select" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">—</SelectItem>
                                          {PHASE2_SETTING_OPTIONS.map(o => (
                                            <SelectItem key={o.value} value={o.value}>
                                              {o.label}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                  <div className="min-w-0 space-y-1.5">
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
                                      <span className="text-neutral-400 text-xs shrink-0">Event cadence</span>
                                      <span className="text-[11px] text-neutral-500">
                                        One-off or recurring?
                                      </span>
                                    </div>
                                    <div
                                      className="flex flex-nowrap gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
                                      role="group"
                                      aria-label="Event cadence"
                                    >
                                      <button
                                        type="button"
                                        aria-pressed={sd.event_schedule_type === 'one_off'}
                                        onClick={() =>
                                          applyShowPatch(
                                            row.id,
                                            { event_schedule_type: 'one_off', event_recurrence_interval: '' },
                                            '2a',
                                          )
                                        }
                                        className={cn(
                                          'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                                          sd.event_schedule_type === 'one_off'
                                            ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                            : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:border-white/[0.12] hover:text-neutral-200',
                                        )}
                                      >
                                        One-off
                                      </button>
                                      {sd.event_schedule_type === 'one_off' ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            applyShowPatch(
                                              row.id,
                                              { event_schedule_type: 'recurring', event_recurrence_interval: '' },
                                              '2a',
                                            )
                                          }
                                          className={cn(
                                            'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                                            'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:border-white/[0.12] hover:text-neutral-200',
                                          )}
                                        >
                                          Recurring
                                        </button>
                                      ) : (
                                        <>
                                          {(
                                            [
                                              { id: 'weekly' as const, label: 'Weekly' },
                                              { id: 'biweekly' as const, label: 'Bi-weekly' },
                                              { id: 'monthly' as const, label: 'Monthly' },
                                            ] as const
                                          ).map(opt => {
                                            const on = sd.event_recurrence_interval === opt.id
                                            return (
                                              <button
                                                key={opt.id}
                                                type="button"
                                                aria-pressed={on}
                                                onClick={() =>
                                                  applyShowPatch(
                                                    row.id,
                                                    {
                                                      event_schedule_type: 'recurring',
                                                      event_recurrence_interval: on ? '' : opt.id,
                                                    },
                                                    '2a',
                                                  )
                                                }
                                                className={cn(
                                                  'rounded-md border px-2 py-1.5 text-[11px] font-medium transition-colors',
                                                  on
                                                    ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                                    : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:border-white/[0.12] hover:text-neutral-200',
                                                )}
                                              >
                                                {opt.label}
                                              </button>
                                            )
                                          })}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>
                        )
                      },
                    )}
                  </>
                ) : data.view_section === '2B' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same schedule for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_2b}
                          onChange={v => onSameForAllChange('same_for_all_2b', v, pick2b)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_2b ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_2b ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              </p>
                            ) : null}
                            <Intake2bSchedulePanel
                              eventDate={sd.event_date}
                              eventStartTime={sd.event_start_time}
                              eventEndTime={sd.event_end_time}
                              setStartTime={sd.set_start_time}
                              setEndTime={sd.set_end_time}
                              overnightEvent={sd.overnight_event}
                              overnightSet={sd.overnight_set}
                              onEventDate={d => applyShowPatch(row.id, { event_date: d }, '2b')}
                              onEventStartTime={v =>
                                applyShowPatch(row.id, {
                                  event_start_time: v,
                                  ...(v.trim()
                                    ? {
                                        event_end_time: addHoursToQuarterHm(
                                          v,
                                          INTAKE_DEFAULT_EVENT_DURATION_HOURS,
                                        ),
                                      }
                                    : {}),
                                }, '2b')
                              }
                              onEventEndTime={v =>
                                applyShowPatch(row.id, { event_end_time: v }, '2b')
                              }
                              onSetStartTime={v =>
                                applyShowPatch(row.id, { set_start_time: v }, '2b')
                              }
                              onSetEndTime={v =>
                                applyShowPatch(row.id, { set_end_time: v }, '2b')
                              }
                              onSetDjRange={(s, e) =>
                                applyShowPatch(row.id, { set_start_time: s, set_end_time: e }, '2b')
                              }
                            />
                          </div>
                        )
                      },
                    )}
                    <div className="space-y-3 pt-4 border-t border-white/[0.06] min-w-0">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
                        <div className="w-full shrink-0 space-y-4 sm:w-auto sm:max-w-[13.5rem]">
                          {(!data.multi_show || data.same_for_all_2b ? showsSorted.slice(0, 1) : showsSorted).map(
                            (row, idx) => {
                              const sd = parseShowDataV3(row.show_data, row.sort_order)
                              const est = sd.event_start_time.trim()
                              const dRaw = sd.doors_open_time.trim()
                              const display = dRaw || est
                              const showDoorLabel =
                                data.multi_show && !data.same_for_all_2b && showsSorted.length > 1
                              return (
                                <div
                                  key={`doors-${row.id}`}
                                  className={cn('min-w-0', idx > 0 && 'pt-3 border-t border-white/[0.06]')}
                                >
                                  {showDoorLabel ? (
                                    <p className="text-[11px] text-neutral-500 mb-2 flex items-center gap-2">
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ background: sd.color }}
                                      />
                                      {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                                    </p>
                                  ) : null}
                                  <IntakeQuarterHourTimeField
                                    id={`intake-2b-doors-${row.id}`}
                                    label="What time do doors open?"
                                    value={display}
                                    allowClear
                                    onChange={v => {
                                      const cleared = !v.trim()
                                      if (cleared) {
                                        applyShowPatch(row.id, { doors_open_time: '' }, '2b')
                                        return
                                      }
                                      const sameAsEvent =
                                        !!est && intakeHmKey(v) === intakeHmKey(est)
                                      applyShowPatch(
                                        row.id,
                                        { doors_open_time: sameAsEvent ? '' : v },
                                        '2b',
                                      )
                                    }}
                                    triggerClassName="h-11"
                                  />
                                </div>
                              )
                            },
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label className="text-neutral-400 text-xs">
                            Anything else we should know about getting to the venue?
                          </Label>
                          <IntakeYesNoPair
                            value={data.venue_access_notes_flag}
                            onChange={v => {
                              const x = v as Phase2VenueAccessNotesFlagV3
                              if (x === 'no') {
                                patch({
                                  venue_access_notes_flag: 'no',
                                  venue_access_note_tags: [],
                                  venue_access_other_notes: '',
                                })
                              } else {
                                patch({ venue_access_notes_flag: 'yes' })
                              }
                            }}
                            yesValue="yes"
                            noValue="no"
                            yesLabel="Yes"
                            noLabel="No"
                          />
                        </div>
                      </div>
                      {data.venue_access_notes_flag === 'yes' ? (
                        <IntakeCompactChipRow<VenueAccessNoteTagV3>
                          label="Tap all that apply"
                          selected={data.venue_access_note_tags}
                          ids={[...VENUE_ACCESS_NOTE_TAG_KEYS]}
                          labels={VENUE_ACCESS_NOTE_TAG_LABELS}
                          onChange={next =>
                            patch({
                              venue_access_note_tags: next,
                              venue_access_other_notes: next.includes('other')
                                ? data.venue_access_other_notes
                                : '',
                            })
                          }
                        />
                      ) : null}
                    </div>
                  </>
                ) : data.view_section === '2C' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same address &amp; capacity for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_2c}
                          onChange={v => onSameForAllChange('same_for_all_2c', v, pick2c)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_2c ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_2c ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              </p>
                            ) : null}
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Venue name</Label>
                              <Input
                                className="h-11 border-neutral-800 bg-neutral-950/80"
                                placeholder="Venue or room name"
                                value={sd.venue_name_text}
                                onChange={e =>
                                  applyShowPatch(
                                    row.id,
                                    {
                                      venue_name_text: e.target.value,
                                      venue_name_flag: sd.venue_name_flag || 'already_have',
                                      address_status: sd.address_status || 'have_it',
                                    },
                                    '2c',
                                  )
                                }
                              />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">Street</Label>
                                <Input
                                  className="h-11 border-neutral-800 bg-neutral-950/80"
                                  placeholder="Number and street"
                                  value={sd.street_address}
                                  onChange={e =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        street_address: e.target.value,
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">Apt, suite, unit</Label>
                                <Input
                                  className="h-11 border-neutral-800 bg-neutral-950/80"
                                  placeholder="Optional"
                                  value={sd.address_line2}
                                  onChange={e =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        address_line2: e.target.value,
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                />
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">City</Label>
                                <Input
                                  className="h-11 border-neutral-800 bg-neutral-950/80"
                                  placeholder="City"
                                  value={sd.city_text}
                                  onChange={e =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        city_text: e.target.value,
                                        city_flag: sd.city_flag || 'already_have',
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">State / region</Label>
                                <Select
                                  value={sd.state_region || '__none__'}
                                  onValueChange={v =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        state_region: v === '__none__' ? '' : v,
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-60">
                                    <SelectItem value="__none__">—</SelectItem>
                                    {US_STATE_OPTIONS.map(o => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">Postal code</Label>
                                <Input
                                  className="h-11 border-neutral-800 bg-neutral-950/80"
                                  placeholder="ZIP / postal"
                                  value={sd.postal_code}
                                  onChange={e =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        postal_code: e.target.value,
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-1.5 min-w-0">
                                <Label className="text-neutral-400 text-xs">Scale / capacity</Label>
                                <Select
                                  value={sd.capacity_range || '__none__'}
                                  onValueChange={v =>
                                    applyShowPatch(
                                      row.id,
                                      {
                                        capacity_range:
                                          v === '__none__' ? '' : (v as CapacityRangeV3),
                                        address_status: sd.address_status || 'have_it',
                                      },
                                      '2c',
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                    <SelectValue placeholder="Expected size" />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-[min(28rem,70vh)]">
                                    <SelectItem value="__none__">—</SelectItem>
                                    {CAPACITY_RANGE_OPTIONS.map(o => (
                                      <SelectItem key={o.value} value={o.value}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        )
                      },
                    )}
                  </>
                ) : data.view_section === '3B' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same music details for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_3b}
                          onChange={v => onSameForAllChange('same_for_all_3b', v, pick3b)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_3b ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_3b ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              </p>
                            ) : null}
                            <MusicVibePresetRow
                              selectedGenres={sd.genres}
                              onApplyPreset={genres =>
                                applyShowPatch(row.id, { genres: [...genres] }, '3b')
                              }
                            />
                            <div className="space-y-2">
                              <Label className="text-neutral-400 text-xs">Genre</Label>
                              <GenreChipRow
                                selected={sd.genres}
                                onChange={next => applyShowPatch(row.id, { genres: next }, '3b')}
                              />
                            </div>
                          </div>
                        )
                      },
                    )}
                  </>
                ) : data.view_section === '4A' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same equipment details for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_4a}
                          onChange={v => onSameForAllChange('same_for_all_4a', v, pick4a)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_4a ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_4a ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              </p>
                            ) : null}
                            <EquipmentIntakeFlowCapture
                              sd={sd}
                              pricingCatalog={pricingCatalog}
                              soundTechPickOptions={equipmentSoundTechPickOptions}
                              soundTechUiContext={soundTechUiContextForEquipment}
                              onEnsureSoundTechContact={ensureSoundTechContact}
                              onPatch={partial => applyShowPatch(row.id, partial, '4a')}
                            />
                          </div>
                        )
                      },
                    )}
                  </>
                ) : data.view_section === '4B' ? (
                  <div className="space-y-4 min-w-0">
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Same as main contact?</Label>
                      <div className="flex min-w-0 flex-col gap-3 sm:gap-2 lg:flex-row lg:flex-wrap lg:items-end">
                        <div className="shrink-0">
                          <IntakeYesNoPair
                            value={data.onsite_same_contact}
                            onChange={v => {
                              const x = v as Phase4OnsiteSameContactV3
                              if (x === 'same') {
                                setOnsiteAddNewChosen(false)
                                patch({
                                  onsite_same_contact: x,
                                  onsite_name_flag: '',
                                  onsite_phone_flag: '',
                                  onsite_linked_contact_id: null,
                                  onsite_title_context: '',
                                  onsite_contact_name: '',
                                  onsite_contact_phone: '',
                                  onsite_contact_role: '',
                                  onsite_poc_role: '',
                                  onsite_connect_method: '',
                                  onsite_connect_window: '',
                                })
                              } else {
                                setOnsiteAddNewChosen(false)
                                patch({
                                  onsite_same_contact: x,
                                  onsite_poc_role: '',
                                  onsite_connect_method: '',
                                  onsite_connect_window: '',
                                })
                              }
                            }}
                            yesValue="same"
                            noValue="different"
                            yesLabel="Same person"
                            noLabel="Different person"
                          />
                        </div>
                        {data.onsite_same_contact === 'different' ? (
                          <>
                            {live4bShowVenueOnsiteChips ? (
                              <div className="flex min-w-0 flex-wrap items-end gap-1.5">
                                {otherVenueContactsForMismatch.map(c => (
                                  <button
                                    key={c.id}
                                    type="button"
                                    title={
                                      contactRoleForDisplay(c)
                                        ? `${c.name} · ${contactRoleForDisplay(c)}`
                                        : c.name
                                    }
                                    onClick={() => {
                                      setOnsiteAddNewChosen(false)
                                      const phone = (c.phone ?? '').trim()
                                      patch({
                                        onsite_linked_contact_id: c.id,
                                        onsite_contact_name: c.name,
                                        onsite_contact_phone: phone,
                                        onsite_contact_role: contactRoleForDisplay(c),
                                        onsite_title_context: contactToMismatchContext(c),
                                        onsite_name_flag: 'capture_later',
                                        onsite_phone_flag: phone ? 'capture_later' : 'not_discussed',
                                      })
                                    }}
                                    className={cn(
                                      'max-w-[9.5rem] truncate rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                      data.onsite_linked_contact_id === c.id
                                        ? 'border-white/[0.35] bg-neutral-800/80 text-neutral-100'
                                        : 'border-white/[0.08] bg-neutral-900/50 text-neutral-300 hover:border-white/[0.14] hover:text-neutral-100',
                                    )}
                                  >
                                    {c.name}
                                  </button>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOnsiteAddNewChosen(true)
                                    patch({
                                      onsite_linked_contact_id: null,
                                      onsite_contact_name: '',
                                      onsite_contact_phone: '',
                                      onsite_title_context: INTAKE_4B_NEW_ONSITE_CONTACT_TITLE,
                                      onsite_contact_role:
                                        CONTACT_MISMATCH_CONTEXT_LABELS[INTAKE_4B_NEW_ONSITE_CONTACT_TITLE],
                                      onsite_name_flag: 'capture_later',
                                      onsite_phone_flag: 'capture_later',
                                    })
                                  }}
                                  className={cn(
                                    'rounded-md border border-dashed border-white/[0.18] bg-neutral-900/30 px-2.5 py-1.5 text-xs font-medium text-neutral-400 transition-colors hover:text-neutral-200',
                                  )}
                                >
                                  Add new
                                </button>
                              </div>
                            ) : null}
                            {live4bShowOnsiteMismatchForm ? (
                              <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[10rem] sm:max-w-xs">
                                <Label className="text-neutral-400 text-[10px] sm:text-xs">Name</Label>
                                <Input
                                  className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                  value={data.onsite_contact_name}
                                  onChange={e =>
                                    patch({
                                      onsite_contact_name: e.target.value,
                                      onsite_title_context: INTAKE_4B_NEW_ONSITE_CONTACT_TITLE,
                                      onsite_contact_role:
                                        CONTACT_MISMATCH_CONTEXT_LABELS[INTAKE_4B_NEW_ONSITE_CONTACT_TITLE],
                                    })
                                  }
                                  placeholder="Their name"
                                  autoComplete="name"
                                  aria-label="On-site contact name"
                                />
                              </div>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-neutral-400 text-xs">DJ parking</Label>
                      <ToggleN
                        value={data.dj_parking}
                        onChange={v => patch({ dj_parking: v as Phase4DjParkingV3 })}
                        options={DJ_PARKING_V3_KEYS.map(k => ({ value: k, label: DJ_PARKING_V3_LABELS[k] }))}
                      />
                    </div>
                    {primaryStateRegion === 'CA' ? (
                      <p className="text-[11px] text-neutral-500">
                        California venue — travel &amp; lodging is skipped on this path (see intake spec).
                      </p>
                    ) : null}
                  </div>
                ) : data.view_section === '4E' ? (
                  <>
                    {data.multi_show ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/[0.06]">
                        <span className="text-xs text-neutral-400">Same travel details for all shows</span>
                        <IntakeCompactDual
                          value={data.same_for_all_4e}
                          onChange={v => onSameForAllChange('same_for_all_4e', v, pick4e)}
                          a={{ id: 'per', label: 'Per show' }}
                          b={{ id: 'all', label: 'Same for all' }}
                        />
                      </div>
                    ) : null}
                    {(!data.multi_show || data.same_for_all_4e ? showsSorted.slice(0, 1) : showsSorted).map(
                      (row, idx) => {
                        const sd = parseShowDataV3(row.show_data, row.sort_order)
                        const showTravelExtras = sd.travel_required !== 'local' && sd.travel_required !== ''
                        return (
                          <div
                            key={row.id}
                            className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                          >
                            {data.multi_show && !data.same_for_all_4e ? (
                              <p className="text-xs text-neutral-500 flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ background: sd.color }}
                                />
                                {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              </p>
                            ) : null}
                            <div className="space-y-2">
                              <Label className="text-neutral-400 text-xs">Travel</Label>
                              <ToggleN
                                value={sd.travel_required}
                                onChange={v =>
                                  applyShowPatch(row.id, { travel_required: v as Phase4TravelRequiredV3 }, '4e')
                                }
                                options={[
                                  { value: 'local' as const, label: 'Local — no travel' },
                                  { value: 'regional' as const, label: 'Regional (driving)' },
                                  { value: 'flight' as const, label: 'Requires flight' },
                                ]}
                              />
                            </div>
                            {showTravelExtras ? (
                              <>
                                <div className="space-y-2">
                                  <Label className="text-neutral-400 text-xs">Lodging</Label>
                                  <ToggleN
                                    value={sd.lodging_status}
                                    onChange={v =>
                                      applyShowPatch(
                                        row.id,
                                        { lodging_status: v as Phase4LodgingStatusV3 },
                                        '4e',
                                      )
                                    }
                                    options={[
                                      { value: 'not_needed' as const, label: 'Not needed' },
                                      { value: 'venue_provides' as const, label: 'Venue provides' },
                                      { value: 'dj_covers' as const, label: 'DJ covers' },
                                      { value: 'not_discussed' as const, label: 'Not discussed' },
                                    ]}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-neutral-400 text-xs">Travel details</Label>
                                  <ToggleN
                                    value={sd.travel_notes_flag}
                                    onChange={v =>
                                      applyShowPatch(
                                        row.id,
                                        { travel_notes_flag: v as Phase4TravelNotesFlagV3 },
                                        '4e',
                                      )
                                    }
                                    options={[
                                      { value: 'capture_later' as const, label: 'Yes — capture later' },
                                      { value: 'no' as const, label: 'No' },
                                    ]}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-neutral-400 text-xs">Who books travel</Label>
                                  <ToggleN
                                    value={sd.travel_booked_by}
                                    onChange={v =>
                                      applyShowPatch(
                                        row.id,
                                        { travel_booked_by: v as BookingIntakeShowDataV3['travel_booked_by'] },
                                        '4e',
                                      )
                                    }
                                    options={[
                                      { value: '' as const, label: '—' },
                                      ...TRAVEL_BOOKED_BY_KEYS.filter(k => k !== '').map(k => ({
                                        value: k,
                                        label: TRAVEL_BOOKED_BY_LABELS[k],
                                      })),
                                    ]}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label className="text-neutral-400 text-xs">Ground transport</Label>
                                  <ToggleN
                                    value={sd.ground_transport}
                                    onChange={v =>
                                      applyShowPatch(
                                        row.id,
                                        { ground_transport: v as BookingIntakeShowDataV3['ground_transport'] },
                                        '4e',
                                      )
                                    }
                                    options={[
                                      { value: '' as const, label: '—' },
                                      ...GROUND_TRANSPORT_KEYS.filter(k => k !== '').map(k => ({
                                        value: k,
                                        label: GROUND_TRANSPORT_LABELS[k],
                                      })),
                                    ]}
                                  />
                                </div>
                              </>
                            ) : null}
                          </div>
                        )
                      },
                    )}
                  </>
                ) : data.view_section === '5A' ? (
                  <>
                    {!catalogHasMinimumForDealLogging(pricingCatalog) ? (
                      <p className="text-sm text-amber-200/90 rounded-lg border border-amber-900/50 bg-amber-950/30 px-3 py-2">
                        Add at least one package or hourly rate in Earnings → Pricing so quotes can run here.
                      </p>
                    ) : null}
                    <p className="text-[11px] text-neutral-500">
                      Pricing is per show — each date can use a different package or rate.
                    </p>
                    {showsSorted.map((row, idx) => {
                      const sd = parseShowDataV3(row.show_data, row.sort_order)
                      const svcOptions = servicesForEventDate(pricingCatalog, sd.event_date.trim())
                      const svcOptionsHourly = svcOptions.filter(
                        s =>
                          s.priceType === 'per_hour' &&
                          (!intakeServiceLooksDjOnlyUsb(s) || sd.equipment_provider === 'venue_provides'),
                      )
                      const svcHourlySelectList =
                        sd.service_id.trim() &&
                        !svcOptionsHourly.some(s => s.id === sd.service_id) &&
                        pricingCatalog.services.some(s => s.id === sd.service_id)
                          ? [
                              ...svcOptionsHourly,
                              pricingCatalog.services.find(s => s.id === sd.service_id)!,
                            ]
                          : svcOptionsHourly
                      const overtimeSvcOptions = pricingCatalog.services.filter(
                        s =>
                          s.priceType === 'per_hour' &&
                          (!intakeServiceLooksDjOnlyUsb(s) || sd.equipment_provider === 'venue_provides') &&
                          (svcOptions.some(d => d.id === s.id) || s.dayType === 'any'),
                      )
                      const isPkg = sd.pricing_mode === 'package'
                      const pkgRow5a = pricingCatalog.packages.find(p => p.id === sd.package_id.trim())
                      const billH5a =
                        sd.performance_hours > 0 ? sd.performance_hours : suggestedBillableHoursFromShow(sd)
                      const packageOvertimeAlert =
                        isPkg &&
                        pkgRow5a &&
                        billH5a > 0 &&
                        pkgRow5a.hoursIncluded > 0 &&
                        billH5a > pkgRow5a.hoursIncluded
                      const priceInp5a = buildPriceInputForShow(sd, pricingCatalog)
                      let runningTotal5a = 0
                      if (priceInp5a) {
                        try {
                          runningTotal5a = computeDealPrice(priceInp5a).gross
                        } catch {
                          runningTotal5a = 0
                        }
                      }
                      const toggleSurcharge5a = (id: string) => {
                        const has = sd.surcharge_ids.includes(id)
                        applyShowPatch(
                          row.id,
                          { surcharge_ids: has ? sd.surcharge_ids.filter(x => x !== id) : [...sd.surcharge_ids, id] },
                          '5a',
                        )
                      }
                      const toggleDiscount5a = (id: string) => {
                        const has = sd.discount_ids.includes(id)
                        applyShowPatch(
                          row.id,
                          { discount_ids: has ? sd.discount_ids.filter(x => x !== id) : [...sd.discount_ids, id] },
                          '5a',
                        )
                      }
                      const manualDiscounts5a = pricingCatalog.discounts.filter(d => {
                        if (discountIsRadioStation(d)) return false
                        if (
                          discountIsRepeatBooking(d) &&
                          (data.commission_tier === 'kept_doors' || sd.event_schedule_type !== 'recurring')
                        )
                          return false
                        return true
                      })
                      return (
                        <div
                          key={row.id}
                          className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                        >
                          {data.multi_show ? (
                            <p className="text-xs text-neutral-500 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: sd.color }}
                              />
                              {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                            </p>
                          ) : null}
                          {isPkg &&
                          sd.package_id.trim() &&
                          (sd.equipment_dj_package_interest === 'yes_walkthrough' ||
                            sd.equipment_hybrid_additions === 'yeah_see') ? (
                            <p className="text-[11px] text-neutral-500 rounded-md border border-white/[0.08] bg-neutral-950/40 px-2 py-1.5">
                              Package selected from equipment discussion.
                            </p>
                          ) : null}
                          <div className="space-y-2">
                            <Label className="text-neutral-400 text-xs">Pricing mode</Label>
                            <IntakeCompactDual
                              value={isPkg}
                              onChange={v =>
                                applyShowPatch(row.id, { pricing_mode: v ? 'package' : 'hourly' }, '5a')
                              }
                              a={{ id: 'hr', label: 'Hourly' }}
                              b={{ id: 'pkg', label: 'Package' }}
                            />
                            {!isPkg &&
                            (sd.event_type === 'wedding' ||
                              sd.event_type === 'private_event' ||
                              isLargeCapacityForPackageHint(sd)) ? (
                              <p className="text-[11px] text-neutral-500 leading-snug">
                                {sd.event_type === 'wedding'
                                  ? 'Weddings often use a full production package — switch to Package if that fits this quote.'
                                  : sd.event_type === 'private_event'
                                    ? 'Private events often start from Premium — switch to Package if you’re quoting bundled production.'
                                    : 'Large-scale events may need Platinum or Exclusive — consider Package if production is bundled.'}
                              </p>
                            ) : null}
                          </div>
                          {isPkg ? (
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Package</Label>
                              <Select
                                value={sd.package_id.trim() || '__none__'}
                                onValueChange={v =>
                                  applyShowPatch(
                                    row.id,
                                    { package_id: v === '__none__' ? '' : v },
                                    '5a',
                                  )
                                }
                              >
                                <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                  <SelectValue placeholder="Select package" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {pricingCatalog.packages.map(p => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name} · ${p.price}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <>
                              <div className="space-y-1.5">
                                <Label className="text-neutral-400 text-xs">
                                  Service rate
                                  {sd.event_date.trim() ? (
                                    <span className="text-neutral-600 font-normal">
                                      {' '}
                                      ({isWeekendDate(sd.event_date.trim()) ? 'weekend' : 'weekday'})
                                    </span>
                                  ) : null}
                                </Label>
                                <Select
                                  value={sd.service_id.trim() || '__none__'}
                                  onValueChange={v => {
                                    const id = v === '__none__' ? '' : v
                                    applyShowPatch(
                                      row.id,
                                      { service_id: id, overtime_service_id: id },
                                      '5a',
                                    )
                                  }}
                                >
                                  <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                    <SelectValue placeholder="Select rate" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {svcHourlySelectList.map(s => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name} · ${s.price}
                                        {s.priceType === 'per_hour' ? '/hr' : ''}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-neutral-400 text-xs">Billable hours</Label>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-11 w-11 border-neutral-700 p-0"
                                    onClick={() => {
                                      const cur =
                                        sd.performance_hours > 0
                                          ? sd.performance_hours
                                          : suggestedBillableHoursFromShow(sd)
                                      const next = Math.max(0.25, Math.round((cur - 0.25) * 4) / 4)
                                      applyShowPatch(row.id, { performance_hours: next }, '5a')
                                    }}
                                  >
                                    −
                                  </Button>
                                  <span className="text-sm font-medium tabular-nums min-w-[4rem] text-center">
                                    {sd.performance_hours > 0
                                      ? sd.performance_hours
                                      : suggestedBillableHoursFromShow(sd) || '—'}{' '}
                                    hrs
                                  </span>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-11 w-11 border-neutral-700 p-0"
                                    onClick={() => {
                                      const cur =
                                        sd.performance_hours > 0
                                          ? sd.performance_hours
                                          : suggestedBillableHoursFromShow(sd) || 1
                                      const next = Math.min(24, Math.round((cur + 0.25) * 4) / 4)
                                      applyShowPatch(row.id, { performance_hours: next }, '5a')
                                    }}
                                  >
                                    +
                                  </Button>
                                </div>
                                <p className="text-[11px] text-neutral-600">
                                  Pulled from set length when you land here — adjust if the billable block differs.
                                </p>
                              </div>
                            </>
                          )}
                          {isPkg && pricingCatalog.services.length > 0 ? (
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Overtime hourly (package overage)</Label>
                              <Select
                                value={sd.overtime_service_id.trim() || sd.service_id.trim() || '__none__'}
                                onValueChange={v =>
                                  applyShowPatch(
                                    row.id,
                                    { overtime_service_id: v === '__none__' ? '' : v },
                                    '5a',
                                  )
                                }
                              >
                                <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                                  <SelectValue placeholder="Rate for extra hours" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">—</SelectItem>
                                  {overtimeSvcOptions.map(s => (
                                    <SelectItem key={s.id} value={s.id}>
                                      {s.name} · ${s.price}/hr
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : null}
                          {packageOvertimeAlert && pkgRow5a ? (
                            <p className="text-[11px] text-amber-200/85 rounded-md border border-amber-900/45 bg-amber-950/25 px-2 py-1.5 leading-snug">
                              Set length ({billH5a} hrs) exceeds package hours ({pkgRow5a.hoursIncluded} hrs) —{' '}
                              {billH5a - pkgRow5a.hoursIncluded} hr overtime at the selected hourly rate.
                            </p>
                          ) : null}
                          {peakSeasonHintLabel(sd.event_date.trim()) ? (
                            <p className="text-[11px] text-amber-200/85 rounded-md border border-amber-900/45 bg-amber-950/25 px-2 py-1.5 leading-snug">
                              {peakSeasonHintLabel(sd.event_date.trim())} — review surcharges; not auto-applied.
                            </p>
                          ) : null}
                          {data.commission_tier === 'kept_doors' && repeatBookingDiscountId(pricingCatalog) ? (
                            <p className="text-[11px] text-sky-200/85 rounded-md border border-sky-900/45 bg-sky-950/25 px-2 py-1.5 leading-snug">
                              Kept doors — repeat booking discount is applied automatically (no need to toggle).
                            </p>
                          ) : null}
                          {sd.event_schedule_type === 'recurring' &&
                          data.commission_tier !== 'kept_doors' &&
                          repeatBookingDiscountId(pricingCatalog) ? (
                            <p className="text-[11px] text-sky-200/85 rounded-md border border-sky-900/45 bg-sky-950/25 px-2 py-1.5 leading-snug">
                              Recurring event — repeat booking discount may apply.
                            </p>
                          ) : null}
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Surcharges (tap all that apply)</Label>
                            {pricingCatalog.surcharges.length === 0 ? (
                              <p className="text-sm text-neutral-500">None in catalog.</p>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {pricingCatalog.surcharges.map(s => {
                                  const on = sd.surcharge_ids.includes(s.id)
                                  const pct = Math.round((s.multiplier - 1) * 100)
                                  const surHint = surchargeAutopopBadge(sd, s, sd.event_date)
                                  return (
                                    <button
                                      key={s.id}
                                      type="button"
                                      onClick={() => toggleSurcharge5a(s.id)}
                                      className={cn(
                                        'min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors text-left',
                                        on
                                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                                        !on && surHint ? 'ring-1 ring-amber-500/25' : '',
                                      )}
                                    >
                                      <span className="block leading-tight">
                                        {s.name}
                                        {pct > 0 ? ` · +${pct}%` : ''}
                                      </span>
                                      {surHint ? (
                                        <span className="block text-[10px] font-normal text-amber-200/80 mt-0.5">
                                          {surHint}
                                        </span>
                                      ) : null}
                                    </button>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                          {manualDiscounts5a.length > 0 ? (
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Discounts (tap all that apply)</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {manualDiscounts5a.map(d => {
                                  const on = sd.discount_ids.includes(d.id)
                                  return (
                                    <button
                                      key={d.id}
                                      type="button"
                                      onClick={() => toggleDiscount5a(d.id)}
                                      className={cn(
                                        'min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors',
                                        on
                                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                                      )}
                                    >
                                      {d.name} · −{d.percent}%
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ) : null}
                          {priceInp5a ? (
                            <p className="text-xs text-neutral-600 tabular-nums">Running total ~${runningTotal5a}</p>
                          ) : null}
                        </div>
                      )
                    })}
                  </>
                ) : data.view_section === '5B' ? (
                  <>
                    {showsSorted.some(r => {
                      const sdx = parseShowDataV3(r.show_data, r.sort_order)
                      return sdx.equipment_revisit_production_5b
                    }) ? (
                      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-amber-100/90 leading-snug">
                          They were interested in production upgrades — revisit?
                        </p>
                        <button
                          type="button"
                          className="text-xs font-medium text-amber-200/95 hover:text-amber-50 shrink-0"
                          onClick={() => {
                            for (const r of showsSorted) {
                              const sdx = parseShowDataV3(r.show_data, r.sort_order)
                              if (sdx.equipment_revisit_production_5b) {
                                applyShowPatch(r.id, { equipment_revisit_production_5b: false }, '5b')
                              }
                            }
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    ) : null}
                    {showsSorted.map((row, idx) => {
                      const sd = parseShowDataV3(row.show_data, row.sort_order)
                      const inp = buildPriceInputForShow(sd, pricingCatalog)
                      let runningTotal = 0
                      if (inp) {
                        try {
                          runningTotal = computeDealPrice(inp).gross
                        } catch {
                          runningTotal = 0
                        }
                      }
                      return (
                        <div
                          key={row.id}
                          className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                        >
                          {data.multi_show ? (
                            <p className="text-xs text-neutral-500 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: sd.color }}
                              />
                              {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                              <span className="text-neutral-600 tabular-nums">· ~${runningTotal}</span>
                            </p>
                          ) : (
                            <p className="text-xs text-neutral-600 tabular-nums">Running total ~${runningTotal}</p>
                          )}
                          <div className="space-y-2">
                            <Label className="text-neutral-400 text-xs">Add-ons</Label>
                            {pricingCatalog.addons.length === 0 ? (
                              <p className="text-sm text-neutral-500">No add-ons in catalog.</p>
                            ) : (
                              <div className="grid grid-cols-2 gap-2">
                                {pricingCatalog.addons
                                  .filter(a => !shouldHideAddonTile(a, sd))
                                  .map(a => {
                                    const q = sd.addon_quantities[a.id] ?? 0
                                    const on = q > 0
                                    const chill = MUSIC_VIBE_PRESETS.find(p => p.id === 'chill_lounge')
                                    const rnb = MUSIC_VIBE_PRESETS.find(p => p.id === 'rnb_x_latin')
                                    const dimVibe =
                                      isVisualEffectsAddon(a) &&
                                      ((chill && genreSetsEqual(sd.genres, chill.genres)) ||
                                        (rnb && genreSetsEqual(sd.genres, rnb.genres)))
                                    const highlightWedCorp =
                                      (sd.event_type === 'wedding' ||
                                        sd.event_type === 'corporate' ||
                                        sd.event_type === 'brand_activation') &&
                                      (isCustomSetlistAddon(a) || isMcAddon(a))
                                    const wantsQty =
                                      isVisualEffectsAddon(a) ||
                                      isGuestArtistAddon(a) ||
                                      a.priceType === 'per_effect' ||
                                      a.priceType === 'per_artist'
                                    const sub = (a.category ?? '').trim() || 'Upgrade'
                                    const priceLabel =
                                      a.priceType === 'per_sq_ft' ? `$${a.price}/${a.unitLabel ?? 'sq ft'}` : `$${a.price}`
                                    return (
                                      <div key={a.id} className="space-y-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (on) {
                                              const next = { ...sd.addon_quantities }
                                              delete next[a.id]
                                              const nextAutopop = sd.addon_autopop_ids.filter(id => id !== a.id)
                                              applyShowPatch(
                                                row.id,
                                                {
                                                  addon_quantities: next,
                                                  addon_autopop_ids: nextAutopop,
                                                  addon_autopop_dismissed_ids: [
                                                    ...new Set([...sd.addon_autopop_dismissed_ids, a.id]),
                                                  ],
                                                },
                                                '5b',
                                              )
                                            } else {
                                              const nextDismiss = sd.addon_autopop_dismissed_ids.filter(
                                                id => id !== a.id,
                                              )
                                              applyShowPatch(
                                                row.id,
                                                {
                                                  addon_quantities: {
                                                    ...sd.addon_quantities,
                                                    [a.id]: a.priceType === 'per_sq_ft' ? 100 : 1,
                                                  },
                                                  addon_autopop_dismissed_ids: nextDismiss,
                                                },
                                                '5b',
                                              )
                                            }
                                          }}
                                          className={cn(
                                            'w-full rounded-lg border px-2.5 py-2 text-left transition-colors min-h-[4.25rem]',
                                            on
                                              ? 'border-white/30 bg-neutral-800/80 ring-1 ring-white/10'
                                              : 'border-white/[0.08] bg-neutral-900/45 hover:border-white/15',
                                            dimVibe && !on ? 'opacity-45' : '',
                                            highlightWedCorp && !on ? 'ring-1 ring-amber-500/35' : '',
                                          )}
                                        >
                                          <div className="flex items-start justify-between gap-1">
                                            <p className="text-[11px] text-neutral-500 leading-tight">{sub}</p>
                                            {on && sd.addon_autopop_ids.includes(a.id) ? (
                                              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wide text-sky-300/90 border border-sky-500/35 rounded px-1 py-px leading-none">
                                                Auto
                                              </span>
                                            ) : null}
                                          </div>
                                          <p className="text-xs font-medium text-neutral-100 leading-snug line-clamp-2">
                                            {a.name}
                                          </p>
                                          <p className="text-[11px] text-neutral-400 tabular-nums mt-0.5">
                                            {priceLabel}
                                            {on && q > 1 ? ` · ×${q}` : ''}
                                          </p>
                                        </button>
                                        {on && wantsQty ? (
                                          <div className="flex items-center justify-center gap-1">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-8 w-8 border-neutral-700 p-0"
                                              onClick={() => {
                                                const nextQ = Math.max(1, q - 1)
                                                const next = { ...sd.addon_quantities, [a.id]: nextQ }
                                                applyShowPatch(row.id, { addon_quantities: next }, '5b')
                                              }}
                                            >
                                              −
                                            </Button>
                                            <span className="text-xs tabular-nums w-6 text-center">{q}</span>
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="sm"
                                              className="h-8 w-8 border-neutral-700 p-0"
                                              onClick={() => {
                                                const nextQ = Math.min(20, q + 1)
                                                applyShowPatch(
                                                  row.id,
                                                  { addon_quantities: { ...sd.addon_quantities, [a.id]: nextQ } },
                                                  '5b',
                                                )
                                              }}
                                            >
                                              +
                                            </Button>
                                          </div>
                                        ) : null}
                                        {on && a.priceType === 'per_sq_ft' ? (
                                          <div className="flex flex-wrap gap-1 justify-center">
                                            {[
                                              { sq: 100, label: 'S' },
                                              { sq: 200, label: 'M' },
                                              { sq: 400, label: 'L' },
                                            ].map(({ sq, label }) => (
                                              <button
                                                key={sq}
                                                type="button"
                                                className={cn(
                                                  'text-[10px] px-1.5 py-0.5 rounded border',
                                                  q === sq
                                                    ? 'border-white/35 bg-neutral-800 text-neutral-100'
                                                    : 'border-white/10 text-neutral-500 hover:text-neutral-200',
                                                )}
                                                onClick={() =>
                                                  applyShowPatch(
                                                    row.id,
                                                    { addon_quantities: { ...sd.addon_quantities, [a.id]: sq } },
                                                    '5b',
                                                  )
                                                }
                                              >
                                                {label} · {sq} {a.unitLabel ?? 'sq ft'}
                                              </button>
                                            ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                ) : data.view_section === '5C' ? (
                  <>
                    {showsSorted.map((row, idx) => {
                      const sd = parseShowDataV3(row.show_data, row.sort_order)
                      const inp = buildPriceInputForShow(sd, pricingCatalog)
                      let sub = 0
                      let tax = 0
                      let total = 0
                      if (inp && sd.pricing_source !== 'manual') {
                        try {
                          const b = computeDealPriceBreakdown(inp)
                          sub = b.afterDiscounts
                          tax = b.taxAmount
                          total = b.total
                        } catch {
                          sub = tax = total = 0
                        }
                      }
                      if (sd.pricing_source === 'manual' && sd.manual_gross != null) {
                        total = roundUsd(sd.manual_gross)
                        sub = total
                        tax = 0
                      }
                      const dateLbl = showLabelFromEventDate(sd.event_date)
                      const activeAddons = Object.entries(sd.addon_quantities).filter(([, qq]) => qq > 0)
                      const addonLineNames = activeAddons
                        .map(([id, qq]) => {
                          const ad = pricingCatalog.addons.find(x => x.id === id)
                          return ad ? `${ad.name}${qq > 1 ? ` ×${qq}` : ''}` : null
                        })
                        .filter(Boolean) as string[]
                      let addonPremium = 0
                      if (inp && sd.pricing_source !== 'manual') {
                        try {
                          const br = computeDealPriceBreakdown(inp)
                          addonPremium = Math.max(0, br.afterAddons - br.afterBase)
                        } catch {
                          addonPremium = 0
                        }
                      }
                      const totalDeal = totalUsdForShow(sd)
                      const depAmt = totalDeal > 0 ? roundUsd(totalDeal * (sd.deposit_percent / 100)) : 0
                      const balAmt = Math.max(0, totalDeal - depAmt)
                      const hideBalance = sd.deposit_percent === 100
                      const togglePay = (k: PaymentMethodKeyV3) => {
                        const has = sd.payment_methods.includes(k)
                        applyShowPatch(
                          row.id,
                          {
                            payment_methods: has
                              ? sd.payment_methods.filter(x => x !== k)
                              : [...sd.payment_methods, k],
                          },
                          '5d',
                        )
                      }
                      return (
                        <div
                          key={row.id}
                          className={cn('space-y-4', idx > 0 && 'pt-4 border-t border-white/[0.06]')}
                        >
                          {data.multi_show ? (
                            <p className="text-xs text-neutral-500 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: sd.color }}
                              />
                              {dateLbl || `Show ${idx + 1}`}
                            </p>
                          ) : null}
                          <div className="space-y-2">
                            <Label className="text-neutral-400 text-xs">Quote source</Label>
                            <IntakeCompactDual
                              value={sd.pricing_source === 'manual'}
                              onChange={v =>
                                applyShowPatch(row.id, { pricing_source: v ? 'manual' : 'calculated' }, '5c')
                              }
                              a={{ id: 'calc', label: 'Use calculated' }}
                              b={{ id: 'man', label: 'Manual override' }}
                            />
                          </div>
                          <div className="rounded-lg border border-white/[0.08] bg-neutral-950/50 p-4 space-y-2">
                            {sd.pricing_source !== 'manual' ? (
                              <>
                                <div className="flex justify-between text-sm">
                                  <span className="text-neutral-500">Subtotal (pre-tax)</span>
                                  <span className="tabular-nums text-neutral-200">${sub}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-neutral-500">Tax</span>
                                  <span className="tabular-nums text-neutral-200">${tax}</span>
                                </div>
                              </>
                            ) : null}
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/[0.06]">
                              <span className="text-lg font-semibold text-neutral-300">Total</span>
                              {sd.pricing_source === 'manual' ? (
                                <Input
                                  inputMode="decimal"
                                  className="h-10 w-[7.5rem] border-neutral-800 bg-neutral-950/80 tabular-nums text-lg font-semibold"
                                  value={sd.manual_gross != null ? String(sd.manual_gross) : ''}
                                  onChange={e => {
                                    const raw = e.target.value.trim()
                                    if (!raw) {
                                      applyShowPatch(row.id, { manual_gross: null }, '5c')
                                      return
                                    }
                                    const n = Number(raw)
                                    if (!Number.isFinite(n) || n < 0) return
                                    applyShowPatch(row.id, { manual_gross: Math.round(n) }, '5c')
                                  }}
                                  placeholder="0"
                                />
                              ) : (
                                <span className="tabular-nums text-lg font-semibold">${total}</span>
                              )}
                            </div>
                          </div>
                          {sd.pricing_source === 'manual' ? (
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Why manual</Label>
                              <div className="flex flex-wrap gap-1.5">
                                {MANUAL_PRICING_REASON_KEYS.filter(k => k !== '').map(k => {
                                  const on = sd.manual_pricing_reason === k
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() =>
                                        applyShowPatch(
                                          row.id,
                                          {
                                            manual_pricing_reason: (on ? '' : k) as BookingIntakeShowDataV3['manual_pricing_reason'],
                                          },
                                          '5c',
                                        )
                                      }
                                      className={cn(
                                        'min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors',
                                        on
                                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                                      )}
                                    >
                                      {MANUAL_PRICING_CHIP_LABELS[k]}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ) : null}
                          {activeAddons.length > 0 ? (
                            <details className="rounded-lg border border-white/[0.06] bg-neutral-950/35 px-3 py-2 text-xs text-neutral-400">
                              <summary className="cursor-pointer text-neutral-300 select-none">
                                Includes {activeAddons.length} add-on{activeAddons.length === 1 ? '' : 's'} (+
                                ${addonPremium})
                              </summary>
                              <ul className="mt-2 space-y-1 list-disc pl-4 text-neutral-500">
                                {addonLineNames.map((n, i) => (
                                  <li key={i}>{n}</li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                          {sd.event_schedule_type === 'recurring' ? (
                            <p className="text-[11px] text-neutral-500">
                              Recurring event — consider a multi-date rate.
                            </p>
                          ) : null}
                          <div className="rounded-lg border border-white/[0.08] bg-neutral-950/40 p-3 space-y-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <Label className="text-neutral-400 text-xs shrink-0">Deposit</Label>
                                <Select
                                  value={String(sd.deposit_percent)}
                                  onValueChange={v =>
                                    applyShowPatch(
                                      row.id,
                                      { deposit_percent: Number(v) as Phase5DepositPercentV3 },
                                      '5d',
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-9 w-[5.75rem] border-neutral-800 bg-neutral-950/80 text-sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {depositOptions.map(o => (
                                      <SelectItem key={o.value} value={String(o.value)}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex flex-wrap items-baseline gap-x-4 text-sm tabular-nums text-neutral-200">
                                <span>
                                  <span className="text-neutral-500">Deposit: </span>${depAmt}
                                </span>
                                {!hideBalance ? (
                                  <span>
                                    <span className="text-neutral-500">Balance: </span>${balAmt}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            {!hideBalance ? (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-neutral-400 text-xs">Balance due</Label>
                                  <Select
                                    value={sd.balance_timing || 'before_event'}
                                    onValueChange={v =>
                                      applyShowPatch(row.id, { balance_timing: v as Phase5BalanceTimingV3 }, '5d')
                                    }
                                  >
                                    <SelectTrigger className="h-10 border-neutral-800 bg-neutral-950/80">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {balanceTimingOptions.map(o => (
                                        <SelectItem key={o.value} value={o.value}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                {sd.balance_timing === 'custom' ? (
                                  <div className="space-y-1">
                                    <Label className="text-neutral-400 text-xs">Balance due date</Label>
                                    <Input
                                      type="date"
                                      className="h-10 border-neutral-800 bg-neutral-950/80"
                                      value={sd.balance_due_date}
                                      onChange={e =>
                                        applyShowPatch(row.id, { balance_due_date: e.target.value }, '5d')
                                      }
                                    />
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                            <div className="space-y-1.5">
                              <Label className="text-neutral-400 text-xs">Payment (tap all discussed)</Label>
                              <div className="flex flex-wrap gap-1">
                                {LIVE_PAYMENT_METHOD_KEYS.map(k => {
                                  const on = sd.payment_methods.includes(k)
                                  return (
                                    <button
                                      key={k}
                                      type="button"
                                      onClick={() => togglePay(k)}
                                      className={cn(
                                        'min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors',
                                        on
                                          ? 'border-neutral-200 bg-neutral-100'
                                          : 'border-white/[0.08] bg-neutral-900/50',
                                        paymentMethodChipTextClass(k, on),
                                      )}
                                    >
                                      {PAYMENT_METHOD_LABELS[k]}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    <div className="space-y-2 border-t border-white/[0.06] pt-4">
                      <Label className="text-neutral-400 text-xs">Invoice to</Label>
                      <div className="flex min-w-0 flex-col gap-2">
                        <div className="flex min-w-0 flex-wrap items-end gap-2">
                          <div className="shrink-0">
                            <ToggleN
                              value={data.invoice_same_contact}
                              onChange={v =>
                                patch(
                                  v === 'yes'
                                    ? {
                                        invoice_same_contact: 'yes',
                                        invoice_company_confirmed: '',
                                        invoice_email_confirmed: '',
                                        billing_contact_flag: '',
                                        billing_linked_contact_id: null,
                                      }
                                    : {
                                        invoice_same_contact: 'different',
                                        invoice_company_confirmed: 'capture_later',
                                        invoice_email_confirmed: 'capture_later',
                                        billing_linked_contact_id: null,
                                        billing_contact_flag:
                                          contactsForBillingPicker.length === 0 ? 'capture_later' : '',
                                        billing_contact_name: '',
                                        billing_contact_email: '',
                                      },
                                )
                              }
                              options={[
                                {
                                  value: 'yes' as const,
                                  label:
                                    data.contact_name.trim() && data.contact_company.trim()
                                      ? `${data.contact_name.trim()} at ${data.contact_company.trim()}`
                                      : data.contact_name.trim()
                                        ? `${data.contact_name.trim()} · main`
                                        : 'Main contact',
                                },
                                { value: 'different' as const, label: 'Different person' },
                              ]}
                            />
                          </div>
                        {data.invoice_same_contact === 'different' &&
                        contactsForBillingPicker.length > BILLING_CONTACT_CHIP_MAX_NAMES ? (
                          <div className="min-w-0 w-full sm:w-auto sm:min-w-[12rem] sm:max-w-sm space-y-0.5">
                            <Label className="text-neutral-400 text-[10px] sm:text-xs sr-only sm:not-sr-only">
                              Billing contact
                            </Label>
                            <Select
                              value={
                                data.billing_linked_contact_id ??
                                (data.billing_contact_flag === 'capture_later'
                                  ? BILLING_CONTACT_PICK_MANUAL
                                  : BILLING_CONTACT_PICK_UNSET)
                              }
                              onValueChange={val => {
                                if (val === BILLING_CONTACT_PICK_UNSET) {
                                  patch({
                                    billing_linked_contact_id: null,
                                    billing_contact_flag: '',
                                    billing_contact_name: '',
                                    billing_contact_email: '',
                                  })
                                } else if (val === BILLING_CONTACT_PICK_MANUAL) {
                                  patch({
                                    billing_linked_contact_id: null,
                                    billing_contact_flag: 'capture_later',
                                    billing_contact_name: '',
                                    billing_contact_email: '',
                                  })
                                } else {
                                  patch({
                                    billing_linked_contact_id: val,
                                    billing_contact_flag: '',
                                    billing_contact_name: '',
                                    billing_contact_email: '',
                                  })
                                }
                              }}
                            >
                              <SelectTrigger className="h-9 border-neutral-800 bg-neutral-950/80 text-sm">
                                <SelectValue placeholder="Select billing contact" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={BILLING_CONTACT_PICK_UNSET}>Select billing contact…</SelectItem>
                                {contactsForBillingPicker.map(c => (
                                  <SelectItem key={c.id} value={c.id}>
                                    {contactRoleForDisplay(c)
                                      ? `${c.name} · ${contactRoleForDisplay(c)}`
                                      : c.name}
                                  </SelectItem>
                                ))}
                                <SelectSeparator />
                                <SelectItem value={BILLING_CONTACT_PICK_MANUAL}>Type name</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        ) : null}
                        {data.invoice_same_contact === 'different' &&
                        contactsForBillingPicker.length > 0 &&
                        contactsForBillingPicker.length <= BILLING_CONTACT_CHIP_MAX_NAMES ? (
                          <div className="flex min-w-0 flex-1 flex-wrap items-end gap-1.5">
                            {contactsForBillingPicker.map(c => (
                              <button
                                key={c.id}
                                type="button"
                                title={
                                  contactRoleForDisplay(c)
                                    ? `${c.name} · ${contactRoleForDisplay(c)}`
                                    : c.name
                                }
                                onClick={() =>
                                  patch({
                                    billing_linked_contact_id: c.id,
                                    billing_contact_flag: '',
                                    billing_contact_name: '',
                                    billing_contact_email: '',
                                  })
                                }
                                className={cn(
                                  'max-w-[9.5rem] truncate rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
                                  data.billing_linked_contact_id === c.id
                                    ? 'border-white/[0.35] bg-neutral-800/80 text-neutral-100'
                                    : 'border-white/[0.08] bg-neutral-900/50 text-neutral-300 hover:border-white/[0.14] hover:text-neutral-100',
                                )}
                              >
                                {c.name}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() =>
                                patch({
                                  billing_linked_contact_id: null,
                                  billing_contact_flag: 'capture_later',
                                  billing_contact_name: '',
                                  billing_contact_email: '',
                                })
                              }
                              className={cn(
                                'rounded-md border border-dashed px-2.5 py-1.5 text-xs font-medium transition-colors',
                                !data.billing_linked_contact_id &&
                                  data.billing_contact_flag === 'capture_later'
                                  ? 'border-white/[0.35] bg-neutral-800/80 text-neutral-100'
                                  : 'border-white/[0.18] bg-neutral-900/30 text-neutral-400 hover:text-neutral-200',
                              )}
                            >
                              Type name
                            </button>
                          </div>
                        ) : null}
                        </div>
                        {data.invoice_same_contact === 'different' &&
                        data.billing_contact_flag === 'capture_later' ? (
                          <div className="flex min-w-0 w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                            <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[10rem]">
                              <Label className="text-neutral-400 text-[10px] sm:text-xs">Billing name</Label>
                              <Input
                                className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                value={data.billing_contact_name}
                                onChange={e => patch({ billing_contact_name: e.target.value })}
                                placeholder="Name on invoice"
                              />
                            </div>
                            <div className="min-w-0 flex-1 space-y-0.5 sm:min-w-[12rem]">
                              <Label className="text-neutral-400 text-[10px] sm:text-xs">Billing email</Label>
                              <Input
                                className="h-9 border-neutral-800 bg-neutral-950/80 text-sm"
                                value={data.billing_contact_email}
                                onChange={e => patch({ billing_contact_email: e.target.value })}
                                placeholder="Email for invoice"
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : data.view_section === '7A' ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-neutral-400 text-xs">Sending</Label>
                        <ToggleN
                          value={data.send_agreement}
                          onChange={v => patch({ send_agreement: v as Phase7SendAgreementV3 })}
                          options={[
                            { value: 'yes_sending' as const, label: 'Agreement + invoice' },
                            { value: 'invoice_only' as const, label: 'Invoice only' },
                            { value: 'verbal_only' as const, label: 'Nothing yet — verbal hold' },
                          ]}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-neutral-400 text-xs">Deposit</Label>
                        <ToggleN
                          value={data.deposit_on_call}
                          onChange={v => patch({ deposit_on_call: v as Phase7DepositOnCallV3 })}
                          options={[
                            { value: 'paying_now' as const, label: 'Paying now' },
                            { value: 'sending_invoice' as const, label: 'Sending invoice' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-neutral-400 text-xs">Anything still open?</Label>
                      <ToggleN
                        value={data.has_follow_ups}
                        onChange={v => {
                          if (v === 'all_clear') {
                            patch({ has_follow_ups: v as Phase7HasFollowUpsV3, follow_up_date: '', follow_up_topics: [] })
                          } else {
                            patch({ has_follow_ups: v as Phase7HasFollowUpsV3 })
                          }
                        }}
                        options={[
                          { value: 'all_clear' as const, label: 'All clear' },
                          { value: 'yes' as const, label: 'Yes — items pending' },
                        ]}
                      />
                    </div>
                    {data.has_follow_ups === 'yes' ? (
                      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:items-end">
                        <div className="space-y-1.5 min-w-[10rem] flex-1">
                          <Label className="text-neutral-400 text-xs">Follow up by</Label>
                          <Input
                            type="date"
                            className="h-11 border-neutral-800 bg-neutral-950/80"
                            value={data.follow_up_date}
                            onChange={e => patch({ follow_up_date: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <Label className="text-neutral-400 text-xs">Topics</Label>
                          <div className="flex flex-wrap gap-1">
                            {FOLLOW_UP_TOPIC_KEYS.map(k => {
                              const on = data.follow_up_topics.includes(k)
                              return (
                                <button
                                  key={k}
                                  type="button"
                                  onClick={() => toggleFollowTopic(k)}
                                  className={cn(
                                    'min-h-9 px-2.5 text-xs font-medium rounded-lg border transition-colors',
                                    on
                                      ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                                      : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                                  )}
                                >
                                  {FOLLOW_UP_TOPIC_LABELS[k]}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
                      <div className="space-y-2 min-w-[12rem] flex-1">
                        <Label className="text-neutral-400 text-xs">Energy at close</Label>
                        <ToggleN
                          value={data.client_energy}
                          onChange={v => patch({ client_energy: v as Phase7ClientEnergyV3 })}
                          options={[
                            { value: 'very_excited' as const, label: 'Very excited' },
                            { value: 'positive' as const, label: 'Positive' },
                            { value: 'neutral' as const, label: 'Neutral' },
                            { value: 'uncertain' as const, label: 'Uncertain' },
                          ]}
                        />
                      </div>
                      <div className="space-y-2 min-w-[12rem] flex-1">
                        <Label className="text-neutral-400 text-xs">Call status</Label>
                        <ToggleN
                          value={data.call_status}
                          onChange={v => patch({ call_status: v as Phase7CallStatusV3 })}
                          options={[
                            { value: '' as const, label: '—' },
                            { value: 'full' as const, label: 'Full call' },
                            { value: 'partial' as const, label: 'Partial — need follow-up' },
                            { value: 'voicemail' as const, label: 'Voicemail' },
                          ]}
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="lg"
                        disabled={endCallBusy}
                        className="min-h-[52px] w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white border-0 gap-2"
                        onClick={() => void handleEndCall()}
                      >
                        {endCallBusy ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Saving…
                          </>
                        ) : (
                          <>
                            <span className="text-base leading-none" aria-hidden>
                              ●
                            </span>
                            End call
                          </>
                        )}
                      </Button>
                      <p className="text-[11px] text-neutral-600 mt-2">
                        Saves everything and opens post-call wrap-up (flagged fields, notes, import).
                      </p>
                    </div>
                  </>
                ) : null}
                    </>
                  }
                />
                {advanceNudge ? (
                  <p className="text-xs text-amber-200/90 rounded-md border border-amber-900/40 bg-amber-950/25 px-2 py-1.5">
                    {advanceNudge}
                  </p>
                ) : null}

                <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/[0.06]">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="min-h-[48px] border-neutral-700"
                    disabled={
                      !data.view_section.startsWith('__stub_') &&
                      pathSections.indexOf(data.view_section) <= 0
                    }
                    onClick={() => handleLiveBack()}
                  >
                    ← Back
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-[48px] min-w-[7rem]"
                    disabled={
                      data.view_section.startsWith('__stub_') ||
                      data.view_section === '7A' ||
                      (data.view_section === lastPathSection &&
                        data.last_active_section === lastPathSection)
                    }
                    onClick={() => void handleLiveNext()}
                  >
                    Next →
                  </Button>
                  {data.view_section === lastPathSection &&
                  data.last_active_section === lastPathSection ? (
                    <span className="text-xs text-neutral-500">
                      On The Close, use End call — Next is disabled there.
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <footer className="h-10 border-t border-neutral-800 flex items-center justify-between px-4 text-xs text-neutral-500 shrink-0 bg-neutral-950/90">
              <span>
                Live · {LIVE_PHASES[viewPhaseIndex]?.label ?? '—'} · {liveSectionTitle(data.view_section)}
              </span>
              <span className="font-mono text-neutral-600">
                {data.view_section} · bookmark {data.last_active_section}
              </span>
            </footer>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col md:flex-row min-h-0">
          <aside className="w-full md:w-[248px] shrink-0 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col py-2 md:py-3 px-2 bg-neutral-950">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 mb-1.5 md:mb-2 shrink-0">
              Post-call
            </p>
            <nav className="flex md:flex-col flex-row gap-0.5 md:space-y-0.5 overflow-x-auto md:overflow-y-auto md:overflow-x-visible pb-1 md:pb-0 flex-1 md:min-h-0">
              {POST_CALL_SECTION_ORDER.map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => patch({ view_section: id })}
                  className={cn(
                    'shrink-0 md:w-full text-left rounded-lg px-3 py-2 text-sm flex items-center gap-2 transition-colors',
                    postCallSection === id
                      ? 'bg-neutral-100 text-neutral-950 font-semibold'
                      : 'text-neutral-400 hover:bg-neutral-900/80 hover:text-neutral-200',
                  )}
                >
                  <span className="text-neutral-500 font-mono text-xs w-4 shrink-0">{id}</span>
                  <span className="flex-1 min-w-0">{liveSectionTitle(id)}</span>
                </button>
              ))}
            </nav>
          </aside>
          <div className="flex-1 flex flex-col min-w-0 min-h-0">
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 pb-24 sm:p-6 items-start">
              <div
                key={postCallSection}
                className="w-full max-w-2xl shrink-0 rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 sm:p-5 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                <div>
                  <p className="text-xs text-neutral-500 uppercase tracking-wide">Phase 8</p>
                  <h2 className="text-lg font-semibold text-neutral-100 mt-1">
                    {liveSectionTitle(postCallSection)}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">
                    Call ended{' '}
                    {data.call_ended_at
                      ? new Date(data.call_ended_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </p>
                </div>

                {postCallSection === '8A' ? (
                <div className="space-y-4">
                  {data.suggested_outreach_status ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/40 px-3 py-2 text-sm text-neutral-300">
                      <span className="text-neutral-500">Suggested venue status on import: </span>
                      <span className="text-neutral-100 font-medium">
                        {OUTREACH_STATUS_LABELS[data.suggested_outreach_status]}
                      </span>
                    </div>
                  ) : null}
                  {data.follow_up_date.trim() ? (
                    <p className="text-xs text-neutral-500">
                      Follow-up date: {data.follow_up_date.trim()} (maps to venue follow-up on import).
                    </p>
                  ) : null}

                  <div className="rounded-lg border border-white/[0.08] bg-neutral-950/20 overflow-hidden">
                    <div className="px-3 py-2 border-b border-white/[0.06] shrink-0">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Flagged fields</p>
                      <p className="text-[11px] text-neutral-500 mt-0.5">
                        Finish anything the call left open before you import.
                      </p>
                    </div>
                    <div className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain p-3 space-y-3">
                  {data.venue_access_notes_flag === 'yes' &&
                  data.venue_access_note_tags.includes('other') ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — When</p>
                      <p className="text-sm text-neutral-200">Venue access — other</p>
                      <Textarea
                        className="min-h-[88px] border-neutral-800 bg-neutral-950/80 text-sm"
                        value={data.venue_access_other_notes}
                        onChange={e => patch({ venue_access_other_notes: e.target.value })}
                        placeholder="Gated code, special instructions — anything the chips don’t cover."
                      />
                    </div>
                  ) : null}

                  {data.confirmed_contact === 'no_different_person' ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 1 — Opening</p>
                      <p className="text-sm text-neutral-200">Primary contact name</p>
                      <Input
                        className="h-10 border-neutral-800 bg-neutral-950/80"
                        value={data.contact_name}
                        onChange={e => patch({ contact_name: e.target.value })}
                        placeholder="Name on the account"
                      />
                      {data.contact_mismatch_linked_contact_id &&
                      data.contact_mismatch_note.trim() &&
                      data.contact_mismatch_context.trim() ? (
                        <div className="pt-1 space-y-1">
                          <Label className="text-neutral-400 text-xs">On the call</Label>
                          <p className="text-sm text-neutral-200 rounded-md border border-white/[0.06] bg-neutral-950/50 px-3 py-2">
                            {data.contact_mismatch_note.trim()}
                            <span className="text-neutral-500">
                              {' '}
                              —{' '}
                              {CONTACT_MISMATCH_CONTEXT_LABELS[
                                data.contact_mismatch_context as Exclude<Phase1ContactMismatchContextV3, ''>
                              ] ?? data.contact_mismatch_context.trim()}
                            </span>
                          </p>
                          <p className="text-[11px] text-neutral-600">
                            Linked to venue contacts; edit in Outreach if their role changes.
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2 sm:items-end">
                          <div className="space-y-1.5 min-w-0">
                            <Label className="text-neutral-400 text-xs">On-call name</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80 text-sm"
                              value={data.contact_mismatch_note}
                              onChange={e => patch({ contact_mismatch_note: e.target.value })}
                              placeholder="Name they gave on the call"
                            />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <Label className="text-neutral-400 text-xs">Title</Label>
                            <Select
                              value={
                                data.contact_mismatch_context.trim()
                                  ? data.contact_mismatch_context
                                  : '__none__'
                              }
                              onValueChange={v =>
                                patch({
                                  contact_mismatch_context:
                                    v === '__none__' ? '' : (v as Phase1ContactMismatchContextV3),
                                })
                              }
                            >
                              <SelectTrigger className="h-10 border-neutral-800 bg-neutral-950/80 text-sm">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">—</SelectItem>
                                {CONTACT_MISMATCH_ROLE_ORDER.map(key => (
                                  <SelectItem key={key} value={key}>
                                    {CONTACT_MISMATCH_CONTEXT_LABELS[key]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {data.phone_confirmed === 'update_needed' || data.contact_phone_added.trim() ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 1 — Opening</p>
                      <p className="text-sm text-neutral-200">Phone</p>
                      {(data.contact_phone_on_file.trim() || data.contact_phone.trim()) ? (
                        <p className="text-xs text-neutral-500">
                          On file:{' '}
                          <span className="text-neutral-300">
                            {data.contact_phone_on_file.trim() || data.contact_phone.trim()}
                          </span>
                        </p>
                      ) : null}
                      {data.contact_phone_added.trim() ? (
                        <p className="text-xs text-neutral-500">
                          Added ({phase1CaptureOwnerLabel(data, data.contact_phone_added_owner)}):{' '}
                          <span className="text-neutral-300">{data.contact_phone_added.trim()}</span>
                        </p>
                      ) : data.phone_confirmed === 'update_needed' ? (
                        <Input
                          className="h-10 border-neutral-800 bg-neutral-950/80"
                          value={data.contact_phone}
                          onChange={e => patch({ contact_phone: e.target.value })}
                          placeholder="Updated phone"
                        />
                      ) : null}
                    </div>
                  ) : null}
                  {(data.email_confirmed === 'update_needed' ||
                    data.email_confirmed === 'need_to_get' ||
                    data.contact_email_added.trim()) ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 1 — Opening</p>
                      <p className="text-sm text-neutral-200">Email</p>
                      {(data.contact_email_on_file.trim() || data.contact_email.trim()) ? (
                        <p className="text-xs text-neutral-500">
                          On file:{' '}
                          <span className="text-neutral-300">
                            {data.contact_email_on_file.trim() || data.contact_email.trim()}
                          </span>
                        </p>
                      ) : null}
                      {data.contact_email_added.trim() ? (
                        <p className="text-xs text-neutral-500">
                          Added ({phase1CaptureOwnerLabel(data, data.contact_email_added_owner)}):{' '}
                          <span className="text-neutral-300">{data.contact_email_added.trim()}</span>
                        </p>
                      ) : data.email_confirmed === 'update_needed' ||
                        data.email_confirmed === 'need_to_get' ? (
                        <Input
                          className="h-10 border-neutral-800 bg-neutral-950/80"
                          value={data.contact_email}
                          onChange={e => patch({ contact_email: e.target.value })}
                          placeholder="Email"
                        />
                      ) : null}
                    </div>
                  ) : null}

                  {data.onsite_same_contact === 'different' &&
                  (data.onsite_name_flag === 'capture_later' ||
                    data.onsite_phone_flag === 'capture_later' ||
                    !!data.onsite_linked_contact_id) ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-3">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 4 — On-site contact</p>
                      {data.onsite_name_flag === 'capture_later' ? (
                        <div className="space-y-1.5">
                          <Label className="text-neutral-400 text-xs">On-site name</Label>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={data.onsite_contact_name}
                            onChange={e => patch({ onsite_contact_name: e.target.value })}
                          />
                        </div>
                      ) : null}
                      {data.onsite_phone_flag === 'capture_later' ? (
                        <div className="space-y-1.5">
                          <Label className="text-neutral-400 text-xs">On-site phone</Label>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={data.onsite_contact_phone}
                            onChange={e => patch({ onsite_contact_phone: e.target.value })}
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1.5">
                        <Label className="text-neutral-400 text-xs">On-site role</Label>
                        <Input
                          className="h-10 border-neutral-800 bg-neutral-950/80"
                          value={data.onsite_contact_role}
                          onChange={e => patch({ onsite_contact_role: e.target.value })}
                          placeholder="e.g. Production manager"
                        />
                      </div>
                    </div>
                  ) : null}

                  {data.invoice_same_contact === 'different' ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-3">
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 5 — Invoicing</p>
                      {data.invoice_company_confirmed === 'capture_later' ? (
                        <div className="space-y-1.5">
                          <Label className="text-neutral-400 text-xs">Invoice company / legal name</Label>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={data.invoice_company_text}
                            onChange={e => patch({ invoice_company_text: e.target.value })}
                          />
                        </div>
                      ) : null}
                      {data.invoice_email_confirmed === 'capture_later' ? (
                        <div className="space-y-1.5">
                          <Label className="text-neutral-400 text-xs">Invoice email</Label>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={data.invoice_email_text}
                            onChange={e => patch({ invoice_email_text: e.target.value })}
                          />
                        </div>
                      ) : null}
                      {data.billing_linked_contact_id ? (
                        <div className="space-y-1.5">
                          <Label className="text-neutral-400 text-xs">Billing contact</Label>
                          <p className="text-sm text-neutral-200 rounded-md border border-white/[0.06] bg-neutral-950/50 px-3 py-2">
                            {(() => {
                              const c = contactsForVenue.find(x => x.id === data.billing_linked_contact_id)
                              if (!c) {
                                return 'Linked to a venue contact — refresh or open Outreach if details are missing.'
                              }
                              const r = contactRoleForDisplay(c)
                              return (
                                <>
                                  {c.name}
                                  {r ? <span className="text-neutral-500"> · {r}</span> : null}
                                  {c.email ? (
                                    <span className="block text-xs text-neutral-500 mt-1">{c.email}</span>
                                  ) : null}
                                </>
                              )
                            })()}
                          </p>
                        </div>
                      ) : null}
                      {data.billing_contact_flag === 'capture_later' ? (
                        <>
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Billing contact name</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80"
                              value={data.billing_contact_name}
                              onChange={e => patch({ billing_contact_name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Billing contact email</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80"
                              value={data.billing_contact_email}
                              onChange={e => patch({ billing_contact_email: e.target.value })}
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {showsSorted.map((row, idx) => {
                    const sd = parseShowDataV3(row.show_data, row.sort_order)
                    const showLab = showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`
                    const showHeader = (
                      <p className="text-xs text-neutral-500 flex items-center gap-2 pb-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sd.color }} />
                        {showLab}
                      </p>
                    )
                    const blocks: ReactNode[] = []
                    if (
                      !sd.event_name_text.trim() &&
                      sd.event_name_flag !== 'no_name_yet' &&
                      (sd.event_name_flag === 'capture_later' ||
                        sd.event_name_flag === 'other' ||
                        sd.event_name_flag === '')
                    ) {
                      blocks.push(
                        <div key="en" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — The Event</p>
                          <p className="text-sm text-neutral-200">Event name / title</p>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={sd.event_name_text}
                            onChange={e =>
                              applyShowPatch(row.id, { event_name_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (sd.venue_name_flag === 'capture_later' || sd.venue_name_flag === 'tbd') {
                      blocks.push(
                        <div key="vn" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — Event address</p>
                          <p className="text-sm text-neutral-200">Venue name</p>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={sd.venue_name_text}
                            onChange={e =>
                              applyShowPatch(row.id, { venue_name_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (sd.city_flag === 'capture_later' || sd.city_flag === 'tbd') {
                      blocks.push(
                        <div key="ct" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — Event address</p>
                          <p className="text-sm text-neutral-200">City</p>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={sd.city_text}
                            onChange={e => applyShowPatch(row.id, { city_text: e.target.value }, 'post')}
                          />
                        </div>,
                      )
                    }
                    if (sd.address_status) {
                      blocks.push(
                        <div key="ad" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-3">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — Address</p>
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Street</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80"
                              value={sd.street_address}
                              onChange={e =>
                                applyShowPatch(row.id, { street_address: e.target.value }, 'post')
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Apt, suite, unit</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80"
                              value={sd.address_line2}
                              onChange={e =>
                                applyShowPatch(row.id, { address_line2: e.target.value }, 'post')
                              }
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-neutral-400 text-xs">Postal code</Label>
                            <Input
                              className="h-10 border-neutral-800 bg-neutral-950/80"
                              value={sd.postal_code}
                              onChange={e =>
                                applyShowPatch(row.id, { postal_code: e.target.value }, 'post')
                              }
                            />
                          </div>
                        </div>,
                      )
                    }
                    if (sd.exact_capacity_flag === 'capture_later') {
                      blocks.push(
                        <div key="cap" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 2 — Scale</p>
                          <p className="text-sm text-neutral-200">Exact headcount</p>
                          <Input
                            className="h-10 border-neutral-800 bg-neutral-950/80"
                            value={sd.exact_capacity_number}
                            onChange={e =>
                              applyShowPatch(row.id, { exact_capacity_number: e.target.value }, 'post')
                            }
                            inputMode="numeric"
                          />
                        </div>,
                      )
                    }
                    if (sd.music_requests_flag === 'capture_later') {
                      blocks.push(
                        <div key="mus" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 3 — Music</p>
                          <p className="text-sm text-neutral-200">Music requests</p>
                          <Textarea
                            className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                            value={sd.music_requests_text}
                            onChange={e =>
                              applyShowPatch(row.id, { music_requests_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (sd.custom_setlist === 'specific_requests') {
                      blocks.push(
                        <div key="set" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 3 — Music</p>
                          <p className="text-sm text-neutral-200">Setlist / specific requests</p>
                          <Textarea
                            className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                            value={sd.custom_setlist_notes}
                            onChange={e =>
                              applyShowPatch(row.id, { custom_setlist_notes: e.target.value }, 'post')
                            }
                            placeholder="Must-plays, do-not-plays, edits, BPM…"
                          />
                        </div>,
                      )
                    }
                    if (sd.equipment_details_flag === 'capture_later') {
                      blocks.push(
                        <div key="eq" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 4 — Equipment</p>
                          <p className="text-sm text-neutral-200">Equipment details</p>
                          <Textarea
                            className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                            value={sd.equipment_details_text}
                            onChange={e =>
                              applyShowPatch(row.id, { equipment_details_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (sd.parking_details_flag === 'capture_later') {
                      blocks.push(
                        <div key="pk" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 4 — Parking</p>
                          <p className="text-sm text-neutral-200">Parking details</p>
                          <Textarea
                            className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                            value={sd.parking_details_text}
                            onChange={e =>
                              applyShowPatch(row.id, { parking_details_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (sd.travel_notes_flag === 'capture_later' && sd.travel_required !== 'local') {
                      blocks.push(
                        <div key="tr" className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-2">
                          {showHeader}
                          <p className="text-[10px] text-neutral-500 uppercase tracking-wide">From: Phase 4 — Travel</p>
                          <p className="text-sm text-neutral-200">Travel / lodging notes</p>
                          <Textarea
                            className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                            value={sd.travel_notes_text}
                            onChange={e =>
                              applyShowPatch(row.id, { travel_notes_text: e.target.value }, 'post')
                            }
                          />
                        </div>,
                      )
                    }
                    if (blocks.length === 0) return null
                    return <div key={row.id} className="space-y-3">{blocks}</div>
                  })}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.08] bg-neutral-900/30 p-3 space-y-3">
                    <div>
                      <p className="text-[10px] text-neutral-500 uppercase tracking-wide">Venue promise lines</p>
                      <p className="text-[11px] text-neutral-500 mt-1">
                        Quick scan — tap a line to jump to the line-by-line editor.
                      </p>
                    </div>
                    {showsSorted.map((row, idx) => {
                      const sd = parseShowDataV3(row.show_data, row.sort_order)
                      return (
                        <div
                          key={`sum-${row.id}`}
                          className={cn('space-y-2', idx > 0 && 'pt-3 border-t border-white/[0.06]')}
                        >
                          {showsSorted.length > 1 ? (
                            <p className="text-xs text-neutral-500 flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ background: sd.color }}
                              />
                              {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                            </p>
                          ) : null}
                          <div className="space-y-0.5 rounded-md border border-white/[0.06] bg-neutral-950/40 p-2">
                            {SHOW_REPORT_PRESETS.map(preset => {
                              const lineId = preset.id as VenuePromiseLineIdV3
                              const rawVal = sd.promise_lines_v3[lineId]
                              const { status, summary } = postCallPromiseLineUi(rawVal, lineId)
                              const mark = status === 'set' ? '\u2713' : status === 'warn' ? '!' : '\u25cb'
                              return (
                                <button
                                  key={lineId}
                                  type="button"
                                  className="w-full flex items-baseline gap-2 rounded px-2 py-1.5 text-left hover:bg-neutral-900/80 transition-colors"
                                  onClick={() => {
                                    const el = document.getElementById(`8a-promise-${row.id}-${lineId}`)
                                    const details = el?.closest('details')
                                    if (details && !details.open) details.open = true
                                    requestAnimationFrame(() =>
                                      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }),
                                    )
                                  }}
                                >
                                  <span
                                    className={cn(
                                      'shrink-0 font-mono text-[11px] w-4 tabular-nums',
                                      status === 'set' && 'text-emerald-400/90',
                                      status === 'open' && 'text-neutral-500',
                                      status === 'warn' && 'text-amber-500/90',
                                    )}
                                  >
                                    {mark}
                                  </span>
                                  <span className="text-xs text-neutral-300 shrink-0 min-w-[7.5rem]">
                                    {preset.label}
                                  </span>
                                  <span className="text-xs text-neutral-500 flex-1 text-right min-w-0 truncate">
                                    {summary}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                    <details className="group rounded-md border border-white/[0.06] bg-neutral-950/30 open:pb-2">
                      <summary className="cursor-pointer list-none px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200 flex items-center justify-between gap-2 [&::-webkit-details-marker]:hidden">
                        <span>Adjust line-by-line</span>
                        <span className="text-[10px] text-neutral-600 shrink-0">
                          <span className="group-open:hidden">Show</span>
                          <span className="hidden group-open:inline">Hide</span>
                        </span>
                      </summary>
                      <div className="px-2 pb-2 space-y-3 pt-1">
                        {showsSorted.map((row, idx) => {
                          const sd = parseShowDataV3(row.show_data, row.sort_order)
                          return (
                            <div
                              key={row.id}
                              className={cn('space-y-2', idx > 0 && 'pt-3 border-t border-white/[0.06]')}
                            >
                              {showsSorted.length > 1 ? (
                                <p className="text-xs text-neutral-500 flex items-center gap-2">
                                  <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ background: sd.color }}
                                  />
                                  {showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`}
                                </p>
                              ) : null}
                              <div className="grid gap-2 sm:grid-cols-2">
                                {SHOW_REPORT_PRESETS.map(preset => {
                                  const lineId = preset.id as VenuePromiseLineIdV3
                                  const rawVal = sd.promise_lines_v3[lineId]
                                  const opts = [
                                    { value: '' as const, label: '—' },
                                    ...VENUE_PROMISE_LINE_OPTIONS[lineId],
                                  ]
                                  const isAuto = sd.promise_lines_auto[lineId]
                                  return (
                                    <div
                                      key={lineId}
                                      id={`8a-promise-${row.id}-${lineId}`}
                                      className="rounded-md border border-white/[0.06] bg-neutral-950/40 p-2 space-y-1.5 scroll-mt-28"
                                    >
                                      <div className="flex items-center gap-2">
                                        <Label className="text-neutral-300 text-xs font-medium leading-tight">
                                          {preset.label}
                                        </Label>
                                        {isAuto ? (
                                          <span className="text-[9px] uppercase text-amber-500/90">Auto</span>
                                        ) : null}
                                      </div>
                                      <ToggleN
                                        value={rawVal}
                                        onChange={v => patchPromiseLine(row.id, lineId, v)}
                                        options={opts}
                                      />
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </details>
                  </div>
                </div>
              ) : null}

              {postCallSection === '8B' ? (
                <div className="space-y-4">
                  <section className="space-y-2">
                    <Label className="text-neutral-400 text-xs">Call notes</Label>
                    <Textarea
                      className="min-h-[100px] border-neutral-800 bg-neutral-950/80 resize-y"
                      value={data.post_call_notes}
                      onChange={e => patch({ post_call_notes: e.target.value })}
                      placeholder="Deal notes, recap, anything to remember…"
                    />
                  </section>
                  <section className="space-y-2">
                    <Label className="text-neutral-400 text-xs">Things worth remembering</Label>
                    <Textarea
                      className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                      value={data.future_intel}
                      onChange={e => patch({ future_intel: e.target.value })}
                    />
                  </section>
                  <section className="space-y-2">
                    <Label className="text-neutral-400 text-xs">Concerns</Label>
                    <Textarea
                      className="min-h-[72px] border-neutral-800 bg-neutral-950/80 resize-y"
                      value={data.red_flags}
                      onChange={e => patch({ red_flags: e.target.value })}
                    />
                  </section>
                </div>
              ) : null}

              {postCallSection === '8C' ? (
                <div className="space-y-4">
                  <p className="text-sm text-neutral-400">
                    Preview matches what will be written to Outreach (venue + contacts) and Earnings (deals). Each deal
                    card uses the same accent as that show in the intake. Import the venue first, then each show, or use
                    Import all.
                  </p>
                  {importBanner ? (
                    <div
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm',
                        importBanner.tone === 'ok'
                          ? 'border-emerald-900/60 bg-emerald-950/30 text-emerald-100'
                          : 'border-red-900/60 bg-red-950/30 text-red-100',
                      )}
                    >
                      {importBanner.text}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="border-neutral-700"
                      disabled={
                        importBusyKey !== null ||
                        !venueImportPreview ||
                        (data.venue_source === 'existing' && !data.existing_venue_id)
                      }
                      onClick={() => void handleImportVenueClick()}
                    >
                      {importBusyKey === 'venue' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Import venue to Outreach'
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="border-neutral-700"
                      disabled={importBusyKey !== null || postCallImportAllDisabled}
                      onClick={() => void handleImportAllClick()}
                    >
                      {importBusyKey === 'all' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        'Import all (venue if needed + deals)'
                      )}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-neutral-500" asChild>
                      <Link to="/outreach">Open Outreach</Link>
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="text-neutral-500" asChild>
                      <Link to="/earnings">Open Earnings</Link>
                    </Button>
                  </div>
                  {!canImportDeals ? (
                    <p className="text-xs text-amber-600/90">
                      Add at least one package or hourly rate under Pricing &amp; fees before deal import.
                    </p>
                  ) : null}
                  {linkedVenueIdForDeals ? (
                    <p className="text-xs text-neutral-500">
                      Linked venue id for deals: <span className="font-mono text-neutral-400">{linkedVenueIdForDeals}</span>
                      {data.post_import_venue_id && !data.existing_venue_id ? ' (created from this intake)' : null}
                    </p>
                  ) : (
                    <p className="text-xs text-neutral-500">Import the venue to link a venue id before logging deals.</p>
                  )}
                  {venueImportPreview ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-900/40 p-4 space-y-2">
                      <p className="text-xs font-semibold text-neutral-300 uppercase tracking-wide">Venue preview</p>
                      <p className="text-sm text-neutral-100 font-medium">{venueImportPreview.name}</p>
                      <div className="text-xs text-neutral-500 space-y-0.5">
                        <p>
                          {[venueImportPreview.city, venueImportPreview.region].filter(Boolean).join(', ') || '—'} ·{' '}
                          {VENUE_TYPE_LABELS[venueImportPreview.venue_type]}
                        </p>
                        <p>Outreach: {OUTREACH_TRACK_LABELS[data.outreach_track]}</p>
                        <p>Status: {OUTREACH_STATUS_LABELS[venueImportPreview.status]}</p>
                        {venueImportPreview.capacity ? <p>Capacity: {venueImportPreview.capacity}</p> : null}
                        {venueImportPreview.follow_up_date ? (
                          <p>Follow-up: {venueImportPreview.follow_up_date}</p>
                        ) : null}
                      </div>
                      <p className="text-xs text-neutral-500 pt-2">
                        Primary contact: {data.contact_name.trim() || '—'} · {data.contact_email.trim() || '—'} ·{' '}
                        {data.contact_phone.trim() || '—'}
                      </p>
                    </div>
                  ) : null}
                  {showsSorted.map((row, idx) => {
                    const sd = parseShowDataV3(row.show_data, row.sort_order)
                    const showLab = showLabelFromEventDate(sd.event_date) || `Show ${idx + 1}`
                    const imp = mapShowBundleToEarningsImport(row.show_data, pricingCatalog, data)
                    const gross = imp.form.gross_amount ? Number(imp.form.gross_amount) : null
                    const grossDisp =
                      gross != null && Number.isFinite(gross) ? `$${Math.round(gross).toLocaleString()}` : '—'
                    const dealDisabled =
                      importBusyKey !== null ||
                      !canImportDeals ||
                      !linkedVenueIdForDeals ||
                      !!row.imported_deal_id
                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-white/[0.08] bg-neutral-900/40 p-4 space-y-2"
                        style={{ borderLeftWidth: 3, borderLeftColor: sd.color }}
                      >
                        <p className="text-xs font-semibold text-neutral-300 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sd.color }} />
                          {showLab}
                          {row.imported_deal_id ? (
                            <span className="text-[10px] font-normal text-neutral-500">Linked to deal</span>
                          ) : null}
                        </p>
                        <p className="text-sm text-neutral-100">{imp.form.description || '—'}</p>
                        <div className="text-xs text-neutral-500 space-y-0.5">
                          <p>
                            Set {imp.form.performance_start_time}–{imp.form.performance_end_time} ·{' '}
                            {imp.form.performance_genre || '—'}
                          </p>
                          <p>Gross: {grossDisp}</p>
                          {imp.form.deposit_paid_amount ? (
                            <p>Deposit paid on call: ${Number(imp.form.deposit_paid_amount).toLocaleString()}</p>
                          ) : null}
                        </div>
                        {imp.warnings.length ? (
                          <p className="text-xs text-amber-600/90">Note: {imp.warnings.join(' · ')}</p>
                        ) : null}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-neutral-700"
                          disabled={dealDisabled}
                          onClick={() => void handleImportDealClick(row)}
                        >
                          {importBusyKey === `deal-${row.id}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : row.imported_deal_id ? (
                            'Already imported'
                          ) : (
                            'Import as deal'
                          )}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              ) : null}
              </div>
            </div>
            <footer className="h-9 border-t border-neutral-800 flex items-center justify-between px-4 text-xs text-neutral-500 shrink-0 bg-neutral-950/90">
              <span>
                Post-call · {liveSectionTitle(postCallSection)}
              </span>
              <span className="font-mono text-neutral-600">{postCallSection}</span>
            </footer>
          </div>
        </div>
      )}
    </div>
  )
}
