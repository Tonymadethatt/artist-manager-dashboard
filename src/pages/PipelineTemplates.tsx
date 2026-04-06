import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { ArrowLeft, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { TaskTemplate, TaskTemplateItem, TaskPriority, TaskRecurrence, VenueEmailType } from '@/types'
import { TASK_PRIORITY_LABELS, TASK_RECURRENCE_LABELS, OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER, VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-neutral-600',
}

const EMAIL_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: '__none__', label: 'None' },
  ...Object.entries(VENUE_EMAIL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
]

interface ItemFormState {
  title: string
  notes: string
  days_offset: string
  priority: TaskPriority
  recurrence: TaskRecurrence
  email_type: string
}

const EMPTY_ITEM: ItemFormState = {
  title: '',
  notes: '',
  days_offset: '0',
  priority: 'medium',
  recurrence: 'none',
  email_type: '__none__',
}

const EYEBROW = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-500'

function TemplateItemFormFields({
  itemForm,
  setItemForm,
  compact = false,
}: {
  itemForm: ItemFormState
  setItemForm: Dispatch<SetStateAction<ItemFormState>>
  compact?: boolean
}) {
  const gap = compact ? 'gap-3' : 'gap-x-4 gap-y-4'
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2', gap)}>
      <div className="space-y-1">
        <div className={EYEBROW}>Days after trigger</div>
        <Input
          type="number"
          min={0}
          value={itemForm.days_offset}
          onChange={e => setItemForm(f => ({ ...f, days_offset: e.target.value }))}
          className="h-8 w-20 text-xs"
          aria-label="Due date offset in days after template runs"
        />
        {!compact && (
          <p className="text-[10px] text-neutral-600 leading-snug">
            0 = same day as status change or manual apply. Each step is one full calendar day from that date.
          </p>
        )}
      </div>
      <div className="space-y-1">
        <div className={EYEBROW}>Priority</div>
        <Select value={itemForm.priority} onValueChange={v => setItemForm(f => ({ ...f, priority: v as TaskPriority }))}>
          <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className={cn('space-y-1', !compact && 'sm:col-span-2')}>
        <div className={EYEBROW}>Repeats</div>
        <Select value={itemForm.recurrence} onValueChange={v => setItemForm(f => ({ ...f, recurrence: v as TaskRecurrence }))}>
          <SelectTrigger className={cn('h-8 text-xs bg-neutral-950 border-neutral-700', compact ? 'w-full' : 'max-w-xs')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.entries(TASK_RECURRENCE_LABELS) as [TaskRecurrence, string][]).map(([v, l]) => (
              <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!compact && (
          <p className="text-[10px] text-neutral-600 leading-snug">
            After you complete the task on Pipeline, a new task is created with the next due date: daily +1 day, weekly +7 days, monthly +1 month from the task&apos;s due date (not from the day you checked it off).
          </p>
        )}
      </div>
      <div className="sm:col-span-2 space-y-1">
        <div className={EYEBROW}>Email on complete</div>
        <Select value={itemForm.email_type} onValueChange={v => setItemForm(f => ({ ...f, email_type: v }))}>
          <SelectTrigger className="h-8 w-full text-xs bg-neutral-950 border-neutral-700"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EMAIL_ACTION_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

export default function PipelineTemplates() {
  const {
    templates, loading, seedDefaultTemplates, seedPerformanceTemplate,
    addTemplate, updateTemplate, deleteTemplate,
    addTemplateItem, updateTemplateItem, deleteTemplateItem,
  } = useTaskTemplates()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [seeded, setSeeded] = useState(false)

  // New template form
  const [newTemplateOpen, setNewTemplateOpen] = useState(false)
  const [newTName, setNewTName] = useState('')
  const [newTDesc, setNewTDesc] = useState('')
  const [newTTrigger, setNewTTrigger] = useState('__none__')
  const [savingTemplate, setSavingTemplate] = useState(false)

  // Edit template name inline
  const [editingTemplateName, setEditingTemplateName] = useState<string | null>(null)
  const [editNameVal, setEditNameVal] = useState('')

  // Item form (add / edit in modal)
  const [itemForm, setItemForm] = useState<ItemFormState>(EMPTY_ITEM)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [itemDialogOpen, setItemDialogOpen] = useState(false)
  const [savingItem, setSavingItem] = useState(false)
  const [confirmDeleteItem, setConfirmDeleteItem] = useState<TaskTemplateItem | null>(null)
  const [confirmDeleteTemplate, setConfirmDeleteTemplate] = useState<TaskTemplate | null>(null)

  // Seed defaults on first load if no templates exist
  useEffect(() => {
    if (!loading && !seeded) {
      setSeeded(true)
      if (templates.length === 0) {
        seedDefaultTemplates().then(() => {
          // After seed, auto-select first
        })
      }
      // Always seed the performance template (idempotent — only inserts if missing)
      seedPerformanceTemplate()
    }
  }, [loading, templates, seeded, seedDefaultTemplates, seedPerformanceTemplate])

  // Auto-select first template when list loads/changes
  useEffect(() => {
    if (templates.length > 0 && !selectedId) {
      setSelectedId(templates[0].id)
    }
  }, [templates, selectedId])

  const selectedTemplate = templates.find(t => t.id === selectedId) ?? null

  const handleCreateTemplate = async () => {
    if (!newTName.trim()) return
    setSavingTemplate(true)
    const { data } = await addTemplate({
      name: newTName.trim(),
      description: newTDesc || null,
      trigger_status: newTTrigger === '__none__' ? null : newTTrigger,
    })
    if (data) setSelectedId(data.id)
    setSavingTemplate(false)
    setNewTemplateOpen(false)
    setNewTName(''); setNewTDesc(''); setNewTTrigger('__none__')
  }

  const startEditName = (t: TaskTemplate) => {
    setEditingTemplateName(t.id)
    setEditNameVal(t.name)
  }

  const saveEditName = async (id: string) => {
    if (!editNameVal.trim()) return
    await updateTemplate(id, { name: editNameVal.trim() })
    setEditingTemplateName(null)
  }

  const handleSaveItem = async () => {
    if (!itemForm.title.trim() || !selectedTemplate) return
    setSavingItem(true)
    const offset = parseInt(itemForm.days_offset)
    const payload = {
      title: itemForm.title.trim(),
      notes: itemForm.notes || null,
      days_offset: isNaN(offset) ? 0 : offset,
      priority: itemForm.priority,
      recurrence: itemForm.recurrence,
      email_type: itemForm.email_type === '__none__' ? null : itemForm.email_type,
    }
    if (editingItemId) {
      await updateTemplateItem(editingItemId, selectedTemplate.id, payload)
    } else {
      const sortOrder = selectedTemplate.items?.length ?? 0
      await addTemplateItem(selectedTemplate.id, { ...payload, sort_order: sortOrder })
    }
    setSavingItem(false)
    closeItemDialog()
  }

  const closeItemDialog = () => {
    setItemDialogOpen(false)
    setEditingItemId(null)
    setItemForm(EMPTY_ITEM)
  }

  const openNewItemDialog = () => {
    setItemForm(EMPTY_ITEM)
    setEditingItemId(null)
    setItemDialogOpen(true)
  }

  const startEditItem = (item: TaskTemplateItem) => {
    setEditingItemId(item.id)
    setItemForm({
      title: item.title,
      notes: item.notes ?? '',
      days_offset: String(item.days_offset),
      priority: item.priority,
      recurrence: item.recurrence,
      email_type: item.email_type ?? '__none__',
    })
    setItemDialogOpen(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/pipeline" className="text-neutral-500 hover:text-neutral-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-base font-semibold text-white">Task Templates</h1>
          <p className="text-xs text-neutral-500 mt-0.5">Reusable task packs that auto-create tasks when venues are added or change status.</p>
        </div>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: Template list */}
        <div className="w-64 shrink-0 flex flex-col gap-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-neutral-500 font-medium uppercase tracking-wider">Templates</span>
            <button
              onClick={() => setNewTemplateOpen(true)}
              className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-200 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-4 h-4 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-neutral-600 py-4 text-center">No templates yet</p>
          ) : (
            <div className="space-y-1">
              {templates.map(t => (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    'group flex items-start justify-between gap-2 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors',
                    selectedId === t.id
                      ? 'bg-neutral-800 border-neutral-600'
                      : 'border-neutral-800 hover:bg-neutral-900/60 hover:border-neutral-700'
                  )}
                >
                  <div className="min-w-0">
                    {editingTemplateName === t.id ? (
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <Input
                          value={editNameVal}
                          onChange={e => setEditNameVal(e.target.value)}
                          className="h-6 text-xs px-1.5"
                          autoFocus
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveEditName(t.id)
                            if (e.key === 'Escape') setEditingTemplateName(null)
                          }}
                        />
                        <button onClick={() => saveEditName(t.id)} className="text-green-400 hover:text-green-300">
                          <Check className="h-3 w-3" />
                        </button>
                        <button onClick={() => setEditingTemplateName(null)} className="text-neutral-500">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-sm text-neutral-200 font-medium truncate">{t.name}</div>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-neutral-600">{t.items?.length ?? 0} tasks</span>
                      {t.trigger_status && (
                        <span className="text-[10px] text-blue-500">auto: {OUTREACH_STATUS_LABELS[t.trigger_status as keyof typeof OUTREACH_STATUS_LABELS] ?? t.trigger_status}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => startEditName(t)}
                      className="p-1 rounded hover:bg-neutral-700 text-neutral-600 hover:text-neutral-300"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteTemplate(t)}
                      className="p-1 rounded hover:bg-neutral-700 text-neutral-600 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Template detail */}
        <div className="flex-1 min-w-0 flex flex-col">
          {!selectedTemplate ? (
            <div className="flex-1 flex items-center justify-center border-2 border-dashed border-neutral-800 rounded-lg">
              <p className="text-sm text-neutral-600">Select a template to edit its tasks</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Template meta */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0">
                    <h2 className="font-semibold text-white">{selectedTemplate.name}</h2>
                    {selectedTemplate.description && (
                      <p className="text-xs text-neutral-500 mt-0.5">{selectedTemplate.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-neutral-500">Auto-trigger on status</Label>
                      <Select
                        value={selectedTemplate.trigger_status ?? '__none__'}
                        onValueChange={v => updateTemplate(selectedTemplate.id, {
                          trigger_status: v === '__none__' ? null : v
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs w-44"><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None</SelectItem>
                          {OUTREACH_STATUS_ORDER.map(s => (
                            <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Task items */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-neutral-800 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-sm font-medium text-neutral-300">Tasks in this template</h3>
                    <p className="text-[11px] text-neutral-600 mt-0.5">Each row becomes a real task on the Pipeline when this template runs.</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-neutral-600 tabular-nums">{selectedTemplate.items?.length ?? 0}</span>
                    <Button size="sm" className="h-7 text-xs gap-1" onClick={openNewItemDialog}>
                      <Plus className="h-3 w-3" />
                      Add task
                    </Button>
                  </div>
                </div>

                {(!selectedTemplate.items || selectedTemplate.items.length === 0) && (
                  <div className="py-8 text-center px-4">
                    <p className="text-xs text-neutral-600 mb-3">No tasks in this template yet.</p>
                    <Button size="sm" variant="outline" className="h-8 text-xs" onClick={openNewItemDialog}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add first task
                    </Button>
                  </div>
                )}

                <div className="divide-y divide-neutral-800/60">
                  {(selectedTemplate.items ?? []).map(item => (
                    <div key={item.id} className="group flex items-start gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', PRIORITY_DOT[item.priority])} title={TASK_PRIORITY_LABELS[item.priority]} />
                          <span className="text-sm text-neutral-200">{item.title}</span>
                          {item.email_type && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/40 text-blue-400 border border-blue-800/60 font-medium shrink-0">
                              {VENUE_EMAIL_TYPE_LABELS[item.email_type as VenueEmailType] ?? item.email_type}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          <span className="text-[10px] text-neutral-500 tabular-nums">
                            Due +{item.days_offset}d after apply
                          </span>
                          {item.recurrence !== 'none' && (
                            <span className="text-[10px] text-neutral-600 border border-neutral-700/80 rounded px-1.5 py-0.5">
                              {TASK_RECURRENCE_LABELS[item.recurrence]}
                            </span>
                          )}
                          {item.notes && (
                            <span className="text-[10px] text-neutral-700 truncate max-w-full">{item.notes}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditItem(item)}
                          className="p-1 rounded hover:bg-neutral-800 text-neutral-600 hover:text-neutral-300"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteItem(item)}
                          className="p-1 rounded hover:bg-neutral-800 text-neutral-600 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add / edit template task — compact modal */}
      <Dialog
        open={itemDialogOpen}
        onOpenChange={v => {
          if (!v) closeItemDialog()
        }}
      >
        <DialogContent className="max-w-md p-4 gap-3 max-h-[min(520px,85vh)] overflow-y-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="text-base">
              {editingItemId ? 'Edit template task' : 'New template task'}
            </DialogTitle>
            {selectedTemplate?.name && (
              <p className="text-[11px] text-neutral-500 font-normal pt-1">
                Template: {selectedTemplate.name}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label className="text-xs text-neutral-400">Title</Label>
              <Input
                value={itemForm.title}
                onChange={e => setItemForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What should be done?"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && itemForm.title.trim() && handleSaveItem()}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-neutral-400">Notes</Label>
              <Input
                value={itemForm.notes}
                onChange={e => setItemForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional"
                className="h-8 text-sm"
              />
            </div>
            <TemplateItemFormFields itemForm={itemForm} setItemForm={setItemForm} compact />
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-1">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={closeItemDialog}>
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleSaveItem}
              disabled={savingItem || !itemForm.title.trim() || !selectedTemplate}
            >
              {savingItem ? 'Saving…' : editingItemId ? 'Save' : 'Add task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New template dialog */}
      <Dialog open={newTemplateOpen} onOpenChange={v => !v && setNewTemplateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Template name *</Label>
              <Input
                value={newTName}
                onChange={e => setNewTName(e.target.value)}
                placeholder="e.g. New Venue Outreach"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleCreateTemplate()}
              />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input
                value={newTDesc}
                onChange={e => setNewTDesc(e.target.value)}
                placeholder="Brief description (optional)"
              />
            </div>
            <div className="space-y-1">
              <Label>Auto-trigger on status</Label>
              <Select value={newTTrigger} onValueChange={setNewTTrigger}>
                <SelectTrigger><SelectValue placeholder="None (manual only)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (manual only)</SelectItem>
                  {OUTREACH_STATUS_ORDER.map(s => (
                    <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-neutral-600">If set, this template auto-applies when a venue reaches this status.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewTemplateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateTemplate} disabled={savingTemplate || !newTName.trim()}>
              {savingTemplate ? 'Creating...' : 'Create template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete item */}
      <Dialog open={!!confirmDeleteItem} onOpenChange={v => !v && setConfirmDeleteItem(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove task?</DialogTitle></DialogHeader>
          <p className="text-sm text-neutral-400">"{confirmDeleteItem?.title}" will be removed from this template.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDeleteItem && selectedTemplate) {
                await deleteTemplateItem(confirmDeleteItem.id, selectedTemplate.id)
                setConfirmDeleteItem(null)
              }
            }}>Remove</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete template */}
      <Dialog open={!!confirmDeleteTemplate} onOpenChange={v => !v && setConfirmDeleteTemplate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete template?</DialogTitle></DialogHeader>
          <p className="text-sm text-neutral-400">"{confirmDeleteTemplate?.name}" and all its tasks will be deleted. Tasks already created from this template are not affected.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteTemplate(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDeleteTemplate) {
                await deleteTemplate(confirmDeleteTemplate.id)
                if (selectedId === confirmDeleteTemplate.id) setSelectedId(null)
                setConfirmDeleteTemplate(null)
              }
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
