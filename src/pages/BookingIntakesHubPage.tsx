import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, Mic2, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useBookingIntakes } from '@/hooks/useBookingIntakes'
import { useVenues } from '@/hooks/useVenues'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  buildIntakePreviewSnapshot,
  intakeHubStatus,
  intakeHubStatusLabel,
  type IntakeHubStatus,
} from '@/lib/intake/intakeHubMetadata'

type FilterKey = 'all' | IntakeHubStatus

const FILTER_OPTIONS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'pre_call', label: 'Pre-call' },
  { key: 'live', label: 'On call' },
  { key: 'post_call', label: 'Post-call' },
]

export default function BookingIntakesHubPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const booking = useBookingIntakes()
  const { venues } = useVenues()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')

  const venueNameById = useMemo(() => new Map(venues.map(v => [v.id, v.name])), [venues])

  const rowsWithMeta = useMemo(() => {
    return booking.intakes.map(row => {
      const status = intakeHubStatus(row)
      const shows = booking.showsByIntake[row.id]
      return { row, status, shows }
    })
  }, [booking.intakes, booking.showsByIntake])

  const filtered = useMemo(() => {
    if (filter === 'all') return rowsWithMeta
    return rowsWithMeta.filter(x => x.status === filter)
  }, [rowsWithMeta, filter])

  useEffect(() => {
    if (booking.loading || filtered.length === 0) return
    setSelectedId(prev => {
      if (prev && filtered.some(x => x.row.id === prev)) return prev
      return filtered[0]?.row.id ?? null
    })
  }, [booking.loading, filtered])

  const selected = useMemo(
    () => rowsWithMeta.find(x => x.row.id === selectedId)?.row ?? null,
    [rowsWithMeta, selectedId],
  )

  const preview = useMemo(() => {
    if (!selected) return null
    return buildIntakePreviewSnapshot(
      selected,
      booking.showsByIntake[selected.id],
      id => venueNameById.get(id),
    )
  }, [selected, booking.showsByIntake, venueNameById])

  const openWorkspace = useCallback(
    (id: string) => {
      navigate(`/forms/intake?intakeId=${encodeURIComponent(id)}`)
    },
    [navigate],
  )

  const handleNew = async () => {
    const row = await booking.createIntake()
    if (row) openWorkspace(row.id)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this intake and its show drafts? This cannot be undone.')) return
    await booking.deleteIntake(id)
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

  if (booking.loading && booking.intakes.length === 0) {
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
          <h1 className="text-sm font-semibold text-neutral-100 tracking-tight">Call intakes</h1>
          <p className="text-[11px] text-neutral-500 truncate">Drafts, live captures, and post-call wrap-ups</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 shrink-0 bg-neutral-100 text-neutral-950 hover:bg-white"
          onClick={() => void handleNew()}
        >
          <Plus className="h-4 w-4" />
          New intake
        </Button>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <aside className="lg:w-[380px] lg:min-w-[320px] lg:max-w-[420px] border-b lg:border-b-0 lg:border-r border-neutral-800 flex flex-col min-h-0 bg-neutral-950">
          <div className="p-3 sm:p-4 border-b border-neutral-800/80 space-y-3 shrink-0">
            <div className="flex flex-wrap gap-1.5">
              {FILTER_OPTIONS.map(o => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setFilter(o.key)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors',
                    filter === o.key
                      ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                      : 'border-white/[0.08] bg-neutral-900/40 text-neutral-400 hover:text-neutral-200',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
            {booking.error ? <p className="text-xs text-red-400">{booking.error}</p> : null}
          </div>
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5">
            {filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed border-neutral-700 p-6 text-center">
                <Mic2 className="h-8 w-8 text-neutral-600 mx-auto mb-2" />
                <p className="text-sm text-neutral-400 mb-3">No intakes in this filter.</p>
                <Button type="button" size="sm" variant="outline" className="border-neutral-600" onClick={() => void handleNew()}>
                  Start one
                </Button>
              </div>
            ) : (
              filtered.map(({ row, status }) => {
                const active = row.id === selectedId
                const stLabel = intakeHubStatusLabel(status)
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
                        {row.title?.trim() || 'Untitled intake'}
                      </span>
                      <span
                        className={cn(
                          'shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border',
                          status === 'live' && 'border-emerald-800/60 text-emerald-300/90 bg-emerald-950/30',
                          status === 'post_call' && 'border-violet-800/50 text-violet-200/90 bg-violet-950/25',
                          status === 'pre_call' && 'border-sky-800/50 text-sky-200/90 bg-sky-950/25',
                          status === 'draft' && 'border-neutral-600 text-neutral-400 bg-neutral-900/50',
                        )}
                      >
                        {stLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500 mt-1">
                      Updated{' '}
                      {new Date(row.updated_at).toLocaleString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </p>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 overflow-y-auto">
          {!selected || !preview ? (
            <div className="h-full min-h-[280px] flex flex-col items-center justify-center p-8 text-center">
              <p className="text-sm text-neutral-500">Select an intake to preview details.</p>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <h2 className="text-lg font-semibold text-neutral-50 leading-tight">
                    {selected.title?.trim() || 'Untitled intake'}
                  </h2>
                  <p className="text-xs text-neutral-500">
                    {intakeHubStatusLabel(intakeHubStatus(selected))} · {preview.showCount} show
                    {preview.showCount === 1 ? '' : 's'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 bg-neutral-100 text-neutral-950 hover:bg-white"
                    onClick={() => openWorkspace(selected.id)}
                  >
                    Open workspace
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-red-900/50 text-red-300 hover:bg-red-950/40 hover:text-red-200"
                    onClick={() => void handleDelete(selected.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.08] bg-neutral-900/35 overflow-hidden">
                <div className="px-4 py-2.5 border-b border-white/[0.06] bg-neutral-900/50">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Snapshot</p>
                </div>
                <dl className="p-4 sm:p-5 grid gap-4 sm:grid-cols-2 text-sm">
                  <div className="space-y-1">
                    <dt className="text-[11px] text-neutral-500">Contact</dt>
                    <dd className="text-neutral-200 font-medium">{preview.contactName}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] text-neutral-500">Phone</dt>
                    <dd className="text-neutral-300">{preview.contactPhone}</dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-[11px] text-neutral-500">Email</dt>
                    <dd className="text-neutral-300 break-all">{preview.contactEmail}</dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-[11px] text-neutral-500">Venue</dt>
                    <dd className="text-neutral-200">{preview.venueLine}</dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-[11px] text-neutral-500">Event</dt>
                    <dd className="text-neutral-300">{preview.eventLine}</dd>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-[11px] text-neutral-500">Inquiry</dt>
                    <dd className="text-neutral-400 text-xs leading-relaxed line-clamp-4">{preview.inquiryLine}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] text-neutral-500">Workspace</dt>
                    <dd className="text-neutral-300">{preview.sessionLabel}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] text-neutral-500">Current section</dt>
                    <dd className="text-neutral-300">{preview.progressSection}</dd>
                  </div>
                </dl>
              </div>

              <p className="text-[11px] text-neutral-500 leading-relaxed">
                Open workspace to continue from pre-call through live capture and post-call import. Your place in the flow
                is restored automatically.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
