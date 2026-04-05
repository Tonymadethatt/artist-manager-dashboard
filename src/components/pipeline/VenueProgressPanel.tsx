import { useState, useMemo, useEffect } from 'react'
import { X, ChevronRight, Send, Clock, CheckCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type {
  Venue, OutreachStatus, Task, Contact, VenueEmail, Deal,
} from '@/types'
import {
  OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER,
  ACTIVITY_CATEGORY_LABELS,
  VENUE_EMAIL_TYPE_LABELS,
  type VenueEmailType,
} from '@/types'
import { getNextEmailSuggestion } from '@/lib/emailSuggestion'
import { cn } from '@/lib/utils'

export type EmailAction = 'send' | 'queue' | 'skip'

export interface ProgressUpdate {
  newStatus: OutreachStatus | null
  activityCategory: string | null
  activityNote: string | null
  completedTaskIds: string[]
  emailAction: EmailAction | null
  emailType: VenueEmailType | null
  followUpDate: string | null
}

interface VenueProgressPanelProps {
  venue: Venue
  tasks: Task[]
  contacts: Contact[]
  deals: Deal[]
  sentEmails: VenueEmail[]
  onClose: () => void
  onConfirm: (updates: ProgressUpdate) => Promise<void>
}

const FOLLOW_UP_OPTIONS = [
  { label: '+3 days', days: 3 },
  { label: '+1 week', days: 7 },
  { label: '+2 weeks', days: 14 },
  { label: '+1 month', days: 30 },
]

function addDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

const STATUS_BADGE: Record<string, string> = {
  not_contacted: 'bg-neutral-800 text-neutral-400',
  reached_out: 'bg-blue-900/50 text-blue-400',
  in_discussion: 'bg-amber-900/50 text-amber-400',
  agreement_sent: 'bg-purple-900/50 text-purple-400',
  booked: 'bg-green-900/50 text-green-400',
  rejected: 'bg-red-900/50 text-red-500',
  archived: 'bg-neutral-800 text-neutral-600',
}

export function VenueProgressPanel({
  venue, tasks, contacts, deals, sentEmails, onClose, onConfirm,
}: VenueProgressPanelProps) {
  const today = new Date().toISOString().split('T')[0]

  // State
  const [newStatus, setNewStatus] = useState<OutreachStatus>(venue.status)
  const [activityCategory, setActivityCategory] = useState<string>('__none__')
  const [activityNote, setActivityNote] = useState('')
  const [checkedTaskIds, setCheckedTaskIds] = useState<Set<string>>(new Set())
  const [emailAction, setEmailAction] = useState<EmailAction | null>(null)
  const [followUpDate, setFollowUpDate] = useState<string>(venue.follow_up_date ?? '')
  const [confirming, setConfirming] = useState(false)
  const [done, setDone] = useState(false)

  // Reset when venue changes
  useEffect(() => {
    setNewStatus(venue.status)
    setActivityCategory('__none__')
    setActivityNote('')
    setCheckedTaskIds(new Set())
    setEmailAction(null)
    setFollowUpDate(venue.follow_up_date ?? '')
    setDone(false)
  }, [venue.id, venue.status, venue.follow_up_date])

  // Today's open tasks
  const todayTasks = useMemo(
    () => tasks.filter(t => !t.completed && (t.due_date === today || !t.due_date)),
    [tasks, today]
  )

  // Overdue tasks
  const overdueTasks = useMemo(
    () => tasks.filter(t => !t.completed && t.due_date && t.due_date < today),
    [tasks, today]
  )

  // Email suggestion
  const suggestion = useMemo(
    () => getNextEmailSuggestion(venue, deals, contacts, sentEmails),
    [venue, deals, contacts, sentEmails]
  )

  const toggleTask = (id: string) => {
    setCheckedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleFollowUpQuick = (days: number) => {
    setFollowUpDate(addDays(days))
  }

  const handleConfirm = async () => {
    setConfirming(true)
    const category = activityCategory === '__none__' ? null : activityCategory
    await onConfirm({
      newStatus: newStatus !== venue.status ? newStatus : null,
      activityCategory: category,
      activityNote: (category === 'other' && activityNote.trim()) ? activityNote.trim() : null,
      completedTaskIds: Array.from(checkedTaskIds),
      emailAction,
      emailType: emailAction && emailAction !== 'skip' ? (suggestion?.type ?? null) : null,
      followUpDate: followUpDate || null,
    })
    setConfirming(false)
    setDone(true)
  }

  const openTaskCount = tasks.filter(t => !t.completed).length

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-16">
        <div className="w-10 h-10 rounded-full bg-green-900/60 border border-green-700 flex items-center justify-center">
          <CheckCheck className="h-5 w-5 text-green-400" />
        </div>
        <p className="text-sm text-neutral-300 font-medium">Updated</p>
        <p className="text-xs text-neutral-600">{venue.name}</p>
        <Button size="sm" variant="outline" onClick={onClose} className="mt-2">Close</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 shrink-0">
        <div className="min-w-0">
          <h2 className="font-semibold text-sm text-white truncate">{venue.name}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', STATUS_BADGE[venue.status])}>
              {OUTREACH_STATUS_LABELS[venue.status]}
            </span>
            <span className="text-[10px] text-neutral-600">{openTaskCount} open task{openTaskCount !== 1 ? 's' : ''}</span>
          </div>
        </div>
        <button onClick={onClose} className="text-neutral-600 hover:text-neutral-300 transition-colors p-1">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Sections */}
      <div className="flex-1 px-4 py-3 space-y-5 overflow-y-auto">

        {/* 1. Status */}
        <section>
          <Label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Status</Label>
          <Select value={newStatus} onValueChange={v => setNewStatus(v as OutreachStatus)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OUTREACH_STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {newStatus !== venue.status && (
            <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              Will update from "{OUTREACH_STATUS_LABELS[venue.status]}"
            </p>
          )}
        </section>

        {/* 2. Activity */}
        <section>
          <Label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">What happened today?</Label>
          <Select value={activityCategory} onValueChange={setActivityCategory}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select an activity..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nothing to log</SelectItem>
              {Object.entries(ACTIVITY_CATEGORY_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {activityCategory === 'other' && (
            <Input
              className="mt-2 text-sm"
              placeholder="Brief note..."
              value={activityNote}
              onChange={e => setActivityNote(e.target.value)}
              maxLength={200}
            />
          )}
        </section>

        {/* 3. Tasks */}
        {(overdueTasks.length > 0 || todayTasks.length > 0) && (
          <section>
            <Label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Tasks to complete</Label>
            <div className="space-y-1">
              {overdueTasks.map(task => (
                <TaskCheckRow
                  key={task.id}
                  task={task}
                  checked={checkedTaskIds.has(task.id)}
                  onToggle={toggleTask}
                  overdue
                />
              ))}
              {todayTasks.map(task => (
                <TaskCheckRow
                  key={task.id}
                  task={task}
                  checked={checkedTaskIds.has(task.id)}
                  onToggle={toggleTask}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. Suggested email */}
        <section>
          <Label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Next email</Label>
          {suggestion ? (
            <div className="border border-neutral-800 rounded-lg p-3 space-y-2 bg-neutral-900/50">
              <div>
                <p className="text-sm font-medium text-neutral-200">{suggestion.label}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{suggestion.reason}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEmailAction(emailAction === 'send' ? null : 'send')}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors',
                    emailAction === 'send'
                      ? 'bg-white text-black border-white'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                  )}
                >
                  <Send className="h-3 w-3" /> Send now
                </button>
                <button
                  onClick={() => setEmailAction(emailAction === 'queue' ? null : 'queue')}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded border transition-colors',
                    emailAction === 'queue'
                      ? 'bg-blue-900 text-blue-200 border-blue-700'
                      : 'border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-200'
                  )}
                >
                  <Clock className="h-3 w-3" /> Add to queue
                </button>
                <button
                  onClick={() => setEmailAction(emailAction === 'skip' ? null : 'skip')}
                  className={cn(
                    'text-xs px-2.5 py-1.5 rounded border transition-colors',
                    emailAction === 'skip'
                      ? 'border-neutral-600 text-neutral-400'
                      : 'border-neutral-800 text-neutral-600 hover:text-neutral-400'
                  )}
                >
                  Skip
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-neutral-600 py-2">No email needed right now.</p>
          )}
        </section>

        {/* 5. Follow-up */}
        <section>
          <Label className="text-xs text-neutral-500 uppercase tracking-wider mb-2 block">Follow-up date</Label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {FOLLOW_UP_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => handleFollowUpQuick(opt.days)}
                className="text-xs px-2.5 py-1 rounded border border-neutral-800 text-neutral-400 hover:border-neutral-600 hover:text-neutral-200 transition-colors"
              >
                {opt.label}
              </button>
            ))}
            {followUpDate && (
              <button
                onClick={() => setFollowUpDate('')}
                className="text-xs px-2.5 py-1 rounded border border-neutral-800 text-neutral-600 hover:text-red-400 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          <Input
            type="date"
            value={followUpDate}
            onChange={e => setFollowUpDate(e.target.value)}
            className="text-sm"
          />
        </section>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-800 flex items-center gap-2 shrink-0">
        <Button
          className="flex-1"
          onClick={handleConfirm}
          disabled={confirming}
        >
          {confirming ? 'Saving...' : 'Confirm & Continue'}
        </Button>
        <Button variant="ghost" onClick={onClose} className="text-neutral-500">
          Cancel
        </Button>
      </div>
    </div>
  )
}

// Internal sub-component for task rows
function TaskCheckRow({
  task, checked, onToggle, overdue = false,
}: {
  task: Task
  checked: boolean
  onToggle: (id: string) => void
  overdue?: boolean
}) {
  return (
    <label
      className={cn(
        'flex items-start gap-2.5 py-1.5 px-2 rounded cursor-pointer hover:bg-neutral-800/60 transition-colors',
        overdue && 'border-l-2 border-red-600 pl-2.5'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(task.id)}
        className="mt-0.5 accent-white shrink-0"
      />
      <div className="min-w-0">
        <span className={cn('text-sm', checked ? 'line-through text-neutral-600' : 'text-neutral-300')}>
          {task.title}
        </span>
        {overdue && task.due_date && (
          <span className="block text-[10px] text-red-400">Due {task.due_date}</span>
        )}
      </div>
    </label>
  )
}
