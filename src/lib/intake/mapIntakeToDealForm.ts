import type { CommissionTier } from '@/types'
import type { PricingCatalogDoc } from '@/types'
import {
  catalogHasMinimumForDealLogging,
  computeDealPrice,
  pickDefaultServiceId,
} from '@/lib/pricing/computeDealPrice'
import type { ShowIntakeBundle, ShowPricingDraft } from '@/lib/intake/intakePayload'
import { parseShowBundle } from '@/lib/intake/intakePayload'
import {
  CAPACITY_RANGE_OPTIONS,
  computeSetLengthHours,
  genresToPerformanceGenreString,
  knownEventTypeLabel,
  parseShowDataV3,
  PAYMENT_METHOD_LABELS,
  PERFORMANCE_ROLE_OPTIONS,
  promisePresetsFromVenueLinesV3,
  substantiveShowCaptureLines,
  substantiveVenueCaptureLines,
  type BookingIntakeVenueDataV3,
  type PaymentMethodKeyV3,
} from '@/lib/intake/intakePayloadV3'

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
function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

const EMPTY_PRICING_IMPORT: PricingStateImport = {
  pricingBaseMode: 'hourly',
  pricingPackageId: null,
  pricingServiceId: null,
  pricingOvertimeServiceId: null,
  pricingPerformanceHours: 4,
  pricingAddonQty: {},
  pricingSurchargeIds: [],
  pricingDiscountIds: [],
}

export function mapShowBundleToEarningsImport(
  rawShowData: unknown,
  catalog: PricingCatalogDoc,
  venueMeta: BookingIntakeVenueDataV3 | null = null,
): EarningsIntakeImportResult {
  if (isPlainObject(rawShowData) && rawShowData._v === 3) {
    const sd = parseShowDataV3(rawShowData, 0)
    const warnings: string[] = []
    const typePart = knownEventTypeLabel(sd.event_type, sd.event_type_other)
    const rolePart = PERFORMANCE_ROLE_OPTIONS.find(o => o.value === sd.performance_role)?.label ?? ''
    const descParts = [typePart, sd.event_date.trim() || undefined, rolePart || undefined].filter(Boolean)
    const baseDescription = descParts.join(' · ') || 'Booking intake'
    const eventTitle = sd.event_name_text.trim()
    const description = eventTitle ? `${eventTitle} · ${baseDescription}` : baseDescription
    const capLabel = CAPACITY_RANGE_OPTIONS.find(o => o.value === sd.capacity_range)?.label ?? ''
    const capExact = sd.exact_capacity_number.trim()
    const setHrs = computeSetLengthHours(
      sd.set_start_time,
      sd.set_end_time,
      sd.overnight_set,
    )
    const billableHoursFromSet =
      setHrs > 0 ? Math.max(1, Math.min(12, Math.round(setHrs * 2) / 2)) : EMPTY_PRICING_IMPORT.pricingPerformanceHours

    const baseMode = sd.pricing_mode === 'package' ? 'package' : 'hourly'
    const perfHrs =
      sd.performance_hours > 0 ? sd.performance_hours : billableHoursFromSet

    const draft: ShowPricingDraft = {
      baseMode,
      packageId: sd.package_id.trim() || null,
      serviceId: sd.service_id.trim() || null,
      overtimeServiceId: sd.overtime_service_id.trim() || sd.service_id.trim() || null,
      performanceHours: perfHrs,
      addonQuantities: { ...sd.addon_quantities },
      surchargeIds: [...sd.surcharge_ids],
      discountIds: [...sd.discount_ids],
    }
    let pricing = validatePricingAgainstCatalog(catalog, { ...draft }, warnings)

    if (!pricing.serviceId && catalogHasMinimumForDealLogging(catalog)) {
      const pick = pickDefaultServiceId(catalog, sd.event_date.trim() || null)
      if (pick) {
        pricing = { ...pricing, serviceId: pick, overtimeServiceId: pick }
      }
    }

    let grossFromCalculator: number | null = null
    if (catalogHasMinimumForDealLogging(catalog)) {
      try {
        const r = computeDealPrice({
          catalog,
          eventDate: sd.event_date.trim() || null,
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

    const useManual = sd.pricing_source === 'manual' && sd.manual_gross != null && Number.isFinite(sd.manual_gross)
    const totalForTerms = useManual ? Math.round(sd.manual_gross!) : (grossFromCalculator ?? 0)
    const depositDue =
      totalForTerms > 0 ? Math.round(totalForTerms * (sd.deposit_percent / 100)) : 0
    const balanceDue = totalForTerms > 0 ? Math.max(0, totalForTerms - depositDue) : 0

    const balanceTimingLabel =
      sd.balance_timing === 'before_event'
        ? 'Before event'
        : sd.balance_timing === 'day_of'
          ? 'Day of event'
          : sd.balance_timing === 'after_event'
            ? 'After event'
            : sd.balance_timing === 'custom'
              ? 'Custom date'
              : ''

    const payMethodLine =
      sd.payment_methods.length > 0
        ? `Payment methods: ${sd.payment_methods.map((k: PaymentMethodKeyV3) => PAYMENT_METHOD_LABELS[k]).join(', ')}`
        : ''

    const termsLines = [
      totalForTerms > 0
        ? `Deposit ${sd.deposit_percent}% (~$${depositDue}); balance ~$${balanceDue}${balanceTimingLabel ? ` · ${balanceTimingLabel}` : ''}`
        : '',
      sd.balance_timing === 'custom' && sd.balance_due_date.trim()
        ? `Balance due date (discussed): ${sd.balance_due_date.trim()}`
        : '',
      payMethodLine,
    ].filter(Boolean)

    const grossStr = useManual
      ? String(Math.round(sd.manual_gross!))
      : grossFromCalculator != null
        ? String(grossFromCalculator)
        : ''

    const depositPaid =
      venueMeta?.deposit_on_call === 'paying_now' && depositDue > 0 ? String(depositDue) : ''

    const fromVenue = venueMeta
      ? [
          ...substantiveVenueCaptureLines(venueMeta),
          venueMeta.post_call_notes.trim(),
          venueMeta.future_intel.trim() ? `Intel: ${venueMeta.future_intel.trim()}` : '',
          venueMeta.red_flags.trim() ? `Concerns: ${venueMeta.red_flags.trim()}` : '',
        ].filter(Boolean)
      : []
    const showCaptureLines = [
      ...substantiveShowCaptureLines(sd),
      sd.music_requests_text.trim() ? `Music requests: ${sd.music_requests_text.trim()}` : '',
      sd.custom_setlist_notes.trim() ? `Setlist / custom requests: ${sd.custom_setlist_notes.trim()}` : '',
      sd.equipment_details_text.trim() ? `Equipment: ${sd.equipment_details_text.trim()}` : '',
      sd.parking_details_text.trim() ? `Parking: ${sd.parking_details_text.trim()}` : '',
      sd.travel_notes_text.trim() ? `Travel / lodging notes: ${sd.travel_notes_text.trim()}` : '',
    ].filter(Boolean)
    const notesBody = [termsLines.join('\n'), ...fromVenue, ...showCaptureLines].filter(Boolean).join('\n\n')

    const form: DealFormImportShape = {
      ...EMPTY_IMPORT_FORM,
      commission_tier: venueMeta?.commission_tier ?? EMPTY_IMPORT_FORM.commission_tier,
      description,
      event_date: sd.event_date.trim(),
      event_start_time: sd.event_start_time.trim() || EMPTY_IMPORT_FORM.event_start_time,
      event_end_time: sd.event_end_time.trim() || EMPTY_IMPORT_FORM.event_end_time,
      gross_amount: grossStr,
      payment_due_date: sd.balance_timing === 'custom' ? sd.balance_due_date.trim() : '',
      performance_genre: genresToPerformanceGenreString(sd.genres),
      performance_start_time: sd.set_start_time.trim(),
      performance_end_time: sd.set_end_time.trim(),
      venue_capacity: capExact || capLabel,
      deposit_paid_amount: depositPaid,
      notes: notesBody,
    }

    if (!sd.event_date.trim()) warnings.push('Add an event date on the intake before importing.')
    if (!sd.set_start_time.trim() || !sd.set_end_time.trim()) {
      warnings.push('Set performance start/end times on the intake for accurate deal timing.')
    }
    if (!catalogHasMinimumForDealLogging(catalog)) {
      warnings.push('Add packages or hourly rates to your pricing catalog for calculator import.')
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
      promisePresets: promisePresetsFromVenueLinesV3(sd.promise_lines_v3),
      warnings,
      grossFromCalculator: useManual ? null : grossFromCalculator,
    }
  }

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
