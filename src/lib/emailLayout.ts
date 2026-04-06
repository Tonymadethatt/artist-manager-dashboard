/** Stored in email_templates.layout (jsonb). Versioned for forward compatibility. */

export type EmailTemplateAppendBlock =
  | { kind: 'prose_card'; title?: string | null; body: string }
  | { kind: 'bullet_card'; title?: string | null; items: string[] }

export type EmailTemplateLayoutFooter = {
  /** Client (venue) emails only; default true = current product behavior */
  showReplyButton?: boolean
  replyButtonLabel?: string | null
}

export type EmailTemplateLayoutV1 = {
  version?: number
  subject?: string | null
  greeting?: string | null
  intro?: string | null
  closing?: string | null
  appendBlocks?: EmailTemplateAppendBlock[]
  footer?: EmailTemplateLayoutFooter
}

export function parseEmailTemplateLayout(raw: unknown): EmailTemplateLayoutV1 | null {
  if (raw === null || raw === undefined) return null
  if (typeof raw !== 'object' || Array.isArray(raw)) return null
  return raw as EmailTemplateLayoutV1
}

function isAppendBlock(x: unknown): x is EmailTemplateAppendBlock {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false
  const k = (x as { kind?: unknown }).kind
  if (k === 'prose_card') {
    const body = (x as { body?: unknown }).body
    return typeof body === 'string'
  }
  if (k === 'bullet_card') {
    const items = (x as { items?: unknown }).items
    return Array.isArray(items) && items.every(i => typeof i === 'string')
  }
  return false
}

/** Sanitize layout parsed from DB (drop invalid blocks, keep rest). */
export function normalizeEmailTemplateLayout(raw: unknown): EmailTemplateLayoutV1 | null {
  const p = parseEmailTemplateLayout(raw)
  if (!p) return null
  const blocks = Array.isArray(p.appendBlocks)
    ? p.appendBlocks.filter(isAppendBlock)
    : undefined
  return {
    ...p,
    appendBlocks: blocks && blocks.length > 0 ? blocks : p.appendBlocks,
  }
}

/**
 * Merge legacy columns into layout-shaped overrides. Column values win only when
 * layout omits that field (after trim), so new UI can store everything in `layout`.
 */
export function effectiveTemplateLayout(
  layout: EmailTemplateLayoutV1 | null | undefined,
  customSubject: string | null | undefined,
  customIntro: string | null | undefined,
): EmailTemplateLayoutV1 {
  const L = layout ? { ...layout } : {}
  const cs = customSubject?.trim()
  const ci = customIntro?.trim()
  if (cs && !L.subject?.trim()) L.subject = cs
  if (ci && !L.intro?.trim()) L.intro = ci
  return L
}

export function layoutHasAnyCustomization(L: EmailTemplateLayoutV1): boolean {
  if (L.subject?.trim()) return true
  if (L.greeting?.trim()) return true
  if (L.intro?.trim()) return true
  if (L.closing?.trim()) return true
  if (L.appendBlocks && L.appendBlocks.length > 0) return true
  if (L.footer?.replyButtonLabel?.trim()) return true
  if (L.footer?.showReplyButton === false) return true
  return false
}
