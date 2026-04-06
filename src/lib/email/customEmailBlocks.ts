export type CustomEmailBlock =
  | { kind: 'prose'; title?: string | null; body: string }
  | { kind: 'bullet_list'; title?: string | null; items: string[] }
  | {
      kind: 'key_value'
      title?: string | null
      rows: Array<{ label: string; valueKey?: string | null; value?: string | null }>
    }
  | { kind: 'table'; title?: string | null; headers: string[]; rows: string[][] }
  | { kind: 'divider' }

export interface CustomEmailBlocksDoc {
  version: 1
  blocks: CustomEmailBlock[]
}

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null
}

function parseBlock(raw: unknown): CustomEmailBlock | null {
  if (!isObj(raw) || typeof raw.kind !== 'string') return null
  switch (raw.kind) {
    case 'prose':
      return {
        kind: 'prose',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        body: typeof raw.body === 'string' ? raw.body : '',
      }
    case 'bullet_list': {
      const items = Array.isArray(raw.items) ? raw.items.filter((x): x is string => typeof x === 'string') : []
      return {
        kind: 'bullet_list',
        title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined,
        items,
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
      return { kind: 'key_value', title: typeof raw.title === 'string' ? raw.title : raw.title === null ? null : undefined, rows }
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
  return { version: 1, blocks }
}

export function defaultCustomBlocksDoc(): CustomEmailBlocksDoc {
  return { version: 1, blocks: [{ kind: 'prose', title: null, body: '' }] }
}
