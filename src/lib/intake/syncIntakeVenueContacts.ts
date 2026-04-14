import { supabase } from '@/lib/supabase'
import type { Contact } from '@/types'
import type { BookingIntakeVenueDataV3 } from '@/lib/intake/intakePayloadV3'
import type { IntakeDerivedContactRow } from '@/lib/intake/mapIntakeToVenue'

/** Last 10 digits for US-style matching when possible. */
export function normalizePhoneDigits(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const d = raw.replace(/\D/g, '')
  if (d.length >= 10) return d.slice(-10)
  return d
}

function findMatchingContact(existing: Contact[], row: IntakeDerivedContactRow): Contact | null {
  const email = row.email?.trim().toLowerCase()
  const phone = normalizePhoneDigits(row.phone)
  if (email) {
    const m = existing.find(c => (c.email ?? '').trim().toLowerCase() === email)
    if (m) return m
  }
  if (phone.length >= 10) {
    const m = existing.find(c => normalizePhoneDigits(c.phone) === phone)
    if (m) return m
  }
  return null
}

function buildContactUpdate(
  existing: Contact,
  row: IntakeDerivedContactRow,
): Record<string, string | null> | null {
  const patch: Record<string, string | null> = {}
  const rName = row.name.trim()
  if (rName && rName !== existing.name.trim()) patch.name = rName

  if (row.title_key?.trim()) {
    const tk = row.title_key.trim()
    if (tk !== (existing.title_key ?? '').trim()) patch.title_key = tk
    if (existing.role != null) patch.role = null
  } else if (row.role?.trim()) {
    const rl = row.role.trim()
    if (rl !== (existing.role ?? '').trim()) patch.role = rl
    if (existing.title_key != null) patch.title_key = null
  }

  const rEmail = row.email?.trim() ? row.email.trim() : null
  const eEmail = (existing.email ?? '').trim() ? (existing.email ?? '').trim() : null
  if (rEmail !== eEmail) patch.email = rEmail

  const rPhone = row.phone?.trim() ? row.phone.trim() : null
  const ePhone = (existing.phone ?? '').trim() ? (existing.phone ?? '').trim() : null
  if (rPhone !== ePhone) patch.phone = rPhone

  const rCo = row.company?.trim() ? row.company.trim() : null
  const eCo = (existing.company ?? '').trim() ? (existing.company ?? '').trim() : null
  if (rCo !== eCo) patch.company = rCo

  return Object.keys(patch).length ? patch : null
}

/**
 * Insert or update venue contacts from intake-derived rows (match by email, else phone).
 * Refetches contacts for the venue on success.
 */
export async function upsertIntakeVenueContactsForVenue(options: {
  venueId: string
  userId: string
  derived: IntakeDerivedContactRow[]
  existingContacts: Contact[]
}): Promise<{ ok: true; contacts: Contact[] } | { ok: false; error: string }> {
  const { venueId, userId, derived, existingContacts } = options
  let working = [...existingContacts]

  for (const row of derived) {
    if (!row.name.trim() && !row.email?.trim() && !row.phone?.trim()) continue

    const match = findMatchingContact(working, row)
    if (match) {
      const patch = buildContactUpdate(match, row)
      if (patch) {
        const { error } = await supabase.from('contacts').update(patch).eq('id', match.id)
        if (error) return { ok: false, error: error.message }
        working = working.map(c => (c.id === match.id ? { ...c, ...patch } : c))
      }
      continue
    }

    const insertRow = {
      user_id: userId,
      venue_id: venueId,
      name: row.name.trim() || 'Contact',
      title_key: row.title_key?.trim() || null,
      role: row.title_key?.trim() ? null : row.role?.trim() || null,
      email: row.email?.trim() || null,
      phone: row.phone?.trim() || null,
      company: row.company?.trim() || null,
    }
    const { data: inserted, error: insErr } = await supabase.from('contacts').insert(insertRow).select('*').single()
    if (insErr) return { ok: false, error: insErr.message }
    working.push(inserted as Contact)
  }

  const { data: fresh, error: fetchErr } = await supabase.from('contacts').select('*').eq('venue_id', venueId)
  if (fetchErr) return { ok: false, error: fetchErr.message }
  return { ok: true, contacts: (fresh ?? []) as Contact[] }
}

/** Pick `contacts.id` for deal.onsite_contact_id after intake import / contact sync. */
export function resolveIntakeOnsiteContactId(
  data: BookingIntakeVenueDataV3,
  contacts: Contact[],
): string | null {
  if (data.onsite_same_contact !== 'different') return null
  const linked = data.onsite_linked_contact_id?.trim()
  if (linked && contacts.some(c => c.id === linked)) return linked
  const name = data.onsite_contact_name.trim().toLowerCase()
  const phone = normalizePhoneDigits(data.onsite_contact_phone)
  if (phone.length >= 10) {
    const byPhone = contacts.find(c => normalizePhoneDigits(c.phone) === phone)
    if (byPhone) return byPhone.id
  }
  if (name) {
    const byName = contacts.find(c => c.name.trim().toLowerCase() === name)
    if (byName && (!phone.length || normalizePhoneDigits(byName.phone) === phone)) return byName.id
  }
  return null
}
