import {
  addCalendarDaysPacific,
  pacificDateKeyFromUtcIso,
  pacificWallToUtcIso,
} from './pacificWallTime'

/**
 * Wall time (HH:mm, 24h) in America/Los_Angeles on the **calendar day before** the show
 * when the reminder becomes eligible to send. Not tied to show clock time — avoids late-night sends.
 */
export const GIG_REMINDER_DAY_BEFORE_WALL_TIME_PT = '10:00'

/**
 * UTC instant: previous Pacific calendar day relative to show start, at {@link GIG_REMINDER_DAY_BEFORE_WALL_TIME_PT}.
 * Stored on `venue_emails.scheduled_send_at`; queue treats `scheduled_send_at <= now` as eligible.
 */
export function gigReminderScheduledSendAtIso(showStartIso: string): string | null {
  const showYmd = pacificDateKeyFromUtcIso(showStartIso)
  if (!showYmd) return null
  const dayBeforeYmd = addCalendarDaysPacific(showYmd, -1)
  return pacificWallToUtcIso(dayBeforeYmd, GIG_REMINDER_DAY_BEFORE_WALL_TIME_PT)
}

/**
 * Same instant as {@link gigReminderScheduledSendAtIso} as epoch ms (for comparisons).
 */
export function gigReminderSendAtMs(showStartIso: string): number | null {
  const iso = gigReminderScheduledSendAtIso(showStartIso)
  if (!iso) return null
  const ms = new Date(iso).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * Cron / send boundary: eligible once we're at or past the scheduled day-before send (minus slack),
 * and the show has not started yet.
 */
export function shouldSendGigReminderNow(nowMs: number, showStartIso: string, slackMs = 90_000): boolean {
  const startMs = new Date(showStartIso).getTime()
  if (!Number.isFinite(startMs)) return false
  if (nowMs >= startMs) return false
  const sendAfterMs = gigReminderSendAtMs(showStartIso)
  if (sendAfterMs == null) return false
  return nowMs >= sendAfterMs - slackMs
}

/**
 * PostgREST `deal:deals(...)` on `venue_emails` is usually an object; normalize edge shapes.
 */
export function eventStartAtFromQueueDealEmbed(dealEmbed: unknown): string | null {
  if (dealEmbed == null) return null
  if (Array.isArray(dealEmbed)) {
    const first = dealEmbed[0] as { event_start_at?: string | null } | undefined
    const s = first?.event_start_at
    return typeof s === 'string' && s.trim() ? s.trim() : null
  }
  if (typeof dealEmbed === 'object' && dealEmbed !== null && 'event_start_at' in dealEmbed) {
    const s = (dealEmbed as { event_start_at?: string | null }).event_start_at
    return typeof s === 'string' && s.trim() ? s.trim() : null
  }
  return null
}
