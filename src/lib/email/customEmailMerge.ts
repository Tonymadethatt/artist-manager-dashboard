import type { VenueRenderDeal, VenueRenderProfile, VenueRenderRecipient, VenueRenderVenue } from './renderVenueEmail'
import { formatPacificStackLineFromYmd } from '../calendar/pacificWallTime'
import { formatUsdDisplayCeil } from '../format/displayCurrency'

/** Allowed merge keys for custom template prose / static cells. Bound fields use valueKey separately. */
export const VENUE_CUSTOM_MERGE_KEYS = [
  'recipient.firstName',
  'venue.name',
  'deal.description',
  'deal.event_date',
  'deal.gross_amount',
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

/** YYYY-MM-DD merge values — match artist email Pacific stacked style (short weekday · date · All day). */
function fmtDateYmdPacific(iso: string | null | undefined): string {
  if (!iso) return ''
  const t = iso.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  return formatPacificStackLineFromYmd(t)
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
  const firstName = (ctx.recipient.name ?? '').split(/\s+/)[0] || ''
  const venueName = ctx.venue?.name ?? ctx.deal?.description ?? ''
  switch (k) {
    case 'recipient.firstName':
      return firstName
    case 'venue.name':
      return venueName
    case 'deal.description':
      return ctx.deal?.description ?? ''
    case 'deal.event_date':
      return ctx.deal?.event_date ? fmtDateYmdPacific(ctx.deal.event_date) : ''
    case 'deal.gross_amount':
      return ctx.deal != null && Number.isFinite(ctx.deal.gross_amount) ? money(ctx.deal.gross_amount) : ''
    case 'deal.payment_due_date':
      return ctx.deal?.payment_due_date ? fmtDateYmdPacific(ctx.deal.payment_due_date) : ''
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
