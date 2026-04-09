/** One calendar day before show start instant (UTC ms since epoch). */
const MS_BEFORE_SHOW = 24 * 60 * 60 * 1000

/**
 * Millisecond timestamp when the 24h-before-show reminder should first be eligible to send.
 * Returns null if `showStartIso` is not a finite instant.
 */
export function gigReminderSendAtMs(showStartIso: string): number | null {
  const startMs = new Date(showStartIso).getTime()
  if (!Number.isFinite(startMs)) return null
  return startMs - MS_BEFORE_SHOW
}

/**
 * ISO string stored on `venue_emails.scheduled_send_at` (authoritative target; cron still
 * re-checks `deals.event_start_at` when sending).
 */
export function gigReminderScheduledSendAtIso(showStartIso: string): string | null {
  const ms = gigReminderSendAtMs(showStartIso)
  return ms == null ? null : new Date(ms).toISOString()
}

/**
 * Cron / processor: true when local `nowMs` is at or past the 24h-before-show moment (minus slack).
 * Slack absorbs 1-minute cron granularity and clock skew.
 */
export function shouldSendGigReminderNow(nowMs: number, showStartIso: string, slackMs = 90_000): boolean {
  const startMs = new Date(showStartIso).getTime()
  if (!Number.isFinite(startMs)) return false
  if (nowMs >= startMs) return false
  const sendAfter = startMs - MS_BEFORE_SHOW
  return nowMs >= sendAfter - slackMs
}
