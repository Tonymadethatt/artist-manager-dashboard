import { parseAccentColorHex } from './customEmailAccentPresets'
import type { EmailCaptureKind } from '../emailCapture/kinds'
import { isEmailCaptureKind } from '../emailCapture/kinds'

export type CustomEmailBlock =
  | { kind: 'prose'; title?: string | null; body: string; accentColor?: string | null }
  | { kind: 'bullet_list'; title?: string | null; items: string[]; accentColor?: string | null }
  | {
      kind: 'key_value'
      title?: string | null
      rows: Array<{ label: string; valueKey?: string | null; value?: string | null }>
      accentColor?: string | null
    }
  | { kind: 'table'; title?: string | null; headers: string[]; rows: string[][]; accentColor?: string | null }
  | { kind: 'divider' }

export interface CustomEmailBlocksDoc {
  version: 1
  blocks: CustomEmailBlock[]
  /** Optional opening line with {{merge}} tokens. Empty/missing uses defaults (venue: Hi + contact first name; artist: Hey + profile artist name). */
  greeting?: string | null
  /** Client (venue) custom templates only: when set, queue/modal sends mint a capture link with this kind. */
  captureKind?: EmailCaptureKind | null
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function parseBlock(raw: unknown): CustomEmailBlock | null {
  if (!isObj(raw) || typeof raw.kind !== 'string') return null
  const accent = parseAccentColorHex(raw.accentColor)
  switch (raw.kind) {
    case 'prose':
      return {
        kind: 'prose',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        body: typeof raw.body === 'string' ? raw.body : '',
        ...(accent ? { accentColor: accent } : {}),
      }
    case 'bullet_list': {
      const items = Array.isArray(raw.items) ? raw.items.filter((x): x is string => typeof x === 'string') : []
      return {
        kind: 'bullet_list',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        items,
        ...(accent ? { accentColor: accent } : {}),
      }
    }
    case 'key_value': {
      const rowsIn = Array.isArray(raw.rows) ? raw.rows : []
      const rows = rowsIn
        .filter(isObj)
        .map(r => ({
          label: typeof r.label === 'string' ? r.label : '',
          valueKey: typeof r.valueKey === 'string' ? r.valueKey : r.valueKey === null ? null : undefined,
          value: typeof r.value === 'string' ? r.value : r.value === null ? null : undefined,
        }))
        .filter(r => r.label.length > 0)
      return {
        kind: 'key_value',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        rows,
        ...(accent ? { accentColor: accent } : {}),
      }
    }
    case 'table': {
      const headers = Array.isArray(raw.headers)
        ? raw.headers.filter((x): x is string => typeof x === 'string')
        : []
      const rowsIn = Array.isArray(raw.rows) ? raw.rows : []
      const rows = rowsIn
        .filter(Array.isArray)
        .map(r => r.filter((c): c is string => typeof c === 'string'))
      return {
        kind: 'table',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        headers,
        rows,
        ...(accent ? { accentColor: accent } : {}),
      }
    }
    case 'divider':
      return { kind: 'divider' }
    default:
      return null
  }
}

export function parseCustomEmailBlocksDoc(raw: unknown): CustomEmailBlocksDoc | null {
  if (!isObj(raw)) return null
  if (raw.version !== 1) return null
  if (!Array.isArray(raw.blocks)) return null
  const blocks: CustomEmailBlock[] = []
  for (const b of raw.blocks) {
    const p = parseBlock(b)
    if (p) blocks.push(p)
  }
  const doc: CustomEmailBlocksDoc = { version: 1, blocks }
  if ('greeting' in raw && typeof raw.greeting === 'string' && raw.greeting.length > 0) {
    doc.greeting = raw.greeting
  }
  if ('captureKind' in raw && typeof raw.captureKind === 'string' && isEmailCaptureKind(raw.captureKind)) {
    doc.captureKind = raw.captureKind
  }
  return doc
}

export function defaultCustomBlocksDoc(): CustomEmailBlocksDoc {
  return { version: 1, blocks: [{ kind: 'prose', title: null, body: '' }] }
}

/** Defaults when inserting a new row: opening line includes merge-safe recipient / artist greeting. */
export function defaultCustomBlocksDocForAudience(audience: 'venue' | 'artist' | 'lead'): CustomEmailBlocksDoc {
  const base = defaultCustomBlocksDoc()
  if (audience === 'venue') {
    return { ...base, greeting: 'Hi {{recipient.firstName}},' }
  }
  if (audience === 'lead') {
    return { ...base, greeting: 'Hi {{recipient.firstName}},' }
  }
  return { ...base, greeting: 'Hey {{profile.artist_name}},' }
}

export type CustomTableBlock = Extract<CustomEmailBlock, { kind: 'table' }>

/** Ensures every row has exactly `headers.length` string cells (pads with '' or truncates). */
export function normalizeTableBlock(block: CustomTableBlock): CustomTableBlock {
  let headers = [...block.headers]
  if (headers.length === 0) {
    headers = ['Column']
  }
  const colCount = headers.length
  const rows = block.rows.map(r => {
    const cells = [...r]
    while (cells.length < colCount) cells.push('')
    if (cells.length > colCount) cells.splice(colCount)
    return cells
  })
  return { ...block, headers, rows }
}

export function normalizeCustomEmailBlocksDoc(doc: CustomEmailBlocksDoc): CustomEmailBlocksDoc {
  return {
    ...doc,
    blocks: doc.blocks.map(b => (b.kind === 'table' ? normalizeTableBlock(b) : b)),
  }
}

/** Parse stored JSON and normalize table row/column shape for editing + preview. */
export function loadCustomEmailBlocksDoc(raw: unknown): CustomEmailBlocksDoc {
  return normalizeCustomEmailBlocksDoc(parseCustomEmailBlocksDoc(raw) ?? defaultCustomBlocksDoc())
}
