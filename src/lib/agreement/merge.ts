import type { TemplateSection } from '@/types'

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
