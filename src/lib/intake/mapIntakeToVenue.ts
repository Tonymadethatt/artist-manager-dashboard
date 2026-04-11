import type { Venue } from '@/types'
import type { VenueIntakeBundle } from '@/lib/intake/intakePayload'

export function mapIntakeVenueBundleToVenueRow(
  bundle: VenueIntakeBundle,
): Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const f = bundle.fields
  return {
    name: (f.name.trim() || f.call_contact_name.trim() || 'Untitled venue').trim(),
    location: f.location?.trim() || null,
    city: f.city?.trim() || null,
    address_line2: f.address_line2?.trim() || null,
    region: f.region?.trim() || null,
    postal_code: f.postal_code?.trim() || null,
    country: f.country?.trim() || null,
    venue_type: f.venue_type,
    priority: f.priority,
    status: f.status,
    outreach_track: f.outreach_track ?? 'pipeline',
    follow_up_date: f.follow_up_date?.trim() ? f.follow_up_date.trim() : null,
    deal_terms: null,
    capacity: f.capacity?.trim() ? f.capacity.trim() : null,
  }
}

/** Contacts to insert after venue is created (name required). */
export function intakeContactsForVenue(
  bundle: VenueIntakeBundle,
): Array<{ name: string; role: string | null; email: string | null; phone: string | null; company: string | null }> {
  return bundle.contacts
    .filter(c => c.name.trim())
    .map(c => ({
      name: c.name.trim(),
      role: c.role.trim() || null,
      email: c.email.trim() || null,
      phone: c.phone.trim() || null,
      company: c.company.trim() || null,
    }))
}
