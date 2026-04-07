import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Plus, LayoutGrid, List, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTasks } from '@/hooks/useTasks'
import { useVenues, useVenueDetail } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { VenueWorkCard } from '@/components/pipeline/VenueWorkCard'
import { VenueProgressPanel, type ProgressUpdate } from '@/components/pipeline/VenueProgressPanel'
import { TaskItem } from '@/components/pipeline/TaskItem'
import { SendVenueEmailModal } from '@/components/emails/SendVenueEmailModal'
import { AgreementPdfPicker } from '@/components/pipeline/AgreementPdfPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Task, TaskPriority, TaskRecurrence, Venue, Contact, VenueEmail } from '@/types'
import {
  TASK_PRIORITY_LABELS, TASK_RECURRENCE_LABELS, ACTIVITY_CATEGORY_LABELS, OUTREACH_STATUS_LABELS,
  VENUE_EMAIL_TYPE_LABELS, ARTIST_EMAIL_TYPE_LABELS,
} from '@/types'
import { cn } from '@/lib/utils'
import type { QueueEmailOnTaskCompleteOptions } from '@/lib/queueEmailOnTaskComplete'
import { useCustomEmailTemplates } from '@/hooks/useCustomEmailTemplates'
import { customEmailTypeValue } from '@/lib/email/customTemplateId'

type ViewMode = 'board' | 'list'
type Filter = 'today' | 'week' | 'all'

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

function groupByDate(tasks: Task[]) {
  const today = new Date().toISOString().split('T')[0]
  const groups: { label: string; color: string; tasks: Task[] }[] = []
  const overdue = tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const todayTasks = tasks.filter(t => !t.completed && t.due_date === today)
  const upcoming = tasks.filter(t => !t.completed && t.due_date && t.due_date > today)
  const noDue = tasks.filter(t => !t.completed && !t.due_date)
  const done = tasks.filter(t => t.completed)
  if (overdue.length) groups.push({ label: 'Overdue', color: 'text-red-500', tasks: overdue })
  if (todayTasks.length) groups.push({ label: 'Today', color: 'text-green-400', tasks: todayTasks })
  if (upcoming.length) groups.push({ label: 'Upcoming', color: 'text-neutral-400', tasks: upcoming })
  if (noDue.length) groups.push({ label: 'No due date', color: 'text-neutral-600', tasks: noDue })
  if (done.length) groups.push({ label: 'Completed', color: 'text-neutral-700', tasks: done })
  return groups
}

// Inner component: handles per-venue hooks so useVenueDetail is called with the right id
function VenueProgressPanelConnected({
  venue,
  tasks,
  deals,
  allEmails,
  onClose,
  onCompleteTask,
  onUpdateVenue,
  onQueueEmail,
  onOpenSendModal,
  onApplyTemplate,
  refetchEmails,
}: {
  venue: Venue
  tasks: Task[]
  deals: ReturnType<typeof useDeals>['deals']
  allEmails: VenueEmail[]
  onClose: () => void
  onCompleteTask: (id: string, emailOpts?: QueueEmailOnTaskCompleteOptions) => Promise<unknown>
  onUpdateVenue: (id: string, updates: Partial<Venue>) => Promise<unknown>
  onQueueEmail: ReturnType<typeof useVenueEmails>['queueEmail']
  onOpenSendModal: (venue: Venue, contact: Contact, emailType: string) => void
  onApplyTemplate: (templateId: string, venueId: string) => Promise<{ count: number }>
  refetchEmails: () => void | Promise<void>
}) {
  const { contacts, addNote } = useVenueDetail(venue.id)
  const venueDeals = deals.filter(d => d.venue_id === venue.id)
  const venueEmails = allEmails.filter(e => e.venue_id === venue.id)
  const venueTasks = tasks.filter(t => t.venue_id === venue.id)
  const { templates } = useTaskTemplates()

  const handleConfirm = useCallback(async (updates: ProgressUpdate) => {
    const promises: Promise<unknown>[] = []

    // 1. Status + follow-up date update
    const venueUpdates: Partial<Venue> = {}
    if (updates.newStatus) venueUpdates.status = updates.newStatus
    if (updates.followUpDate !== undefined) venueUpdates.follow_up_date = updates.followUpDate
    if (Object.keys(venueUpdates).length > 0) {
      promises.push(onUpdateVenue(venue.id, venueUpdates))
    }

    // 2. Activity note
    if (updates.activityCategory) {
      const label = updates.activityCategory === 'other' && updates.activityNote
        ? updates.activityNote
        : (ACTIVITY_CATEGORY_LABELS[updates.activityCategory] ?? updates.activityCategory)
      promises.push(addNote(venue.id, label, updates.activityCategory))
    }

    // 3. Complete checked tasks (pass progress-panel agreement URL into the same queue path as board/list)
    for (const id of updates.completedTaskIds) {
      promises.push(onCompleteTask(id, { agreementUrl: updates.agreementUrl }))
    }

    await Promise.all(promises)

    // 4. Auto-apply template if status changed
    if (updates.newStatus) {
      const matching = templates.filter(t => t.trigger_status === updates.newStatus)
      for (const t of matching) {
        await onApplyTemplate(t.id, venue.id)
      }
    }

    // 5. Refresh queue if any completed task had an email action (queued inside completeTask)
    const completedHadEmail = updates.completedTaskIds.some(id => {
      const t = venueTasks.find(x => x.id === id)
      return !!t?.email_type
    })
    if (completedHadEmail) await refetchEmails()

    // 6. Email action from suggested email panel
    if (updates.emailAction === 'queue' && updates.emailType) {
      const primaryContact = contacts.find(c => c.email)
      if (primaryContact?.email) {
        await onQueueEmail({
          venue_id: venue.id,
          email_type: updates.emailType,
          recipient_email: primaryContact.email,
          subject: `${OUTREACH_STATUS_LABELS[updates.newStatus ?? venue.status]} - ${venue.name}`,
          notes: `Queued from pipeline progress panel`,
        })
      }
    } else if (updates.emailAction === 'send' && updates.emailType) {
      const primaryContact = contacts.find(c => c.email)
      if (primaryContact?.email) {
        onOpenSendModal(venue, primaryContact, updates.emailType)
      }
    }
  }, [venue, contacts, templates, venueTasks, addNote, onCompleteTask, onUpdateVenue, onQueueEmail, onOpenSendModal, onApplyTemplate, refetchEmails])

  return (
    <VenueProgressPanel
      venue={venue}
      tasks={venueTasks}
      contacts={contacts}
      deals={venueDeals}
      sentEmails={venueEmails}
      onClose={onClose}
      onConfirm={handleConfirm}
    />
  )
}

export default function Pipeline() {
  const {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    snoozeTask,
    emailAutomationBanner,
    dismissEmailAutomationBanner,
  } = useTasks()
  const { venues, updateVenue } = useVenues()
  const { deals } = useDeals()
  const { emails: allEmails, queueEmail, refetch: refetchEmails } = useVenueEmails()
  const { applyTemplate } = useTaskTemplates()
  const { rows: customEmailRows } = useCustomEmailTemplates()

  const emailActionOptions = useMemo(() => {
    const builtinVenue = Object.entries(VENUE_EMAIL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))
    const builtinArtist = Object.entries(ARTIST_EMAIL_TYPE_LABELS).map(([v, l]) => ({ value: v, label: `${l} (artist)` }))
    const customs = customEmailRows.map(r => ({
      value: customEmailTypeValue(r.id),
      label: `${r.name} (${r.audience === 'venue' ? 'custom · client' : 'custom · artist'})`,
    }))
    return [{ value: '__none__', label: 'None' }, ...builtinVenue, ...builtinArtist, ...customs]
  }, [customEmailRows])

  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [filter, setFilter] = useState<Filter>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null)

  // Track tasks completed this session so they stay visible until page refresh
  const [recentlyCompletedIds, setRecentlyCompletedIds] = useState<Set<string>>(new Set())

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])
  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 2500)
  }, [])
  const [addOpen, setAddOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Email send modal state (triggered from progress panel)
  const [sendEmailState, setSendEmailState] = useState<{
    venue: Venue; contact: Contact; emailType: string
  } | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const weekEnd = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()

  const selectedVenue = selectedVenueId ? venues.find(v => v.id === selectedVenueId) ?? null : null

  // Apply time filter — always include recently-completed tasks from this session
  const filteredTasks = useMemo(() => {
    const open = tasks.filter(t => !t.completed || showCompleted || recentlyCompletedIds.has(t.id))
    if (filter === 'today') return open.filter(t =>
      recentlyCompletedIds.has(t.id) || t.due_date === today || (!t.due_date && !t.completed)
    )
    if (filter === 'week') return open.filter(t =>
      recentlyCompletedIds.has(t.id) || !t.due_date || (t.due_date >= today && t.due_date <= weekEnd)
    )
    return open
  }, [tasks, filter, showCompleted, recentlyCompletedIds, today, weekEnd])

  const activeCnt = useMemo(() => tasks.filter(t => !t.completed).length, [tasks])
  const overdueCnt = useMemo(() => tasks.filter(t => !t.completed && t.due_date && t.due_date < today).length, [tasks, today])

  // Board: group tasks by venue
  const boardGroups = useMemo(() => {
    const withVenue = filteredTasks.filter(t => t.venue_id)
    const noVenue = filteredTasks.filter(t => !t.venue_id)
    const venueIds = [...new Set(withVenue.map(t => t.venue_id!))]
    const venueCards = venueIds.map(vid => ({
      venue: venues.find(v => v.id === vid) ?? null,
      tasks: withVenue.filter(t => t.venue_id === vid),
    })).filter(g => g.tasks.length > 0)
    return { venueCards, generalTasks: noVenue }
  }, [filteredTasks, venues])

  // List: group by date
  const listGroups = useMemo(() => groupByDate(filteredTasks), [filteredTasks])

  const openAdd = (venueId: string | null = null) => {
    setForm({ ...EMPTY_FORM, venue_id: venueId ?? '' })
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

  const handleCompleteTask = useCallback(async (id: string, emailOpts?: QueueEmailOnTaskCompleteOptions) => {
    const result = await completeTask(id, emailOpts)
    setRecentlyCompletedIds(prev => new Set([...prev, id]))
    const task = tasks.find(t => t.id === id)
    showToast(task ? `"${task.title}" marked complete` : 'Task completed')
    return result
  }, [completeTask, tasks, showToast])

  const handleUncompleteTask = useCallback(async (id: string) => {
    const result = await uncompleteTask(id)
    setRecentlyCompletedIds(prev => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
    // Also refresh email queue so the cancelled entry disappears
    await refetchEmails()
    return result
  }, [uncompleteTask, refetchEmails])

  const handleOpenSendModal = useCallback((venue: Venue, contact: Contact, emailType: string) => {
    setSendEmailState({ venue, contact, emailType })
  }, [])

  const panelOpen = !!selectedVenue

  return (
    <div className="flex flex-col h-full min-h-0">
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          {toast}
        </div>
      )}
      {emailAutomationBanner && (
        <div
          role="alert"
          className="mb-3 flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg bg-amber-950/80 border border-amber-800 text-xs text-amber-100 shrink-0"
        >
          <p>{emailAutomationBanner}</p>
          <button
            type="button"
            onClick={dismissEmailAutomationBanner}
            className="shrink-0 text-amber-400 hover:text-amber-200 underline"
          >
            Dismiss
          </button>
        </div>
      )}
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-500">{activeCnt} open</span>
          {overdueCnt > 0 && (
            <span className="text-xs text-red-400 font-semibold">{overdueCnt} overdue</span>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
          {(['today', 'week', 'all'] as Filter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1 text-xs rounded-md transition-colors',
                filter === f ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Open'}
            </button>
          ))}
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

        {/* View toggle */}
        <div className="flex items-center gap-0.5 bg-neutral-900 border border-neutral-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('board')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'board' ? 'bg-neutral-700 text-white' : 'text-neutral-600 hover:text-neutral-400'
            )}
            title="Board view"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'list' ? 'bg-neutral-700 text-white' : 'text-neutral-600 hover:text-neutral-400'
            )}
            title="List view"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <Link to="/pipeline/templates">
          <Button variant="ghost" size="sm" className="gap-1.5 text-neutral-500 hover:text-neutral-200">
            <Settings2 className="h-3.5 w-3.5" />
            Templates
          </Button>
        </Link>

        <Button size="sm" onClick={() => openAdd(null)}>
          <Plus className="h-3.5 w-3.5" />
          Add task
        </Button>
      </div>

      {/* Main content area: board/list + optional progress panel */}
      <div className={cn(
        'flex gap-4 flex-1 min-h-0',
        panelOpen ? 'flex-row' : ''
      )}>
        {/* Board / List */}
        <div className={cn(
          'flex flex-col min-h-0',
          panelOpen ? 'flex-1 min-w-0' : 'flex-1'
        )}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            </div>
          ) : viewMode === 'board' ? (
            filteredTasks.length === 0 && boardGroups.generalTasks.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-neutral-800 rounded-lg">
                <p className="font-medium text-neutral-400 text-sm mb-1">Nothing here</p>
                <p className="text-xs text-neutral-600 mb-4">
                  {filter === 'today' ? 'No tasks for today.' : filter === 'week' ? 'No tasks this week.' : 'No open tasks.'}
                </p>
                <Button variant="outline" size="sm" onClick={() => openAdd(null)}>Add a task</Button>
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 min-h-0 flex-1">
                {boardGroups.venueCards.map(({ venue, tasks: venueTasks }) => (
                  <VenueWorkCard
                    key={venue?.id ?? 'null'}
                    venue={venue}
                    tasks={venueTasks}
                    onComplete={handleCompleteTask}
                    onUncomplete={handleUncompleteTask}
                    onSnooze={snoozeTask}
                    onEdit={openEdit}
                    onDelete={async (id) => { await deleteTask(id) }}
                    onAddTask={openAdd}
                    selected={venue?.id === selectedVenueId}
                    onSelect={venue ? () => setSelectedVenueId(
                      selectedVenueId === venue.id ? null : venue.id
                    ) : undefined}
                  />
                ))}
                {/* General card */}
                <VenueWorkCard
                  venue={null}
                  tasks={boardGroups.generalTasks}
                  onComplete={handleCompleteTask}
                  onUncomplete={handleUncompleteTask}
                  onSnooze={snoozeTask}
                  onEdit={openEdit}
                  onDelete={async (id) => { await deleteTask(id) }}
                  onAddTask={openAdd}
                />
              </div>
            )
          ) : (
            filteredTasks.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-neutral-800 rounded-lg">
                <p className="font-medium text-neutral-400 text-sm mb-1">No tasks</p>
                <p className="text-xs text-neutral-600 mb-4">Add tasks to track your daily work.</p>
                <Button variant="outline" size="sm" onClick={() => openAdd(null)}>Add first task</Button>
              </div>
            ) : (
              <div className="space-y-6 max-w-2xl">
                {listGroups.map(group => (
                  <div key={group.label}>
                    <div className={cn('text-xs font-semibold uppercase tracking-wider mb-2 px-1', group.color)}>
                      {group.label} · {group.tasks.length}
                    </div>
                    <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
                      {group.tasks.map(task => (
                        <div key={task.id} className="px-2">
                          <TaskItem
                            task={task}
                            onComplete={handleCompleteTask}
                            onUncomplete={handleUncompleteTask}
                            onSnooze={snoozeTask}
                            onEdit={openEdit}
                            onDelete={async (id) => { await deleteTask(id) }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </div>

        {/* Progress panel — rendered when a venue card is selected */}
        {panelOpen && selectedVenue && (
          <div className="w-[340px] shrink-0 bg-neutral-900 border border-neutral-800 rounded-lg flex flex-col overflow-hidden">
            <VenueProgressPanelConnected
              venue={selectedVenue}
              tasks={tasks}
              deals={deals}
              allEmails={allEmails}
              onClose={() => setSelectedVenueId(null)}
              onCompleteTask={handleCompleteTask}
              onUpdateVenue={updateVenue}
              onQueueEmail={queueEmail}
              onOpenSendModal={handleOpenSendModal}
              onApplyTemplate={applyTemplate}
              refetchEmails={refetchEmails}
            />
          </div>
        )}
      </div>

      {/* Add / Edit task dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editTask ? 'Edit task' : 'Add task'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title *</Label>
              <Input
                value={form.title}
                onChange={e => setField('title', e.target.value)}
                placeholder="What needs to be done?"
                autoFocus
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Optional context"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={e => setField('due_date', e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={v => setField('priority', v as TaskPriority)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Recurrence</Label>
              <Select value={form.recurrence} onValueChange={v => setField('recurrence', v as TaskRecurrence)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(TASK_RECURRENCE_LABELS) as [TaskRecurrence, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to venue</Label>
              <Select value={form.venue_id || '__none__'} onValueChange={v => setField('venue_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {venues.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Link to deal</Label>
              <Select value={form.deal_id || '__none__'} onValueChange={v => setField('deal_id', v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving...' : editTask ? 'Save changes' : 'Add task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete */}
      <Dialog open={!!confirmDelete} onOpenChange={v => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete task?</DialogTitle></DialogHeader>
          <p className="text-sm text-neutral-400">"{confirmDelete?.title}" will be permanently deleted.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (confirmDelete) { await deleteTask(confirmDelete.id); setConfirmDelete(null) }
            }}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send email modal — opened from progress panel confirm */}
      {sendEmailState && (
        <SendVenueEmailModal
          open={!!sendEmailState}
          onClose={() => setSendEmailState(null)}
          venue={sendEmailState.venue}
          deal={deals.find(d => d.venue_id === sendEmailState.venue.id) ?? null}
          recipientEmail={sendEmailState.contact.email ?? undefined}
          recipientName={sendEmailState.contact.name}
          venueId={sendEmailState.venue.id}
          defaultType={sendEmailState.emailType as import('@/types').VenueEmailType}
        />
      )}
    </div>
  )
}
