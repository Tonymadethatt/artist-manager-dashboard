import {
  CONTACT_MISMATCH_ROLE_ORDER,
  type Phase1ContactMismatchContextV3,
} from '../intake/contactMismatchCatalog'
import type { Contact } from '../../types'

type Mismatch = Exclude<Phase1ContactMismatchContextV3, ''>

/**
 * Single source of truth for every {@link ContactTitleSelect} and `contacts.title_key` value in the app.
 * Edit this array only — groups/labels/mismatch buckets derive from it.
 */
const CONTACT_TITLE_ROWS = [
  // Venue & nightlife
  { key: 'venue_general_manager', group: 'Venue & nightlife', label: 'General manager (venue)', m: 'venue_manager' },
  { key: 'venue_manager', group: 'Venue & nightlife', label: 'Venue manager', m: 'venue_manager' },
  { key: 'assistant_venue_manager', group: 'Venue & nightlife', label: 'Assistant venue manager', m: 'venue_manager' },
  { key: 'operations_manager', group: 'Venue & nightlife', label: 'Operations manager', m: 'venue_manager' },
  { key: 'talent_buyer', group: 'Venue & nightlife', label: 'Talent buyer', m: 'talent_buyer' },
  { key: 'talent_booker', group: 'Venue & nightlife', label: 'Booker', m: 'talent_buyer' },
  { key: 'promoter_owner', group: 'Venue & nightlife', label: 'Promoter / owner', m: 'owner' },
  { key: 'production_manager', group: 'Venue & nightlife', label: 'Production manager', m: 'production' },
  { key: 'technical_director', group: 'Venue & nightlife', label: 'Technical director', m: 'production' },
  { key: 'on_site_tech', group: 'Venue & nightlife', label: 'On-site tech', m: 'production' },
  { key: 'audio_engineer', group: 'Venue & nightlife', label: 'Audio engineer / A1', m: 'production' },
  { key: 'stage_manager', group: 'Venue & nightlife', label: 'Stage manager', m: 'production' },
  { key: 'lighting_director', group: 'Venue & nightlife', label: 'Lighting director', m: 'production' },
  { key: 'hospitality_fb', group: 'Venue & nightlife', label: 'Hospitality / F&B', m: 'hospitality_manager' },
  { key: 'security_lead', group: 'Venue & nightlife', label: 'Security lead', m: 'security_box' },
  { key: 'box_office', group: 'Venue & nightlife', label: 'Box office / door', m: 'security_box' },
  // Events
  { key: 'event_planner', group: 'Events & private', label: 'Event planner / producer', m: 'event_planner' },
  { key: 'wedding_planner', group: 'Events & private', label: 'Wedding / private planner', m: 'wedding_planner' },
  { key: 'day_of_coordinator', group: 'Events & private', label: 'Day-of coordinator', m: 'day_of_coordinator' },
  { key: 'showcaller', group: 'Events & private', label: 'Showcaller', m: 'day_of_coordinator' },
  // Brand & marketing
  { key: 'client', group: 'Brand & marketing', label: 'Client', m: 'other_party' },
  { key: 'brand_manager', group: 'Brand & marketing', label: 'Brand manager', m: 'marketing_pr' },
  { key: 'marketing_manager', group: 'Brand & marketing', label: 'Marketing manager', m: 'marketing_pr' },
  { key: 'sponsorship_manager', group: 'Brand & marketing', label: 'Sponsorship manager', m: 'marketing_pr' },
  { key: 'public_relations', group: 'Brand & marketing', label: 'Public relations', m: 'marketing_pr' },
  { key: 'creative_director', group: 'Brand & marketing', label: 'Creative director', m: 'marketing_pr' },
  // Business & representation
  { key: 'ceo', group: 'Business & representation', label: 'CEO', m: 'owner' },
  { key: 'co_owner', group: 'Business & representation', label: 'Co-owner / partner', m: 'owner' },
  { key: 'managing_partner', group: 'Business & representation', label: 'Managing partner', m: 'owner' },
  { key: 'agency_rep', group: 'Business & representation', label: 'Agency / rep', m: 'agency_rep' },
  { key: 'business_manager', group: 'Business & representation', label: 'Business manager', m: 'agency_rep' },
  { key: 'accounting_ap', group: 'Business & representation', label: 'Accounting / AP', m: 'billing' },
  { key: 'billing_contact', group: 'Business & representation', label: 'Billing contact', m: 'billing' },
  { key: 'legal_counsel', group: 'Business & representation', label: 'Legal counsel', m: 'other_party' },
  { key: 'executive_assistant', group: 'Business & representation', label: 'Executive assistant', m: 'assistant' },
  { key: 'personal_assistant', group: 'Business & representation', label: 'Personal assistant', m: 'assistant' },
  // Personal & family
  { key: 'husband', group: 'Personal & family', label: 'Husband', m: 'other_party' },
  { key: 'wife', group: 'Personal & family', label: 'Wife', m: 'other_party' },
  { key: 'spouse_partner', group: 'Personal & family', label: 'Spouse / partner', m: 'other_party' },
  { key: 'domestic_partner', group: 'Personal & family', label: 'Domestic partner', m: 'other_party' },
  { key: 'family_member', group: 'Personal & family', label: 'Family member', m: 'other_party' },
  { key: 'friend', group: 'Personal & family', label: 'Friend', m: 'other_party' },
  // Creative & media
  { key: 'influencer_creator', group: 'Creative & media', label: 'Influencer / creator', m: 'other_party' },
  { key: 'photographer', group: 'Creative & media', label: 'Photographer / videographer', m: 'other_party' },
  { key: 'press_media', group: 'Creative & media', label: 'Press / media', m: 'marketing_pr' },
  // Catch-all
  { key: 'other', group: 'General', label: 'Other', m: 'other_party' },
] as const satisfies ReadonlyArray<{
  key: string
  group: string
  label: string
  m: Mismatch
}>

export type ContactTitleKey = (typeof CONTACT_TITLE_ROWS)[number]['key']

export const CONTACT_TITLE_LABELS = Object.fromEntries(
  CONTACT_TITLE_ROWS.map(r => [r.key, r.label]),
) as Record<ContactTitleKey, string>

export const CONTACT_TITLE_MISMATCH = Object.fromEntries(
  CONTACT_TITLE_ROWS.map(r => [r.key, r.m]),
) as Record<ContactTitleKey, Mismatch>

const CONTACT_MISMATCH_ROLE_KEY_SET = new Set<string>(CONTACT_MISMATCH_ROLE_ORDER)

/** Default catalog title for a mismatch “bucket” (first row in {@link CONTACT_TITLE_ROWS} for that bucket). */
export function mismatchContextToDefaultTitleKey(
  ctx: Exclude<Phase1ContactMismatchContextV3, ''>,
): ContactTitleKey {
  const row = CONTACT_TITLE_ROWS.find(r => r.m === ctx)
  return (row?.key ?? 'other') as ContactTitleKey
}

/** Normalize `BookingIntakeVenueDataV3.contact_role`: may be a {@link ContactTitleKey} or legacy mismatch key. */
export function intakeContactTitleKeyFromContactRoleField(raw: string): ContactTitleKey | '' {
  const t = raw.trim()
  if (!t) return ''
  if (t in CONTACT_TITLE_LABELS) return t as ContactTitleKey
  if (CONTACT_MISMATCH_ROLE_KEY_SET.has(t)) {
    return mismatchContextToDefaultTitleKey(t as Exclude<Phase1ContactMismatchContextV3, ''>)
  }
  return ''
}

/**
 * String stored on `BookingIntakeVenueDataV3.contact_role` — always a {@link ContactTitleKey} when known
 * (legacy mismatch-only values are mapped to a default title in the same bucket).
 */
export function intakeContactRoleFieldFromContact(
  c: Pick<Contact, 'title_key' | 'role'> | null | undefined,
): string {
  if (!c) return ''
  const k = c.title_key?.trim()
  if (k && k in CONTACT_TITLE_LABELS) return k
  const r = c.role?.trim() ?? ''
  if (r && CONTACT_MISMATCH_ROLE_KEY_SET.has(r)) {
    return mismatchContextToDefaultTitleKey(r as Mismatch)
  }
  if (r) {
    return mismatchContextToDefaultTitleKey(mapContactRoleTextToMismatchContext(r))
  }
  return ''
}

/** Best {@link ContactTitleKey} for a venue contact row (for intake chip picks and defaults). */
export function contactTitleKeyFromContactForIntake(c: Pick<Contact, 'title_key' | 'role'>): ContactTitleKey {
  const k = c.title_key?.trim()
  if (k && k in CONTACT_TITLE_LABELS) return k as ContactTitleKey
  return mismatchContextToDefaultTitleKey(contactToMismatchContext(c))
}

export const CONTACT_TITLE_GROUPS: { label: string; keys: readonly ContactTitleKey[] }[] = (() => {
  const map = new Map<string, ContactTitleKey[]>()
  for (const r of CONTACT_TITLE_ROWS) {
    if (!map.has(r.group)) map.set(r.group, [])
    map.get(r.group)!.push(r.key)
  }
  return [...map.entries()].map(([label, keys]) => ({ label, keys }))
})()

/** True when the contact still needs a catalog title: free-text `role` and no valid `title_key` yet. */
export function isContactTitleLegacy(c: Pick<Contact, 'title_key' | 'role'>): boolean {
  const k = c.title_key?.trim()
  if (k && k in CONTACT_TITLE_LABELS) return false
  return !!(c.role?.trim())
}

/** Display string for agreements, chips, and heuristics — prefers catalog label, else legacy `role`. */
export function contactRoleForDisplay(c: Pick<Contact, 'title_key' | 'role'>): string {
  const k = c.title_key?.trim()
  if (k && k in CONTACT_TITLE_LABELS) return CONTACT_TITLE_LABELS[k as ContactTitleKey]
  return (c.role ?? '').trim()
}

const SOUND_TECH_TITLE_KEYS = new Set<ContactTitleKey>(['on_site_tech', 'audio_engineer'])

/** Venue contact likely runs FOH / house sound — seeds 4A sound-tech copy and picker. */
export function isVenueSoundTechContact(c: Pick<Contact, 'title_key' | 'role'>): boolean {
  const k = c.title_key?.trim()
  if (k && SOUND_TECH_TITLE_KEYS.has(k as ContactTitleKey)) return true
  const disp = contactRoleForDisplay(c)
  const blob = `${(c.role ?? '').toLowerCase()} ${disp.toLowerCase()}`
  return /(sound tech|sound engineer|audio engineer|house tech|\ba1\b|\bfoh\b|monitor|production engineer)/i.test(
    blob,
  )
}

/** Map legacy role / title text to intake mismatch context (regex heuristic). */
export function mapContactRoleTextToMismatchContext(
  role: string | null | undefined,
): Exclude<Phase1ContactMismatchContextV3, ''> {
  const r = (role ?? '').toLowerCase()
  if (!r) return 'other_party'
  if (/(billing|\bap\b|a\/p|accounts? payable)/i.test(r)) return 'billing'
  if (/(production|technical|\ba1\b|audio)/i.test(r)) return 'production'
  if (/(^|\b)ceo\b|chief executive|c\/e\/o/i.test(r)) return 'owner'
  if (/(owner|principal|partner)/i.test(r)) return 'owner'
  if (/(assistant|coordinator|admin)/i.test(r)) return 'assistant'
  if (/(buyer|booker|talent)/i.test(r)) return 'talent_buyer'
  if (/(planner|producer)/i.test(r)) return 'event_planner'
  if (/(day[- ]of|showcaller)/i.test(r)) return 'day_of_coordinator'
  if (/wedding/i.test(r)) return 'wedding_planner'
  if (/(agency|rep)/i.test(r)) return 'agency_rep'
  if (/(venue|manager|\bgm\b|operations)/i.test(r)) return 'venue_manager'
  if (/(hospitality|f&b|fb\b|catering)/i.test(r)) return 'hospitality_manager'
  if (/(marketing|\bpr\b|public relations)/i.test(r)) return 'marketing_pr'
  if (/(security|door|box office)/i.test(r)) return 'security_box'
  return 'other_party'
}

export function contactToMismatchContext(
  c: Pick<Contact, 'title_key' | 'role'>,
): Exclude<Phase1ContactMismatchContextV3, ''> {
  const k = c.title_key?.trim()
  if (k && k in CONTACT_TITLE_MISMATCH) return CONTACT_TITLE_MISMATCH[k as ContactTitleKey]
  return mapContactRoleTextToMismatchContext(contactRoleForDisplay(c))
}
