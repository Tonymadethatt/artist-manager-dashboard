/** Cold call form JSON (`cold_calls.call_data`). Desktop-only; mirrors booking intake autosave pattern. */

export const COLD_CALL_DATA_VERSION = 1 as const

/** Pre-filled on new cold calls; `state_region` must match `US_STATE_OPTIONS[].value` (e.g. CA for California). */
export const DEFAULT_COLD_CALL_CITY = 'Los Angeles'
export const DEFAULT_COLD_CALL_STATE_REGION = 'CA'

export type ColdCallSessionMode = 'pre_call' | 'live_call' | 'post_call'

export type ColdCallTemperature = '' | 'dead' | 'cold' | 'warm' | 'hot' | 'converting'

export const COLD_CALL_TEMPERATURE_META: Record<Exclude<ColdCallTemperature, ''>, { emoji: string; label: string }> =
  {
    dead: { emoji: '💀', label: 'Dead' },
    cold: { emoji: '🥶', label: 'Cold' },
    warm: { emoji: '👀', label: 'Warm' },
    hot: { emoji: '🔥', label: 'Hot' },
    converting: { emoji: '💰', label: 'Converting' },
  }

export type ColdCallPurpose = '' | 'residency' | 'one_time' | 'availability' | 'follow_up'

export const COLD_CALL_PURPOSE_LABELS: Record<Exclude<ColdCallPurpose, ''>, string> = {
  residency: 'Residency / recurring slot',
  one_time: 'One-time booking',
  availability: 'General availability check',
  follow_up: 'Follow-up from previous call',
}

export type ColdCallTargetRole =
  | ''
  | 'owner'
  | 'talent_buyer'
  | 'promoter'
  | 'general_manager'
  | 'events_coordinator'
  | 'not_sure'

export const COLD_CALL_TARGET_ROLE_LABELS: Record<Exclude<ColdCallTargetRole, ''>, string> = {
  owner: 'Owner',
  talent_buyer: 'Talent Buyer',
  promoter: 'Promoter',
  general_manager: 'General Manager',
  events_coordinator: 'Events Coordinator',
  not_sure: 'Not sure',
}

export type ColdCallHowFound =
  | ''
  | 'instagram'
  | 'google'
  | 'referral'
  | 'yelp'
  | 'drove_by'
  | 'event_listing'
  | 'industry_contact'
  | 'other'

export const COLD_CALL_HOW_FOUND_LABELS: Record<Exclude<ColdCallHowFound, ''>, string> = {
  instagram: 'Instagram',
  google: 'Google',
  referral: 'Referral',
  yelp: 'Yelp',
  drove_by: 'Drove by',
  event_listing: 'Event listing',
  industry_contact: 'Industry contact',
  other: 'Other',
}

export type ColdCallWhoAnswered = '' | 'right_person' | 'gatekeeper' | 'voicemail' | 'no_answer'

export type ColdCallGatekeeperResult = '' | 'gave_name' | 'transferred' | 'message' | 'shut_down'

export type ColdCallInitialReaction =
  | ''
  | 'interested'
  | 'maybe'
  | 'own_djs'
  | 'not_right_now'
  | 'not_interested'

export type ColdCallPivotResponse = '' | 'sometimes' | 'not_really' | 'special_events'

export type ColdCallParkingResult = '' | 'send_info' | 'no_bother' | 'try_later'

export type ColdCallSendTo = '' | 'email' | 'text' | 'instagram' | 'they_find_us'

export type ColdCallBookingProcess = '' | 'this_person' | 'someone_else' | 'committee' | 'unsaid'

export type ColdCallDecisionMakerSame = '' | 'yes' | 'no'

export type ColdCallBudgetRange =
  | ''
  | 'under_500'
  | '500_1000'
  | '1000_1500'
  | '1500_2000'
  | '2000_3000'
  | '3000_plus'
  | 'no_say'
  | 'depends'

export type ColdCallRateReaction = '' | 'comfortable' | 'hesitant' | 'high' | 'skipped'

export type ColdCallCapacityBucket =
  | ''
  | 'under_100'
  | '100_300'
  | '300_500'
  | '500_1000'
  | '1000_2000'
  | '2000_plus'

export type ColdCallVenueTypeConfirm = '' | 'bar' | 'club' | 'festival' | 'theater' | 'lounge' | 'other'

export type ColdCallAskResponse =
  | ''
  | 'yes_setup'
  | 'check_back'
  | 'send_info_first'
  | 'not_now'
  | 'no'

export type ColdCallEndedNaturally = '' | 'yes' | 'had_to_go' | 'cut_off'

export type ColdCallDurationFeel = '' | 'quick' | 'short' | 'medium' | 'long'

export type ColdCallOutcome =
  | ''
  | 'dead_not_fit'
  | 'dead_wrong_contact'
  | 'gatekeeper_info'
  | 'interested_sending'
  | 'interested_followup'
  | 'very_interested_proposal'
  | 'converting_intake'
  | 'voicemail'
  | 'no_answer'

export const COLD_CALL_OUTCOME_LABELS: Record<Exclude<ColdCallOutcome, ''>, string> = {
  dead_not_fit: 'Dead end — not a fit',
  dead_wrong_contact: 'Dead end — wrong contact',
  gatekeeper_info: 'Gatekeeper — got decision maker info',
  interested_sending: 'Interested — sending info',
  interested_followup: 'Interested — follow-up scheduled',
  very_interested_proposal: 'Very interested — needs proposal',
  converting_intake: 'Converting — intake created',
  voicemail: 'Voicemail left',
  no_answer: 'No answer',
}

export type ColdCallRejectionReason =
  | ''
  | 'no_outside_djs'
  | 'exclusive_dj'
  | 'budget_low'
  | 'wrong_genre'
  | 'bad_timing'
  | 'rude'
  | 'wrong_contact'
  | 'other'

export const COLD_CALL_REJECTION_LABELS: Record<Exclude<ColdCallRejectionReason, ''>, string> = {
  no_outside_djs: "Don't book outside DJs",
  exclusive_dj: 'Have exclusive DJ',
  budget_low: 'Budget too low',
  wrong_genre: 'Wrong genre/vibe',
  bad_timing: 'Bad timing',
  rude: 'Rude / hostile',
  wrong_contact: 'Wrong contact / number',
  other: 'Other',
}

export type ColdCallNextActionKey =
  | 'website'
  | 'mix'
  | 'press'
  | 'email_recap'
  | 'text'
  | 'schedule_call'
  | 'instagram'
  | 'other'

export const COLD_CALL_NEXT_ACTION_LABELS: Record<ColdCallNextActionKey, string> = {
  website: 'Send website link',
  mix: 'Send mix / sample',
  press: 'Send press kit',
  email_recap: 'Send email recap',
  text: 'Send text follow-up',
  schedule_call: 'Schedule follow-up call',
  instagram: 'Send Instagram DM',
  other: 'Other',
}

export const COLD_CALL_WEEKDAY_LABELS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const

export type ColdCallLiveCardId =
  | 'p1'
  | 'p2a'
  | 'p2a_detail'
  | 'p2_msg'
  | 'p3'
  | 'p3b'
  | 'p3c'
  | 'p4a'
  | 'p4b'
  | 'p4c'
  | 'p4d'
  | 'p4e'
  | 'p5'
  | 'p6'
  | 'p6_vm'
  | 'p6_na'

export type ColdCallFlagBucket = Record<string, string>

export interface ColdCallDataV1 {
  _v: typeof COLD_CALL_DATA_VERSION
  session_mode: ColdCallSessionMode
  live_card: ColdCallLiveCardId
  /** Sidebar waypoint history (card ids visited in live mode). */
  live_history: ColdCallLiveCardId[]
  operator_temperature: ColdCallTemperature

  venue_source: 'new' | 'existing'
  existing_venue_id: string | null
  venue_name: string
  venue_type: string
  city: string
  state_region: string
  venue_vibe: string
  known_events: string
  social_handle: string
  website: string

  target_name: string
  target_role: ColdCallTargetRole
  target_phone: string
  target_email: string
  how_found: ColdCallHowFound

  call_purpose: ColdCallPurpose
  pitch_angle: string
  previous_call_id: string | null

  outreach_track: 'pipeline'
  commission_tier: 'new_doors'
  priority: number

  who_answered: ColdCallWhoAnswered
  confirmed_name: '' | 'match_target' | 'different' | 'none'
  different_name_note: string

  gatekeeper_result: ColdCallGatekeeperResult
  decision_maker_name: string
  decision_maker_role: ColdCallTargetRole
  best_time: '' | 'morning' | 'afternoon' | 'evening' | 'specific_later' | 'unsaid'
  direct_line_flag: '' | 'yes_later' | 'no'
  message_left_with: '' | 'got_name_later' | 'no_name'
  callback_expected: '' | 'yes' | 'no_retry'

  initial_reaction: ColdCallInitialReaction
  pivot_response: ColdCallPivotResponse
  parking_result: ColdCallParkingResult
  send_to: ColdCallSendTo

  event_nights: string[]
  night_details_flag: '' | 'yes_later' | 'days_only'

  venue_vibes: string[]

  booking_process: ColdCallBookingProcess
  decision_maker_same: ColdCallDecisionMakerSame
  other_decision_maker_flag: '' | 'got_info_later' | 'vague'

  budget_range: ColdCallBudgetRange
  rate_reaction: ColdCallRateReaction

  capacity_range: ColdCallCapacityBucket
  venue_type_confirm: ColdCallVenueTypeConfirm

  ask_response: ColdCallAskResponse

  call_ended_naturally: ColdCallEndedNaturally
  call_duration_feel: ColdCallDurationFeel
  transferred_note: boolean

  final_temperature: ColdCallTemperature
  outcome: ColdCallOutcome
  save_to_pipeline: boolean
  next_actions: ColdCallNextActionKey[]
  follow_up_date: string
  follow_up_notes: string
  call_notes: string
  rejection_reason: ColdCallRejectionReason

  /** Post-call text for flagged "capture later" keys from live mode. */
  flag_captures: ColdCallFlagBucket
}

export function emptyColdCallDataV1(): ColdCallDataV1 {
  return {
    _v: COLD_CALL_DATA_VERSION,
    session_mode: 'pre_call',
    live_card: 'p1',
    live_history: [],
    operator_temperature: '',

    venue_source: 'new',
    existing_venue_id: null,
    venue_name: '',
    venue_type: '',
    city: DEFAULT_COLD_CALL_CITY,
    state_region: DEFAULT_COLD_CALL_STATE_REGION,
    venue_vibe: '',
    known_events: '',
    social_handle: '',
    website: '',

    target_name: '',
    target_role: '',
    target_phone: '',
    target_email: '',
    how_found: '',

    call_purpose: '',
    pitch_angle: '',
    previous_call_id: null,

    outreach_track: 'pipeline',
    commission_tier: 'new_doors',
    priority: 3,

    who_answered: '',
    confirmed_name: '',
    different_name_note: '',

    gatekeeper_result: '',
    decision_maker_name: '',
    decision_maker_role: '',
    best_time: '',
    direct_line_flag: '',
    message_left_with: '',
    callback_expected: '',

    initial_reaction: '',
    pivot_response: '',
    parking_result: '',
    send_to: '',

    event_nights: [],
    night_details_flag: '',

    venue_vibes: [],

    booking_process: '',
    decision_maker_same: '',
    other_decision_maker_flag: '',

    budget_range: '',
    rate_reaction: '',

    capacity_range: '',
    venue_type_confirm: '',

    ask_response: '',

    call_ended_naturally: '',
    call_duration_feel: '',
    transferred_note: false,

    final_temperature: '',
    outcome: '',
    save_to_pipeline: true,
    next_actions: [],
    follow_up_date: '',
    follow_up_notes: '',
    call_notes: '',
    rejection_reason: '',

    flag_captures: {},
  }
}

function asStr(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function asBool(v: unknown, fallback = false): boolean {
  return typeof v === 'boolean' ? v : fallback
}

function asStrArr(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function asNextActions(v: unknown): ColdCallNextActionKey[] {
  if (!Array.isArray(v)) return []
  const allowed: ColdCallNextActionKey[] = [
    'website',
    'mix',
    'press',
    'email_recap',
    'text',
    'schedule_call',
    'instagram',
    'other',
  ]
  return v.filter((x): x is ColdCallNextActionKey => allowed.includes(x as ColdCallNextActionKey))
}

export function parseColdCallData(raw: unknown): ColdCallDataV1 {
  const base = emptyColdCallDataV1()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const v = o._v
  if (v !== COLD_CALL_DATA_VERSION && v !== undefined && v !== null) {
    /* migrate later */
  }
  return {
    ...base,
    session_mode:
      o.session_mode === 'live_call' || o.session_mode === 'post_call' || o.session_mode === 'pre_call'
        ? o.session_mode
        : base.session_mode,
    live_card: (asStr(o.live_card, base.live_card) as ColdCallLiveCardId) || base.live_card,
    live_history: asStrArr(o.live_history) as ColdCallLiveCardId[],
    operator_temperature: asStr(o.operator_temperature, '') as ColdCallTemperature,

    venue_source: o.venue_source === 'existing' ? 'existing' : 'new',
    existing_venue_id: typeof o.existing_venue_id === 'string' ? o.existing_venue_id : null,
    venue_name: asStr(o.venue_name),
    venue_type: asStr(o.venue_type),
    city: asStr(o.city),
    state_region: asStr(o.state_region),
    venue_vibe: asStr(o.venue_vibe),
    known_events: asStr(o.known_events),
    social_handle: asStr(o.social_handle),
    website: asStr(o.website),

    target_name: asStr(o.target_name),
    target_role: asStr(o.target_role, '') as ColdCallTargetRole,
    target_phone: asStr(o.target_phone),
    target_email: asStr(o.target_email),
    how_found: asStr(o.how_found, '') as ColdCallHowFound,

    call_purpose: asStr(o.call_purpose, '') as ColdCallPurpose,
    pitch_angle: asStr(o.pitch_angle),
    previous_call_id: typeof o.previous_call_id === 'string' ? o.previous_call_id : null,

    outreach_track: 'pipeline',
    commission_tier: 'new_doors',
    priority: typeof o.priority === 'number' && o.priority >= 1 && o.priority <= 5 ? o.priority : base.priority,

    who_answered: asStr(o.who_answered, '') as ColdCallWhoAnswered,
    confirmed_name: asStr(o.confirmed_name, '') as ColdCallDataV1['confirmed_name'],
    different_name_note: asStr(o.different_name_note),

    gatekeeper_result: asStr(o.gatekeeper_result, '') as ColdCallGatekeeperResult,
    decision_maker_name: asStr(o.decision_maker_name),
    decision_maker_role: asStr(o.decision_maker_role, '') as ColdCallTargetRole,
    best_time: asStr(o.best_time, '') as ColdCallDataV1['best_time'],
    direct_line_flag: asStr(o.direct_line_flag, '') as ColdCallDataV1['direct_line_flag'],
    message_left_with: asStr(o.message_left_with, '') as ColdCallDataV1['message_left_with'],
    callback_expected: asStr(o.callback_expected, '') as ColdCallDataV1['callback_expected'],

    initial_reaction: asStr(o.initial_reaction, '') as ColdCallInitialReaction,
    pivot_response: asStr(o.pivot_response, '') as ColdCallPivotResponse,
    parking_result: asStr(o.parking_result, '') as ColdCallParkingResult,
    send_to: asStr(o.send_to, '') as ColdCallSendTo,

    event_nights: asStrArr(o.event_nights),
    night_details_flag: asStr(o.night_details_flag, '') as ColdCallDataV1['night_details_flag'],

    venue_vibes: asStrArr(o.venue_vibes),

    booking_process: asStr(o.booking_process, '') as ColdCallBookingProcess,
    decision_maker_same: asStr(o.decision_maker_same, '') as ColdCallDecisionMakerSame,
    other_decision_maker_flag: asStr(o.other_decision_maker_flag, '') as ColdCallDataV1['other_decision_maker_flag'],

    budget_range: asStr(o.budget_range, '') as ColdCallBudgetRange,
    rate_reaction: asStr(o.rate_reaction, '') as ColdCallRateReaction,

    capacity_range: asStr(o.capacity_range, '') as ColdCallCapacityBucket,
    venue_type_confirm: asStr(o.venue_type_confirm, '') as ColdCallVenueTypeConfirm,

    ask_response: asStr(o.ask_response, '') as ColdCallAskResponse,

    call_ended_naturally: asStr(o.call_ended_naturally, '') as ColdCallEndedNaturally,
    call_duration_feel: asStr(o.call_duration_feel, '') as ColdCallDurationFeel,
    transferred_note: asBool(o.transferred_note),

    final_temperature: asStr(o.final_temperature, '') as ColdCallTemperature,
    outcome: asStr(o.outcome, '') as ColdCallOutcome,
    save_to_pipeline: typeof o.save_to_pipeline === 'boolean' ? o.save_to_pipeline : base.save_to_pipeline,
    next_actions: asNextActions(o.next_actions),
    follow_up_date: asStr(o.follow_up_date),
    follow_up_notes: asStr(o.follow_up_notes),
    call_notes: asStr(o.call_notes),
    rejection_reason: asStr(o.rejection_reason, '') as ColdCallRejectionReason,

    flag_captures:
      o.flag_captures && typeof o.flag_captures === 'object' && !Array.isArray(o.flag_captures)
        ? Object.fromEntries(
            Object.entries(o.flag_captures as Record<string, unknown>).filter(
              ([, val]) => typeof val === 'string',
            ) as [string, string][],
          )
        : {},
  }
}

export function defaultColdCallTitle(venueName: string, d: Date = new Date()): string {
  const name = venueName.trim() || 'Cold call'
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${name} — Cold Call ${y}-${m}-${day}`
}

export function coldCallTemperatureToDb(t: ColdCallTemperature): string {
  return t || ''
}

export function genreMatchHint(vibeIds: string[]): 'match' | 'caution' | 'mismatch' {
  const fit = new Set([
    'latin_party',
    'hiphop_rnb',
    'club_high_energy',
    'open_format',
    'afro_caribbean',
    'latin_x_hiphop',
    'latin_x_club',
    'rnb_x_latin',
  ])
  const chillOnly = new Set(['chill_lounge'])
  if (vibeIds.length === 0) return 'caution'
  if (vibeIds.some(id => fit.has(id))) return 'match'
  if (vibeIds.every(id => chillOnly.has(id))) return 'caution'
  return 'mismatch'
}
