import type { Deal, DealPricingSnapshot, PricingCatalogDoc, Venue } from '../../types'
import {
  COMMISSION_TIER_LABELS,
  emptyPricingCatalogDoc,
  isDealPricingSnapshot,
  normalizePricingCatalogDoc,
} from '../../types'
import { pricingSnapshotAgreementFields } from '../agreement/tokens'
import { formatVenuePostalLine } from '../calendar/venueAddressForGoogle'
import {
  scheduleWhenStackFromDeal,
  whenLineFriendlyFromDeal,
} from '../calendar/pacificWallTime'
import {
  resolveArtistPromiseLinesForDeal,
  resolvePromiseLineDisplayLabel,
  resolveVenuePromiseLinesForDeal,
} from '../showReportCatalog'
import { emailSectionCardHtml, escapeHtmlPlain } from './appendBlocksHtml'
import { stackedScheduleWhenCellHtml } from './emailTableDateStack'
import { EMAIL_BODY_SECONDARY } from './emailDarkSurfacePalette'
import { formatUsdDisplayCeil } from '../format/displayCurrency'

/** Minimum deal fields required to render gig-booked email sections (previews may pass only this). */
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
  | 'promise_lines'
  | 'pricing_snapshot'
  | 'notes'
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

function describeSnapshotLines(snapshot: DealPricingSnapshot, catalog: PricingCatalogDoc | null): string[] {
  const lines: string[] = []
  if (catalog) {
    if (snapshot.baseMode === 'package' && snapshot.packageId) {
      const pkg = catalog.packages.find(p => p.id === snapshot.packageId)
      if (pkg) {
        lines.push(
          `Package: ${pkg.name} — ${pkg.hoursIncluded} hr included (${formatUsdDisplayCeil(pkg.price)} base)`,
        )
      } else {
        lines.push('Package-based quote (package details unavailable — catalog may have changed).')
      }
    } else if (snapshot.baseMode === 'hourly' && snapshot.serviceId) {
      const svc = catalog.services.find(s => s.id === snapshot.serviceId)
      if (svc) {
        const rate =
          svc.priceType === 'per_hour'
            ? `${formatUsdDisplayCeil(svc.price)}/hr`
            : formatUsdDisplayCeil(svc.price)
        lines.push(`Service: ${svc.name} (${rate})`)
      } else {
        lines.push('Hourly quote (service details unavailable — catalog may have changed).')
      }
    }
    if (snapshot.baseMode === 'package' && snapshot.overtimeServiceId) {
      const ot = catalog.services.find(s => s.id === snapshot.overtimeServiceId)
      if (ot) lines.push(`Overtime: ${ot.name}`)
    }
  } else {
    lines.push(
      snapshot.baseMode === 'package'
        ? 'Package-based quote (open email from a device with catalog sync for line-item names).'
        : 'Hourly quote (catalog not loaded for this send).',
    )
  }

  lines.push(`Performance hours: ${snapshot.performanceHours}`)

  if (catalog) {
    for (const [id, q] of Object.entries(snapshot.addonQuantities ?? {})) {
      const n = Number(q)
      if (!Number.isFinite(n) || n <= 0) continue
      const a = catalog.addons.find(x => x.id === id)
      if (a) lines.push(`Add-on: ${a.name} × ${n}`)
    }
    for (const sid of snapshot.surchargeIds ?? []) {
      const s = catalog.surcharges.find(x => x.id === sid)
      if (s) lines.push(`Surcharge: ${s.name} (×${s.multiplier})`)
    }
    for (const did of snapshot.discountIds ?? []) {
      const disc = catalog.discounts.find(x => x.id === did)
      if (disc) lines.push(`Discount: ${disc.name} (${disc.percent}%)`)
    }
  }

  return lines
}

function venueCommitmentLabels(deal: GigBookedEmailDealInput): string[] {
  const gross = deal.gross_amount
  return resolveVenuePromiseLinesForDeal(deal.promise_lines ?? null).map(l =>
    resolvePromiseLineDisplayLabel(l, gross),
  )
}

function artistCommitmentLabels(deal: GigBookedEmailDealInput): string[] {
  return resolveArtistPromiseLinesForDeal(deal.promise_lines ?? null).map(l => l.label.trim()).filter(Boolean)
}

/**
 * Stacked section cards for `gig_booked_ics` (HTML fragment only — no outer shell).
 */
export function buildGigBookedEmailMiddleHtml(args: {
  deal: GigBookedEmailDealInput
  venue: Pick<
    Venue,
    'name' | 'location' | 'city' | 'address_line2' | 'region' | 'postal_code' | 'country' | 'deal_terms'
  > | null
  /** Pass `normalizePricingCatalogDoc(doc)` or null when missing / unloadable. */
  catalog: PricingCatalogDoc | null
}): string {
  const { deal, venue, catalog } = args
  const cards: string[] = []
  let ai = 0

  const title = deal.description?.trim() || 'Gig'
  const venueName = venue?.name?.trim() || 'TBA'
  const stack = scheduleWhenStackFromDeal(deal)
  const whenInner = stack
    ? stackedScheduleWhenCellHtml(stack, '#ffffff', 'digest')
    : `<p style="font-size:13px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">${escapeHtmlPlain(whenLineFriendlyFromDeal(deal) || deal.event_date?.trim() || '')}</p>`

  const showWhenBody =
    `<p style="font-size:15px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">${escapeHtmlPlain(title)}</p>`
    + `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 12px;line-height:1.6;">${escapeHtmlPlain(venueName)}</p>`
    + `<div style="margin-top:4px;">${whenInner}</div>`

  cards.push(emailSectionCardHtml('Show & when', showWhenBody, nextAccent(ai++)))

  const postal = venue ? formatVenuePostalLine(venue) : undefined
  const locationBody = postal
    ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">${escapeHtmlPlain(postal)}</p>`
    : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">${escapeHtmlPlain(
        [venue?.location, venue?.city].filter(Boolean).join(', ') || 'TBA',
      )}</p>`
  cards.push(emailSectionCardHtml('Location', locationBody, nextAccent(ai++)))

  const tierLabel = COMMISSION_TIER_LABELS[deal.commission_tier] ?? deal.commission_tier
  const payBody =
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Gross:</strong> ${escapeHtmlPlain(formatUsdDisplayCeil(deal.gross_amount))}</p>`
    + `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.65;"><strong style="color:#ffffff;">Payment due:</strong> ${escapeHtmlPlain(formatPaymentDueEmail(deal.payment_due_date))}</p>`
    + `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;"><strong style="color:#ffffff;">Booking category:</strong> ${escapeHtmlPlain(tierLabel)}</p>`
  cards.push(emailSectionCardHtml('Pay & terms', payBody, nextAccent(ai++)))

  let serviceBody: string
  if (deal.pricing_snapshot && isDealPricingSnapshot(deal.pricing_snapshot)) {
    const snap = deal.pricing_snapshot
    const agreement = pricingSnapshotAgreementFields({ pricing_snapshot: deal.pricing_snapshot } as Deal)
    const summaryLines = (agreement.pricing_summary_text ?? '')
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)
    const detailLines = describeSnapshotLines(snap, catalog)
    serviceBody =
      (summaryLines.length
        ? `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 10px;line-height:1.65;">${summaryLines.map(s => escapeHtmlPlain(s)).join('<br/>')}</p>`
        : '')
      + bulletListHtml(detailLines)
  } else {
    serviceBody =
      `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">Gross was set on this deal without a saved calculator snapshot — totals match the amount under Pay & terms.</p>`
  }
  cards.push(emailSectionCardHtml('Service & quote', serviceBody, nextAccent(ai++)))

  const venueLines = venueCommitmentLabels(deal)
  cards.push(
    emailSectionCardHtml(
      'Venue commitments',
      venueLines.length
        ? bulletListHtml(venueLines)
        : `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">No venue commitments were saved on this deal yet.</p>`,
      nextAccent(ai++),
    ),
  )

  const artistLines = artistCommitmentLabels(deal)
  if (artistLines.length) {
    cards.push(emailSectionCardHtml('Your commitments', bulletListHtml(artistLines), nextAccent(ai++)))
  }

  const dt = venue?.deal_terms
  const logisticsBits: string[] = []
  if (dt?.set_length?.trim()) logisticsBits.push(`Set length: ${dt.set_length.trim()}`)
  if (dt?.load_in_time?.trim()) logisticsBits.push(`Load-in: ${dt.load_in_time.trim()}`)
  if (dt?.notes?.trim()) logisticsBits.push(dt.notes.trim())
  if (logisticsBits.length) {
    cards.push(emailSectionCardHtml('Logistics', bulletListHtml(logisticsBits), nextAccent(ai++)))
  }

  const mgrNotes = deal.notes?.trim()
  if (mgrNotes) {
    cards.push(
      emailSectionCardHtml(
        'Manager notes',
        `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;white-space:pre-wrap;">${escapeHtmlPlain(mgrNotes)}</p>`,
        nextAccent(ai++),
      ),
    )
  }

  const refBody =
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.65;">This email is the full detail record for this booking. Your shared calendar entry is a short summary — open this message whenever you need the breakdown.</p>`
  cards.push(emailSectionCardHtml('Reference', refBody, nextAccent(ai++)))

  return cards.join('')
}

/** Normalize raw `user_pricing_catalog.doc` for email rendering; returns null on empty/invalid. */
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
 * Rich sample deal + venue + catalog for template previews and “send test” (matches Earnings-style snapshot).
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
  catalog: PricingCatalogDoc
} {
  const pkgId = 'preview-pkg-gig-booked'
  const svcId = 'preview-svc-hour'
  const catalog: PricingCatalogDoc = {
    ...emptyPricingCatalogDoc(),
    packages: [
      {
        id: pkgId,
        name: 'Prime time DJ package',
        price: args.gross_amount,
        hoursIncluded: 4,
        bullets: ['Sound check included'],
      },
    ],
    services: [
      {
        id: svcId,
        name: 'Extended hours',
        category: 'DJ',
        price: 150,
        priceType: 'per_hour',
        dayType: 'any',
      },
    ],
  }

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

  const deal: GigBookedEmailDealInput = {
    description: args.description,
    event_start_at: args.event_start_at,
    event_end_at: args.event_end_at,
    event_date: args.event_date,
    performance_start_at: args.performance_start_at ?? null,
    performance_end_at: args.performance_end_at ?? null,
    gross_amount: args.gross_amount,
    payment_due_date: args.payment_due_date,
    commission_tier: 'new_doors',
    promise_lines,
    pricing_snapshot: snapshot,
    notes: args.notes,
  }

  return { deal, venue: args.venue, catalog }
}
