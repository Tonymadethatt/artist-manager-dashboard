import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, PhoneForwarded, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useColdCalls } from '@/hooks/useColdCalls'
import type { ColdCallRow } from '@/hooks/useColdCalls'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  COLD_CALL_OUTCOME_LABELS,
  COLD_CALL_PURPOSE_LABELS,
  COLD_CALL_REJECTION_LABELS,
  COLD_CALL_TEMPERATURE_META,
  parseColdCallData,
  type ColdCallDataV1,
  type ColdCallSessionMode,
  type ColdCallTemperature,
} from '@/lib/coldCall/coldCallPayload'
import { DURATION_OPTIONS, WHO_ANSWERED_OPTIONS } from '@/pages/cold-call/liveFieldOptions'
import { CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'

const SESSION_LABEL: Record<ColdCallSessionMode, string> = {
  pre_call: 'Pre-call',
  live_call: 'Live call',
  post_call: 'Post-call',
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ')
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function pickLabel(options: { id: string; label: string }[], id: string): string {
  if (!id) return '—'
  return options.find(o => o.id === id)?.label ?? id.replace(/_/g, ' ')
}

function tempLabel(t: string): string {
  if (!t) return '—'
  const m = COLD_CALL_TEMPERATURE_META[t as Exclude<ColdCallTemperature, ''>]
  return m ? `${m.emoji} ${m.label}` : t
}

function outcomeLabel(outcome: string): string {
  if (!outcome) return '—'
  const o = outcome as keyof typeof COLD_CALL_OUTCOME_LABELS
  return COLD_CALL_OUTCOME_LABELS[o] ?? outcome.replace(/_/g, ' ')
}

function purposeLabel(purpose: string): string {
  if (!purpose) return '—'
  const p = purpose as keyof typeof COLD_CALL_PURPOSE_LABELS
  return COLD_CALL_PURPOSE_LABELS[p] ?? purpose.replace(/_/g, ' ')
}

function rejectionLabel(reason: string | null): string {
  if (!reason) return '—'
  const r = reason as keyof typeof COLD_CALL_REJECTION_LABELS
  return COLD_CALL_REJECTION_LABELS[r] ?? reason.replace(/_/g, ' ')
}

function titleKeyLabel(key: string): string {
  if (!key) return ''
  return key in CONTACT_TITLE_LABELS ? CONTACT_TITLE_LABELS[key as ContactTitleKey] : key.replace(/_/g, ' ')
}

function PreviewFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-b border-neutral-800/70 py-2.5 last:border-b-0 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-x-4">
      <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500">{label}</dt>
      <dd className="min-w-0 text-sm text-neutral-200">{children}</dd>
    </div>
  )
}

function coldCallPreviewFacts(row: ColdCallRow, data: ColdCallDataV1) {
  const venueLine = [data.venue_name?.trim(), [data.city?.trim(), data.state_region?.trim()].filter(Boolean).join(', ')].filter(
    Boolean,
  )
  const targetParts = [
    data.target_name?.trim(),
    data.target_title_key ? `(${titleKeyLabel(data.target_title_key)})` : '',
  ].filter(Boolean)
  const noteText = (row.notes?.trim() || data.call_notes?.trim() || '').trim()

  const purpose = (row.call_purpose || data.call_purpose || '').trim()
  const who = (row.who_answered || data.who_answered || '').trim()
  const outcome = (row.outcome || data.outcome || '').trim()

  return (
    <dl className="rounded-lg border border-neutral-800/80 bg-neutral-950/40 px-3 sm:px-4">
      <PreviewFact label="Call date">{fmtDate(row.call_date)}</PreviewFact>
      <PreviewFact label="Last updated">{fmtDateTime(row.updated_at)}</PreviewFact>
      <PreviewFact label="Created">{fmtDateTime(row.created_at)}</PreviewFact>
      <PreviewFact label="Workspace">{SESSION_LABEL[data.session_mode] ?? data.session_mode}</PreviewFact>
      {venueLine.length > 0 ? (
        <PreviewFact label="Venue / location">{venueLine.join(' · ') || '—'}</PreviewFact>
      ) : null}
      {targetParts.length > 0 ? <PreviewFact label="Contact">{targetParts.join(' ')}</PreviewFact> : null}
      {purpose ? <PreviewFact label="Purpose">{purposeLabel(purpose)}</PreviewFact> : null}
      {who ? <PreviewFact label="Who answered">{pickLabel(WHO_ANSWERED_OPTIONS, who)}</PreviewFact> : null}
      {outcome ? <PreviewFact label="Outcome">{outcomeLabel(outcome)}</PreviewFact> : null}
      {(row.rejection_reason || data.rejection_reason) ? (
        <PreviewFact label="Rejection">{rejectionLabel(row.rejection_reason ?? data.rejection_reason)}</PreviewFact>
      ) : null}
      {(row.duration_feel || data.call_duration_feel) ? (
        <PreviewFact label="Call length">{pickLabel(DURATION_OPTIONS, row.duration_feel || data.call_duration_feel)}</PreviewFact>
      ) : null}
      {row.follow_up_date ? <PreviewFact label="Follow-up date">{fmtDate(row.follow_up_date)}</PreviewFact> : null}
      {row.venue_id ? (
        <PreviewFact label="Pipeline">
          <span className="text-neutral-300">Venue linked</span>
          {row.save_to_pipeline ? <span className="ml-2 text-emerald-400/90">· Save to pipeline</span> : null}
        </PreviewFact>
      ) : row.save_to_pipeline ? (
        <PreviewFact label="Pipeline">
          <span className="text-emerald-400/90">Marked save to pipeline</span>
        </PreviewFact>
      ) : null}
      {noteText ? (
        <div className="border-t border-neutral-800/70 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-neutral-500 mb-1.5">Notes</dt>
          <dd className="text-sm text-neutral-300 whitespace-pre-wrap line-clamp-6 leading-relaxed">{noteText}</dd>
        </div>
      ) : null}
    </dl>
  )
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

  const parsedData = useMemo(() => {
    if (!selected) return null
    try {
      return parseColdCallData(selected.call_data)
    } catch {
      return null
    }
  }, [selected])

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
        <aside className="lg:w-[320px] lg:min-w-[280px] lg:max-w-[360px] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col min-h-0 bg-neutral-950">
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
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-neutral-200 bg-neutral-900/80 shadow-sm'
                        : 'border-white/[0.06] bg-neutral-900/20 hover:border-white/10 hover:bg-neutral-900/40',
                    )}
                  >
                    <div className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug">{row.title || 'Untitled'}</div>
                    <div className="mt-1.5 text-xs text-neutral-400">{tempLabel(row.temperature)}</div>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
          {!selected ? (
            <p className="text-sm text-neutral-500">Select a cold call or create a new one.</p>
          ) : parsedData ? (
            <div className="mx-auto max-w-2xl space-y-5">
              <div className="rounded-xl border border-neutral-800 bg-neutral-900/35 p-4 sm:p-5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-lg font-semibold tracking-tight text-neutral-100">{selected.title || 'Untitled'}</h2>
                    <p className="text-sm text-neutral-400">{tempLabel(selected.temperature)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <Button type="button" className="h-9" onClick={() => openWorkspace(selected.id)}>
                      Open workspace
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-red-900/50 text-red-300 hover:bg-red-950/40 hover:text-red-200"
                      onClick={() => void handleDelete(selected.id)}
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" />
                      Delete
                    </Button>
                  </div>
                </div>
              </div>

              {coldCallPreviewFacts(selected, parsedData)}

              {selected.converted_to_intake_id ? (
                <div className="rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-100/90">
                  Converted to booking intake —{' '}
                  <Link
                    to={`/forms/intake?intakeId=${encodeURIComponent(selected.converted_to_intake_id)}`}
                    className="font-medium text-emerald-300 underline underline-offset-2 hover:text-emerald-200"
                  >
                    Open intake
                  </Link>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mx-auto max-w-2xl space-y-4">
              <p className="text-sm text-amber-400/90">Could not read call details for this record.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => openWorkspace(selected.id)}>
                  Open workspace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="border-red-900/50 text-red-300"
                  onClick={() => void handleDelete(selected.id)}
                >
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
