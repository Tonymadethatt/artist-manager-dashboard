import type { ArtistProfile, Contact, Deal, TemplateSection, Venue } from '../../types'
import { isDealPricingSnapshot } from '../../types'
import { COMMISSION_TIER_LABELS, VENUE_TYPE_LABELS } from '../../types'
import { utcIsoToPacificDateAndTime } from '@/lib/calendar/pacificWallTime'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

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
    out.venue_type_label = VENUE_TYPE_LABELS[venue.venue_type]
    const dt = venue.deal_terms
    if (dt?.event_date) out.event_date = String(dt.event_date)
    if (dt?.pay != null) {
      out.artist_pay = String(dt.pay)
      if (!Number.isNaN(dt.pay)) out.artist_pay_display = usd.format(dt.pay)
    }
    if (dt?.set_length) out.set_length = String(dt.set_length)
    if (dt?.load_in_time) out.load_in_time = String(dt.load_in_time)
    if (dt?.notes) out.notes = String(dt.notes)
    if (venue.capacity?.trim()) out.venue_capacity = venue.capacity.trim()
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

const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** Plain-text lines for templates; only when `pricing_snapshot` exists on the deal. */
export function pricingSnapshotAgreementFields(deal: Deal): Record<string, string> {
  if (!deal.pricing_snapshot || !isDealPricingSnapshot(deal.pricing_snapshot)) return {}
  const s = deal.pricing_snapshot
  const lines: string[] = []
  lines.push(`Quote total: ${usdWhole.format(s.total)}`)
  if (s.taxAmount) lines.push(`Tax: ${usdWhole.format(s.taxAmount)}`)
  if (s.depositDue) lines.push(`Deposit: ${usdWhole.format(s.depositDue)}`)
  lines.push(`Basis: ${s.finalSource === 'manual' ? 'manual gross on deal' : 'calculator'}`)
  return {
    pricing_summary_text: lines.join('\n'),
    pricing_total_display: usdWhole.format(s.total),
    pricing_deposit_display: usdWhole.format(s.depositDue),
  }
}

function pacificWallParts(iso: string | null | undefined): { date: string; time: string } | null {
  if (!iso) return null
  return utcIsoToPacificDateAndTime(iso)
}

/** Prefill for File Builder: venue, profile, optional deal, optional contact for merge fields. */
export function buildAgreementPrefill(
  venue: Venue | null,
  profile: ArtistProfile | null,
  deal: Deal | null,
  mergeContact: Contact | null,
  onsiteContact: Contact | null = null,
): Record<string, string> {
  const out = { ...buildVenueProfilePrefill(venue, profile) }

  if (deal) {
    out.deal_description = deal.description
    out.event_name = deal.description
    if (deal.event_date) {
      out.deal_event_date = deal.event_date
      out.event_date = deal.event_date
    }
    const evS = pacificWallParts(deal.event_start_at)
    const evE = pacificWallParts(deal.event_end_at)
    if (evS) {
      out.event_start_time = evS.time
      out.event_date_display = deal.event_date?.trim() || evS.date
    }
    if (evE) out.event_end_time = evE.time
    if (evS && evE) {
      out.event_window_display = `${evS.date} ${evS.time}–${evE.time}`
    } else if (evS) {
      out.event_window_display = `${evS.date} ${evS.time}`
    }

    const pfS = pacificWallParts(deal.performance_start_at)
    const pfE = pacificWallParts(deal.performance_end_at)
    if (pfS) {
      out.performance_start_time = pfS.time
      out.performance_date_display = deal.event_date?.trim() || pfS.date
    }
    if (pfE) out.performance_end_time = pfE.time
    if (pfS && pfE) {
      out.performance_window_display = `${pfS.date} ${pfS.time}–${pfE.time}`
    } else if (pfS) {
      out.performance_window_display = `${pfS.date} ${pfS.time}`
    }
    if (deal.performance_genre?.trim()) out.performance_genre = deal.performance_genre.trim()

    out.gross_amount = String(deal.gross_amount)
    out.gross_amount_display = usd.format(deal.gross_amount)
    // Match Earnings UI: stored as fraction (0.2), agreements show as percent (20%)
    out.commission_rate = `${Math.round(deal.commission_rate * 100)}%`
    out.commission_rate_fraction = String(deal.commission_rate)
    out.commission_amount = String(deal.commission_amount)
    out.commission_amount_display = usd.format(deal.commission_amount)
    out.commission_tier = COMMISSION_TIER_LABELS[deal.commission_tier]
    if (deal.payment_due_date) out.payment_due_date = deal.payment_due_date
    if (deal.agreement_url) out.agreement_url = deal.agreement_url
    if (deal.notes?.trim()) out.deal_notes = deal.notes.trim()
    Object.assign(out, pricingSnapshotAgreementFields(deal))

    const cap =
      venue?.capacity?.trim() ||
      deal.venue?.capacity?.trim() ||
      ''
    if (cap) out.venue_capacity = cap
  }

  if (mergeContact) {
    out.contact_name = mergeContact.name
    if (mergeContact.role) out.contact_role = mergeContact.role
    if (mergeContact.email) out.contact_email = mergeContact.email
    if (mergeContact.phone) out.contact_phone = mergeContact.phone
    if (mergeContact.company?.trim()) {
      const co = mergeContact.company.trim()
      out.contact_company = co
      // Many templates use {{company_name}} for the counterparty; fill from contact when Settings artist company is empty.
      if (!out.company_name?.trim()) out.company_name = co
    }
  }

  if (onsiteContact) {
    out.onsite_contact_name = onsiteContact.name
    if (onsiteContact.role?.trim()) out.onsite_contact_role = onsiteContact.role.trim()
    if (onsiteContact.email?.trim()) out.onsite_contact_email = onsiteContact.email.trim()
    if (onsiteContact.phone?.trim()) out.onsite_contact_phone = onsiteContact.phone.trim()
    if (onsiteContact.company?.trim()) out.onsite_contact_company = onsiteContact.company.trim()
  }

  return out
}
