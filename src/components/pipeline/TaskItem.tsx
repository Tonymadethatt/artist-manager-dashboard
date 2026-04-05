import { useState } from 'react'
import { MoreHorizontal, Pencil, Trash2, AlarmClock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { Task, TaskPriority } from '@/types'
import { cn } from '@/lib/utils'

const PRIORITY_DOT: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-400',
  low: 'bg-neutral-600',
}

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Med',
  low: 'Low',
}

function fmtDue(dateStr: string): { label: string; color: string } {
  const today = new Date().toISOString().split('T')[0]
  if (dateStr < today) return { label: 'Overdue', color: 'text-red-400' }
  if (dateStr === today) return { label: 'Today', color: 'text-green-400' }
  const diff = Math.ceil((new Date(dateStr).getTime() - new Date(today).getTime()) / 86400000)
  if (diff === 1) return { label: 'Tomorrow', color: 'text-neutral-400' }
  if (diff <= 7) return { label: `${diff}d`, color: 'text-neutral-500' }
  return { label: dateStr, color: 'text-neutral-600' }
}

interface TaskItemProps {
  task: Task
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onSnooze: (id: string, days: number) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  compact?: boolean
}

export function TaskItem({ task, onComplete, onUncomplete, onSnooze, onEdit, onDelete, compact = false }: TaskItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [snoozeOpen, setSnoozeOpen] = useState(false)
  const [snoozeDays, setSnoozeDays] = useState('1')

  const today = new Date().toISOString().split('T')[0]
  const isOverdue = !task.completed && task.due_date && task.due_date < today
  const due = task.due_date ? fmtDue(task.due_date) : null

  const handleSnoozeSubmit = () => {
    const d = parseInt(snoozeDays)
    if (!isNaN(d) && d > 0) onSnooze(task.id, d)
    setSnoozeOpen(false)
  }

  return (
    <div className={cn(
      'group flex items-start gap-2.5 py-2 px-1 rounded transition-colors relative',
      isOverdue && 'border-l-2 border-red-500 pl-2.5',
      task.completed && 'opacity-50',
    )}>
      {/* Checkbox */}
      <button
        onClick={() => task.completed ? onUncomplete(task.id) : onComplete(task.id)}
        className={cn(
          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
          task.completed
            ? 'bg-neutral-600 border-neutral-600'
            : 'border-neutral-600 hover:border-neutral-400'
        )}
      >
        {task.completed && <div className="w-2 h-2 bg-neutral-300 rounded-sm" />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-1">
          <span className={cn(
            'text-sm leading-snug',
            task.completed ? 'line-through text-neutral-600' : 'text-neutral-200'
          )}>
            {task.title}
          </span>

          {/* Actions (show on hover) */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            {!task.completed && (
              <div className="relative">
                <button
                  onClick={() => { setSnoozeOpen(v => !v); setMenuOpen(false) }}
                  className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
                  title="Snooze"
                >
                  <AlarmClock className="h-3.5 w-3.5" />
                </button>
                {snoozeOpen && (
                  <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-900 border border-neutral-700 rounded shadow-lg p-2 flex items-center gap-1.5 min-w-[130px]">
                    <span className="text-xs text-neutral-400">+</span>
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={snoozeDays}
                      onChange={e => setSnoozeDays(e.target.value)}
                      className="h-6 w-12 text-xs px-1.5"
                      onKeyDown={e => e.key === 'Enter' && handleSnoozeSubmit()}
                      autoFocus
                    />
                    <span className="text-xs text-neutral-400">days</span>
                    <button
                      onClick={handleSnoozeSubmit}
                      className="text-xs text-neutral-300 hover:text-white px-1.5 py-0.5 rounded bg-neutral-700 hover:bg-neutral-600"
                    >
                      Go
                    </button>
                  </div>
                )}
              </div>
            )}
            <div className="relative">
              <button
                onClick={() => { setMenuOpen(v => !v); setSnoozeOpen(false) }}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 z-20 bg-neutral-900 border border-neutral-700 rounded shadow-lg py-1 min-w-[110px]">
                  <button
                    onClick={() => { onEdit(task); setMenuOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                  >
                    <Pencil className="h-3 w-3" /> Edit
                  </button>
                  <button
                    onClick={() => { onDelete(task.id); setMenuOpen(false) }}
                    className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-800"
                  >
                    <Trash2 className="h-3 w-3" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {!compact && (
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('flex items-center gap-1')}>
              <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOT[task.priority])} />
              <span className="text-[10px] text-neutral-600">{PRIORITY_LABEL[task.priority]}</span>
            </span>
            {due && (
              <span className={cn('text-[11px] font-medium', due.color)}>{due.label}</span>
            )}
            {task.recurrence !== 'none' && (
              <span className="text-[10px] text-neutral-700">repeats</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
