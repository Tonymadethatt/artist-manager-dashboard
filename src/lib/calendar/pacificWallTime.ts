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

/**
 * Map "YYYY-MM-DD" + "HH:mm" (24h) in LA to UTC ISO string, or null if not found.
 * Uses 15-minute UTC steps — minute values not reachable on that grid (e.g. 23:59) return null.
 * For "end of Pacific day `ymd`", use `pacificDayEndExclusiveUtcIso(ymd)` instead of 23:59.
 */
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

/**
 * Drop redundant ":00" before am/pm (en-US Intl output). "8:00 PM" → "8 PM"; "8:30 PM" unchanged.
 * Use for any user-facing 12-hour string from `Intl` or `toLocaleString` with `hour12` default true.
 */
export function stripOnTheHourMinutes12h(s: string): string {
  if (!s) return s
  return s.replace(/:00(?=\s*(?:AM|PM)\b)/gi, '')
}

/** e.g. "Wed, Apr 9, 2026, 2 PM PT" (on-the-hour drops :00) */
export function formatPacificInstantReadable(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  return `${stripOnTheHourMinutes12h(FRIENDLY_DATE_TIME.format(new Date(ms)))} PT`
}

/** Same calendar day in LA: "Wed, Apr 9, 2026 · 2 PM – 11:30 PM PT"; else full range. */
export function formatPacificTimeRangeReadable(startIso: string, endIso: string): string {
  const k0 = pacificDateKeyFromUtcIso(startIso)
  const k1 = pacificDateKeyFromUtcIso(endIso)
  if (!k0 || !k1) return formatPacificInstantReadable(startIso)
  if (k0 === k1) {
    const dayPart = FRIENDLY_DATE_ONLY.format(new Date(startIso))
    const tA = stripOnTheHourMinutes12h(FRIENDLY_TIME_ONLY.format(new Date(startIso)))
    const tB = stripOnTheHourMinutes12h(FRIENDLY_TIME_ONLY.format(new Date(endIso)))
    return `${dayPart} · ${tA} – ${tB} PT`
  }
  return `${formatPacificInstantReadable(startIso)} – ${formatPacificInstantReadable(endIso)}`
}

/** Calendar date in LA as a readable phrase, e.g. "Wednesday, April 9, 2026". */
export function formatPacificDateLongFromIso(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: LA,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(ms))
}

/** `YYYY-MM-DD` interpreted at noon LA → long calendar date string. */
export function formatPacificDateLongFromYmd(ymd: string): string {
  const trimmed = ymd.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  const iso = pacificWallToUtcIso(trimmed, '12:00')
  if (!iso) return trimmed
  return formatPacificDateLongFromIso(iso)
}

/** Time only, 12-hour in LA, e.g. "7:30 PM" (drops redundant :00 on the hour). */
export function formatPacificTime12h(iso: string): string {
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return ''
  return stripOnTheHourMinutes12h(FRIENDLY_TIME_ONLY.format(new Date(ms)))
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

/** Google Calendar API timed event (Pacific wall) from a UTC instant. */
export function googleTimedEventFromUtcIso(iso: string): { dateTime: string; timeZone: string } | null {
  const x = utcIsoToPacificDateAndTime(iso)
  if (!x) return null
  return { dateTime: `${x.date}T${x.time}:00`, timeZone: LA }
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

/**
 * UTC instant of the next Pacific midnight after `ymd` — use as an exclusive end when selecting
 * “everything on calendar day `ymd`” (`ts >= start(ymd) && ts < this`).
 */
export function pacificDayEndExclusiveUtcIso(ymd: string): string | null {
  const trimmed = ymd.trim()
  if (!trimmed) return null
  const nextYmd = addCalendarDaysPacific(trimmed, 1)
  return pacificWallToUtcIso(nextYmd, '00:00')
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

const COMPACT_DAY_SAME_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
})

const COMPACT_DAY_WITH_YEAR = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const COMPACT_TIME_12H = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  hour: 'numeric',
  minute: '2-digit',
})

function compactDayLabel(iso: string, includeYear: boolean): string {
  return includeYear
    ? COMPACT_DAY_WITH_YEAR.format(new Date(iso))
    : COMPACT_DAY_SAME_YEAR.format(new Date(iso))
}

/**
 * Dense email / table line: 12-hour times, short weekday + month + day (year only if spans calendar years).
 * Same day: "Mon, Jan 12 · 8 PM – 11:30 PM"
 */
export function formatPacificTimeRangeCompact(startIso: string, endIso: string): string {
  const ms0 = new Date(startIso).getTime()
  const ms1 = new Date(endIso).getTime()
  if (!Number.isFinite(ms0) || !Number.isFinite(ms1)) return ''
  const k0 = pacificDateKeyFromUtcIso(startIso)
  const k1 = pacificDateKeyFromUtcIso(endIso)
  if (!k0 || !k1) return ''

  const y0 = Number(k0.slice(0, 4))
  const y1 = Number(k1.slice(0, 4))
  const includeYear = y0 !== y1

  const t0 = stripOnTheHourMinutes12h(COMPACT_TIME_12H.format(new Date(ms0)))
  const t1 = stripOnTheHourMinutes12h(COMPACT_TIME_12H.format(new Date(ms1)))

  if (k0 === k1) {
    const day = compactDayLabel(startIso, false)
    return `${day} · ${t0} – ${t1}`
  }

  const day0 = compactDayLabel(startIso, includeYear)
  const day1 = compactDayLabel(endIso, includeYear)
  return `${day0}, ${t0} – ${day1}, ${t1}`
}

/** Date-only fallback when instants missing (raw YYYY-MM-DD). */
function compactDateFromYmd(ymd: string): string {
  const iso = pacificWallToUtcIso(ymd.trim(), '12:00')
  if (!iso) return ymd.trim()
  return COMPACT_DAY_SAME_YEAR.format(new Date(iso))
}

/** Event window + optional performance/set instants (Pacific-interprets ISO fields). */
export type DealWhenAndPerformanceInput = {
  event_start_at?: string | null
  event_end_at?: string | null
  event_date?: string | null
  performance_start_at?: string | null
  performance_end_at?: string | null
}

/**
 * Short show window for digest / day-summary tables (12h, minimal date noise).
 */
export function whenLineCompactFromDeal(d: DealWhenAndPerformanceInput): string {
  if (d.event_start_at && d.event_end_at) {
    return formatPacificTimeRangeCompact(d.event_start_at, d.event_end_at)
  }
  const ed = d.event_date?.trim()
  return ed ? compactDateFromYmd(ed) : ''
}

/** Human-readable show window for emails and calendar detail (Pacific). */
export function whenLineFriendlyFromDeal(d: DealWhenAndPerformanceInput): string {
  if (d.event_start_at && d.event_end_at) {
    return formatPacificTimeRangeReadable(d.event_start_at, d.event_end_at)
  }
  const ed = d.event_date?.trim()
  if (!ed) return ''
  return /^\d{4}-\d{2}-\d{2}$/.test(ed) ? formatPacificDateLongFromYmd(ed) : ed
}

const WEEKDAY_SHORT_STACK = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  weekday: 'short',
})

const MD_STACK = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  month: 'short',
  day: 'numeric',
})

const MDY_STACK = new Intl.DateTimeFormat('en-US', {
  timeZone: LA,
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

/** Stacked email “when” cell: weekday, calendar date, event time range (or all day), optional DJ/set window. */
export type ScheduleWhenStack = {
  dayLine: string
  dateLine: string
  timeLine: string
  /** When present, rendered under the event window with a “Your set” label (Pacific). */
  setTimeLine?: string | null
}

/**
 * Compact Pacific line for the artist’s performance/set window (separate from venue event hours).
 * Both instants: same style as event window (`formatPacificTimeRangeCompact`).
 * Start only: time + PT (no redundant date if caller shows event date above).
 */
export function performanceWindowCompactFromDeal(d: DealWhenAndPerformanceInput): string | null {
  const ps = d.performance_start_at?.trim()
  const pe = d.performance_end_at?.trim()
  if (ps && pe) {
    const line = formatPacificTimeRangeCompact(ps, pe)
    return line || null
  }
  if (ps) {
    const t = formatPacificTime12h(ps)
    return t ? `${t} PT` : null
  }
  return null
}

/** Same as {@link performanceWindowCompactFromDeal} but long date + 12h range (artist-facing copy). */
export function performanceWindowReadableFromDeal(d: DealWhenAndPerformanceInput): string | null {
  const ps = d.performance_start_at?.trim()
  const pe = d.performance_end_at?.trim()
  if (ps && pe) {
    const line = formatPacificTimeRangeReadable(ps, pe)
    return line || null
  }
  if (ps) {
    const t = formatPacificTime12h(ps)
    return t ? `${t} PT` : null
  }
  return null
}

/** Pacific wall date (YYYY-MM-DD) → three display lines for table cells. */
export function scheduleWhenStackFromYmd(ymd: string): ScheduleWhenStack | null {
  const trimmed = (ymd ?? '').trim()
  if (!trimmed) return null
  const iso = pacificWallToUtcIso(trimmed, '12:00')
  if (!iso) return null
  const ms = new Date(iso).getTime()
  if (!Number.isFinite(ms)) return null
  const k0 = pacificDateKeyFromUtcIso(iso)
  if (!k0) return null
  const yNow = pacificTodayYmd().slice(0, 4)
  const yEv = k0.slice(0, 4)
  return {
    dayLine: WEEKDAY_SHORT_STACK.format(new Date(ms)),
    dateLine: yEv === yNow ? MD_STACK.format(new Date(ms)) : MDY_STACK.format(new Date(ms)),
    timeLine: 'All day',
  }
}

/** Deal instants or event_date → stack for gig digest / day-summary tables. */
export function scheduleWhenStackFromDeal(d: DealWhenAndPerformanceInput): ScheduleWhenStack | null {
  const setTimeLine = performanceWindowReadableFromDeal(d)
  const withSet = (base: ScheduleWhenStack): ScheduleWhenStack =>
    setTimeLine ? { ...base, setTimeLine } : base

  if (d.event_start_at && d.event_end_at) {
    const ms0 = new Date(d.event_start_at).getTime()
    const ms1 = new Date(d.event_end_at).getTime()
    if (!Number.isFinite(ms0) || !Number.isFinite(ms1)) {
      const ed = d.event_date?.trim()
      const ymdStack = ed ? scheduleWhenStackFromYmd(ed) : null
      return ymdStack ? withSet(ymdStack) : null
    }
    const k0 = pacificDateKeyFromUtcIso(d.event_start_at)
    const k1 = pacificDateKeyFromUtcIso(d.event_end_at)
    if (!k0 || !k1) {
      const ed = d.event_date?.trim()
      const ymdStack = ed ? scheduleWhenStackFromYmd(ed) : null
      return ymdStack ? withSet(ymdStack) : null
    }
    const yNow = pacificTodayYmd().slice(0, 4)
    const t0 = stripOnTheHourMinutes12h(COMPACT_TIME_12H.format(new Date(ms0)))
    const t1 = stripOnTheHourMinutes12h(COMPACT_TIME_12H.format(new Date(ms1)))
    if (k0 === k1) {
      const yEv = k0.slice(0, 4)
      return withSet({
        dayLine: WEEKDAY_SHORT_STACK.format(new Date(ms0)),
        dateLine: yEv === yNow ? MD_STACK.format(new Date(ms0)) : MDY_STACK.format(new Date(ms0)),
        timeLine: `${t0} – ${t1}`,
      })
    }
    const dayLine =
      `${WEEKDAY_SHORT_STACK.format(new Date(ms0))} – ${WEEKDAY_SHORT_STACK.format(new Date(ms1))}`
    const y0 = k0.slice(0, 4)
    const y1 = k1.slice(0, 4)
    const dateLine =
      y0 === y1
        ? `${MD_STACK.format(new Date(ms0))} – ${MD_STACK.format(new Date(ms1))}, ${y0}`
        : `${MDY_STACK.format(new Date(ms0))} – ${MDY_STACK.format(new Date(ms1))}`
    const timeLine = `${t0} – ${t1}`
    return withSet({ dayLine, dateLine, timeLine })
  }
  const ed = d.event_date?.trim()
  const ymdOnly = ed ? scheduleWhenStackFromYmd(ed) : null
  return ymdOnly ? withSet(ymdOnly) : null
}
