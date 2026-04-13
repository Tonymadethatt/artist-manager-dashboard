import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CONTACT_TITLE_GROUPS, CONTACT_TITLE_LABELS, type ContactTitleKey } from '@/lib/contacts/contactTitles'
import { cn } from '@/lib/utils'

export function ContactTitleSelect({
  value,
  onValueChange,
  placeholder = 'Select title',
  disabled,
  triggerClassName,
}: {
  value: string | null | undefined
  onValueChange: (key: ContactTitleKey) => void
  placeholder?: string
  disabled?: boolean
  triggerClassName?: string
}) {
  const v = value && value in CONTACT_TITLE_LABELS ? value : undefined
  return (
    <Select
      value={v}
      disabled={disabled}
      onValueChange={k => onValueChange(k as ContactTitleKey)}
    >
      <SelectTrigger
        className={cn(
          'h-8 w-full min-w-[10rem] border-neutral-700 bg-neutral-800 text-neutral-100 text-xs',
          triggerClassName,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {CONTACT_TITLE_GROUPS.map(g => (
          <SelectGroup key={g.label}>
            <SelectLabel className="text-[10px] text-neutral-500">{g.label}</SelectLabel>
            {g.keys.map(k => (
              <SelectItem key={k} value={k} className="text-xs">
                {CONTACT_TITLE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
