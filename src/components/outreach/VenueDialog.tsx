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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { DealTerms, Venue, VenueType, OutreachStatus, OutreachTrack, TaskTemplate } from '@/types'
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER, OUTREACH_TRACK_LABELS, OUTREACH_TRACK_ORDER, VENUE_TYPE_ORDER, VENUE_TYPE_LABELS } from '@/types'

const VENUE_TYPES: { value: VenueType; label: string }[] = VENUE_TYPE_ORDER.map(value => ({
  value,
  label: VENUE_TYPE_LABELS[value],
}))

function normalizeDealTermsForSave(dt: DealTerms | null): DealTerms | null {
  if (!dt) return null
  const out: DealTerms = {}
  if (dt.event_date?.trim()) out.event_date = dt.event_date.trim()
  if (dt.pay != null && !Number.isNaN(dt.pay)) out.pay = dt.pay
  if (dt.set_length?.trim()) out.set_length = dt.set_length.trim()
  if (dt.load_in_time?.trim()) out.load_in_time = dt.load_in_time.trim()
  if (dt.notes?.trim()) out.notes = dt.notes.trim()
  return Object.keys(out).length > 0 ? out : null
}

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
  address_line2: '',
  region: '',
  postal_code: '',
  country: '',
  venue_type: 'other',
  priority: 3,
  status: 'not_contacted',
  outreach_track: 'pipeline',
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
        address_line2: initialData.address_line2 ?? '',
        region: initialData.region ?? '',
        postal_code: initialData.postal_code ?? '',
        country: initialData.country ?? '',
        venue_type: initialData.venue_type,
        priority: initialData.priority,
        status: initialData.status,
        outreach_track: initialData.outreach_track ?? 'pipeline',
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
      location: form.location?.trim() || null,
      city: form.city?.trim() || null,
      address_line2: form.address_line2?.trim() || null,
      region: form.region?.trim() || null,
      postal_code: form.postal_code?.trim() || null,
      country: form.country?.trim() || null,
      deal_terms: normalizeDealTermsForSave(form.deal_terms),
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
      <DialogContent className="max-w-lg max-h-[min(90vh,800px)] overflow-y-auto">
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

          <div className="space-y-1">
            <Label>Track</Label>
            <Select value={form.outreach_track} onValueChange={v => set('outreach_track', v as OutreachTrack)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OUTREACH_TRACK_ORDER.map(t => (
                  <SelectItem key={t} value={t}>{OUTREACH_TRACK_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-neutral-600 leading-snug">
              {form.outreach_track === 'pipeline'
                ? 'Pipeline — you sourced this venue. Commission applies to deals.'
                : 'Community — artist\'s existing network. Nurture work; base fee only.'}
            </p>
          </div>

          <div className="space-y-2 pt-0.5 border-t border-neutral-800">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Address</p>
            <p className="text-[11px] text-neutral-600 leading-snug">
              Use a postal-style address so Google Calendar can show a tappable map pin. Leave blank if unknown.
            </p>
            <div className="space-y-1">
              <Label htmlFor="v-street">Street address</Label>
              <Input
                id="v-street"
                value={form.location ?? ''}
                onChange={e => set('location', e.target.value)}
                placeholder="123 Main Street"
                autoComplete="street-address"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-line2">Apt, suite, floor (optional)</Label>
              <Input
                id="v-line2"
                value={form.address_line2 ?? ''}
                onChange={e => set('address_line2', e.target.value)}
                placeholder="2nd floor, Door B"
                autoComplete="address-line2"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-city">City</Label>
                <Input
                  id="v-city"
                  value={form.city ?? ''}
                  onChange={e => set('city', e.target.value)}
                  placeholder="Miami"
                  autoComplete="address-level2"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-region">State / province / region</Label>
                <Input
                  id="v-region"
                  value={form.region ?? ''}
                  onChange={e => set('region', e.target.value)}
                  placeholder="FL"
                  autoComplete="address-level1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-postal">ZIP / postal code</Label>
                <Input
                  id="v-postal"
                  value={form.postal_code ?? ''}
                  onChange={e => set('postal_code', e.target.value)}
                  placeholder="33101"
                  autoComplete="postal-code"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-country">Country (optional)</Label>
                <Input
                  id="v-country"
                  value={form.country ?? ''}
                  onChange={e => set('country', e.target.value)}
                  placeholder="United States"
                  autoComplete="country-name"
                />
              </div>
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

          <div className="space-y-2 pt-1 border-t border-neutral-800">
            <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">Booking terms (optional)</p>
            <p className="text-[11px] text-neutral-600 leading-snug">
              Saved on the venue for templates (e.g. {'{{event_date}}'}, {'{{artist_pay}}'}). You can edit later in the venue panel.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-dt-date">Event date</Label>
                <Input
                  id="v-dt-date"
                  type="date"
                  value={form.deal_terms?.event_date ?? ''}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      deal_terms: { ...(prev.deal_terms ?? {}), event_date: e.target.value || undefined },
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-dt-pay">Pay ($)</Label>
                <Input
                  id="v-dt-pay"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.deal_terms?.pay ?? ''}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      deal_terms: {
                        ...(prev.deal_terms ?? {}),
                        pay: e.target.value === '' ? undefined : Number(e.target.value),
                      },
                    }))
                  }
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="v-dt-set">Set length</Label>
                <Input
                  id="v-dt-set"
                  value={form.deal_terms?.set_length ?? ''}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      deal_terms: { ...(prev.deal_terms ?? {}), set_length: e.target.value || undefined },
                    }))
                  }
                  placeholder="45 min"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="v-dt-load">Load-in time</Label>
                <Input
                  id="v-dt-load"
                  value={form.deal_terms?.load_in_time ?? ''}
                  onChange={e =>
                    setForm(prev => ({
                      ...prev,
                      deal_terms: { ...(prev.deal_terms ?? {}), load_in_time: e.target.value || undefined },
                    }))
                  }
                  placeholder="6:00 PM"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="v-dt-notes">Notes</Label>
              <Textarea
                id="v-dt-notes"
                value={form.deal_terms?.notes ?? ''}
                onChange={e =>
                  setForm(prev => ({
                    ...prev,
                    deal_terms: { ...(prev.deal_terms ?? {}), notes: e.target.value || undefined },
                  }))
                }
                placeholder="Offer details…"
                className="min-h-[56px] text-sm"
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
