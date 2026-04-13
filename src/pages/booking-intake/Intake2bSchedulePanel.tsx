import { DayPicker } from 'react-day-picker'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { computeSetLengthHours, formatSetLengthDisplay } from '@/lib/intake/intakePayloadV3'
import { IntakeDjSetSlotPicker } from '@/pages/booking-intake/IntakeDjSetSlotPicker'
import { IntakeQuarterHourTimeField } from '@/pages/booking-intake/IntakeQuarterHourTimeField'

function parseYmdLocal(ymd: string): Date | undefined {
  const t = ymd.trim()
  if (!t) return undefined
  const [y, m, d] = t.split('-').map(Number)
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return undefined
  return new Date(y, m - 1, d)
}

function toYmdLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function Intake2bSchedulePanel({
  eventDate,
  eventStartTime,
  eventEndTime,
  setStartTime,
  setEndTime,
  overnightEvent,
  overnightSet,
  onEventDate,
  onEventStartTime,
  onEventEndTime,
  onSetStartTime,
  onSetEndTime,
  onSetDjRange,
}: {
  eventDate: string
  eventStartTime: string
  eventEndTime: string
  setStartTime: string
  setEndTime: string
  overnightEvent: boolean
  overnightSet: boolean
  onEventDate: (ymd: string) => void
  onEventStartTime: (hm: string) => void
  onEventEndTime: (hm: string) => void
  onSetStartTime: (hm: string) => void
  onSetEndTime: (hm: string) => void
  /** Single patch for start+end (avoids stale merge when both change at once). */
  onSetDjRange?: (startHm: string, endHm: string) => void
}) {
  const selected = parseYmdLocal(eventDate)
  const defaultMonth = selected ?? new Date()

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
      <div className="shrink-0 lg:w-[min(100%,20.5rem)]">
        <Label className="mb-2 block text-neutral-400 text-xs">Event date</Label>
        <div
          className={cn(
            'rounded-xl border border-white/[0.08] bg-neutral-950/55 p-3 sm:p-4',
            '[--rdp-accent-color:theme(colors.neutral.100)]',
            '[--rdp-accent-background-color:rgba(255,255,255,0.1)]',
            '[--rdp-day_button-border-radius:0.375rem]',
            '[--rdp-day-height:2.5rem]',
            '[--rdp-day-width:2.5rem]',
            '[--rdp-day_button-height:2.375rem]',
            '[--rdp-day_button-width:2.375rem]',
            '[--rdp-nav-height:2.5rem]',
            '[--rdp-outside-opacity:0.35]',
            '[--rdp-weekday-opacity:0.55]',
          )}
        >
          <DayPicker
            mode="single"
            required={false}
            selected={selected}
            onSelect={d => {
              if (!d) return
              onEventDate(toYmdLocal(d))
            }}
            defaultMonth={defaultMonth}
            showOutsideDays
            className="w-full"
            classNames={{
              root: 'rdp-root w-full text-neutral-100',
              months: 'flex flex-col gap-3',
              month: 'w-full',
              month_caption: 'relative mb-3 flex h-9 items-center justify-center px-10 text-sm font-medium text-neutral-100',
              caption_label: 'text-sm font-medium',
              nav: 'absolute inset-x-0 top-0 flex items-center justify-between px-0',
              button_previous:
                'inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40',
              button_next:
                'inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/[0.08] bg-neutral-900/60 text-neutral-200 hover:bg-neutral-800 disabled:opacity-40',
              month_grid: 'w-full border-collapse',
              weekdays: 'mb-1 flex',
              weekday: 'w-10 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-500',
              week: 'mt-1 flex w-full',
              day: 'flex h-10 w-10 items-center justify-center p-0',
              day_button:
                'inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium text-neutral-200 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-400',
              /** RDP puts `text-neutral-200` on the button; cell bg alone won’t fix contrast — force label color on the button. */
              selected:
                '!bg-neutral-100 hover:!bg-neutral-200 focus-within:!bg-neutral-100 [&_button]:!text-neutral-950 [&_button]:!bg-transparent [&_button]:hover:!text-neutral-950 [&_button]:hover:!bg-transparent',
              today: 'font-semibold text-neutral-50',
              outside: 'text-neutral-600',
              disabled: 'opacity-30',
            }}
          />
        </div>
        {eventDate.trim() ? (
          <p className="mt-2 text-[11px] text-neutral-500">
            {parseYmdLocal(eventDate)?.toLocaleDateString(undefined, {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 space-y-4">
        <div className="rounded-lg border border-white/[0.06] bg-neutral-950/35 px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Event</p>
          <div className="grid gap-2.5 sm:grid-cols-2 sm:gap-3">
            <IntakeQuarterHourTimeField
              id="intake-event-start"
              label="Start"
              value={eventStartTime}
              onChange={onEventStartTime}
              labelClassName="text-neutral-400 text-[11px] leading-none"
            />
            <IntakeQuarterHourTimeField
              id="intake-event-end"
              label="End"
              value={eventEndTime}
              onChange={onEventEndTime}
              labelClassName="text-neutral-400 text-[11px] leading-none"
            />
          </div>
        </div>

        <div className="rounded-lg border border-white/[0.06] bg-neutral-950/35 px-3 py-2.5 sm:px-3.5 sm:py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
            DJ set
          </p>
          <IntakeDjSetSlotPicker
            eventStartTime={eventStartTime}
            eventEndTime={eventEndTime}
            overnightEvent={overnightEvent}
            setStartTime={setStartTime}
            setEndTime={setEndTime}
            setLengthDisplay={formatSetLengthDisplay(
              computeSetLengthHours(setStartTime, setEndTime, overnightSet),
            )}
            onSetStartTime={onSetStartTime}
            onSetEndTime={onSetEndTime}
            onSetDjRange={onSetDjRange}
          />
        </div>
      </div>
    </div>
  )
}
