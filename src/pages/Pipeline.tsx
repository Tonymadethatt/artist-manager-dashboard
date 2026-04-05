import { useState, useMemo } from 'react'
import { Plus, LayoutGrid, List, Settings2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTasks } from '@/hooks/useTasks'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { VenueWorkCard } from '@/components/pipeline/VenueWorkCard'
import { TaskItem } from '@/components/pipeline/TaskItem'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { Task, TaskPriority, TaskRecurrence } from '@/types'
import { TASK_PRIORITY_LABELS, TASK_RECURRENCE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

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

export default function Pipeline() {
  const { tasks, loading, addTask, updateTask, deleteTask, completeTask, uncompleteTask, snoozeTask } = useTasks()
  const { venues } = useVenues()
  const { deals } = useDeals()

  const [viewMode, setViewMode] = useState<ViewMode>('board')
  const [filter, setFilter] = useState<Filter>('all')
  const [showCompleted, setShowCompleted] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editTask, setEditTask] = useState<Task | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const weekEnd = (() => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0]
  })()

  // Apply time filter
  const filteredTasks = useMemo(() => {
    const open = showCompleted ? tasks : tasks.filter(t => !t.completed)
    if (filter === 'today') return open.filter(t => t.due_date === today || (!t.due_date && !t.completed))
    if (filter === 'week') return open.filter(t => !t.due_date || (t.due_date >= today && t.due_date <= weekEnd))
    return open
  }, [tasks, filter, showCompleted, today, weekEnd])

  const activeCnt = useMemo(() => tasks.filter(t => !t.completed).length, [tasks])
  const overdueCnt = useMemo(() => tasks.filter(t => !t.completed && t.due_date && t.due_date < today).length, [tasks, today])

  // Board: group tasks by venue
  const boardGroups = useMemo(() => {
    const withVenue = filteredTasks.filter(t => t.venue_id)
    const noVenue = filteredTasks.filter(t => !t.venue_id)

    // Only include venues that have tasks in current filter
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
    }
    if (editTask) {
      await updateTask(editTask.id, payload)
    } else {
      await addTask(payload)
    }
    setSaving(false)
    setAddOpen(false)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
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
                'px-3 py-1 text-xs rounded-md transition-colors capitalize',
                filter === f
                  ? 'bg-neutral-700 text-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {f === 'today' ? 'Today' : f === 'week' ? 'This Week' : 'All Open'}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Controls */}
        {viewMode === 'list' && (
          <label className="flex items-center gap-2 text-xs text-neutral-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={e => setShowCompleted(e.target.checked)}
              className="accent-neutral-400"
            />
            Show completed
          </label>
        )}

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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : viewMode === 'board' ? (
        /* Board view */
        filteredTasks.length === 0 ? (
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
                onComplete={completeTask}
                onUncomplete={uncompleteTask}
                onSnooze={snoozeTask}
                onEdit={openEdit}
                onDelete={async (id) => { await deleteTask(id) }}
                onAddTask={openAdd}
              />
            ))}
            {/* General card — always at end */}
            {(boardGroups.generalTasks.length > 0 || true) && (
              <VenueWorkCard
                venue={null}
                tasks={boardGroups.generalTasks}
                onComplete={completeTask}
                onUncomplete={uncompleteTask}
                onSnooze={snoozeTask}
                onEdit={openEdit}
                onDelete={async (id) => { await deleteTask(id) }}
                onAddTask={openAdd}
              />
            )}
          </div>
        )
      ) : (
        /* List view */
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
                        onComplete={completeTask}
                        onUncomplete={uncompleteTask}
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
          <DialogHeader>
            <DialogTitle>Delete task?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            "{confirmDelete?.title}" will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (confirmDelete) { await deleteTask(confirmDelete.id); setConfirmDelete(null) }
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
