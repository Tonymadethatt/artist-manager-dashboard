import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Venue, VenueType, OutreachStatus, TaskTemplate } from '@/types'
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER } from '@/types'

const VENUE_TYPES: { value: VenueType; label: string }[] = [
  { value: 'bar', label: 'Bar' },
  { value: 'club', label: 'Club' },
  { value: 'festival', label: 'Festival' },
  { value: 'theater', label: 'Theater' },
  { value: 'lounge', label: 'Lounge' },
  { value: 'other', label: 'Other' },
]

interface VenueDialogProps {
  open: boolean
  onClose: () => void
  onSave: (venue: Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<{ data?: Venue; error?: unknown }>
  initialData?: Venue
  templates?: TaskTemplate[]
  onApplyTemplate?: (templateId: string, venueId: string) => Promise<void>
}

const EMPTY: Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  name: '',
  location: '',
  city: '',
  venue_type: 'other',
  priority: 3,
  status: 'not_contacted',
  follow_up_date: null,
  deal_terms: null,
}

export function VenueDialog({ open, onClose, onSave, initialData, templates, onApplyTemplate }: VenueDialogProps) {
  const [form, setForm] = useState<Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'>>(EMPTY)
  const [selectedTemplate, setSelectedTemplate] = useState('__none__')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setForm(initialData ? {
        name: initialData.name,
        location: initialData.location ?? '',
        city: initialData.city ?? '',
        venue_type: initialData.venue_type,
        priority: initialData.priority,
        status: initialData.status,
        follow_up_date: initialData.follow_up_date,
        deal_terms: initialData.deal_terms,
      } : EMPTY)
      setSelectedTemplate('__none__')
      setError(null)
    }
  }, [open, initialData])

  const set = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Venue name is required.'); return }
    setSaving(true)
    const result = await onSave({
      ...form,
      name: form.name.trim(),
      location: form.location || null,
      city: form.city || null,
    })
    // Apply template if selected and we're adding (not editing)
    if (!initialData && selectedTemplate !== '__none__' && result?.data?.id && onApplyTemplate) {
      await onApplyTemplate(selectedTemplate, result.data.id)
    }
    setSaving(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initialData ? 'Edit venue' : 'Add venue'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="v-name">Venue name *</Label>
            <Input
              id="v-name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              placeholder="The Blue Room"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="v-city">City</Label>
              <Input
                id="v-city"
                value={form.city ?? ''}
                onChange={e => set('city', e.target.value)}
                placeholder="New York"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-location">Location / Address</Label>
              <Input
                id="v-location"
                value={form.location ?? ''}
                onChange={e => set('location', e.target.value)}
                placeholder="Brooklyn, NY"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Venue type</Label>
              <Select value={form.venue_type} onValueChange={v => set('venue_type', v as VenueType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {VENUE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set('status', v as OutreachStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTREACH_STATUS_ORDER.map(s => (
                    <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Priority (1–5)</Label>
              <Select value={String(form.priority)} onValueChange={v => set('priority', Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map(n => (
                    <SelectItem key={n} value={String(n)}>{n} star{n !== 1 ? 's' : ''}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="v-followup">Follow-up date</Label>
              <Input
                id="v-followup"
                type="date"
                value={form.follow_up_date ?? ''}
                onChange={e => set('follow_up_date', e.target.value || null)}
              />
            </div>
          </div>

          {/* Template picker — only shown when adding (not editing) */}
          {!initialData && templates && templates.length > 0 && (
            <div className="space-y-1 pt-1 border-t border-neutral-800">
              <Label>Apply task template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.items?.length ? ` (${t.items.length} tasks)` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-neutral-600">Creates tasks automatically when this venue is saved.</p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : initialData ? 'Save changes' : 'Add venue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
