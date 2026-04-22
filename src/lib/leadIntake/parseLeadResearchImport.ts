/**
 * Parse AI research output (YAML-like lines, single JSON object, or JSON array) into import rows.
 * Field names match `lead_research_prompt.md` / cold outreach brief.
 */

export const LEAD_IMPORT_FIELD_KEYS = [
  'venue_name',
  'instagram_handle',
  'genre',
  'event_name',
  'crowd_type',
  'resident_dj',
  'city',
  'contact_email',
  'contact_phone',
  'website',
  'notes',
] as const

export type LeadImportFieldKey = (typeof LEAD_IMPORT_FIELD_KEYS)[number]

export type LeadImportPickedFields = {
  venue_name: string
  instagram_handle: string
  genre: string
  event_name: string
  crowd_type: string
  resident_dj: string
  city: string
  contact_email: string
  contact_phone: string
  website: string
  research_notes: string
}

function emptyPicked(): LeadImportPickedFields {
  return {
    venue_name: '',
    instagram_handle: '',
    genre: '',
    event_name: '',
    crowd_type: '',
    resident_dj: '',
    city: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    research_notes: '',
  }
}

function trimStr(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number' || typeof v === 'boolean') return String(v).trim()
  return ''
}

function pickFromRecord(r: Record<string, unknown>): LeadImportPickedFields {
  const p = emptyPicked()
  p.venue_name = trimStr(r.venue_name)
  p.instagram_handle = trimStr(r.instagram_handle).replace(/^@+/, '')
  p.genre = trimStr(r.genre)
  p.event_name = trimStr(r.event_name)
  p.crowd_type = trimStr(r.crowd_type)
  p.resident_dj = trimStr(r.resident_dj)
  p.city = trimStr(r.city)
  p.contact_email = trimStr(r.contact_email)
  p.contact_phone = trimStr(r.contact_phone)
  p.website = trimStr(r.website)
  p.research_notes = trimStr(r.notes ?? r.research_notes)
  return p
}

/**
 * `key: value` lines. Values may be empty. Last `notes` wins; supports one block per parse call.
 */
function parseLineBlock(block: string): LeadImportPickedFields {
  const p = emptyPicked()
  const lines = block.split(/\r?\n/)
  for (const line of lines) {
    const m = /^\s*([a-zA-Z0-9_]+)\s*:\s*(.*)$/.exec(line)
    if (!m) continue
    const key = m[1].toLowerCase() as string
    const value = m[2]?.trim() ?? ''
    if (key === 'venue_name') p.venue_name = value
    else if (key === 'instagram_handle') p.instagram_handle = value.replace(/^@+/, '')
    else if (key === 'genre') p.genre = value
    else if (key === 'event_name') p.event_name = value
    else if (key === 'crowd_type') p.crowd_type = value
    else if (key === 'resident_dj') p.resident_dj = value
    else if (key === 'city') p.city = value
    else if (key === 'contact_email') p.contact_email = value
    else if (key === 'contact_phone') p.contact_phone = value
    else if (key === 'website') p.website = value
    else if (key === 'notes' || key === 'research_notes') p.research_notes = value
  }
  return p
}

function parseJsonString(raw: string): unknown | null {
  const t = raw.trim()
  if (!t) return null
  try {
    return JSON.parse(t) as unknown
  } catch {
    return null
  }
}

/** Split pasted text into multiple line-blocks when the user pastes several ``` blocks or sections starting with `venue_name:`. */
function splitLineBlocks(raw: string): string[] {
  const t = raw.trim()
  if (!t) return []
  if (t.startsWith('{') || t.startsWith('[')) return [t]
  const parts = t.split(/\n---+\n|(?=\nvenue_name\s*:)/i)
  return parts.map(s => s.trim()).filter(Boolean)
}

export type LeadImportVitalResult =
  | { ok: true }
  | { ok: false; reason: 'missing_venue_name' | 'missing_instagram_handle' | 'missing_genre' }

export function checkLeadVitals(p: LeadImportPickedFields): LeadImportVitalResult {
  if (!p.venue_name.trim()) return { ok: false, reason: 'missing_venue_name' }
  if (!p.instagram_handle.trim()) return { ok: false, reason: 'missing_instagram_handle' }
  if (!p.genre.trim()) return { ok: false, reason: 'missing_genre' }
  return { ok: true }
}

export type LeadImportRowResult = {
  row: LeadImportPickedFields
  vitals: LeadImportVitalResult
  /** When vitals are missing, the row must not be imported. */
  importable: boolean
  /** True when the row can be stored but has no contact email. */
  nonSendable: boolean
}

function evaluateRow(p: LeadImportPickedFields): LeadImportRowResult {
  const vitals = checkLeadVitals(p)
  const importable = vitals.ok
  const nonSendable = !p.contact_email.trim()
  return { row: p, vitals, importable, nonSendable }
}

/**
 * One pasted string → one or more picked field objects, each evaluated.
 */
export function parseLeadResearchImportText(raw: string): LeadImportRowResult[] {
  const t = raw.trim()
  if (!t) return []

  if (t.startsWith('[')) {
    const parsed = parseJsonString(t)
    if (Array.isArray(parsed)) {
      return parsed
        .filter((x): x is Record<string, unknown> => x != null && typeof x === 'object' && !Array.isArray(x))
        .map(x => evaluateRow(pickFromRecord(x)))
    }
  }

  if (t.startsWith('{')) {
    const parsed = parseJsonString(t)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return [evaluateRow(pickFromRecord(parsed as Record<string, unknown>))]
    }
  }

  return splitLineBlocks(t).map(block => evaluateRow(parseLineBlock(block)))
}
