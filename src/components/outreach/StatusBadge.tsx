import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'
import type { OutreachStatus } from '@/types'
import { OUTREACH_STATUS_LABELS } from '@/types'

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
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge variant={STATUS_VARIANTS[status]} className={className}>
      {OUTREACH_STATUS_LABELS[status]}
    </Badge>
  )
}
