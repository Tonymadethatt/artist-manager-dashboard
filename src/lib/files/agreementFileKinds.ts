import type { GeneratedFile } from '../../types'

/** File Builder PDF (`agreement-pdfs`) or a PDF uploaded in Files (`email-assets`). */
export function isAgreementDocumentFileRow(file: GeneratedFile): boolean {
  if (file.output_format === 'pdf') return true
  if ((file.file_source ?? 'generated') === 'upload' && file.upload_mime_type === 'application/pdf') return true
  return false
}
