import type { DealPricingFinalSource, DealPricingSnapshot } from '@/types'
import type { PricingCatalogDoc } from '@/types'
import { roundUsd } from '@/lib/pricing/computeDealPrice'

export function resolveDepositPercentForDeal(args: {
  intakeDepositPercent?: number | null
  previousSnapshot: DealPricingSnapshot | null
  catalogDefaultDepositPercent: number
}): number {
  if (args.intakeDepositPercent != null && Number.isFinite(args.intakeDepositPercent)) {
    return Math.min(100, Math.max(0, args.intakeDepositPercent))
  }
  const prev = args.previousSnapshot?.depositPercentApplied
  if (prev != null && Number.isFinite(prev)) {
    return Math.min(100, Math.max(0, prev))
  }
  return Math.min(100, Math.max(0, args.catalogDefaultDepositPercent))
}

export function resolveDepositPercentForDealFromCatalog(
  deal: { pricing_snapshot?: unknown | null },
  catalog: PricingCatalogDoc,
): number {
  const prev =
    deal.pricing_snapshot &&
    typeof deal.pricing_snapshot === 'object' &&
    (deal.pricing_snapshot as DealPricingSnapshot).v === 1
      ? (deal.pricing_snapshot as DealPricingSnapshot)
      : null
  return resolveDepositPercentForDeal({
    intakeDepositPercent: null,
    previousSnapshot: prev,
    catalogDefaultDepositPercent: catalog.policies.defaultDepositPercent,
  })
}

/**
 * Aligns persisted calculator snapshot with authoritative contract gross and deposit %.
 * Manual gross: snapshot totals match contract; line-item fields kept for transparency drift via `lastCalculatedTotal`.
 */
export function normalizeDealPricingSnapshot(args: {
  contractGross: number
  finalSource: DealPricingFinalSource
  calculatorSnapshot: Omit<DealPricingSnapshot, 'finalSource' | 'computedAt'>
  depositPercent: number
}): DealPricingSnapshot {
  const depPct = Math.min(100, Math.max(0, args.depositPercent))
  const computedAt = new Date().toISOString()
  const lastCalc =
    args.calculatorSnapshot.lastCalculatedTotal ?? args.calculatorSnapshot.total

  if (args.finalSource === 'calculated') {
    const total = roundUsd(args.calculatorSnapshot.total)
    const depositDue = total > 0 ? roundUsd(total * (depPct / 100)) : 0
    return {
      ...args.calculatorSnapshot,
      total,
      depositDue,
      lastCalculatedTotal: lastCalc,
      finalSource: 'calculated',
      computedAt,
      depositPercentApplied: depPct,
    }
  }

  const gross = roundUsd(args.contractGross)
  const depositDue = gross > 0 ? roundUsd(gross * (depPct / 100)) : 0

  return {
    ...args.calculatorSnapshot,
    subtotalBeforeTax: gross,
    taxAmount: 0,
    total: gross,
    depositDue,
    lastCalculatedTotal: lastCalc,
    finalSource: 'manual',
    computedAt,
    depositPercentApplied: depPct,
  }
}
