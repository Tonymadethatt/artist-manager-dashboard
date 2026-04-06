import type { GeneratedFile } from '../../types'
import { resolveGeneratedFileDownloadUrl } from './resolveGeneratedFileDownloadUrl'

/** Build a client/server payload for custom-template email attachment blocks (public URL + display name). */
export function buildEmailAttachmentPayloadFromFile(
  file: GeneratedFile | null | undefined,
  siteOrigin: string,
): { url: string; fileName: string } | null {
  if (!file) return null
  const url = resolveGeneratedFileDownloadUrl(file, siteOrigin)?.trim()
  const fileName = file.name?.trim()
  if (!url || !fileName) return null
  return { url, fileName }
}
