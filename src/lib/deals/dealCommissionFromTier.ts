import type { Deal } from '../../types'
import { COMMISSION_TIER_RATES } from '../../types'

/**
 * Default fractional rate per tier (must match deal logging in Earnings):
 * New Doors 20%, Booked Doors (`kept_doors`) 20%, Bigger Doors 10%, Artist network 0%.
 */
export function commissionRateForTier(tier: Deal['commission_tier']): number {
  return COMMISSION_TIER_RATES[tier]
}

/**
 * Rate for display and agreement tokens: use persisted `commission_rate` when set, else tier default.
 * Normally these match after saves / DB migration; tier default stays the contract if a row is stale.
 */
export function dealCommissionRateFromTier(
  deal: Pick<Deal, 'commission_tier'> & Partial<Pick<Deal, 'commission_rate'>>,
): number {
  const persisted = deal.commission_rate
  if (typeof persisted === 'number' && Number.isFinite(persisted)) {
    return persisted
  }
  return commissionRateForTier(deal.commission_tier)
}
