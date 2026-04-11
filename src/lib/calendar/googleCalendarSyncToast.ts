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
  dealPushOAuthConfigured?: boolean
  dealPushScan?: {
    dealsLoaded: number
    queryError: string | null
    qualifiedByEmbed: number
    qualifiedByLookup: number
    mismatchEmbFailLookupOk: number
    pushQueueSource: string
  }
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
  let s = ''
  if (j.dealPushOAuthConfigured === false) {
    s +=
      ' Google gig push skipped: server OAuth (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET) not configured for functions.'
  }

  const scan = j.dealPushScan
  if (scan?.queryError) {
    s += ` Deal scan error: ${scan.queryError.slice(0, 120)}.`
  }

  const attempted = j.dealPushAttempted ?? 0
  if (attempted <= 0) {
    if (
      scan &&
      scan.dealsLoaded > 0 &&
      scan.qualifiedByLookup === 0 &&
      j.dealPushOAuthConfigured !== false
    ) {
      s +=
        ' No gigs matched calendar rules (booked-stage venue + start + end + not cancelled).'
    }
    return s
  }

  const saved =
    (j.dealPushInserted ?? 0) +
    (j.dealPushPatched ?? 0) +
    (j.dealPushPatchedAfterRace ?? 0)
  s += ` ${saved} gig(s) written to Google Calendar.`
  if (j.dealPushTruncated) s += ' Run sync again to push more (batch limit).'

  const errN = j.dealPushErrors ?? 0
  if (errN > 0) {
    const sample = (j.dealPushErrorSample ?? '').trim().slice(0, 140)
    s += ` ${errN} push error(s)${sample ? `: ${sample}` : ''}. Check Settings for Google status.`
  }
  return s
}
