/**
 * Public facing form chrome — branding from `artist_profile`, returned by Netlify preflight + dashboard hooks.
 */

export type PublicFormBranding = {
  company_name: string | null
  artist_name: string
  tagline: string | null
  manager_name: string | null
  manager_title: string | null
  website: string | null
  social_handle: string | null
  phone: string | null
  reply_to_email: string | null
  from_email: string | null
  manager_email: string | null
}

const DEFAULT_PRIMARY = 'DJ Luijay LLC'
const DEFAULT_DESCRIPTOR = 'management and brand growth'

export const DEFAULT_PUBLIC_FORM_BRANDING: PublicFormBranding = {
  company_name: null,
  artist_name: 'DJ Luijay',
  tagline: null,
  manager_name: null,
  manager_title: null,
  website: null,
  social_handle: null,
  phone: null,
  reply_to_email: null,
  from_email: null,
  manager_email: null,
}

/** Primary brand line — mirrors logic in `buildVenueClientEmailHeaderBrandInnerHtml`. */
export function publicFormBrandPrimaryLine(b: PublicFormBranding): string {
  return b.company_name?.trim() || b.artist_name?.trim() || DEFAULT_PRIMARY
}

/** Secondary / tagline line — uses profile tagline or email default descriptor. */
export function publicFormBrandSecondaryLine(b: PublicFormBranding): string {
  return b.tagline?.trim() || DEFAULT_DESCRIPTOR
}

export function brandingFromArtistProfileRow(
  row: {
    company_name?: string | null
    artist_name?: string | null
    tagline?: string | null
    manager_name?: string | null
    manager_title?: string | null
    website?: string | null
    social_handle?: string | null
    phone?: string | null
    reply_to_email?: string | null
    from_email?: string | null
    manager_email?: string | null
  } | null,
): PublicFormBranding {
  if (!row) return { ...DEFAULT_PUBLIC_FORM_BRANDING }
  return {
    company_name: row.company_name ?? null,
    artist_name: row.artist_name?.trim() || DEFAULT_PUBLIC_FORM_BRANDING.artist_name,
    tagline: row.tagline ?? null,
    manager_name: row.manager_name ?? null,
    manager_title: row.manager_title ?? null,
    website: row.website ?? null,
    social_handle: row.social_handle ?? null,
    phone: row.phone ?? null,
    reply_to_email: row.reply_to_email ?? null,
    from_email: row.from_email ?? null,
    manager_email: row.manager_email ?? null,
  }
}

/** Reply mailto target — same priority as sensible outbound email. */
export function publicFormReplyAddress(b: PublicFormBranding): string | null {
  const r = b.reply_to_email?.trim() || b.from_email?.trim() || b.manager_email?.trim() || ''
  return r || null
}

/** Merge Netlify JSON `branding` into defaults. */
export function mergePublicFormBranding(raw: unknown): PublicFormBranding {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PUBLIC_FORM_BRANDING }
  return { ...DEFAULT_PUBLIC_FORM_BRANDING, ...(raw as Partial<PublicFormBranding>) }
}
