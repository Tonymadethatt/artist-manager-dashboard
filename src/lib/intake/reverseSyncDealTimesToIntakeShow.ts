import { supabase } from '@/lib/supabase'
import type { Deal } from '@/types'
import { utcIsoToPacificDateAndTime } from '@/lib/calendar/pacificWallTime'

function isIntakeShowV3(raw: unknown): raw is Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) && (raw as { _v?: unknown })._v === 3
}

/** Pacific wall-clock fields to merge into intake `show_data` from saved deal instants. */
export function wallClockPatchFromDealInstants(deal: Deal): Record<string, unknown> | null {
  const sEvt = deal.event_start_at ? utcIsoToPacificDateAndTime(deal.event_start_at) : null
  const eEvt = deal.event_end_at ? utcIsoToPacificDateAndTime(deal.event_end_at) : null
  if (!sEvt) return null

  const patch: Record<string, unknown> = {
    event_date: sEvt.date,
    event_start_time: sEvt.time,
  }

  if (eEvt) {
    patch.event_end_time = eEvt.time
    const overnight =
      eEvt.date !== sEvt.date ||
      (eEvt.time <= sEvt.time && eEvt.date === sEvt.date)
    patch.overnight_event = overnight
  }

  const setStartIso = deal.performance_start_at ?? deal.event_start_at
  const setEndIso = deal.performance_end_at ?? deal.event_end_at
  const sSet = setStartIso ? utcIsoToPacificDateAndTime(setStartIso) : null
  const eSet = setEndIso ? utcIsoToPacificDateAndTime(setEndIso) : null
  if (sSet && eSet) {
    patch.set_start_time = sSet.time
    patch.set_end_time = eSet.time
    const overnightSet =
      eSet.date !== sSet.date ||
      (eSet.time <= sSet.time && eSet.date === sSet.date)
    patch.overnight_set = overnightSet
  }

  return patch
}

/** Patches linked booking intake show JSON when the canonical deal times change after import. */
export async function reverseSyncDealTimesToIntakeShow(deal: Deal): Promise<void> {
  const patch = wallClockPatchFromDealInstants(deal)
  if (!patch) return

  const { data: rows, error } = await supabase
    .from('booking_intake_shows')
    .select('id, show_data')
    .eq('imported_deal_id', deal.id)

  if (error || !rows?.length) return

  for (const row of rows) {
    const sd = row.show_data
    if (!isIntakeShowV3(sd)) continue
    const merged = { ...sd, ...patch }
    const { error: upErr } = await supabase
      .from('booking_intake_shows')
      .update({ show_data: merged })
      .eq('id', row.id as string)
    if (upErr) {
      console.warn('[reverseSyncDealTimesToIntakeShow]', upErr.message)
    }
  }
}
