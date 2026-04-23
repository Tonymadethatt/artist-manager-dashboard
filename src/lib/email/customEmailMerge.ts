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

export const PREVIEW_MOCK_LEAD: LeadMergeFields = {
  venue_name: 'Skyline Bar & Lounge',
  instagram_handle: 'skyline.lounge.mia',
  genre: 'House / open format',
  event_name: 'Saturday Night Vibes',
  crowd_type: '25–40',
  resident_dj: 'DJ Pat',
  city: 'Miami',
  contact_email: 'bookings@skylinebar.com',
  contact_phone: '(305) 555-0142',
  website: 'https://skylinebar.com',
  research_notes: 'Great room, asked about tech rider. Follow up on guest list limits.',
}

/** Map a `leads` row to merge fields for `send-venue-email` (`lead.*` keys). */
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

/** Map common shorthand / legacy tokens to canonical whitelist keys (subject, greeting, prose, etc.). */
function canonicalMergeKey(raw: string): string {
  const k = raw.trim()
  const aliases: Record<string, string> = {
    firstName: 'recipient.firstName',
    client_name: 'recipient.firstName',
    CLIENT_NAME: 'recipient.firstName',
  }
  return aliases[k] ?? k
}

/** Resolve a whitelisted merge key from context (for key_value rows). */
export function resolveMergeKey(
  key: string | null | undefined,
  ctx: CustomEmailMergeContext,
  audience: CustomMergeAudience,
): string {
  const k = canonicalMergeKey(key ?? '')
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
    const k = canonicalMergeKey(rawKey)
    return resolveMergeKey(k, ctx, audience)
  })
}
