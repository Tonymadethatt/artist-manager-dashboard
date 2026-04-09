/** Embeds machine-readable payload in `tasks.notes` for deal gross reconciliation from show reports. */

export const DEAL_GROSS_RECONCILIATION_PREFIX = '__deal_gross_reconciliation__:'

export type DealGrossReconciliationPayload = {
  performance_report_id: string
  deal_id: string
  gross_on_file: number
  reported_fee_total: number
}

export function formatDealGrossReconciliationNotes(p: DealGrossReconciliationPayload): string {
  return `${DEAL_GROSS_RECONCILIATION_PREFIX}${JSON.stringify(p)}`
}

export function parseDealGrossReconciliationNotes(
  notes: string | null | undefined,
): DealGrossReconciliationPayload | null {
  if (!notes || !notes.startsWith(DEAL_GROSS_RECONCILIATION_PREFIX)) return null
  try {
    const raw = notes.slice(DEAL_GROSS_RECONCILIATION_PREFIX.length)
    const o = JSON.parse(raw) as DealGrossReconciliationPayload
    if (
      typeof o.performance_report_id === 'string' &&
      typeof o.deal_id === 'string' &&
      typeof o.gross_on_file === 'number' &&
      typeof o.reported_fee_total === 'number' &&
      Number.isFinite(o.gross_on_file) &&
      Number.isFinite(o.reported_fee_total)
    ) {
      return o
    }
  } catch {
    /* ignore */
  }
  return null
}
