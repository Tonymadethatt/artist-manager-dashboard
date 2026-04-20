import type { ColdCallDataV1, ColdCallLiveCardId } from '@/lib/coldCall/coldCallPayload'
import { coldCallInitialReactionIsTellMeMore } from '@/lib/coldCall/coldCallPayload'

function coldCallHasContactLine(d: ColdCallDataV1): boolean {
  return !!(d.target_name.trim() || d.decision_maker_name.trim() || d.gatekeeper_name.trim())
}

/** Furthest-forward card in the live flow (bookmark). */
export function bookmarkCard(d: ColdCallDataV1): ColdCallLiveCardId {
  return d.last_active_card || d.live_card
}

/** Card currently shown (may be behind bookmark after a jump). */
export function displayCard(d: ColdCallDataV1): ColdCallLiveCardId {
  return d.view_card || bookmarkCard(d)
}

const GATEKEEPER_LIVE_CARDS = new Set<ColdCallLiveCardId>(['p2a', 'p2a_detail'])
const PITCH_ENTRY_CARDS = new Set<ColdCallLiveCardId>(['p3', 'p3c'])

/** Whether `from → to` is allowed on the live path for the current `who_answered` (guards stale history). */
export function liveHistoryEdgeValid(
  from: ColdCallLiveCardId,
  to: ColdCallLiveCardId,
  d: ColdCallDataV1,
): boolean {
  if (from !== 'p1') return true
  const w = d.who_answered
  if (GATEKEEPER_LIVE_CARDS.has(to)) return w === 'wrong_person'
  if (to === 'p3b') return w === 'not_booking'
  if (PITCH_ENTRY_CARDS.has(to)) return w === 'yes_booking'
  if (to === 'p6_vm') return w === 'voicemail'
  if (to === 'p6_na') return w === 'no_answer'
  return true
}

/**
 * If the user is reviewing an earlier card but `live_history` still contains a next step
 * from an old branch (e.g. gatekeeper), drop the stale tail so Continue runs real advance logic.
 */
export function pruneStaleLiveHistoryIfNeeded(d: ColdCallDataV1): { data: ColdCallDataV1; changed: boolean } {
  const view = displayCard(d)
  const i = d.live_history.indexOf(view)
  if (i < 0 || i >= d.live_history.length - 1) return { data: d, changed: false }
  const to = d.live_history[i + 1]!
  if (liveHistoryEdgeValid(view, to, d)) return { data: d, changed: false }
  const data: ColdCallDataV1 = {
    ...d,
    live_history: d.live_history.slice(0, i + 1),
    last_active_card: view,
    view_card: view,
  }
  return { data, changed: true }
}

/**
 * Live steps that are only chip toggles (no text inputs / dropdowns) can auto-advance after a chip click.
 * Steps with ContactTitleSelect, EntityTypeSelect, or required free-text stay manual (Continue).
 */
export function liveCardAllowsChipAutoAdvance(card: ColdCallLiveCardId, d: ColdCallDataV1): boolean {
  switch (card) {
    case 'p1':
      return d.who_answered === 'voicemail' || d.who_answered === 'no_answer'
    case 'p2a':
      return true
    case 'p3':
      return (
        d.initial_reaction !== '' && !coldCallInitialReactionIsTellMeMore(d.initial_reaction)
      )
    case 'p3b':
    case 'p3c':
      return true
    case 'p4d':
      return false
    case 'p5':
      return false
    case 'p6':
      if (d.operator_temperature === 'converting') return false
      if (!coldCallHasContactLine(d)) return false
      return true
    case 'p6_vm':
    case 'p6_na':
      return true
    case 'p2a_detail':
    default:
      return false
  }
}

/**
 * Waypoint order (audit): Opener → Redirect → Pitch → Pivot → Price → Ask → Close.
 * Indices 0..6 for sidebar.
 */
export function waypointIndex(card: ColdCallLiveCardId): number {
  if (card === 'p1') return 0
  if (card === 'p2a' || card === 'p2a_detail') return 1
  if (card === 'p3') return 2
  if (card === 'p3b' || card === 'p3c') return 3
  if (card === 'p4d') return 4
  if (card === 'p5') return 5
  if (card === 'p6' || card === 'p6_vm' || card === 'p6_na') return 6
  return 0
}

const PITCH_SET = new Set<ColdCallLiveCardId>(['p3', 'p3c'])
const REDIRECT_SET = new Set<ColdCallLiveCardId>(['p2a', 'p2a_detail'])
const PIVOT_SET = new Set<ColdCallLiveCardId>(['p3b', 'p3c'])
const CLOSE_SET = new Set<ColdCallLiveCardId>(['p6', 'p6_vm', 'p6_na'])

/** Sidebar waypoint → first card to show for that phase on this call. */
export function coldCallWaypointAnchor(phaseIdx: number, d: ColdCallDataV1): ColdCallLiveCardId {
  switch (phaseIdx) {
    case 0:
      return 'p1'
    case 1: {
      const w = d.who_answered
      if (w === 'voicemail') {
        const vm = d.live_history.find(c => c === 'p6_vm')
        return vm ?? 'p1'
      }
      if (w === 'no_answer') {
        const na = d.live_history.find(c => c === 'p6_na')
        return na ?? 'p1'
      }
      const hit = d.live_history.find(c => REDIRECT_SET.has(c))
      return hit ?? 'p2a'
    }
    case 2: {
      const hit = d.live_history.find(c => PITCH_SET.has(c))
      return hit ?? 'p3'
    }
    case 3: {
      const hit = d.live_history.find(c => PIVOT_SET.has(c))
      return hit ?? 'p3b'
    }
    case 4:
      return d.live_history.find(c => c === 'p4d') ?? 'p4d'
    case 5:
      return d.live_history.find(c => c === 'p5') ?? 'p5'
    case 6: {
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
  if (phaseIdx === 1) return w === 'yes_booking' || w === 'not_booking' || w === 'voicemail' || w === 'no_answer'
  if (phaseIdx === 2) return w === 'not_booking' || w === 'voicemail' || w === 'no_answer'
  if (phaseIdx === 3 || phaseIdx === 4 || phaseIdx === 5) return w === 'voicemail' || w === 'no_answer'
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
      break
    }
    case 'p2a': {
      need('gatekeeper_result', !!d.gatekeeper_result, 'Pick what happened.')
      break
    }
    case 'p2a_detail': {
      need('best_time', !!d.best_time, 'Pick best time.')
      need('dm_direct_line', !!d.dm_direct_line, 'Pick direct line / email if any.')
      if (d.best_time === 'specific') {
        need('best_time_specific', !!d.best_time_specific.trim(), 'Add the specific day or time.')
      }
      if (d.dm_direct_line === 'phone' || d.dm_direct_line === 'both') {
        need('decision_maker_direct_phone', !!d.decision_maker_direct_phone.trim(), 'Add their phone.')
      }
      if (d.dm_direct_line === 'email' || d.dm_direct_line === 'both') {
        need('decision_maker_direct_email', !!d.decision_maker_direct_email.trim(), 'Add their email.')
      }
      break
    }
    case 'p3':
      need('initial_reaction', !!d.initial_reaction, 'Pick how they responded.')
      break
    case 'p3b':
      need('pivot_response', !!d.pivot_response, 'Pick one.')
      break
    case 'p3c': {
      need('parking_result', !!d.parking_result, 'Pick one.')
      if (d.parking_result === 'send_info') {
        need('parking_email', !!d.parking_email.trim(), 'Add the best email.')
        need('send_to', !!d.send_to, 'Pick how to send info.')
      }
      break
    }
    case 'p4d': {
      need('price_primary_reaction', !!d.price_primary_reaction, 'Pick their reaction to the rate.')
      if (d.price_primary_reaction === 'too_much') {
        need('price_trial_reaction', !!d.price_trial_reaction, 'Pick how they felt about the trial option.')
      }
      break
    }
    case 'p5': {
      need('ask_response', !!d.ask_response, 'Pick their answer.')
      if (d.ask_response === 'send_info_first') {
        need('ask_send_channel', !!d.ask_send_channel, 'Pick how to send info.')
      }
      if (d.ask_response === 'check_back') {
        need('ask_followup_when', !!d.ask_followup_when, 'Pick when to follow up.')
      }
      if (d.ask_response === 'yes_setup') {
        need('event_nights', d.event_nights.length > 0, 'Pick at least one night.')
        need('venue_vibes', d.venue_vibes.length > 0, 'Pick at least one vibe.')
      }
      break
    }
    case 'p6':
      need('call_ended_naturally', !!d.call_ended_naturally, 'Pick how the call ended.')
      need('call_duration_feel', !!d.call_duration_feel, 'Pick duration.')
      if (d.operator_temperature === 'converting') {
        need('p6_convert_mode', !!d.p6_convert_mode, 'Pick how you’re closing the booking.')
        need('contact_line', coldCallHasContactLine(d), 'Add their name (who you’re setting up for).')
      }
      break
    case 'p6_vm':
      need('voicemail_left', !!d.voicemail_left, 'Pick one.')
      need('voicemail_followup_timing', !!d.voicemail_followup_timing, 'Pick follow-up timing.')
      break
    case 'p6_na':
      need('no_answer_retry_timing', !!d.no_answer_retry_timing, 'Pick one.')
      break
    default:
      break
  }
  return issues
}
