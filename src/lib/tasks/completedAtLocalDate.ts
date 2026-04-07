import type { Task } from '@/types'

/** Local calendar YYYY-MM-DD for an ISO timestamp (e.g. completed_at). */
export function completedAtLocalYmd(completedAt: string | null | undefined): string | null {
  if (!completedAt) return null
  const d = new Date(completedAt)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isTaskCompletedToday(task: Task, todayYmd: string): boolean {
  if (!task.completed) return false
  return completedAtLocalYmd(task.completed_at) === todayYmd
}
