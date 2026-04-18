/**
 * Frozen catalog for the smart show report (artist link + manual).
 * Matches product spec in .cursor plan.
 */

import { formatUsdDisplayCeil } from './format/displayCurrency'

export type ShowReportNightMood = 'crushed' | 'great' | 'solid' | 'meh' | 'rough' | 'disaster'

export interface ShowReportPresetDef {
  /** Stable id stored on deals + report */
  id: string
  label: string
  /** Always triggers stricter explanation when line = No */
  globalMajor: boolean
}

/** Eleven starter presets — one title each */
export const SHOW_REPORT_PRESETS: readonly ShowReportPresetDef[] = [
  { id: 'guaranteed_fee', label: 'Guaranteed fee', globalMajor: true },
  { id: 'pa_sound', label: 'PA and sound', globalMajor: true },
  { id: 'stage_lighting', label: 'Stage and lighting', globalMajor: true },
  { id: 'set_times', label: 'Set times and curfew', globalMajor: true },
  { id: 'load_in', label: 'Load-in and soundcheck', globalMajor: false },
  { id: 'merch_terms', label: 'Merch terms', globalMajor: false },
  { id: 'hospitality', label: 'Hospitality', globalMajor: false },
  { id: 'lodging', label: 'Lodging', globalMajor: false },
  { id: 'parking', label: 'Parking and access', globalMajor: false },
  { id: 'marketing', label: 'Marketing / promo', globalMajor: false },
  { id: 'guest_list', label: 'Guest list and comps', globalMajor: false },
] as const

/** Artist-side checklist (behavioral); ids namespaced `artist_preset:` on save. */
export const ARTIST_SHOW_REPORT_PRESETS: readonly ShowReportPresetDef[] = [
  { id: 'artist_on_time', label: 'On time for load-in and show', globalMajor: true },
  { id: 'artist_gear', label: 'Gear prepared and functional', globalMajor: true },
  { id: 'artist_backup', label: 'Backup plan if gear fails', globalMajor: false },
  { id: 'artist_professional', label: 'Professional with staff and crowd', globalMajor: false },
  { id: 'artist_comm', label: 'Communication with venue / promoter', globalMajor: false },
  { id: 'artist_music', label: 'Music plan / requests handled', globalMajor: false },
] as const

export const GLOBAL_MAJOR_PRESET_IDS = new Set(
  SHOW_REPORT_PRESETS.filter(p => p.globalMajor).map(p => p.id),
)

export const ARTIST_GLOBAL_MAJOR_PRESET_IDS = new Set(
  ARTIST_SHOW_REPORT_PRESETS.filter(p => p.globalMajor).map(p => p.id),
)

export interface DealPromiseLine {
  id: string
  label: string
  presetKey?: string
  major?: boolean
}

export interface DealPromiseLinesDoc {
  lines: DealPromiseLine[]
}

/** v2: venue vs artist commitments (split caps in UI: ~5 custom lines per side). */
export interface DealPromiseLinesDocV2 {
  v: 2
  venue: { lines: DealPromiseLine[] }
  artist: { lines: DealPromiseLine[] }
}

export type NormalizedPromiseSides = {
  version: 1 | 2
  venue: DealPromiseLine[]
  artist: DealPromiseLine[]
}

const MAX_LINES_PER_SIDE = 22

function sanitizePromiseLines(raw: unknown): DealPromiseLine[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(
      (l): l is DealPromiseLine =>
        !!l &&
        typeof l === 'object' &&
        typeof (l as DealPromiseLine).id === 'string' &&
        typeof (l as DealPromiseLine).label === 'string',
    )
    .slice(0, MAX_LINES_PER_SIDE)
}

/** Legacy flat `{ lines }` or v2 `{ v:2, venue, artist }`. */
export function normalizePromiseLinesDoc(doc: unknown): NormalizedPromiseSides {
  if (doc && typeof doc === 'object' && (doc as DealPromiseLinesDocV2).v === 2) {
    const v2 = doc as DealPromiseLinesDocV2
    const venue = sanitizePromiseLines(v2.venue?.lines)
    const artist = sanitizePromiseLines(v2.artist?.lines)
    return { version: 2, venue, artist }
  }
  if (!doc || typeof doc !== 'object') {
    return { version: 1, venue: defaultDealPromiseLines(), artist: [] }
  }
  const lines = (doc as DealPromiseLinesDoc).lines
  if (!Array.isArray(lines) || lines.length === 0) {
    return { version: 1, venue: defaultDealPromiseLines(), artist: [] }
  }
  const venue = sanitizePromiseLines(lines)
  return {
    version: 1,
    venue: venue.length ? venue : defaultDealPromiseLines(),
    artist: [],
  }
}

export function defaultDealPromiseLines(): DealPromiseLine[] {
  return SHOW_REPORT_PRESETS.map(p => ({
    id: `preset:${p.id}`,
    label: p.label,
    presetKey: p.id,
    major: p.globalMajor,
  }))
}

export function defaultArtistPromisePresets(): Record<string, boolean> {
  return Object.fromEntries(ARTIST_SHOW_REPORT_PRESETS.map(p => [p.id, false])) as Record<string, boolean>
}

/** Venue-side lines only (backward compatible with legacy `{ lines }`). */
export function resolveVenuePromiseLinesForDeal(doc: unknown): DealPromiseLine[] {
  const { venue } = normalizePromiseLinesDoc(doc)
  return venue.length ? venue : defaultDealPromiseLines()
}

/** Artist-side lines (empty for legacy deals). */
export function resolveArtistPromiseLinesForDeal(doc: unknown): DealPromiseLine[] {
  return normalizePromiseLinesDoc(doc).artist
}

/** @deprecated Prefer {@link resolveVenuePromiseLinesForDeal}; same behavior. */
export function resolvePromiseLinesForDeal(doc: unknown): DealPromiseLine[] {
  return resolveVenuePromiseLinesForDeal(doc)
}

export function isLineMajor(line: DealPromiseLine): boolean {
  if (line.major) return true
  if (line.presetKey) {
    if (GLOBAL_MAJOR_PRESET_IDS.has(line.presetKey)) return true
    if (ARTIST_GLOBAL_MAJOR_PRESET_IDS.has(line.presetKey)) return true
  }
  return false
}

/**
 * Display label for a promise row (e.g. guaranteed-fee preset includes booked gross when present).
 */
export function resolvePromiseLineDisplayLabel(
  line: DealPromiseLine,
  dealGrossAmount: number | null | undefined,
): string {
  const isGuaranteedFee =
    line.presetKey === 'guaranteed_fee' ||
    line.id === 'preset:guaranteed_fee' ||
    (line.presetKey == null && line.label.trim().toLowerCase() === 'guaranteed fee')

  if (!isGuaranteedFee) return line.label

  const amount =
    dealGrossAmount != null && Number.isFinite(Number(dealGrossAmount))
      ? Number(dealGrossAmount)
      : null

  if (amount != null) {
    return `Guaranteed fee — ${formatUsdDisplayCeil(amount)} promised for this show`
  }
  return line.label
}

export const NIGHT_MOODS: readonly {
  key: ShowReportNightMood
  emoji: string
  word: string
}[] = [
  { key: 'crushed', emoji: '🔥', word: 'Crushed it' },
  { key: 'great', emoji: '😄', word: 'Great' },
  { key: 'solid', emoji: '🙂', word: 'Solid' },
  { key: 'meh', emoji: '😐', word: 'Meh' },
  { key: 'rough', emoji: '😕', word: 'Rough' },
  { key: 'disaster', emoji: '💀', word: 'Disaster' },
] as const

/**
 * Wizard grid order for 2 columns (row-major): each row is [more negative, more positive] — negative left, positive right.
 */
export const NIGHT_MOOD_GRID_KEYS: readonly ShowReportNightMood[] = [
  'disaster',
  'crushed',
  'rough',
  'great',
  'meh',
  'solid',
] as const

const NIGHT_MOOD_BY_KEY = Object.fromEntries(NIGHT_MOODS.map(m => [m.key, m])) as Record<
  ShowReportNightMood,
  (typeof NIGHT_MOODS)[number]
>

/** Mood entries in visual order for the show-report mood step. */
export function nightMoodsForWizardGrid(): readonly (typeof NIGHT_MOODS)[number][] {
  return NIGHT_MOOD_GRID_KEYS.map(k => NIGHT_MOOD_BY_KEY[k])
}

export const TOP_THREE_MOOD: ReadonlySet<ShowReportNightMood> = new Set(['crushed', 'great', 'solid'])

/** Upper bound for metrics (plan: never under-count) */
export const CROWD_BANDS: readonly { id: string; label: string; upper: number }[] = [
  { id: 'under_50', label: 'Under 50', upper: 50 },
  { id: '50_150', label: '50–150', upper: 150 },
  { id: '150_300', label: '150–300', upper: 300 },
  { id: '300_500', label: '300–500', upper: 500 },
  { id: '500_plus', label: '500+', upper: 600 },
] as const

export type RebookingBucket =
  | 'this_week'
  | 'next_week'
  | 'this_month'
  | 'custom_date'

export function mapNightMoodToCrowdEnergy(
  mood: ShowReportNightMood | null | undefined,
): 'electric' | 'warm' | 'flat' | 'hostile' | null {
  switch (mood) {
    case 'crushed':
    case 'great':
      return 'electric'
    case 'solid':
      return 'warm'
    case 'meh':
    case 'rough':
      return 'flat'
    case 'disaster':
      return 'hostile'
    default:
      return null
  }
}

/** Derive legacy venue_delivered for automations */
export function deriveVenueDelivered(
  results: { id: string; met: boolean }[] | null | undefined,
  lines: DealPromiseLine[],
): 'yes_good' | 'mostly_off' | 'significant_gaps' | null {
  if (!results?.length || !lines.length) return null
  const metById = new Map(results.map(r => [r.id, r.met]))
  let noCount = 0
  let majorNo = false
  for (const line of lines) {
    const met = metById.get(line.id)
    if (met === false) {
      noCount++
      if (isLineMajor(line)) majorNo = true
    }
  }
  if (noCount === 0) return 'yes_good'
  if (majorNo || noCount >= 2) return 'significant_gaps'
  return 'mostly_off'
}

export const SUCCESS_MESSAGE =
  "Thanks, that's everything we need. Enjoy the rest of your day brotha. 🫡"

/** 1–5 for legacy `event_rating` column and automations keyed off low scores */
export function moodToEventRating(mood: ShowReportNightMood): number {
  switch (mood) {
    case 'crushed':
    case 'great':
      return 5
    case 'solid':
      return 4
    case 'meh':
      return 3
    case 'rough':
      return 2
    case 'disaster':
      return 1
  }
}

function presetToggleFromLines(
  lines: DealPromiseLine[],
  defs: readonly ShowReportPresetDef[],
): Record<string, boolean> {
  const preset: Record<string, boolean> = Object.fromEntries(defs.map(p => [p.id, false]))
  for (const line of lines) {
    if (line.presetKey && line.presetKey in preset) preset[line.presetKey] = true
  }
  return preset
}

/** Venue preset toggles from saved deal doc. */
export function presetToggleStateFromDealDoc(doc: unknown): Record<string, boolean> {
  return presetToggleFromLines(resolveVenuePromiseLinesForDeal(doc), SHOW_REPORT_PRESETS)
}

export function artistPresetToggleStateFromDealDoc(doc: unknown): Record<string, boolean> {
  return presetToggleFromLines(resolveArtistPromiseLinesForDeal(doc), ARTIST_SHOW_REPORT_PRESETS)
}

export function customLabelsFromDealDoc(doc: unknown): string[] {
  return resolveVenuePromiseLinesForDeal(doc)
    .filter(l => !l.presetKey)
    .map(l => l.label)
}

export function artistCustomLabelsFromDealDoc(doc: unknown): string[] {
  return resolveArtistPromiseLinesForDeal(doc)
    .filter(l => !l.presetKey)
    .map(l => l.label)
}

const CUSTOM_CAP_VENUE = 5
const CUSTOM_CAP_ARTIST = 5

function buildSideLines(
  defs: readonly ShowReportPresetDef[],
  preset: Record<string, boolean>,
  customs: string[],
  idPresetPrefix: string,
  idCustomPrefix: string,
  customCap: number,
): DealPromiseLine[] {
  const lines: DealPromiseLine[] = []
  for (const p of defs) {
    if (preset[p.id]) {
      lines.push({
        id: `${idPresetPrefix}${p.id}`,
        label: p.label,
        presetKey: p.id,
        major: p.globalMajor,
      })
    }
  }
  let n = 0
  for (const text of customs) {
    const t = text.trim()
    if (!t || n >= customCap) continue
    lines.push({
      id: `${idCustomPrefix}${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${n}`}`,
      label: t,
      major: false,
    })
    n++
  }
  return lines
}

/** Persists v2 doc (venue + artist). */
export function buildPromiseLinesDocV2FromUi(
  venuePreset: Record<string, boolean>,
  venueCustoms: string[],
  artistPreset: Record<string, boolean>,
  artistCustoms: string[],
): DealPromiseLinesDocV2 {
  return {
    v: 2,
    venue: {
      lines: buildSideLines(
        SHOW_REPORT_PRESETS,
        venuePreset,
        venueCustoms,
        'preset:',
        'custom:',
        CUSTOM_CAP_VENUE,
      ),
    },
    artist: {
      lines: buildSideLines(
        ARTIST_SHOW_REPORT_PRESETS,
        artistPreset,
        artistCustoms,
        'artist_preset:',
        'artist_custom:',
        CUSTOM_CAP_ARTIST,
      ),
    },
  }
}

/** @deprecated Use {@link buildPromiseLinesDocV2FromUi}; builds flat legacy doc (venue only). */
export function buildPromiseLinesDocFromUi(
  preset: Record<string, boolean>,
  customs: string[],
): DealPromiseLinesDoc {
  const lines = buildSideLines(SHOW_REPORT_PRESETS, preset, customs, 'preset:', 'custom:', 10)
  return { lines }
}

export type StoredPromiseResultsV2 = {
  v: 2
  venue: { id: string; met: boolean }[]
  artist: { id: string; met: boolean }[]
}

export function isPromiseResultsV2(x: unknown): x is StoredPromiseResultsV2 {
  return !!x && typeof x === 'object' && (x as StoredPromiseResultsV2).v === 2
}
