import { supabase } from '@/lib/supabase'
import type { Deal, DealTerms, Venue } from '@/types'
import { addCalendarDaysPacific, pacificWallToUtcIso } from '@/lib/calendar/pacificWallTime'

/** Match Earnings empty-form defaults for pipeline deals that never got wall-clock instants. */
const DEFAULT_START = '20:00'
const DEFAULT_END = '23:00'

/**
 * If the deal is missing `event_start_at` / `event_end_at` but a show date exists on the deal
 * or on the linked venue's `deal_terms`, fill Pacific wall times (default 8–11 PM) as UTC instants.
 * Idempotent when instants already set.
 */
export async function backfillDealShowInstantsIfNeeded(dealId: string): Promise<boolean> {
  const { data: dealRow, error: dErr } = await supabase
    .from('deals')
    .select('id, venue_id, event_date, event_start_at, event_end_at')
    .eq('id', dealId)
    .maybeSingle()
  if (dErr || !dealRow) return false

  const deal = dealRow as Pick<Deal, 'id' | 'venue_id' | 'event_date' | 'event_start_at' | 'event_end_at'>
  if (deal.event_start_at && deal.event_end_at) return false

  let ymd = (deal.event_date ?? '').trim()
  if (!ymd && deal.venue_id) {
    const { data: vRow } = await supabase
      .from('venues')
      .select('deal_terms')
      .eq('id', deal.venue_id)
      .maybeSingle()
    const dt = (vRow as Pick<Venue, 'deal_terms'> | null)?.deal_terms as DealTerms | null | undefined
    ymd = (dt?.event_date ?? '').trim()
  }
  if (!ymd) return false

  const showDate = ymd.slice(0, 10)
  const st = DEFAULT_START
  const et = DEFAULT_END
  const [sh, sm] = st.split(':').map(Number)
  const [eh, em] = et.split(':').map(Number)
  let endYmd = showDate
  if (Number.isFinite(sh) && Number.isFinite(sm) && Number.isFinite(eh) && Number.isFinite(em)) {
    if (eh * 60 + em <= sh * 60 + sm) endYmd = addCalendarDaysPacific(showDate, 1)
  }
  const sIso = pacificWallToUtcIso(showDate, st)
  const eIso = pacificWallToUtcIso(endYmd, et)
  if (!sIso || !eIso) return false

  const { error: upErr } = await supabase
    .from('deals')
    .update({
      event_date: showDate,
      event_start_at: sIso,
      event_end_at: eIso,
    })
    .eq('id', dealId)
  return !upErr
}
