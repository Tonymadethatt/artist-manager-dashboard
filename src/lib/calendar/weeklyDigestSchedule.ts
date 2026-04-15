import {
  addCalendarDaysPacific,
  pacificDateKeyFromUtcIso,
  pacificWallToUtcIso,
  weekdaySunday0PacificYmd,
} from './pacificWallTime'

export const WEEKLY_DIGEST_HOUR_PT = 5

/**
 * Next weekly gig digest send: Sunday 05:00 America/Los_Angeles strictly after `nowMs`.
 * `weekStart` is the Pacific calendar date of that Sunday (matches `notes.weekStart` in queue rows).
 */
export function nextWeeklyDigestSendAfterNow(nowMs: number): { weekStart: string; scheduledSendAtIso: string } | null {
  const todayYmd = pacificDateKeyFromUtcIso(new Date(nowMs).toISOString())
  if (!todayYmd) return null

  let candidateYmd = todayYmd
  const wd = weekdaySunday0PacificYmd(todayYmd)
  if (wd !== 0) {
    candidateYmd = addCalendarDaysPacific(todayYmd, 7 - wd)
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const iso = pacificWallToUtcIso(candidateYmd, '05:00')
    if (!iso) return null
    if (new Date(iso).getTime() > nowMs) {
      return { weekStart: candidateYmd, scheduledSendAtIso: iso }
    }
    candidateYmd = addCalendarDaysPacific(candidateYmd, 7)
  }
  return null
}

/** True when America/Los_Angeles is Sunday and local hour is `WEEKLY_DIGEST_HOUR_PT` (enqueue gap-fill window). */
export function isPacificSundayDigestHour(now: Date): boolean {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'short',
    hour: 'numeric',
    hour12: false,
  })
  const parts = Object.fromEntries(
    dtf.formatToParts(now).filter(p => p.type !== 'literal').map(p => [p.type, p.value]),
  ) as Record<string, string>
  const hour = parseInt(parts.hour, 10)
  const wday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday)
  return wday === 0 && hour === WEEKLY_DIGEST_HOUR_PT
}
