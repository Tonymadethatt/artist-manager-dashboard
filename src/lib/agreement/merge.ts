import type { TemplateSection } from '@/types'

/** Split sections for rendering when any section uses header/footer/signatures layout. */
export function partitionAgreementSections(sections: TemplateSection[]): {
  headers: TemplateSection[]
  bodies: TemplateSection[]
  signatures: TemplateSection[]
  footers: TemplateSection[]
} {
  const anyMarked = sections.some(
    s => s.section_kind != null && s.section_kind !== 'body'
  )
  if (!anyMarked) {
    return { headers: [], bodies: sections, signatures: [], footers: [] }
  }
  const headers = sections.filter(s => (s.section_kind ?? 'body') === 'header')
  const footers = sections.filter(s => (s.section_kind ?? 'body') === 'footer')
  const signatures = sections.filter(s => (s.section_kind ?? 'body') === 'signatures')
  const bodies = sections.filter(s => {
    const k = s.section_kind ?? 'body'
    return k !== 'header' && k !== 'footer' && k !== 'signatures'
  })
  return { headers, bodies, signatures, footers }
}

/** Replace `{{token}}` placeholders (word chars only, same as FileBuilder). */
export function mergePlaceholders(text: string, vars: Record<string, string>): string {
  let out = text
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val || `[${key}]`)
  }
  return out
}

export function mergeSectionContent(
  section: TemplateSection,
  vars: Record<string, string>
): { label: string; body: string } {
  return {
    label: section.label,
    body: mergePlaceholders(section.content, vars),
  }
}
