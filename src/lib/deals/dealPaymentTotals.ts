import type { Deal } from '@/types'
import { isDealPricingSnapshot } from '@/types'

/** Sum of client payments recorded toward the contract (deposit + balance legs). */
export function dealTotalPaidTowardGross(
  deal: Pick<Deal, 'deposit_paid_amount' | 'balance_paid_amount'>,
): number {
  const dep = Number(deal.deposit_paid_amount ?? 0)
  const bal = Number(deal.balance_paid_amount ?? 0)
  if (!Number.isFinite(dep) || !Number.isFinite(bal)) return 0
  return Math.round((dep + bal) * 100) / 100
}

/** Remaining contract total owed by client (gross minus recorded payments). */
export function dealRemainingClientBalance(
  deal: Pick<Deal, 'gross_amount' | 'deposit_paid_amount' | 'balance_paid_amount'>,
): number {
  const g = Number(deal.gross_amount ?? 0)
  if (!Number.isFinite(g)) return 0
  return Math.max(0, Math.round((g - dealTotalPaidTowardGross(deal)) * 100) / 100)
}

/** Deposit due for UI: snapshot first, then deal column. */
export function depositDueFromDeal(deal: Deal): number {
  const snap = deal.pricing_snapshot
  if (isDealPricingSnapshot(snap) && Number.isFinite(snap.depositDue) && snap.depositDue > 0) {
    return Math.round(snap.depositDue * 100) / 100
  }
  const col = deal.deposit_due_amount
  if (col != null && Number.isFinite(col) && col > 0) return Math.round(Number(col) * 100) / 100
  return 0
}

/** True when recorded deposit meets or exceeds scheduled deposit due. */
export function dealDepositSatisfied(deal: Deal): boolean {
  const due = depositDueFromDeal(deal)
  if (due <= 0) return true
  const paid = Number(deal.deposit_paid_amount ?? 0)
  return Number.isFinite(paid) && paid + 1e-6 >= due
}
