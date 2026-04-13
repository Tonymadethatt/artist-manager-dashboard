/** Default event length when picking start only (wall clock, wraps past midnight). */
export const INTAKE_DEFAULT_EVENT_DURATION_HOURS = 5

/**
 * Add hours to a wall-clock `HH:mm` (24h). Result stays on the 15-minute grid when start is quarter-aligned
 * and `hours` is a whole number.
 */
export function addHoursToQuarterHm(startHHmm: string, hours: number): string {
  const t = startHHmm.trim()
  if (!t) return ''
  const [hs, ms] = t.split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return ''
  let total = h * 60 + m + Math.round(hours * 60)
  total = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** 24h `HH:mm` strings in 15-minute steps (intake event/set time grids). */
export const INTAKE_QUARTER_HOUR_TIMES: string[] = (() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 15, 30, 45]) {
      out.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return out
})()

/** Wall-clock top-of-hour times only (DJ set length / billing uses whole hours). */
export const INTAKE_HOUR_ONLY_TIMES: string[] = (() => {
  const out: string[] = []
  for (let h = 0; h < 24; h++) {
    out.push(`${String(h).padStart(2, '0')}:00`)
  }
  return out
})()
