import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, PhoneForwarded, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useColdCalls } from '@/hooks/useColdCalls'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { COLD_CALL_TEMPERATURE_META, type ColdCallTemperature } from '@/lib/coldCall/coldCallPayload'

function tempLabel(t: string): string {
  if (!t) return '—'
  const m = COLD_CALL_TEMPERATURE_META[t as Exclude<ColdCallTemperature, ''>]
  return m ? `${m.emoji} ${m.label}` : t
}

export default function ColdCallsHubPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const cold = useColdCalls()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => cold.calls, [cold.calls])

  useEffect(() => {
    if (cold.loading || rows.length === 0) return
    setSelectedId(prev => {
      if (prev && rows.some(r => r.id === prev)) return prev
      return rows[0]?.id ?? null
    })
  }, [cold.loading, rows])

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId])

  const openWorkspace = useCallback(
    (id: string) => {
      navigate(`/forms/cold-call?callId=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  const handleNew = async () => {
    const row = await cold.createColdCall()
    if (row) openWorkspace(row.id)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this cold call? This cannot be undone.')) return
    await cold.deleteColdCall(id)
    setSelectedId(null)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  if (cold.loading && rows.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
      <header className="h-14 border-b border-neutral-800 flex items-center gap-4 px-4 sm:px-6 shrink-0 bg-neutral-950/95 backdrop-blur-sm z-10">
        <Button variant="ghost" size="sm" className="gap-2 text-neutral-400 -ml-1 shrink-0" asChild>
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-neutral-100 tracking-tight">Cold calls</h1>
          <p className="text-[11px] text-neutral-500 truncate">Outbound venue outreach — pre-call research through post-call</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 shrink-0 bg-neutral-100 text-neutral-950 hover:bg-white"
          onClick={() => void handleNew()}
        >
          <Plus className="h-4 w-4" />
          New cold call
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <aside className="lg:w-[380px] lg:min-w-[320px] lg:max-w-[420px] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col min-h-0 bg-neutral-950">
          <div className="p-3 sm:p-4 border-b border-neutral-800/80 shrink-0">
            {cold.error ? <p className="text-xs text-red-400">{cold.error}</p> : null}
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-700 p-6 text-center">
                <PhoneForwarded className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-400 mb-3">No cold calls yet.</p>
                <Button type="button" size="sm" variant="outline" className="border-neutral-600" onClick={() => void handleNew()}>
                  Start one
                </Button>
              </div>
            ) : (
              rows.map(row => {
                const active = row.id === selectedId
                return (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      'w-full text-left rounded-lg border px-3 py-2.5 transition-colors',
                      active
                        ? 'border-neutral-200 bg-neutral-900/80 shadow-sm'
                        : 'border-white/[0.06] bg-neutral-900/20 hover:border-white/10 hover:bg-neutral-900/40',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug">
                        {row.title || 'Untitled'}
                      </span>
                      <span className="text-[10px] text-neutral-500 shrink-0 tabular-nums">
                        {row.updated_at?.slice(0, 10)}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">{tempLabel(row.temperature)}</div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {!selected ? (
            <p className="text-sm text-neutral-500">Select a cold call or create a new one.</p>
          ) : (
            <div className="max-w-xl space-y-4">
              <h2 className="text-base font-semibold text-neutral-100">{selected.title || 'Untitled'}</h2>
              <div className="text-sm text-neutral-400 space-y-1">
                <p>Temperature: {tempLabel(selected.temperature)}</p>
                {selected.converted_to_intake_id ? (
                  <p>
                    Converted to booking intake —{' '}
                    <Link
                      to={`/forms/intake?intakeId=${encodeURIComponent(selected.converted_to_intake_id)}`}
                      className="text-sky-400 underline underline-offset-2"
                    >
                      Open intake
                    </Link>
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => openWorkspace(selected.id)}>
                  Open workspace
                </Button>
                <Button type="button" variant="outline" className="border-red-900/50 text-red-300" onClick={() => void handleDelete(selected.id)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
