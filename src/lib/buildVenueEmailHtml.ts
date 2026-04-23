// Frontend preview for venue emails — uses shared renderer with relative asset URLs.

import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import type { ArtistProfile } from '@/types'
import {
  buildVenueEmailDocument,
  type VenueRenderEmailType,
  type VenueRenderProfile,
  type VenueRenderDeal,
  type VenueRenderVenue,
  type VenueRenderRecipient,
} from '@/lib/email/renderVenueEmail'

export type PreviewEmailType = VenueRenderEmailType
export type PreviewProfile = VenueRenderProfile
export type PreviewDeal = VenueRenderDeal
export type PreviewVenue = VenueRenderVenue
export type PreviewRecipient = VenueRenderRecipient

/** Invoice link for template preview and “Send test to myself” — matches production HTML when no real file is queued. */
export const EMAIL_TEMPLATE_PREVIEW_INVOICE_URL = 'https://preview.example.com/invoice/mock.pdf'

export function buildVenueEmailHtml(
  type: PreviewEmailType,
  profile: PreviewProfile,
  recipient: PreviewRecipient,
  deal?: PreviewDeal,
  venue?: PreviewVenue,
  customIntro?: string | null,
  customSubject?: string | null,
  layout?: EmailTemplateLayoutV1 | null,
  invoiceUrl?: string | null,
  captureUrl?: string | null,
): string {
  return buildVenueEmailDocument({
    type,
    profile,
    recipient,
    deal,
    venue,
    customIntro,
    customSubject,
    layout,
    logoBaseUrl: publicSiteOrigin(),
    responsiveClasses: true,
    invoiceUrl: invoiceUrl ?? null,
    captureUrl: captureUrl ?? null,
  })
}

export const PREVIEW_MOCK_PROFILE: PreviewProfile = {
  artist_name: 'DJ Luijay',
  company_name: 'DJ Luijay LLC',
  manager_name: 'Alex Manager',
  manager_title: 'Artist Manager',
  from_email: 'management@updates.djluijay.live',
  reply_to_email: 'management@djluijay.live',
  /** Distinct press-kit style URL for merge previews and tests */
  website: 'https://press.mock.djluijay.example/press-kit',
  phone: '(305) 555-0182',
  social_handle: '@djluijay',
  tagline: 'Mock tagline (preview only)',
}

export const PREVIEW_MOCK_RECIPIENT: PreviewRecipient = {
  name: 'Mock Client Alex',
  email: 'alex@skylinebar.com',
}

/** Lead / venue-booker stand-in for `recipient.*` in custom lead template preview (iframe). */
export const PREVIEW_MOCK_RECIPIENT_LEAD: PreviewRecipient = {
  name: 'Mock Firstname Bookings',
  email: 'bookings.preview+mock@example.com',
}

export const PREVIEW_MOCK_VENUE: PreviewVenue = {
  name: 'Skyline Bar & Lounge',
  city: 'Miami',
  location: 'Downtown Miami',
}

export const PREVIEW_MOCK_DEAL: PreviewDeal = {
  description: 'DJ Set at Skyline Bar & Lounge',
  gross_amount: 500,
  amount_due_now: 250,
  total_paid_toward_gross: 250,
  remaining_client_balance: 250,
  event_date: '2026-05-17',
  payment_due_date: '2026-05-10',
  agreement_url: 'https://docs.google.com/document/d/preview-agreement-link',
  notes: 'Mock deal notes (preview only)',
}

/**
 * Merges live Settings profile with {@link PREVIEW_MOCK_PROFILE} for any null/empty field
 * so Email Templates preview and “Send test to myself” always show non-empty `profile.*` merge output.
 */
export function buildPreviewProfileForCustomTemplate(artist: ArtistProfile | null | undefined): PreviewProfile {
  const m = PREVIEW_MOCK_PROFILE
  if (!artist) {
    return { ...m }
  }
  const strOr = (v: string | null | undefined, fallback: string) => {
    const t = (v ?? '').trim()
    return t.length > 0 ? t : fallback
  }
  const strOrNull = (v: string | null | undefined, fallback: string | null) => {
    const t = (v ?? '').trim()
    return t.length > 0 ? t : (fallback && fallback.length > 0 ? fallback : null)
  }
  return {
    artist_name: strOr(artist.artist_name, m.artist_name ?? ''),
    company_name: strOr(artist.company_name, m.company_name ?? '') || null,
    from_email: strOr(artist.from_email, m.from_email ?? ''),
    reply_to_email: (() => {
      const a = (artist.reply_to_email ?? '').trim()
      if (a) return a
      const b = (m.reply_to_email ?? '').trim()
      return b || null
    })(),
    website: strOr(artist.website, m.website ?? ''),
    phone: strOr(artist.phone, m.phone ?? ''),
    social_handle: strOr(artist.social_handle, m.social_handle ?? ''),
    tagline: strOrNull(artist.tagline, m.tagline),
    manager_name: strOr(artist.manager_name, m.manager_name ?? ''),
    manager_title: strOr(artist.manager_title, m.manager_title ?? ''),
  }
}
