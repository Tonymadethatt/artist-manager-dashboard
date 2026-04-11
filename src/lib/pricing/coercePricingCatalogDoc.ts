import { nanoid } from '@/lib/nanoid'
import type {
  PricingAddon,
  PricingAddonPriceType,
  PricingCatalogDoc,
  PricingDayType,
  PricingDiscount,
  PricingPackage,
  PricingPolicies,
  PricingService,
  PricingSurcharge,
} from '@/types'
import { emptyPricingCatalogDoc } from '@/types'

const SERVICE_PRICE_TYPES = new Set<PricingService['priceType']>(['per_hour', 'flat_rate'])
const DAY_TYPES = new Set<PricingDayType>(['weekday', 'weekend', 'any'])
const ADDON_PRICE_TYPES = new Set<PricingAddonPriceType>([
  'flat_fee',
  'per_event',
  'per_artist',
  'per_sq_ft',
  'per_effect',
  'per_setup',
])

export type ParseCatalogResult =
  | { ok: true; doc: PricingCatalogDoc }
  | { ok: false; message: string; details?: string[] }

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min
  return Math.min(max, Math.max(min, n))
}

function coerceNonNegInt(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(x) || x < 0) return fallback
  return Math.floor(x)
}

function coerceNumber(n: unknown, fallback: number): number {
  const x = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(x)) return fallback
  return x
}

function coerceString(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback
}

function coerceOptionalString(v: unknown): string | undefined {
  if (v == null) return undefined
  if (typeof v === 'string') return v || undefined
  return undefined
}

function coerceBullets(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map(x => (typeof x === 'string' ? x.trim() : String(x ?? '').trim()))
    .filter(Boolean)
}

function uniqueId(preferred: unknown, used: Set<string>): string {
  let id = typeof preferred === 'string' && preferred.trim() ? preferred.trim() : nanoid()
  if (used.has(id)) {
    id = nanoid()
    while (used.has(id)) id = nanoid()
  }
  used.add(id)
  return id
}

function coercePolicies(raw: unknown, defaults: PricingPolicies): PricingPolicies {
  if (!raw || typeof raw !== 'object') return { ...defaults }
  const p = raw as Record<string, unknown>
  return {
    defaultDepositPercent: clamp(coerceNumber(p.defaultDepositPercent, defaults.defaultDepositPercent), 0, 100),
    salesTaxPercent: clamp(coerceNumber(p.salesTaxPercent, defaults.salesTaxPercent), 0, 100),
    minimumBillableHours: Math.max(0, coerceNumber(p.minimumBillableHours, defaults.minimumBillableHours)),
  }
}

function coercePackages(raw: unknown): PricingPackage[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: PricingPackage[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    out.push({
      id: uniqueId(o.id, used),
      name: coerceString(o.name, `Package ${i + 1}`),
      price: Math.max(0, Math.round(coerceNumber(o.price, 0))),
      hoursIncluded: coerceNonNegInt(o.hoursIncluded, 0),
      bullets: coerceBullets(o.bullets),
    })
  }
  return out
}

function coerceServices(raw: unknown): PricingService[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: PricingService[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const pt = o.priceType
    const priceType = typeof pt === 'string' && SERVICE_PRICE_TYPES.has(pt as PricingService['priceType'])
      ? (pt as PricingService['priceType'])
      : 'per_hour'
    const dt = o.dayType
    const dayType = typeof dt === 'string' && DAY_TYPES.has(dt as PricingDayType) ? (dt as PricingDayType) : 'any'
    out.push({
      id: uniqueId(o.id, used),
      name: coerceString(o.name, `Service ${i + 1}`),
      category: coerceOptionalString(o.category),
      price: Math.max(0, Math.round(coerceNumber(o.price, 0))),
      priceType,
      dayType,
    })
  }
  return out
}

function coerceAddons(raw: unknown): PricingAddon[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: PricingAddon[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const pt = o.priceType
    const priceType =
      typeof pt === 'string' && ADDON_PRICE_TYPES.has(pt as PricingAddonPriceType)
        ? (pt as PricingAddonPriceType)
        : 'flat_fee'
    out.push({
      id: uniqueId(o.id, used),
      name: coerceString(o.name, `Add-on ${i + 1}`),
      category: coerceOptionalString(o.category),
      price: Math.max(0, Math.round(coerceNumber(o.price, 0))),
      priceType,
      unitLabel: coerceOptionalString(o.unitLabel),
    })
  }
  return out
}

function coerceDiscounts(raw: unknown): PricingDiscount[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: PricingDiscount[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    out.push({
      id: uniqueId(o.id, used),
      name: coerceString(o.name, `Discount ${i + 1}`),
      clientType: coerceOptionalString(o.clientType),
      percent: clamp(coerceNumber(o.percent, 0), 0, 100),
    })
  }
  return out
}

function coerceSurcharges(raw: unknown): PricingSurcharge[] {
  if (!Array.isArray(raw)) return []
  const used = new Set<string>()
  const out: PricingSurcharge[] = []
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i]
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const m = coerceNumber(o.multiplier, 1)
    out.push({
      id: uniqueId(o.id, used),
      name: coerceString(o.name, `Surcharge ${i + 1}`),
      multiplier: Math.max(1, m),
    })
  }
  return out
}

/**
 * Parse pasted JSON and coerce into a valid `PricingCatalogDoc` (v1).
 */
export function parsePricingCatalogFromJsonText(text: string): ParseCatalogResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, message: 'Paste JSON or choose a file.' }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed) as unknown
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON'
    return { ok: false, message: `Could not parse JSON: ${msg}` }
  }
  return coercePricingCatalogDoc(parsed)
}

export function coercePricingCatalogDoc(raw: unknown): ParseCatalogResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'Catalog must be a JSON object.' }
  }
  const o = raw as Record<string, unknown>
  if (o.v !== 1) {
    return {
      ok: false,
      message: `Unsupported catalog version (expected v: 1, got ${String(o.v)}).`,
    }
  }
  const defaults = emptyPricingCatalogDoc()
  const doc: PricingCatalogDoc = {
    v: 1,
    policies: coercePolicies(o.policies, defaults.policies),
    packages: coercePackages(o.packages),
    services: coerceServices(o.services),
    addons: coerceAddons(o.addons),
    discounts: coerceDiscounts(o.discounts),
    surcharges: coerceSurcharges(o.surcharges),
  }
  return { ok: true, doc }
}

export function serializePricingCatalogDoc(doc: PricingCatalogDoc): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}
