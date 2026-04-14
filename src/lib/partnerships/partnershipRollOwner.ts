import { supabase } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Optional build-time override (e.g. local dev). The public previous-clients page does **not** rely on this:
 * it reads `partnership_roll_public_owner.artist_user_id` instead so Netlify does not need this env var.
 */
export function getPartnershipRollOwnerId(): string | null {
  const raw = import.meta.env.VITE_PARTNERSHIP_ROLL_OWNER_ID as string | undefined
  const id = raw?.trim()
  if (!id || !UUID_RE.test(id)) return null
  return id
}

/** Source of truth for which auth user owns the shared roll (row id = 1). Readable by anon per RLS. */
export async function fetchPartnershipRollArtistUserId(): Promise<{
  userId: string | null
  fetchError: string | null
}> {
  const { data, error } = await supabase
    .from('partnership_roll_public_owner')
    .select('artist_user_id')
    .eq('id', 1)
    .maybeSingle()

  if (error) return { userId: null, fetchError: error.message }
  const id = data?.artist_user_id
  if (id == null || typeof id !== 'string' || !UUID_RE.test(id)) {
    return { userId: null, fetchError: null }
  }
  return { userId: id, fetchError: null }
}
