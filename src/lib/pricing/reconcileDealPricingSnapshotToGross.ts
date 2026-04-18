import type { Deal, DealPricingFinalSource, DealPricingSnapshot } from '@/types'
import { isDealPricingSnapshot } from '@/types'
import type { PricingCatalogDoc } from '@/types'
import {
  computeDealPrice,
  computeDealPriceInputFromSnapshot,
} from '@/lib/pricing/computeDealPrice'
import {
  normalizeDealPricingSnapshot,
  resolveDepositPercentForDealFromCatalog,
} from '@/lib/pricing/normalizeDealPricingSnapshot'

/** After gross changes (e.g. performance report reconciliation), re-align snapshot + deposit due. */
export function reconcileDealPricingSnapshotToGross(
  deal: Deal,
  newGross: number,
  catalog: PricingCatalogDoc,
): DealPricingSnapshot | null {
  if (!deal.pricing_snapshot || !isDealPricingSnapshot(deal.pricing_snapshot)) return null
  const input = computeDealPriceInputFromSnapshot(deal, catalog)
  if (!input) return null
  const pricingComputed = computeDealPrice(input)
  const rounded = Math.round(newGross)
  const finalSource: DealPricingFinalSource =
    pricingComputed.gross === rounded ? 'calculated' : 'manual'
  const depPct = resolveDepositPercentForDealFromCatalog(deal, catalog)
  return normalizeDealPricingSnapshot({
    contractGross: newGross,
    finalSource,
    calculatorSnapshot: pricingComputed.snapshot,
    depositPercent: depPct,
  })
}
