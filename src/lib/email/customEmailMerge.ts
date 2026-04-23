import type { VenueRenderDeal, VenueRenderProfile, VenueRenderRecipient, VenueRenderVenue } from './renderVenueEmail'
import { resolveVenueRecipientSalutationFirstName } from './resolveVenueRecipientGreeting'
import { formatPacificWeekdayMdYyFromYmd } from '../calendar/pacificWallTime'
import { formatUsdDisplayCeil } from '../format/displayCurrency'

/** Allowed merge keys for custom template prose / static cells. Bound fields use valueKey separately. */
export const VENUE_CUSTOM_MERGE_KEYS = [
  'recipient.firstName',
  'venue.name',
  'deal.description',
  'deal.event_date',
  'deal.gross_amount',
  'deal.amount_due_now',
  'deal.total_paid_toward_gross',
  'deal.remaining_client_balance',
  'deal.payment_due_date',
  'deal.agreement_url',
  'deal.notes',
  'profile.artist_name',
  'profile.company_name',
] as const

export const ARTIST_CUSTOM_MERGE_KEYS = [
  'recipient.firstName',
  'venue.name',
  'deal.description',
  'deal.event_date',
  'deal.gross_amount',
  'deal.amount_due_now',
  'deal.total_paid_toward_gross',
  'deal.remaining_client_balance',
  'profile.artist_name',
  'profile.company_name',
] as const

/** Pre–pipeline lead research records; used with custom templates `audience: lead` (namespace `lead.*`). */
export const LEAD_CUSTOM_MERGE_KEYS = [
  'recipient.firstName',
  'profile.artist_name',
  'profile.company_name',
  'profile.website',
  'lead.venue_name',
  'lead.instagram_handle',
  'lead.genre',
  'lead.event_name',
  'lead.crowd_type',
  'lead.resident_dj',
  'lead.city',
  'lead.contact_email',
  'lead.contact_phone',
  'lead.website',
  'lead.research_notes',
] as const

export type CustomMergeAudience = 'venue' | 'artist' | 'lead'

/** All string fields; empty string when missing (merge shows blank). */
export type LeadMergeFields = {
  venue_name: string
  instagram_handle: string
  genre: string
  event_name: string
  crowd_type: string
  resident_dj: string
  city: string
  contact_email: string
  contact_phone: string
  website: string
  research_notes: string
}

/**
 * Non-empty sample values for every `lead.*` merge key in template preview and test sends.
 * Labels make it obvious which field is which when blocks use many variables.
 */
export const PREVIEW_MOCK_LEAD: LeadMergeFields = {
  venue_name: 'Skyline Bar & Lounge (mock venue)',
  instagram_handle: 'skyline.lounge.mia',
  genre: 'House / open format (mock genre)',
  event_name: 'Saturday Night Vibes (mock event)',
  crowd_type: '25–40 (mock crowd)',
  resident_dj: 'DJ Pat (mock resident)',
  city: 'Miami, FL (mock city)',
  contact_email: 'bookings.mock@skylinebar.example.com',
  contact_phone: '(305) 555-0142 (mock phone)',
  website: 'https://venue-website.mock.example.com',
  research_notes:
    '[Preview sample] Great room, asked about tech rider. Follow up on guest list limits. (mock research_notes)',
}

/** Map a `leads` row to merge fields for `send-venue-email` (`lead.*` keys). */
/** For lead sends: derive a first-name–style name from the local part of the contact address. */
export function recipientNameFromContactEmail(email: string): string {
  const t = String(email || '').trim()
  if (!t) return 'there'
  const local = t.split('@')[0] ?? 'there'
  const first = local.split(/[._-]/)[0] ?? local
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'there'
}

export function leadMergeFieldsFromDatabaseLead(lead: {
  venue_name: string | null
  instagram_handle: string | null
  genre: string | null
  event_name: string | null
  crowd_type: string | null
  resident_dj: string | null
  city: string | null
  contact_email: string | null
  contact_phone: string | null
  website: string | null
  research_notes: string | null
}): LeadMergeFields {
  return {
    venue_name: lead.venue_name ?? '',
    instagram_handle: lead.instagram_handle ?? '',
    genre: lead.genre ?? '',
    event_name: lead.event_name ?? '',
    crowd_type: lead.crowd_type ?? '',
    resident_dj: lead.resident_dj ?? '',
    city: lead.city ?? '',
    contact_email: lead.contact_email ?? '',
    contact_phone: lead.contact_phone ?? '',
    website: lead.website ?? '',
    research_notes: lead.research_notes ?? '',
  }
}

export interface CustomEmailMergeContext {
  profile: VenueRenderProfile
  recipient: VenueRenderRecipient
  deal?: VenueRenderDeal
  venue?: VenueRenderVenue
  /** Set when `audience === 'lead'` for pre-client outreach templates. */
  lead?: LeadMergeFields | null
}

function money(n: number) {
  return formatUsdDisplayCeil(n)
}

function fmtDateYmdEmail(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return formatPacificWeekdayMdYyFromYmd(t)
}

const KEY_SETS: Record<CustomMergeAudience, ReadonlySet<string>> = {
  venue: new Set(VENUE_CUSTOM_MERGE_KEYS),
  artist: new Set(ARTIST_CUSTOM_MERGE_KEYS),
  lead: new Set(LEAD_CUSTOM_MERGE_KEYS),
}

/** Optional snake_case / spaced mistakes for lead.* (normalized to lower + underscores). */
const LEAD_KEY_SNAKE_ALIASES: Record<string, string> = {
  lead_city: 'lead.city',
  lead_venue_name: 'lead.venue_name',
  lead_instagram_handle: 'lead.instagram_handle',
  lead_genre: 'lead.genre',
  lead_event_name: 'lead.event_name',
  lead_crowd_type: 'lead.crowd_type',
  lead_resident_dj: 'lead.resident_dj',
  lead_contact_email: 'lead.contact_email',
  lead_contact_phone: 'lead.contact_phone',
  lead_website: 'lead.website',
  lead_research_notes: 'lead.research_notes',
}

const STATIC_FIRST_NAME_ALIASES = new Set(['firstname', 'client_name', 'clientname'])
const LEGACY_RECIPIENT_NAME_ALIASES: Record<string, string> = {
  firstName: 'recipient.firstName',
  client_name: 'recipient.firstName',
  CLIENT_NAME: 'recipient.firstName',
}

/**
 * Map user-entered keys to canonical whitelist keys: legacy aliases, case-insensitive match,
 * and optional lead snake_case forms so preview / test / sends resolve the same as exact keys.
 */
function normalizeMergeKey(raw: string, audience: CustomMergeAudience): string {
  const t0 = raw.trim()
  if (!t0) return ''
  const set = KEY_SETS[audience]
  const low0 = t0.toLowerCase()
  if (STATIC_FIRST_NAME_ALIASES.has(low0) && set.has('recipient.firstName')) {
    return 'recipient.firstName'
  }
  const tFromLegacy = LEGACY_RECIPIENT_NAME_ALIASES[t0] ?? t0
  if (set.has(tFromLegacy)) return tFromLegacy
  if (set.has(t0)) return t0
  if (audience === 'lead') {
    const norm = t0.replace(/\s+/g, '_').toLowerCase()
    const fromSnake = LEAD_KEY_SNAKE_ALIASES[low0] ?? LEAD_KEY_SNAKE_ALIASES[norm]
    if (fromSnake && set.has(fromSnake)) return fromSnake
  }
  for (const k of set) {
    if (k.toLowerCase() === tFromLegacy.toLowerCase()) return k
  }
  for (const k of set) {
    if (k.toLowerCase() === t0.toLowerCase()) return k
  }
  return t0
}

/** Resolve a whitelisted merge key from context (for key_value rows). */
export function resolveMergeKey(
  key: string | null | undefined,
  ctx: CustomEmailMergeContext,
  audience: CustomMergeAudience,
): string {
  const k = normalizeMergeKey(key ?? '', audience)
  if (!k || !KEY_SETS[audience].has(k)) return ''
  const firstName = resolveVenueRecipientSalutationFirstName({
    name: ctx.recipient.name,
    email: ctx.recipient.email,
  })
  const venueName = ctx.venue?.name ?? ctx.deal?.description ?? ''
  switch (k) {
    case 'recipient.firstName':
      return firstName
    case 'venue.name':
      return venueName
    case 'deal.description':
      return ctx.deal?.description ?? ''
    case 'deal.event_date':
      return ctx.deal?.event_date ? fmtDateYmdEmail(ctx.deal.event_date) : ''
    case 'deal.gross_amount':
      return ctx.deal != null && Number.isFinite(ctx.deal.gross_amount) ? money(ctx.deal.gross_amount) : ''
    case 'deal.amount_due_now':
      return ctx.deal != null &&
        ctx.deal.amount_due_now != null &&
        Number.isFinite(ctx.deal.amount_due_now)
        ? money(ctx.deal.amount_due_now)
        : ''
    case 'deal.total_paid_toward_gross':
      return ctx.deal != null &&
        ctx.deal.total_paid_toward_gross != null &&
        Number.isFinite(ctx.deal.total_paid_toward_gross)
        ? money(ctx.deal.total_paid_toward_gross)
        : ''
    case 'deal.remaining_client_balance':
      return ctx.deal != null &&
        ctx.deal.remaining_client_balance != null &&
        Number.isFinite(ctx.deal.remaining_client_balance)
        ? money(ctx.deal.remaining_client_balance)
        : ''
    case 'deal.payment_due_date':
      return ctx.deal?.payment_due_date ? fmtDateYmdEmail(ctx.deal.payment_due_date) : ''
    case 'deal.agreement_url':
      return ctx.deal?.agreement_url ?? ''
    case 'deal.notes':
      return ctx.deal?.notes ?? ''
    case 'profile.artist_name':
      return ctx.profile.artist_name ?? ''
    case 'profile.company_name':
      return ctx.profile.company_name || ctx.profile.artist_name || ''
    case 'profile.website':
      return ctx.profile.website?.trim() ?? ''
    case 'lead.venue_name':
      return ctx.lead?.venue_name ?? ''
    case 'lead.instagram_handle':
      return ctx.lead?.instagram_handle ?? ''
    case 'lead.genre':
      return ctx.lead?.genre ?? ''
    case 'lead.event_name':
      return ctx.lead?.event_name ?? ''
    case 'lead.crowd_type':
      return ctx.lead?.crowd_type ?? ''
    case 'lead.resident_dj':
      return ctx.lead?.resident_dj ?? ''
    case 'lead.city':
      return ctx.lead?.city ?? ''
    case 'lead.contact_email':
      return ctx.lead?.contact_email ?? ''
    case 'lead.contact_phone':
      return ctx.lead?.contact_phone ?? ''
    case 'lead.website':
      return ctx.lead?.website ?? ''
    case 'lead.research_notes':
      return ctx.lead?.research_notes ?? ''
    default:
      return ''
  }
}

/**
 * Replace {{key}} in user text with resolved values. Unknown keys stay empty.
 */
export function applyMergeToText(template: string, ctx: CustomEmailMergeContext, audience: CustomMergeAudience): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, rawKey: string) => {
    return resolveMergeKey(rawKey, ctx, audience)
  })
}

/** For lead template blocks: if `key` is set, the block is shown only when that merge value is non-empty after trim. */
export function leadMergeKeyHasContent(
  ctx: CustomEmailMergeContext,
  key: string | null | undefined,
): boolean {
  if (key == null || !String(key).trim()) return true
  const v = resolveMergeKey(String(key).trim(), ctx, 'lead')
  return String(v).trim().length > 0
}
