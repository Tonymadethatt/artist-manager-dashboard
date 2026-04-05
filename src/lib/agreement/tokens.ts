import type { ArtistProfile, Contact, Deal, TemplateSection, Venue } from '@/types'
import { COMMISSION_TIER_LABELS } from '@/types'

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
    out.venue_type = venue.venue_type
    const dt = venue.deal_terms
    if (dt?.event_date) out.event_date = String(dt.event_date)
    if (dt?.pay != null) out.artist_pay = String(dt.pay)
    if (dt?.set_length) out.set_length = String(dt.set_length)
    if (dt?.load_in_time) out.load_in_time = String(dt.load_in_time)
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
    if (profile.social_handle) out.social_handle = profile.social_handle
    if (profile.from_email) out.from_email = profile.from_email
    if (profile.manager_name) out.manager_name = profile.manager_name
    if (profile.manager_email) out.manager_email = profile.manager_email
  }
  return out
}

/** Prefill for File Builder: venue, profile, optional deal, optional primary contact. */
export function buildAgreementPrefill(
  venue: Venue | null,
  profile: ArtistProfile | null,
  deal: Deal | null,
  primaryContact: Contact | null
): Record<string, string> {
  const out = { ...buildVenueProfilePrefill(venue, profile) }

  if (deal) {
    out.deal_description = deal.description
    if (deal.event_date) {
      out.deal_event_date = deal.event_date
      out.event_date = deal.event_date
    }
    out.gross_amount = String(deal.gross_amount)
    out.commission_rate = String(deal.commission_rate)
    out.commission_amount = String(deal.commission_amount)
    out.commission_tier = COMMISSION_TIER_LABELS[deal.commission_tier]
    if (deal.payment_due_date) out.payment_due_date = deal.payment_due_date
    if (deal.agreement_url) out.agreement_url = deal.agreement_url
  }

  if (primaryContact) {
    out.contact_name = primaryContact.name
    if (primaryContact.role) out.contact_role = primaryContact.role
    if (primaryContact.email) out.contact_email = primaryContact.email
    if (primaryContact.phone) out.contact_phone = primaryContact.phone
  }

  return out
}
