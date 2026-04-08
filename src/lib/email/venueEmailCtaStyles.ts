/**
 * Venue / client HTML email — primary form CTA (yellow → orange) and document links.
 * Keep in sync across renderVenueEmail + renderCustomEmail.
 */

/** Capture / form link — gradient #fbce1b → #f16d1a, weight matches typical UI buttons (600). */
export const VENUE_EMAIL_CAPTURE_BUTTON_STYLE =
  'display:inline-block;background:linear-gradient(135deg,#fbce1b 0%,#f16d1a 100%);color:#000000;font-size:14px;font-weight:600;padding:12px 28px;border-radius:9999px;text-decoration:none;line-height:1.25'

/** Agreement / invoice / open-document actions (secondary to the capture pill). */
export const VENUE_EMAIL_DOC_BUTTON_STYLE =
  'display:inline-block;background:#22c55e;color:#000000;font-weight:600;font-size:13px;padding:12px 24px;border-radius:6px;text-decoration:none;letter-spacing:0.02em'
