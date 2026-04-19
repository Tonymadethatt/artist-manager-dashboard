import type { SupabaseClient } from '@supabase/supabase-js'
import type { Contact, Deal } from '../../types'

/**
 * Loads the deal’s on-site contact when it exists and belongs to the same venue as the deal.
 */
export async function loadOnsiteContactForGigBooked(
  supabase: SupabaseClient,
  userId: string,
  deal: Pick<Deal, 'venue_id' | 'onsite_contact_id'>,
): Promise<Pick<Contact, 'name' | 'phone' | 'title_key' | 'role'> | null> {
  const cid = deal.onsite_contact_id?.trim()
  const vid = deal.venue_id
  if (!cid || !vid) return null

  const { data, error } = await supabase
    .from('contacts')
    .select('name, phone, title_key, role, venue_id')
    .eq('id', cid)
    .eq('user_id', userId)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    name?: string | null
    phone?: string | null
    title_key?: string | null
    role?: string | null
    venue_id?: string | null
  }

  if (row.venue_id !== vid) return null

  return {
    name: row.name ?? '',
    phone: row.phone ?? null,
    title_key: row.title_key ?? null,
    role: row.role ?? null,
  }
}
