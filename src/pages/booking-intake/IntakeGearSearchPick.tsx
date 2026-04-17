import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { GearCompatTier } from '@/lib/gear/djGearCatalog'

function compatMark(tier: GearCompatTier): string {
  if (tier === 'yes') return '✅'
  if (tier === 'no') return '❌'
  return '⚠️'
}

export function IntakeGearSearchPick<T extends { id: string; display: string; compat: GearCompatTier }>({
  label,
  placeholder,
  valueId,
  rows,
  onPick,
  disabled,
  className,
}: {
  label: string
  placeholder: string
  valueId: string
  rows: readonly T[]
  onPick: (id: string) => void
  disabled?: boolean
  className?: string
}) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    const n = q.toLowerCase().replace(/\s+/g, ' ').trim()
    if (!n) return [...rows]
    return rows.filter(r => r.display.toLowerCase().includes(n) || r.id.toLowerCase().includes(n))
  }, [rows, q])

  const selected = valueId ? rows.find(r => r.id === valueId) : undefined

  return (
    <div className={cn('space-y-1.5 min-w-0 flex-1', className)}>
      <Label className="text-neutral-400 text-xs">{label}</Label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(o => !o)}
        className={cn(
          'flex h-11 w-full min-w-[140px] items-center rounded-lg border px-3 text-left text-sm transition-colors',
          disabled
            ? 'border-white/[0.06] bg-neutral-950/40 text-neutral-600 cursor-not-allowed'
            : 'border-neutral-800 bg-neutral-950/80 text-neutral-100 hover:border-white/15',
        )}
      >
        <span className="truncate">
          {selected ? (
            <>
              <span className="mr-1.5" aria-hidden>
                {compatMark(selected.compat)}
              </span>
              {selected.display}
            </>
          ) : (
            <span className="text-neutral-500">{placeholder}</span>
          )}
        </span>
      </button>
      {open && !disabled ? (
        <div className="rounded-lg border border-white/[0.08] bg-neutral-950/95 overflow-hidden shadow-lg z-10">
          <div className="relative border-b border-white/[0.06]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              className="h-10 pl-8 border-0 bg-transparent rounded-none focus-visible:ring-0 text-sm"
              placeholder="Filter…"
              value={q}
              onChange={e => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-40 overflow-y-auto divide-y divide-white/[0.06]">
            {filtered.length === 0 ? (
              <p className="p-2.5 text-xs text-neutral-500">No matches.</p>
            ) : (
              filtered.map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-neutral-800/80 transition-colors',
                    valueId === r.id && 'bg-neutral-800/50',
                  )}
                  onClick={() => {
                    onPick(r.id)
                    setOpen(false)
                    setQ('')
                  }}
                >
                  <span className="mr-1.5" aria-hidden>
                    {compatMark(r.compat)}
                  </span>
                  <span className="text-neutral-200">{r.display}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
