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
import { VENUE_TYPE_LABELS, VENUE_TYPE_ORDER } from '@/types'

export const WHO_ANSWERED_OPTIONS: { id: ColdCallWhoAnswered; label: string }[] = [
  { id: 'right_person', label: 'They book DJs' },
  { id: 'gatekeeper', label: 'Not the right person' },
  { id: 'voicemail', label: 'Voicemail' },
  { id: 'no_answer', label: 'No answer' },
]

export const GATEKEEPER_RESULT_OPTIONS: { id: ColdCallGatekeeperResult; label: string }[] = [
  { id: 'gave_name', label: 'They gave me a name' },
  { id: 'transferred', label: 'They transferred me' },
  { id: 'message', label: 'They took a message (ends call)' },
  { id: 'shut_down', label: 'They shut it down' },
]

export const INITIAL_REACTION_OPTIONS: { id: ColdCallInitialReaction; label: string }[] = [
  { id: 'pitch_rotation_solid', label: 'We have a solid rotation already' },
  { id: 'pitch_looking', label: 'We’re actually looking for someone' },
  { id: 'pitch_in_house', label: 'We do it in-house' },
  { id: 'pitch_no_dj_nights', label: 'We don’t really do DJ nights' },
  { id: 'pitch_tell_me_more', label: 'Tell me more about him first' },
]

export const PIVOT_OPTIONS: { id: ColdCallPivotResponse; label: string }[] = [
  { id: 'sometimes', label: 'Actually yeah, that could work' },
  { id: 'special_events', label: 'Maybe for a special event' },
  { id: 'not_really', label: 'Nah, we’re good' },
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
  { id: 'they_already_know', label: 'They already know about us' },
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

export const VENUE_TYPE_CONFIRM_OPTIONS: { id: ColdCallVenueTypeConfirm; label: string }[] = VENUE_TYPE_ORDER.map(
  id => ({ id, label: VENUE_TYPE_LABELS[id] }),
)

export const ASK_RESPONSE_OPTIONS: { id: ColdCallAskResponse; label: string }[] = [
  { id: 'yes_setup', label: 'Yes — let’s set something up' },
  { id: 'check_back', label: 'I need to check and get back' },
  { id: 'send_info_first', label: 'Send me info first' },
  { id: 'not_now', label: 'Not right now' },
  { id: 'no', label: 'No' },
]

export const ASK_SEND_CHANNEL_OPTIONS: { id: 'email' | 'text' | 'instagram'; label: string }[] = [
  { id: 'email', label: 'Email' },
  { id: 'text', label: 'Text' },
  { id: 'instagram', label: 'Instagram DM' },
]

export const ASK_FOLLOWUP_WHEN_OPTIONS: {
  id: 'few_days' | 'next_week' | 'end_of_month' | 'they_reach_out'
  label: string
}[] = [
  { id: 'few_days', label: 'A few days' },
  { id: 'next_week', label: 'Next week' },
  { id: 'end_of_month', label: 'End of month' },
  { id: 'they_reach_out', label: 'They’ll reach out' },
]

export const ENDED_OPTIONS: { id: ColdCallEndedNaturally; label: string }[] = [
  { id: 'clean_wrap', label: 'Clean wrap' },
  { id: 'they_had_to_go', label: 'They had to go' },
  { id: 'cut_off', label: 'Got cut off' },
  { id: 'i_ended_it', label: 'I ended it' },
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
  { id: 'specific', label: 'Specific day' },
  { id: 'unsaid', label: 'They didn’t say' },
]

export const DM_DIRECT_LINE_OPTIONS: { id: Exclude<ColdCallDataV1['dm_direct_line'], ''>; label: string }[] = [
  { id: 'phone', label: 'Got a number' },
  { id: 'email', label: 'Got an email' },
  { id: 'both', label: 'Got both' },
  { id: 'no', label: 'No' },
]
