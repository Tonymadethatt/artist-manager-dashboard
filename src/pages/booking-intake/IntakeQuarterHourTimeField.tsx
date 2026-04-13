import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { INTAKE_HOUR_ONLY_TIMES, INTAKE_QUARTER_HOUR_TIMES } from '@/lib/intake/quarterHourTimes'

function formatHm12(hm: string): string {
  const t = hm.trim()
  if (!t) return 'Select'
  const [hs, ms] = t.split(':')
  const h = Number(hs)
  const m = Number(ms)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t
  const mod = h % 12 || 12
  const ampm = h < 12 ? 'AM' : 'PM'
  return `${mod}:${String(m).padStart(2, '0')} ${ampm}`
}

/** Match stored value to a grid option (handles `9:00` vs `09:00`, ignores trailing seconds). */
function matchTimeToGridOption(raw: string, grid: string[]): string | null {
  const t = raw.trim()
  if (!t) return null
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return null
  const cand = `${m[1].padStart(2, '0')}:${m[2]}`
  return grid.includes(cand) ? cand : null
}

export function IntakeQuarterHourTimeField({
  label,
  value,
  onChange,
  id,
  allowClear = false,
  hourGrid = false,
  labelClassName = 'text-neutral-400 text-xs',
  triggerClassName,
}: {
  label: string
  value: string
  onChange: (hm: string) => void
  id: string
  allowClear?: boolean
  /** When true, only top-of-hour options (e.g. DJ set billing in whole hours). */
  hourGrid?: boolean
  labelClassName?: string
  /** e.g. h-11 for 3A to match other selects */
  triggerClassName?: string
}) {
  const times = hourGrid ? INTAKE_HOUR_ONLY_TIMES : INTAKE_QUARTER_HOUR_TIMES
  const display = value.trim() ? formatHm12(value) : allowClear ? 'Time' : 'Select time'
  const [menuOpen, setMenuOpen] = useState(false)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const selectedGridValue = useMemo(() => matchTimeToGridOption(value, times), [value, times])

  const scrollSelectedIntoView = useCallback((): boolean => {
    const key = selectedGridValue
    const viewport = scrollViewportRef.current
    if (!key || !viewport) return false
    const slug = key.replace(':', '-')
    const item =
      document.getElementById(`${id}-opt-${slug}`) ??
      viewport.querySelector<HTMLElement>(`[data-time-slot="${CSS.escape(key)}"]`)
    if (!item || !viewport.contains(item)) return false
    const iRect = item.getBoundingClientRect()
    const vRect = viewport.getBoundingClientRect()
    const delta =
      iRect.top - vRect.top - viewport.clientHeight / 2 + iRect.height / 2
    viewport.scrollTop = Math.max(0, viewport.scrollTop + delta)
    item.focus({ preventScroll: true })
    return true
  }, [id, selectedGridValue])

  /** After Radix focuses the first item (scrolls to 12am), re-scroll to the current value. */
  useLayoutEffect(() => {
    if (!menuOpen || !selectedGridValue) return
    const t = window.setTimeout(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollSelectedIntoView()
        })
      })
    }, 0)
    return () => window.clearTimeout(t)
  }, [menuOpen, selectedGridValue, scrollSelectedIntoView])

  return (
    <div className="space-y-1">
      <Label htmlFor={id} className={cn(labelClassName, 'block leading-none')}>
        {label}
      </Label>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            className={cn(
              'h-10 w-full justify-between border-neutral-800 bg-neutral-950/80 px-2.5 text-sm font-normal tabular-nums text-neutral-100 hover:bg-neutral-900/80',
              !value.trim() && 'text-neutral-500',
              triggerClassName,
            )}
          >
            <span className="flex items-center gap-1.5 truncate">
              <Clock className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
              {display}
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-72 w-[var(--radix-dropdown-menu-trigger-width)] min-w-[10.5rem] overflow-hidden border-neutral-800 bg-neutral-950 p-0 shadow-xl"
        >
          <div
            ref={scrollViewportRef}
            className="max-h-64 overflow-y-auto overscroll-contain py-1"
          >
            {allowClear ? (
              <DropdownMenuItem
                onSelect={() => onChange('')}
                className={cn(
                  'rounded-none px-3 py-2 text-sm text-neutral-500 focus:bg-neutral-800 focus:text-neutral-300',
                  !value.trim() && 'bg-neutral-800/60',
                )}
              >
                —
              </DropdownMenuItem>
            ) : null}
            {times.map(t => (
              <DropdownMenuItem
                key={t}
                id={`${id}-opt-${t.replace(':', '-')}`}
                data-time-slot={t}
                onSelect={() => onChange(t)}
                className={cn(
                  'rounded-none px-3 py-2 text-sm tabular-nums text-neutral-200 focus:bg-neutral-800 focus:text-neutral-50',
                  t === selectedGridValue &&
                    'bg-neutral-100 text-neutral-950 focus:bg-neutral-100 focus:text-neutral-950',
                )}
              >
                {formatHm12(t)}
              </DropdownMenuItem>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
