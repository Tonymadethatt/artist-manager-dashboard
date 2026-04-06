/**
 * Server-side guard for attachment hrefs passed into marketing email HTML.
 * Only Supabase public objects in known buckets, or first-party /agreements/ pages.
 */

function normalizeOrigin(input: string): string {
  return input.trim().replace(/\/$/, '')
}

export function isAllowedEmailAttachmentUrl(url: string, supabaseProjectUrl: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:') return false
    const supa = new URL(normalizeOrigin(supabaseProjectUrl))
    if (u.origin !== supa.origin) return false
    const p = u.pathname
    return (
      p.includes('/storage/v1/object/public/email-assets/') ||
      p.includes('/storage/v1/object/public/agreement-pdfs/')
    )
  } catch {
    return false
  }
}

export function isAllowedAgreementPageAttachmentUrl(url: string, siteUrl: string): boolean {
  if (!url || typeof url !== 'string') return false
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    const site = new URL(normalizeOrigin(siteUrl))
    return u.origin === site.origin && u.pathname.startsWith('/agreements/')
  } catch {
    return false
  }
}

export function sanitizeEmailAttachmentPayload(
  raw: unknown,
  opts: { supabaseUrl: string; siteUrl: string },
): { url: string; fileName: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { url?: unknown; fileName?: unknown; file_name?: unknown }
  const url = typeof o.url === 'string' ? o.url.trim() : ''
  const fileName = (typeof o.fileName === 'string' ? o.fileName : typeof o.file_name === 'string' ? o.file_name : '')
    .trim()
    .slice(0, 200)
  if (!url || !fileName) return null
  if (
    isAllowedEmailAttachmentUrl(url, opts.supabaseUrl) ||
    isAllowedAgreementPageAttachmentUrl(url, opts.siteUrl)
  ) {
    return { url, fileName }
  }
  return null
}
