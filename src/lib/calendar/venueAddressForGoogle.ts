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
 * Calendar API `location` field: postal line when present, else venue name so Maps still has a target.
 */
export function formatVenueAddressForGoogleCalendar(
  v: VenueAddressForGoogle | null | undefined,
): string | undefined {
  if (!v) return undefined
  const postal = formatVenuePostalLine(v)
  if (postal) return postal
  return v.name?.trim() || undefined
}
