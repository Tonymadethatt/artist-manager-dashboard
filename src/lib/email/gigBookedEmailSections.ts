import type { Contact, Deal, DealPricingSnapshot, Venue } from '../../types'
import { COMMISSION_TIER_LABELS, COMMISSION_TIER_RATES, isDealPricingSnapshot } from '../../types'
import { dealCommissionRateFromTier } from '../deals/dealCommissionFromTier'
import { formatArtistOnsiteContactLine } from './artistOnsiteContactLine'
import {
  artistGigLogisticsLabelsFromDeal,
  artistGigRecordsVenueLabels,
} from './gigBookedLogisticsLines'
import { depositDueFromDeal, dealRemainingClientBalance } from '../deals/dealPaymentTotals'
import { formatVenuePostalLine } from '../calendar/venueAddressForGoogle'
import { performanceWindowReadableFromDeal, whenLineFriendlyFromDeal } from '../calendar/pacificWallTime'
import { emailSectionCardHtml, escapeHtmlPlain } from './appendBlocksHtml'
import { buildGigCalendarShowDetailsBody } from './gigCalendarEmailHtml'
import { EMAIL_BODY_SECONDARY } from './emailDarkSurfacePalette'
import { formatUsdDisplayCeil } from '../format/displayCurrency'
import { normalizePricingCatalogDoc } from '../../types'
import type { PricingCatalogDoc } from '../../types'

/** Deal fields needed for artist-first gig booked email (Earnings-aligned payment fields). */
export type GigBookedEmailDealInput = Pick<
  Deal,
  | 'description'
  | 'event_start_at'
  | 'event_end_at'
  | 'event_date'
  | 'performance_start_at'
  | 'performance_end_at'
  | 'gross_amount'
  | 'payment_due_date'
  | 'commission_tier'
  | 'commission_rate'
  | 'promise_lines'
  | 'pricing_snapshot'
  | 'deposit_due_amount'
  | 'deposit_paid_amount'
  | 'balance_paid_amount'
  | 'commission_amount'
>

const CARD_ACCENTS = ['#22c55e', '#60a5fa', '#fbbf24', '#a78bfa', '#f97316'] as const

function nextAccent(i: number): string {
  return CARD_ACCENTS[i % CARD_ACCENTS.length]!
}

function bulletListHtml(items: string[]): string {
  if (!items.length) {
    return `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;">—</p>`
  }
  const lis = items
    .map(t => t.trim())
    .filter(Boolean)
    .map(
      t =>
        `<li style="margin-bottom:8px;font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.65;">${escapeHtmlPlain(t)}</li>`,
    )
    .join('')
  return `<ul style="padding-left:16px;margin:0;">${lis}</ul>`
}

function formatPaymentDueEmail(iso: string | null | undefined): string {
  if (!iso?.trim()) return 'TBD'
  const d = new Date(`${iso.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso.trim()
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(d)
}

function paySectionHtml(deal: GigBookedEmailDealInput): string {
  const d = deal as Deal
  const gross = Number(deal.gross_amount ?? 0)
  const grossFmt = formatUsdDisplayCeil(Number.isFinite(gross) ? gross : 0)
  const depDue = depositDueFromDeal(d)
  const remainder = dealRemainingClientBalance(d)
  const payBy = formatPaymentDueEmail(deal.payment_due_date)
  const snap = isDealPricingSnapshot(deal.pricing_snapshot) ? deal.pricing_snapshot : null
  const contractNote =
    snap && Number.isFinite(snap.total) && Math.round(snap.total) !== Math.round(gross)
      ? `<p style="font-size:12px;color:${EMAIL_BODY_SECONDARY};margin:10px 0 0;line-height:1.55;">Quote in calculator was ${escapeHtmlPlain(formatUsdDisplayCeil(snap.total))}; the contract total above is what this booking uses.</p>`
      : ''

  const lines: string[] = []
  lines.push(
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Total gig fee:</strong> ${escapeHtmlPlain(grossFmt)}</p>`,
  )

  if (depDue > 0) {
    lines.push(
      `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Deposit:</strong> ${escapeHtmlPlain(formatUsdDisplayCeil(depDue))}</p>`,
    )
  } else {
    lines.push(
      `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Deposit:</strong> No separate deposit on this booking.</p>`,
    )
  }

  lines.push(
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Balance / final payment due by:</strong> ${escapeHtmlPlain(payBy)}</p>`,
  )

  lines.push(
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Still owed (from venue):</strong> ${escapeHtmlPlain(formatUsdDisplayCeil(remainder))}</p>`,
  )

  const tier = deal.commission_tier
  if (tier === 'artist_network') {
    lines.push(
      `<p style="font-size:12px;color:#737373;margin:12px 0 0;line-height:1.65;">Artist network booking — no manager booking commission on this gig.</p>`,
    )
  } else {
    const rateRaw = dealCommissionRateFromTier(d)
    const pct = Number.isFinite(rateRaw) ? Math.round(rateRaw * 100) : 0
    const tierLabel = COMMISSION_TIER_LABELS[tier]
    const comm = Number(deal.commission_amount ?? 0)
    const amtFmt = formatUsdDisplayCeil(Number.isFinite(comm) ? comm : 0)
    lines.push(
      `<p style="font-size:12px;color:${EMAIL_BODY_SECONDARY};margin:12px 0 0;line-height:1.65;">`
        + `<strong style="color:#ffffff;">Tier:</strong> ${escapeHtmlPlain(tierLabel)} · `
        + `<strong style="color:#ffffff;">Rate:</strong> ${pct}% · `
        + `<strong style="color:#ffffff;">Send to manager:</strong> ${escapeHtmlPlain(amtFmt)}`
        + `</p>`,
    )
  }

  return lines.join('') + contractNote
}

/**
 * Stacked section cards for `gig_booked_ics` (HTML fragment only — no outer shell).
 * Artist-first: schedule, location, onsite contact, pay, gear, short “agreed” snapshot — no pricing catalog dump.
 */
export function buildGigBookedEmailMiddleHtml(args: {
  deal: GigBookedEmailDealInput
  venue: Pick<
    Venue,
    'name' | 'location' | 'city' | 'address_line2' | 'region' | 'postal_code' | 'country' | 'deal_terms'
  > | null
  /** On-site / production contact when set on the deal. */
  onsiteContact: Pick<Contact, 'name' | 'phone' | 'title_key' | 'role'> | null
}): string {
  const { deal, venue, onsiteContact } = args
  const cards: string[] = []
  let ai = 0

  const title = deal.description?.trim() || 'Gig'
  const venueName = venue?.name?.trim() || 'TBA'
  const whenLine = whenLineFriendlyFromDeal(deal) || deal.event_date?.trim() || ''
  const scheduleBody = buildGigCalendarShowDetailsBody({
    dealDescription: title,
    venueName,
    whenLine,
    setLine: performanceWindowReadableFromDeal(deal),
  })

  cards.push(emailSectionCardHtml('Schedule', scheduleBody, nextAccent(ai++)))

  const postal = venue ? formatVenuePostalLine(venue) : undefined
  const locationBody = postal
    ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">${escapeHtmlPlain(postal)}</p>`
    : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">${escapeHtmlPlain(
        [venue?.location, venue?.city].filter(Boolean).join(', ') || 'TBA',
      )}</p>`
  cards.push(emailSectionCardHtml('Location', locationBody, nextAccent(ai++)))

  const peopleBody = onsiteContact
    ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">${escapeHtmlPlain(
        formatArtistOnsiteContactLine(onsiteContact, { includePhone: true }),
      )}</p>`
    : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">On-site contact not set on this booking yet — ask your manager or the venue.</p>`
  cards.push(emailSectionCardHtml('Venue contact', peopleBody, nextAccent(ai++)))

  cards.push(emailSectionCardHtml('Payment', paySectionHtml(deal), nextAccent(ai++)))

  const gross = deal.gross_amount
  const logisticsLabels = artistGigLogisticsLabelsFromDeal(deal.promise_lines ?? null, gross)
  const dt = venue?.deal_terms
  const gearBits: string[] = [...logisticsLabels]
  if (dt?.set_length?.trim()) gearBits.push(`Set length (notes): ${dt.set_length.trim()}`)
  if (dt?.load_in_time?.trim()) gearBits.push(`Load-in: ${dt.load_in_time.trim()}`)
  const notesTrim = dt?.notes?.trim()
  if (notesTrim) {
    const short = notesTrim.length > 400 ? `${notesTrim.slice(0, 397)}…` : notesTrim
    gearBits.push(short)
  }
  if (gearBits.length) {
    cards.push(emailSectionCardHtml('Gear & logistics', bulletListHtml(gearBits), nextAccent(ai++)))
  }

  const exclude = new Set(logisticsLabels.map(s => s.toLowerCase()))
  const records = artistGigRecordsVenueLabels(deal.promise_lines ?? null, gross, exclude, 5)
  if (records.length) {
    const recordsBody =
      `<p style="font-size:12px;color:${EMAIL_BODY_SECONDARY};margin:0 0 10px;line-height:1.55;">Short snapshot of what’s on the contract checklist — not a substitute for the full agreement.</p>`
      + bulletListHtml(records)
    cards.push(emailSectionCardHtml('Agreed terms (snapshot)', recordsBody, nextAccent(ai++)))
  }

  const pointer =
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">Your shared Google Calendar shows a short summary for this show. Keep this email for payment and contact details. Reply if anything looks wrong.</p>`
  cards.push(emailSectionCardHtml('Reference', pointer, nextAccent(ai++)))

  return cards.join('')
}

/** Normalize raw `user_pricing_catalog.doc` for legacy callers; returns null on empty/invalid. */
export function catalogDocFromSupabaseRow(doc: unknown): PricingCatalogDoc | null {
  if (doc == null) return null
  const normalized = normalizePricingCatalogDoc(doc)
  if (!normalized.packages?.length && !normalized.services?.length) return null
  return normalized
}

export type GigBookedPreviewVenueInput = Pick<
  Venue,
  'name' | 'location' | 'city' | 'address_line2' | 'region' | 'postal_code' | 'country' | 'deal_terms'
>

/**
 * Rich sample deal + venue for template previews and “send test”.
 */
export function buildGigBookedPreviewBundle(args: {
  event_start_at: string | null
  event_end_at: string | null
  event_date: string | null
  performance_start_at?: string | null
  performance_end_at?: string | null
  description: string
  gross_amount: number
  payment_due_date: string | null
  notes: string | null
  venue: GigBookedPreviewVenueInput
}): {
  deal: GigBookedEmailDealInput
  venue: GigBookedPreviewVenueInput
  onsiteContact: Pick<Contact, 'name' | 'phone' | 'title_key' | 'role'>
} {
  const pkgId = 'preview-pkg-gig-booked'
  const svcId = 'preview-svc-hour'

  const snapshot: DealPricingSnapshot = {
    v: 1,
    finalSource: 'calculated',
    subtotalBeforeTax: args.gross_amount,
    taxAmount: 0,
    total: args.gross_amount,
    depositDue: Math.round(args.gross_amount * 0.5),
    baseMode: 'package',
    packageId: pkgId,
    serviceId: svcId,
    overtimeServiceId: svcId,
    performanceHours: 4,
    addonQuantities: {},
    surchargeIds: [],
    discountIds: [],
    lastCalculatedTotal: args.gross_amount,
    computedAt: new Date().toISOString(),
  }

  const promise_lines = {
    v: 2 as const,
    venue: {
      lines: [
        {
          id: 'preset:guaranteed_fee',
          label: 'Guaranteed fee',
          presetKey: 'guaranteed_fee' as const,
          major: true,
        },
        {
          id: 'preset:pa_sound',
          label: 'PA and sound',
          presetKey: 'pa_sound' as const,
          major: true,
        },
        {
          id: 'preset:set_times',
          label: 'Set times and curfew',
          presetKey: 'set_times' as const,
          major: true,
        },
      ],
    },
    artist: {
      lines: [
        {
          id: 'preset:artist_on_time',
          label: 'On time for load-in and show',
          presetKey: 'artist_on_time' as const,
          major: true,
        },
      ],
    },
  }

  const gross = args.gross_amount
  const previewTier = 'new_doors' as const
  const previewRate = COMMISSION_TIER_RATES[previewTier]
  const commissionAmount = Math.round(gross * previewRate * 100) / 100

  const onsiteContact: Pick<Contact, 'name' | 'phone' | 'title_key' | 'role'> = {
    name: 'Alex Rivera',
    phone: '+1 305-555-0199',
    title_key: 'production_manager',
    role: null,
  }

  const deal: GigBookedEmailDealInput = {
    description: args.description,
    event_start_at: args.event_start_at,
    event_end_at: args.event_end_at,
    event_date: args.event_date,
    performance_start_at: args.performance_start_at ?? null,
    performance_end_at: args.performance_end_at ?? null,
    gross_amount: args.gross_amount,
    payment_due_date: args.payment_due_date,
    commission_tier: previewTier,
    commission_rate: previewRate,
    promise_lines,
    pricing_snapshot: snapshot,
    deposit_due_amount: snapshot.depositDue,
    deposit_paid_amount: Math.round(snapshot.depositDue * 0.5),
    balance_paid_amount: 0,
    commission_amount: commissionAmount,
  }

  return { deal, venue: args.venue, onsiteContact }
}
