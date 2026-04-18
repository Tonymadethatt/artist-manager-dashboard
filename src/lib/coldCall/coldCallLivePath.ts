import type { ColdCallDataV1, ColdCallLiveCardId } from '@/lib/coldCall/coldCallPayload'

/** Furthest-forward card in the live flow (bookmark). */
export function bookmarkCard(d: ColdCallDataV1): ColdCallLiveCardId {
  return d.last_active_card || d.live_card
}

/** Card currently shown (may be behind bookmark after a jump). */
export function displayCard(d: ColdCallDataV1): ColdCallLiveCardId {
  return d.view_card || bookmarkCard(d)
}

export function waypointIndex(card: ColdCallLiveCardId): number {
  if (card === 'p1') return 0
  if (card === 'p2a' || card === 'p2a_detail' || card === 'p2_msg') return 1
  if (card === 'p3' || card === 'p3b' || card === 'p3c') return 2
  if (card === 'p4a' || card === 'p4b' || card === 'p4c' || card === 'p4d' || card === 'p4e') return 3
  if (card === 'p5') return 4
  return 5
}

const PITCH_SET = new Set<ColdCallLiveCardId>(['p3', 'p3b', 'p3c'])
const P4_SET = new Set<ColdCallLiveCardId>(['p4a', 'p4b', 'p4c', 'p4d', 'p4e'])
const CLOSE_SET = new Set<ColdCallLiveCardId>(['p6', 'p6_vm', 'p6_na'])

/** Sidebar waypoint → first card to show for that phase on this call. */
export function coldCallWaypointAnchor(phaseIdx: number, d: ColdCallDataV1): ColdCallLiveCardId {
  switch (phaseIdx) {
    case 0:
      return 'p1'
    case 1:
      return 'p2a'
    case 2: {
      const hit = d.live_history.find(c => PITCH_SET.has(c))
      return hit ?? 'p3'
    }
    case 3: {
      const hit = d.live_history.find(c => P4_SET.has(c))
      return hit ?? 'p4a'
    }
    case 4:
      return 'p5'
    case 5: {
      const rev = [...d.live_history].reverse()
      const hit = rev.find(c => CLOSE_SET.has(c))
      return hit ?? 'p6'
    }
    default:
      return 'p1'
  }
}

/** True when this phase is usually skipped on the current branch (still navigable). */
export function coldCallPhaseSkipped(phaseIdx: number, d: ColdCallDataV1): boolean {
  const w = d.who_answered
  if (phaseIdx === 1) return w === 'right_person' || w === 'voicemail' || w === 'no_answer'
  if (phaseIdx >= 2 && phaseIdx <= 4) return w === 'voicemail' || w === 'no_answer'
  return false
}

export type LiveCardValidationIssue = { field: string; message: string }

/** Blockers when tapping Continue at the bookmark (matches advanceFromLiveCard gates). */
export function liveCardAdvanceBlockersAtBookmark(d: ColdCallDataV1): LiveCardValidationIssue[] {
  const card = bookmarkCard(d)
  const issues: LiveCardValidationIssue[] = []
  const need = (field: string, ok: boolean, message: string) => {
    if (!ok) issues.push({ field, message })
  }

  switch (card) {
    case 'p1': {
      need('who_answered', !!d.who_answered, 'Pick who picked up.')
      if (d.who_answered === 'right_person') {
        need('target_title_key', !!d.target_title_key, 'Pick their title.')
        if (d.target_name.trim()) {
          need('confirmed_name', !!d.confirmed_name, 'Confirm the name.')
        } else {
          need('cold_no_target_name_status', !!d.cold_no_target_name_status, 'Pick one.')
        }
      }
      break
    }
    case 'p2a': {
      need('gatekeeper_result', !!d.gatekeeper_result, 'Pick what happened.')
      need('gatekeeper_got_name', !!d.gatekeeper_got_name, 'Pick one.')
      need('gatekeeper_staff_role', !!d.gatekeeper_staff_role, 'Pick their role.')
      break
    }
    case 'p3':
      need('initial_reaction', !!d.initial_reaction, 'Pick how they responded.')
      break
    case 'p3b':
      need('pivot_response', !!d.pivot_response, 'Pick one.')
      break
    case 'p3c':
      need('parking_result', !!d.parking_result, 'Pick one.')
      break
    case 'p4a':
      need('event_nights', d.event_nights.length > 0, 'Select at least one night.')
      break
    case 'p4c':
      need('booking_process', !!d.booking_process, 'Pick who handles booking.')
      need('decision_maker_same', !!d.decision_maker_same, 'Pick one.')
      break
    case 'p5':
      need('ask_response', !!d.ask_response, 'Pick their answer.')
      break
    case 'p6':
      need('call_ended_naturally', !!d.call_ended_naturally, 'Pick how the call ended.')
      need('call_duration_feel', !!d.call_duration_feel, 'Pick duration.')
      break
    case 'p6_vm':
      need('voicemail_left', !!d.voicemail_left, 'Pick one.')
      need('voicemail_followup_timing', !!d.voicemail_followup_timing, 'Pick follow-up timing.')
      break
    case 'p6_na':
      need('no_answer_retry_timing', !!d.no_answer_retry_timing, 'Pick one.')
      need('no_answer_notes_flag', !!d.no_answer_notes_flag, 'Pick one.')
      break
    default:
      break
  }
  return issues
}
