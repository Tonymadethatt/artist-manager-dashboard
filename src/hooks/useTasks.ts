import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { queueEmailAutomationForCompletedTask } from '@/lib/queueEmailOnTaskComplete'
import type { Task, TaskPriority, TaskRecurrence } from '@/types'

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

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

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('tasks')
      .select('*, venue:venues(id, name), deal:deals(id, description)')
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
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('tasks')
      .insert({ user_id: user.id, ...task })
      .select('*, venue:venues(id, name), deal:deals(id, description)')
      .single()
    if (error) return { error }
    setTasks(prev => [data as Task, ...prev])
    return { data: data as Task }
  }

  const updateTask = async (id: string, updates: Partial<Omit<Task, 'id' | 'user_id' | 'created_at' | 'venue' | 'deal'>>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select('*, venue:venues(id, name), deal:deals(id, description)')
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

  const completeTask = async (id: string) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return { error: new Error('Task not found') }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    // Mark current task complete
    await supabase
      .from('tasks')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', id)

    setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t))

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
          })
          .select('*, venue:venues(id, name), deal:deals(id, description)')
          .single()
        if (spawned) setTasks(prev => [spawned as Task, ...prev])
      }
    }

    await queueEmailAutomationForCompletedTask(task, {})

    return {}
  }

  const uncompleteTask = async (id: string) => {
    return updateTask(id, { completed: false, completed_at: null })
  }

  const snoozeTask = async (id: string, days = 1) => {
    const task = tasks.find(t => t.id === id)
    if (!task) return { error: new Error('Task not found') }
    const base = task.due_date ?? new Date().toISOString().split('T')[0]
    return updateTask(id, { due_date: addDays(base, days) })
  }

  return { tasks, loading, error, refetch: fetchTasks, addTask, updateTask, deleteTask, completeTask, uncompleteTask, snoozeTask }
}
