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

export type CustomMergeAudience = 'venue' | 'artist'

export interface CustomEmailMergeContext {
  profile: VenueRenderProfile
  recipient: VenueRenderRecipient
  deal?: VenueRenderDeal
  venue?: VenueRenderVenue
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
