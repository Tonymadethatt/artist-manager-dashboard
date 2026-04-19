// Frontend preview for venue emails — uses shared renderer with relative asset URLs.

import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
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
  website: 'https://djluijay.com',
  phone: '(305) 555-0182',
  social_handle: '@djluijay',
  /** Null so client email header preview uses default descriptor line. */
  tagline: null,
}

export const PREVIEW_MOCK_RECIPIENT: PreviewRecipient = {
  name: 'Alex Johnson',
  email: 'alex@skylinebar.com',
}

export const PREVIEW_MOCK_VENUE: PreviewVenue = {
  name: 'Skyline Bar & Lounge',
  city: 'Miami',
  location: 'Downtown Miami',
}

export const PREVIEW_MOCK_DEAL: PreviewDeal = {
  description: 'DJ Set at Skyline Bar & Lounge',
  gross_amount: 500,
  event_date: '2026-05-17',
  payment_due_date: '2026-05-10',
  agreement_url: 'https://docs.google.com/document/d/preview-agreement-link',
  notes: null,
  /** Sample window so preview matches artist-style stacked “when” cells when instants exist. */
  event_start_at: '2026-05-18T03:00:00.000Z',
  event_end_at: '2026-05-18T07:00:00.000Z',
  performance_start_at: '2026-05-18T04:00:00.000Z',
  performance_end_at: '2026-05-18T06:30:00.000Z',
}
