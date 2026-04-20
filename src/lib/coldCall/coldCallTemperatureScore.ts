import {
  coldCallInitialReactionRoutesToPivot,
  type ColdCallDataV1,
} from '@/lib/coldCall/coldCallPayload'

/** Point thresholds → temperature (spec Problem 4). */
export function coldCallTemperatureFromScore(score: number): ColdCallDataV1['operator_temperature'] {
  if (score <= 0) return 'dead'
  if (score <= 3) return 'cold'
  if (score <= 6) return 'warm'
  if (score <= 9) return 'hot'
  return 'converting'
}

/**
 * Running score from answers (spec). Manual override is handled in UI — this is the auto suggestion only.
 */
export function computeColdCallTemperatureScore(d: ColdCallDataV1): number {
  let s = 0

  switch (d.who_answered) {
    case 'yes_booking':
      s += 2
      break
    case 'voicemail':
      s += 1
      break
    case 'wrong_person':
      if (d.gatekeeper_result === 'gave_info') s += 1
      if (d.gatekeeper_result === 'transferred') s += 2
      if (d.gatekeeper_result === 'call_back') s += 0
      if (d.gatekeeper_result === 'shut_down') s -= 2
      break
    default:
      break
  }

  switch (d.initial_reaction) {
    case 'theyre_looking':
    case 'pitch_looking':
      s += 3
      break
    case 'tell_me_more':
    case 'pitch_tell_me_more':
      s += 1
      break
    case 'how_much':
      s += 1
      break
    default:
      if (coldCallInitialReactionRoutesToPivot(d.initial_reaction)) {
        if (d.pivot_response === 'sometimes') s += 2
        else if (d.pivot_response === 'not_really') s -= 1
        else if (d.pivot_response === 'special_events') s += 1
      }
      break
  }
  switch (d.initial_reaction) {
    case 'not_right_now':
      s -= 1
      break
    case 'not_interested':
    case 'pitch_no_dj_nights':
      s -= 3
      break
    default:
      break
  }

  if (d.event_nights.length > 0) s += 1

  if (d.booking_process === 'this_person') s += 2

  if (d.budget_range === 'under_500') s -= 1
  if (
    d.budget_range === '1000_1500'
    || d.budget_range === '1500_2000'
    || d.budget_range === '2000_3000'
    || d.budget_range === '3000_plus'
  ) {
    s += 1
  }

  switch (d.ask_response) {
    case 'yes_setup':
      s += 4
      break
    case 'check_back':
      s += 2
      break
    case 'send_info_first':
      s += 1
      break
    case 'not_now':
      s -= 1
      break
    case 'no':
      s -= 3
      break
    default:
      break
  }

  return s
}

/** Live auto temperature from score; no-answer path stays unset until someone picks up. */
export function coldCallLiveAutoTemperature(d: ColdCallDataV1): ColdCallDataV1['operator_temperature'] {
  if (d.who_answered === 'no_answer') return ''
  return coldCallTemperatureFromScore(computeColdCallTemperatureScore(d))
}

/** Legacy qualify path: budget card only when “How much?” routes to price pivot — not score-gated. */
export function coldCallShowBudgetCard(_d: ColdCallDataV1): boolean {
  return false
}
