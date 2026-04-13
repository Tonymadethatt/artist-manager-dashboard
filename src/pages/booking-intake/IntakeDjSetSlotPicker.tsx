import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { Eraser } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatSetLengthDisplay } from '@/lib/intake/intakePayloadV3'
import { IntakeQuarterHourTimeField } from '@/pages/booking-intake/IntakeQuarterHourTimeField'

/** 30-minute steps on the rail; whole-hour duration = this many slot steps. */
const SLOT_STEP_MIN = 30
const HOUR_SPAN_STEPS = 2
/** Minimum span on the rail (1 hour in 30-min steps). */
const MIN_SPAN_SLOTS = HOUR_SPAN_STEPS

function parseHmToMin(hm: string): number | null {
  const t = hm.trim()
  if (!t) return null
  const [hs, ms] = t.split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

function formatHmFromMin(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

function formatHm12(hm: string): string {
  const t = hm.trim()
  if (!t) return '—'
  const m = parseHmToMin(t)
  if (m === null) return t
  const h = Math.floor(m / 60)
  const min = m % 60
  const mod = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${mod}:${String(min).padStart(2, '0')} ${ampm}`
}

/** Shorter ruler label when on the hour (e.g. "9:00 PM" → "9 PM"). */
function formatHm12HourOnly(hm: string): string {
  return formatHm12(hm).replace(':00 ', ' ')
}

function eventSpanMinutes(
  startHHmm: string,
  endHHmm: string,
  overnightEvent: boolean,
): number | null {
  const sm = parseHmToMin(startHHmm)
  const em = parseHmToMin(endHHmm)
  if (sm === null || em === null) return null
  if (!overnightEvent) {
    if (em < sm) return null
    return em - sm
  }
  return 1440 - sm + em
}

type Slot = { offsetMin: number; hm: string }

function buildEventSlots(eventStart: string, spanMin: number): Slot[] {
  const sm = parseHmToMin(eventStart)
  if (sm === null || spanMin < SLOT_STEP_MIN) return []
  const out: Slot[] = []
  for (let off = 0; off <= spanMin; off += SLOT_STEP_MIN) {
    out.push({ offsetMin: off, hm: formatHmFromMin(sm + off) })
  }
  return out
}

function slotIndexForHm(slots: Slot[], hm: string): number {
  const t = hm.trim()
  if (!t) return -1
  return slots.findIndex(s => s.hm === t)
}

function nearestSlotIndex(clientX: number, trackEl: HTMLElement, slots: Slot[], span: number): number {
  const rect = trackEl.getBoundingClientRect()
  const x = Math.min(Math.max(clientX - rect.left, 0), rect.width)
  const ratio = rect.width > 0 ? x / rect.width : 0
  const rawOff = ratio * span
  let best = 0
  let bestD = Infinity
  for (let i = 0; i < slots.length; i++) {
    const d = Math.abs(slots[i].offsetMin - rawOff)
    if (d < bestD) {
      bestD = d
      best = i
    }
  }
  return best
}

function pctForSlotIndex(slots: Slot[], span: number, i: number): number {
  if (span <= 0 || !slots[i]) return 0
  return (slots[i].offsetMin / span) * 100
}

/** Minimum % of track width for the draggable “move” strip so short sets stay easy to grab on long events. */
const MIN_RANGE_DRAG_HIT_PCT = 14

/** At most 3 ruler labels: event start, ~center slot, event end (avoids overlap on long windows). */
function rulerMarkIndices(slotCount: number): number[] {
  if (slotCount <= 0) return []
  const last = slotCount - 1
  if (last === 0) return [0]
  const mid = Math.round(last / 2)
  const s = new Set<number>([0, last])
  if (last >= 2 && mid > 0 && mid < last) s.add(mid)
  return Array.from(s).sort((a, b) => a - b)
}

/** Keep end fixed; snap start so span is a whole number of hours (even slot count). */
function snapStartIdxForFixedEnd(start: number, endIdx: number): number {
  const maxS = endIdx - MIN_SPAN_SLOTS
  let s = Math.max(0, Math.min(start, maxS))
  if ((endIdx - s) % 2 === 1) {
    if (s < maxS) s += 1
    else if (s > 0) s -= 1
  }
  return s
}

/** Keep start fixed; snap end so span is a whole number of hours. */
function snapEndIdxForFixedStart(startIdx: number, end: number, maxIdx: number): number {
  let e = Math.max(startIdx + MIN_SPAN_SLOTS, Math.min(end, maxIdx))
  if ((e - startIdx) % 2 === 1) {
    if (e < maxIdx) e += 1
    else e -= 1
  }
  return e
}

/**
 * Fixed heat-map rail for the whole event window (does not move with the selection).
 * Symmetric thermal read: cold blue at event edges → red → orange → yellow → bright yellow/white-hot at center (no green band).
 */
const DJ_THERMAL_RAIL_GRADIENT =
  'linear-gradient(90deg, rgba(16,38,88,0.74) 0%, rgba(28,72,168,0.7) 9%, rgba(52,62,150,0.58) 16%, rgba(110,40,115,0.55) 22%, rgba(168,42,62,0.6) 30%, rgba(208,58,42,0.64) 37%, rgba(228,108,36,0.68) 43%, rgba(240,168,40,0.76) 47%, rgba(252,214,72,0.9) 49%, rgba(255,248,210,0.96) 50%, rgba(252,214,72,0.9) 51%, rgba(240,168,40,0.76) 53%, rgba(228,108,36,0.68) 57%, rgba(208,58,42,0.64) 63%, rgba(168,42,62,0.6) 70%, rgba(110,40,115,0.55) 78%, rgba(52,62,150,0.58) 84%, rgba(28,72,168,0.7) 91%, rgba(16,38,88,0.74) 100%)'

export function IntakeDjSetSlotPicker({
  eventStartTime,
  eventEndTime,
  overnightEvent,
  setStartTime,
  setEndTime,
  setLengthDisplay,
  onSetStartTime,
  onSetEndTime,
  onSetDjRange,
}: {
  eventStartTime: string
  eventEndTime: string
  overnightEvent: boolean
  setStartTime: string
  setEndTime: string
  setLengthDisplay: string
  onSetStartTime: (hm: string) => void
  onSetEndTime: (hm: string) => void
  onSetDjRange?: (startHm: string, endHm: string) => void
}) {
  const uid = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const rangeDragRef = useRef<{ startX: number; startIdx: number; spanSlots: number } | null>(null)
  const span = useMemo(
    () => eventSpanMinutes(eventStartTime, eventEndTime, overnightEvent),
    [eventStartTime, eventEndTime, overnightEvent],
  )

  const slots = useMemo(() => {
    if (span === null || span < SLOT_STEP_MIN) return []
    return buildEventSlots(eventStartTime, span)
  }, [eventStartTime, span])

  const rulerMarks = useMemo(() => rulerMarkIndices(slots.length), [slots.length])

  const maxPresetSpanSlots = Math.max(0, slots.length - 1)
  const hasPresetOptions = maxPresetSpanSlots >= MIN_SPAN_SLOTS

  /** Preset labels in whole hours; rail span = hours × HOUR_SPAN_STEPS. */
  const hourChipValues = useMemo(() => {
    if (!hasPresetOptions) return []
    const out: number[] = []
    for (let h = 1; h * HOUR_SPAN_STEPS <= maxPresetSpanSlots; h++) out.push(h)
    return out
  }, [hasPresetOptions, maxPresetSpanSlots])

  const [pick, setPick] = useState<number | null>(null)
  const [dragging, setDragging] = useState<'start' | 'end' | 'range' | null>(null)
  /** When set, range-drag keeps this many slot steps between start and end until handles or two-tap changes span. */
  const [lockedSpanSlots, setLockedSpanSlots] = useState<number | null>(null)

  useEffect(() => {
    setPick(null)
    setLockedSpanSlots(null)
  }, [eventStartTime, eventEndTime, overnightEvent])

  const startIdx = useMemo(() => slotIndexForHm(slots, setStartTime), [slots, setStartTime])
  const endIdx = useMemo(() => slotIndexForHm(slots, setEndTime), [slots, setEndTime])

  const rangeValid = startIdx >= 0 && endIdx >= 0 && endIdx > startIdx

  useEffect(() => {
    if (lockedSpanSlots === null) return
    if (!rangeValid) return
    if (endIdx - startIdx !== lockedSpanSlots) setLockedSpanSlots(null)
  }, [lockedSpanSlots, rangeValid, endIdx, startIdx])

  const applyRange = useCallback(
    (i0: number, i1: number) => {
      setLockedSpanSlots(null)
      const a = Math.min(i0, i1)
      let b = Math.max(i0, i1)
      if (a < 0 || b >= slots.length || b - a < MIN_SPAN_SLOTS) return
      if ((b - a) % 2 === 1) b -= 1
      if (b <= a) return
      const sh = slots[a].hm
      const eh = slots[b].hm
      if (onSetDjRange) onSetDjRange(sh, eh)
      else {
        onSetStartTime(sh)
        onSetEndTime(eh)
      }
      setPick(null)
    },
    [slots, onSetDjRange, onSetStartTime, onSetEndTime],
  )

  const applyDurationPreset = useCallback(
    (spanSlots: number) => {
      if (
        !hasPresetOptions ||
        spanSlots < MIN_SPAN_SLOTS ||
        spanSlots > maxPresetSpanSlots ||
        spanSlots % HOUR_SPAN_STEPS !== 0
      )
        return
      const maxStart = slots.length - 1 - spanSlots
      const startI = Math.max(0, Math.min(Math.round(maxStart / 2), maxStart))
      const endI = startI + spanSlots
      const sh = slots[startI].hm
      const eh = slots[endI].hm
      setLockedSpanSlots(spanSlots)
      setPick(null)
      if (onSetDjRange) onSetDjRange(sh, eh)
      else {
        onSetStartTime(sh)
        onSetEndTime(eh)
      }
    },
    [
      hasPresetOptions,
      maxPresetSpanSlots,
      slots,
      onSetDjRange,
      onSetStartTime,
      onSetEndTime,
    ],
  )

  const onSegTap = useCallback(
    (index: number) => {
      if (pick === null) {
        setPick(index)
        return
      }
      if (pick === index) {
        setPick(null)
        return
      }
      applyRange(pick, index)
    },
    [pick, applyRange],
  )

  const commitStartIdx = useCallback(
    (idx: number) => {
      const n = slots.length
      const maxIdx = n - 1
      if (rangeValid && idx >= endIdx) {
        let s = Math.min(idx, Math.max(0, n - 1 - MIN_SPAN_SLOTS))
        let e = s + MIN_SPAN_SLOTS
        e = snapEndIdxForFixedStart(s, e, maxIdx)
        if (e - s < MIN_SPAN_SLOTS) return
        const sh = slots[s].hm
        const eh = slots[e].hm
        if (onSetDjRange) onSetDjRange(sh, eh)
        else {
          onSetStartTime(sh)
          onSetEndTime(eh)
        }
        return
      }
      if (rangeValid) {
        const s = snapStartIdxForFixedEnd(idx, endIdx)
        onSetStartTime(slots[s].hm)
        return
      }
      const clamped = Math.max(0, Math.min(idx, n - 1 - MIN_SPAN_SLOTS))
      if (!setEndTime.trim()) {
        const e = snapEndIdxForFixedStart(clamped, clamped + MIN_SPAN_SLOTS, maxIdx)
        const sh = slots[clamped].hm
        const eh = slots[e].hm
        if (onSetDjRange) onSetDjRange(sh, eh)
        else {
          onSetStartTime(sh)
          onSetEndTime(eh)
        }
        return
      }
      onSetStartTime(slots[clamped].hm)
    },
    [slots, rangeValid, endIdx, setEndTime, onSetDjRange, onSetStartTime, onSetEndTime],
  )

  const commitEndIdx = useCallback(
    (idx: number) => {
      const maxIdx = slots.length - 1
      if (!rangeValid && !setStartTime.trim()) {
        const clamped = Math.max(MIN_SPAN_SLOTS, Math.min(idx, maxIdx))
        let s = clamped - MIN_SPAN_SLOTS
        let e = clamped
        e = snapEndIdxForFixedStart(s, e, maxIdx)
        s = e - MIN_SPAN_SLOTS
        if (s < 0) return
        const sh = slots[s].hm
        const eh = slots[e].hm
        if (onSetDjRange) onSetDjRange(sh, eh)
        else {
          onSetStartTime(sh)
          onSetEndTime(eh)
        }
        return
      }
      if (rangeValid && idx <= startIdx) {
        const e = snapEndIdxForFixedStart(
          startIdx,
          Math.min(maxIdx, Math.max(startIdx + MIN_SPAN_SLOTS, idx + MIN_SPAN_SLOTS)),
          maxIdx,
        )
        onSetEndTime(slots[e].hm)
        return
      }
      if (rangeValid) {
        const e = snapEndIdxForFixedStart(startIdx, idx, maxIdx)
        onSetEndTime(slots[e].hm)
        return
      }
      const clamped = Math.max(MIN_SPAN_SLOTS, Math.min(idx, maxIdx))
      onSetEndTime(slots[clamped].hm)
    },
    [slots, rangeValid, startIdx, setStartTime, onSetDjRange, onSetStartTime, onSetEndTime],
  )

  useEffect(() => {
    if (!dragging || !trackRef.current || span === null) return
    const tr = trackRef.current

    if (dragging === 'range') {
      const start = rangeDragRef.current
      if (!start) return
      const onMove = (e: PointerEvent) => {
        const rect = tr.getBoundingClientRect()
        const deltaX = e.clientX - start.startX
        const deltaRatio = rect.width > 0 ? deltaX / rect.width : 0
        const deltaOffsetMin = deltaRatio * span
        const deltaSlots = Math.round(deltaOffsetMin / SLOT_STEP_MIN)
        const spanSlots = start.spanSlots
        const newStart = Math.max(0, Math.min(start.startIdx + deltaSlots, slots.length - 1 - spanSlots))
        const newEnd = newStart + spanSlots
        const sh = slots[newStart].hm
        const eh = slots[newEnd].hm
        if (onSetDjRange) onSetDjRange(sh, eh)
        else {
          onSetStartTime(sh)
          onSetEndTime(eh)
        }
      }
      const onUp = () => {
        rangeDragRef.current = null
        setDragging(null)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      window.addEventListener('pointercancel', onUp)
      return () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        window.removeEventListener('pointercancel', onUp)
      }
    }

    const onMove = (e: PointerEvent) => {
      const idx = nearestSlotIndex(e.clientX, tr, slots, span)
      if (dragging === 'start') commitStartIdx(idx)
      else commitEndIdx(idx)
    }

    const onUp = () => setDragging(null)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [dragging, slots, span, commitStartIdx, commitEndIdx, onSetDjRange, onSetStartTime, onSetEndTime])

  const onTrackPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('[data-dj-handle]')) return
      if ((e.target as HTMLElement).closest('[data-dj-range]')) return
      if (!trackRef.current || span === null) return
      const idx = nearestSlotIndex(e.clientX, trackRef.current, slots, span)
      onSegTap(idx)
    },
    [span, slots, onSegTap],
  )

  const showSlotUi = slots.length >= 3

  if (!showSlotUi) {
    return (
      <div className="space-y-3">
        <p className="text-[11px] leading-snug text-neutral-500">
          Set both event start and end above. You’ll get a timeline to place the DJ set.
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
          <IntakeQuarterHourTimeField
            id={`${uid}-set-start-fallback`}
            label="Set start"
            value={setStartTime}
            onChange={onSetStartTime}
            labelClassName="text-neutral-400 text-[11px] leading-none"
          />
          <IntakeQuarterHourTimeField
            id={`${uid}-set-end-fallback`}
            label="Set end"
            value={setEndTime}
            onChange={onSetEndTime}
            labelClassName="text-neutral-400 text-[11px] leading-none"
          />
        </div>
      </div>
    )
  }

  const spanSafe = span ?? 1
  const startPct = rangeValid
    ? pctForSlotIndex(slots, spanSafe, startIdx)
    : pick !== null
      ? pctForSlotIndex(slots, spanSafe, pick)
      : null
  const endPct = rangeValid ? pctForSlotIndex(slots, spanSafe, endIdx) : null

  const trueRangePct =
    rangeValid && startPct !== null && endPct !== null
      ? Math.max(endPct - startPct, 0.35)
      : 0
  const hitRangePct =
    rangeValid && trueRangePct > 0 ? Math.max(trueRangePct, MIN_RANGE_DRAG_HIT_PCT) : 0
  let hitLeftPct = 0
  if (rangeValid && startPct !== null && endPct !== null && hitRangePct > 0) {
    hitLeftPct = startPct + (trueRangePct - hitRangePct) / 2
    hitLeftPct = Math.max(0, Math.min(hitLeftPct, 100 - hitRangePct))
  }
  const innerRangeVisualPct =
    hitRangePct > 0 ? Math.min(100, (trueRangePct / hitRangePct) * 100) : 100
  const narrowHandleStrip = trueRangePct > 0 && trueRangePct < MIN_RANGE_DRAG_HIT_PCT

  const showStartHandle = rangeValid || pick !== null
  const showEndHandle = rangeValid

  const statusLine = (() => {
    if (rangeValid) {
      return `${formatHm12(setStartTime)} – ${formatHm12(setEndTime)}`
    }
    if (pick !== null) {
      return `${formatHm12(slots[pick]?.hm ?? '')} · tap again for end`
    }
    return 'Drag handles or the bar between them, or tap the track twice'
  })()

  const canClear =
    rangeValid || pick !== null || setStartTime.trim() !== '' || setEndTime.trim() !== ''

  return (
    <div
      className={cn(
        'rounded-lg border border-white/[0.07] bg-neutral-950/60 p-3 sm:p-3.5',
        'motion-safe:transition-[box-shadow] motion-safe:duration-200',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {hasPresetOptions ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-[9px] font-medium uppercase tracking-wide text-neutral-600">Duration</span>
              <div className="flex flex-wrap items-center gap-1">
                {hourChipValues.map(q => {
                  const spanSlots = q * HOUR_SPAN_STEPS
                  const active = rangeValid && endIdx - startIdx === spanSlots
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => applyDurationPreset(spanSlots)}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-[10px] font-medium tabular-nums transition-colors',
                        active
                          ? 'border-white/20 bg-white/[0.12] text-neutral-100'
                          : 'border-white/[0.08] bg-neutral-950/50 text-neutral-400 hover:border-white/[0.12] hover:bg-white/[0.05] hover:text-neutral-200',
                      )}
                    >
                      {formatSetLengthDisplay(q)}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <p className="pr-1 text-[10px] leading-snug text-neutral-600">
              Event window is under an hour — use the handles or tap the track twice to set length.
            </p>
          )}
        </div>
        <button
          type="button"
          aria-label="Clear DJ set times"
          disabled={!canClear}
          className={cn(
            'shrink-0 rounded-md p-1.5 text-neutral-500 transition-colors',
            'hover:bg-white/[0.06] hover:text-neutral-200',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400',
            'disabled:pointer-events-none disabled:opacity-30',
          )}
          onClick={() => {
            setPick(null)
            setDragging(null)
            setLockedSpanSlots(null)
            rangeDragRef.current = null
            if (onSetDjRange) onSetDjRange('', '')
            else {
              onSetStartTime('')
              onSetEndTime('')
            }
          }}
        >
          <Eraser className="h-4 w-4" strokeWidth={1.75} aria-hidden />
        </button>
      </div>

      <div
        ref={trackRef}
        role="group"
        aria-label={
          slots.length >= 2
            ? `DJ set time range within ${formatHm12(slots[0].hm)}–${formatHm12(slots[slots.length - 1].hm)}. Exact set times are in the summary below.`
            : 'DJ set time range'
        }
        className="relative h-[5.625rem] w-full min-w-0 cursor-pointer touch-none"
        onPointerDown={onTrackPointerDown}
      >
        <div
          className="pointer-events-none absolute left-0 right-0 top-[0.2rem] z-[1] h-7 sm:h-8"
          aria-hidden
        >
          {rulerMarks.map(i => {
            const slot = slots[i]
            if (!slot) return null
            const pct = pctForSlotIndex(slots, spanSafe, i)
            const isFirst = i === 0
            const isLast = i === slots.length - 1
            const label = formatHm12HourOnly(slot.hm)
            return (
              <div
                key={`ruler-${slot.hm}-${i}`}
                className={cn(
                  'absolute top-0 flex max-w-[36%] flex-col items-center',
                  isFirst && 'left-0 items-start',
                  isLast && !isFirst && 'right-0 left-auto items-end',
                  !isFirst && !isLast && '-translate-x-1/2',
                )}
                style={!isFirst && !isLast ? { left: `${pct}%` } : undefined}
              >
                <span className="whitespace-nowrap text-[8px] font-medium tabular-nums leading-none text-neutral-500 sm:text-[9px]">
                  {label}
                </span>
                <span
                  className={cn(
                    'mt-1 block w-px shrink-0 bg-white/35',
                    isFirst && 'ml-0.5 h-2.5 self-start',
                    isLast && !isFirst && 'mr-0.5 h-2.5 self-end',
                    !isFirst && !isLast && 'h-2.5',
                  )}
                />
              </div>
            )
          })}
        </div>

        <div
          className="pointer-events-none absolute left-0 right-0 top-1/2 h-[1.125rem] -translate-y-1/2 rounded-full ring-1 ring-inset ring-black/25"
          style={{ background: DJ_THERMAL_RAIL_GRADIENT }}
          aria-hidden
        />

        {rangeValid && startPct !== null && endPct !== null ? (
          <div
            aria-label="Move entire DJ set block (drag here; ends resize length)"
            data-dj-range
            title="Drag to slide the set; drag the white ends to change length"
            className={cn(
              'absolute top-1/2 z-[5] flex min-h-[1.75rem] -translate-y-1/2 cursor-grab items-center justify-center rounded-full touch-none active:cursor-grabbing',
              dragging === 'range' && 'motion-safe:ring-1 motion-safe:ring-white/25',
            )}
            style={{
              left: `${hitLeftPct}%`,
              width: `${hitRangePct}%`,
            }}
            onPointerDown={e => {
              e.stopPropagation()
              e.preventDefault()
              setLockedSpanSlots(endIdx - startIdx)
              rangeDragRef.current = {
                startX: e.clientX,
                startIdx,
                spanSlots: endIdx - startIdx,
              }
              setDragging('range')
              setPick(null)
            }}
          >
            <div
              className="pointer-events-none h-[1.125rem] max-w-full shrink-0 rounded-full border-2 border-white/85 bg-white/18 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]"
              style={{ width: `${innerRangeVisualPct}%` }}
              aria-hidden
            />
          </div>
        ) : null}

        {pick !== null && !rangeValid && startPct !== null ? (
          <div
            className="pointer-events-none absolute top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500"
            style={{ left: `${startPct}%` }}
          />
        ) : null}

        {showStartHandle && startPct !== null ? (
          <button
            type="button"
            data-dj-handle="start"
            aria-label={`Set start ${formatHm12(rangeValid ? setStartTime : pick !== null ? slots[pick].hm : '')}`}
            className={cn(
              'absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center',
              narrowHandleStrip ? 'h-10 w-6' : 'h-12 w-9',
              'touch-none outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-md',
            )}
            style={{ left: `${startPct}%` }}
            onPointerDown={e => {
              e.stopPropagation()
              e.preventDefault()
              setLockedSpanSlots(null)
              setDragging('start')
              setPick(null)
            }}
          >
            <span
              className={cn(
                'rounded-md border border-neutral-950 bg-neutral-100 shadow-sm',
                narrowHandleStrip ? 'h-4 w-2.5' : 'h-5 w-3',
                dragging === 'start' && 'motion-safe:scale-105',
              )}
            />
          </button>
        ) : null}

        {showEndHandle && endPct !== null ? (
          <button
            type="button"
            data-dj-handle="end"
            aria-label={`Set end ${formatHm12(setEndTime)}`}
            className={cn(
              'absolute top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center',
              narrowHandleStrip ? 'h-10 w-6' : 'h-12 w-9',
              'touch-none outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 rounded-md',
            )}
            style={{ left: `${endPct}%` }}
            onPointerDown={e => {
              e.stopPropagation()
              e.preventDefault()
              setLockedSpanSlots(null)
              setDragging('end')
              setPick(null)
            }}
          >
            <span
              className={cn(
                'rounded-md border border-neutral-950 bg-neutral-100 shadow-sm',
                narrowHandleStrip ? 'h-4 w-2.5' : 'h-5 w-3',
                dragging === 'end' && 'motion-safe:scale-105',
              )}
            />
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex min-h-[2.5rem] items-stretch gap-0 overflow-hidden rounded-md border border-white/[0.06] bg-neutral-950/45">
        <div className="min-w-0 flex-[2] border-r border-white/[0.06] px-2 py-1.5 sm:px-2.5">
          <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-600">Set</p>
          <p
            className={cn(
              'mt-0.5 text-[11px] tabular-nums leading-snug sm:whitespace-nowrap',
              pick !== null && !rangeValid ? 'text-amber-500/90' : 'text-neutral-300',
            )}
            title={!rangeValid && pick === null ? statusLine : undefined}
          >
            {statusLine}
          </p>
        </div>
        <div className="min-w-0 flex-1 px-2 py-1.5 text-right sm:px-2.5">
          <p className="text-[9px] font-medium uppercase tracking-wide text-neutral-600">Length</p>
          <p className="mt-0.5 text-[11px] font-medium tabular-nums text-neutral-200">{setLengthDisplay}</p>
        </div>
      </div>
    </div>
  )
}
