import type { ArtistProfile } from '@/types'

export function getArtistGigEmailBlockers(
  profile: Pick<ArtistProfile, 'artist_email'> | null | undefined,
): { canQueueArtistGigMail: boolean; reason?: 'missing_artist_email' } {
  const e = profile?.artist_email?.trim()
  if (!e) return { canQueueArtistGigMail: false, reason: 'missing_artist_email' }
  return { canQueueArtistGigMail: true }
}
