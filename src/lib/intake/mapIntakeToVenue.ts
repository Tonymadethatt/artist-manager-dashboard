import type { DealTerms, Venue, VenueType, Contact } from '@/types'
import {
  CONTACT_TITLE_LABELS,
  contactRoleForDisplay,
  type ContactTitleKey,
} from '@/lib/contacts/contactTitles'
import {
  VENUE_ARCHETYPE_LABELS,
  computeSetLengthHours,
  type BookingIntakeShowDataV3,
  type BookingIntakeVenueDataV3,
  type VenueArchetypeV3,
} from '@/lib/intake/intakePayloadV3'

export type IntakeDerivedContactRow = {
  name: string
  role: string | null
  title_key: string | null
  email: string | null
  phone: string | null
  company: string | null
}

/** Snapshot fields for agreement prefill (`venues.deal_terms`) from intake + primary show. */
export function intakeDealTermsFromIntakeV3(
  data: BookingIntakeVenueDataV3,
  primaryShow: BookingIntakeShowDataV3 | null,
): DealTerms | null {
  const ps = primaryShow
  const out: DealTerms = {}
  const ed = (ps?.event_date.trim() || data.known_event_date.trim()) || ''
  if (ed) out.event_date = ed
  if (ps?.set_start_time.trim() && ps.set_end_time.trim()) {
    const hrs = computeSetLengthHours(ps.set_start_time, ps.set_end_time, ps.overnight_set)
    if (hrs > 0) {
      if (hrs === 1) out.set_length = '1 hour'
      else if (Number.isInteger(hrs)) out.set_length = `${hrs} hours`
      else out.set_length = `${Math.round(hrs * 100) / 100} hours`
    }
  }
  if (ps?.load_in_time.trim()) out.load_in_time = ps.load_in_time.trim()
  const noteBits: string[] = []
  if (data.inquiry_summary.trim()) noteBits.push(`Inquiry: ${data.inquiry_summary.trim()}`)
  if (data.pre_call_notes.trim()) noteBits.push(`Pre-call: ${data.pre_call_notes.trim()}`)
  if (noteBits.length) out.notes = noteBits.join(' · ').slice(0, 2000)
  if (!out.event_date && !out.set_length && !out.load_in_time && !out.notes) return null
  return out
}

function contactRowMatchesVenuePrimary(
  data: BookingIntakeVenueDataV3,
  c: Pick<Contact, 'name' | 'email'>,
): boolean {
  return (
    !!data.contact_name.trim() &&
    c.name.trim() === data.contact_name.trim() &&
    (c.email ?? '').trim() === data.contact_email.trim()
  )
}

export function mapIntakeVenueDataV3ToVenueRow(
  data: BookingIntakeVenueDataV3,
  primaryShow?: BookingIntakeShowDataV3 | null,
): Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'> {
  const ps = primaryShow ?? null
  const archetypeHint =
    ps?.venue_archetype &&
    !ps.venue_name_text.trim() &&
    !data.known_venue_name.trim()
      ? VENUE_ARCHETYPE_LABELS[ps.venue_archetype as Exclude<VenueArchetypeV3, ''>]
      : ''
  const name = (
    ps?.venue_name_text.trim() ||
    data.known_venue_name.trim() ||
    archetypeHint ||
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
    deal_terms: intakeDealTermsFromIntakeV3(data, ps),
    capacity,
  }
}

/** Contacts to insert after venue is created (Phase 0 primary contact). */
export function intakeContactsFromVenueDataV3(
  data: BookingIntakeVenueDataV3,
  venueContacts?: Contact[] | null,
): IntakeDerivedContactRow[] {
  const primary: IntakeDerivedContactRow[] = []
  const mainName = data.contact_name.trim()
  if (mainName) {
    const cr = data.contact_role.trim()
    const isTitleKey = !!(cr && cr in CONTACT_TITLE_LABELS)
    primary.push({
      name: mainName,
      role: isTitleKey ? null : cr || null,
      title_key: isTitleKey ? cr : null,
      email: data.contact_email.trim() || null,
      phone: data.contact_phone.trim() || null,
      company: data.contact_company.trim() || null,
    })
  }
  if (
    data.onsite_same_contact === 'different' &&
    !data.onsite_linked_contact_id &&
    (data.onsite_contact_name.trim() || data.onsite_contact_phone.trim())
  ) {
    const otk = data.onsite_contact_title_key.trim()
    const isOtk = !!(otk && otk in CONTACT_TITLE_LABELS)
    const roleFree = data.onsite_contact_role.trim() || 'On-site'
    primary.push({
      name: data.onsite_contact_name.trim() || 'On-site contact',
      role: isOtk ? null : roleFree,
      title_key: isOtk ? (otk as ContactTitleKey) : null,
      email: null,
      phone: data.onsite_contact_phone.trim() || null,
      company: data.contact_company.trim() || null,
    })
  }
  if (data.invoice_same_contact === 'different' && data.billing_linked_contact_id) {
    const c = venueContacts?.find(x => x.id === data.billing_linked_contact_id)
    if (c && !contactRowMatchesVenuePrimary(data, c)) {
      primary.push({
        name: c.name,
        role: contactRoleForDisplay(c) || null,
        title_key: c.title_key?.trim() || null,
        email: c.email,
        phone: c.phone,
        company: c.company,
      })
    }
  }
  if (
    data.invoice_same_contact === 'different' &&
    !data.billing_linked_contact_id &&
    (data.billing_contact_name.trim() ||
      data.billing_contact_email.trim() ||
      data.invoice_company_text.trim() ||
      data.invoice_email_text.trim())
  ) {
    const billEmail = data.billing_contact_email.trim() || data.invoice_email_text.trim()
    primary.push({
      name: (data.billing_contact_name.trim() || data.invoice_company_text.trim() || 'Billing').trim(),
      role: CONTACT_TITLE_LABELS.client,
      title_key: 'client',
      email: billEmail ? billEmail : null,
      phone: null,
      company: data.invoice_company_text.trim() || data.contact_company.trim() || null,
    })
  }
  return primary
}
