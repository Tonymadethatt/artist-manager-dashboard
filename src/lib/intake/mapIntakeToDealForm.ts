import type { CommissionTier } from '@/types'
import type { PricingCatalogDoc } from '@/types'
import {
  catalogHasMinimumForDealLogging,
  computeDealPrice,
  pickDefaultServiceId,
} from '@/lib/pricing/computeDealPrice'
import type { ShowIntakeBundle } from '@/lib/intake/intakePayload'
import { parseShowBundle } from '@/lib/intake/intakePayload'

/** Mirrors Earnings deal dialog `form` state (string-backed fields). */
export type DealFormImportShape = {
  description: string
  venue_id: string
  event_date: string
  event_start_time: string
  event_end_time: string
  gross_amount: string
  commission_tier: CommissionTier
  payment_due_date: string
  agreement_url: string
  agreement_generated_file_id: string
  deposit_paid_amount: string
  notes: string
  performance_genre: string
  performance_start_time: string
  performance_end_time: string
  onsite_contact_id: string
  venue_capacity: string
}

export type PricingStateImport = {
  pricingBaseMode: 'package' | 'hourly'
  pricingPackageId: string | null
  pricingServiceId: string | null
  pricingOvertimeServiceId: string | null
  pricingPerformanceHours: number
  pricingAddonQty: Record<string, number>
  pricingSurchargeIds: string[]
  pricingDiscountIds: string[]
}

export type EarningsIntakeImportResult = {
  form: DealFormImportShape
  pricing: PricingStateImport
  promisePresets: Record<string, boolean>
  warnings: string[]
  grossFromCalculator: number | null
}

const EMPTY_IMPORT_FORM: DealFormImportShape = {
  description: '',
  venue_id: '',
  event_date: '',
  event_start_time: '20:00',
  event_end_time: '23:00',
  gross_amount: '',
  commission_tier: 'new_doors',
  payment_due_date: '',
  agreement_url: '',
  agreement_generated_file_id: '',
  deposit_paid_amount: '',
  notes: '',
  performance_genre: '',
  performance_start_time: '',
  performance_end_time: '',
  onsite_contact_id: '',
  venue_capacity: '',
}

function validatePricingAgainstCatalog(
  catalog: PricingCatalogDoc,
  p: ShowIntakeBundle['fields']['pricing'],
  warnings: string[],
): ShowIntakeBundle['fields']['pricing'] {
  const out = { ...p }
  if (out.packageId && !catalog.packages.some(x => x.id === out.packageId)) {
    warnings.push('Saved package is no longer in your catalog — pick a current package.')
    out.packageId = catalog.packages[0]?.id ?? null
  }
  if (out.serviceId && !catalog.services.some(x => x.id === out.serviceId)) {
    warnings.push('Saved hourly service is no longer in your catalog — pick a current rate.')
    out.serviceId = null
  }
  if (out.overtimeServiceId && !catalog.services.some(x => x.id === out.overtimeServiceId)) {
    out.overtimeServiceId = out.serviceId
  }
  const nextAddon: Record<string, number> = {}
  for (const [id, qty] of Object.entries(out.addonQuantities ?? {})) {
    if (catalog.addons.some(a => a.id === id) && qty > 0) nextAddon[id] = qty
    else if (qty > 0) warnings.push(`Removed unknown add-on id from intake: ${id}`)
  }
  out.addonQuantities = nextAddon
  out.surchargeIds = (out.surchargeIds ?? []).filter(id => {
    const ok = catalog.surcharges.some(s => s.id === id)
    if (!ok) warnings.push(`Removed unknown surcharge from intake: ${id}`)
    return ok
  })
  out.discountIds = (out.discountIds ?? []).filter(id => {
    const ok = catalog.discounts.some(d => d.id === id)
    if (!ok) warnings.push(`Removed unknown discount from intake: ${id}`)
    return ok
  })
  return out
}

/**
 * Build Earnings dialog state from a persisted show draft + live catalog.
 * Caller should apply `form`, pricing setters, and promise presets; then re-run venue select if needed for community tier.
 */
export function mapShowBundleToEarningsImport(
  rawShowData: unknown,
  catalog: PricingCatalogDoc,
): EarningsIntakeImportResult {
  const bundle = parseShowBundle(rawShowData)
  const f = bundle.fields
  const warnings: string[] = []

  let pricing = validatePricingAgainstCatalog(catalog, { ...f.pricing }, warnings)

  if (!pricing.serviceId && catalogHasMinimumForDealLogging(catalog)) {
    const pick = pickDefaultServiceId(catalog, f.event_date.trim() || null)
    if (pick) {
      pricing = { ...pricing, serviceId: pick, overtimeServiceId: pick }
    }
  }

  let grossFromCalculator: number | null = null
  if (catalogHasMinimumForDealLogging(catalog)) {
    try {
      const r = computeDealPrice({
        catalog,
        eventDate: f.event_date.trim() || null,
        baseMode: pricing.baseMode,
        packageId: pricing.packageId,
        serviceId: pricing.serviceId,
        overtimeServiceId: pricing.overtimeServiceId,
        performanceHours: pricing.performanceHours,
        addonQuantities: pricing.addonQuantities,
        surchargeIds: pricing.surchargeIds,
        discountIds: pricing.discountIds,
      })
      grossFromCalculator = r.gross
    } catch {
      warnings.push('Could not run price calculator from intake — enter gross manually.')
    }
  }

  const freeBits = Object.entries(bundle.freeText)
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.trim()}`)
  const notes = [f.notes.trim(), ...freeBits].filter(Boolean).join('\n\n')

  const form: DealFormImportShape = {
    ...EMPTY_IMPORT_FORM,
    description: f.description.trim(),
    venue_id: '',
    event_date: f.event_date.trim(),
    event_start_time: f.event_start_time.trim() || EMPTY_IMPORT_FORM.event_start_time,
    event_end_time: f.event_end_time.trim() || EMPTY_IMPORT_FORM.event_end_time,
    gross_amount:
      grossFromCalculator != null
        ? String(grossFromCalculator)
        : f.gross_amount.trim(),
    commission_tier: f.commission_tier,
    payment_due_date: f.payment_due_date.trim(),
    notes,
    performance_genre: f.performance_genre.trim(),
    performance_start_time: f.performance_start_time.trim(),
    performance_end_time: f.performance_end_time.trim(),
    venue_capacity: f.venue_capacity.trim(),
  }

  const pricingState: PricingStateImport = {
    pricingBaseMode: pricing.baseMode,
    pricingPackageId: pricing.packageId,
    pricingServiceId: pricing.serviceId,
    pricingOvertimeServiceId: pricing.overtimeServiceId,
    pricingPerformanceHours: pricing.performanceHours,
    pricingAddonQty: { ...pricing.addonQuantities },
    pricingSurchargeIds: [...pricing.surchargeIds],
    pricingDiscountIds: [...pricing.discountIds],
  }

  return {
    form,
    pricing: pricingState,
    promisePresets: { ...f.promisePresets },
    warnings,
    grossFromCalculator,
  }
}
