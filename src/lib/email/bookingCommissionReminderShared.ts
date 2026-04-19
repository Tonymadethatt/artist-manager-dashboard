/**
 * Shared types and preview data for booking commission reminder emails.
 * Kept separate from HTML builders so server bundles can import without pulling large templates.
 */

export type BookingCommissionLineItem = {
  venueName: string
  /** YYYY-MM-DD or "TBD" when no date */
  eventDateYmd: string
  gigGross: number
  commissionRatePercent: number
  commissionAmount: number
}

/** Sample rows for template preview when no live data is passed. */
export const PREVIEW_BOOKING_COMMISSION_LINE_ITEMS: BookingCommissionLineItem[] = [
  {
    venueName: 'Skyline Bar & Lounge',
    eventDateYmd: '2026-05-17',
    gigGross: 2500,
    commissionRatePercent: 15,
    commissionAmount: 375,
  },
  {
    venueName: 'Harbor Room',
    eventDateYmd: '2026-06-03',
    gigGross: 1800,
    commissionRatePercent: 15,
    commissionAmount: 270,
  },
]
