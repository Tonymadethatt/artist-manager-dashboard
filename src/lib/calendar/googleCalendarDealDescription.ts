import type { CommissionTier, DealTerms } from '@/types'
import {
  COMMISSION_TIER_LABELS,
  isDealPricingSnapshot,
} from '@/types'
import type { DealPromiseLine } from '@/lib/showReportCatalog'
import {
  SHOW_REPORT_PRESETS,
  isLineMajor,
  normalizePromiseLinesDoc,
  resolvePromiseLineDisplayLabel,
} from '@/lib/showReportCatalog'

const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

const FULL_DETAIL_FOOTER =
  'For the full breakdown of venue commitments, pricing, and logistics, see the booking confirmation email your team sent for this show (search your inbox for the venue or show name).'

export type GoogleCalendarDealDescriptionInput = {
  notes: string | null
  gross_amount: number
  payment_due_date: string | null
  commission_tier: CommissionTier | null | undefined
  promise_lines?: unknown | null
  pricing_snapshot?: unknown | null
}

const PROTECTED_SECTION_TITLES = new Set(['PAY', 'PAYMENT', 'FULL DETAIL', 'SERVICE'])

function sortVenueCommitmentLines(lines: DealPromiseLine[]): DealPromiseLine[] {
  const presetIndex = (line: DealPromiseLine) => {
    if (line.presetKey) {
      const i = SHOW_REPORT_PRESETS.findIndex(p => p.id === line.presetKey)
      return i >= 0 ? i : 500
    }
    return 1000
  }
  return [...lines].sort((a, b) => {
    const ma = isLineMajor(a)
    const mb = isLineMajor(b)
    if (ma !== mb) return ma ? -1 : 1
    const pa = presetIndex(a)
    const pb = presetIndex(b)
    if (pa !== pb) return pa - pb
    return a.label.localeCompare(b.label)
  })
}

export function topVenueCommitmentLabelsForCalendar(
  promiseLinesDoc: unknown,
  grossAmount: number,
  max: number,
): string[] {
  const { venue } = normalizePromiseLinesDoc(promiseLinesDoc)
  const sorted = sortVenueCommitmentLines(venue)
  return sorted
    .slice(0, max)
    .map(l => resolvePromiseLineDisplayLabel(l, grossAmount))
}

function formatPaymentDue(iso: string | null): string {
  if (!iso?.trim()) return 'Due: TBD'
  const d = new Date(`${iso.trim()}T12:00:00`)
  if (Number.isNaN(d.getTime())) return `Due: ${iso.trim()}`
  return `Due: ${new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(d)}`
}

function commissionLabel(tier: CommissionTier | null | undefined): string {
  if (tier && tier in COMMISSION_TIER_LABELS) {
    return COMMISSION_TIER_LABELS[tier as CommissionTier]
  }
  return 'Booking'
}

type DescSection = { title: string; body: string }

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
    if (sec.title === 'VENUE COMMITMENTS (TOP 5)') {
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

/**
 * Plain-text Google Calendar event description: compact sections + pointer to confirmation email.
 */
export function buildGoogleCalendarDealDescription(
  deal: GoogleCalendarDealDescriptionInput,
  venueDealTerms: DealTerms | null,
  options?: { maxLength?: number },
): string | undefined {
  const maxLen = options?.maxLength ?? 8000
  const grossRaw = Number(deal.gross_amount)
  const gross = Number.isFinite(grossRaw) ? grossRaw : 0
  const tier = deal.commission_tier ?? null
  const sections: DescSection[] = []

  const payLines: string[] = [`Gross: ${usdWhole.format(gross)}`]
  const snap = isDealPricingSnapshot(deal.pricing_snapshot) ? deal.pricing_snapshot : null
  if (snap && Number.isFinite(snap.total) && Math.round(snap.total) !== Math.round(gross)) {
    payLines.push(`Quote total: ${usdWhole.format(snap.total)}`)
  }
  sections.push({ title: 'PAY', body: payLines.join('\n') })

  const serviceLines: string[] = [commissionLabel(tier)]
  if (snap) {
    serviceLines.push(snap.baseMode === 'package' ? 'Basis: package' : 'Basis: hourly')
    const hours = snap.performanceHours
    if (Number.isFinite(hours) && hours > 0) {
      serviceLines.push(`Performance hours: ${hours}`)
    }
  }
  sections.push({ title: 'SERVICE', body: serviceLines.join('\n') })

  sections.push({ title: 'PAYMENT', body: formatPaymentDue(deal.payment_due_date) })

  const timeLines: string[] = []
  const dt = venueDealTerms
  if (snap && Number.isFinite(snap.performanceHours) && snap.performanceHours > 0) {
    timeLines.push(`Performance: ${snap.performanceHours} hr`)
  }
  if (dt?.set_length?.trim()) timeLines.push(`Set length: ${dt.set_length.trim()}`)
  if (dt?.load_in_time?.trim()) timeLines.push(`Load-in: ${dt.load_in_time.trim()}`)
  if (timeLines.length) sections.push({ title: 'TIME', body: timeLines.join('\n') })

  const commitments = topVenueCommitmentLabelsForCalendar(deal.promise_lines, gross, 5)
  if (commitments.length) {
    sections.push({
      title: 'VENUE COMMITMENTS (TOP 5)',
      body: commitments.map(c => `- ${c}`).join('\n'),
    })
  }

  const notesBlock = deal.notes?.trim()
  if (notesBlock) sections.push({ title: 'NOTES', body: notesBlock })

  const logisticsNotes = dt?.notes?.trim()
  if (logisticsNotes) {
    sections.push({ title: 'LOGISTICS', body: logisticsNotes })
  }

  sections.push({ title: 'FULL DETAIL', body: FULL_DETAIL_FOOTER })

  const text = trimCalendarDescription(sections, maxLen).trim()
  return text.length ? text : undefined
}
