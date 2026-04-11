import type {
  DealPricingSnapshot,
  PricingCatalogDoc,
  PricingService,
} from '@/types'

/** Whole-dollar rounding for quotes (discovery). */
export function roundUsd(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.round(n)
}

/** Fri–Sun (Pacific-agnostic: use UTC weekday from ISO date string YYYY-MM-DD). */
export function isWeekendDate(isoDate: string | null | undefined): boolean {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false
  const d = new Date(`${isoDate}T12:00:00Z`)
  const w = d.getUTCDay()
  return w === 0 || w === 5 || w === 6
}

export function pickDefaultServiceId(
  catalog: PricingCatalogDoc,
  eventDate: string | null | undefined
): string | null {
  const weekend = isWeekendDate(eventDate ?? undefined)
  const candidates = catalog.services.filter(s => {
    if (s.dayType === 'any') return true
    if (s.dayType === 'weekend') return weekend
    return !weekend
  })
  const hourly = candidates.filter(s => s.priceType === 'per_hour')
  if (hourly.length === 1) return hourly[0].id
  const any = catalog.services.find(s => s.dayType === 'any' && s.priceType === 'per_hour')
  return any?.id ?? hourly[0]?.id ?? catalog.services[0]?.id ?? null
}

export interface ComputeDealPriceInput {
  catalog: PricingCatalogDoc
  eventDate: string | null
  baseMode: 'package' | 'hourly'
  packageId: string | null
  serviceId: string | null
  overtimeServiceId: string | null
  performanceHours: number
  addonQuantities: Record<string, number>
  surchargeIds: string[]
  discountIds: string[]
}

export interface ComputeDealPriceResult {
  snapshot: Omit<DealPricingSnapshot, 'finalSource' | 'computedAt'>
  gross: number
}

function addonLineTotal(
  catalog: PricingCatalogDoc,
  addonId: string,
  qty: number
): number {
  const a = catalog.addons.find(x => x.id === addonId)
  if (!a || qty <= 0) return 0
  return roundUsd(a.price * qty)
}

function baseSubtotal(
  catalog: PricingCatalogDoc,
  input: ComputeDealPriceInput,
  billableHours: number
): { sub: number; pkg: typeof catalog.packages[0] | null; svc: PricingService | null } {
  if (input.baseMode === 'package' && input.packageId) {
    const pkg = catalog.packages.find(p => p.id === input.packageId) ?? null
    if (!pkg) return { sub: 0, pkg: null, svc: null }
    let sub = pkg.price
    const extra = Math.max(0, billableHours - pkg.hoursIncluded)
    if (extra > 0) {
      const otId = input.overtimeServiceId || input.serviceId
      const svc = catalog.services.find(s => s.id === otId) ?? null
      if (svc && svc.priceType === 'per_hour') {
        sub += svc.price * extra
      }
    }
    return { sub: roundUsd(sub), pkg, svc: null }
  }

  const svc = catalog.services.find(s => s.id === input.serviceId) ?? null
  if (!svc) return { sub: 0, pkg: null, svc: null }
  if (svc.priceType === 'flat_rate') {
    return { sub: roundUsd(svc.price), pkg: null, svc }
  }
  return { sub: roundUsd(svc.price * billableHours), pkg: null, svc }
}

/**
 * Order: base → add-ons → surcharges (multiplicative) → discounts (sequential %) → tax on pre-tax total.
 */
export function computeDealPrice(input: ComputeDealPriceInput): ComputeDealPriceResult {
  const policies = input.catalog.policies
  const rawHours = Number.isFinite(input.performanceHours) ? input.performanceHours : 0
  const billable = roundUsd(Math.max(rawHours, policies.minimumBillableHours))

  const { sub: afterBase } = baseSubtotal(input.catalog, input, billable)

  let afterAddons = afterBase
  for (const [addonId, q] of Object.entries(input.addonQuantities)) {
    afterAddons = roundUsd(afterAddons + addonLineTotal(input.catalog, addonId, q))
  }

  let afterSurcharges = afterAddons
  for (const sid of input.surchargeIds) {
    const s = input.catalog.surcharges.find(x => x.id === sid)
    if (s && s.multiplier > 0) {
      afterSurcharges = roundUsd(afterSurcharges * s.multiplier)
    }
  }

  let afterDiscounts = afterSurcharges
  for (const did of input.discountIds) {
    const d = input.catalog.discounts.find(x => x.id === did)
    if (d && d.percent > 0 && d.percent < 100) {
      afterDiscounts = roundUsd(afterDiscounts * (1 - d.percent / 100))
    }
  }

  const taxPct = Math.max(0, policies.salesTaxPercent)
  const taxAmount = roundUsd(afterDiscounts * (taxPct / 100))
  const total = roundUsd(afterDiscounts + taxAmount)

  const depPct = Math.max(0, policies.defaultDepositPercent)
  const depositDue = roundUsd(total * (depPct / 100))

  const snapshot: Omit<DealPricingSnapshot, 'finalSource' | 'computedAt'> = {
    v: 1,
    subtotalBeforeTax: afterDiscounts,
    taxAmount,
    total,
    depositDue,
    baseMode: input.baseMode,
    packageId: input.packageId,
    serviceId: input.serviceId,
    overtimeServiceId: input.overtimeServiceId,
    performanceHours: rawHours,
    addonQuantities: { ...input.addonQuantities },
    surchargeIds: [...input.surchargeIds],
    discountIds: [...input.discountIds],
    lastCalculatedTotal: total,
  }

  return { snapshot, gross: total }
}

export function catalogHasMinimumForDealLogging(catalog: PricingCatalogDoc): boolean {
  return catalog.packages.length > 0 || catalog.services.length > 0
}
