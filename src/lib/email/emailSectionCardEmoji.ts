/**
 * Optional leading emoji for dark email section card headers (dot + title).
 * Titles are matched after normalization; programmatic titles are uppercased elsewhere.
 * If a title already begins with an emoji, we do not prepend another.
 */

const EMOJI_BY_NORMALIZED_KEY: Record<string, string> = {
  schedule: '📅',
  location: '📍',
  venue: '🏢',
  'venue contact': '🏢',
  /** Brown skin tone (Fitzpatrick type-6) on person raising hand — not default yellow. */
  contact: '\u{1F64B}\u{1F3FF}',
  payment: '💵',
  gear: '🛠️',
  logistics: '🚚',
  'gear & logistics': '🧰',
  'agreed terms': '✅',
  reference: '🔖',
  'show details': '🎤',
  note: '📝',
  details: '📄',
}

function normalizeSectionTitleKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim()
}

/** True if the string already starts with an emoji (custom editor manual emoji). */
export function sectionTitleAlreadyHasLeadingEmoji(s: string): boolean {
  const t = s.trim()
  if (!t) return false
  const first = [...t][0]
  if (!first) return false
  return /\p{Extended_Pictographic}/u.test(first)
}

function resolveSectionTitleEmoji(raw: string): string | null {
  const trimmed = raw.trim()
  if (!trimmed) return null
  if (/^gig\s+\d+$/i.test(trimmed)) {
    return '🎵'
  }
  const key = normalizeSectionTitleKey(trimmed)
  return EMOJI_BY_NORMALIZED_KEY[key] ?? null
}

/** Built-in cards (gig emails, append blocks): emoji + UPPERCASE label. */
export function decorateProgrammaticSectionCardTitle(raw: string): string {
  const trimmed = raw.trim() || 'Details'
  if (sectionTitleAlreadyHasLeadingEmoji(trimmed)) {
    return trimmed.toUpperCase()
  }
  const emoji = resolveSectionTitleEmoji(trimmed)
  const upper = trimmed.toUpperCase()
  return emoji ? `${emoji} ${upper}` : upper
}

/** Custom template editor (artist): preserve user casing; skip if they already added an emoji. */
export function decorateMergedArtistCustomSectionTitle(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (sectionTitleAlreadyHasLeadingEmoji(trimmed)) return trimmed
  const emoji = resolveSectionTitleEmoji(trimmed)
  return emoji ? `${emoji} ${trimmed}` : trimmed
}
