import { nanoid } from '@/lib/nanoid'
import { isHtmlContent, isSafeImageUrl } from '@/lib/agreement/sanitize'
import type { TemplateSection, TemplateSectionKind, TemplateType } from '@/types'

const TEMPLATE_TYPES = new Set<TemplateType>(['agreement', 'invoice'])

export type DocumentTemplateImportPayload = {
  name: string
  type: TemplateType
  sections: TemplateSection[]
}

export type ParseDocumentTemplateResult =
  | { ok: true; payload: DocumentTemplateImportPayload }
  | { ok: false; message: string; details?: string[] }

/** Match RichBodyEditor `initContent` for plain-text paragraphs. */
function plainTextToHtmlParagraphs(content: string): string {
  const t = content.trim()
  if (!t) return ''
  const paras = t.split(/\n{2,}/)
  return paras
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

/** Normalize AI HTML so DOMPurify (h3/h4 allowlist) keeps subheadings. */
export function normalizeHeadingTagsInHtml(html: string): string {
  return html
    .replace(/<\s*h1\b/gi, '<h3')
    .replace(/<\s*\/\s*h1\s*>/gi, '</h3>')
    .replace(/<\s*h2\b/gi, '<h3')
    .replace(/<\s*\/\s*h2\s*>/gi, '</h3>')
}

function coerceSectionContent(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''
  if (isHtmlContent(trimmed)) {
    return normalizeHeadingTagsInHtml(trimmed)
  }
  return plainTextToHtmlParagraphs(trimmed)
}

function uniqueSectionId(preferred: unknown, used: Set<string>): string {
  let id = typeof preferred === 'string' && preferred.trim() ? preferred.trim() : nanoid()
  if (used.has(id)) {
    id = nanoid()
    while (used.has(id)) id = nanoid()
  }
  used.add(id)
  return id
}

function coerceTemplateType(raw: unknown): TemplateType | null {
  if (raw === 'agreement' || raw === 'invoice') return raw
  if (typeof raw === 'string' && TEMPLATE_TYPES.has(raw as TemplateType)) {
    return raw as TemplateType
  }
  return null
}

function coerceSectionKind(raw: unknown): TemplateSectionKind | null {
  if (raw == null || raw === '') return 'body'
  if (raw === 'header' || raw === 'body' || raw === 'footer') return raw
  return null
}

function coerceHeaderLogoUrl(raw: unknown): string | null | undefined {
  if (raw == null) return null
  if (typeof raw !== 'string') return undefined
  const u = raw.trim()
  if (!u) return null
  return u
}

export function parseDocumentTemplateFromJsonText(text: string): ParseDocumentTemplateResult {
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
  return coerceDocumentTemplateImport(parsed)
}

export function coerceDocumentTemplateImport(raw: unknown): ParseDocumentTemplateResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, message: 'Document template must be a JSON object.' }
  }
  const o = raw as Record<string, unknown>
  if (o.v !== 1) {
    return {
      ok: false,
      message: `Unsupported template version (expected v: 1, got ${String(o.v)}).`,
    }
  }

  const name = typeof o.name === 'string' ? o.name.trim() : ''
  if (!name) {
    return { ok: false, message: 'Template name is required (`name`).' }
  }

   const type = coerceTemplateType(o.type)
  if (!type) {
    return {
      ok: false,
      message: 'Invalid `type` (expected "agreement" or "invoice").',
    }
  }

  if (!Array.isArray(o.sections)) {
    return { ok: false, message: '`sections` must be an array.' }
  }
  if (o.sections.length === 0) {
    return { ok: false, message: '`sections` must contain at least one section.' }
  }

  const usedIds = new Set<string>()
  const sections: TemplateSection[] = []

  for (let i = 0; i < o.sections.length; i++) {
    const row = o.sections[i]
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { ok: false, message: `sections[${i}] must be an object.` }
    }
    const s = row as Record<string, unknown>

    const skRaw = s.section_kind ?? s.sectionKind
    const coercedKind = coerceSectionKind(skRaw)
    if (coercedKind === null) {
      return {
        ok: false,
        message: `sections[${i}]: invalid section_kind (use "header", "body", or "footer").`,
      }
    }
    const section_kind = coercedKind

    if (s.label != null && typeof s.label !== 'string') {
      return { ok: false, message: `sections[${i}].label must be a string.` }
    }
    const label = typeof s.label === 'string' ? s.label : ''
    if (s.content != null && typeof s.content !== 'string') {
      return { ok: false, message: `sections[${i}].content must be a string.` }
    }
    const contentRaw = typeof s.content === 'string' ? s.content : ''
    const content = coerceSectionContent(contentRaw)

    let header_logo_url: string | null = null
    if (section_kind === 'header') {
      const logo = coerceHeaderLogoUrl(s.header_logo_url ?? s.headerLogoUrl)
      if (logo === undefined) {
        return {
          ok: false,
          message: `sections[${i}]: header_logo_url must be a string, null, or omitted.`,
        }
      }
      if (logo && !isSafeImageUrl(logo)) {
        return {
          ok: false,
          message: `sections[${i}]: header_logo_url must be https://, http://, or data:image/…`,
        }
      }
      header_logo_url = logo
    }

    sections.push({
      id: uniqueSectionId(s.id, usedIds),
      label,
      content,
      section_kind,
      header_logo_url: section_kind === 'header' ? header_logo_url : null,
    })
  }

  for (let i = 0; i < sections.length; i++) {
    const sec = sections[i]
    const kind = sec.section_kind ?? 'body'
    if (kind === 'body' && !sec.label.trim()) {
      return {
        ok: false,
        message: `Body section at index ${i} needs a non-empty label (shown as document heading).`,
      }
    }
  }

  return {
    ok: true,
    payload: { name, type, sections },
  }
}
