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

export interface TaskBulkSelection {
  isSelected: (id: string) => boolean
  onToggle: (id: string) => void
}

interface TaskItemProps {
  task: Task
  onComplete: (id: string) => void
  onUncomplete: (id: string) => void
  onSnooze: (id: string, days: number) => void
  onEdit: (task: Task) => void
  onDelete: (id: string) => void
  /** Shown under title in list/archive (e.g. venue name). */
  contextLabel?: string | null
  compact?: boolean
  /** Pipeline bulk delete: checkbox before complete control. */
  bulkSelection?: TaskBulkSelection | null
}

export function TaskItem({
  task,
  onComplete,
  onUncomplete,
  onSnooze,
  onEdit,
  onDelete,
  contextLabel,
  compact = false,
  bulkSelection,
}: TaskItemProps) {
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
      {bulkSelection && (
        <input
          type="checkbox"
          checked={bulkSelection.isSelected(task.id)}
          onChange={() => bulkSelection.onToggle(task.id)}
          onClick={e => e.stopPropagation()}
          className="mt-0.5 shrink-0 w-3.5 h-3.5 rounded border border-neutral-600 bg-neutral-900 text-neutral-200 focus:ring-1 focus:ring-neutral-500 focus:ring-offset-0 focus:ring-offset-transparent cursor-pointer accent-neutral-500"
          aria-label={`Select task: ${task.title}`}
        />
      )}
      <button
        type="button"
        onClick={e => {
          e.stopPropagation()
          task.completed ? onUncomplete(task.id) : onComplete(task.id)
        }}
        className={cn(
          'flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center',
          task.completed
            ? 'bg-neutral-600 border-neutral-600'
            : 'border-neutral-600 hover:border-neutral-400'
        )}
      >
        {task.completed && <div className="w-2 h-2 bg-neutral-300 rounded-sm" />}
      </button>

      <div className="flex-1 min-w-0 flex items-start gap-1">
        <button
          type="button"
          className={cn(
            'flex-1 min-w-0 text-left rounded px-0.5 -mx-0.5 cursor-pointer hover:bg-neutral-800/50',
          )}
          onClick={() => onEdit(task)}
          onKeyDown={e => { if (e.key === 'Enter') onEdit(task) }}
        >
          <span className={cn(
            'text-sm leading-snug block',
            task.completed ? 'line-through text-neutral-600' : 'text-neutral-200'
          )}>
            {task.title}
          </span>
          {contextLabel && (
            <span className="text-[10px] text-neutral-600 block mt-0.5 truncate">{contextLabel}</span>
          )}
          {!compact && (
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
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
              {task.agreement_file && (
                <span className="text-[10px] text-blue-400/80 truncate max-w-[180px]" title={task.agreement_file.name}>
                  PDF: {task.agreement_file.name}
                </span>
              )}
            </div>
          )}
        </button>

        <div className="flex items-start gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 pt-0.5">
          {!task.completed && (
            <div className="relative">
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  setSnoozeOpen(v => !v)
                  setMenuOpen(false)
                }}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
                title="Snooze"
              >
                <AlarmClock className="h-3.5 w-3.5" />
              </button>
              {snoozeOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 bg-neutral-900 border border-neutral-700 rounded shadow-lg p-2 flex items-center gap-1.5 min-w-[130px]"
                  onClick={e => e.stopPropagation()}
                >
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
                    type="button"
                    onClick={handleSnoozeSubmit}
                    className="text-xs text-neutral-300 hover:text-white px-1.5 py-0.5 rounded bg-neutral-700 hover:bg-neutral-600"
                  >
                    Go
                  </button>
                </div>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation()
              onDelete(task.id)
            }}
            className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-red-400 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                setMenuOpen(v => !v)
                setSnoozeOpen(false)
              }}
              className="p-1 rounded hover:bg-neutral-800 text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-full mt-1 z-20 bg-neutral-900 border border-neutral-700 rounded shadow-lg py-1 min-w-[110px]"
                onClick={e => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => { onEdit(task); setMenuOpen(false) }}
                  className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
                >
                  <Pencil className="h-3 w-3" /> Edit
                </button>
                <button
                  type="button"
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
    </div>
  )
}
