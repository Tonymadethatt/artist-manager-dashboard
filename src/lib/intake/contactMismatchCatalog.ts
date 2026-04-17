/**
 * Contact “who’s on the line?” buckets for intake — shared by venue JSON schema and contact title mapping.
 * Kept free of `@/` imports so Netlify function bundles (esbuild) can depend on it via relative paths.
 */

/** Phase 1 — substantive context (venue_data). Who’s on the line when not the contact on file. */
export const CONTACT_MISMATCH_CONTEXT_KEYS = [
  '',
  'talent_buyer',
  'event_planner',
  'day_of_coordinator',
  'wedding_planner',
  'agency_rep',
  'venue_manager',
  'production',
  'hospitality_manager',
  'marketing_pr',
  'billing',
  'owner',
  'assistant',
  'security_box',
  'other_party',
] as const

export type Phase1ContactMismatchContextV3 = (typeof CONTACT_MISMATCH_CONTEXT_KEYS)[number]

export const CONTACT_MISMATCH_CONTEXT_LABELS: Record<Exclude<Phase1ContactMismatchContextV3, ''>, string> = {
  talent_buyer: 'Talent buyer / booker',
  event_planner: 'Event planner / producer',
  day_of_coordinator: 'Day-of coordinator',
  wedding_planner: 'Wedding / private planner',
  agency_rep: 'Agency / rep',
  venue_manager: 'Venue manager / ops',
  production: 'Production / tech',
  hospitality_manager: 'Hospitality / F&B',
  marketing_pr: 'Marketing / PR',
  billing: 'Billing / AP',
  owner: 'Owner / principal',
  assistant: 'Assistant / coordinator',
  security_box: 'Security / box office / door',
  other_party: 'Other',
}

/** Non-empty keys in call-flow order (dropdowns). */
export const CONTACT_MISMATCH_ROLE_ORDER = CONTACT_MISMATCH_CONTEXT_KEYS.filter(
  (k): k is Exclude<Phase1ContactMismatchContextV3, ''> => k !== '',
)
