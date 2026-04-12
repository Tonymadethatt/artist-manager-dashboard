import type { Venue, VenueType } from '@/types'
import type { BookingIntakeShowDataV3, BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'

export function mapIntakeVenueDataV3ToVenueRow(
  data: BookingIntakeVenueDataV3,
  primaryShow?: BookingIntakeShowDataV3 | null,
): Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const ps = primaryShow ?? null
  const name = (
    ps?.venue_name_text.trim() ||
    data.known_venue_name.trim() ||
    data.contact_name.trim() ||
    'Untitled venue'
  ).trim()
  const city = (ps?.city_text.trim() || data.known_city.trim() || '').trim() || null
  const street = (ps?.street_address.trim() || '').trim() || null
  const line2 = (ps?.address_line2.trim() || '').trim() || null
  const postal = (ps?.postal_code.trim() || '').trim() || null
  const region = (ps?.state_region.trim() || '').trim() || null
  const capRaw = (ps?.exact_capacity_number.trim() || '').trim()
  const capacity = capRaw ? capRaw : null
  const venueType: VenueType = (ps?.venue_type || 'other') as VenueType
  const status =
    data.suggested_outreach_status === 'agreement_sent' || data.suggested_outreach_status === 'in_discussion'
      ? data.suggested_outreach_status
      : 'in_discussion'
  const followUp = data.follow_up_date.trim() || null
  return {
    name,
    location: street,
    city,
    address_line2: line2,
    region,
    postal_code: postal,
    country: null,
    venue_type: venueType,
    priority: data.priority,
    status,
    outreach_track: data.outreach_track ?? 'pipeline',
    follow_up_date: followUp,
    deal_terms: null,
    capacity,
  }
}

/** Contacts to insert after venue is created (Phase 0 primary contact). */
export function intakeContactsFromVenueDataV3(
  data: BookingIntakeVenueDataV3,
): Array<{ name: string; role: string | null; email: string | null; phone: string | null; company: string | null }> {
  const primary: Array<{
    name: string
    role: string | null
    email: string | null
    phone: string | null
    company: string | null
  }> = []
  const mainName = data.contact_name.trim()
  if (mainName) {
    primary.push({
      name: mainName,
      role: data.contact_role.trim() || null,
      email: data.contact_email.trim() || null,
      phone: data.contact_phone.trim() || null,
      company: data.contact_company.trim() || null,
    })
  }
  if (
    data.onsite_same_contact === 'different' &&
    (data.onsite_contact_name.trim() || data.onsite_contact_phone.trim())
  ) {
    primary.push({
      name: data.onsite_contact_name.trim() || 'On-site contact',
      role: data.onsite_contact_role.trim() || 'On-site',
      email: null,
      phone: data.onsite_contact_phone.trim() || null,
      company: data.contact_company.trim() || null,
    })
  }
  if (
    data.invoice_same_contact === 'different' &&
    (data.billing_contact_name.trim() ||
      data.billing_contact_email.trim() ||
      data.invoice_company_text.trim() ||
      data.invoice_email_text.trim())
  ) {
    const billEmail = data.billing_contact_email.trim() || data.invoice_email_text.trim()
    primary.push({
      name: (data.billing_contact_name.trim() || data.invoice_company_text.trim() || 'Billing').trim(),
      role: 'Billing',
      email: billEmail ? billEmail : null,
      phone: null,
      company: data.invoice_company_text.trim() || data.contact_company.trim() || null,
    })
  }
  return primary
}
