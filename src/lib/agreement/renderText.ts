import type { TemplateSection } from '@/types'
import { mergeSectionContent } from './merge'

/** Plain-text agreement output (parity with legacy FileBuilder). */
export function renderAgreementText(sections: TemplateSection[], vars: Record<string, string>): string {
  return sections
    .map(s => {
      const { label, body } = mergeSectionContent(s, vars)
      return `=== ${label.toUpperCase()} ===\n\n${body}`
    })
    .join('\n\n\n')
}
