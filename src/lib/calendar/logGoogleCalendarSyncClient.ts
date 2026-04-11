import type { GoogleCalendarSyncResponseBody } from '@/lib/calendar/googleCalendarSyncToast'

/** Safe snapshot for console + debug ingest (no tokens). */
export function snapshotGoogleCalendarSyncResponse(
  res: Response,
  body: GoogleCalendarSyncResponseBody & { error?: string },
): Record<string, unknown> {
  const scan = body.dealPushScan
  return {
    httpOk: res.ok,
    httpStatus: res.status,
    error: body.error ?? null,
    dealPushOAuthConfigured: body.dealPushOAuthConfigured ?? null,
    import: {
      imported: body.imported ?? null,
      refreshed: body.refreshed ?? null,
      skipped: body.skipped ?? null,
      tasksCreated: body.tasksCreated ?? null,
    },
    dealPushScan: scan
      ? {
          dealsLoaded: scan.dealsLoaded,
          qualifiedByEmbed: scan.qualifiedByEmbed,
          qualifiedByLookup: scan.qualifiedByLookup,
          mismatchEmbFailLookupOk: scan.mismatchEmbFailLookupOk,
          pushQueueSource: scan.pushQueueSource,
          queryError: scan.queryError,
        }
      : null,
    dealPush: {
      attempted: body.dealPushAttempted ?? null,
      inserted: body.dealPushInserted ?? null,
      patched: body.dealPushPatched ?? null,
      patchedAfterRace: body.dealPushPatchedAfterRace ?? null,
      noop: body.dealPushNoop ?? null,
      deleted: body.dealPushDeleted ?? null,
      errors: body.dealPushErrors ?? null,
      errorSample: body.dealPushErrorSample ?? null,
      truncated: body.dealPushTruncated ?? null,
    },
  }
}

/**
 * Logs sync outcome to the browser console (always) and to the local debug ingest when reachable.
 * Open DevTools → Console and filter for `[ArtistManager][google-calendar-sync]`.
 */
export function logGoogleCalendarSyncClient(source: string, res: Response, body: GoogleCalendarSyncResponseBody & { error?: string }) {
  const snap = snapshotGoogleCalendarSyncResponse(res, body)
  console.info(`[ArtistManager][google-calendar-sync] ${source}`, snap)

  // #region agent log
  fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '58b41d' },
    body: JSON.stringify({
      sessionId: '58b41d',
      hypothesisId: 'CLIENT_SYNC',
      location: `logGoogleCalendarSyncClient:${source}`,
      message: 'google-calendar-sync client result',
      data: snap,
      timestamp: Date.now(),
    }),
  }).catch(() => {})
  // #endregion
}
