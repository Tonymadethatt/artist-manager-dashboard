/** Response body from POST `google-calendar-sync` (import summary + optional deal push). */
export type GoogleCalendarSyncResponseBody = {
  imported?: number
  copied?: number
  refreshed?: number
  skipped?: number
  tasksCreated?: number
  dealPushAttempted?: number
  dealPushInserted?: number
  dealPushPatched?: number
  dealPushPatchedAfterRace?: number
  dealPushNoop?: number
  dealPushDeleted?: number
  dealPushRaceAbandoned?: number
  dealPushErrors?: number
  dealPushErrorSample?: string | null
  dealPushTruncated?: boolean
}

/** Settings card copy (mentions “from Google” / follow-up tasks). */
export function googleCalendarSyncSuccessMessageSettings(j: GoogleCalendarSyncResponseBody): string {
  const added = j.imported ?? j.copied ?? 0
  const refreshed = j.refreshed ?? 0
  let msg =
    refreshed > 0
      ? `Synced: ${added} added, ${refreshed} updated from Google, ${j.skipped ?? 0} skipped, ${j.tasksCreated ?? 0} follow-up tasks.`
      : `Synced: ${added} added to dashboard, ${j.skipped ?? 0} skipped, ${j.tasksCreated ?? 0} follow-up tasks.`
  msg += dealPushSuffix(j)
  return msg
}

/** Gig calendar toolbar copy (shorter “tasks” wording). */
export function googleCalendarSyncSuccessMessageGigPage(j: GoogleCalendarSyncResponseBody): string {
  const added = j.imported ?? j.copied ?? 0
  const refreshed = j.refreshed ?? 0
  let msg =
    refreshed > 0
      ? `Synced: ${added} added, ${refreshed} updated, ${j.skipped ?? 0} skipped, ${j.tasksCreated ?? 0} tasks.`
      : `Synced: ${added} added, ${j.skipped ?? 0} skipped, ${j.tasksCreated ?? 0} tasks.`
  msg += dealPushSuffix(j)
  return msg
}

function dealPushSuffix(j: GoogleCalendarSyncResponseBody): string {
  const attempted = j.dealPushAttempted ?? 0
  if (attempted <= 0) return ''

  const saved =
    (j.dealPushInserted ?? 0) +
    (j.dealPushPatched ?? 0) +
    (j.dealPushPatchedAfterRace ?? 0)
  let s = ` ${saved} gig(s) written to Google Calendar.`
  if (j.dealPushTruncated) s += ' Run sync again to push more (batch limit).'

  const errN = j.dealPushErrors ?? 0
  if (errN > 0) {
    const sample = (j.dealPushErrorSample ?? '').trim().slice(0, 140)
    s += ` ${errN} push error(s)${sample ? `: ${sample}` : ''}. Check Settings for Google status.`
  }
  return s
}
