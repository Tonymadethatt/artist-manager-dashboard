import type { CommissionTier, Deal, DealTerms } from '../../types'
import { COMMISSION_TIER_LABELS, COMMISSION_TIER_RATES, isDealPricingSnapshot } from '../../types'
import { depositDueFromDeal, dealRemainingClientBalance } from '../deals/dealPaymentTotals'
import { artistGigLogisticsLabelsFromDeal } from '../email/gigBookedLogisticsLines'
import {
  performanceWindowReadableFromDeal,
  whenLineFriendlyFromDeal,
} from './pacificWallTime'
import { formatUsdDisplayCeil } from '../format/displayCurrency'

const POINTER_LINE =
  'Full agreement and invoice details are in your manager’s confirmation email for this show.'

export type GoogleCalendarDealDescriptionInput = {
  notes: string | null
  gross_amount: number
  payment_due_date: string | null
  commission_tier: CommissionTier | null | undefined
  promise_lines?: unknown | null
  pricing_snapshot?: unknown | null
  event_start_at?: string | null
  event_end_at?: string | null
  performance_start_at?: string | null
  performance_end_at?: string | null
  event_date?: string | null
  deposit_due_amount?: number | null
  deposit_paid_amount?: number | null
  balance_paid_amount?: number | null
  commission_amount?: number | null
  commission_rate?: number | null
}

export type GoogleCalendarDealDescriptionExtras = {
  /** Venue display name (calendar description). */
  venueName?: string | null
  /** One-line postal address (no venue name). */
  venueAddressLine?: string | null
  /** Preformatted on-site contact; omit phone for privacy if desired. */
  onsiteContactLine?: string | null
  maxLength?: number
}

type DescSection = { title: string; body: string }

const PROTECTED_SECTION_TITLES = new Set(['Schedule', 'Money', 'Details'])

function renderSections(sections: DescSection[]): string {
  return sections.map(s => `${s.title}\n---\n${s.body}`).join('\n\n')
}

function trimCalendarDescription(sections: DescSection[], maxLen: number): string {
  const work = [...sections]
  const render = () => renderSections(work)

  while (render().length > maxLen) {
    const removableIdx = [...work]
      .map((s, i) => ({ s, i }))
      .reverse()
      .find(({ s }) => !PROTECTED_SECTION_TITLES.has(s.title))?.i

    if (removableIdx == null) break

    const sec = work[removableIdx]
    if (sec.title === 'Gear') {
      const lines = sec.body.split('\n').filter(Boolean)
      if (lines.length <= 1) work.splice(removableIdx, 1)
      else work[removableIdx] = { ...sec, body: lines.slice(0, -1).join('\n') }
    } else if (sec.body.length > 80) {
      const cut = Math.max(40, Math.floor(sec.body.length * 0.6))
      work[removableIdx] = { ...sec, body: `${sec.body.slice(0, cut).trim()}…` }
    } else {
      work.splice(removableIdx, 1)
    }
  }

  let out = render()
  if (out.length > maxLen) {
    out = `${out.slice(0, Math.max(0, maxLen - 1)).trim()}…`
  }
  return out
}

function formatPaymentDue(iso: string | null): string {
  if (!iso?.trim()) return 'TBD'
  const d = new Date(`${iso.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return `Due: ${iso.trim()}`
  return `Due: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)}`
}

/**
 * Plain-text Google Calendar event description: artist-first (schedule, place, contact, money, gear).
 */
export function buildGoogleCalendarDealDescription(
  deal: GoogleCalendarDealDescriptionInput,
  venueDealTerms: DealTerms | null,
  extras?: GoogleCalendarDealDescriptionExtras,
): string | undefined {
  const maxLen = extras?.maxLength ?? 8000
  const grossRaw = Number(deal.gross_amount)
  const gross = Number.isFinite(grossRaw) ? grossRaw : 0
  const sections: DescSection[] = []

  const whenInput = {
    event_start_at: deal.event_start_at,
    event_end_at: deal.event_end_at,
    event_date: deal.event_date,
    performance_start_at: deal.performance_start_at,
    performance_end_at: deal.performance_end_at,
  }
  const eventLine = whenLineFriendlyFromDeal(whenInput) || deal.event_date?.trim() || ''
  const setLine = performanceWindowReadableFromDeal(whenInput)
  const schedParts: string[] = []
  if (eventLine) schedParts.push(`Event: ${eventLine}`)
  if (setLine) schedParts.push(`Your set: ${setLine}`)
  if (schedParts.length) {
    sections.push({ title: 'Schedule', body: schedParts.join('\n') })
  }

  const vn = extras?.venueName?.trim()
  const addr = extras?.venueAddressLine?.trim()
  if (vn || addr) {
    const whereParts: string[] = []
    if (vn) whereParts.push(vn)
    if (addr) whereParts.push(addr)
    sections.push({ title: 'Where', body: whereParts.join('\n') })
  }

  const oc = extras?.onsiteContactLine?.trim()
  if (oc) {
    sections.push({ title: 'Contact', body: oc })
  }

  const payLines: string[] = []
  payLines.push(`Contract: ${formatUsdDisplayCeil(gross)}`)

  const d = deal as Deal
  const depDue = depositDueFromDeal(d)
  const depPaid = Number(deal.deposit_paid_amount ?? 0)
  const remainder = dealRemainingClientBalance(d)

  if (depDue > 0) {
    payLines.push(`Deposit due: ${formatUsdDisplayCeil(depDue)}`)
    payLines.push(`Deposit paid: ${formatUsdDisplayCeil(depPaid)}`)
  }
  payLines.push(`Still owed (total): ${formatUsdDisplayCeil(remainder)}`)
  payLines.push(`Pay by: ${formatPaymentDue(deal.payment_due_date)}`)

  const tier = deal.commission_tier
  if (tier === 'artist_network') {
    payLines.push('Artist network — no manager booking commission.')
  } else if (tier) {
    const rateRaw = Number(deal.commission_rate ?? COMMISSION_TIER_RATES[tier])
    const pct = Number.isFinite(rateRaw) ? Math.round(rateRaw * 100) : 0
    const tierLabel = COMMISSION_TIER_LABELS[tier]
    const comm = Number(deal.commission_amount ?? 0)
    payLines.push(
      `Manager commission: ${tierLabel} · ${pct}% · send ${formatUsdDisplayCeil(Number.isFinite(comm) ? comm : 0)}`,
    )
  }

  sections.push({ title: 'Money', body: payLines.join('\n') })

  const snap = isDealPricingSnapshot(deal.pricing_snapshot) ? deal.pricing_snapshot : null
  if (snap && Number.isFinite(snap.total) && Math.round(snap.total) !== Math.round(gross)) {
    sections.push({
      title: 'Details',
      body: `Calculator quote was ${formatUsdDisplayCeil(snap.total)}; contract amount above is binding.`,
    })
  }

  const gearLabels = artistGigLogisticsLabelsFromDeal(deal.promise_lines ?? null, gross).slice(0, 5)
  const dt = venueDealTerms
  const gearExtra: string[] = [...gearLabels]
  if (dt?.set_length?.trim()) gearExtra.push(`Set length: ${dt.set_length.trim()}`)
  if (dt?.load_in_time?.trim()) gearExtra.push(`Load-in: ${dt.load_in_time.trim()}`)
  const logNotes = dt?.notes?.trim()
  if (logNotes) {
    const short = logNotes.length > 280 ? `${logNotes.slice(0, 277)}…` : logNotes
    gearExtra.push(short)
  }
  if (gearExtra.length) {
    sections.push({ title: 'Gear', body: gearExtra.map(g => `- ${g}`).join('\n') })
  }

  sections.push({ title: 'More', body: POINTER_LINE })

  const text = trimCalendarDescription(sections, maxLen).trim()
  return text.length ? text : undefined
}
