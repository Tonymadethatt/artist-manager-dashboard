import type { GeneratedFile } from '../../types'
import { isAgreementDocumentFileRow } from './agreementFileKinds'
import {
  AGREEMENT_PDF_SHARE_SLUG_MAX_LEN,
  isValidAgreementPdfShareSlug,
  normalizeAgreementSiteOrigin,
} from './pdfSlugCanonical'

/**
 * Site origin for first-party agreement links.
 * Build: set `VITE_PUBLIC_SITE_URL` (e.g. in Netlify). Runtime: always uses `window.location.origin` in the browser so saves get the correct domain even when the env var is missing.
 */
export function publicSiteOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  if (env && /^https?:\/\//i.test(env.trim())) return normalizeAgreementSiteOrigin(env)
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

/** Origins that may host first-party `/agreements/{slug}` links (custom domain + Netlify + local). */
export function collectAgreementSiteOrigins(primaryOrigin: string): Set<string> {
  const out = new Set<string>()
  const add = (s: string) => {
    const n = normalizeAgreementSiteOrigin(s)
    if (n) out.add(n)
  }
  add(primaryOrigin)
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_PUBLIC_SITE_URL) {
    add(import.meta.env.VITE_PUBLIC_SITE_URL as string)
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    add(window.location.origin)
  }
  const nodeProc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
  if (nodeProc?.env) {
    add(nodeProc.env.URL || '')
    add(nodeProc.env.DEPLOY_PRIME_URL || '')
    add(nodeProc.env.DEPLOY_URL || '')
    add('https://artist-manager-dashboard.netlify.app')
  }
  return out
}

/**
 * If `pdf_public_url` points at our site with a non-canonical slug, drop it (same as handler 400).
 * External origins with `/agreements/...` are left unchanged.
 */
export function filterPoisonedFirstPartyAgreementPublicUrl(
  urlStr: string,
  knownOrigins: ReadonlySet<string>,
): string | null {
  const raw = urlStr.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    const m = u.pathname.match(/^\/agreements\/([^/]+)\/?$/i)
    if (m && knownOrigins.has(u.origin)) {
      let seg: string
      try {
        seg = decodeURIComponent(m[1]).trim().toLowerCase()
      } catch {
        return null
      }
      if (!isValidAgreementPdfShareSlug(seg)) return null
    }
    return raw
  } catch {
    return raw
  }
}

/** Detect legacy storage keys that were only `{uuid}.pdf` (no readable slug). */
function isUuidOnlyStem(stem: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(stem)
}

/**
 * When `pdf_share_slug` is null but the object was stored as `{user}/{slug}.pdf`,
 * recover the slug for display/copy (function resolves by slug the same way).
 */
export function inferredPdfSlugFromStoragePath(pdf_storage_path: string | null): string | null {
  if (!pdf_storage_path) return null
  const base = pdf_storage_path.split('/').pop()?.replace(/\.pdf$/i, '') ?? ''
  if (!base || base.length > AGREEMENT_PDF_SHARE_SLUG_MAX_LEN || isUuidOnlyStem(base)) return null
  const lower = base.toLowerCase()
  if (!isValidAgreementPdfShareSlug(lower)) return null
  return lower
}

/** Supabase project URL for building storage public links (browser + Netlify). */
function supabaseProjectRootUrl(): string | null {
  const vite =
    typeof import.meta !== 'undefined'
      ? (import.meta.env?.VITE_SUPABASE_URL as string | undefined)
      : undefined
  if (vite?.trim()) return normalizeAgreementSiteOrigin(vite)
  const nodeProc = (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process
  const u = nodeProc?.env?.SUPABASE_URL?.trim()
  if (u) return normalizeAgreementSiteOrigin(u)
  return null
}

/**
 * Direct public object URL for agreement-pdfs bucket (works when slug/share link is broken).
 * Requires a public bucket (or anon-readable policy on the object path).
 */
export function agreementPdfSupabaseStoragePublicUrl(file: GeneratedFile): string | null {
  if (file.output_format !== 'pdf') return null
  const path = file.pdf_storage_path?.trim()
  if (!path) return null
  const root = supabaseProjectRootUrl()
  if (!root) return null
  const segments = path.split('/').filter(Boolean).map(s => encodeURIComponent(s))
  if (segments.length === 0) return null
  return `${root}/storage/v1/object/public/agreement-pdfs/${segments.join('/')}`
}

/**
 * Canonical href for opening/copying/previewing a PDF: first-party `/agreements/{slug}` when possible.
 */
/**
 * Same as {@link resolvedPdfHref} but uses an explicit origin (e.g. Netlify `URL` env in workers).
 */
export function resolvedPdfHrefFromOrigin(file: GeneratedFile, origin: string): string | null {
  if (file.output_format !== 'pdf') return null
  const fromCol = file.pdf_share_slug?.trim().toLowerCase() ?? ''
  const slugFromCol = fromCol && isValidAgreementPdfShareSlug(fromCol) ? fromCol : null
  const slug = slugFromCol ?? inferredPdfSlugFromStoragePath(file.pdf_storage_path)

  const base = normalizeAgreementSiteOrigin(origin)
  const known = collectAgreementSiteOrigins(origin)
  if (slug && base) return `${base}/agreements/${slug}`

  const rawPublic = file.pdf_public_url?.trim()
  if (rawPublic) {
    const filtered = filterPoisonedFirstPartyAgreementPublicUrl(rawPublic, known)
    if (filtered) return filtered
  }
  return agreementPdfSupabaseStoragePublicUrl(file)
}

export function resolvedPdfHref(file: GeneratedFile): string | null {
  return resolvedPdfHrefFromOrigin(file, publicSiteOrigin())
}

/** PDF row the user can attach to a deal (picker): File Builder PDFs + PDF uploads in Files. */
export function isSelectableAgreementPdfFile(f: GeneratedFile): boolean {
  if (!isAgreementDocumentFileRow(f)) return false
  if (f.output_format === 'pdf') {
    if (f.pdf_storage_path?.trim()) return true
    return resolvedPdfHref(f) != null
  }
  return Boolean(f.upload_public_url?.trim())
}

export function hasResolvablePdfLink(file: GeneratedFile): boolean {
  return resolvedPdfHref(file) != null
}
