import type { TemplateSection } from '@/types'
import { mergeSectionContent, partitionAgreementSections } from './merge'
import { isHtmlContent, stripHtmlToText } from './sanitize'

/** Plain-text agreement output. */
export function renderAgreementText(sections: TemplateSection[], vars: Record<string, string>): string {
  const { headers, bodies, signatures, footers } = partitionAgreementSections(sections)

  const headerPart =
    headers.length > 0
      ? headers
          .map(s => {
            const { body } = mergeSectionContent(s, vars)
            return body
          })
          .filter(Boolean)
          .join('\n\n')
      : ''

  const titledBlocks = (list: typeof bodies) =>
    list
      .map(s => {
        const { label, body } = mergeSectionContent(s, vars)
        const text = isHtmlContent(body) ? stripHtmlToText(body) : body
        return `=== ${label.toUpperCase()} ===\n\n${text}`
      })
      .join('\n\n\n')

  const bodyPart = titledBlocks(bodies)
  const signaturesPart = titledBlocks(signatures)

  const footerPart =
    footers.length > 0
      ? footers
          .map(s => {
            const { body } = mergeSectionContent(s, vars)
            return body
          })
          .filter(Boolean)
          .join('\n\n')
      : ''

  const chunks: string[] = []
  if (headerPart.trim()) chunks.push(headerPart.trim())
  if (bodyPart.trim()) chunks.push(bodyPart.trim())
  if (signaturesPart.trim()) chunks.push(signaturesPart.trim())
  if (footerPart.trim()) chunks.push(footerPart.trim())

  return chunks.join('\n\n\n---\n\n\n')
}
