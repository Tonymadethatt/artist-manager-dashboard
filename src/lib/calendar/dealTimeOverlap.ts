import type { Deal } from '@/types'

type Interval = { start: number; end: number }

function intervalFromDeal(d: Pick<Deal, 'id' | 'event_start_at' | 'event_end_at'>): Interval | null {
  if (!d.event_start_at || !d.event_end_at) return null
  const start = new Date(d.event_start_at).getTime()
  const end = new Date(d.event_end_at).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return { start, end }
}

/** Returns other deal ids that overlap this deal’s interval (strict overlap, not merely touching). */
export function overlappingDealIds(
  self: Pick<Deal, 'id' | 'event_start_at' | 'event_end_at'>,
  others: Pick<Deal, 'id' | 'event_start_at' | 'event_end_at'>[],
): string[] {
  const a = intervalFromDeal(self)
  if (!a) return []
  const out: string[] = []
  for (const o of others) {
    if (o.id === self.id) continue
    const b = intervalFromDeal(o)
    if (!b) continue
    if (a.start < b.end && b.start < a.end) out.push(o.id)
  }
  return out
}
