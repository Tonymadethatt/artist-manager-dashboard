import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { IntakeVenuePickOptionV3 } from '@/lib/intake/intakePayloadV3'
import { cn } from '@/lib/utils'

function optionMatchesQuery(o: IntakeVenuePickOptionV3, filterRaw: string): boolean {
  const q = filterRaw.trim().toLowerCase()
  if (!q) return true
  if (o.label.toLowerCase().startsWith(q)) return true
  if (o.label.toLowerCase().includes(q)) return true
  if (o.id.toLowerCase().includes(q)) return true
  return false
}

export function Intake2aVenuePickCombobox({
  suggested,
  rest,
  valueId,
  disabled,
  popularHeading,
  onPickId,
  placeholder = 'Select entity type',
}: {
  suggested: IntakeVenuePickOptionV3[]
  rest: IntakeVenuePickOptionV3[]
  /** From `intakeVenuePickValueFromShow` (not `__custom__` / freeform). */
  valueId: string
  disabled?: boolean
  popularHeading: string
  onPickId: (id: string) => void
  placeholder?: string
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const allOptions = useMemo(() => [...suggested, ...rest], [suggested, rest])

  const selectedOption = useMemo(() => {
    if (!valueId || valueId === '__none__') return undefined
    return allOptions.find(o => o.id === valueId)
  }, [allOptions, valueId])

  const filteredSuggested = useMemo(
    () => suggested.filter(o => optionMatchesQuery(o, query)),
    [suggested, query],
  )
  const filteredRest = useMemo(() => rest.filter(o => optionMatchesQuery(o, query)), [rest, query])

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
  }, [open, valueId])

  const displayInputValue = open ? query : selectedOption?.label ?? ''

  const commit = useCallback(
    (id: string) => {
      onPickId(id)
      setOpen(false)
      setQuery('')
    },
    [onPickId],
  )

  const q = query.trim()
  const showGrouped = !q

  return (
    <div ref={rootRef} className="relative w-full min-w-0">
      <div className="flex w-full min-w-0 min-h-11 items-stretch overflow-hidden rounded-md border border-neutral-800 bg-neutral-950/80">
        <Input
          id={listId}
          role="combobox"
          aria-expanded={open}
          aria-controls={`${listId}-listbox`}
          aria-autocomplete="list"
          disabled={disabled}
          className="h-full min-h-0 flex-1 min-w-0 rounded-none border-0 bg-transparent px-3 py-2 text-sm text-neutral-100 shadow-none placeholder:text-neutral-500 focus-visible:ring-0 focus-visible:ring-offset-0"
          value={displayInputValue}
          placeholder={placeholder}
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
          className="h-full min-h-0 w-9 shrink-0 self-stretch rounded-none border-l border-neutral-800 text-neutral-400 hover:text-neutral-100"
          aria-label="Open entity type list"
          onMouseDown={e => e.preventDefault()}
          onClick={() => {
            setOpen(o => !o)
            setQuery('')
          }}
        >
          <ChevronsUpDown className="h-4 w-4 opacity-60" aria-hidden />
        </Button>
      </div>
      {open ? (
        <div
          id={`${listId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 py-1 shadow-md"
          onMouseDown={e => e.preventDefault()}
        >
          <button
            type="button"
            role="option"
            className="w-full px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
            onClick={() => commit('__none__')}
          >
            —
          </button>
          {showGrouped && filteredSuggested.length > 0 ? (
            <div className="py-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {popularHeading}
              </div>
              {filteredSuggested.map(o => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === valueId}
                  className={cn(
                    'w-full px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800',
                    o.id === valueId && 'bg-neutral-800/80 text-white',
                  )}
                  onClick={() => commit(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}
          {showGrouped && filteredSuggested.length > 0 && filteredRest.length > 0 ? (
            <div className="mx-2 h-px bg-neutral-800" />
          ) : null}
          {showGrouped && filteredRest.length > 0 ? (
            <div className="py-0.5">
              {filteredSuggested.length > 0 ? (
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                  More options
                </div>
              ) : null}
              {filteredRest.map(o => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === valueId}
                  className={cn(
                    'w-full px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800',
                    o.id === valueId && 'bg-neutral-800/80 text-white',
                  )}
                  onClick={() => commit(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}
          {!showGrouped ? (
            <div className="py-0.5">
              {[...filteredSuggested, ...filteredRest].map(o => (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={o.id === valueId}
                  className={cn(
                    'w-full px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800',
                    o.id === valueId && 'bg-neutral-800/80 text-white',
                  )}
                  onClick={() => commit(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}
          {filteredSuggested.length === 0 && filteredRest.length === 0 ? (
            <div className="px-2 py-2 text-xs text-neutral-500">No matching types</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
