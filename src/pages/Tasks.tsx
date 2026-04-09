import { useState, useMemo } from 'react'
import { AgreementPdfPicker } from '@/components/pipeline/AgreementPdfPicker'
import { useCustomEmailTemplates } from '@/hooks/useCustomEmailTemplates'
import { customEmailTypeValue, parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { taskEmailAutomationHintWithCustom } from '@/lib/email/taskEmailAutomationHint'
import { Plus, Pencil, Trash2, RotateCcw } from 'lucide-react'
import { useTasks } from '@/hooks/useTasks'
import { useVenues } from '@/hooks/useVenues'
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
import type { Task, TaskPriority, TaskRecurrence } from '@/types'
import {
  TASK_PRIORITY_LABELS, TASK_RECURRENCE_LABELS,
  VENUE_EMAIL_TYPE_LABELS, ARTIST_EMAIL_TYPE_LABELS,
} from '@/types'
import { cn } from '@/lib/utils'
import { parseDealGrossReconciliationNotes } from '@/lib/dealGrossReconciliationTask'

const PRIORITY_BADGE: Record<TaskPriority, 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive',
  medium: 'warning',
  low: 'secondary',
}

const EMPTY_FORM = {
  title: '',
  notes: '',
  due_date: '',
  priority: 'medium' as TaskPriority,
  recurrence: 'none' as TaskRecurrence,
  venue_id: '',
  deal_id: '',
  email_type: '__none__' as string,
  generated_file_id: '',
}

function isOverdue(task: Task) {
  if (!task.due_date || task.completed) return false
  return task.due_date < new Date().toISOString().split('T')[0]
}

function isToday(task: Task) {
  if (!task.due_date || task.completed) return false
  return task.due_date === new Date().toISOString().split('T')[0]
}

function groupByDate(tasks: Task[]) {
  const today = new Date().toISOString().split('T')[0]
  const groups: { label: string; tasks: Task[] }[] = []
  const overdue = tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const todayTasks = tasks.filter(t => !t.completed && t.due_date === today)
  const upcoming = tasks.filter(t => !t.completed && (!t.due_date || t.due_date > today))
  const noDue = tasks.filter(t => !t.completed && !t.due_date)
  const done = tasks.filter(t => t.completed)

  if (overdue.length) groups.push({ label: 'Overdue', tasks: overdue })
  if (todayTasks.length) groups.push({ label: 'Today', tasks: todayTasks })
  if (upcoming.length) groups.push({ label: 'Upcoming', tasks: upcoming })
  if (noDue.length) groups.push({ label: 'No due date', tasks: noDue })
  if (done.length) groups.push({ label: 'Completed', tasks: done })
  return groups
}

export default function Tasks() {
  const {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    emailAutomationFeedback,
    dismissEmailAutomationFeedback,
    refetch: refetchTasks,
  } = useTasks()
  const { venues } = useVenues()
  const { deals, updateDeal, refetch: refetchDeals } = useDeals()
  const [reconApplyingId, setReconApplyingId] = useState<string | null>(null)
  const { rows: customEmailRows } = useCustomEmailTemplates()

  async function applyDealGrossFromReportTask(task: Task) {
    const payload = parseDealGrossReconciliationNotes(task.notes)
    if (!payload || !task.deal_id || task.completed) return
    setReconApplyingId(task.id)
    const { error } = await updateDeal(task.deal_id, { gross_amount: payload.reported_fee_total })
    setReconApplyingId(null)
    if (error) return
    await refetchDeals()
    await refetchTasks()
  }

  const emailActionOptions = useMemo(() => {
    const builtinVenue = Object.entries(VENUE_EMAIL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
    const builtinArtist = Object.entries(ARTIST_EMAIL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: `${l} (artist)` }))
    const customs = customEmailRows.map(r => ({
      value: customEmailTypeValue(r.id),
      label: `${r.name} (${r.audience === 'venue' ? 'custom · client' : 'custom · artist'})`,
    }))
    return [{ value: '__none__', label: 'None' }, ...builtinVenue, ...builtinArtist, ...customs]
  }, [customEmailRows])
  const [showCompleted, setShowCompleted] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

  const customAudienceForForm = useMemo(() => {
    const cid = parseCustomTemplateId(form.email_type)
    if (!cid) return null
    return customEmailRows.find(r => r.id === cid)?.audience ?? null
  }, [form.email_type, customEmailRows])

  const emailAutomationHintText = useMemo(
    () => taskEmailAutomationHintWithCustom(form.email_type, customAudienceForForm),
    [form.email_type, customAudienceForForm],
  )

  const filtered = useMemo(() =>
    showCompleted ? tasks : tasks.filter(t => !t.completed),
    [tasks, showCompleted]
  )

  const groups = useMemo(() => groupByDate(filtered), [filtered])

  const activeCnt = useMemo(() => tasks.filter(t => !t.completed).length, [tasks])
  const overdueCnt = useMemo(() => tasks.filter(t => isOverdue(t)).length, [tasks])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditTask(null)
    setAddOpen(true)
  }

  const openEdit = (t: Task) => {
    setForm({
      title: t.title,
      notes: t.notes ?? '',
      due_date: t.due_date ?? '',
      priority: t.priority,
      recurrence: t.recurrence,
      venue_id: t.venue_id ?? '',
      deal_id: t.deal_id ?? '',
      email_type: t.email_type ?? '__none__',
      generated_file_id: t.generated_file_id ?? '',
    })
    setEditTask(t)
    setAddOpen(true)
  }

  const setField = <K extends keyof typeof form>(key: K, val: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const handleSave = async () => {
    if (!form.title.trim()) return
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      notes: form.notes || null,
      due_date: form.due_date || null,
      priority: form.priority,
      recurrence: form.recurrence,
      venue_id: form.venue_id || null,
      deal_id: form.deal_id || null,
      email_type: form.email_type === '__none__' ? null : form.email_type,
      generated_file_id: form.generated_file_id || null,
    }
    if (editTask) {
      await updateTask(editTask.id, payload)
    } else {
      await addTask(payload)
    }
    setSaving(false)
    setAddOpen(false)
  }

  const handleToggle = async (task: Task) => {
    setToggling(task.id)
    if (task.completed) {
      await uncompleteTask(task.id)
    } else {
      await completeTask(task.id)
    }
    setToggling(null)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      {emailAutomationFeedback && (
        <div
          role="status"
          className={cn(
            'flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs',
            emailAutomationFeedback.kind === 'error' && 'bg-amber-950/80 border-amber-800 text-amber-100',
            emailAutomationFeedback.kind === 'success' && 'bg-green-950/70 border-green-800 text-green-100',
            emailAutomationFeedback.kind === 'info' && 'bg-neutral-900 border-neutral-600 text-neutral-200',
          )}
        >
          <p>{emailAutomationFeedback.message}</p>
          <button
            type="button"
            onClick={dismissEmailAutomationFeedback}
            className={cn(
              'shrink-0 underline',
              emailAutomationFeedback.kind === 'error' && 'text-amber-400 hover:text-amber-200',
              emailAutomationFeedback.kind === 'success' && 'text-green-400 hover:text-green-200',
              emailAutomationFeedback.kind === 'info' && 'text-neutral-400 hover:text-neutral-200',
            )}
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Header stats */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">{activeCnt} active</span>
          {overdueCnt > 0 && (
            <span className="text-xs text-red-400 font-medium">{overdueCnt} overdue</span>
          )}
        </div>
        <div className="flex-1" />
        <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={e => setShowCompleted(e.target.checked)}
            className="accent-neutral-400"
          />
          Show completed
        </label>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
      </div>

      {/* Task groups */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <p className="font-medium text-neutral-400 text-sm mb-1">No tasks yet</p>
          <p className="text-xs text-neutral-500 mb-4">Add tasks to track your daily work. Link them to venues or deals for context.</p>
          <Button variant="outline" size="sm" onClick={openAdd}>Add first task</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(group => (
            <div key={group.label}>
              <div className={cn(
                'text-xs font-semibold uppercase tracking-wider mb-2 px-1',
                group.label === 'Overdue' ? 'text-red-500' :
                group.label === 'Today' ? 'text-amber-400' :
                group.label === 'Completed' ? 'text-neutral-600' :
                'text-neutral-500'
              )}>
                {group.label} · {group.tasks.length}
              </div>
              <div className="space-y-1.5">
                {group.tasks.map(task => {
                  const grossRecon = parseDealGrossReconciliationNotes(task.notes)
                  return (
                  <div
                    key={task.id}
                    className={cn(
                      'flex items-start gap-3 rounded-lg border px-4 py-3 transition-colors',
                      task.completed
                        ? 'border-neutral-800 bg-neutral-900/50 opacity-60'
                        : isOverdue(task)
                        ? 'border-red-900 bg-red-950/20'
                        : isToday(task)
                        ? 'border-amber-900 bg-amber-950/20'
                        : 'border-neutral-800 bg-neutral-900'
                    )}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggle(task)}
                      disabled={toggling === task.id}
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                        task.completed
                          ? 'bg-neutral-600 border-neutral-600'
                          : 'border-neutral-600 hover:border-neutral-400'
                      )}
                      aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.completed && (
                        <svg className="h-2.5 w-2.5 text-neutral-200" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn(
                          'text-sm font-medium',
                          task.completed ? 'line-through text-neutral-500' : 'text-neutral-100'
                        )}>
                          {task.title}
                        </span>
                        <Badge variant={PRIORITY_BADGE[task.priority]}>
                          {TASK_PRIORITY_LABELS[task.priority]}
                        </Badge>
                        {task.recurrence !== 'none' && (
                          <span className="flex items-center gap-1 text-xs text-neutral-500">
                            <RotateCcw className="h-3 w-3" />
                            {TASK_RECURRENCE_LABELS[task.recurrence]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {task.due_date && (
                          <span className={cn(
                            'text-xs',
                            isOverdue(task) ? 'text-red-400' :
                            isToday(task) ? 'text-amber-400' :
                            'text-neutral-500'
                          )}>
                            {task.due_date}
                          </span>
                        )}
                        {task.venue && (
                          <span className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                            {task.venue.name}
                          </span>
                        )}
                        {task.deal && (
                          <span className="text-xs bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded">
                            {task.deal.description}
                          </span>
                        )}
                        {task.notes && !grossRecon ? (
                          <span className="text-xs text-neutral-600 truncate max-w-xs">{task.notes}</span>
                        ) : null}
                        {task.agreement_file && (
                          <span className="text-xs text-blue-400/90 truncate max-w-[200px]" title={task.agreement_file.name}>
                            PDF: {task.agreement_file.name}
                          </span>
                        )}
                      </div>
                      {grossRecon && !task.completed ? (
                        <div className="mt-2 rounded-md border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-xs text-neutral-200">
                          <p className="mb-2">
                            Deal gross on file:{' '}
                            <span className="tabular-nums text-white">${grossRecon.gross_on_file}</span>
                            . Show report fee:{' '}
                            <span className="tabular-nums text-white">${grossRecon.reported_fee_total}</span>.
                            Apply the reported fee to update the deal and commission.
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs border-amber-500/40 text-amber-100 hover:bg-amber-500/10"
                            disabled={reconApplyingId === task.id}
                            onClick={() => void applyDealGrossFromReportTask(task)}
                          >
                            {reconApplyingId === task.id ? 'Applying…' : `Apply $${grossRecon.reported_fee_total} to deal`}
                          </Button>
                        </div>
                      ) : null}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(task)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => setConfirmDelete(task)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? 'Edit task' : 'Add a task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input
                  type="date"
                  value={form.due_date}
                  onChange={e => setField('due_date', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setField('priority', v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Repeats</Label>
              <Select value={form.recurrence} onValueChange={v => setField('recurrence', v as TaskRecurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Link to venue (optional)</Label>
              <Select
                value={form.venue_id || '__none__'}
                onValueChange={v => setField('venue_id', v === '__none__' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="No venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No venue</SelectItem>
                  {venues.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Link to deal (optional)</Label>
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

            <div className="space-y-1">
              <Label>Email on complete</Label>
              <Select value={form.email_type} onValueChange={v => setField('email_type', v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {emailActionOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {emailAutomationHintText && (
                <p className="text-[11px] text-neutral-500 leading-snug">{emailAutomationHintText}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Agreement PDF (optional)</Label>
              <AgreementPdfPicker
                value={form.generated_file_id || null}
                onChange={id => setField('generated_file_id', id ?? '')}
                venueId={form.venue_id || null}
                dealId={form.deal_id || null}
              />
              {form.generated_file_id && form.email_type !== 'agreement_ready' && form.email_type !== '__none__' && (
                <p className="text-[10px] text-amber-500/90">
                  Linked PDF applies to agreement-style emails; for other types it may have no effect.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Any context…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : editTask ? 'Save changes' : 'Add task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete task?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.title}</strong> will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={async () => {
                await deleteTask(confirmDelete.id)
                setConfirmDelete(null)
              }}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
