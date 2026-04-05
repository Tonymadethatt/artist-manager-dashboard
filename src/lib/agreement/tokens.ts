import type { ArtistProfile } from '@/types'
import type { TemplateSection } from '@/types'
import type { Venue } from '@/types'

/** Variable names referenced as `{{name}}` in section bodies. */
export function extractVariableNames(sections: TemplateSection[]): string[] {
  const combined = sections.map(s => s.content).join('\n')
  const matches = combined.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map(m => m[1]))]
}

/**
 * Deterministic prefill from venue + artist profile for common token names.
 * User edits still win — merge this as defaults when venue/profile changes.
 */
export function buildVenueProfilePrefill(venue: Venue | null, profile: ArtistProfile | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (venue) {
    out.venue_name = venue.name
    if (venue.city) out.city = venue.city
    if (venue.location) out.location = venue.location
    const dt = venue.deal_terms
    if (dt?.event_date) out.event_date = String(dt.event_date)
    if (dt?.pay != null) out.artist_pay = String(dt.pay)
    if (dt?.set_length) out.set_length = String(dt.set_length)
    if (dt?.notes) out.notes = String(dt.notes)
  }
  if (profile) {
    out.artist_name = profile.artist_name
    if (profile.company_name) out.company_name = profile.company_name
    if (profile.tagline) out.tagline = profile.tagline
    if (profile.website) out.website = profile.website
    if (profile.phone) out.phone = profile.phone
    if (profile.reply_to_email) out.reply_to_email = profile.reply_to_email
    if (profile.artist_email) out.artist_email = profile.artist_email
  }
  return out
}
