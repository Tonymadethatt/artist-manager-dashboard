import type { TemplateSection } from '@/types'
import { mergeSectionContent, partitionAgreementSections } from './merge'

/** Plain-text agreement output. */
export function renderAgreementText(sections: TemplateSection[], vars: Record<string, string>): string {
  const { headers, bodies, footers } = partitionAgreementSections(sections)

  const headerPart =
    headers.length > 0
      ? headers
          .map(s => {
            const { label, body } = mergeSectionContent(s, vars)
            return `[${label}]\n\n${body}`
          })
          .join('\n\n')
      : ''

  const bodyPart = bodies
    .map(s => {
      const { label, body } = mergeSectionContent(s, vars)
      return `=== ${label.toUpperCase()} ===\n\n${body}`
    })
    .join('\n\n\n')

  const footerPart =
    footers.length > 0
      ? footers
          .map(s => {
            const { label, body } = mergeSectionContent(s, vars)
            return `[${label}]\n\n${body}`
          })
          .join('\n\n')
      : ''

  const chunks: string[] = []
  if (headerPart.trim()) chunks.push(headerPart.trim())
  if (bodyPart.trim()) chunks.push(bodyPart.trim())
  if (footerPart.trim()) chunks.push(footerPart.trim())

  return chunks.join('\n\n\n---\n\n\n')
}
