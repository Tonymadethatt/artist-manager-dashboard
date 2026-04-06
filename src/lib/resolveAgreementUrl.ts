/**
 * Agreement link resolution — single product precedence (do not reorder silently):
 *
 * 1. Progress panel / options `agreementUrl` — explicit paste from the venue flow (highest intent).
 * 2. Task or template item `generated_file_id` → PDF row → share/public URL (overrides deal file for this step).
 * 3. Deal `agreement_generated_file_id` → PDF row → URL (canonical file on the deal).
 * 4. Deal `agreement_url` string — external DocuSign/Drive links and legacy data.
 *
 * Buffered sends (`process-email-queue`) only re-join `deals` + optional `generated_files`, so the client
 * syncs `deals.agreement_url` when queueing when resolution comes from a file; the worker also
 * resolves `agreement_generated_file_id` so sends stay correct if URL was never backfilled.
 */

import type { GeneratedFile } from '../types'
import { resolvedPdfHrefFromOrigin } from './files/pdfShareUrl'

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
  if (file.output_format !== 'pdf') return false
  return resolvedPdfHrefFromOrigin(file, siteOrigin) != null
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
    const url = resolvedPdfHrefFromOrigin(params.pinnedFile, origin)
    return {
      url,
      source: 'task_or_template_file',
      syncGeneratedFileId: params.pinnedFile.id,
    }
  }

  if (params.dealFile && isValidAgreementPdfFile(params.dealFile, origin)) {
    const url = resolvedPdfHrefFromOrigin(params.dealFile, origin)
    return {
      url,
      source: 'deal_generated_file',
      syncGeneratedFileId: params.dealFile.id,
    }
  }

  const legacy = params.dealAgreementUrl?.trim()
  if (legacy) {
    return { url: legacy, source: 'deal_url_string', syncGeneratedFileId: null }
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
