import { cn } from '@/lib/utils'

export type BulkLeadSendOverlayState =
  | { kind: 'sending'; processed: number; total: number }
  | { kind: 'result'; ok: boolean; message: string }

type Props = {
  state: BulkLeadSendOverlayState | null
}

/**
 * Full-screen lightweight modal while a bulk lead email task runs in the browser,
 * then a short confirmation before the parent clears it.
 */
export function BulkLeadEmailProgressOverlay({ state }: Props) {
  if (!state) return null

  const pct
    = state.kind === 'sending' && state.total > 0
      ? Math.min(100, Math.round((state.processed / state.total) * 100))
      : null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 px-4"
      role="alertdialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy={state.kind === 'sending'}
    >
      <div
        className={cn(
          'w-full max-w-sm rounded-lg border p-5 shadow-xl shadow-black/50',
          state.kind === 'result' && state.ok
            && 'border-green-800/80 bg-green-950/50',
          state.kind === 'result' && !state.ok
            && 'border-neutral-600 bg-neutral-900',
          state.kind === 'sending' && 'border-neutral-700 bg-neutral-900',
        )}
      >
        {state.kind === 'sending' ? (
          <>
            <p className="text-sm font-medium text-neutral-100 mb-1">Sending lead emails</p>
            <p className="text-xs text-neutral-400 mb-4">Keep this tab open until this finishes.</p>
            {state.total > 0 ? (
              <>
                <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden mb-2">
                  <div
                    className="h-full rounded-full bg-neutral-200 transition-[width] duration-300 ease-out"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-neutral-500 tabular-nums">
                  {state.processed} of {state.total} processed
                </p>
              </>
            ) : (
              <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div className="h-full w-1/3 rounded-full bg-neutral-400/90 animate-pulse" />
              </div>
            )}
          </>
        ) : (
          <>
            <p
              className={cn(
                'text-sm font-medium',
                state.ok ? 'text-green-100' : 'text-neutral-100',
              )}
            >
              {state.message}
            </p>
            <p className="text-xs text-neutral-500 mt-2">This will close in a moment.</p>
          </>
        )}
      </div>
    </div>
  )
}
