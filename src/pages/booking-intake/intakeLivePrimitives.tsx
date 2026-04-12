import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

export function IntakeScriptCaptureTabs({
  tab,
  onTabChange,
  script,
  capture,
}: {
  tab: 'script' | 'capture'
  onTabChange: (t: 'script' | 'capture') => void
  script: ReactNode
  capture: ReactNode
}) {
  return (
    <div className="space-y-3">
      <div className="flex rounded-lg border border-white/[0.08] p-0.5 bg-neutral-900/50 w-fit gap-0.5">
        <button
          type="button"
          onClick={() => onTabChange('script')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'script' ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
          )}
        >
          Script
        </button>
        <button
          type="button"
          onClick={() => onTabChange('capture')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            tab === 'capture' ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
          )}
        >
          Capture
        </button>
      </div>
      {tab === 'script' ? script : capture}
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
    <div className="rounded-lg border border-amber-900/40 bg-amber-950/15 px-3 py-3 space-y-3">
      <p className="text-[10px] text-amber-200/80 uppercase tracking-wide font-medium">{title}</p>
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
