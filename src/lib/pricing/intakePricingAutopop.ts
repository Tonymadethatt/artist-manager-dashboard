import type { BookingIntakeShowDataV3, KnownEventTypeV3 } from '@/lib/intake/intakePayloadV3'
import { resolveProductionPackageCandidates } from '@/lib/intake/intakePayloadV3'
import type { PricingCatalogDoc, PricingService } from '@/types'
import { catalogHasMinimumForDealLogging, isWeekendDate, pickDefaultServiceId } from '@/lib/pricing/computeDealPrice'

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** USB / “DJ only” style lowest tier — only offered when the venue provides the rig. */
export function intakeServiceLooksDjOnlyUsb(s: PricingService): boolean {
  const n = norm(s.name)
  return (
    n.includes('dj only') ||
    (n.includes('usb') && (n.includes('no equip') || n.includes('400'))) ||
    /\b400\b.*\/hr|\/hr.*\b400\b/.test(n)
  )
}

function isLargeCapacity(sd: BookingIntakeShowDataV3): boolean {
  if (sd.approximate_headcount >= 2000) return true
  const r = sd.capacity_range
  return (
    r === '2000_5000' ||
    r === '5000_10000' ||
    r === '10000_25000' ||
    r === '25000_50000' ||
    r === '50000_100000' ||
    r === '100000_250000' ||
    r === '250000_plus' ||
    r === '5000_plus'
  )
}

/** Event-type + calendar-aware hourly pick; excludes DJ-only tier unless venue provides gear. */
export function suggestIntakeHourlyServiceId(
  catalog: PricingCatalogDoc,
  eventType: KnownEventTypeV3 | '',
  eventDate: string,
  equipmentProvider: BookingIntakeShowDataV3['equipment_provider'],
): string | null {
  if (!catalog.services.length) return null
  const dateOk = eventDate.trim() && /^\d{4}-\d{2}-\d{2}$/.test(eventDate.trim())
  const weekend = dateOk ? isWeekendDate(eventDate.trim()) : false
  const pool = catalog.services.filter(s => {
    if (s.priceType !== 'per_hour') return false
    if (intakeServiceLooksDjOnlyUsb(s) && equipmentProvider !== 'venue_provides') return false
    if (!dateOk || s.dayType === 'any') return true
    if (s.dayType === 'weekend') return weekend
    return !weekend
  })

  const fallbackPool = pool.length ? pool : catalog.services.filter(s => s.priceType === 'per_hour')

  const festivalLike = eventType === 'festival' || eventType === 'concert'
  const useWeekendTier = weekend || festivalLike

  const score = (s: PricingService): number => {
    const n = norm(s.name)
    let sc = 0
    if (eventType === 'wedding') {
      if (n.includes('vip') || n.includes('high profile') || n.includes('high-profile') || n.includes('wedding'))
        sc += 12
      return sc
    }
    if (eventType === 'corporate' || eventType === 'brand_activation') {
      if (
        n.includes('corporate') ||
        n.includes('brand') ||
        n.includes('activation') ||
        n.includes('experiential') ||
        n.includes('premium event')
      )
        sc += 12
      return sc
    }
    if (festivalLike) {
      if (n.includes('weekend') && n.includes('standard')) sc += 12
      if (n.includes('1000')) sc += 2
      return sc
    }
    if (
      eventType === 'club_night' ||
      eventType === 'after_party' ||
      eventType === 'private_event' ||
      eventType === 'other' ||
      eventType === ''
    ) {
      if (useWeekendTier) {
        if (n.includes('weekend') && n.includes('standard')) sc += 12
        if (n.includes('1000')) sc += 2
      } else {
        if (n.includes('weekday') && n.includes('standard')) sc += 12
        if (n.includes('700')) sc += 2
      }
      return sc
    }
    return sc
  }

  let best: PricingService | null = null
  let bestScore = -1
  for (const s of fallbackPool) {
    const sc = score(s)
    if (sc > bestScore) {
      bestScore = sc
      best = s
    }
  }
  if (best && bestScore >= 10) return best.id
  const legacy = dateOk ? pickDefaultServiceId(catalog, eventDate.trim()) : null
  if (legacy) {
    const row = catalog.services.find(s => s.id === legacy)
    if (row && (!intakeServiceLooksDjOnlyUsb(row) || equipmentProvider === 'venue_provides')) return legacy
  }
  const first = fallbackPool[0]
  return first?.id ?? null
}

export function suggestIntakeDefaultPackageId(
  sd: BookingIntakeShowDataV3,
  catalog: PricingCatalogDoc,
): string | null {
  if (!catalog.packages.length) return null
  const { premium, platinum, exclusive } = resolveProductionPackageCandidates(catalog)
  if (sd.event_type === 'wedding') {
    return exclusive?.id ?? platinum?.id ?? premium?.id ?? catalog.packages[0]?.id ?? null
  }
  if (sd.event_type === 'private_event') {
    return premium?.id ?? catalog.packages[0]?.id ?? null
  }
  if (isLargeCapacity(sd)) {
    return platinum?.id ?? exclusive?.id ?? premium?.id ?? catalog.packages[0]?.id ?? null
  }
  return premium?.id ?? catalog.packages[0]?.id ?? null
}

function customSetlistAddonId(catalog: PricingCatalogDoc): string | null {
  const candidates = catalog.addons.filter(a => {
    const n = norm(a.name)
    return n.includes('setlist') || (n.includes('custom') && n.includes('set'))
  })
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0].id
  const target = 750
  const tol = 200
  let best = candidates[0]
  let bestDist = Infinity
  for (const a of candidates) {
    const dist = Math.abs(a.price - target)
    if (dist < bestDist) {
      bestDist = dist
      best = a
    }
  }
  if (bestDist <= tol) return best.id
  return candidates[0].id
}

/**
 * Non-destructive patches for §5A: billable hours, mode cleanup, service/package defaults, custom-setlist add-on.
 * Does not overwrite `service_id` / `package_id` when already set.
 */
export function computeIntakePricingSetupAutopop(
  sd: BookingIntakeShowDataV3,
  catalog: PricingCatalogDoc,
): Partial<BookingIntakeShowDataV3> {
  const patch: Partial<BookingIntakeShowDataV3> = {}
  if (!catalogHasMinimumForDealLogging(catalog)) return patch

  if (sd.equipment_provider === 'venue_provides' && sd.pricing_mode === 'package') {
    patch.pricing_mode = 'hourly'
    patch.package_id = ''
  }

  if (sd.pricing_mode !== 'package') {
    if (!sd.service_id.trim()) {
      const sid = suggestIntakeHourlyServiceId(
        catalog,
        sd.event_type,
        sd.event_date.trim(),
        sd.equipment_provider,
      )
      if (sid) {
        patch.service_id = sid
        if (!sd.overtime_service_id.trim()) patch.overtime_service_id = sid
      }
    } else if (!sd.overtime_service_id.trim()) {
      patch.overtime_service_id = sd.service_id
    }
  } else {
    if (!sd.package_id.trim()) {
      const pid = suggestIntakeDefaultPackageId(sd, catalog)
      if (pid) patch.package_id = pid
    }
    if (!sd.overtime_service_id.trim()) {
      const ot = suggestIntakeHourlyServiceId(
        catalog,
        sd.event_type,
        sd.event_date.trim(),
        sd.equipment_provider,
      )
      if (ot) patch.overtime_service_id = ot
      else if (sd.service_id.trim()) patch.overtime_service_id = sd.service_id
    }
  }

  const dismissed = new Set(sd.addon_autopop_dismissed_ids ?? [])
  if (sd.custom_setlist === 'specific_requests') {
    const aid = customSetlistAddonId(catalog)
    if (aid && !dismissed.has(aid)) {
      const q = sd.addon_quantities[aid] ?? 0
      if (q <= 0) {
        patch.addon_quantities = { ...sd.addon_quantities, [aid]: 1 }
        patch.addon_autopop_ids = [...new Set([...(sd.addon_autopop_ids ?? []), aid])]
      }
    }
  }

  return patch
}
