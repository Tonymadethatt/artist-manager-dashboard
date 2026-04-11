import type { GeneratedFile } from '../../types'
import {
  collectAgreementSiteOrigins,
  filterPoisonedFirstPartyAgreementPublicUrl,
  resolvedPdfHrefFromOrigin,
} from './pdfShareUrl'

export type GeneratedFileSource = 'generated' | 'upload'

/** Resolvable public/download href for a row (upload bucket, agreement PDF, or legacy public URL). */
export function resolveGeneratedFileDownloadUrl(file: GeneratedFile, siteOrigin: string): string | null {
  const src = file.file_source ?? 'generated'
  if (src === 'upload') {
    const u = file.upload_public_url?.trim()
    return u || null
  }
  if (file.output_format === 'pdf') {
    const fromResolved = resolvedPdfHrefFromOrigin(file, siteOrigin)
    if (fromResolved) return fromResolved
    const raw = file.pdf_public_url?.trim()
    if (!raw) return null
    return filterPoisonedFirstPartyAgreementPublicUrl(raw, collectAgreementSiteOrigins(siteOrigin))
  }
  return null
}

export function isTemplateAttachmentEligibleFile(file: GeneratedFile, siteOrigin: string): boolean {
  return resolveGeneratedFileDownloadUrl(file, siteOrigin) != null
}
