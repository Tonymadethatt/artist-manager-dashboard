/** Rules-only duplicate detection for calendar_sync_event vs deals and sync vs sync. */

export type CalendarSyncDedupRow = {
  id: string
  source_calendar_id: string
  source_event_id: string
  event_start_at: string | null
  event_end_at: string | null
  summary: string | null
  location: string | null
  matched_venue_id: string | null
}

export type CalendarDedupDealRow = {
  id: string
  venue_id: string | null
  description: string
  event_start_at: string | null
  event_end_at: string | null
}

export type DedupUpdate = {
  id: string
  display_status: 'visible' | 'hidden_duplicate' | 'needs_review'
  dedup_pair_deal_id: string | null
  dedup_rule: string | null
  dedup_score: number | null
}

const MS_TOLERANCE = 120_000

export function normalizeCalendarTitle(s: string | null | undefined): string {
  return (s ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .join(' ')
}

function bigramDice(a: string, b: string): number {
  const x = normalizeCalendarTitle(a)
  const y = normalizeCalendarTitle(b)
  if (!x.length || !y.length) return 0
  if (x === y) return 1
  const bg = (t: string) => {
    const out: string[] = []
    for (let i = 0; i < t.length - 1; i++) out.push(t.slice(i, i + 2))
    return out
  }
  const A = bg(x.padEnd(2, '_'))
  const B = bg(y.padEnd(2, '_'))
  const map = new Map<string, number>()
  for (const g of A) map.set(g, (map.get(g) ?? 0) + 1)
  let inter = 0
  for (const g of B) {
    const c = map.get(g) ?? 0
    if (c > 0) {
      inter++
      map.set(g, c - 1)
    }
  }
  return (2 * inter) / (A.length + B.length)
}

function intervalOverlapJaccard(
  a0: number,
  a1: number,
  b0: number,
  b1: number,
): number {
  const lo = Math.max(a0, b0)
  const hi = Math.min(a1, b1)
  const inter = Math.max(0, hi - lo)
  const union = Math.max(a1, b1) - Math.min(a0, b0)
  if (union <= 0) return 0
  return inter / union
}

function parseBounds(row: { event_start_at: string | null; event_end_at: string | null }): {
  start: number
  end: number
} | null {
  if (!row.event_start_at) return null
  const s = new Date(row.event_start_at).getTime()
  const e = row.event_end_at
    ? new Date(row.event_end_at).getTime()
    : s + 3600_000
  if (!Number.isFinite(s) || !Number.isFinite(e)) return null
  return { start: s, end: Math.max(s + 60_000, e) }
}

function timesNearEqual(
  a: { event_start_at: string | null; event_end_at: string | null },
  b: { event_start_at: string | null; event_end_at: string | null },
): boolean {
  const pa = parseBounds(a)
  const pb = parseBounds(b)
  if (!pa || !pb) return false
  return (
    Math.abs(pa.start - pb.start) <= MS_TOLERANCE &&
    Math.abs(pa.end - pb.end) <= MS_TOLERANCE
  )
}

function venueAligned(sync: CalendarSyncDedupRow, deal: CalendarDedupDealRow): boolean {
  if (sync.matched_venue_id && deal.venue_id) {
    return sync.matched_venue_id === deal.venue_id
  }
  return !sync.matched_venue_id && !deal.venue_id
}

function syncRichness(s: CalendarSyncDedupRow): number {
  return (s.summary?.length ?? 0) + (s.location?.length ?? 0)
}

/**
 * Compute DB updates for all sync rows.
 */
export function computeCalendarDedupUpdates(
  syncRows: CalendarSyncDedupRow[],
  deals: CalendarDedupDealRow[],
): DedupUpdate[] {
  const hiddenSync = new Map<string, { rule: string }>()
  const sortedSync = [...syncRows].sort((a, b) => {
    const ta = a.event_start_at ? new Date(a.event_start_at).getTime() : 0
    const tb = b.event_start_at ? new Date(b.event_start_at).getTime() : 0
    return ta - tb
  })

  for (let i = 0; i < sortedSync.length; i++) {
    for (let j = i + 1; j < sortedSync.length; j++) {
      const row = sortedSync[i]
      const other = sortedSync[j]
      if (hiddenSync.has(row.id) || hiddenSync.has(other.id)) continue
      if (other.source_calendar_id !== row.source_calendar_id) continue
      if (other.source_event_id === row.source_event_id) continue
      const near = timesNearEqual(row, other)
      const sameTitle =
        normalizeCalendarTitle(row.summary) === normalizeCalendarTitle(other.summary)
      if (near && sameTitle) {
        const drop = syncRichness(row) >= syncRichness(other) ? other : row
        hiddenSync.set(drop.id, { rule: 'strict_sync_duplicate_title_time' })
      }
    }
  }

  const out: DedupUpdate[] = []

  for (const row of syncRows) {
    if (hiddenSync.has(row.id)) {
      out.push({
        id: row.id,
        display_status: 'hidden_duplicate',
        dedup_pair_deal_id: null,
        dedup_rule: hiddenSync.get(row.id)!.rule,
        dedup_score: 1,
      })
      continue
    }

    let status: DedupUpdate['display_status'] = 'visible'
    let pairDeal: string | null = null
    let rule: string | null = null
    let score: number | null = null

    const titleNorm = normalizeCalendarTitle(row.summary)

    for (const d of deals) {
      if (!d.event_start_at || !d.event_end_at) continue
      const pa = parseBounds(row)
      const pb = parseBounds(d)
      if (!pa || !pb) continue
      const j = intervalOverlapJaccard(pa.start, pa.end, pb.start, pb.end)
      const dealTitle = normalizeCalendarTitle(d.description)
      const dice = bigramDice(row.summary ?? '', d.description ?? '')
      const near = timesNearEqual(row, d)
      const vAln = venueAligned(row, d)

      if (near && titleNorm === dealTitle && vAln) {
        status = 'hidden_duplicate'
        pairDeal = d.id
        rule = 'strict_deal_same_title_time_venue'
        score = 1
        break
      }

      if (j >= 0.5 && vAln && dice > 0.35 && dice < 0.9) {
        status = 'needs_review'
        pairDeal = d.id
        rule = 'overlap_gray_title'
        score = dice
        break
      }

      if (j >= 0.5 && !vAln && dice >= 0.5) {
        status = 'needs_review'
        pairDeal = d.id
        rule = 'overlap_venue_mismatch'
        score = dice
        break
      }
    }

    out.push({
      id: row.id,
      display_status: status,
      dedup_pair_deal_id: pairDeal,
      dedup_rule: rule,
      dedup_score: score,
    })
  }

  return out
}
