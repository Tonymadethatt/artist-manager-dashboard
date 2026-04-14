import { supabase } from '@/lib/supabase'
import { PARTNERSHIP_ROLL_MOCK_SEED } from '@/lib/partnerships/partnershipRollMockSeed'

/** Inserts official seed rows when the owner has no entries yet (dashboard or public page). */
export async function seedPartnershipRollIfEmpty(ownerUserId: string): Promise<{ error: string | null }> {
  const { count, error: cErr } = await supabase
    .from('artist_partnership_roll_entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', ownerUserId)

  if (cErr) return { error: cErr.message }
  if ((count ?? 0) > 0) return { error: null }

  const rows = PARTNERSHIP_ROLL_MOCK_SEED.map((r, i) => ({
    user_id: ownerUserId,
    name: r.name,
    cohort: r.cohort,
    source: r.source,
    is_confirmed: r.is_confirmed,
    sort_order: r.sort_order ?? i,
  }))
  const { error: insErr } = await supabase.from('artist_partnership_roll_entries').insert(rows)
  return { error: insErr?.message ?? null }
}
