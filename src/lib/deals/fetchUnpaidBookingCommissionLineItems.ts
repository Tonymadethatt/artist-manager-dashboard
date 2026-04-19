import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deal } from '../../types'
import type { BookingCommissionLineItem } from '../email/bookingCommissionReminderShared'
import { dealCommissionRateFromTier } from './dealCommissionFromTier'

function eventDateToYmd(eventDate: string | null): string {
  if (!eventDate?.trim()) return 'TBD'
  const s = eventDate.trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (m) return m[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10)
  return 'TBD'
}

type DealRow = Pick<
  Deal,
  'description' | 'gross_amount' | 'commission_amount' | 'commission_tier' | 'commission_rate' | 'event_date'
> & {
  /** PostgREST may return one object or a single-element array depending on typings. */
  venue: { name: string | null } | { name: string | null }[] | null
}

function venueNameFromRow(row: DealRow): string | null {
  const v = row.venue
  if (!v) return null
  const one = Array.isArray(v) ? v[0] : v
  return one?.name?.trim() ? String(one.name).trim() : null
}

/**
 * Deals where manager commission is still owed (matches Earnings “Record manager commission received”).
 */
export async function fetchUnpaidBookingCommissionLineItems(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ lineItems: BookingCommissionLineItem[]; error?: string }> {
  const { data, error } = await supabase
    .from('deals')
    .select(
      'description, gross_amount, commission_amount, commission_tier, commission_rate, event_date, manager_paid, venue:venues(name)',
    )
    .eq('user_id', userId)
    .eq('manager_paid', false)
    .gt('commission_amount', 0)
    .order('event_date', { ascending: true, nullsFirst: false })

  if (error) {
    console.error('[fetchUnpaidBookingCommissionLineItems]', error.message)
    return { lineItems: [], error: 'Could not load deals for this account.' }
  }

  const rows = (data ?? []) as unknown as DealRow[]
  const lineItems: BookingCommissionLineItem[] = rows.map((row) => {
    const venueName = venueNameFromRow(row) || row.description?.trim() || 'Show'
    const dealPick: Pick<Deal, 'commission_tier'> & Partial<Pick<Deal, 'commission_rate'>> = {
      commission_tier: row.commission_tier,
      commission_rate: row.commission_rate,
    }
    return {
      venueName,
      eventDateYmd: eventDateToYmd(row.event_date),
      gigGross: Number(row.gross_amount ?? 0),
      commissionRatePercent: Math.round(dealCommissionRateFromTier(dealPick) * 100),
      commissionAmount: Number(row.commission_amount ?? 0),
    }
  })

  return { lineItems }
}
