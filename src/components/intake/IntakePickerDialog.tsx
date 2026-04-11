import { useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { BookingIntakeRow, BookingIntakeShowRow } from '@/hooks/useBookingIntakes'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  /** venue: one tap picks intake. deal: pick intake then show draft. */
  mode: 'venue' | 'deal'
  intakes: BookingIntakeRow[]
  showsByIntake: Record<string, BookingIntakeShowRow[]>
  loading: boolean
  onPickVenue: (intakeId: string) => void
  onPickDeal: (intakeId: string, showId: string) => void
}

export function IntakePickerDialog({
  open,
  onOpenChange,
  title,
  mode,
  intakes,
  showsByIntake,
  loading,
  onPickVenue,
  onPickDeal,
}: Props) {
  const [search, setSearch] = useState('')
  const [dealStep, setDealStep] = useState<{ intakeId: string } | null>(null)

  const filtered = useMemo(() => {
    if (!search.trim()) return intakes
    const q = search.toLowerCase()
    return intakes.filter(i => i.title.toLowerCase().includes(q))
  }, [intakes, search])

  const showsForStep = dealStep ? showsByIntake[dealStep.intakeId] ?? [] : []

  return (
    <Dialog
      open={open}
      onOpenChange={v => {
        if (!v) setDealStep(null)
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md max-h-[min(80vh,28rem)] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto px-2 pb-4">
          {loading ? (
            <div className="flex justify-center py-12 text-neutral-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : mode === 'venue' ? (
            <ul className="space-y-0.5">
              {filtered.map(i => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-neutral-800 transition-colors"
                    onClick={() => {
                      onPickVenue(i.id)
                      onOpenChange(false)
                    }}
                  >
                    <span className="font-medium text-neutral-100">{i.title || 'Untitled'}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !dealStep ? (
            <ul className="space-y-0.5">
              {filtered.map(i => (
                <li key={i.id}>
                  <button
                    type="button"
                    className="w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-neutral-800 transition-colors"
                    onClick={() => {
                      const shows = showsByIntake[i.id] ?? []
                      if (shows.length === 0) return
                      if (shows.length === 1) {
                        onPickDeal(i.id, shows[0].id)
                        onOpenChange(false)
                        setDealStep(null)
                      } else {
                        setDealStep({ intakeId: i.id })
                      }
                    }}
                  >
                    <span className="font-medium text-neutral-100">{i.title || 'Untitled'}</span>
                    <span className="block text-[11px] text-neutral-500">
                      {(showsByIntake[i.id] ?? []).length} show draft
                      {(showsByIntake[i.id] ?? []).length !== 1 ? 's' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 -ml-1"
                onClick={() => setDealStep(null)}
              >
                ← Back to intakes
              </Button>
              <p className="text-[11px] text-neutral-500 px-1">Pick a show draft to import.</p>
              <ul className="space-y-0.5">
                {showsForStep.map(s => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={cn(
                        'w-full text-left rounded-lg px-3 py-2.5 text-sm hover:bg-neutral-800 transition-colors',
                        s.imported_deal_id && 'opacity-60',
                      )}
                      onClick={() => {
                        onPickDeal(dealStep.intakeId, s.id)
                        onOpenChange(false)
                        setDealStep(null)
                      }}
                    >
                      <span className="font-medium text-neutral-100">{s.label || 'Show'}</span>
                      {s.imported_deal_id ? (
                        <span className="block text-[10px] text-neutral-500">Previously linked to a deal</span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
