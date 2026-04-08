/** Prefix for `venue_emails.notes` when `invoice_sent` carries a resolved PDF/link for send time. */
export const INVOICE_LINK_PENDING_PREFIX = 'invoice_link:' as const

export type InvoiceLinkQueuePayload = {
  url: string
}

export function serializeInvoiceQueueNotes(p: InvoiceLinkQueuePayload): string {
  return INVOICE_LINK_PENDING_PREFIX + JSON.stringify(p)
}

export function parseInvoiceQueueNotes(notes: string | null | undefined): InvoiceLinkQueuePayload | null {
  if (!notes?.startsWith(INVOICE_LINK_PENDING_PREFIX)) return null
  try {
    const raw = JSON.parse(notes.slice(INVOICE_LINK_PENDING_PREFIX.length)) as InvoiceLinkQueuePayload
    return typeof raw?.url === 'string' && raw.url.trim() ? raw : null
  } catch {
    return null
  }
}
