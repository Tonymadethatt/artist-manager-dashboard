import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { DealPickOption } from '@/lib/tasks/resolveDealIdForTemplateApply'

function formatDealLabel(d: DealPickOption): string {
  const parts = [d.description?.trim() || 'Deal']
  if (d.event_date) parts.push(d.event_date)
  return parts.filter(Boolean).join(' · ')
}

export function DealPickForTemplateDialog({
  open,
  title = 'Which deal should these tasks link to?',
  description,
  options,
  onPick,
  onCancel,
}: {
  open: boolean
  title?: string
  description?: string
  options: DealPickOption[]
  onPick: (dealId: string) => void
  onCancel: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {description && (
          <p className="text-sm text-neutral-500 leading-snug">{description}</p>
        )}
        <div className="flex flex-col gap-2 max-h-[min(280px,50vh)] overflow-y-auto">
          {options.map(o => (
            <Button
              key={o.id}
              type="button"
              variant="outline"
              className="justify-start h-auto py-2.5 px-3 text-left font-normal whitespace-normal"
              onClick={() => onPick(o.id)}
            >
              {formatDealLabel(o)}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
