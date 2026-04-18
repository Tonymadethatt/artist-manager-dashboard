import type { Deal, DealPricingSnapshot, PricingCatalogDoc, PricingService } from '../../types'
import { isDealPricingSnapshot } from '../../types'
import {
  computeDealPriceBreakdown,
  computeDealPriceInputFromSnapshot,
  roundUsd,
} from '../pricing/computeDealPrice'
import { formatUsdDisplayCeil } from '../format/displayCurrency'

function fmtHours(n: number): string {
  if (!Number.isFinite(n) || n < 0) return ''
  const r = Math.round(n * 100) / 100
  if (r === 0) return '0'
  if (Number.isInteger(r)) return String(r)
  return String(r)
}

function formatServiceRate(svc: PricingService): string {
  if (svc.priceType === 'per_hour') return `${formatUsdDisplayCeil(svc.price)}/hour`
  return `${formatUsdDisplayCeil(svc.price)} (flat fee)`
}

/**
 * Hourly row used for “additional / extended” performance time: package overtime service,
 * or the primary service when the quote is hourly.
 */
function resolveAdditionalHourService(
  snapshot: DealPricingSnapshot,
  catalog: PricingCatalogDoc,
): PricingService | null {
  if (snapshot.baseMode === 'package') {
    const id = snapshot.overtimeServiceId || snapshot.serviceId
    if (!id) return null
    const svc = catalog.services.find(s => s.id === id) ?? null
    if (svc?.priceType === 'per_hour') return svc
    return null
  }
  if (snapshot.baseMode === 'hourly' && snapshot.serviceId) {
    const svc = catalog.services.find(s => s.id === snapshot.serviceId) ?? null
    if (svc?.priceType === 'per_hour') return svc
  }
  return null
}

const ENGAGEMENT_SCOPE =
  'The fee for this engagement reflects a complete professional performance commitment — not clock time alone. It includes advance programming and music preparation, coordination with your production and load-in schedule, professional equipment and presentation standards, and a performance tailored to your venue, program, and audience.'

const ADDITIONAL_TIME_LEAD_IN =
  'If the Artist continues beyond the booked performance window, additional time may be offered subject to schedule, site approval, and Artist availability.'

const FEE_LABEL_SCOPE = 'Performance & agreed scope'
const FEE_LABEL_BUNDLE = 'Production, scheduling & compliance'
const FEE_LABEL_TOTAL = 'Contract total'

const PRICING_FEE_DRIFT_NOTE =
  'Contract total reflects the agreed fee on this deal; line items reflect the saved quote structure.'

function appendFeeTransparencyNoSnapshot(deal: Deal, out: Record<string, string>): void {
  const gross = roundUsd(Number(deal.gross_amount))
  out.pricing_fee_total_display = formatUsdDisplayCeil(gross)
  out.pricing_fee_scope_amount_display = ''
  out.pricing_fee_operations_bundle_amount_display = ''
  out.pricing_fee_transparency_plain = `Contract total: ${formatUsdDisplayCeil(gross)}`
  out.pricing_fee_transparency_table_html =
    `<table class="fee-transparency"><tbody><tr><th scope="row">${FEE_LABEL_TOTAL}</th><td>${formatUsdDisplayCeil(gross)}</td></tr></tbody></table>`
  out.pricing_fee_breakdown_note = ''
}

function appendFeeTransparencyFromSnapshot(
  deal: Deal,
  catalog: PricingCatalogDoc | null,
  snapshot: DealPricingSnapshot,
  out: Record<string, string>,
): void {
  const gross = roundUsd(Number(deal.gross_amount))
  out.pricing_fee_total_display = formatUsdDisplayCeil(gross)

  if (!catalog) {
    out.pricing_fee_scope_amount_display = ''
    out.pricing_fee_operations_bundle_amount_display = ''
    out.pricing_fee_transparency_plain = `Contract total: ${formatUsdDisplayCeil(gross)}`
    out.pricing_fee_transparency_table_html =
      `<table class="fee-transparency"><tbody><tr><th scope="row">${FEE_LABEL_TOTAL}</th><td>${formatUsdDisplayCeil(gross)}</td></tr></tbody></table>`
    out.pricing_fee_breakdown_note =
      Math.abs(gross - snapshot.total) >= 1 ? PRICING_FEE_DRIFT_NOTE : ''
    return
  }

  const input = computeDealPriceInputFromSnapshot(deal, catalog)
  if (!input) {
    out.pricing_fee_scope_amount_display = ''
    out.pricing_fee_operations_bundle_amount_display = ''
    out.pricing_fee_transparency_plain = `Contract total: ${formatUsdDisplayCeil(gross)}`
    out.pricing_fee_transparency_table_html =
      `<table class="fee-transparency"><tbody><tr><th scope="row">${FEE_LABEL_TOTAL}</th><td>${formatUsdDisplayCeil(gross)}</td></tr></tbody></table>`
    out.pricing_fee_breakdown_note =
      Math.abs(gross - snapshot.total) >= 1 ? PRICING_FEE_DRIFT_NOTE : ''
    return
  }

  const b = computeDealPriceBreakdown(input)
  const afterAddons = b.afterAddons
  const bundle = gross - afterAddons

  out.pricing_fee_scope_amount_display = formatUsdDisplayCeil(afterAddons)
  out.pricing_fee_operations_bundle_amount_display =
    Math.abs(bundle) >= 1 ? formatUsdDisplayCeil(bundle) : ''

  const rows: { label: string; amount: string }[] = [
    { label: FEE_LABEL_SCOPE, amount: formatUsdDisplayCeil(afterAddons) },
  ]
  if (Math.abs(bundle) >= 1) {
    rows.push({ label: FEE_LABEL_BUNDLE, amount: formatUsdDisplayCeil(bundle) })
  }
  rows.push({ label: FEE_LABEL_TOTAL, amount: formatUsdDisplayCeil(gross) })

  out.pricing_fee_transparency_plain = rows.map(r => `${r.label}: ${r.amount}`).join('\n')

  const trs = rows
    .map(r => `<tr><th scope="row">${r.label}</th><td>${r.amount}</td></tr>`)
    .join('')
  out.pricing_fee_transparency_table_html = `<table class="fee-transparency"><tbody>${trs}</tbody></table>`

  out.pricing_fee_breakdown_note =
    Math.abs(gross - snapshot.total) >= 1 ? PRICING_FEE_DRIFT_NOTE : ''
}

/** Merge fields for agreements: what the client is buying, reference rates, and extended-time language. */
export function buildPricingAgreementTransparency(
  deal: Deal,
  catalog: PricingCatalogDoc | null,
): Record<string, string> {
  const out: Record<string, string> = {}

  const genericAdditional = `${ADDITIONAL_TIME_LEAD_IN} Fees for extended performance time will be confirmed in writing before additional time is performed.`

  if (!deal.pricing_snapshot || !isDealPricingSnapshot(deal.pricing_snapshot)) {
    out.pricing_engagement_scope_paragraph = ENGAGEMENT_SCOPE
    out.pricing_additional_time_paragraph = genericAdditional
    out.pricing_client_facing_fee_paragraph = [ENGAGEMENT_SCOPE, genericAdditional].join('\n\n')
    out.pricing_discounts_line = ''
    appendFeeTransparencyNoSnapshot(deal, out)
    return out
  }

  const s = deal.pricing_snapshot
  const minH = catalog?.policies.minimumBillableHours ?? 0
  const rawH = Number.isFinite(s.performanceHours) ? s.performanceHours : 0
  const billableH = Math.max(rawH, minH)

  out.pricing_booked_hours_display = fmtHours(rawH)
  out.pricing_billable_hours_display = fmtHours(billableH)
  out.pricing_minimum_billable_hours_display = minH > 0 ? fmtHours(minH) : ''

  if (minH > 0 && rawH < minH) {
    out.pricing_minimum_hours_note = `Minimum billable time for this engagement is ${fmtHours(minH)} hours; the contract fee reflects that minimum.`
  } else {
    out.pricing_minimum_hours_note = ''
  }

  out.pricing_fee_basis_note =
    s.finalSource === 'manual'
      ? 'The contract total reflects the fee agreed for this engagement and scope.'
      : 'The contract total reflects the booked scope and applicable options from the event quote.'

  let additionalSvc: PricingService | null = null
  if (catalog) additionalSvc = resolveAdditionalHourService(s, catalog)

  if (additionalSvc) {
    out.pricing_overtime_rate_display = formatServiceRate(additionalSvc)
    out.pricing_reference_hourly_display = formatServiceRate(additionalSvc)
  }

  if (catalog) {
    if (s.baseMode === 'package' && s.packageId) {
      const pkg = catalog.packages.find(p => p.id === s.packageId)
      if (pkg) {
        out.pricing_package_name = pkg.name
        out.pricing_package_hours_included = fmtHours(pkg.hoursIncluded)
        out.pricing_package_price_display = formatUsdDisplayCeil(pkg.price)
        if (additionalSvc?.priceType === 'per_hour') {
          out.pricing_base_structure_line =
            `${pkg.name} (${formatUsdDisplayCeil(pkg.price)}) includes up to ${fmtHours(pkg.hoursIncluded)} hour${pkg.hoursIncluded === 1 ? '' : 's'} of performance; ` +
            `additional performance time, when agreed, is billed at ${formatServiceRate(additionalSvc)}.`
        } else {
          out.pricing_base_structure_line =
            `${pkg.name} (${formatUsdDisplayCeil(pkg.price)}) includes up to ${fmtHours(pkg.hoursIncluded)} hour${pkg.hoursIncluded === 1 ? '' : 's'} of performance.`
        }
      } else {
        out.pricing_base_structure_line = 'Package-based engagement (see contract total).'
      }
    } else if (s.baseMode === 'hourly' && s.serviceId) {
      const svc = catalog.services.find(x => x.id === s.serviceId) ?? null
      if (svc) {
        out.pricing_primary_service_name = svc.name
        out.pricing_primary_rate_display = formatServiceRate(svc)
        if (svc.priceType === 'per_hour') {
          out.pricing_reference_hourly_display = formatServiceRate(svc)
          out.pricing_base_structure_line =
            `${svc.name}: ${formatServiceRate(svc)} × ${fmtHours(billableH)} billable hour${billableH === 1 ? '' : 's'}.`
        } else {
          out.pricing_base_structure_line = `${svc.name}: ${formatServiceRate(svc)} for this engagement.`
        }
      } else {
        out.pricing_base_structure_line = 'Hourly-based engagement (see contract total).'
      }
    }
  } else {
    if (s.finalSource !== 'manual') {
      out.pricing_base_structure_line =
        s.baseMode === 'package'
          ? 'Package-based engagement — load your pricing catalog in File Builder to print line-item detail.'
          : 'Hourly-based engagement — load your pricing catalog in File Builder to print line-item detail.'
    }
  }

  const inclusionParts: string[] = []
  if (catalog && s.addonQuantities) {
    for (const [id, q] of Object.entries(s.addonQuantities)) {
      const n = Number(q)
      if (!Number.isFinite(n) || n <= 0) continue
      const a = catalog.addons.find(x => x.id === id)
      if (a) inclusionParts.push(n === 1 ? a.name : `${a.name} × ${n}`)
    }
  }
  if (catalog && s.surchargeIds?.length) {
    for (const sid of s.surchargeIds) {
      const su = catalog.surcharges.find(x => x.id === sid)
      if (su) inclusionParts.push(su.name)
    }
  }
  out.pricing_addons_line = inclusionParts.length ? inclusionParts.join('; ') : ''

  if (catalog && s.discountIds?.length) {
    const discLabels = s.discountIds
      .map(id => catalog.discounts.find(d => d.id === id)?.name)
      .filter(Boolean) as string[]
    out.pricing_discounts_line = discLabels.length ? discLabels.join('; ') : ''
  } else {
    out.pricing_discounts_line = ''
  }

  out.pricing_engagement_scope_paragraph = ENGAGEMENT_SCOPE

  if (additionalSvc?.priceType === 'per_hour') {
    out.pricing_additional_time_paragraph =
      `${ADDITIONAL_TIME_LEAD_IN} When extended time is mutually agreed, additional performance is billed at ${formatServiceRate(additionalSvc)}, prorated, from the agreed extension until performance concludes.`
  } else {
    out.pricing_additional_time_paragraph = genericAdditional
  }

  const comboParts = [
    out.pricing_engagement_scope_paragraph,
    out.pricing_base_structure_line,
    out.pricing_addons_line ? `Also included in this quote: ${out.pricing_addons_line}.` : '',
    out.pricing_discounts_line ? `Adjustments: ${out.pricing_discounts_line}.` : '',
    out.pricing_minimum_hours_note,
    out.pricing_fee_basis_note,
    out.pricing_additional_time_paragraph,
  ].filter(Boolean)

  out.pricing_client_facing_fee_paragraph = comboParts.join('\n\n')

  appendFeeTransparencyFromSnapshot(deal, catalog, s, out)

  return out
}
