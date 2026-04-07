import { ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { ProfileFieldPresetRow } from '@/hooks/useProfileFieldPresets'

const LABEL_MAX = 52

function menuLabel(full: string): string {
  const t = full.replace(/\s+/g, ' ').trim()
  if (t.length <= LABEL_MAX) return t
  return `${t.slice(0, LABEL_MAX)}…`
}

export function FieldWithPresets({
  value,
  onChange,
  onBlur,
  placeholder,
  type = 'text',
  multiline = false,
  rows = 2,
  presets,
  onApplyPreset,
  onDeletePreset,
  className,
}: {
  value: string
  onChange: (v: string) => void
  onBlur?: () => void /** react to blur on the input only */
  placeholder?: string
  type?: string
  multiline?: boolean
  rows?: number
  presets: ProfileFieldPresetRow[]
  onApplyPreset: (value: string) => void
  onDeletePreset: (id: string) => void
  className?: string
}) {
  const hasPresets = presets.length > 0

  const control = multiline ? (
    <Textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      rows={rows}
      className={cn('resize-none min-h-[4.5rem] flex-1 min-w-0', className)}
    />
  ) : (
    <Input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cn('flex-1 min-w-0', className)}
    />
  )

  return (
    <div className={cn('flex gap-1 items-stretch', multiline && 'items-start')}>
      {control}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className={cn('shrink-0 border-neutral-700 bg-neutral-800 text-neutral-300', multiline && 'mt-0')}
            disabled={!hasPresets}
            title={hasPresets ? 'Choose a saved value' : 'No saved values yet — save this field to add one'}
            aria-label="Open saved values"
          >
            <ChevronDown className="h-3.5 w-3.5 opacity-80" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[min(24rem,calc(100vw-2rem))] max-h-72 overflow-y-auto">
          <DropdownMenuLabel className="text-neutral-400 font-normal text-xs">Saved values</DropdownMenuLabel>
          {presets.map(p => (
            <DropdownMenuItem
              key={p.id}
              className="flex items-center gap-2 cursor-default pr-1"
              onSelect={e => {
                const el = e.target as HTMLElement
                if (el.closest('[data-delete-preset]')) {
                  e.preventDefault()
                  void onDeletePreset(p.id)
                  return
                }
                onApplyPreset(p.value)
              }}
            >
              <span className="truncate min-w-0 flex-1 text-left" title={p.value}>
                {menuLabel(p.value)}
              </span>
              <span
                data-delete-preset
                role="button"
                tabIndex={-1}
                aria-label="Remove from saved values"
                className="shrink-0 rounded p-1.5 text-neutral-500 hover:bg-neutral-800 hover:text-red-400 outline-none focus-visible:ring-1 focus-visible:ring-neutral-500"
              >
                <Trash2 className="h-3.5 w-3.5 pointer-events-none" />
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
