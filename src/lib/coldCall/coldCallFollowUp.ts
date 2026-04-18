import { supabase } from '@/lib/supabase'
import type { ColdCallDataV1, ColdCallOutcome } from '@/lib/coldCall/coldCallPayload'
import { computeColdCallOutcomeAuto } from '@/lib/coldCall/coldCallOutcomeAuto'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(base: Date, n: number): string {
  const x = new Date(base)
  x.setDate(x.getDate() + n)
  return ymd(x)
}

function addBusinessDays(base: Date, n: number): string {
  const x = new Date(base)
  let left = n
  while (left > 0) {
    x.setDate(x.getDate() + 1)
    const dow = x.getDay()
    if (dow !== 0 && dow !== 6) left -= 1
  }
  return ymd(x)
}

/** ISO date (YYYY-MM-DD) suggestion when entering post-call; empty if none. */
export function suggestColdCallFollowUpDate(d: ColdCallDataV1): string {
  const now = new Date()
  if (d.who_answered === 'voicemail') {
    if (d.voicemail_followup_timing === 'tomorrow') return addDays(now, 1)
    if (d.voicemail_followup_timing === 'few_days') return addDays(now, 3)
    if (d.voicemail_followup_timing === 'next_week') return addDays(now, 7)
    return ''
  }
  if (d.who_answered === 'no_answer') {
    if (d.no_answer_retry_timing === 'later_today') return ymd(now)
    if (d.no_answer_retry_timing === 'tomorrow') return addDays(now, 1)
    if (d.no_answer_retry_timing === 'next_week') return addDays(now, 7)
    return ''
  }
  if (d.gatekeeper_result === 'gave_name') return addDays(now, 2)
  if (d.gatekeeper_result === 'message') return addDays(now, 3)
  if (d.parking_result === 'try_later') return addDays(now, 30)
  if (d.ask_response === 'send_info_first') return addDays(now, 4)
  if (d.ask_response === 'check_back') {
    if (d.ask_followup_when === 'few_days') return addDays(now, 3)
    if (d.ask_followup_when === 'next_week') return addDays(now, 7)
    if (d.ask_followup_when === 'end_of_month') {
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      return ymd(end)
    }
    if (d.ask_followup_when === 'they_reach_out') return ''
    return addBusinessDays(now, 4)
  }
  if (d.ask_response === 'yes_setup') return addDays(now, 2)
  const temp = d.operator_temperature || d.final_temperature
  if (temp === 'hot' || temp === 'converting') return addDays(now, 2)
  if (temp === 'warm') return addDays(now, 4)
  return ''
}

export function coldCallShouldAutoCreateTask(d: ColdCallDataV1): boolean {
  if (d.who_answered === 'voicemail') {
    return d.voicemail_left === 'left' && d.voicemail_followup_timing !== '' && d.voicemail_followup_timing !== 'dont_retry'
  }
  if (d.who_answered === 'no_answer') {
    return d.no_answer_retry_timing !== '' && d.no_answer_retry_timing !== 'remove'
  }
  const o = computeColdCallOutcomeAuto(d)
  const followUpOutcomes: ColdCallOutcome[] = [
    'gatekeeper_info',
    'interested_followup',
    'interested_sending',
    'very_interested_proposal',
    'voicemail',
    'no_answer',
  ]
  return followUpOutcomes.includes(o)
}

export function coldCallFollowUpTaskTitle(d: ColdCallDataV1): string {
  const vn = d.venue_name.trim() || 'Venue'
  const purpose = d.call_purpose ? d.call_purpose.replace(/_/g, ' ') : 'cold call'
  return `Follow up: ${vn} — ${purpose}`
}

export function coldCallFollowUpTaskNotes(d: ColdCallDataV1, callDateIso: string | null): string {
  const o = computeColdCallOutcomeAuto(d)
  const temp = d.final_temperature || d.operator_temperature || '—'
  const note = d.call_notes.trim().slice(0, 100)
  const parts = [
    `Cold call${callDateIso ? ` on ${callDateIso.slice(0, 10)}` : ''}.`,
    `Temperature: ${temp}.`,
    `Outcome: ${o}.`,
  ]
  if (note) parts.push(`Notes: ${note}`)
  return parts.join(' ')
}

export async function coldCallEnsureFollowUpTask(params: {
  coldCallId: string
  data: ColdCallDataV1
  rowVenueId: string | null
  existingTaskId: string | null
  callDateIso: string | null
}): Promise<{ taskId: string | null; error?: string }> {
  if (params.existingTaskId) return { taskId: params.existingTaskId }
  if (!coldCallShouldAutoCreateTask(params.data)) return { taskId: null }
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return { taskId: null, error: 'Not signed in' }

  let due = suggestColdCallFollowUpDate(params.data)
  if (!due) {
    const t = new Date()
    t.setDate(t.getDate() + 1)
    due = t.toISOString().slice(0, 10)
  }

  const title = coldCallFollowUpTaskTitle(params.data)
  const notes = coldCallFollowUpTaskNotes(params.data, params.callDateIso)

  const { data: ins, error } = await supabase
    .from('tasks')
    .insert({
      user_id: auth.user.id,
      title,
      notes,
      due_date: due,
      completed: false,
      priority: 'medium',
      recurrence: 'none',
      venue_id: params.rowVenueId,
      deal_id: null,
      cold_call_id: params.coldCallId,
    })
    .select('id')
    .single()

  if (error || !ins?.id) return { taskId: null, error: error?.message ?? 'Could not create task' }
  return { taskId: ins.id as string }
}
