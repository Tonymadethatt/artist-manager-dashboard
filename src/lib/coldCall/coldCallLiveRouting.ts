import type { ColdCallDataV1, ColdCallLiveCardId } from './coldCallPayload'

function withHistory(d: ColdCallDataV1, next: ColdCallLiveCardId): Partial<ColdCallDataV1> {
  const hist = d.live_history.includes(next) ? d.live_history : [...d.live_history, next]
  return { live_card: next, live_history: hist }
}

/** After operator completes current card (all required fields set), move forward. */
export function advanceFromLiveCard(d: ColdCallDataV1): Partial<ColdCallDataV1> | 'post' {
  const temp = d.operator_temperature
  const hotEnough = temp === 'hot' || temp === 'converting'

  switch (d.live_card) {
    case 'p1': {
      if (!d.who_answered) return {}
      if (d.who_answered === 'right_person') {
        if (!d.confirmed_name) return {}
        return withHistory(d, 'p3')
      }
      if (d.who_answered === 'gatekeeper') return withHistory(d, 'p2a')
      if (d.who_answered === 'voicemail') return withHistory(d, 'p6_vm')
      if (d.who_answered === 'no_answer') return withHistory(d, 'p6_na')
      return {}
    }
    case 'p2a': {
      if (!d.gatekeeper_result) return {}
      if (d.gatekeeper_result === 'gave_name') return withHistory(d, 'p2a_detail')
      if (d.gatekeeper_result === 'transferred')
        return { ...withHistory(d, 'p3'), transferred_note: true }
      if (d.gatekeeper_result === 'message') return withHistory(d, 'p2_msg')
      if (d.gatekeeper_result === 'shut_down') {
        const patch: Partial<ColdCallDataV1> = {
          ...withHistory(d, 'p6'),
          operator_temperature: d.operator_temperature || 'dead',
        }
        return patch
      }
      return {}
    }
    case 'p2a_detail':
      return withHistory(d, 'p6')
    case 'p2_msg':
      return withHistory(d, 'p6')
    case 'p3': {
      if (!d.initial_reaction) return {}
      if (d.initial_reaction === 'not_interested') {
        return {
          ...withHistory(d, 'p6'),
          operator_temperature: d.operator_temperature || 'dead',
        }
      }
      if (d.initial_reaction === 'not_right_now') return withHistory(d, 'p3c')
      if (d.initial_reaction === 'own_djs') return withHistory(d, 'p3b')
      if (d.initial_reaction === 'interested' || d.initial_reaction === 'maybe') return withHistory(d, 'p4a')
      return {}
    }
    case 'p3b': {
      if (!d.pivot_response) return {}
      if (d.pivot_response === 'not_really') return withHistory(d, 'p3c')
      return withHistory(d, 'p4a')
    }
    case 'p3c': {
      if (!d.parking_result) return {}
      return withHistory(d, 'p6')
    }
    case 'p4a': {
      if (d.event_nights.length === 0) return {}
      return withHistory(d, 'p4b')
    }
    case 'p4b':
      return withHistory(d, 'p4c')
    case 'p4c': {
      if (!d.booking_process || !d.decision_maker_same) return {}
      if (hotEnough) return withHistory(d, 'p4d')
      return withHistory(d, 'p4e')
    }
    case 'p4d':
      return withHistory(d, 'p4e')
    case 'p4e':
      return withHistory(d, 'p5')
    case 'p5': {
      if (!d.ask_response) return {}
      return withHistory(d, 'p6')
    }
    case 'p6': {
      if (!d.call_ended_naturally || !d.call_duration_feel) return {}
      return 'post'
    }
    case 'p6_vm':
    case 'p6_na':
      return 'post'
    default:
      return {}
  }
}

export function applyAskResponseTemperatureHint(
  ask: ColdCallDataV1['ask_response'],
): ColdCallDataV1['operator_temperature'] | null {
  switch (ask) {
    case 'yes_setup':
      return 'converting'
    case 'check_back':
      return 'hot'
    case 'send_info_first':
      return 'warm'
    case 'not_now':
      return 'cold'
    case 'no':
      return 'dead'
    default:
      return null
  }
}

export function applyGatekeeperShutDownHint(): ColdCallDataV1['operator_temperature'] {
  return 'dead'
}
