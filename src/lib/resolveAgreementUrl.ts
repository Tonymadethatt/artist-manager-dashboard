/**
 * Agreement link resolution — single product precedence (do not reorder silently):
 *
 * 1. Progress panel / options `agreementUrl` — explicit paste from the venue flow (highest intent).
 * 2. Task or template item `generated_file_id` → PDF row → share/public URL (overrides deal file for this step).
 * 3. Deal `agreement_generated_file_id` → document row → URL (File Builder PDF or PDF uploaded in Files).
 * 4. Deal `agreement_url` string — external DocuSign/Drive links and legacy data.
 *
 * Buffered sends (`process-email-queue`) only re-join `deals` + optional `generated_files`, so the client
 * syncs `deals.agreement_url` when queueing when resolution comes from a file; the worker also
 * resolves `agreement_generated_file_id` so sends stay correct if URL was never backfilled.
 */

/*
 * Manual test vectors (computeResolvedAgreement + dealSyncPatchFromResolution), with a fixed origin where URLs resolve:
 *
 * 1) progressPanelUrl non-empty → progress_panel; url trimmed string; syncGeneratedFileId null;
 *    dealSyncPatch → { agreement_url, agreement_generated_file_id: null }.
 * 2) progress empty + pinned valid PDF → task_or_template_file; url from pinned; sync id = pinned.id;
 *    dealSyncPatch mirrors URL + FK.
 * 3) no progress, no pinned + dealFile valid PDF → deal_generated_file; sync id = deal file id.
 * 4) no files + dealAgreementUrl non-empty → deal_url_string; dealSyncPatch → null (legacy external link only).
 * 5) all inputs empty / invalid files → none; url null; no patch.
 *
 * Scope helpers: isGeneratedFileInScopeForTask rejects wrong venue_id/deal_id on file vs task;
 * isGeneratedFileInScopeForDeal rejects file venue mismatch with deal.venue_id.
 */

import type { GeneratedFile } from '../types'
import { isAgreementDocumentFileRow } from './files/agreementFileKinds'
import { resolveGeneratedFileDownloadUrl } from './files/resolveGeneratedFileDownloadUrl'
import { isValidAgreementPdfShareSlug } from './files/pdfSlugCanonical'
import { collectAgreementSiteOrigins } from './files/pdfShareUrl'

export type AgreementResolutionSource =
  | 'progress_panel'
  | 'task_or_template_file'
  | 'deal_generated_file'
  | 'deal_url_string'
  | 'none'

export type ResolvedAgreement = {
  url: string | null
  source: AgreementResolutionSource
  /**
   * When source is `task_or_template_file` or `deal_generated_file`, this is the file row to persist
   * on `deals.agreement_generated_file_id` when syncing for the worker / merge.
   * `progress_panel` clears the FK (external URL only).
   */
  syncGeneratedFileId: string | null
}

export function isValidAgreementPdfFile(
  file: GeneratedFile,
  siteOrigin: string
): boolean {
  if (!isAgreementDocumentFileRow(file)) return false
  return resolveGeneratedFileDownloadUrl(file, siteOrigin) != null
}

/** Enforce ownership and venue/deal scope for task/template-linked PDFs. */
export function isGeneratedFileInScopeForTask(
  file: GeneratedFile,
  userId: string,
  taskVenueId: string | null | undefined,
  taskDealId: string | null | undefined
): boolean {
  if (file.user_id !== userId) return false
  if (taskVenueId && file.venue_id != null && file.venue_id !== taskVenueId) return false
  if (taskDealId && file.deal_id != null && file.deal_id !== taskDealId) return false
  return true
}

/** Deal-level file: same user; venue must match deal.venue_id when both set. */
export function isGeneratedFileInScopeForDeal(
  file: GeneratedFile,
  userId: string,
  dealVenueId: string | null | undefined
): boolean {
  if (file.user_id !== userId) return false
  if (dealVenueId && file.venue_id != null && file.venue_id !== dealVenueId) return false
  return true
}

/** Drop poisoned first-party `/agreements/{bad}` saved on deals; keep external links unchanged. */
function sanitizeLegacyDealAgreementUrl(legacy: string, siteOrigin: string): string | null {
  const trimmed = legacy.trim()
  if (!trimmed) return null
  try {
    const u = new URL(trimmed)
    const known = collectAgreementSiteOrigins(siteOrigin)
    const m = u.pathname.match(/^\/agreements\/([^/]+)\/?$/i)
    if (m && known.has(u.origin)) {
      let seg: string
      try {
        seg = decodeURIComponent(m[1])
      } catch {
        return null
      }
      if (!isValidAgreementPdfShareSlug(seg)) return null
    }
    return trimmed
  } catch {
    return trimmed
  }
}

export function computeResolvedAgreement(params: {
  siteOrigin: string
  progressPanelUrl?: string | null
  /** Same precedence slot as task file (template immediate queue uses this). */
  pinnedFile?: GeneratedFile | null
  dealFile?: GeneratedFile | null
  dealAgreementUrl?: string | null
}): ResolvedAgreement {
  const origin = params.siteOrigin
  const pasted = params.progressPanelUrl?.trim()
  if (pasted) {
    return { url: pasted, source: 'progress_panel', syncGeneratedFileId: null }
  }

  if (params.pinnedFile && isValidAgreementPdfFile(params.pinnedFile, origin)) {
    const url = resolveGeneratedFileDownloadUrl(params.pinnedFile, origin)
    return {
      url,
      source: 'task_or_template_file',
      syncGeneratedFileId: params.pinnedFile.id,
    }
  }

  if (params.dealFile && isValidAgreementPdfFile(params.dealFile, origin)) {
    const url = resolveGeneratedFileDownloadUrl(params.dealFile, origin)
    return {
      url,
      source: 'deal_generated_file',
      syncGeneratedFileId: params.dealFile.id,
    }
  }

  const legacy = params.dealAgreementUrl?.trim()
  if (legacy) {
    const sanitized = sanitizeLegacyDealAgreementUrl(legacy, origin)
    if (sanitized) {
      return { url: sanitized, source: 'deal_url_string', syncGeneratedFileId: null }
    }
  }

  return { url: null, source: 'none', syncGeneratedFileId: null }
}

export type DealAgreementSyncPatch = {
  agreement_url: string
  agreement_generated_file_id: string | null
}

/** Builds DB patch when resolution should be persisted for buffered sends / merge. */
export function dealSyncPatchFromResolution(r: ResolvedAgreement): DealAgreementSyncPatch | null {
  if (!r.url) return null
  if (r.source === 'progress_panel') {
    return { agreement_url: r.url, agreement_generated_file_id: null }
  }
  if (r.source === 'task_or_template_file' || r.source === 'deal_generated_file') {
    return {
      agreement_url: r.url,
      agreement_generated_file_id: r.syncGeneratedFileId,
    }
  }
  return null
}

/** Resolve final agreement href for email payloads (deal FK + legacy URL only). */
export async function resolveDealAgreementUrlForEmailPayload(
  loadFileById: (id: string) => Promise<GeneratedFile | null>,
  deal: {
    agreement_url?: string | null
    agreement_generated_file_id?: string | null
  } | null | undefined,
  siteOrigin: string
): Promise<string | null> {
  if (!deal) return null
  let dealFile: GeneratedFile | null = null
  if (deal.agreement_generated_file_id) {
    dealFile = await loadFileById(deal.agreement_generated_file_id)
  }
  const r = computeResolvedAgreement({
    siteOrigin,
    progressPanelUrl: null,
    pinnedFile: null,
    dealFile:
      dealFile && isValidAgreementPdfFile(dealFile, siteOrigin)
        ? dealFile
        : null,
    dealAgreementUrl: deal.agreement_url ?? null,
  })
  return r.url
}
