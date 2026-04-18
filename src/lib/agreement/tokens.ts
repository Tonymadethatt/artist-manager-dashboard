import type { ArtistProfile, Contact, Deal, PricingCatalogDoc, TemplateSection, Venue } from '../../types'
import {
  dealDepositSatisfied,
  dealRemainingClientBalance,
  dealTotalPaidTowardGross,
} from '../deals/dealPaymentTotals'
import { isDealPricingSnapshot } from '../../types'
import { COMMISSION_TIER_LABELS, VENUE_TYPE_LABELS } from '../../types'
import {
  formatPacificDateLongFromIso,
  formatPacificDateLongFromYmd,
  formatPacificInstantReadable,
  formatPacificTime12h,
  formatPacificTimeRangeReadable,
} from '../calendar/pacificWallTime'
import { buildPricingAgreementTransparency } from './pricingAgreementTransparency'
import { contactRoleForDisplay } from '../contacts/contactTitles'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

/** Pretty US phone for agreements; non‑10/11-digit input returned trimmed as-is. */
export function formatPhoneDisplay(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const d = raw.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11 && d[0] === '1') return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return raw.trim()
}

function durationBetweenUtcIso(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return ''
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return ''
  const minsTotal = Math.floor((b - a) / 60000)
  if (minsTotal <= 0) return ''
  if (minsTotal < 60) return minsTotal === 1 ? '1 minute' : `${minsTotal} minutes`
  const h = Math.floor(minsTotal / 60)
  const m = minsTotal % 60
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`
  return `${h} h ${m} min`
}

/** Decimal hours between instants, e.g. "2" or "2.5" (empty if invalid). */
function durationHoursBetweenUtcIso(start: string | null | undefined, end: string | null | undefined): string {
  if (!start || !end) return ''
  const a = new Date(start).getTime()
  const b = new Date(end).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return ''
  const hours = (b - a) / 3600000
  const rounded = Math.round(hours * 100) / 100
  if (rounded <= 0) return ''
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

function durationFromPerformanceHours(h: number): string {
  if (!Number.isFinite(h) || h <= 0) return ''
  if (h === 1) return '1 hour'
  if (Number.isInteger(h)) return `${h} hours`
  const r = Math.round(h * 100) / 100
  return `${r} hours`
}

/** Variable names referenced as `{{name}}` in section bodies. */
export function extractVariableNames(sections: TemplateSection[]): string[] {
  const combined = sections.map(s => s.content).join('\n')
  const matches = combined.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map(m => m[1]))]
}

/**
 * Deterministic prefill from venue + artist profile for common token names.
 * User edits still win — merge this as defaults when venue/profile changes.
 */
export function buildVenueProfilePrefill(venue: Venue | null, profile: ArtistProfile | null): Record<string, string> {
  const out: Record<string, string> = {}
  if (venue) {
    out.venue_name = venue.name
    if (venue.city) out.city = venue.city
    if (venue.location) out.location = venue.location
    out.venue_type = venue.venue_type
    out.venue_type_label = VENUE_TYPE_LABELS[venue.venue_type]
    const dt = venue.deal_terms
    if (dt?.event_date) {
      const raw = String(dt.event_date).trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        out.event_date_iso = raw
        out.event_date = formatPacificDateLongFromYmd(raw)
      } else {
        out.event_date = raw
      }
    }
    if (dt?.pay != null) {
      out.artist_pay = String(dt.pay)
      if (!Number.isNaN(dt.pay)) out.artist_pay_display = usd.format(dt.pay)
    }
    if (dt?.set_length) out.set_length = String(dt.set_length)
    if (dt?.load_in_time) out.load_in_time = String(dt.load_in_time)
    if (dt?.notes) out.notes = String(dt.notes)
    if (venue.capacity?.trim()) out.venue_capacity = venue.capacity.trim()
  }
  if (profile) {
    out.artist_name = profile.artist_name
    if (profile.company_name) out.company_name = profile.company_name
    if (profile.tagline) out.tagline = profile.tagline
    if (profile.website) out.website = profile.website
    if (profile.phone) {
      const p = profile.phone.trim()
      const disp = formatPhoneDisplay(p) || p
      out.phone = disp
      out.phone_display = disp
    }
    if (profile.reply_to_email) out.reply_to_email = profile.reply_to_email
    if (profile.artist_email) out.artist_email = profile.artist_email
    if (profile.social_handle) out.social_handle = profile.social_handle
    if (profile.from_email) out.from_email = profile.from_email
    if (profile.manager_name) out.manager_name = profile.manager_name
    if (profile.manager_email) out.manager_email = profile.manager_email
    if (profile.manager_phone?.trim()) {
      const p = profile.manager_phone.trim()
      const disp = formatPhoneDisplay(p) || p
      out.manager_phone = disp
      out.manager_phone_display = disp
    }
  }
  return out
}

const usdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
})

/** Plain-text lines for templates; only when `pricing_snapshot` exists on the deal. */
export function pricingSnapshotAgreementFields(deal: Deal): Record<string, string> {
  if (!deal.pricing_snapshot || !isDealPricingSnapshot(deal.pricing_snapshot)) return {}
  const s = deal.pricing_snapshot
  const lines: string[] = []
  lines.push(`Quote total: ${usdWhole.format(s.total)}`)
  if (s.taxAmount) lines.push(`Tax: ${usdWhole.format(s.taxAmount)}`)
  if (s.depositDue) lines.push(`Deposit: ${usdWhole.format(s.depositDue)}`)
  if (s.depositPercentApplied != null && Number.isFinite(s.depositPercentApplied)) {
    lines.push(`Deposit policy: ${Math.round(s.depositPercentApplied)}% of contract total`)
  }
  lines.push(`Basis: ${s.finalSource === 'manual' ? 'manual gross on deal' : 'calculator'}`)
  return {
    pricing_summary_text: lines.join('\n'),
    pricing_total_display: usdWhole.format(s.total),
    pricing_deposit_display: usdWhole.format(s.depositDue),
  }
}

/** Prefill for File Builder: venue, profile, optional deal, optional contact for merge fields. */
export function buildAgreementPrefill(
  venue: Venue | null,
  profile: ArtistProfile | null,
  deal: Deal | null,
  mergeContact: Contact | null,
  onsiteContact: Contact | null = null,
  /** Other venue contacts: used to fill `contact_phone` when the selected contact has no phone. */
  venueContactsFallback: Contact[] | null = null,
  /** When set, enriches pricing merge fields (hourly reference, package line, extended-time clause). */
  pricingCatalog: PricingCatalogDoc | null = null,
): Record<string, string> {
  const out = { ...buildVenueProfilePrefill(venue, profile) }

  if (deal) {
    out.deal_description = deal.description
    out.event_name = deal.description
    if (deal.event_date?.trim()) {
      const isoYmd = deal.event_date.trim()
      out.deal_event_date_iso = isoYmd
      if (/^\d{4}-\d{2}-\d{2}$/.test(isoYmd)) {
        const pretty = formatPacificDateLongFromYmd(isoYmd)
        out.deal_event_date = pretty
        out.event_date = pretty
      } else {
        out.deal_event_date = isoYmd
        out.event_date = isoYmd
      }
    }

    if (deal.event_start_at) {
      out.event_start_time = formatPacificTime12h(deal.event_start_at)
    }
    if (deal.event_end_at) {
      out.event_end_time = formatPacificTime12h(deal.event_end_at)
    }
    if (deal.event_date?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(deal.event_date.trim())) {
      out.event_date_display = formatPacificDateLongFromYmd(deal.event_date.trim())
    } else if (deal.event_start_at) {
      out.event_date_display = formatPacificDateLongFromIso(deal.event_start_at)
    }
    if (deal.event_start_at && deal.event_end_at) {
      out.event_window_display = formatPacificTimeRangeReadable(deal.event_start_at, deal.event_end_at)
    } else if (deal.event_start_at) {
      out.event_window_display = formatPacificInstantReadable(deal.event_start_at)
    }

    if (deal.performance_start_at) {
      out.performance_start_time = formatPacificTime12h(deal.performance_start_at)
    }
    if (deal.performance_end_at) {
      out.performance_end_time = formatPacificTime12h(deal.performance_end_at)
    }
    if (deal.event_date?.trim() && /^\d{4}-\d{2}-\d{2}$/.test(deal.event_date.trim())) {
      out.performance_date_display = formatPacificDateLongFromYmd(deal.event_date.trim())
    } else if (deal.performance_start_at) {
      out.performance_date_display = formatPacificDateLongFromIso(deal.performance_start_at)
    } else if (deal.event_start_at) {
      out.performance_date_display = formatPacificDateLongFromIso(deal.event_start_at)
    }
    if (deal.performance_start_at && deal.performance_end_at) {
      out.performance_window_display = formatPacificTimeRangeReadable(
        deal.performance_start_at,
        deal.performance_end_at,
      )
    } else if (deal.performance_start_at) {
      out.performance_window_display = formatPacificInstantReadable(deal.performance_start_at)
    }
    if (deal.performance_genre?.trim()) out.performance_genre = deal.performance_genre.trim()

    const perfStartIso = deal.performance_start_at
    const perfEndIso = deal.performance_end_at
    const evtStartIso = deal.event_start_at
    const evtEndIso = deal.event_end_at
    const setStartIso = perfStartIso || evtStartIso || null
    const setEndIso = perfEndIso || evtEndIso || null
    if (setStartIso) out.set_start_time = formatPacificTime12h(setStartIso)
    if (setEndIso) out.set_end_time = formatPacificTime12h(setEndIso)

    let setDur = durationBetweenUtcIso(perfStartIso, perfEndIso)
    let setDurHours = durationHoursBetweenUtcIso(perfStartIso, perfEndIso)
    if (!setDur) {
      setDur = durationBetweenUtcIso(evtStartIso, evtEndIso)
      setDurHours = durationHoursBetweenUtcIso(evtStartIso, evtEndIso)
    }
    if (
      !setDur &&
      deal.pricing_snapshot &&
      isDealPricingSnapshot(deal.pricing_snapshot) &&
      deal.pricing_snapshot.performanceHours > 0
    ) {
      setDur = durationFromPerformanceHours(deal.pricing_snapshot.performanceHours)
      const ph = deal.pricing_snapshot.performanceHours
      setDurHours = Number.isInteger(ph) ? String(ph) : String(Math.round(ph * 100) / 100)
    }
    if (!setDur && venue?.deal_terms?.set_length?.trim()) {
      setDur = venue.deal_terms.set_length.trim()
    }
    if (setDur) {
      out.set_duration = setDur
      out.set_length = setDur
    }
    if (setDurHours) out.set_duration_hours = setDurHours

    const depPaid = Number(deal.deposit_paid_amount ?? 0)
    const balPaid = Number(deal.balance_paid_amount ?? 0)
    const totalPaid = dealTotalPaidTowardGross(deal)
    const balanceDue = dealRemainingClientBalance(deal)
    const balanceFmt = usd.format(balanceDue)
    out.balance_amount = balanceFmt
    out.balance_amount_display = balanceFmt
    out.balance_amount_numeric = String(balanceDue)
    out.remaining_balance = balanceFmt
    out.remaining_balance_display = balanceFmt
    out.deposit_paid_display = usdWhole.format(depPaid)
    out.balance_paid_display = usdWhole.format(balPaid)
    out.total_paid_display = usdWhole.format(totalPaid)
    const depDueSnap =
      deal.pricing_snapshot && isDealPricingSnapshot(deal.pricing_snapshot)
        ? deal.pricing_snapshot.depositDue
        : deal.deposit_due_amount ?? 0
    const depDueN = Number(depDueSnap) || 0
    out.deposit_due_display = usdWhole.format(depDueN)
    out.deposit_satisfied_plain = dealDepositSatisfied(deal) ? 'yes' : 'no'
    out.fully_settled_plain = deal.artist_paid ? 'yes' : 'no'
    if (deal.artist_paid) {
      out.payment_status_plain = 'Fully settled'
    } else if (balanceDue <= 0.01 && totalPaid > 0) {
      out.payment_status_plain = 'Recorded payments match contract; confirm “Done” in Earnings if complete'
    } else if (dealDepositSatisfied(deal) && depDueN > 0) {
      out.payment_status_plain = 'Deposit received; balance still due'
    } else if (totalPaid > 0) {
      out.payment_status_plain = 'Partial payment recorded'
    } else {
      out.payment_status_plain = 'No payments recorded'
    }

    out.gross_amount = String(deal.gross_amount)
    out.gross_amount_display = usd.format(deal.gross_amount)
    out.full_fee_display = out.gross_amount_display
    out.cancellation_full_fee_display = out.gross_amount_display
    out.contract_fee_display = out.gross_amount_display
    // Match Earnings UI: stored as fraction (0.2), agreements show as percent (20%)
    out.commission_rate = `${Math.round(deal.commission_rate * 100)}%`
    out.commission_rate_fraction = String(deal.commission_rate)
    out.commission_amount = String(deal.commission_amount)
    out.commission_amount_display = usd.format(deal.commission_amount)
    out.commission_tier = COMMISSION_TIER_LABELS[deal.commission_tier]
    if (deal.payment_due_date) out.payment_due_date = deal.payment_due_date
    if (deal.agreement_url) out.agreement_url = deal.agreement_url
    if (deal.notes?.trim()) out.deal_notes = deal.notes.trim()
    Object.assign(out, pricingSnapshotAgreementFields(deal))
    Object.assign(out, buildPricingAgreementTransparency(deal, pricingCatalog))

    const cap =
      venue?.capacity?.trim() ||
      deal.venue?.capacity?.trim() ||
      ''
    if (cap) out.venue_capacity = cap
  }

  if (mergeContact) {
    out.contact_name = mergeContact.name
    const mergeRole = contactRoleForDisplay(mergeContact)
    if (mergeRole) out.contact_role = mergeRole
    if (mergeContact.email) out.contact_email = mergeContact.email
    const phoneRaw =
      mergeContact.phone?.trim() ||
      venueContactsFallback?.find(c => c.phone?.trim())?.phone?.trim() ||
      ''
    const phoneDisp = phoneRaw ? formatPhoneDisplay(phoneRaw) || phoneRaw : ''
    if (phoneDisp) {
      out.contact_phone = phoneDisp
      out.contact_phone_display = phoneDisp
    }
    if (mergeContact.company?.trim()) {
      const co = mergeContact.company.trim()
      out.contact_company = co
      // Many templates use {{company_name}} for the counterparty; fill from contact when Settings artist company is empty.
      if (!out.company_name?.trim()) out.company_name = co
    }
    out.client_name = mergeContact.name
    if (mergeRole) out.client_role = mergeRole
    if (mergeContact.email) out.client_email = mergeContact.email
    if (phoneDisp) {
      out.client_phone = phoneDisp
      out.client_phone_display = phoneDisp
    }
    if (mergeContact.company?.trim()) out.client_company = mergeContact.company.trim()
  }

  if (onsiteContact) {
    out.onsite_contact_name = onsiteContact.name
    const onsiteRole = contactRoleForDisplay(onsiteContact)
    if (onsiteRole) out.onsite_contact_role = onsiteRole
    if (onsiteContact.email?.trim()) out.onsite_contact_email = onsiteContact.email.trim()
    if (onsiteContact.phone?.trim()) {
      const op = onsiteContact.phone.trim()
      const od = formatPhoneDisplay(op) || op
      out.onsite_contact_phone = od
      out.onsite_contact_phone_display = od
    }
    if (onsiteContact.company?.trim()) out.onsite_contact_company = onsiteContact.company.trim()
  }

  return out
}
