import type { ColdCallDataV1, ColdCallOutcome } from '@/lib/coldCall/coldCallPayload'

/** Best-effort auto outcome label key for post-call (spec Problem 5). */
export function computeColdCallOutcomeAuto(d: ColdCallDataV1): ColdCallOutcome {
  if (d.who_answered === 'no_answer') {
    if (d.no_answer_retry_timing === 'remove') return 'dead_not_fit'
    return 'no_answer'
  }
  if (d.who_answered === 'voicemail') {
    if (d.voicemail_left === 'skipped') return 'no_answer'
    return 'voicemail'
  }
  if (d.gatekeeper_result === 'shut_down') return 'dead_not_fit'
  if (d.gatekeeper_result === 'gave_info' || d.gatekeeper_result === 'call_back') return 'gatekeeper_info'
  if (d.initial_reaction === 'not_interested' || d.initial_reaction === 'pitch_no_dj_nights') {
    return 'dead_not_fit'
  }
  if (d.initial_reaction === 'not_right_now' && d.parking_result) return 'interested_followup'
  if (d.ask_response === 'send_info_first') return 'interested_sending'
  if (d.ask_response === 'check_back') return 'interested_followup'
  if (d.ask_response === 'yes_setup') return 'very_interested_proposal'
  if (d.ask_response === 'no') return 'dead_not_fit'
  if (d.operator_temperature === 'converting' || d.final_temperature === 'converting') return 'converting_intake'
  if (d.operator_temperature === 'hot' || d.final_temperature === 'hot') return 'very_interested_proposal'
  if (d.operator_temperature === 'warm' || d.final_temperature === 'warm') return 'interested_followup'
  return 'interested_followup'
}
