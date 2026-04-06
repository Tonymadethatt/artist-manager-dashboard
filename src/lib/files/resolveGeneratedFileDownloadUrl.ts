import type { GeneratedFile } from '@/types'
import { resolvedPdfHrefFromOrigin } from '@/lib/files/pdfShareUrl'

export type GeneratedFileSource = 'generated' | 'upload'

/** Resolvable public/download href for a row (upload bucket, agreement PDF, or legacy public URL). */
export function resolveGeneratedFileDownloadUrl(file: GeneratedFile, siteOrigin: string): string | null {
  const src = file.file_source ?? 'generated'
  if (src === 'upload') {
    const u = file.upload_public_url?.trim()
    return u || null
  }
  if (file.output_format === 'pdf') {
    return resolvedPdfHrefFromOrigin(file, siteOrigin) || file.pdf_public_url?.trim() || null
  }
  return null
}

export function isTemplateAttachmentEligibleFile(file: GeneratedFile, siteOrigin: string): boolean {
  return resolveGeneratedFileDownloadUrl(file, siteOrigin) != null
}
