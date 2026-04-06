import { useMemo, useRef, useState, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { parseSlashMenu } from '@/lib/templates/parseSlashMenu'

interface VariableSlashTextareaProps {
  value: string
  onChange: (value: string) => void
  variableKeys: string[]
  placeholder?: string
  className?: string
  minHeightClass?: string
  /** Forwarded to the native textarea (e.g. 1 for compact single-line fields). */
  rows?: number
}

export function VariableSlashTextarea({
  value,
  onChange,
  variableKeys,
  placeholder,
  className,
  minHeightClass = 'min-h-[120px]',
  rows,
}: VariableSlashTextareaProps) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [menu, setMenu] = useState<{ start: number; filter: string } | null>(null)

  const syncMenu = useCallback((text: string, cursor: number) => {
    setMenu(parseSlashMenu(text, cursor))
  }, [])

  const filtered = useMemo(() => {
    const f = menu?.filter.toLowerCase() ?? ''
    return variableKeys.filter(k => f === '' || k.toLowerCase().includes(f))
  }, [menu, variableKeys])

  const pick = useCallback(
    (key: string) => {
      if (!menu || !taRef.current) return
      const cursor = taRef.current.selectionStart ?? value.length
      const before = value.slice(0, menu.start)
      const after = value.slice(cursor)
      const insert = `{{${key}}}`
      onChange(before + insert + after)
      setMenu(null)
      const pos = before.length + insert.length
      requestAnimationFrame(() => {
        const el = taRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(pos, pos)
        }
      })
    },
    [menu, onChange, value]
  )

  return (
    <div className="relative">
      <Textarea
        ref={taRef}
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={e => {
          const v = e.target.value
          onChange(v)
          syncMenu(v, e.target.selectionStart ?? v.length)
        }}
        onSelect={e => {
          const t = e.target as HTMLTextAreaElement
          syncMenu(t.value, t.selectionStart ?? 0)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            setMenu(null)
            return
          }
          if (menu && filtered.length > 0 && e.key === 'Enter') {
            e.preventDefault()
            pick(filtered[0]!)
          }
        }}
        onBlur={() => {
          window.setTimeout(() => setMenu(null), 150)
        }}
        className={cn(minHeightClass, 'text-sm leading-relaxed font-mono', className)}
      />
      {menu && filtered.length > 0 && (
        <div
          className="absolute z-50 left-0 right-0 mt-1 max-h-40 overflow-y-auto rounded-md border border-neutral-800 bg-neutral-900 shadow-lg py-1 text-left"
          role="listbox"
        >
          {filtered.slice(0, 60).map(k => (
            <button
              key={k}
              type="button"
              role="option"
              className="w-full px-2 py-1.5 text-left text-xs font-mono text-neutral-200 hover:bg-neutral-800"
              onMouseDown={e => e.preventDefault()}
              onClick={() => pick(k)}
            >
              {`{{${k}}}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
