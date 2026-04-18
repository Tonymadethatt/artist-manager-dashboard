import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ChevronsUpDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CONTACT_TITLE_GROUPS, CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'
import { cn } from '@/lib/utils'

function titleKeyMatchesFilter(key: ContactTitleKey, filterRaw: string): boolean {
  const q = filterRaw.trim().toLowerCase()
  if (!q) return true
  const label = CONTACT_TITLE_LABELS[key].toLowerCase()
  if (label.startsWith(q)) return true
  if (label.includes(q)) return true
  const compactKey = key.replace(/_/g, ' ').toLowerCase()
  if (compactKey.includes(q)) return true
  return false
}

export function ContactTitleSelect({
  value,
  onValueChange,
  placeholder = 'Select title',
  disabled,
  triggerClassName,
  allowEmpty = false,
}: {
  value: string | null | undefined
  onValueChange: (key: ContactTitleKey | '') => void
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
  /** When true, first option clears the title (emits ''). */
  allowEmpty?: boolean
}) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const v = value && value in CONTACT_TITLE_LABELS ? (value as ContactTitleKey) : ''
  const selectedLabel = v ? CONTACT_TITLE_LABELS[v] : ''

  const filteredGroups = useMemo(() => {
    return CONTACT_TITLE_GROUPS.map(g => ({
      label: g.label,
      keys: g.keys.filter(k => titleKeyMatchesFilter(k, query)),
    })).filter(g => g.keys.length > 0)
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
  }, [open, v])

  const displayInputValue = open ? query : selectedLabel

  const commit = useCallback(
    (k: ContactTitleKey | '') => {
      onValueChange(k)
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
          className="h-full min-h-0 w-8 shrink-0 self-stretch rounded-none border-l border-neutral-700 text-neutral-400 hover:text-neutral-100"
          aria-label="Open title list"
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
          {allowEmpty ? (
            <button
              type="button"
              role="option"
              className="w-full px-2 py-1.5 text-left text-xs text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"
              onClick={() => commit('')}
            >
              —
            </button>
          ) : null}
          {filteredGroups.map(g => (
            <div key={g.label} className="py-0.5">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                {g.label}
              </div>
              {g.keys.map(k => {
                const on = k === v
                return (
                  <button
                    key={k}
                    type="button"
                    role="option"
                    aria-selected={on}
                    className={cn(
                      'w-full px-2 py-1.5 text-left text-xs text-neutral-200 hover:bg-neutral-800',
                      on && 'bg-neutral-800/80 text-white',
                    )}
                    onClick={() => commit(k)}
                  >
                    {CONTACT_TITLE_LABELS[k]}
                  </button>
                )
              })}
            </div>
          ))}
          {filteredGroups.length === 0 ? (
            <div className="px-2 py-2 text-xs text-neutral-500">No matching titles</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
