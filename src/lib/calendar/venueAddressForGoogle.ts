import type { Venue } from '@/types'

/** Fields needed to build a single-line postal address for Google Calendar / Maps. */
export type VenueAddressForGoogle = Pick<
  Venue,
  'name' | 'location' | 'city' | 'address_line2' | 'region' | 'postal_code' | 'country'
>

/**
 * Postal-style one line from structured fields only (no venue name).
 * Suitable for subtitles and “full address” copy.
 */
export function formatVenuePostalLine(
  v: VenueAddressForGoogle | null | undefined,
): string | undefined {
  if (!v) return undefined
  const line1 = v.location?.trim()
  const line2 = v.address_line2?.trim()
  const city = v.city?.trim()
  const region = v.region?.trim()
  const zip = v.postal_code?.trim()
  const country = v.country?.trim()

  const segments: string[] = []
  if (line1) segments.push(line1)
  if (line2) segments.push(line2)

  let cityRegionPostal = ''
  if (city && region && zip) cityRegionPostal = `${city}, ${region} ${zip}`
  else if (city && region) cityRegionPostal = `${city}, ${region}`
  else if (city && zip) cityRegionPostal = `${city} ${zip}`
  else cityRegionPostal = [city, region, zip].filter(Boolean).join(' ').trim()

  if (cityRegionPostal) segments.push(cityRegionPostal)
  if (country) segments.push(country)

  const joined = segments.join(', ').trim()
  return joined.length >= 2 ? joined : undefined
}

/**
 * Calendar API `location` field: full postal line when present; otherwise best-effort from any
 * structured fields + venue name (so partial addresses and “name + city” still map in Google).
 */
export function formatVenueAddressForGoogleCalendar(
  v: VenueAddressForGoogle | null | undefined,
): string | undefined {
  if (!v) return undefined
  const postal = formatVenuePostalLine(v)
  if (postal) return postal

  const name = v.name?.trim()
  const crumbs = [
    v.location?.trim(),
    v.address_line2?.trim(),
    v.city?.trim(),
    v.region?.trim(),
    v.postal_code?.trim(),
    v.country?.trim(),
  ].filter(Boolean) as string[]

  if (crumbs.length) {
    const tail = crumbs.join(', ')
    return name ? `${name} — ${tail}` : tail
  }
  return name || undefined
}
