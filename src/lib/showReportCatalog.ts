/**
 * Frozen catalog for the smart show report (artist link + manual).
 * Matches product spec in .cursor plan.
 */

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

export const GLOBAL_MAJOR_PRESET_IDS = new Set(
  SHOW_REPORT_PRESETS.filter(p => p.globalMajor).map(p => p.id),
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

export function defaultDealPromiseLines(): DealPromiseLine[] {
  return SHOW_REPORT_PRESETS.map(p => ({
    id: `preset:${p.id}`,
    label: p.label,
    presetKey: p.id,
    major: p.globalMajor,
  }))
}

/** Merge saved deal doc with defaults when empty */
export function resolvePromiseLinesForDeal(doc: unknown): DealPromiseLine[] {
  if (!doc || typeof doc !== 'object') return defaultDealPromiseLines()
  const lines = (doc as DealPromiseLinesDoc).lines
  if (!Array.isArray(lines) || lines.length === 0) return defaultDealPromiseLines()
  return lines
    .filter(
      (l): l is DealPromiseLine =>
        !!l &&
        typeof l === 'object' &&
        typeof (l as DealPromiseLine).id === 'string' &&
        typeof (l as DealPromiseLine).label === 'string',
    )
    .slice(0, 22)
}

export function isLineMajor(line: DealPromiseLine): boolean {
  if (line.major) return true
  if (line.presetKey && GLOBAL_MAJOR_PRESET_IDS.has(line.presetKey)) return true
  return false
}

function formatUsdWhole(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
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
    return `Guaranteed fee — ${formatUsdWhole(amount)} promised for this show`
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

/** Which checklist presets are on for a saved deal doc (`promise_lines`). */
export function presetToggleStateFromDealDoc(doc: unknown): Record<string, boolean> {
  const lines = resolvePromiseLinesForDeal(doc)
  const preset: Record<string, boolean> = Object.fromEntries(
    SHOW_REPORT_PRESETS.map(p => [p.id, false]),
  )
  for (const line of lines) {
    if (line.presetKey && line.presetKey in preset) preset[line.presetKey] = true
  }
  return preset
}

export function customLabelsFromDealDoc(doc: unknown): string[] {
  return resolvePromiseLinesForDeal(doc)
    .filter(l => !l.presetKey)
    .map(l => l.label)
}

export function buildPromiseLinesDocFromUi(
  preset: Record<string, boolean>,
  customs: string[],
): DealPromiseLinesDoc {
  const lines: DealPromiseLine[] = []
  for (const p of SHOW_REPORT_PRESETS) {
    if (preset[p.id]) {
      lines.push({
        id: `preset:${p.id}`,
        label: p.label,
        presetKey: p.id,
        major: p.globalMajor,
      })
    }
  }
  let n = 0
  for (const text of customs) {
    const t = text.trim()
    if (!t || n >= 10) continue
    lines.push({
      id: `custom:${typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${n}`}`,
      label: t,
      major: false,
    })
    n++
  }
  return { lines }
}
