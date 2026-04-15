import { useMemo, useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, RefreshCw, ScanLine, Trash2 } from 'lucide-react'
import type { Deal, Venue } from '@/types'
import { COMMISSION_TIER_LABELS, OUTREACH_STATUS_LABELS, OUTREACH_TRACK_LABELS } from '@/types'
import { dealQualifiesForCalendar } from '@/lib/calendar/gigCalendarRules'
import {
  pacificDateKeyFromUtcIso,
  formatPacificTimeRangeReadable,
  weekdaySunday0PacificYmd,
  addCalendarDaysPacific,
  pacificTodayYmd,
  pacificWallToUtcIso,
} from '@/lib/calendar/pacificWallTime'
import { queueManualGigDaySummary } from '@/lib/calendar/queueManualGigDaySummary'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

type ViewMode = 'month' | 'week' | 'day'

/** Synced Google Calendar events (shown alongside booked deals). */
export type CalendarSyncEventChip = {
  id: string
  event_start_at: string
  event_end_at: string | null
  summary: string | null
  location: string | null
  /** Google event description / notes (synced on import). */
  description: string | null
  matched_venue_id: string | null
  display_status: 'visible' | 'hidden_duplicate' | 'needs_review'
  dedup_pair_deal_id: string | null
}

type CalendarDeal = Deal & {
  venue?: Pick<Venue, 'id' | 'name' | 'status' | 'outreach_track'> | null
}

function venueById(
  venues: Venue[],
  id: string | null,
): Pick<Venue, 'id' | 'name' | 'status' | 'outreach_track'> | null {
  if (!id) return null
  const v = venues.find(x => x.id === id)
  return v ? { id: v.id, name: v.name, status: v.status, outreach_track: v.outreach_track } : null
}

function formatPacificDateLong(ymd: string): string {
  const iso = pacificWallToUtcIso(ymd, '12:00')
  if (!iso) return ymd
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'America/Los_Angeles',
  }).format(new Date(iso))
}

function shortTitle(deal: CalendarDeal): string {
  const v = deal.venue?.name
  const base = deal.description.trim() || 'Gig'
  if (!v) return base.length > 22 ? `${base.slice(0, 20)}…` : base
  const s = `${base} · ${v}`
  return s.length > 26 ? `${s.slice(0, 24)}…` : s
}

function longTitle(deal: CalendarDeal): string {
  const v = deal.venue?.name
  const base = deal.description.trim() || 'Gig'
  return v ? `${base} · ${v}` : base
}

function startOfCalendarMonthUTC(year: number, month0: number): Date {
  return new Date(Date.UTC(year, month0, 1, 12, 0, 0))
}

function addMonths(d: Date, delta: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + delta, 1, 12, 0, 0))
}

function formatMonthYear(d: Date): string {
  return d.toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** YYYY-MM-DD lexicographic order matches calendar order for Pacific day keys. */
function isPastPacificYmd(ymd: string, todayYmd: string): boolean {
  return ymd < todayYmd
}

/** Venue for calendar display (embedded on deal or loaded from `venues`). */
function resolveCalendarVenue(
  deal: CalendarDeal,
  venues: Venue[],
): Pick<Venue, 'id' | 'name' | 'status' | 'outreach_track'> | null {
  return deal.venue ?? venueById(venues, deal.venue_id)
}

function outreachTrackForDeal(deal: CalendarDeal, venues: Venue[]): 'pipeline' | 'community' | null {
  const v = resolveCalendarVenue(deal, venues)
  const t = v?.outreach_track
  if (t === 'pipeline' || t === 'community') return t
  return null
}

function shortSyncTitle(row: CalendarSyncEventChip): string {
  const t = (row.summary ?? 'Calendar event').trim() || 'Calendar event'
  return t.length > 22 ? `${t.slice(0, 20)}…` : t
}

function longSyncTitle(row: CalendarSyncEventChip): string {
  return (row.summary ?? 'Calendar event').trim() || 'Calendar event'
}

export type GigCalendarGoogleToolbarProps = {
  onSync: () => void
  onDedup: () => void
  syncing: boolean
  dedupScanning: boolean
  syncDisabled: boolean
  dedupDisabled: boolean
}

export function GigCalendar({
  deals,
  venues,
  calendarSyncEvents = [],
  loading,
  googleCalendarToolbar,
  deleteCalendarSyncEvent,
}: {
  deals: CalendarDeal[]
  venues: Venue[]
  /** Copied from shared Google Calendar (see Settings → Google Calendar sync). */
  calendarSyncEvents?: CalendarSyncEventChip[]
  loading?: boolean
  /** Optional icon actions (same Netlify handlers as Settings → Google Calendar). */
  googleCalendarToolbar?: GigCalendarGoogleToolbarProps
  /** Remove one imported row from `calendar_sync_event` (local Gig calendar only). */
  deleteCalendarSyncEvent?: (id: string) => Promise<{ ok: boolean; message?: string }>
}) {
  const [cursor, setCursor] = useState(() => new Date())
  /** Default month on tablet/desktop; day only below Tailwind `sm` (640px) where the month grid is too tight. */
  const [view, setView] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches ? 'day' : 'month',
  )
  const [dayKey, setDayKey] = useState(() => pacificTodayYmd())
  const [selectedDeal, setSelectedDeal] = useState<CalendarDeal | null>(null)
  const [selectedSync, setSelectedSync] = useState<CalendarSyncEventChip | null>(null)
  const [dayActionsFor, setDayActionsFor] = useState<string | null>(null)
  const [calendarNotice, setCalendarNotice] = useState<string | null>(null)
  const [queueingDayEmail, setQueueingDayEmail] = useState(false)
  const [syncDeleting, setSyncDeleting] = useState(false)
  const [syncDeleteError, setSyncDeleteError] = useState<string | null>(null)

  useEffect(() => {
    const mqNarrow = window.matchMedia('(max-width: 639px)')
    const apply = () => setView(mqNarrow.matches ? 'day' : 'month')
    apply()
    mqNarrow.addEventListener('change', apply)
    return () => mqNarrow.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    if (selectedSync) setSyncDeleteError(null)
  }, [selectedSync?.id])

  const calendarDeals = useMemo(() => {
    return deals.filter(d => {
      const v = resolveCalendarVenue(d, venues)
      return dealQualifiesForCalendar(d, v)
    })
  }, [deals, venues])

  const dealsByDay = useMemo(() => {
    const m = new Map<string, CalendarDeal[]>()
    for (const d of calendarDeals) {
      if (!d.event_start_at) continue
      const key = pacificDateKeyFromUtcIso(d.event_start_at)
      if (!key) continue
      const list = m.get(key) ?? []
      list.push(d)
      m.set(key, list)
    }
    for (const [, list] of m) {
      list.sort((a, b) => {
        const ta = new Date(a.event_start_at!).getTime()
        const tb = new Date(b.event_start_at!).getTime()
        return ta - tb
      })
    }
    return m
  }, [calendarDeals])

  const syncByDay = useMemo(() => {
    const m = new Map<string, CalendarSyncEventChip[]>()
    for (const row of calendarSyncEvents) {
      const key = pacificDateKeyFromUtcIso(row.event_start_at)
      if (!key) continue
      const list = m.get(key) ?? []
      list.push(row)
      m.set(key, list)
    }
    for (const [, list] of m) {
      list.sort(
        (a, b) =>
          new Date(a.event_start_at).getTime() - new Date(b.event_start_at).getTime(),
      )
    }
    return m
  }, [calendarSyncEvents])

  const nowMs = Date.now()
  const todayYmd = pacificDateKeyFromUtcIso(new Date().toISOString()) ?? pacificTodayYmd()

  const monthCells = useMemo(() => {
    const y = cursor.getUTCFullYear()
    const mo = cursor.getUTCMonth()
    const first = startOfCalendarMonthUTC(y, mo)
    const next = addMonths(first, 1)
    const daysInMonth = Math.round((next.getTime() - first.getTime()) / 86400000)
    const firstKey = `${y}-${String(mo + 1).padStart(2, '0')}-01`
    const pad = weekdaySunday0PacificYmd(firstKey)
    const cells: { key: string | null; inMonth: boolean }[] = []
    for (let i = 0; i < pad; i++) cells.push({ key: null, inMonth: false })
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      cells.push({ key, inMonth: true })
    }
    while (cells.length % 7 !== 0) cells.push({ key: null, inMonth: false })
    while (cells.length < 42) cells.push({ key: null, inMonth: false })
    return cells
  }, [cursor])

  const weekKeys = useMemo(() => {
    const cursorKey = pacificDateKeyFromUtcIso(cursor.toISOString()) ?? pacificTodayYmd()
    const w = weekdaySunday0PacificYmd(cursorKey)
    const sunKey = addCalendarDaysPacific(cursorKey, -w)
    return Array.from({ length: 7 }, (_, i) => addCalendarDaysPacific(sunKey, i))
  }, [cursor])

  const dayList = useMemo(() => dealsByDay.get(dayKey) ?? [], [dealsByDay, dayKey])
  const daySyncList = useMemo(() => syncByDay.get(dayKey) ?? [], [syncByDay, dayKey])
  const dayIsPastForPanel = isPastPacificYmd(dayKey, todayYmd)

  const openDay = useCallback((ymd: string) => {
    setDayKey(ymd)
    const iso = pacificWallToUtcIso(ymd, '12:00')
    if (iso) setCursor(new Date(iso))
    setView('day')
  }, [])

  const prevMonth = () => setCursor(addMonths(cursor, -1))
  const nextMonth = () => setCursor(addMonths(cursor, 1))
  const prevWeek = () => setCursor(new Date(cursor.getTime() - 7 * 86400000))
  const nextWeek = () => setCursor(new Date(cursor.getTime() + 7 * 86400000))
  const prevDay = () => {
    const next = addCalendarDaysPacific(dayKey, -1)
    setDayKey(next)
    const iso = pacificWallToUtcIso(next, '12:00')
    if (iso) setCursor(new Date(iso))
  }
  const nextDay = () => {
    const next = addCalendarDaysPacific(dayKey, 1)
    setDayKey(next)
    const iso = pacificWallToUtcIso(next, '12:00')
    if (iso) setCursor(new Date(iso))
  }

  const goToday = () => {
    const t = pacificTodayYmd()
    setDayKey(t)
    setCursor(new Date())
  }

  const navPrev = () => {
    if (view === 'month') prevMonth()
    else if (view === 'week') prevWeek()
    else prevDay()
  }
  const navNext = () => {
    if (view === 'month') nextMonth()
    else if (view === 'week') nextWeek()
    else nextDay()
  }

  const periodLabel =
    view === 'month'
      ? formatMonthYear(cursor)
      : view === 'week'
        ? (weekKeys[0] ? `Week of ${formatPacificDateLong(weekKeys[0])}` : '')
        : formatPacificDateLong(dayKey)

  function cellTone(deal: CalendarDeal): 'past' | 'upcoming' {
    const end = deal.event_end_at ? new Date(deal.event_end_at).getTime() : 0
    return end < nowMs ? 'past' : 'upcoming'
  }

  function syncChipClass(row: CalendarSyncEventChip, compact: boolean, isPast: boolean) {
    const review = row.display_status === 'needs_review'
    const base = cn(
      'block w-full text-left rounded-md font-semibold border-2 text-[10px] sm:text-[11px] leading-tight transition-colors hover:brightness-110',
      compact ? 'truncate px-1 py-0.5' : 'px-2 py-1.5 text-xs',
    )
    if (review) {
      return cn(
        base,
        isPast
          ? 'border-amber-800 bg-amber-950 text-white border-l-[6px] border-l-amber-500'
          : 'border-amber-600 bg-amber-900 text-white border-l-[6px] border-l-amber-400',
      )
    }
    return cn(
      base,
      isPast
        ? 'border-emerald-800 bg-emerald-950 text-white border-l-[6px] border-l-emerald-500'
        : 'border-emerald-600 bg-emerald-900 text-white border-l-[6px] border-l-emerald-400',
    )
  }

  function chipClass(deal: CalendarDeal, compact: boolean) {
    const past = cellTone(deal) === 'past'
    const track = outreachTrackForDeal(deal, venues)
    const base = cn(
      'block w-full text-left rounded-md font-semibold border-2 text-[10px] sm:text-[11px] leading-tight transition-colors hover:brightness-110',
      compact ? 'truncate px-1 py-0.5' : 'px-2 py-1.5 text-xs',
    )

    if (track === 'pipeline') {
      return cn(
        base,
        past
          ? 'border-blue-800 bg-blue-950 text-white border-l-[6px] border-l-blue-500'
          : 'border-blue-600 bg-blue-900 text-white border-l-[6px] border-l-blue-400',
      )
    }
    if (track === 'community') {
      return cn(
        base,
        past
          ? 'border-amber-600 bg-amber-900 text-white border-l-[6px] border-l-amber-400'
          : 'border-orange-400 bg-amber-400 text-black border-l-[6px] border-l-yellow-100',
      )
    }
    return cn(
      base,
      'border-neutral-500 border-l-[6px] border-l-neutral-300',
      past ? 'bg-neutral-900 text-white' : 'bg-neutral-600 text-white',
    )
  }

  const dealsForDayActions = useMemo(() => {
    if (!dayActionsFor) return []
    return calendarDeals.filter(
      d => d.event_start_at && pacificDateKeyFromUtcIso(d.event_start_at) === dayActionsFor,
    )
  }, [dayActionsFor, calendarDeals])

  async function handleQueueDaySummary() {
    if (!dayActionsFor) return
    setQueueingDayEmail(true)
    setCalendarNotice(null)
    const res = await queueManualGigDaySummary(dayActionsFor)
    setQueueingDayEmail(false)
    if (res.ok) {
      setCalendarNotice('Queued email to your artist. It will send on the next queue run (usually within a minute).')
      setDayActionsFor(null)
    } else {
      setCalendarNotice(res.message)
    }
  }

  async function handleDeleteSelectedSync() {
    if (!selectedSync || !deleteCalendarSyncEvent) return
    setSyncDeleting(true)
    setSyncDeleteError(null)
    const res = await deleteCalendarSyncEvent(selectedSync.id)
    setSyncDeleting(false)
    if (res.ok) {
      setSelectedSync(null)
      setCalendarNotice(
        'Removed this imported event from your Gig calendar. If it still exists in Google, a future sync may add it again.',
      )
    } else {
      setSyncDeleteError(res.message ?? 'Could not remove this event.')
    }
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-3 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-5 w-5 text-neutral-500 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100 truncate">Gig calendar</h2>
            <p className="text-[11px] truncate">
              <span className="text-blue-400 font-semibold">Pipeline</span>
              <span className="text-neutral-600"> · </span>
              <span className="text-amber-300 font-semibold">Community</span>
              <span className="text-neutral-600"> · </span>
              <span className="text-emerald-400 font-semibold">Google Calendar</span>
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2 w-full lg:w-auto min-w-0">
          <div className="flex rounded-md border border-neutral-700 overflow-hidden w-fit max-w-full">
            {(['day', 'week', 'month'] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium transition-colors capitalize',
                  view === v ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-200',
                )}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1 sm:flex-initial">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
              Today
            </Button>
            <div className="flex items-center gap-1 min-w-0">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={navPrev} aria-label="Previous">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-neutral-200 tabular-nums px-1 min-w-0 flex-1 text-center line-clamp-2 sm:line-clamp-1 sm:min-w-[10rem]">
                {periodLabel}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={navNext} aria-label="Next">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Link
              to="/earnings"
              className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors whitespace-nowrap"
            >
              Edit gigs →
            </Link>
            {googleCalendarToolbar && (
              <div className="flex items-center gap-0.5 sm:ml-auto shrink-0 border-t border-neutral-800 pt-2 mt-1 w-full justify-end sm:border-t-0 sm:pt-0 sm:mt-0 sm:w-auto sm:border-l sm:pl-2 sm:ml-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-400 hover:text-neutral-100"
                  disabled={
                    googleCalendarToolbar.syncDisabled ||
                    googleCalendarToolbar.syncing ||
                    googleCalendarToolbar.dedupScanning
                  }
                  aria-label="Import events from Google Calendar"
                  title={
                    googleCalendarToolbar.syncDisabled
                      ? 'Connect Google Calendar in Settings and set a shared calendar ID'
                      : 'Import events from Google Calendar'
                  }
                  onClick={() => googleCalendarToolbar.onSync()}
                >
                  <RefreshCw
                    className={cn('h-4 w-4', googleCalendarToolbar.syncing && 'animate-spin')}
                    aria-hidden
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-400 hover:text-neutral-100"
                  disabled={
                    googleCalendarToolbar.dedupDisabled ||
                    googleCalendarToolbar.dedupScanning ||
                    googleCalendarToolbar.syncing
                  }
                  aria-label="Scan calendar for duplicates"
                  title={
                    googleCalendarToolbar.dedupDisabled
                      ? 'Connect Google Calendar in Settings first'
                      : 'Scan calendar for duplicates'
                  }
                  onClick={() => googleCalendarToolbar.onDedup()}
                >
                  <ScanLine
                    className={cn(
                      'h-4 w-4',
                      googleCalendarToolbar.dedupScanning && 'animate-pulse text-neutral-200',
                    )}
                    aria-hidden
                  />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {calendarNotice && (
        <div className="px-3 py-2 border-b border-neutral-800 flex items-start justify-between gap-2 bg-amber-950/20">
          <p className="text-xs text-amber-200/95">{calendarNotice}</p>
          <button
            type="button"
            className="text-[11px] text-neutral-500 hover:text-neutral-300 shrink-0"
            onClick={() => setCalendarNotice(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : view === 'month' ? (
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-px bg-neutral-800 rounded-md overflow-hidden border border-neutral-800">
            {WEEKDAYS.map(d => (
              <div key={d} className="bg-neutral-950 text-[10px] font-medium text-neutral-500 text-center py-1.5">
                {d}
              </div>
            ))}
            {monthCells.map((c, idx) => {
              const dealList = c.key ? dealsByDay.get(c.key) ?? [] : []
              const syncList = c.key ? syncByDay.get(c.key) ?? [] : []
              const chips: Array<
                | { kind: 'deal'; deal: CalendarDeal }
                | { kind: 'sync'; row: CalendarSyncEventChip }
              > = []
              for (const d of dealList) {
                if (chips.length >= MAX_CHIPS) break
                chips.push({ kind: 'deal', deal: d })
              }
              for (const s of syncList) {
                if (chips.length >= MAX_CHIPS) break
                chips.push({ kind: 'sync', row: s })
              }
              const totalCount = dealList.length + syncList.length
              const hidden = totalCount - chips.length
              const isTodayCell = c.key === todayYmd
              const isPastDay = c.key ? isPastPacificYmd(c.key, todayYmd) : false
              return (
                <div
                  key={idx}
                  role={c.key ? 'button' : undefined}
                  tabIndex={c.key ? 0 : undefined}
                  onKeyDown={e => {
                    if (!c.key) return
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDayActionsFor(c.key)
                    }
                  }}
                  onClick={() => c.key && setDayActionsFor(c.key)}
                  className={cn(
                    'min-h-[76px] sm:min-h-[92px] p-1 sm:p-1.5 text-left align-top relative cursor-pointer flex flex-col',
                    isPastDay
                      ? 'bg-[#060606] hover:bg-[#0a0a0a] saturate-[0.55]'
                      : 'bg-neutral-900 hover:bg-neutral-900/95',
                    !c.inMonth && 'opacity-40',
                    isTodayCell &&
                      'ring-2 ring-white ring-inset z-[1] bg-neutral-800/70 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]',
                  )}
                >
                  {c.key && (
                    <>
                      <div className="flex items-start justify-between gap-0.5 mb-0.5 pointer-events-none">
                        <span
                          className={cn(
                            'text-[10px] font-semibold tabular-nums rounded px-0.5 -ml-0.5',
                            isTodayCell && 'text-white',
                            !isTodayCell && isPastDay && 'text-neutral-600',
                            !isTodayCell && !isPastDay && 'text-neutral-500',
                          )}
                        >
                          {parseInt(c.key.slice(8), 10)}
                        </span>
                        {isTodayCell && (
                          <span className="text-[8px] font-bold uppercase tracking-wide text-white bg-white/15 px-1 py-0.5 rounded">
                            Today
                          </span>
                        )}
                      </div>
                      <div
                        className={cn('space-y-0.5 flex-1 min-h-0', isPastDay && 'opacity-[0.88]')}
                        onClick={e => e.stopPropagation()}
                      >
                        {chips.map((ch, i) =>
                          ch.kind === 'deal' ? (
                            <button
                              key={ch.deal.id}
                              type="button"
                              onClick={() => setSelectedDeal(ch.deal)}
                              className={chipClass(ch.deal, true)}
                            >
                              {shortTitle(ch.deal)}
                            </button>
                          ) : (
                            <button
                              key={`sync-${ch.row.id}-${i}`}
                              type="button"
                              onClick={() => setSelectedSync(ch.row)}
                              className={syncChipClass(ch.row, true, isPastDay)}
                            >
                              {shortSyncTitle(ch.row)}
                            </button>
                          ),
                        )}
                        {hidden > 0 && (
                          <button
                            type="button"
                            onClick={() => openDay(c.key!)}
                            className={cn(
                              'text-[9px] text-left w-full',
                              isPastDay ? 'text-neutral-600 hover:text-neutral-400' : 'text-neutral-400 hover:text-neutral-200',
                            )}
                          >
                            +{hidden} more · open day
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        <div className="p-2 sm:p-3 overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[36rem] md:min-w-0">
            {weekKeys.map(key => {
              const dealList = dealsByDay.get(key) ?? []
              const syncList = syncByDay.get(key) ?? []
              const isTodayCell = key === todayYmd
              const isPastDay = isPastPacificYmd(key, todayYmd)
              const label = `${WEEKDAYS[weekdaySunday0PacificYmd(key)]} ${parseInt(key.slice(8), 10)}`
              return (
                <div
                  key={key}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setDayActionsFor(key)
                    }
                  }}
                  onClick={() => setDayActionsFor(key)}
                  className={cn(
                    'rounded-md border p-1.5 sm:p-2 min-h-[128px] sm:min-h-[148px] min-w-[4.5rem] cursor-pointer flex flex-col',
                    isPastDay
                      ? 'border-neutral-900 bg-[#060606]/95 hover:bg-[#0a0a0a] saturate-[0.55]'
                      : 'border-neutral-800 bg-neutral-900/80 hover:bg-neutral-900/90',
                    isTodayCell &&
                      'ring-2 ring-white border-neutral-600 bg-neutral-800/60',
                  )}
                >
                  <div className="text-[10px] font-semibold text-left w-full mb-1 rounded pointer-events-none">
                    <span
                      className={cn(
                        isTodayCell && 'text-white',
                        !isTodayCell && isPastDay && 'text-neutral-600',
                        !isTodayCell && !isPastDay && 'text-neutral-400',
                      )}
                    >
                      {label}
                    </span>
                    {isTodayCell && (
                      <span className="block text-[8px] font-bold uppercase tracking-wide text-amber-200/90 mt-0.5">
                        Today
                      </span>
                    )}
                  </div>
                  <div
                    className={cn('space-y-1 flex-1 min-h-0', isPastDay && 'opacity-[0.88]')}
                    onClick={e => e.stopPropagation()}
                  >
                    {dealList.map(deal => (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => setSelectedDeal(deal)}
                        className={chipClass(deal, true)}
                      >
                        {shortTitle(deal)}
                      </button>
                    ))}
                    {syncList.map(row => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedSync(row)}
                        className={syncChipClass(row, true, isPastDay)}
                      >
                        {shortSyncTitle(row)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div
            className={cn(
              'rounded-lg border p-3 border-neutral-800 bg-neutral-950/40',
              dayIsPastForPanel && 'border-neutral-900 bg-[#060606]/90 saturate-[0.55]',
            )}
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between mb-2">
              <div>
                <p
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide',
                    dayIsPastForPanel ? 'text-neutral-600' : 'text-neutral-500',
                  )}
                >
                  {dayKey === todayYmd ? 'Today · ' : ''}
                  {formatPacificDateLong(dayKey)}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs shrink-0" onClick={() => setDayActionsFor(dayKey)}>
                Day actions
              </Button>
            </div>
            {dayList.length === 0 && daySyncList.length === 0 ? (
              <div className="py-10 text-center rounded-md border border-dashed border-neutral-700">
                <p className={cn('text-sm', dayIsPastForPanel ? 'text-neutral-500' : 'text-neutral-400')}>
                  No booked gigs or calendar imports on this day.
                </p>
                <p className={cn('text-xs mt-1', dayIsPastForPanel ? 'text-neutral-600/80' : 'text-neutral-600')}>
                  Use month/week to pick another day, add a deal in Earnings, or sync from Settings → Google Calendar.
                </p>
              </div>
            ) : (
              <ul className={cn('space-y-2', dayIsPastForPanel && 'opacity-[0.9]')}>
                {dayList.map(deal => (
                  <li key={deal.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedDeal(deal)}
                      className={cn(chipClass(deal, false), 'w-full text-left')}
                    >
                      <span className="font-medium block text-inherit">{longTitle(deal)}</span>
                      {deal.event_start_at && deal.event_end_at && (
                        <span className="text-[11px] block mt-0.5 font-medium text-inherit">
                          {formatPacificTimeRangeReadable(deal.event_start_at, deal.event_end_at)}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
                {daySyncList.map(row => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedSync(row)}
                      className={cn(syncChipClass(row, false, dayIsPastForPanel), 'w-full text-left')}
                    >
                      <span className="font-medium block text-inherit">{longSyncTitle(row)}</span>
                      {row.event_start_at && row.event_end_at && (
                        <span className="text-[11px] block mt-0.5 font-medium text-inherit">
                          {formatPacificTimeRangeReadable(row.event_start_at, row.event_end_at)}
                        </span>
                      )}
                      {row.location?.trim() && (
                        <span className="text-[11px] block mt-0.5 text-inherit opacity-90">{row.location}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      <Dialog open={!!selectedDeal} onOpenChange={v => !v && setSelectedDeal(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto border-neutral-800 bg-neutral-900 p-5 gap-0">
          <DialogHeader className="pb-3 space-y-0">
            <DialogTitle className="text-base text-white pr-8 leading-snug">
              {selectedDeal?.description ?? 'Gig'}
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (() => {
            const related = calendarDeals.filter(
              d => d.venue_id && d.venue_id === selectedDeal.venue_id && d.id !== selectedDeal.id,
            ).slice(0, 8)
            const sectionWrap = 'rounded-md border border-neutral-800 bg-neutral-950/60 p-3 space-y-2'
            const sectionTitle = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-400'
            const row = 'flex justify-between gap-4 text-sm'
            const rowLabel = 'text-neutral-400 shrink-0'
            const rowValue = 'text-white text-right min-w-0'
            return (
            <div className="flex flex-col gap-3 text-sm">
              {selectedDeal.venue?.name && (
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>Venue</h3>
                  <p className="text-white font-medium">{selectedDeal.venue.name}</p>
                  {selectedDeal.venue.outreach_track && (
                    <div className={row}>
                      <span className={rowLabel}>Track</span>
                      <span className={rowValue}>{OUTREACH_TRACK_LABELS[selectedDeal.venue.outreach_track]}</span>
                    </div>
                  )}
                  {selectedDeal.venue.status && (
                    <div className={row}>
                      <span className={rowLabel}>Status</span>
                      <span className={rowValue}>
                        {OUTREACH_STATUS_LABELS[selectedDeal.venue.status] ?? selectedDeal.venue.status}
                      </span>
                    </div>
                  )}
                </section>
              )}

              <section className={sectionWrap}>
                <h3 className={sectionTitle}>Schedule</h3>
                {selectedDeal.event_start_at && selectedDeal.event_end_at ? (
                  <p className="text-white text-sm leading-snug">
                    {formatPacificTimeRangeReadable(selectedDeal.event_start_at, selectedDeal.event_end_at)}
                  </p>
                ) : selectedDeal.event_date ? (
                  <p className="text-white text-sm">{selectedDeal.event_date}</p>
                ) : (
                  <p className="text-neutral-400 text-sm">No times set</p>
                )}
              </section>

              <section className={sectionWrap}>
                <h3 className={sectionTitle}>Money</h3>
                {selectedDeal.gross_amount != null && (
                  <div className={row}>
                    <span className={rowLabel}>Gross</span>
                    <span className={cn(rowValue, 'tabular-nums')}>
                      {selectedDeal.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                    </span>
                  </div>
                )}
                <div className={row}>
                  <span className={rowLabel}>Commission</span>
                  <span className={cn(rowValue, 'tabular-nums')}>
                    {COMMISSION_TIER_LABELS[selectedDeal.commission_tier]}
                  </span>
                </div>
                <div className={row}>
                  <span className={rowLabel}>Rate</span>
                  <span className={cn(rowValue, 'tabular-nums')}>{Math.round(selectedDeal.commission_rate * 100)}%</span>
                </div>
                <div className={row}>
                  <span className={rowLabel}>Your cut</span>
                  <span className={cn(rowValue, 'tabular-nums')}>
                    {selectedDeal.commission_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                  </span>
                </div>
                {selectedDeal.payment_due_date && (
                  <div className={row}>
                    <span className={rowLabel}>Payment due</span>
                    <span className={rowValue}>{selectedDeal.payment_due_date}</span>
                  </div>
                )}
                <div className={row}>
                  <span className={rowLabel}>Artist paid</span>
                  <span className={rowValue}>{selectedDeal.artist_paid ? 'Yes' : 'No'}</span>
                </div>
                <div className={row}>
                  <span className={rowLabel}>Manager paid</span>
                  <span className={rowValue}>{selectedDeal.manager_paid ? 'Yes' : 'No'}</span>
                </div>
              </section>

              {(selectedDeal.agreement_url || selectedDeal.agreement_generated_file_id) && (
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>Agreement</h3>
                  {selectedDeal.agreement_url ? (
                    <a
                      href={selectedDeal.agreement_url}
                      className="text-sm text-blue-400 hover:underline break-all"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open link
                    </a>
                  ) : (
                    <p className="text-white text-sm">PDF on file — open in Earnings</p>
                  )}
                </section>
              )}

              {selectedDeal.notes?.trim() && (
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>Notes</h3>
                  <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">{selectedDeal.notes}</p>
                </section>
              )}

              {related.length > 0 && (
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>More at this venue</h3>
                  <ul className="space-y-2">
                    {related.map(d => (
                      <li key={d.id}>
                        <button
                          type="button"
                          className="w-full rounded border border-neutral-800 bg-neutral-900/80 px-2.5 py-2 text-left transition-colors hover:border-neutral-600 hover:bg-neutral-900"
                          onClick={() => setSelectedDeal(d)}
                        >
                          <span className="block text-sm text-white">{d.description.trim() || 'Gig'}</span>
                          {d.event_start_at && d.event_end_at && (
                            <span className="mt-0.5 block text-xs text-neutral-200">
                              {formatPacificTimeRangeReadable(d.event_start_at, d.event_end_at)}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4 sm:flex-row">
                <Button asChild variant="default" className="flex-1 h-9 text-sm">
                  <Link to={`/earnings#earnings-deal-${selectedDeal.id}`} onClick={() => setSelectedDeal(null)}>
                    Open in Earnings
                  </Link>
                </Button>
                {selectedDeal.venue_id && (
                  <Button asChild variant="outline" className="flex-1 h-9 text-sm">
                    <Link
                      to="/pipeline"
                      state={{ openVenueId: selectedDeal.venue_id }}
                      onClick={() => setSelectedDeal(null)}
                    >
                      Venue in Pipeline
                    </Link>
                  </Button>
                )}
              </div>
            </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedSync} onOpenChange={v => !v && setSelectedSync(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto border-neutral-800 bg-neutral-900 p-5 gap-0">
          <DialogHeader className="pb-3 space-y-0">
            <DialogTitle className="text-base text-white pr-8 leading-snug">
              {selectedSync ? longSyncTitle(selectedSync) : 'Calendar event'}
            </DialogTitle>
          </DialogHeader>
          {selectedSync && (() => {
            const matchedVenue = selectedSync.matched_venue_id
              ? venues.find(v => v.id === selectedSync.matched_venue_id)
              : null
            const sectionWrap = 'rounded-md border border-neutral-800 bg-neutral-950/60 p-3 space-y-2'
            const sectionTitle = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-400'
            return (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-xs text-neutral-500">
                  Imported from your shared Google calendar (see Settings). Green chips on the grid are these events; amber
                  highlights a possible duplicate with a booked gig.
                </p>
                {selectedSync.display_status === 'needs_review' && (
                  <div className="rounded-md border border-amber-700/60 bg-amber-950/40 px-3 py-2 text-xs text-amber-100/95">
                    Possible duplicate with a booked gig — review times and titles in Earnings vs this import. Run{' '}
                    <strong className="text-amber-50">Scan for duplicates</strong> in Settings after you clean up.
                    {selectedSync.dedup_pair_deal_id && (
                      <>
                        {' '}
                        <Link
                          className="underline font-medium text-amber-200 hover:text-white"
                          to={`/earnings#earnings-deal-${selectedSync.dedup_pair_deal_id}`}
                          onClick={() => setSelectedSync(null)}
                        >
                          Open related deal
                        </Link>
                      </>
                    )}
                  </div>
                )}
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>Schedule</h3>
                  {selectedSync.event_start_at && selectedSync.event_end_at ? (
                    <p className="text-white text-sm leading-snug">
                      {formatPacificTimeRangeReadable(
                        selectedSync.event_start_at,
                        selectedSync.event_end_at,
                      )}
                    </p>
                  ) : (
                    <p className="text-neutral-400 text-sm">Times not available</p>
                  )}
                </section>
                {selectedSync.location?.trim() && (
                  <section className={sectionWrap}>
                    <h3 className={sectionTitle}>Location</h3>
                    <p className="text-white text-sm whitespace-pre-wrap">{selectedSync.location}</p>
                  </section>
                )}
                {selectedSync.description?.trim() && (
                  <section className={sectionWrap}>
                    <h3 className={sectionTitle}>Notes</h3>
                    <p className="text-white text-sm whitespace-pre-wrap max-h-48 overflow-y-auto pr-1">
                      {selectedSync.description}
                    </p>
                  </section>
                )}
                <section className={sectionWrap}>
                  <h3 className={sectionTitle}>Venue in app</h3>
                  {matchedVenue ? (
                    <p className="text-white font-medium">{matchedVenue.name}</p>
                  ) : (
                    <p className="text-neutral-400 text-sm">
                      No matching venue — a Pipeline task may have been created to add this one.
                    </p>
                  )}
                </section>
                {deleteCalendarSyncEvent && (
                  <div className="rounded-md border border-neutral-800 bg-neutral-950/40 p-3 space-y-2">
                    <p className="text-[11px] text-neutral-500 leading-snug">
                      Remove this copy from the Gig calendar only. This does not delete the event in Google Calendar.
                    </p>
                    {syncDeleteError && (
                      <p className="text-xs text-red-300/95">{syncDeleteError}</p>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      className="w-full h-9 text-sm gap-2"
                      disabled={syncDeleting}
                      onClick={() => void handleDeleteSelectedSync()}
                    >
                      <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
                      {syncDeleting ? 'Removing…' : 'Remove from Gig calendar'}
                    </Button>
                  </div>
                )}
                <div className="flex flex-col gap-2 border-t border-neutral-800 pt-4 sm:flex-row">
                  {matchedVenue && (
                    <Button asChild variant="default" className="flex-1 h-9 text-sm">
                      <Link
                        to="/pipeline"
                        state={{ openVenueId: matchedVenue.id }}
                        onClick={() => setSelectedSync(null)}
                      >
                        Open venue
                      </Link>
                    </Button>
                  )}
                  <Button asChild variant="outline" className="flex-1 h-9 text-sm">
                    <Link to="/outreach" onClick={() => setSelectedSync(null)}>
                      Add venue
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!dayActionsFor} onOpenChange={v => !v && setDayActionsFor(null)}>
        <DialogContent className="max-w-sm border-neutral-800 bg-neutral-900 p-5 gap-0">
          <DialogHeader className="space-y-1 pb-4">
            <DialogTitle className="text-base text-neutral-100 pr-6">
              {dayActionsFor ? formatPacificDateLong(dayActionsFor) : 'Day'}
            </DialogTitle>
            {dayActionsFor && (
              <p className="text-sm text-neutral-200 font-normal leading-snug">
                {dealsForDayActions.length === 0
                  ? 'No gigs this day'
                  : `${dealsForDayActions.length} gig${dealsForDayActions.length === 1 ? '' : 's'}`}
              </p>
            )}
          </DialogHeader>
          {dayActionsFor && (
            <>
              <Button
                type="button"
                className="w-full h-10 text-sm font-medium"
                disabled={dealsForDayActions.length === 0 || queueingDayEmail}
                title={dealsForDayActions.length === 0 ? 'Needs at least one saved gig on this day' : undefined}
                onClick={() => void handleQueueDaySummary()}
              >
                {queueingDayEmail ? 'Sending…' : 'Send reminder to artist'}
              </Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
