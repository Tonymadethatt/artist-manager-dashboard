import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VENUE_TYPE_GROUPS } from '@/lib/venue/venueTypeGroups'
import type { VenueType } from '@/types'
import { VENUE_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

function entityTypeMatchesFilter(t: VenueType, filterRaw: string): boolean {
  const q = filterRaw.trim().toLowerCase()
  if (!q) return true
  const label = VENUE_TYPE_LABELS[t].toLowerCase()
  if (label.startsWith(q)) return true
  if (label.includes(q)) return true
  const slug = t.replace(/_/g, ' ').toLowerCase()
  if (slug.includes(q)) return true
  return false
}

export function EntityTypeSelect({
  value,
  onValueChange,
  placeholder = 'Select entity type',
  disabled,
  triggerClassName,
  allowEmpty = false,
  /** When set, first row clears the value (emits ''). */
  emptyLabel = '—',
  variant = 'pick',
  allLabel = 'All types',
}: {
  value: VenueType | '' | 'all'
  onValueChange: (v: VenueType | '' | 'all') => void
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  allowEmpty?: boolean
  emptyLabel?: string
  /** `filter`: value may be `all` for Contacts list filters. */
  variant?: 'pick' | 'filter'
  allLabel?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const selectedType: VenueType | null =
    value !== 'all' && value !== '' && value in VENUE_TYPE_LABELS ? (value as VenueType) : null

  const selectedLabel =
    value === 'all' ? allLabel : selectedType ? VENUE_TYPE_LABELS[selectedType] : ''

  const filteredGroups = useMemo(() => {
    return VENUE_TYPE_GROUPS.map(g => ({
      label: g.label,
      types: g.types.filter(t => entityTypeMatchesFilter(t, query)),
    })).filter(g => g.types.length > 0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current
      if (el && !el.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useLayoutEffect(() => {
    if (!open) setQuery('')
  }, [open, selectedType])

  const displayInputValue = open ? query : selectedLabel

  const commit = useCallback(
    (next: VenueType | '' | 'all') => {
      onValueChange(next)
      setOpen(false)
      setQuery('')
    },
    [onValueChange],
  )

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div
        className={cn(
          'flex w-full min-w-0 min-h-8 items-stretch overflow-hidden rounded-md border border-neutral-700 bg-neutral-800',
          triggerClassName,
        )}
      >
        <Input
          id={listId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          disabled={disabled}
          className="h-full min-h-0 flex-1 min-w-0 rounded-none border-0 bg-transparent px-2.5 py-1 text-xs text-neutral-100 shadow-none placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-sm"
          value={displayInputValue}
          placeholder={variant === 'filter' && value === 'all' ? allLabel : placeholder}
          onChange={e => {
            setQuery(e.target.value)
            if (!open) setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
            setQuery('')
          }}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
              setQuery('')
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled={disabled}
          className="h-full min-h-0 w-8 shrink-0 self-stretch rounded-none border-l border-neutral-700 text-neutral-400 hover:text-neutral-100"
          aria-label="Open entity type list"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setOpen(o => !o)
            setQuery('')
          }}
        >
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden />
        </Button>
      </div>
      {open ? (
        <div
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-md"
          onMouseDown={e => e.preventDefault()}
        >
          {variant === 'filter' ? (
            <button
              type="button"
              role="option"
              className={cn(
                'w-full px-2 py-1.5 text-left text-xs hover:bg-neutral-800',
                value === 'all' ? 'bg-neutral-800/80 text-white' : 'text-neutral-200',
              )}
              onClick={() => commit('all')}
            >
              {allLabel}
            </button>
          ) : null}
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              className="w-full px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              onClick={() => commit('')}
            >
              {emptyLabel}
            </button>
          ) : null}
          {filteredGroups.map(g => (
            <div key={g.label} className="py-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{g.label}</div>
              {g.types.map(t => {
                const on = t === selectedType
                return (
                  <button
                    key={t}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={cn(
                      'w-full px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800',
                      on && 'bg-neutral-800/80 text-white',
                    )}
                    onClick={() => commit(t)}
                  >
                    {VENUE_TYPE_LABELS[t]}
                  </button>
                )
              })}
            </div>
          ))}
          {filteredGroups.length === 0 ? (
            <div className="px-2 py-2 text-xs text-neutral-500">No matching types</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
