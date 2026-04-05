import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { OutreachStatus } from '@/types'
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER } from '@/types'
import { ChevronDown } from 'lucide-react'

const STATUS_VARIANTS: Record<OutreachStatus, BadgeProps['variant']> = {
  not_contacted: 'secondary',
  reached_out: 'blue',
  in_discussion: 'warning',
  agreement_sent: 'purple',
  booked: 'success',
  rejected: 'destructive',
  archived: 'outline',
}

interface StatusBadgeProps {
  status: OutreachStatus
  className?: string
  onStatusChange?: (newStatus: OutreachStatus) => void
}

export function StatusBadge({ status, className, onStatusChange }: StatusBadgeProps) {
  const badge = (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {OUTREACH_STATUS_LABELS[status]}
      {onStatusChange && <ChevronDown className="h-2.5 w-2.5 ml-1 opacity-60" />}
    </Badge>
  )

  if (!onStatusChange) return badge

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
        <button className="focus:outline-none">{badge}</button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {OUTREACH_STATUS_ORDER.map(s => (
          <DropdownMenuItem
            key={s}
            onClick={e => { e.stopPropagation(); onStatusChange(s) }}
            className="gap-2"
          >
            <Badge variant={STATUS_VARIANTS[s]} className="text-[10px] px-1.5 py-0">
              {OUTREACH_STATUS_LABELS[s]}
            </Badge>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
