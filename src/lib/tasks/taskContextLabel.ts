import type { Task, Venue } from '@/types'

/** Secondary line under the task title in Pipeline list / General board card. */
export function taskPipelineContextLabel(
  task: Task,
  venues: Pick<Venue, 'id' | 'name'>[],
): string | undefined {
  if (task.venue_id) {
    return venues.find(v => v.id === task.venue_id)?.name
  }
  if (task.lead_id) {
    const n = task.lead?.venue_name?.trim()
    return n ? `Lead · ${n}` : 'Lead follow-up'
  }
  return undefined
}
