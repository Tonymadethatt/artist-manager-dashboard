/** Cold call form JSON (`cold_calls.call_data`). Desktop-only; mirrors booking intake autosave pattern. */

import { CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'
import type { VenueType } from '@/types'
import { VENUE_TYPE_ORDER } from '@/types'

export const COLD_CALL_DATA_VERSION = 1 as const

const CONTACT_TITLE_KEY_SET = new Set<string>(Object.keys(CONTACT_TITLE_LABELS))
const VENUE_TYPE_CONFIRM_SET = new Set<string>(VENUE_TYPE_ORDER)

function asContactTitleKeyField(v: unknown): ContactTitleKey | '' {
  const s = typeof v === 'string' ? v.trim() : ''
  return s && CONTACT_TITLE_KEY_SET.has(s) ? (s as ContactTitleKey) : ''
}

function asVenueTypeConfirmField(v: unknown): '' | VenueType {
  const s = typeof v === 'string' ? v.trim() : ''
  return s && VENUE_TYPE_CONFIRM_SET.has(s) ? (s as VenueType) : ''
}

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

export type ColdCallPurpose = '' | 'residency' | 'upcoming_event' | 'one_time' | 'availability' | 'follow_up'

export const COLD_CALL_PURPOSE_LABELS: Record<Exclude<ColdCallPurpose, ''>, string> = {
  residency: 'Residency / recurring',
  upcoming_event: 'Upcoming event',
  one_time: 'One-time booking',
  availability: 'General availability',
  follow_up: 'Follow-up',
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

/** Migrate rows that used legacy `target_role` / `decision_maker_role` chip ids. */
function legacyColdCallRoleToTitle(roleRaw: unknown): ContactTitleKey | '' {
  const r = typeof roleRaw === 'string' ? roleRaw.trim() : ''
  if (!r) return ''
  const map: Partial<Record<Exclude<ColdCallTargetRole, ''>, ContactTitleKey>> = {
    owner: 'promoter_owner',
    talent_buyer: 'talent_buyer',
    promoter: 'promoter_owner',
    general_manager: 'venue_general_manager',
    events_coordinator: 'day_of_coordinator',
    not_sure: 'other',
  }
  if (r in map) return map[r as Exclude<ColdCallTargetRole, ''>] ?? ''
  return ''
}

function parseTargetTitleKey(o: Record<string, unknown>): ContactTitleKey | '' {
  const direct = asContactTitleKeyField(o.target_title_key)
  if (direct) return direct
  return legacyColdCallRoleToTitle(o.target_role)
}

function parseDecisionMakerTitleKey(o: Record<string, unknown>): ContactTitleKey | '' {
  const direct = asContactTitleKeyField(o.decision_maker_title_key)
  if (direct) return direct
  return legacyColdCallRoleToTitle(o.decision_maker_role)
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

export type ColdCallGatekeeperStaffRole =
  | ''
  | 'receptionist'
  | 'bartender'
  | 'security'
  | 'staff'
  | 'not_sure'

export const COLD_CALL_GATEKEEPER_STAFF_LABELS: Record<Exclude<ColdCallGatekeeperStaffRole, ''>, string> = {
  receptionist: 'Receptionist',
  bartender: 'Bartender',
  security: 'Security',
  staff: 'Staff',
  not_sure: 'Not sure',
}

export type ColdCallVoicemailLeft = '' | 'left' | 'skipped'

export type ColdCallVoicemailFollowup = '' | 'tomorrow' | 'few_days' | 'next_week' | 'dont_retry'

export type ColdCallNoAnswerRetry = '' | 'later_today' | 'tomorrow' | 'next_week' | 'remove'

/** Pre-call pitch fill-in chip ids → clause text (spec Tier 4). */
export const COLD_CALL_PITCH_REASON_CHIPS: Record<
  string,
  { label: string; clause: (ctx: { venue: string; city: string }) => string }
> = {
  latin_crowd: {
    label: 'Latin crowd',
    clause: () => 'your crowd is into the Latin scene and that’s his specialty',
  },
  events_match: {
    label: 'Their events match',
    clause: () => 'the events you guys run are right in line with what he does',
  },
  location_fit: {
    label: 'Location fit',
    clause: () => 'you guys are in a great spot for his audience',
  },
  socials: {
    label: 'Saw their socials',
    clause: () => 'I saw what you guys are doing on Instagram and the vibe matches',
  },
  referral: {
    label: 'Referral',
    clause: () => 'someone in the industry recommended I reach out',
  },
  need_djs: {
    label: 'They need DJs',
    clause: () => 'it looks like you’re actively booking DJs and I think he’d stand out',
  },
  complement_roster: {
    label: 'Complement their roster',
    clause: () =>
      'I think he’d complement what you guys already have going — not replace it, just add to it',
  },
}

export type ColdCallInitialReaction =
  | ''
  /** Response to “what does your typical DJ night look like?” */
  | 'pitch_rotation_solid'
  | 'pitch_looking'
  | 'pitch_in_house'
  | 'pitch_no_dj_nights'
  | 'pitch_tell_me_more'
  /** Legacy pitch reactions (older saved calls). */
  | 'interested'
  | 'maybe'
  | 'own_djs'
  | 'not_right_now'
  | 'not_interested'
  /** “How much?” — route to price pivot (Card 5B). */
  | 'how_much'

export type ColdCallPivotResponse = '' | 'sometimes' | 'not_really' | 'special_events'

export type ColdCallParkingResult = '' | 'send_info' | 'no_bother' | 'try_later'

export type ColdCallSendTo = '' | 'email' | 'text' | 'instagram' | 'they_already_know'

/** p2a_detail / p4c: inline contact capture — no "capture later". */
export type ColdCallDmDirectLine = '' | 'no' | 'phone' | 'email' | 'both'

export type ColdCallAskSendChannel = '' | 'email' | 'text' | 'instagram'

export type ColdCallAskFollowupWhen = '' | 'few_days' | 'next_week' | 'end_of_month' | 'they_reach_out'

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

export type ColdCallVenueTypeConfirm = '' | VenueType

export type ColdCallAskResponse =
  | ''
  | 'yes_setup'
  | 'check_back'
  | 'send_info_first'
  | 'not_now'
  | 'no'

export type ColdCallEndedNaturally = '' | 'clean_wrap' | 'they_had_to_go' | 'cut_off' | 'i_ended_it'

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
  /** Live navigation: card shown (jump-and-return). Defaults to live_card when unset in legacy rows. */
  view_card: ColdCallLiveCardId
  /** Bookmark: furthest forward position; updated only when advancing with Continue from current path. */
  last_active_card: ColdCallLiveCardId
  operator_temperature: ColdCallTemperature
  /** Cached auto score (recomputed on patch in UI). */
  temperature_score: number
  /** When true, operator_temperature is manual; auto-scoring does not overwrite. */
  temperature_manual_lock: boolean
  /** When true, outcome Select is manual vs auto-detected. */
  outcome_manual_lock: boolean

  pre_call_research_open: boolean
  pre_call_contact_open: boolean

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
  /** Catalog contact title (same keys as outreach / intake contacts). */
  target_title_key: ContactTitleKey | ''
  target_phone: string
  target_email: string
  how_found: ColdCallHowFound

  call_purpose: ColdCallPurpose
  /** Legacy free-text pitch; superseded by chip + custom when set. */
  pitch_angle: string
  pitch_reason_chip: string
  pitch_reason_custom: string
  previous_call_id: string | null

  outreach_track: 'pipeline'
  commission_tier: 'new_doors'
  priority: number

  who_answered: ColdCallWhoAnswered
  /** Gatekeeper / staff on the line (p1 when not right person). */
  gatekeeper_name: string
  gatekeeper_title_key: ContactTitleKey | ''

  gatekeeper_result: ColdCallGatekeeperResult

  voicemail_left: ColdCallVoicemailLeft
  voicemail_followup_timing: ColdCallVoicemailFollowup

  no_answer_retry_timing: ColdCallNoAnswerRetry
  decision_maker_name: string
  decision_maker_title_key: ContactTitleKey | ''
  best_time: '' | 'morning' | 'afternoon' | 'evening' | 'specific' | 'unsaid'
  /** When best_time === 'specific' (e.g. "Tuesday after 2pm"). */
  best_time_specific: string
  dm_direct_line: ColdCallDmDirectLine
  decision_maker_direct_phone: string
  decision_maker_direct_email: string
  message_taker_name: string
  callback_expected: '' | 'yes' | 'no_retry'

  initial_reaction: ColdCallInitialReaction
  /** After “Tell me more about him first”: first Continue shows bio on pitch card; second Continue → Ask. */
  pitch_tell_me_more_ack: boolean
  pivot_response: ColdCallPivotResponse
  parking_result: ColdCallParkingResult
  send_to: ColdCallSendTo

  event_nights: string[]
  night_details_note: string

  venue_vibes: string[]

  booking_process: ColdCallBookingProcess
  decision_maker_same: ColdCallDecisionMakerSame
  other_dm_name: string
  other_dm_title_key: ContactTitleKey | ''
  other_dm_line: ColdCallDmDirectLine
  other_dm_phone: string
  other_dm_email: string

  budget_range: ColdCallBudgetRange
  rate_reaction: ColdCallRateReaction

  capacity_range: ColdCallCapacityBucket
  venue_type_confirm: ColdCallVenueTypeConfirm

  ask_response: ColdCallAskResponse
  ask_send_channel: ColdCallAskSendChannel
  ask_followup_when: ColdCallAskFollowupWhen

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
    view_card: 'p1',
    last_active_card: 'p1',
    operator_temperature: '',
    temperature_score: 0,
    temperature_manual_lock: false,
    outcome_manual_lock: false,

    pre_call_research_open: false,
    pre_call_contact_open: false,

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
    target_title_key: '',
    target_phone: '',
    target_email: '',
    how_found: '',

    call_purpose: '',
    pitch_angle: '',
    pitch_reason_chip: '',
    pitch_reason_custom: '',
    previous_call_id: null,

    outreach_track: 'pipeline',
    commission_tier: 'new_doors',
    priority: 3,

    who_answered: '',
    gatekeeper_name: '',
    gatekeeper_title_key: '',

    gatekeeper_result: '',

    voicemail_left: '',
    voicemail_followup_timing: '',

    no_answer_retry_timing: '',
    decision_maker_name: '',
    decision_maker_title_key: '',
    best_time: '',
    best_time_specific: '',
    dm_direct_line: '',
    decision_maker_direct_phone: '',
    decision_maker_direct_email: '',
    message_taker_name: '',
    callback_expected: '',

    initial_reaction: '',
    pitch_tell_me_more_ack: false,
    pivot_response: '',
    parking_result: '',
    send_to: '',

    event_nights: [],
    night_details_note: '',

    venue_vibes: [],

    booking_process: '',
    decision_maker_same: '',
    other_dm_name: '',
    other_dm_title_key: '',
    other_dm_line: '',
    other_dm_phone: '',
    other_dm_email: '',

    budget_range: '',
    rate_reaction: '',

    capacity_range: '',
    venue_type_confirm: '',

    ask_response: '',
    ask_send_channel: '',
    ask_followup_when: '',

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

function legacyGatekeeperStaffToTitleKey(r: string): ContactTitleKey | '' {
  const map: Record<string, ContactTitleKey> = {
    receptionist: 'day_of_coordinator',
    bartender: 'other',
    security: 'other',
    staff: 'other',
    not_sure: 'other',
  }
  return map[r] ?? ''
}

function parseEndedNaturally(s: string): ColdCallEndedNaturally {
  if (s === 'clean_wrap' || s === 'they_had_to_go' || s === 'cut_off' || s === 'i_ended_it') return s
  if (s === 'yes') return 'clean_wrap'
  if (s === 'had_to_go') return 'they_had_to_go'
  return ''
}

function parseSendTo(s: string): ColdCallSendTo {
  if (s === 'they_find_us') return 'they_already_know'
  if (s === 'they_already_know' || s === 'email' || s === 'text' || s === 'instagram') return s as ColdCallSendTo
  return ''
}

function parseBestTime(s: string): ColdCallDataV1['best_time'] {
  if (s === 'specific_later') return 'specific'
  if (s === 'morning' || s === 'afternoon' || s === 'evening' || s === 'specific' || s === 'unsaid') return s
  return ''
}

function parseDmDirectLine(s: string): ColdCallDmDirectLine {
  if (s === 'no' || s === 'phone' || s === 'email' || s === 'both') return s
  return ''
}

function parseAskSendChannel(s: string): ColdCallAskSendChannel {
  if (s === 'email' || s === 'text' || s === 'instagram') return s
  return ''
}

function parseAskFollowupWhen(s: string): ColdCallAskFollowupWhen {
  if (s === 'few_days' || s === 'next_week' || s === 'end_of_month' || s === 'they_reach_out') return s
  return ''
}

const COLD_CALL_PURPOSE_WHITELIST: ColdCallPurpose[] = [
  '',
  'residency',
  'upcoming_event',
  'one_time',
  'availability',
  'follow_up',
]

function asColdCallPurpose(v: unknown, fb: ColdCallPurpose): ColdCallPurpose {
  const s = asStr(v, fb)
  return COLD_CALL_PURPOSE_WHITELIST.includes(s as ColdCallPurpose) ? (s as ColdCallPurpose) : fb
}

export function parseColdCallData(raw: unknown): ColdCallDataV1 {
  const base = emptyColdCallDataV1()
  if (!raw || typeof raw !== 'object') return base
  const o = raw as Record<string, unknown>
  const v = o._v
  if (v !== COLD_CALL_DATA_VERSION && v !== undefined && v !== null) {
    /* migrate later */
  }
  const liveCard = (asStr(o.live_card, base.live_card) as ColdCallLiveCardId) || base.live_card
  const viewCardRaw = asStr(o.view_card, '') as ColdCallLiveCardId
  const lastActiveRaw = asStr(o.last_active_card, '') as ColdCallLiveCardId
  return {
    ...base,
    session_mode:
      o.session_mode === 'live_call' || o.session_mode === 'post_call' || o.session_mode === 'pre_call'
        ? o.session_mode
        : base.session_mode,
    live_card: liveCard,
    live_history: asStrArr(o.live_history) as ColdCallLiveCardId[],
    view_card: viewCardRaw || liveCard,
    last_active_card: lastActiveRaw || liveCard,
    operator_temperature: asStr(o.operator_temperature, '') as ColdCallTemperature,
    temperature_score:
      typeof o.temperature_score === 'number' && Number.isFinite(o.temperature_score)
        ? o.temperature_score
        : base.temperature_score,
    temperature_manual_lock: asBool(o.temperature_manual_lock),
    outcome_manual_lock: asBool(o.outcome_manual_lock),
    pre_call_research_open: asBool(o.pre_call_research_open),
    pre_call_contact_open: asBool(o.pre_call_contact_open),

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
    target_title_key: parseTargetTitleKey(o),
    target_phone: asStr(o.target_phone),
    target_email: asStr(o.target_email),
    how_found: asStr(o.how_found, '') as ColdCallHowFound,

    call_purpose: asColdCallPurpose(o.call_purpose, base.call_purpose),
    pitch_angle: asStr(o.pitch_angle),
    pitch_reason_chip: asStr(o.pitch_reason_chip),
    pitch_reason_custom: asStr(o.pitch_reason_custom),
    previous_call_id: typeof o.previous_call_id === 'string' ? o.previous_call_id : null,

    outreach_track: 'pipeline',
    commission_tier: 'new_doors',
    priority: typeof o.priority === 'number' && o.priority >= 1 && o.priority <= 5 ? o.priority : base.priority,

    who_answered: asStr(o.who_answered, '') as ColdCallWhoAnswered,
    gatekeeper_name: asStr(o.gatekeeper_name),
    gatekeeper_title_key: ((): ContactTitleKey | '' => {
      const direct = asContactTitleKeyField(o.gatekeeper_title_key)
      if (direct) return direct
      const staff = asStr(o.gatekeeper_staff_role, '')
      return staff ? legacyGatekeeperStaffToTitleKey(staff) : ''
    })(),

    gatekeeper_result: asStr(o.gatekeeper_result, '') as ColdCallGatekeeperResult,

    voicemail_left: ((): ColdCallDataV1['voicemail_left'] => {
      const s = asStr(o.voicemail_left, '')
      return s === 'left' || s === 'skipped' ? s : ''
    })(),
    voicemail_followup_timing: ((): ColdCallDataV1['voicemail_followup_timing'] => {
      const s = asStr(o.voicemail_followup_timing, '')
      return s === 'tomorrow' || s === 'few_days' || s === 'next_week' || s === 'dont_retry' ? s : ''
    })(),

    no_answer_retry_timing: ((): ColdCallDataV1['no_answer_retry_timing'] => {
      const s = asStr(o.no_answer_retry_timing, '')
      return s === 'later_today' || s === 'tomorrow' || s === 'next_week' || s === 'remove' ? s : ''
    })(),
    decision_maker_name: asStr(o.decision_maker_name),
    decision_maker_title_key: parseDecisionMakerTitleKey(o),
    best_time: parseBestTime(asStr(o.best_time, '')),
    best_time_specific: asStr(o.best_time_specific),
    dm_direct_line: ((): ColdCallDmDirectLine => {
      const raw = parseDmDirectLine(asStr(o.dm_direct_line, ''))
      if (raw) return raw
      const legacy = asStr(o.direct_line_flag, '')
      return legacy === 'no' ? 'no' : ''
    })(),
    decision_maker_direct_phone: asStr(o.decision_maker_direct_phone),
    decision_maker_direct_email: asStr(o.decision_maker_direct_email),
    message_taker_name: asStr(o.message_taker_name),
    callback_expected: asStr(o.callback_expected, '') as ColdCallDataV1['callback_expected'],

    initial_reaction: asStr(o.initial_reaction, '') as ColdCallInitialReaction,
    pitch_tell_me_more_ack: asBool(o.pitch_tell_me_more_ack, base.pitch_tell_me_more_ack),
    pivot_response: asStr(o.pivot_response, '') as ColdCallPivotResponse,
    parking_result: asStr(o.parking_result, '') as ColdCallParkingResult,
    send_to: parseSendTo(asStr(o.send_to, '')),

    event_nights: asStrArr(o.event_nights),
    night_details_note: asStr(o.night_details_note),

    venue_vibes: asStrArr(o.venue_vibes),

    booking_process: asStr(o.booking_process, '') as ColdCallBookingProcess,
    decision_maker_same: asStr(o.decision_maker_same, '') as ColdCallDecisionMakerSame,
    other_dm_name: asStr(o.other_dm_name),
    other_dm_title_key: asContactTitleKeyField(o.other_dm_title_key),
    other_dm_line: parseDmDirectLine(asStr(o.other_dm_line, '')),
    other_dm_phone: asStr(o.other_dm_phone),
    other_dm_email: asStr(o.other_dm_email),

    budget_range: asStr(o.budget_range, '') as ColdCallBudgetRange,
    rate_reaction: asStr(o.rate_reaction, '') as ColdCallRateReaction,

    capacity_range: asStr(o.capacity_range, '') as ColdCallCapacityBucket,
    venue_type_confirm: asVenueTypeConfirmField(o.venue_type_confirm),

    ask_response: asStr(o.ask_response, '') as ColdCallAskResponse,
    ask_send_channel: parseAskSendChannel(asStr(o.ask_send_channel, '')),
    ask_followup_when: parseAskFollowupWhen(asStr(o.ask_followup_when, '')),

    call_ended_naturally: parseEndedNaturally(asStr(o.call_ended_naturally, '')),
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
