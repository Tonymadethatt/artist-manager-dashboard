import {
  resolvePromiseLineDisplayLabel,
  resolveVenuePromiseLinesForDeal,
  type DealPromiseLine,
} from '../showReportCatalog'

/** Venue promise presets we surface as “gear / production / logistics” for artists (not fee/legal). */
const ARTIST_LOGISTICS_PRESET_KEYS = new Set<string>([
  'pa_sound',
  'stage_lighting',
  'load_in',
  'set_times',
  'hospitality',
  'parking',
  'lodging',
  'merch_terms',
  'guest_list',
  'marketing',
])

function lineMatchesLogisticsPreset(line: DealPromiseLine): boolean {
  const k = line.presetKey?.trim()
  if (k && ARTIST_LOGISTICS_PRESET_KEYS.has(k)) return true
  return false
}

/** Short labels for the “Gear & logistics” card (curated). */
export function artistGigLogisticsLabelsFromDeal(
  promiseLinesDoc: unknown,
  dealGrossAmount: number,
): string[] {
  const venue = resolveVenuePromiseLinesForDeal(promiseLinesDoc)
  const out: string[] = []
  const seen = new Set<string>()
  for (const line of venue) {
    if (!lineMatchesLogisticsPreset(line)) continue
    const label = resolvePromiseLineDisplayLabel(line, dealGrossAmount).trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    out.push(label)
  }
  return out
}

/** Up to `max` additional venue commitment lines for “Agreed terms snapshot” (excludes labels already shown). */
export function artistGigRecordsVenueLabels(
  promiseLinesDoc: unknown,
  dealGrossAmount: number,
  excludeNormalized: Set<string>,
  max: number,
): string[] {
  const venue = resolveVenuePromiseLinesForDeal(promiseLinesDoc)
  const out: string[] = []
  for (const line of venue) {
    const label = resolvePromiseLineDisplayLabel(line, dealGrossAmount).trim()
    if (!label || excludeNormalized.has(label.toLowerCase())) continue
    out.push(label)
    if (out.length >= max) break
  }
  return out
}
