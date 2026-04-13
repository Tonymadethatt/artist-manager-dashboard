import type { ReactNode } from 'react'
import {
  CALL_VIBE_CHIP_META,
  CALL_VIBE_ORDER_NONEMPTY,
  type Phase1CallVibeV3,
} from '@/lib/intake/intakePayloadV3'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

/** Same yellow script treatment as the main live stack, for follow-up steps inside a section. */
export function IntakeInlineScriptBlock({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Script</h3>
      <div className="rounded-lg border border-white/[0.06] bg-neutral-950/55 px-3.5 py-3.5 sm:px-4 sm:py-4 text-base sm:text-lg font-medium leading-[1.65] text-yellow-100 [&_p]:m-0 [&_p]:text-inherit">
        {children}
      </div>
    </div>
  )
}

/** Live call: step title, then script, then fields (single scroll). */
export function IntakeLiveScriptCaptureStack({
  stepTitle,
  script,
  capture,
}: {
  stepTitle: string
  script: ReactNode
  capture: ReactNode
}) {
  return (
    <div className="space-y-0">
      <h2 className="text-lg font-semibold text-neutral-100 tracking-tight pb-1">{stepTitle}</h2>
      <section aria-label="Call script" className="space-y-2.5 pt-4 border-t border-white/[0.08]">
        <h3 className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">Script</h3>
        <div className="rounded-lg border border-white/[0.06] bg-neutral-950/55 px-3.5 py-3.5 sm:px-4 sm:py-4 text-lg sm:text-xl font-medium leading-[1.65] text-yellow-100 [&_p]:m-0 [&_p]:text-inherit">
          {script}
        </div>
      </section>
      <section aria-label="Form fields" className="pt-5 mt-5 border-t border-white/[0.08] space-y-3 min-w-0">
        <div className="space-y-3 min-w-0">{capture}</div>
      </section>
    </div>
  )
}

/** Call energy — emoji + one word per chip; values unchanged for schema / exports. */
export function IntakeCallVibeChips({
  value,
  onChange,
}: {
  value: Phase1CallVibeV3
  onChange: (v: Phase1CallVibeV3) => void
}) {
  return (
    <div
      role="group"
      aria-label="Call energy"
      className="grid w-full min-w-0 grid-cols-[repeat(auto-fill,minmax(4rem,1fr))] gap-1.5"
    >
      {CALL_VIBE_ORDER_NONEMPTY.map(key => {
        const { emoji, word } = CALL_VIBE_CHIP_META[key]
        const on = value === key
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? '' : key)}
            className={cn(
              'flex min-h-[3.25rem] w-full min-w-0 flex-col items-center justify-center gap-px rounded-md border px-1 py-1.5 text-center transition-colors',
              on
                ? 'border-neutral-200 bg-neutral-100 text-neutral-950 shadow-sm'
                : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:border-white/[0.12] hover:text-neutral-200',
            )}
          >
            <span className="text-lg leading-none" aria-hidden>
              {emoji}
            </span>
            <span className="text-[10px] font-medium leading-tight tracking-wide">{word}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Binary choice — compact, no full-width flex slabs (desktop intake). */
export function IntakeYesNoPair<T extends string>({
  value,
  onChange,
  yesValue,
  noValue,
  yesLabel,
  noLabel,
}: {
  value: T | ''
  onChange: (v: T) => void
  yesValue: T
  noValue: T
  yesLabel: string
  noLabel: string
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-white/[0.08] p-0.5 bg-neutral-900/50 gap-0.5"
      role="group"
      aria-label="Choice"
    >
      <button
        type="button"
        onClick={() => onChange(yesValue)}
        className={cn(
          'px-3 py-2 text-xs font-medium rounded-md transition-colors min-h-10',
          value === yesValue ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
        )}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(noValue)}
        className={cn(
          'px-3 py-2 text-xs font-medium rounded-md transition-colors min-h-10',
          value === noValue ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
        )}
      >
        {noLabel}
      </button>
    </div>
  )
}

/** Same-for-all vs per-show — compact two-way control. */
export function IntakeCompactDual({
  value,
  onChange,
  a,
  b,
}: {
  value: boolean
  onChange: (v: boolean) => void
  a: { id: string; label: string }
  b: { id: string; label: string }
}) {
  return (
    <div className="inline-flex rounded-lg border border-white/[0.08] overflow-hidden p-0.5 bg-neutral-900/50 gap-0.5">
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors min-h-9',
          !value ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
        )}
      >
        {a.label}
      </button>
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          'px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors min-h-9',
          value ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
        )}
      >
        {b.label}
      </button>
    </div>
  )
}

/** Conditional follow-up — inset panel when `open`. */
export function IntakeBranchPanel({ open, title, children }: { open: boolean; title: string; children: ReactNode }) {
  if (!open) return null
  return (
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 px-2.5 py-2.5 space-y-2">
      <p className="text-[10px] text-amber-200/80 uppercase tracking-wide font-medium leading-tight">{title}</p>
      {children}
    </div>
  )
}

/** Multi-select chips — compact footprint vs legacy IdChipRow. */
export function IntakeCompactChipRow<T extends string>({
  label,
  selected,
  ids,
  labels,
  onChange,
}: {
  label: string
  selected: T[]
  ids: readonly T[]
  labels: Record<T, string>
  onChange: (next: T[]) => void
}) {
  const toggle = (id: T) => {
    if (selected.includes(id)) onChange(selected.filter(x => x !== id))
    else onChange([...selected, id])
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-neutral-400 text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1">
        {ids.map(id => (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            className={cn(
              'min-h-[32px] px-2 text-xs font-medium rounded-md border transition-colors leading-tight',
              selected.includes(id)
                ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
            )}
          >
            {labels[id]}
          </button>
        ))}
      </div>
    </div>
  )
}
