import type { ColdCallDataV1, ColdCallLiveCardId } from './coldCallPayload'
import {
  coldCallInitialReactionIsTellMeMore,
  coldCallInitialReactionRoutesToAsk,
  coldCallInitialReactionRoutesToDeadClose,
  coldCallInitialReactionRoutesToPivot,
} from './coldCallPayload'

function coldCallHasContactLine(d: ColdCallDataV1): boolean {
  return !!(d.target_name.trim() || d.decision_maker_name.trim() || d.gatekeeper_name.trim())
}

function withHistory(d: ColdCallDataV1, next: ColdCallLiveCardId): Partial<ColdCallDataV1> {
  const hist = d.live_history.includes(next) ? d.live_history : [...d.live_history, next]
  return { live_card: next, view_card: next, last_active_card: next, live_history: hist }
}

/** After operator completes current card (all required fields set), move forward. */
export function advanceFromLiveCard(d: ColdCallDataV1): Partial<ColdCallDataV1> | 'post' {
  const card = d.view_card || d.live_card

  switch (card) {
    case 'p1': {
      if (!d.who_answered) return {}
      if (d.who_answered === 'yes_booking') {
        return withHistory(d, 'p3')
      }
      if (d.who_answered === 'wrong_person') return withHistory(d, 'p2a')
      if (d.who_answered === 'not_booking') return withHistory(d, 'p3b')
      if (d.who_answered === 'voicemail') return withHistory(d, 'p6_vm')
      if (d.who_answered === 'no_answer') return withHistory(d, 'p6_na')
      return {}
    }
    case 'p2a': {
      if (!d.gatekeeper_result) return {}
      if (d.gatekeeper_result === 'gave_info') return withHistory(d, 'p2a_detail')
      if (d.gatekeeper_result === 'transferred')
        return { ...withHistory(d, 'p3'), transferred_note: true }
      if (d.gatekeeper_result === 'call_back') return withHistory(d, 'p6')
      if (d.gatekeeper_result === 'shut_down') {
        const patch: Partial<ColdCallDataV1> = {
          ...withHistory(d, 'p6'),
          operator_temperature: d.operator_temperature || 'dead',
        }
        return patch
      }
      return {}
    }
    case 'p2a_detail': {
      if (!d.best_time) return {}
      if (d.best_time === 'specific' && !d.best_time_specific.trim()) return {}
      if (!d.dm_direct_line) return {}
      if (d.dm_direct_line === 'phone' || d.dm_direct_line === 'both') {
        if (!d.decision_maker_direct_phone.trim()) return {}
      }
      if (d.dm_direct_line === 'email' || d.dm_direct_line === 'both') {
        if (!d.decision_maker_direct_email.trim()) return {}
      }
      return withHistory(d, 'p6')
    }
    case 'p3': {
      if (!d.initial_reaction) return {}
      if (coldCallInitialReactionIsTellMeMore(d.initial_reaction)) {
        if (!d.pitch_tell_me_more_ack) {
          return { pitch_tell_me_more_ack: true }
        }
        return withHistory(d, 'p5')
      }
      if (coldCallInitialReactionRoutesToDeadClose(d.initial_reaction)) {
        return {
          ...withHistory(d, 'p6'),
          operator_temperature: d.operator_temperature || 'dead',
        }
      }
      if (d.initial_reaction === 'not_right_now') return withHistory(d, 'p3c')
      if (coldCallInitialReactionRoutesToPivot(d.initial_reaction)) return withHistory(d, 'p3b')
      if (d.initial_reaction === 'how_much') return withHistory(d, 'p4d')
      if (coldCallInitialReactionRoutesToAsk(d.initial_reaction)) return withHistory(d, 'p5')
      return {}
    }
    case 'p3b': {
      if (!d.pivot_response) return {}
      if (d.pivot_response === 'not_really') return withHistory(d, 'p6')
      if (d.pivot_response === 'special_events') return withHistory(d, 'p3c')
      return withHistory(d, 'p5')
    }
    case 'p3c': {
      if (!d.parking_result) return {}
      if (d.parking_result === 'send_info') {
        if (!d.parking_email.trim()) return {}
        if (!d.send_to) return {}
      }
      return withHistory(d, 'p6')
    }
    case 'p4d': {
      if (!d.price_primary_reaction) return {}
      const pr = d.price_primary_reaction
      if (pr === 'too_much') {
        if (!d.price_trial_reaction) return {}
        if (d.price_trial_reaction === 'trial_no') return withHistory(d, 'p6')
        return withHistory(d, 'p5')
      }
      if (pr === 'need_to_think') return withHistory(d, 'p6')
      return withHistory(d, 'p5')
    }
    case 'p5': {
      if (!d.ask_response) return {}
      if (d.ask_response === 'send_info_first' && !d.ask_send_channel) return {}
      if (d.ask_response === 'check_back' && !d.ask_followup_when) return {}
      if (d.ask_response === 'yes_setup') {
        if (!d.event_nights.length) return {}
        if (!d.venue_vibes.length) return {}
      }
      return withHistory(d, 'p6')
    }
    case 'p6': {
      if (!d.call_ended_naturally || !d.call_duration_feel) return {}
      if (d.operator_temperature === 'converting') {
        if (!d.p6_convert_mode) return {}
        if (!coldCallHasContactLine(d)) return {}
      }
      return 'post'
    }
    case 'p6_vm': {
      if (!d.voicemail_left || !d.voicemail_followup_timing) return {}
      return 'post'
    }
    case 'p6_na': {
      if (!d.no_answer_retry_timing) return {}
      return 'post'
    }
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
