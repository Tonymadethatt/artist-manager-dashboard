import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_META_TAGLINE } from './emailDarkSurfacePalette'

const DEFAULT_PRIMARY = 'DJ Luijay LLC'
const DEFAULT_DESCRIPTOR = 'management and brand growth'

export type VenueClientHeaderProfile = {
  company_name: string | null
  artist_name: string
  tagline: string | null
}

/** Two-line brand block under the logo for venue / client-facing emails (built-in + custom venue). */
export function buildVenueClientEmailHeaderBrandInnerHtml(profile: VenueClientHeaderProfile): string {
  const primary = profile.company_name?.trim() || profile.artist_name?.trim() || DEFAULT_PRIMARY
  const secondary = profile.tagline?.trim() || DEFAULT_DESCRIPTOR
  return `<div style="font-size:15px;font-weight:700;color:#ffffff;letter-spacing:0.02em;line-height:1.3;">${escapeHtmlPlain(primary)}</div>
      <div style="font-size:10px;font-weight:500;color:${EMAIL_META_TAGLINE};margin-top:5px;line-height:1.45;letter-spacing:0.02em;">${escapeHtmlPlain(secondary)}</div>`
}

export function venueClientEmailLogoAlt(profile: VenueClientHeaderProfile): string {
  return profile.company_name?.trim() || profile.artist_name?.trim() || DEFAULT_PRIMARY
}
