import type { BookingIntakeShowDataV3 } from '@/lib/intake/intakePayloadV3'
import {
  GEAR_MODEL_OTHER_ID,
  compatTierToBool,
  getDeckById,
  getMixerById,
  type DeckKindV3,
} from '@/lib/gear/djGearCatalog'

export function intakeShowsGearVerification(sd: BookingIntakeShowDataV3): boolean {
  const ep = sd.equipment_provider
  return ep === 'venue_provides' || ep === 'hybrid'
}

function deckKindFromVenueType(t: BookingIntakeShowDataV3['venue_deck_type']): DeckKindV3 | null {
  if (t === 'cdj') return 'cdj'
  if (t === 'controller') return 'controller'
  if (t === 'turntable') return 'turntable'
  if (t === 'all_in_one') return 'all_in_one'
  return null
}

/** Deck + mixer model ids resolve to compatibility; "other" and unknown → null. */
export function resolveDeckCompatFromId(modelId: string): boolean | null {
  if (!modelId.trim() || modelId === GEAR_MODEL_OTHER_ID) return null
  const row = getDeckById(modelId)
  return row ? compatTierToBool(row.compat) : null
}

export function resolveMixerCompatFromId(modelId: string): boolean | null {
  if (!modelId.trim() || modelId === GEAR_MODEL_OTHER_ID) return null
  const row = getMixerById(modelId)
  return row ? compatTierToBool(row.compat) : null
}

/** Built-in mixer: OK only when deck is Pioneer XDJ-XZ (all-in-one or controller entry). */
export function resolveBuiltInMixerCompat(sd: BookingIntakeShowDataV3): boolean | null {
  const mid = sd.venue_deck_model_id.trim()
  if (!mid || mid === GEAR_MODEL_OTHER_ID) return null
  if (mid === 'pioneer-xdj-xz-aio' || mid === 'pioneer-xdj-xz') return true
  const deck = getDeckById(mid)
  if (deck?.compat === 'no') return false
  if (deck?.compat === 'warn') return null
  return null
}

export function computeGearCompatibleRollup(sd: BookingIntakeShowDataV3): boolean | null {
  if (!intakeShowsGearVerification(sd)) return null
  const dc = sd.venue_deck_compatible
  const mc = sd.venue_mixer_compatible
  if (dc === false || mc === false) return false
  if (dc === null || mc === null) return null
  return true
}

export function phaseAGearSkeletonComplete(sd: BookingIntakeShowDataV3): boolean {
  if (!intakeShowsGearVerification(sd)) return true
  if (!sd.venue_deck_type.trim()) return false
  if (sd.venue_deck_type !== 'not_sure') {
    if (!sd.venue_deck_model_id.trim()) return false
    if (sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID && !sd.venue_deck_other_notes.trim()) return false
  }
  if (!sd.venue_mixer_brand.trim()) return false
  if (sd.venue_mixer_brand !== 'not_sure' && sd.venue_mixer_brand !== 'built_in') {
    if (!sd.venue_mixer_model_id.trim()) return false
    if (sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID && !sd.venue_mixer_other_notes.trim()) return false
  }
  if (sd.venue_mixer_brand === 'built_in') {
    if (sd.venue_deck_type === 'not_sure' || !sd.venue_deck_model_id.trim()) return false
  }
  if (!sd.venue_booth_monitor.trim()) return false
  return true
}

export function computeGearTechFollowupNeeded(sd: BookingIntakeShowDataV3): boolean {
  if (!intakeShowsGearVerification(sd)) return false
  if (sd.gear_flagged_for_discussion) return true
  if (sd.venue_deck_type === 'not_sure') return true
  if (sd.venue_mixer_brand === 'not_sure') return true
  if (sd.venue_booth_monitor === 'not_sure') return true
  if (
    sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID &&
    !sd.venue_deck_other_notes.trim()
  )
    return true
  if (
    sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID &&
    !sd.venue_mixer_other_notes.trim()
  )
    return true
  if (sd.equipment_sound_tech === 'yes' && !phaseAGearSkeletonComplete(sd)) return true

  if (gearPhaseADetailEligible(sd)) {
    if (sd.venue_laptop_connection === 'not_sure') return true
    if (sd.venue_deck_type === 'cdj' && sd.venue_pro_dj_link === 'not_sure') return true
  }
  return false
}

export function gearPhaseADetailEligible(sd: BookingIntakeShowDataV3): boolean {
  if (!intakeShowsGearVerification(sd)) return false
  if (sd.venue_deck_type === 'not_sure' || sd.venue_mixer_brand === 'not_sure') return false
  if (!sd.venue_deck_model_id.trim() || sd.venue_deck_model_id === GEAR_MODEL_OTHER_ID) return false
  if (sd.venue_mixer_brand === 'built_in') {
    return !!sd.venue_deck_model_id.trim() && sd.venue_deck_model_id !== GEAR_MODEL_OTHER_ID
  }
  if (!sd.venue_mixer_model_id.trim() || sd.venue_mixer_model_id === GEAR_MODEL_OTHER_ID) return false
  return true
}

/** Sync compatibility flags + rollup + follow-up flag from current answers. */
export function applyGearIntakeNormalization(sd: BookingIntakeShowDataV3): BookingIntakeShowDataV3 {
  const out = { ...sd }
  if (!intakeShowsGearVerification(out)) {
    return out
  }

  if (out.venue_deck_type === 'not_sure' || !out.venue_deck_model_id.trim()) {
    out.venue_deck_compatible = null
  } else if (out.venue_deck_model_id === GEAR_MODEL_OTHER_ID) {
    out.venue_deck_compatible = null
  } else {
    out.venue_deck_compatible = resolveDeckCompatFromId(out.venue_deck_model_id)
  }

  if (out.venue_mixer_brand === 'not_sure' || !out.venue_mixer_brand.trim()) {
    out.venue_mixer_compatible = null
  } else if (out.venue_mixer_brand === 'built_in') {
    out.venue_mixer_compatible = resolveBuiltInMixerCompat(out)
  } else if (!out.venue_mixer_model_id.trim() || out.venue_mixer_model_id === GEAR_MODEL_OTHER_ID) {
    out.venue_mixer_compatible = null
  } else {
    out.venue_mixer_compatible = resolveMixerCompatFromId(out.venue_mixer_model_id)
  }

  const kind = deckKindFromVenueType(out.venue_deck_type)
  if (
    kind &&
    out.venue_deck_model_id.trim() &&
    out.venue_deck_model_id !== GEAR_MODEL_OTHER_ID
  ) {
    const row = getDeckById(out.venue_deck_model_id)
    if (row && row.deckKind !== kind) {
      out.venue_deck_compatible = null
    }
  }

  out.gear_compatible = computeGearCompatibleRollup(out)
  out.gear_tech_followup_needed = computeGearTechFollowupNeeded(out)

  return out
}

export function selectedDeckShowsIncompatibleAlert(sd: BookingIntakeShowDataV3): boolean {
  if (!intakeShowsGearVerification(sd)) return false
  if (sd.venue_deck_compatible === false) return true
  if (sd.venue_mixer_compatible === false) return true
  return false
}
