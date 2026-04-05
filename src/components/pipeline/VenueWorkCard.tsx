import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TaskItem } from './TaskItem'
import type { Task, Venue } from '@/types'
import { OUTREACH_STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  not_contacted: 'bg-neutral-800 text-neutral-500',
  reached_out: 'bg-blue-900/50 text-blue-400',
  in_discussion: 'bg-amber-900/50 text-amber-400',
  agreement_sent: 'bg-purple-900/50 text-purple-400',
  booked: 'bg-green-900/50 text-green-400',
  rejected: 'bg-red-900/50 text-red-400',
  archived: 'bg-neutral-800 text-neutral-600',
}

interface VenueWorkCardProps {
  venue: Venue | null // null = "General" card
  tasks: Task[]
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onSnooze: (id: string, days: number) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  onAddTask: (venueId: string | null) => void
  selected?: boolean
  onSelect?: () => void
}

export function VenueWorkCard({
  venue, tasks, onComplete, onUncomplete, onSnooze, onEdit, onDelete, onAddTask,
  selected = false, onSelect,
}: VenueWorkCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const today = new Date().toISOString().split('T')[0]
  const overdueTasks = tasks.filter(t => !t.completed && t.due_date && t.due_date < today)
  const todayTasks = tasks.filter(t => !t.completed && t.due_date === today)
  const upcomingTasks = tasks.filter(t => !t.completed && t.due_date && t.due_date > today)
  const noDateTasks = tasks.filter(t => !t.completed && !t.due_date)
  const completedTasks = tasks.filter(t => t.completed)

  const orderedTasks = [
    ...overdueTasks,
    ...todayTasks,
    ...upcomingTasks,
    ...noDateTasks,
    ...completedTasks,
  ]

  const hasOverdue = overdueTasks.length > 0

  return (
    <div className={cn(
      'flex flex-col bg-neutral-900 border rounded-lg min-w-[260px] w-[280px] shrink-0 transition-all',
      hasOverdue ? 'border-red-800' : 'border-neutral-800',
      selected && 'ring-2 ring-white/25 border-neutral-600',
    )}>
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2.5 cursor-pointer select-none"
        onClick={() => {
          if (onSelect && venue) onSelect()
          else setCollapsed(v => !v)
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm text-white truncate">
            {venue ? venue.name : 'General'}
          </span>
          {venue && (
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', STATUS_BADGE[venue.status] ?? STATUS_BADGE.not_contacted)}>
              {OUTREACH_STATUS_LABELS[venue.status] ?? venue.status}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {hasOverdue && (
            <span className="text-[10px] bg-red-900/60 text-red-400 px-1.5 py-0.5 rounded-full font-semibold">
              {overdueTasks.length} overdue
            </span>
          )}
          <span className="text-[11px] text-neutral-600">{tasks.filter(t => !t.completed).length}</span>
          <span className={cn(
            'text-neutral-600 transition-transform text-xs',
            collapsed && '-rotate-90'
          )}>▾</span>
        </div>
      </div>

      {/* Task list */}
      {!collapsed && (
        <>
          <div className="px-2 pb-1 flex flex-col min-h-[40px]">
            {orderedTasks.length === 0 ? (
              <p className="text-xs text-neutral-700 py-3 text-center">No open tasks</p>
            ) : (
              orderedTasks.map(task => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onComplete={onComplete}
                  onUncomplete={onUncomplete}
                  onSnooze={onSnooze}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))
            )}
          </div>

          <div className="px-2 py-2 border-t border-neutral-800">
            <button
              onClick={() => onAddTask(venue?.id ?? null)}
              className="flex items-center gap-1.5 text-xs text-neutral-600 hover:text-neutral-300 transition-colors w-full py-0.5 rounded hover:bg-neutral-800 px-1"
            >
              <Plus className="h-3.5 w-3.5" />
              Add task
            </button>
          </div>
        </>
      )}
    </div>
  )
}
