/** Must match `netlify/functions/public-agreement-pdf` slug rules (no drift). */
export const AGREEMENT_PDF_SHARE_SLUG_MAX_LEN = 220

const AGREEMENT_PDF_SHARE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/** Normalize site origin or base URL: trim and strip trailing slash. */
export function normalizeAgreementSiteOrigin(input: string): string {
  return input.trim().replace(/\/$/, '')
}

export function isValidAgreementPdfShareSlug(raw: string): boolean {
  const s = raw.trim().toLowerCase()
  if (!s || s.length > AGREEMENT_PDF_SHARE_SLUG_MAX_LEN) return false
  return AGREEMENT_PDF_SHARE_SLUG_RE.test(s)
}
