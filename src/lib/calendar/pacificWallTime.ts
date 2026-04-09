/** Interpret wall-clock times in America/Los_Angeles (DST-aware) without extra deps. */

const LA = 'America/Los_Angeles'

const LA_DATE_TIME = new Intl.DateTimeFormat('en-CA', {
  timeZone: LA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

/** Map "YYYY-MM-DD" + "HH:mm" (24h) in LA to UTC ISO string, or null if not found. */
export function pacificWallToUtcIso(ymd: string, hm: string): string | null {
  const [y, mo, d] = ymd.split('-').map(Number)
  const [h, mi] = hm.split(':').map(Number)
  if (![y, mo, d, h, mi].every(n => Number.isFinite(n))) return null
  let t = Date.UTC(y, mo - 1, d, 7, 0, 0)
  for (let k = 0; k < 400; k++) {
    const parts = Object.fromEntries(
      LA_DATE_TIME.formatToParts(new Date(t)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
    ) as Record<string, string>
    const py = Number(parts.year)
    const pm = Number(parts.month)
    const pd = Number(parts.day)
    const ph = Number(parts.hour)
    const pmin = Number(parts.minute)
    if (py === y && pm === mo && pd === d && ph === h && pmin === mi) {
      return new Date(t).toISOString()
    }
    t += 15 * 60 * 1000
  }
  return null
}

const FRIENDLY_DATE_TIME = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
})

const FRIENDLY_DATE_ONLY = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const FRIENDLY_TIME_ONLY = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  hour: 'numeric',
  minute: '2-digit',
})

/** e.g. "Wed, Apr 9, 2026, 2:00 PM PT" */
export function formatPacificInstantReadable(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  return `${FRIENDLY_DATE_TIME.format(new Date(ms))} PT`
}

/** Same calendar day in LA: "Wed, Apr 9, 2026 · 2:00 PM – 11:00 PM PT"; else full range. */
export function formatPacificTimeRangeReadable(startIso: string, endIso: string): string {
  const k0 = pacificDateKeyFromUtcIso(startIso)
  const k1 = pacificDateKeyFromUtcIso(endIso)
  if (!k0 || !k1) return formatPacificInstantReadable(startIso)
  if (k0 === k1) {
    const dayPart = FRIENDLY_DATE_ONLY.format(new Date(startIso))
    const tA = FRIENDLY_TIME_ONLY.format(new Date(startIso))
    const tB = FRIENDLY_TIME_ONLY.format(new Date(endIso))
    return `${dayPart} · ${tA} – ${tB} PT`
  }
  return `${formatPacificInstantReadable(startIso)} – ${formatPacificInstantReadable(endIso)}`
}

/** UTC ISO → { date: YYYY-MM-DD, time: HH:mm } in LA. */
export function utcIsoToPacificDateAndTime(iso: string): { date: string; time: string } | null {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  const parts = Object.fromEntries(
    LA_DATE_TIME.formatToParts(new Date(ms)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
  ) as Record<string, string>
  const y = parts.year
  const mo = parts.month
  const d = parts.day
  const h = parts.hour.padStart(2, '0')
  const mi = parts.minute.padStart(2, '0')
  return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` }
}

/** Calendar day key (YYYY-MM-DD) in LA for an instant. */
export function pacificDateKeyFromUtcIso(iso: string): string | null {
  const x = utcIsoToPacificDateAndTime(iso)
  return x?.date ?? null
}

/** Add calendar days in LA: start from YYYY-MM-DD at noon UTC anchor, step days, return YYYY-MM-DD in LA (approx). */
export function addCalendarDaysPacific(ymd: string, deltaDays: number): string {
  const [y, mo, d] = ymd.split('-').map(Number)
  const base = Date.UTC(y, mo - 1, d, 12, 0, 0) + deltaDays * 86400000
  const parts = Object.fromEntries(
    LA_DATE_TIME.formatToParts(new Date(base)).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
  ) as Record<string, string>
  return `${parts.year}-${parts.month}-${parts.day}`
}

/** Today YYYY-MM-DD in LA. */
export function pacificTodayYmd(): string {
  return pacificDateKeyFromUtcIso(new Date().toISOString()) ?? new Date().toISOString().slice(0, 10)
}

const SHORT_WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

/** 0 = Sunday … 6 = Saturday for this calendar date in LA. */
export function weekdaySunday0PacificYmd(ymd: string): number {
  const iso = pacificWallToUtcIso(ymd, '12:00')
  if (!iso) return 0
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: LA, weekday: 'short' })
  const s = fmt.format(new Date(iso))
  const idx = SHORT_WD.indexOf(s as (typeof SHORT_WD)[number])
  return idx < 0 ? 0 : idx
}

/** Human-readable show window for emails and calendar detail (Pacific). */
export function whenLineFriendlyFromDeal(d: {
  event_start_at?: string | null
  event_end_at?: string | null
  event_date?: string | null
}): string {
  if (d.event_start_at && d.event_end_at) {
    return formatPacificTimeRangeReadable(d.event_start_at, d.event_end_at)
  }
  const ed = d.event_date?.trim()
  return ed ?? ''
}
