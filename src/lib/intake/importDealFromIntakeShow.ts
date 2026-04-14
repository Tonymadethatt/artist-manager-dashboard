import type { CommissionTier, Contact, Deal, DealPricingFinalSource, Venue } from '@/types'
import type { PricingCatalogDoc } from '@/types'
import { buildPromiseLinesDocV2FromUi, defaultArtistPromisePresets, SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'
import { catalogHasMinimumForDealLogging, computeDealPrice } from '@/lib/pricing/computeDealPrice'
import { mapShowBundleToEarningsImport, type DealFormImportShape } from '@/lib/intake/mapIntakeToDealForm'
import { overlappingDealIds } from '@/lib/calendar/dealTimeOverlap'
import { pacificWallToUtcIso, addCalendarDaysPacific } from '@/lib/calendar/pacificWallTime'
import { syncDealCalendarSideEffects } from '@/lib/calendar/queueGigCalendarEmails'
import type { BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'
import { resolveIntakeOnsiteContactId } from '@/lib/intake/syncIntakeVenueContacts'
import { supabase } from '@/lib/supabase'

function allTrueVenuePresets(): Record<string, boolean> {
  return Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, true])) as Record<string, boolean>
}

function buildEventWallUtc(form: DealFormImportShape): { event_start_at: string | null; event_end_at: string | null } {
  const showDate = form.event_date.trim()
  const st = form.event_start_time.trim()
  const et = form.event_end_time.trim()
  if (!showDate || !st || !et) return { event_start_at: null, event_end_at: null }
  const [sh, sm] = st.split(':').map(Number)
  const [eh, em] = et.split(':').map(Number)
  let endYmd = showDate
  if (Number.isFinite(sh) && Number.isFinite(sm) && Number.isFinite(eh) && Number.isFinite(em)) {
    if (eh * 60 + em <= sh * 60 + sm) endYmd = addCalendarDaysPacific(showDate, 1)
  }
  const sIso = pacificWallToUtcIso(showDate, st)
  const eIso = pacificWallToUtcIso(endYmd, et)
  return { event_start_at: sIso, event_end_at: eIso }
}

function buildPerformanceWallUtc(form: DealFormImportShape): {
  performance_start_at: string | null
  performance_end_at: string | null
} {
  const showDate = form.event_date.trim()
  const pst = form.performance_start_time.trim()
  const pet = form.performance_end_time.trim()
  if (!showDate || !pst || !pet) {
    return { performance_start_at: null, performance_end_at: null }
  }
  const [psh, psm] = pst.split(':').map(Number)
  const [peh, pem] = pet.split(':').map(Number)
  let endYmdP = showDate
  if (Number.isFinite(psh) && Number.isFinite(psm) && Number.isFinite(peh) && Number.isFinite(pem)) {
    if (peh * 60 + pem <= psh * 60 + psm) endYmdP = addCalendarDaysPacific(showDate, 1)
  }
  const psIso = pacificWallToUtcIso(showDate, pst)
  const peIso = pacificWallToUtcIso(endYmdP, pet)
  return { performance_start_at: psIso, performance_end_at: peIso }
}

export type ImportIntakeDealAddDeal = (deal: {
  description: string
  venue_id: string | null
  event_date: string | null
  event_start_at?: string | null
  event_end_at?: string | null
  gross_amount: number
  commission_tier: CommissionTier
  payment_due_date?: string | null
  agreement_url?: string | null
  agreement_generated_file_id?: string | null
  promise_lines?: unknown | null
  pricing_snapshot?: unknown | null
  deposit_due_amount?: number | null
  deposit_paid_amount?: number
  notes: string | null
  performance_genre?: string | null
  performance_start_at?: string | null
  performance_end_at?: string | null
  onsite_contact_id?: string | null
}) => Promise<{ data?: Deal; error?: { message?: string } | Error }>

export type ImportDealFromShowResult =
  | { ok: true; deal: Deal }
  | { ok: false; error: string }
  | { ok: false; needsOverlapConfirm: true }

export async function importDealFromIntakeShow(params: {
  rawShowData: unknown
  venueData: BookingIntakeVenueDataV3
  venueId: string
  showId: string
  catalog: PricingCatalogDoc
  venues: Venue[]
  deals: Deal[]
  addDeal: ImportIntakeDealAddDeal
  updateVenue: (id: string, updates: { capacity?: string | null }) => Promise<{ error?: { message?: string } }>
  refetchVenues: () => Promise<void>
  artistEmail: string | null | undefined
  allowOverlap: boolean
  /** Fresh venue roster; used to set deal.onsite_contact_id from intake. */
  venueContacts?: Contact[] | null
}): Promise<ImportDealFromShowResult> {
  const {
    rawShowData,
    venueData,
    venueId,
    showId,
    catalog,
    venues,
    deals,
    addDeal,
    updateVenue,
    refetchVenues,
    artistEmail,
    allowOverlap,
    venueContacts,
  } = params

  if (!catalogHasMinimumForDealLogging(catalog)) {
    return { ok: false, error: 'Add packages or hourly rates under Pricing & fees before importing deals.' }
  }

  const imp = mapShowBundleToEarningsImport(rawShowData, catalog, venueData)
  const form = imp.form
  const gross = parseFloat(form.gross_amount)
  if (!form.description.trim() || Number.isNaN(gross) || gross <= 0) {
    return {
      ok: false,
      error: 'Deal needs a description and a positive gross. Fix the show draft, capacity, or pricing catalog.',
    }
  }

  const presetAny = Object.values(imp.promisePresets).some(Boolean)
  const venuePresets = presetAny ? imp.promisePresets : allTrueVenuePresets()
  const promiseDoc = buildPromiseLinesDocV2FromUi(venuePresets, [''], defaultArtistPromisePresets(), [''])
  if (promiseDoc.venue.lines.length === 0) {
    return { ok: false, error: 'No venue recap lines could be built. Check Phase 6 promises on the intake.' }
  }

  const p = imp.pricing
  let pricingComputed: ReturnType<typeof computeDealPrice>
  try {
    pricingComputed = computeDealPrice({
      catalog,
      eventDate: form.event_date.trim() || null,
      baseMode: p.pricingBaseMode,
      packageId: p.pricingPackageId,
      serviceId: p.pricingServiceId,
      overtimeServiceId: p.pricingOvertimeServiceId,
      performanceHours: p.pricingPerformanceHours,
      addonQuantities: p.pricingAddonQty,
      surchargeIds: p.pricingSurchargeIds,
      discountIds: p.pricingDiscountIds,
    })
  } catch {
    return { ok: false, error: 'Could not run the pricing calculator from this draft.' }
  }

  const cap = form.venue_capacity.trim() || null
  const curVenue = venues.find(v => v.id === venueId)
  if (curVenue && (curVenue.capacity ?? null) !== cap) {
    const ur = await updateVenue(venueId, { capacity: cap })
    if (ur.error) return { ok: false, error: ur.error.message ?? 'Could not update venue capacity' }
    await refetchVenues()
  }

  const { event_start_at, event_end_at } = buildEventWallUtc(form)
  const { performance_start_at, performance_end_at } = buildPerformanceWallUtc(form)

  const overlaps = overlappingDealIds(
    { id: '__new__', event_start_at, event_end_at },
    deals.map(d => ({ id: d.id, event_start_at: d.event_start_at, event_end_at: d.event_end_at })),
  )
  if (overlaps.length > 0 && !allowOverlap) {
    return { ok: false, needsOverlapConfirm: true }
  }

  const linkedVenue = venues.find(v => v.id === venueId) ?? null
  const isCommunityVenue = linkedVenue && (linkedVenue.outreach_track ?? 'pipeline') === 'community'
  const commissionTier: CommissionTier = isCommunityVenue
    ? 'artist_network'
    : form.commission_tier === 'artist_network'
      ? 'new_doors'
      : form.commission_tier

  const depPaidRaw = parseFloat(form.deposit_paid_amount)
  const depositPaidSafe = !Number.isNaN(depPaidRaw) && depPaidRaw >= 0 ? depPaidRaw : 0

  const roundedFormGross = Math.round(gross)
  const onsiteContactId = resolveIntakeOnsiteContactId(venueData, venueContacts ?? [])
  const finalSource: DealPricingFinalSource =
    pricingComputed.gross === roundedFormGross ? 'calculated' : 'manual'
  const pricingSnapshotPayload = {
    ...pricingComputed.snapshot,
    finalSource,
    computedAt: new Date().toISOString(),
  }

  const r = await addDeal({
    description: form.description.trim(),
    venue_id: venueId,
    event_date: form.event_date.trim() || null,
    event_start_at,
    event_end_at,
    performance_genre: form.performance_genre.trim() || null,
    performance_start_at,
    performance_end_at,
    onsite_contact_id: onsiteContactId,
    gross_amount: gross,
    commission_tier: commissionTier,
    payment_due_date: form.payment_due_date || null,
    agreement_url: null,
    agreement_generated_file_id: null,
    promise_lines: promiseDoc,
    pricing_snapshot: pricingSnapshotPayload,
    deposit_due_amount: pricingSnapshotPayload.depositDue ?? null,
    deposit_paid_amount: depositPaidSafe,
    notes: form.notes || null,
  })

  if (r.error) {
    const msg =
      r.error instanceof Error
        ? r.error.message
        : typeof r.error === 'object' && r.error && 'message' in r.error
          ? String((r.error as { message?: string }).message)
          : 'Save failed'
    return { ok: false, error: msg }
  }
  const saved = r.data
  if (!saved) return { ok: false, error: 'Save failed' }

  await supabase.from('booking_intake_shows').update({ imported_deal_id: saved.id }).eq('id', showId)

  const vAfter = (saved.venue ?? linkedVenue) as Venue | null

  await syncDealCalendarSideEffects({
    beforeDeal: null,
    afterDeal: saved,
    venueBefore: null,
    venueAfter: vAfter,
    artistEmail,
  })

  return { ok: true, deal: saved }
}
