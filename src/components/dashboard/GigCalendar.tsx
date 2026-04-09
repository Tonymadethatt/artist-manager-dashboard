import { useMemo, useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react'
import type { Deal, Venue } from '@/types'
import { dealQualifiesForCalendar } from '@/lib/calendar/gigCalendarRules'
import {
  pacificDateKeyFromUtcIso,
  utcIsoToPacificDateAndTime,
  weekdaySunday0PacificYmd,
  addCalendarDaysPacific,
  pacificTodayYmd,
} from '@/lib/calendar/pacificWallTime'
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

type CalendarDeal = Deal & { venue?: Pick<Venue, 'id' | 'name' | 'status'> | null }

function venueById(venues: Venue[], id: string | null): Pick<Venue, 'id' | 'name' | 'status'> | null {
  if (!id) return null
  const v = venues.find(x => x.id === id)
  return v ? { id: v.id, name: v.name, status: v.status } : null
}

function shortTitle(deal: CalendarDeal): string {
  const v = deal.venue?.name
  const base = deal.description.trim() || 'Gig'
  if (!v) return base.length > 22 ? `${base.slice(0, 20)}…` : base
  const s = `${base} · ${v}`
  return s.length > 26 ? `${s.slice(0, 24)}…` : s
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

export function GigCalendar({
  deals,
  venues,
  loading,
}: {
  deals: CalendarDeal[]
  venues: Venue[]
  loading?: boolean
}) {
  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<'week' | 'month'>('week')
  const [selectedDeal, setSelectedDeal] = useState<CalendarDeal | null>(null)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const apply = () => setView(mq.matches ? 'month' : 'week')
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  const calendarDeals = useMemo(() => {
    return deals.filter(d => {
      const v = d.venue ?? venueById(venues, d.venue_id)
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

  const nowMs = Date.now()

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

  function prevMonth() {
    setCursor(addMonths(cursor, -1))
  }
  function nextMonth() {
    setCursor(addMonths(cursor, 1))
  }
  function prevWeek() {
    const t = cursor.getTime() - 7 * 86400000
    setCursor(new Date(t))
  }
  function nextWeek() {
    const t = cursor.getTime() + 7 * 86400000
    setCursor(new Date(t))
  }
  function goToday() {
    setCursor(new Date())
  }

  function cellTone(deal: CalendarDeal): 'past' | 'upcoming' {
    const end = deal.event_end_at ? new Date(deal.event_end_at).getTime() : 0
    return end < nowMs ? 'past' : 'upcoming'
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-3 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarIcon className="h-5 w-5 text-neutral-500 shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-neutral-100 truncate">Gig calendar</h2>
            <p className="text-[11px] text-neutral-500 truncate">Booked shows · Pacific time</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-neutral-700 overflow-hidden">
            <button
              type="button"
              onClick={() => setView('week')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                view === 'week' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-200',
              )}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setView('month')}
              className={cn(
                'px-2.5 py-1 text-xs font-medium transition-colors',
                view === 'month' ? 'bg-neutral-100 text-neutral-900' : 'text-neutral-400 hover:text-neutral-200',
              )}
            >
              Month
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={goToday}>
            Today
          </Button>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={view === 'month' ? prevMonth : prevWeek} aria-label="Previous">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-neutral-300 tabular-nums px-1 min-w-[8.5rem] text-center">
              {view === 'month' ? formatMonthYear(cursor) : `Week of ${weekKeys[0]?.slice(5).replace('-', '/') ?? ''}`}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={view === 'month' ? nextMonth : nextWeek} aria-label="Next">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Link
            to="/earnings"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors whitespace-nowrap"
          >
            Edit gigs →
          </Link>
        </div>
      </div>

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
              const list = c.key ? dealsByDay.get(c.key) ?? [] : []
              const isToday = c.key === pacificDateKeyFromUtcIso(new Date().toISOString())
              return (
                <div
                  key={idx}
                  className={cn(
                    'min-h-[72px] sm:min-h-[88px] bg-neutral-900 p-1 sm:p-1.5 text-left align-top',
                    !c.inMonth && 'opacity-40',
                  )}
                >
                  {c.key && (
                    <>
                      <div
                        className={cn(
                          'text-[10px] font-medium mb-0.5 tabular-nums',
                          isToday ? 'text-white' : 'text-neutral-500',
                        )}
                      >
                        {parseInt(c.key.slice(8), 10)}
                      </div>
                      <div className="space-y-0.5">
                        {list.slice(0, MAX_CHIPS).map(deal => (
                          <button
                            key={deal.id}
                            type="button"
                            onClick={() => setSelectedDeal(deal)}
                            className={cn(
                              'block w-full text-left truncate rounded px-0.5 text-[10px] sm:text-[11px] leading-tight border border-transparent',
                              cellTone(deal) === 'past'
                                ? 'text-neutral-500 bg-neutral-950/80 border-neutral-800'
                                : 'text-neutral-100 bg-neutral-800/90 hover:border-neutral-600',
                            )}
                          >
                            {shortTitle(deal)}
                          </button>
                        ))}
                        {list.length > MAX_CHIPS && (
                          <div className="text-[9px] text-neutral-600">+{list.length - MAX_CHIPS} more</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="p-2 sm:p-3">
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {weekKeys.map(key => {
              const list = dealsByDay.get(key) ?? []
              const isToday = key === pacificDateKeyFromUtcIso(new Date().toISOString())
              const label = `${WEEKDAYS[weekdaySunday0PacificYmd(key)]} ${parseInt(key.slice(8), 10)}`
              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-md border p-1.5 sm:p-2 min-h-[120px] sm:min-h-[140px]',
                    isToday ? 'border-neutral-500 bg-neutral-950' : 'border-neutral-800 bg-neutral-900/80',
                  )}
                >
                  <div className="text-[10px] font-semibold text-neutral-400 mb-1">{label}</div>
                  <div className="space-y-1">
                    {list.map(deal => (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => setSelectedDeal(deal)}
                        className={cn(
                          'block w-full text-left rounded px-1 py-0.5 text-[10px] sm:text-[11px] leading-snug border',
                          cellTone(deal) === 'past'
                            ? 'text-neutral-500 bg-neutral-950 border-neutral-800'
                            : 'text-neutral-100 bg-neutral-800 border-neutral-700 hover:border-neutral-500',
                        )}
                      >
                        {shortTitle(deal)}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={!!selectedDeal} onOpenChange={v => !v && setSelectedDeal(null)}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-900">
          <DialogHeader>
            <DialogTitle className="text-neutral-100 pr-6">
              {selectedDeal?.description ?? 'Gig'}
            </DialogTitle>
          </DialogHeader>
          {selectedDeal && (
            <div className="space-y-2 text-sm text-neutral-300">
              {selectedDeal.venue?.name && (
                <p>
                  <span className="text-neutral-500">Venue · </span>
                  {selectedDeal.venue.name}
                </p>
              )}
              {selectedDeal.event_start_at && selectedDeal.event_end_at && (
                <p className="tabular-nums">
                  <span className="text-neutral-500">When · </span>
                  {utcIsoToPacificDateAndTime(selectedDeal.event_start_at)?.date}{' '}
                  {utcIsoToPacificDateAndTime(selectedDeal.event_start_at)?.time} –{' '}
                  {utcIsoToPacificDateAndTime(selectedDeal.event_end_at)?.time}
                  <span className="text-neutral-600"> PT</span>
                </p>
              )}
              {selectedDeal.gross_amount != null && (
                <p className="tabular-nums">
                  <span className="text-neutral-500">Gross · </span>
                  {selectedDeal.gross_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                </p>
              )}
              {selectedDeal.notes?.trim() && (
                <p className="text-xs text-neutral-400 whitespace-pre-wrap">{selectedDeal.notes}</p>
              )}
              <div className="pt-2 flex gap-2">
                <Button asChild className="flex-1">
                  <Link to="/earnings" onClick={() => setSelectedDeal(null)}>
                    Open Earnings
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
