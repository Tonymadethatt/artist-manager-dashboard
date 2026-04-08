import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  queueEmailAutomationForCompletedTask,
  loadAgreementResolutionForTask,
  taskEmailAutomationUserMessage,
  taskEmailAutomationSuccessMessage,
  taskEmailAutomationInfoMessage,
  type QueueEmailOnTaskCompleteOptions,
} from '@/lib/queueEmailOnTaskComplete'
import type { Task, TaskPriority, TaskRecurrence } from '@/types'

export type EmailAutomationFeedback =
  | { kind: 'error'; message: string }
  | { kind: 'success'; message: string }
  | { kind: 'info'; message: string }

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

const AGREEMENT_READY_GUARD_MSG =
  'Add an agreement URL or PDF on the deal, link a PDF on this task, or paste a URL in the progress panel before completing this task.'

function nextDueDate(dueDate: string, recurrence: TaskRecurrence): string | null {
  if (recurrence === 'none') return null
  if (recurrence === 'daily') return addDays(dueDate, 1)
  if (recurrence === 'weekly') return addDays(dueDate, 7)
  if (recurrence === 'monthly') {
    const d = new Date(dueDate)
    d.setMonth(d.getMonth() + 1)
    return d.toISOString().split('T')[0]
  }
  return null
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailAutomationFeedback, setEmailAutomationFeedback] = useState<EmailAutomationFeedback | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        venue:venues(id, name),
        deal:deals(id, description),
        agreement_file:generated_files!tasks_generated_file_id_fkey(id, name)
      `)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTasks((data ?? []) as Task[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const addTask = async (task: {
    title: string
    notes: string | null
    due_date: string | null
    priority: TaskPriority
    recurrence: TaskRecurrence
    venue_id: string | null
    deal_id: string | null
    email_type?: string | null
    generated_file_id?: string | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title: task.title,
        notes: task.notes,
        due_date: task.due_date,
        priority: task.priority,
        recurrence: task.recurrence,
        venue_id: task.venue_id,
        deal_id: task.deal_id,
        email_type: task.email_type ?? null,
        generated_file_id: task.generated_file_id ?? null,
      })
      .select(`
        *,
        venue:venues(id, name),
        deal:deals(id, description),
        agreement_file:generated_files!tasks_generated_file_id_fkey(id, name)
      `)
      .single()
    if (error) return { error }
    setTasks(prev => [data as Task, ...prev])
    return { data: data as Task }
  }

  const updateTask = async (id: string, updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'venue' | 'deal' | 'agreement_file'>>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        venue:venues(id, name),
        deal:deals(id, description),
        agreement_file:generated_files!tasks_generated_file_id_fkey(id, name)
      `)
      .single()
    if (error) return { error }
    setTasks(prev => prev.map(t => t.id === id ? data as Task : t))
    return { data: data as Task }
  }

  const deleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return { error }
    setTasks(prev => prev.filter(t => t.id !== id))
    return {}
  }

  const completeTask = async (id: string, emailOptions?: QueueEmailOnTaskCompleteOptions) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return { error: new Error('Task not found') }
    setEmailAutomationFeedback(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    if (task.email_type === 'agreement_ready') {
      const resolution = await loadAgreementResolutionForTask(task, emailOptions)
      if (!resolution.url) {
        setEmailAutomationFeedback({ kind: 'error', message: AGREEMENT_READY_GUARD_MSG })
        return { error: new Error(AGREEMENT_READY_GUARD_MSG) }
      }
    }

    const completedAt = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ completed: true, completed_at: completedAt })
      .eq('id', id)

    if (updateError) {
      return { error: new Error(updateError.message) }
    }

    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completed_at: completedAt } : t))

    // Spawn next recurrence if applicable
    if (task.recurrence !== 'none' && task.due_date) {
      const nextDue = nextDueDate(task.due_date, task.recurrence)
      if (nextDue) {
        const { data: spawned } = await supabase
          .from('tasks')
          .insert({
            user_id: user.id,
            title: task.title,
            notes: task.notes,
            due_date: nextDue,
            priority: task.priority,
            recurrence: task.recurrence,
            venue_id: task.venue_id,
            deal_id: task.deal_id,
            email_type: task.email_type ?? null,
            generated_file_id: task.generated_file_id ?? null,
          })
          .select(`
            *,
            venue:venues(id, name),
            deal:deals(id, description),
            agreement_file:generated_files!tasks_generated_file_id_fkey(id, name)
          `)
          .single()
        if (spawned) setTasks(prev => [spawned as Task, ...prev])
      }
    }

    const { data: freshTask } = await supabase
      .from('tasks')
      .select(`
        *,
        venue:venues(id, name),
        deal:deals(id, description),
        agreement_file:generated_files!tasks_generated_file_id_fkey(id, name)
      `)
      .eq('id', id)
      .single()

    const completedTaskRow = (freshTask ?? task) as Task
    const autoResult = await queueEmailAutomationForCompletedTask(completedTaskRow, emailOptions ?? {})
    if (completedTaskRow.email_type) {
      if (!autoResult.ok) {
        const msg = taskEmailAutomationUserMessage(autoResult.reason).trim()
        if (msg) setEmailAutomationFeedback({ kind: 'error', message: msg })
      } else {
        const success = taskEmailAutomationSuccessMessage(autoResult.reason)
        const info = taskEmailAutomationInfoMessage(autoResult.reason)
        if (success) setEmailAutomationFeedback({ kind: 'success', message: success })
        else if (info) setEmailAutomationFeedback({ kind: 'info', message: info })
      }
    }

    return { automation: autoResult }
  }

  const uncompleteTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    const result = await updateTask(id, { completed: false, completed_at: null })

    // Cancel any pending email queue entry that was created when this task was completed.
    // Match by user, email_type, and recent creation time (within last 2 hours) so we
    // don't accidentally cancel unrelated rows of the same type.
    if (task?.email_type) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        await supabase
          .from('venue_emails')
          .delete()
          .eq('user_id', user.id)
          .eq('email_type', task.email_type)
          .eq('status', 'pending')
          .gte('created_at', twoHoursAgo)

        if (task.email_type === 'performance_report_request') {
          let venueIdForCleanup: string | null = task.venue_id
          if (!venueIdForCleanup && task.deal_id) {
            const { data: dr } = await supabase
              .from('deals')
              .select('venue_id')
              .eq('id', task.deal_id)
              .maybeSingle()
            venueIdForCleanup = (dr as { venue_id: string } | null)?.venue_id ?? null
          }
          const dealKey = task.deal_id ?? null
            if (venueIdForCleanup) {
            let qPerf = supabase
              .from('performance_reports')
              .delete()
              .eq('user_id', user.id)
              .eq('venue_id', venueIdForCleanup)
              .eq('submitted', false)
              .eq('creation_source', 'task_automation')
              .gte('created_at', twoHoursAgo)
            qPerf = dealKey ? qPerf.eq('deal_id', dealKey) : qPerf.is('deal_id', null)
            await qPerf
          }
        }
      }
    }

    return result
  }

  const snoozeTask = async (id: string, days = 1) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return { error: new Error('Task not found') }
    const base = task.due_date ?? new Date().toISOString().split('T')[0]
    return updateTask(id, { due_date: addDays(base, days) })
  }

  const dismissEmailAutomationFeedback = useCallback(() => setEmailAutomationFeedback(null), [])

  return {
    tasks,
    loading,
    error,
    emailAutomationFeedback,
    dismissEmailAutomationFeedback,
    refetch: fetchTasks,
    addTask,
    updateTask,
    deleteTask,
    completeTask,
    uncompleteTask,
    snoozeTask,
  }
}
