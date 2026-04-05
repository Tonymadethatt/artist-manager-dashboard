import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useMetrics } from '@/hooks/useMetrics'
import { useDeals } from '@/hooks/useDeals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Metric, MetricCategory } from '@/types'
import { METRIC_CATEGORY_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const CATEGORY_BADGE: Record<MetricCategory, 'blue' | 'success' | 'purple'> = {
  brand_partnership: 'blue',
  event_attendance: 'success',
  press_mention: 'purple',
}

const CATEGORY_VALUE_LABEL: Record<MetricCategory, string> = {
  brand_partnership: 'Deal value ($)',
  event_attendance: 'Attendance (headcount)',
  press_mention: 'Estimated reach (audience size)',
}

const CATEGORY_TITLE_PLACEHOLDER: Record<MetricCategory, string> = {
  brand_partnership: 'e.g. Nike sponsorship',
  event_attendance: 'e.g. Blue Room show',
  press_mention: 'e.g. The Source Magazine',
}

const EMPTY_FORM = {
  date: new Date().toISOString().split('T')[0],
  category: 'brand_partnership' as MetricCategory,
  title: '',
  numeric_value: '',
  description: '',
  deal_id: '',
}

function fmtNum(n: number | null, category: MetricCategory) {
  if (n === null) return '—'
  if (category === 'brand_partnership') {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  }
  return n.toLocaleString()
}

const ALL = 'all' as const
type FilterCategory = MetricCategory | typeof ALL

export default function Metrics() {
  const { metrics, loading, addMetric, updateMetric, deleteMetric } = useMetrics()
  const { deals } = useDeals()
  const [filter, setFilter] = useState<FilterCategory>(ALL)
  const [addOpen, setAddOpen] = useState(false)
  const [editMetric, setEditMetric] = useState<Metric | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Metric | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const displayed = useMemo(() =>
    filter === ALL ? metrics : metrics.filter(m => m.category === filter),
    [metrics, filter]
  )

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditMetric(null)
    setAddOpen(true)
  }

  const openEdit = (m: Metric) => {
    setForm({
      date: m.date,
      category: m.category,
      title: m.title,
      numeric_value: m.numeric_value !== null ? String(m.numeric_value) : '',
      description: m.description ?? '',
      deal_id: m.deal_id ?? '',
    })
    setEditMetric(m)
    setAddOpen(true)
  }

  const setField = <K extends keyof typeof form>(key: K, val: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      date: form.date,
      category: form.category,
      title: form.title.trim(),
      numeric_value: form.numeric_value ? parseFloat(form.numeric_value) : null,
      description: form.description || null,
      deal_id: form.deal_id || null,
    }
    if (editMetric) {
      await updateMetric(editMetric.id, payload)
    } else {
      await addMetric(payload)
    }
    setSaving(false)
    setAddOpen(false)
  }

  const tabs: { value: FilterCategory; label: string }[] = [
    { value: ALL, label: 'All' },
    { value: 'brand_partnership', label: 'Brand Partnerships' },
    { value: 'event_attendance', label: 'Event Attendance' },
    { value: 'press_mention', label: 'Press Mentions' },
  ]

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Category tabs */}
      <div className="flex gap-1 border-b border-neutral-800">
        {tabs.map(tab => (
          <button
            key={tab.value}
            onClick={() => setFilter(tab.value)}
            className={cn(
              'px-3 py-2 text-xs font-medium transition-colors border-b-2 -mb-px',
              filter === tab.value
                ? 'border-neutral-300 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            {tab.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="pb-1 self-end">
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Log metric
          </Button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <p className="font-medium text-neutral-400 text-sm mb-1">No metrics logged yet</p>
          <p className="text-xs text-neutral-500 mb-4">Track brand partnerships, event attendance, and press mentions here.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>Log first metric</Button>
        </div>
      ) : (
        <div className="rounded border border-neutral-800 overflow-hidden bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950">
                <th className="text-left px-4 py-2.5 text-xs font-medium text-neutral-500">Title</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-neutral-500 hidden sm:table-cell">Category</th>
                <th className="text-right px-3 py-2.5 text-xs font-medium text-neutral-500">Value</th>
                <th className="text-left px-3 py-2.5 text-xs font-medium text-neutral-500 hidden md:table-cell">Date</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {displayed.map(m => (
                <tr key={m.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-100 leading-tight">{m.title}</div>
                    {m.description && (
                      <div className="text-xs text-neutral-500 mt-0.5 truncate max-w-[240px]">{m.description}</div>
                    )}
                    {m.deal && (
                      <div className="text-xs text-neutral-600 mt-0.5">↳ {m.deal.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <Badge variant={CATEGORY_BADGE[m.category]}>
                      {METRIC_CATEGORY_LABELS[m.category]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="font-medium text-neutral-200 tabular-nums">
                      {fmtNum(m.numeric_value, m.category)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs text-neutral-500 hidden md:table-cell">{m.date}</td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => setConfirmDelete(m)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editMetric ? 'Edit metric' : 'Log a metric'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={v => setField('category', v as MetricCategory)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="brand_partnership">Brand Partnership</SelectItem>
                    <SelectItem value="event_attendance">Event Attendance</SelectItem>
                    <SelectItem value="press_mention">Press Mention</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setField('date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder={CATEGORY_TITLE_PLACEHOLDER[form.category]}
                autoFocus
              />
            </div>

            <div className="space-y-1">
              <Label>{CATEGORY_VALUE_LABEL[form.category]}</Label>
              <Input
                type="number"
                min="0"
                step={form.category === 'brand_partnership' ? '0.01' : '1'}
                value={form.numeric_value}
                onChange={e => setField('numeric_value', e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="space-y-1">
              <Label>
                {form.category === 'press_mention' ? 'Link / notes' : 'Notes'}
              </Label>
              <Input
                value={form.description}
                onChange={e => setField('description', e.target.value)}
                placeholder={form.category === 'press_mention' ? 'https://…' : 'Additional context…'}
              />
            </div>

            {form.category === 'event_attendance' && (
              <div className="space-y-1">
                <Label>Linked deal (optional)</Label>
                <Select
                  value={form.deal_id || '__none__'}
                  onValueChange={v => setField('deal_id', v === '__none__' ? '' : v)}
                >
                  <SelectTrigger><SelectValue placeholder="No deal" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No deal</SelectItem>
                    {deals.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.description}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : editMetric ? 'Save changes' : 'Log metric'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete metric?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.title}</strong> will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={async () => {
                await deleteMetric(confirmDelete.id)
                setConfirmDelete(null)
              }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
