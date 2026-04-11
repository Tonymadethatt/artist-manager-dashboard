/**
 * Lightweight venue matching for Google Calendar sync (summary + location vs CRM venues).
 */

export type VenueMatchRow = {
  id: string
  name: string
  location: string | null
  city: string | null
  /** Full postal line (structured fields); helps match Google Calendar `location`. */
  postal_line: string | null
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokens(s: string): Set<string> {
  const t = norm(s).split(' ').filter(w => w.length > 1)
  return new Set(t)
}

/** Jaccard similarity on word tokens. */
function tokenSimilarity(a: string, b: string): number {
  const A = tokens(a)
  const B = tokens(b)
  if (A.size === 0 && B.size === 0) return 0
  let inter = 0
  for (const x of A) {
    if (B.has(x)) inter++
  }
  const union = A.size + B.size - inter
  return union === 0 ? 0 : inter / union
}

/** Best venue match for a calendar event; returns null if below threshold. */
export function matchVenueForCalendarEvent(
  summary: string,
  location: string | null | undefined,
  venues: VenueMatchRow[],
  opts?: { minScore?: number },
): { venueId: string; score: number } | null {
  const minScore = opts?.minScore ?? 0.34
  const hay = [summary, location ?? ''].filter(Boolean).join(' ')
  const hayNorm = norm(hay)
  if (!hayNorm) return null

  let best: { venueId: string; score: number } | null = null

  for (const v of venues) {
    const parts = [v.name, v.city ?? '', v.location ?? '', v.postal_line ?? ''].filter(Boolean)
    let score = 0
    for (const p of parts) {
      const n = norm(p)
      if (!n) continue
      if (hayNorm.includes(n) || n.includes(hayNorm)) {
        score = Math.max(score, 0.85)
        continue
      }
      const sim = tokenSimilarity(hay, p)
      score = Math.max(score, sim)
    }
    if (best === null || score > best.score) {
      best = { venueId: v.id, score }
    }
  }

  if (!best || best.score < minScore) return null
  return best
}
