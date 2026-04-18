import type { Deal } from '@/types'
import { COMMISSION_TIER_RATES } from '@/types'

/** Canonical commission rate for the deal's tier (single source of truth for display and agreements). */
export function dealCommissionRateFromTier(deal: Pick<Deal, 'commission_tier'>): number {
  return COMMISSION_TIER_RATES[deal.commission_tier]
}
