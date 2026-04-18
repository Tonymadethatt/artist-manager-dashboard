import type {
  ColdCallAskResponse,
  ColdCallBookingProcess,
  ColdCallBudgetRange,
  ColdCallPurpose,
  ColdCallCapacityBucket,
  ColdCallDataV1,
  ColdCallDecisionMakerSame,
  ColdCallDurationFeel,
  ColdCallEndedNaturally,
  ColdCallGatekeeperResult,
  ColdCallInitialReaction,
  ColdCallParkingResult,
  ColdCallPivotResponse,
  ColdCallRateReaction,
  ColdCallSendTo,
  ColdCallVenueTypeConfirm,
  ColdCallWhoAnswered,
} from '@/lib/coldCall/coldCallPayload'

export const WHO_ANSWERED_OPTIONS: { id: ColdCallWhoAnswered; label: string }[] = [
  { id: 'right_person', label: 'Right person' },
  { id: 'gatekeeper', label: 'Gatekeeper / staff' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'no_answer', label: 'No answer' },
]

export const CONFIRMED_NAME_OPTIONS: { id: 'match_target' | 'different' | 'none'; label: string }[] = [
  { id: 'match_target', label: 'Yes — matches target' },
  { id: 'different', label: 'Yes — different name' },
  { id: 'none', label: 'No name yet' },
]

export const GATEKEEPER_RESULT_OPTIONS: { id: ColdCallGatekeeperResult; label: string }[] = [
  { id: 'gave_name', label: 'They gave me a name' },
  { id: 'transferred', label: 'They transferred me' },
  { id: 'message', label: 'They took a message' },
  { id: 'shut_down', label: 'They shut it down' },
]

export const INITIAL_REACTION_OPTIONS: { id: ColdCallInitialReaction; label: string }[] = [
  { id: 'interested', label: 'Interested — tell me more' },
  { id: 'maybe', label: 'Maybe — depends' },
  { id: 'own_djs', label: 'We have our own DJs' },
  { id: 'not_right_now', label: 'Not right now' },
  { id: 'not_interested', label: 'Not interested at all' },
]

export const PIVOT_OPTIONS: { id: ColdCallPivotResponse; label: string }[] = [
  { id: 'sometimes', label: 'Actually yeah, sometimes' },
  { id: 'not_really', label: 'Not really' },
  { id: 'special_events', label: 'We might for special events' },
]

export const PARKING_OPTIONS: { id: ColdCallParkingResult; label: string }[] = [
  { id: 'send_info', label: 'Yes — send info' },
  { id: 'no_bother', label: 'No — don’t bother' },
  { id: 'try_later', label: 'Try again in a few months' },
]

export const SEND_TO_OPTIONS: { id: ColdCallSendTo; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'text', label: 'Text' },
  { id: 'instagram', label: 'Instagram DM' },
  { id: 'they_find_us', label: 'They’ll find us' },
]

export const BOOKING_PROCESS_OPTIONS: { id: ColdCallBookingProcess; label: string }[] = [
  { id: 'this_person', label: 'This person decides' },
  { id: 'someone_else', label: 'Someone else decides' },
  { id: 'committee', label: 'Committee / multiple people' },
  { id: 'unsaid', label: 'They didn’t say' },
]

export const DECISION_SAME_OPTIONS: { id: ColdCallDecisionMakerSame; label: string }[] = [
  { id: 'yes', label: 'Yes — I’m talking to them' },
  { id: 'no', label: 'No — need someone else' },
]

export const BUDGET_RANGE_OPTIONS: { id: ColdCallBudgetRange; label: string }[] = [
  { id: 'under_500', label: 'Under $500' },
  { id: '500_1000', label: '$500–$1,000' },
  { id: '1000_1500', label: '$1,000–$1,500' },
  { id: '1500_2000', label: '$1,500–$2,000' },
  { id: '2000_3000', label: '$2,000–$3,000' },
  { id: '3000_plus', label: '$3,000+' },
  { id: 'no_say', label: 'They didn’t say' },
  { id: 'depends', label: 'Depends on the DJ' },
]

export const RATE_REACTION_OPTIONS: { id: ColdCallRateReaction; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'hesitant', label: 'Hesitant' },
  { id: 'high', label: 'More than we usually pay' },
  { id: 'skipped', label: 'Didn’t discuss' },
]

export const CAPACITY_OPTIONS: { id: ColdCallCapacityBucket; label: string }[] = [
  { id: 'under_100', label: 'Under 100' },
  { id: '100_300', label: '100–300' },
  { id: '300_500', label: '300–500' },
  { id: '500_1000', label: '500–1,000' },
  { id: '1000_2000', label: '1,000–2,000' },
  { id: '2000_plus', label: '2,000+' },
]

export const VENUE_TYPE_CONFIRM_OPTIONS: { id: ColdCallVenueTypeConfirm; label: string }[] = [
  { id: 'bar', label: 'Bar' },
  { id: 'club', label: 'Club' },
  { id: 'festival', label: 'Festival' },
  { id: 'theater', label: 'Theater' },
  { id: 'lounge', label: 'Lounge' },
  { id: 'other', label: 'Other' },
]

export const ASK_RESPONSE_OPTIONS: { id: ColdCallAskResponse; label: string }[] = [
  { id: 'yes_setup', label: 'Yes — let’s set something up' },
  { id: 'check_back', label: 'I need to check and get back' },
  { id: 'send_info_first', label: 'Send me his info first' },
  { id: 'not_now', label: 'Not right now' },
  { id: 'no', label: 'No' },
]

export const ENDED_OPTIONS: { id: ColdCallEndedNaturally; label: string }[] = [
  { id: 'yes', label: 'Yes' },
  { id: 'had_to_go', label: 'They had to go' },
  { id: 'cut_off', label: 'Got cut off' },
]

export const DURATION_OPTIONS: { id: ColdCallDurationFeel; label: string }[] = [
  { id: 'quick', label: 'Quick (under 2 min)' },
  { id: 'short', label: 'Short (2–5 min)' },
  { id: 'medium', label: 'Medium (5–10 min)' },
  { id: 'long', label: 'Long (10+ min)' },
]

export const CALL_PURPOSE_TOGGLE: { id: Exclude<ColdCallPurpose, ''>; label: string }[] = [
  { id: 'residency', label: 'Residency / recurring' },
  { id: 'upcoming_event', label: 'Upcoming event' },
  { id: 'one_time', label: 'One-time booking' },
  { id: 'availability', label: 'General availability' },
  { id: 'follow_up', label: 'Follow-up call' },
]

export const BEST_TIME_OPTIONS: { id: ColdCallDataV1['best_time']; label: string }[] = [
  { id: 'morning', label: 'Morning' },
  { id: 'afternoon', label: 'Afternoon' },
  { id: 'evening', label: 'Evening' },
  { id: 'specific_later', label: 'Specific day — later' },
  { id: 'unsaid', label: 'They didn’t say' },
]
