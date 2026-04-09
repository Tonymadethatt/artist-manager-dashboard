import { useRef } from 'react'
import { Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ChooseCalendarDateFieldProps {
  value: string
  onChange: (next: string) => void
  buttonAriaLabel: string
  className?: string
}

/** Native date picker opened via `showPicker()` from a visible “Choose from calendar” control. */
export function ChooseCalendarDateField({
  value,
  onChange,
  buttonAriaLabel,
  className,
}: ChooseCalendarDateFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <div className={cn('w-full', className)}>
      <input
        ref={inputRef}
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
      <button
        type="button"
        className={cn(
          'flex min-h-[48px] w-full cursor-pointer items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm transition-colors',
          'hover:border-neutral-600 focus-visible:border-neutral-500 focus-visible:ring-1 focus-visible:ring-neutral-500 focus-visible:outline-none',
        )}
        onClick={() => {
          const el = inputRef.current
          if (!el) return
          try {
            void el.showPicker()
          } catch {
            el.focus()
            el.click()
          }
        }}
        aria-label={buttonAriaLabel}
      >
        <Calendar className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden />
        <span
          className={cn('flex-1 text-left', value.trim() ? 'text-white' : 'text-neutral-400')}
        >
          {value.trim()
            ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : 'Choose from calendar'}
        </span>
      </button>
    </div>
  )
}
