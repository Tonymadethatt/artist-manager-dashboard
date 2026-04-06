import type { GeneratedFile } from '../../types'

/**
 * Site origin for first-party agreement links.
 * Build: set `VITE_PUBLIC_SITE_URL` (e.g. in Netlify). Runtime: always uses `window.location.origin` in the browser so saves get the correct domain even when the env var is missing.
 */
export function publicSiteOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  if (env && /^https?:\/\//i.test(env.trim())) return env.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
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
  if (!base || base.length > 220 || isUuidOnlyStem(base)) return null
  const lower = base.toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lower)) return null
  return lower
}

/**
 * Canonical href for opening/copying/previewing a PDF: first-party `/agreements/{slug}` when possible.
 */
/**
 * Same as {@link resolvedPdfHref} but uses an explicit origin (e.g. Netlify `URL` env in workers).
 */
export function resolvedPdfHrefFromOrigin(file: GeneratedFile, origin: string): string | null {
  if (file.output_format !== 'pdf') return null
  const slug =
    file.pdf_share_slug?.trim().toLowerCase() ||
    inferredPdfSlugFromStoragePath(file.pdf_storage_path)
  const base = origin.trim().replace(/\/$/, '')
  if (slug && base) return `${base}/agreements/${slug}`
  return file.pdf_public_url?.trim() || null
}

export function resolvedPdfHref(file: GeneratedFile): string | null {
  return resolvedPdfHrefFromOrigin(file, publicSiteOrigin())
}

export function hasResolvablePdfLink(file: GeneratedFile): boolean {
  return resolvedPdfHref(file) != null
}
