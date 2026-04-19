import type { Deal } from '@/types'
import {
  computeClientAmountDueNow,
  dealRemainingClientBalance,
  dealTotalPaidTowardGross,
} from '@/lib/deals/dealPaymentTotals'
import type { VenueRenderDeal } from '@/lib/email/renderVenueEmail'

type DealFields = Pick<
  Deal,
  | 'description'
  | 'gross_amount'
  | 'event_date'
  | 'payment_due_date'
  | 'agreement_url'
  | 'notes'
> &
  Partial<Pick<Deal, 'deposit_paid_amount' | 'balance_paid_amount' | 'deposit_due_amount' | 'pricing_snapshot'>>

function hasPaymentShape(d: DealFields): boolean {
  return (
    d.deposit_paid_amount !== undefined ||
    d.balance_paid_amount !== undefined ||
    d.deposit_due_amount != null ||
    d.pricing_snapshot != null
  )
}

/** Build render deal payload; adds amount fields when payment columns/snapshot are present on the deal row. */
export function venueRenderDealFromDealFields(deal: DealFields): VenueRenderDeal {
  const base: VenueRenderDeal = {
    description: deal.description,
    gross_amount: Number(deal.gross_amount ?? 0),
    event_date: deal.event_date ?? null,
    payment_due_date: deal.payment_due_date ?? null,
    agreement_url: deal.agreement_url ?? null,
    notes: deal.notes ?? null,
  }
  if (!hasPaymentShape(deal)) return base
  const asDeal = deal as Deal
  return {
    ...base,
    amount_due_now: computeClientAmountDueNow(asDeal),
    total_paid_toward_gross: dealTotalPaidTowardGross(asDeal),
    remaining_client_balance: dealRemainingClientBalance(asDeal),
  }
}
