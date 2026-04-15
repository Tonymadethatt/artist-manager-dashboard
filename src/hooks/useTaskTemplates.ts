import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { queueImmediateEmailsForTemplate } from '@/lib/queueEmailsFromTemplate'
import { resolveDealIdForTemplateApply, type DealPickOption } from '@/lib/tasks/resolveDealIdForTemplateApply'
import type { TaskTemplate, TaskTemplateItem, TaskPriority, TaskRecurrence } from '@/types'

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

type SeedItem = {
  title: string
  days_offset: number
  priority: TaskPriority
  sort_order: number
  email_type?: string | null
  notes?: string | null
}

type SeedPack = {
  name: string
  description: string
  trigger_status: string | null
  items: SeedItem[]
}

const DEFAULT_NEW_ACCOUNT_PACKS: SeedPack[] = [
  {
    name: 'New venue outreach',
    description: 'Standard flow from first touch through sending the agreement link.',
    trigger_status: 'reached_out',
    items: [
      {
        title: 'Send first outreach email',
        days_offset: 0,
        priority: 'high',
        sort_order: 0,
        email_type: 'first_outreach',
        notes:
          'On complete: queues first-outreach email to the venue\'s primary contact. Ensure the venue has a contact with email.',
      },
      {
        title: 'Check in (call, DM, or second touch)',
        days_offset: 2,
        priority: 'medium',
        sort_order: 1,
        email_type: null,
        notes: 'No auto email. Use this to confirm interest before you prepare the agreement.',
      },
      {
        title: 'Prepare agreement on the deal',
        days_offset: 4,
        priority: 'high',
        sort_order: 2,
        email_type: null,
        notes:
          'Do this before the next task. Link a generated PDF on the deal/task or set the deal\'s agreement URL. Completing "Send agreement ready" without this = no email.',
      },
      {
        title: 'Send agreement ready to venue',
        days_offset: 5,
        priority: 'high',
        sort_order: 3,
        email_type: 'agreement_ready',
        notes:
          'On complete: queues Agreement ready email. Requires agreement URL/PDF on the deal (or agreement URL from the progress panel when you complete from there).',
      },
    ],
  },
  {
    name: 'Booked venue',
    description: 'Tasks once the engagement is booked.',
    trigger_status: 'booked',
    items: [
      {
        title: 'Confirm booking details with venue',
        days_offset: 0,
        priority: 'high',
        sort_order: 0,
        email_type: 'booking_confirmation',
        notes: 'On complete: queues booking confirmation email. Deal should reflect final fee and date.',
      },
      {
        title: 'Internal prep: calendar, travel, asset checklist',
        days_offset: 1,
        priority: 'medium',
        sort_order: 1,
        email_type: null,
        notes: 'Optional ops task; no email.',
      },
      {
        title: 'Pre-event check-in with venue',
        days_offset: 14,
        priority: 'low',
        sort_order: 2,
        email_type: 'pre_event_checkin',
        notes: 'On complete: queues pre-event logistics email. Deal should list date and fee.',
      },
    ],
  },
]

/** Idempotent inserts when the user has no template for that trigger_status (existing accounts). */
const MISSING_STATUS_PACKS: SeedPack[] = [
  {
    name: 'Before first outreach',
    description: 'Light checklist so you do not advance empty-handed.',
    trigger_status: 'not_contacted',
    items: [
      {
        title: 'Confirm venue contact and email',
        days_offset: 0,
        priority: 'medium',
        sort_order: 0,
        email_type: null,
        notes:
          'Add a primary contact with a real email before moving to Reached Out. Without it, queued client emails will fail.',
      },
    ],
  },
  {
    name: 'In discussion — contract path',
    description: 'Tasks when you\'re actively negotiating and moving toward a written agreement.',
    trigger_status: 'in_discussion',
    items: [
      {
        title: 'Align fee, date, and logistics on the deal',
        days_offset: 0,
        priority: 'high',
        sort_order: 0,
        email_type: null,
        notes: 'Update the deal record so numbers and event date match what you discussed.',
      },
      {
        title: 'Finalize agreement PDF or URL on the deal',
        days_offset: 2,
        priority: 'high',
        sort_order: 1,
        email_type: null,
        notes: 'Same prep rule as Reached Out: attachment or agreement URL must exist before sending agreement email.',
      },
      {
        title: 'Send agreement ready to venue',
        days_offset: 3,
        priority: 'high',
        sort_order: 2,
        email_type: 'agreement_ready',
        notes: 'Queues agreement email once the file/URL exists.',
      },
    ],
  },
  {
    name: 'Agreement sent — close the loop',
    description: 'Administrative follow-through after the agreement leaves your hands.',
    trigger_status: 'agreement_sent',
    items: [
      {
        title: 'Confirm venue received the agreement',
        days_offset: 0,
        priority: 'medium',
        sort_order: 0,
        email_type: null,
        notes: 'Quick confirmation; no auto email (avoids duplicate "agreement" mails).',
      },
      {
        title: 'Send agreement follow-up to venue',
        days_offset: 2,
        priority: 'medium',
        sort_order: 1,
        email_type: 'agreement_followup',
        notes:
          'On complete: queues a short signature nudge. Requires agreement URL/PDF on the deal (same as agreement ready).',
      },
      {
        title: 'Track signature or countersign',
        days_offset: 5,
        priority: 'medium',
        sort_order: 2,
        email_type: null,
        notes: 'Internal follow-up until fully executed.',
      },
      {
        title: 'Set payment due dates on the deal (if applicable)',
        days_offset: 10,
        priority: 'low',
        sort_order: 3,
        email_type: null,
        notes:
          'Prepares the record for Booked / payment workflows. No payment_reminder here to avoid nagging before a booking is real.',
      },
    ],
  },
  {
    name: 'Post follow-up housekeeping',
    description: 'Close the loop after a follow-up status.',
    trigger_status: 'post_follow_up',
    items: [
      {
        title: 'Log result and next step',
        days_offset: 0,
        priority: 'medium',
        sort_order: 0,
        email_type: null,
        notes: 'Keep the venue record truthful for reporting.',
      },
      {
        title: 'Plan re-engage date or archive',
        days_offset: 7,
        priority: 'low',
        sort_order: 1,
        email_type: null,
        notes: 'Decide whether to snooze, move to rebooking, or close out.',
      },
    ],
  },
  {
    name: 'Rebooking push',
    description: 'Tasks when working a rebooking cycle.',
    trigger_status: 'rebooking',
    items: [
      {
        title: 'Send rebooking inquiry',
        days_offset: 0,
        priority: 'medium',
        sort_order: 0,
        email_type: 'rebooking_inquiry',
        notes: 'On complete: queues rebooking email to venue contact.',
      },
      {
        title: 'Follow up on rebooking thread',
        days_offset: 5,
        priority: 'medium',
        sort_order: 1,
        email_type: null,
        notes: 'Second touch if they go quiet.',
      },
    ],
  },
]

async function insertPackRow(userId: string, def: SeedPack) {
  const { data: t, error } = await supabase
    .from('task_templates')
    .insert({
      user_id: userId,
      name: def.name,
      description: def.description,
      trigger_status: def.trigger_status,
    })
    .select()
    .single()
  if (error || !t) return
  await supabase.from('task_template_items').insert(
    def.items.map(item => ({
      template_id: t.id,
      title: item.title,
      notes: item.notes ?? null,
      days_offset: item.days_offset,
      priority: item.priority,
      sort_order: item.sort_order,
      email_type: item.email_type ?? null,
      recurrence: 'none' as const,
    })),
  )
}

export function useTaskTemplates() {
  const [templates, setTemplates] = useState<TaskTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchTemplates = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('task_templates')
      .select('*, items:task_template_items(*)')
      .order('created_at', { ascending: true })
    if (error) setError(error.message)
    else {
      const sorted = (data ?? []).map(t => ({
        ...t,
        items: [...(t.items ?? [])].sort((a, b) => a.sort_order - b.sort_order),
      }))
      setTemplates(sorted as TaskTemplate[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchTemplates() }, [fetchTemplates])

  const addTemplate = async (data: { name: string; description?: string | null; trigger_status?: string | null }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { data: created, error } = await supabase
      .from('task_templates')
      .insert({ user_id: user.id, name: data.name, description: data.description ?? null, trigger_status: data.trigger_status ?? null })
      .select('*, items:task_template_items(*)')
      .single()
    if (error) return { error: new Error(error.message) }
    const t = { ...created, items: [] } as TaskTemplate
    setTemplates(prev => [...prev, t])
    return { data: t }
  }

  const updateTemplate = async (id: string, updates: { name?: string; description?: string | null; trigger_status?: string | null }) => {
    const { data, error } = await supabase
      .from('task_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: new Error(error.message) }
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    return { data }
  }

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('task_templates').delete().eq('id', id)
    if (error) return { error: new Error(error.message) }
    setTemplates(prev => prev.filter(t => t.id !== id))
    return {}
  }

  const addTemplateItem = async (templateId: string, item: {
    title: string; notes?: string | null; days_offset: number
    priority: TaskPriority; recurrence: TaskRecurrence; sort_order?: number
    email_type?: string | null
    generated_file_id?: string | null
  }) => {
    const sortOrder = item.sort_order ?? (templates.find(t => t.id === templateId)?.items?.length ?? 0)
    const { data, error } = await supabase
      .from('task_template_items')
      .insert({
        template_id: templateId,
        title: item.title,
        notes: item.notes ?? null,
        days_offset: item.days_offset,
        priority: item.priority,
        recurrence: item.recurrence,
        sort_order: sortOrder,
        email_type: item.email_type ?? null,
        generated_file_id: item.generated_file_id ?? null,
      })
      .select()
      .single()
    if (error) return { error: new Error(error.message) }
    const newItem = data as TaskTemplateItem
    setTemplates(prev => prev.map(t => t.id === templateId
      ? { ...t, items: [...(t.items ?? []), newItem] }
      : t
    ))
    return { data: newItem }
  }

  const updateTemplateItem = async (itemId: string, templateId: string, updates: Partial<Omit<TaskTemplateItem, 'id' | 'template_id' | 'created_at'>>) => {
    const { data, error } = await supabase
      .from('task_template_items')
      .update(updates)
      .eq('id', itemId)
      .select()
      .single()
    if (error) return { error: new Error(error.message) }
    const updated = data as TaskTemplateItem
    setTemplates(prev => prev.map(t => t.id === templateId
      ? { ...t, items: (t.items ?? []).map(i => i.id === itemId ? updated : i) }
      : t
    ))
    return { data: updated }
  }

  const deleteTemplateItem = async (itemId: string, templateId: string) => {
    const { error } = await supabase.from('task_template_items').delete().eq('id', itemId)
    if (error) return { error: new Error(error.message) }
    setTemplates(prev => prev.map(t => t.id === templateId
      ? { ...t, items: (t.items ?? []).filter(i => i.id !== itemId) }
      : t
    ))
    return {}
  }

  // Batch-creates tasks from a template linked to a venue (and optionally a deal)
  const applyTemplate = async (
    templateId: string,
    venueId: string,
    dealId?: string | null,
  ): Promise<{
    count: number
    emailsQueued?: number
    error?: Error
    needsDealPick?: boolean
    dealOptions?: DealPickOption[]
  }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { count: 0, error: new Error('Not authenticated') }

    const template = templates.find(t => t.id === templateId)
    if (!template || !template.items?.length) return { count: 0 }

    const resolved = await resolveDealIdForTemplateApply(venueId, dealId)
    if (!resolved.ok) {
      return { count: 0, needsDealPick: true, dealOptions: resolved.options }
    }
    const effectiveDealId = resolved.dealId

    const today = new Date().toISOString().split('T')[0]
    const inserts = template.items.map(item => ({
      user_id: user.id,
      title: item.title,
      notes: item.notes ?? null,
      due_date: item.days_offset === 0 ? today : addDays(today, item.days_offset),
      priority: item.priority,
      recurrence: item.recurrence,
      venue_id: venueId,
      deal_id: effectiveDealId,
      email_type: item.email_type ?? null,
      generated_file_id: item.generated_file_id ?? null,
      completed: false,
    }))

    const { error } = await supabase.from('tasks').insert(inserts)
    if (error) return { count: 0, error: new Error(error.message) }

    const { queued: emailsQueued } = await queueImmediateEmailsForTemplate(venueId, template, effectiveDealId)
    return { count: inserts.length, emailsQueued }
  }

  // Seed default templates if user has none — called from PipelineTemplates on first load
  const seedDefaultTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { count } = await supabase
      .from('task_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if ((count ?? 0) > 0) return // already seeded

    for (const def of DEFAULT_NEW_ACCOUNT_PACKS) {
      await insertPackRow(user.id, def)
    }

    await fetchTemplates()
  }

  // Idempotently seeds standard packs for trigger_statuses that have no template yet (existing accounts).
  const seedMissingPipelineStatusTemplates = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    for (const def of MISSING_STATUS_PACKS) {
      if (!def.trigger_status) continue
      const { count } = await supabase
        .from('task_templates')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('trigger_status', def.trigger_status)
      if ((count ?? 0) > 0) continue
      await insertPackRow(user.id, def)
    }

    await fetchTemplates()
  }

  // Idempotently seeds the Post-Performance Pack template for new AND existing users.
  // Uses trigger_status='performed' check so it never conflicts with seedDefaultTemplates.
  const seedPerformanceTemplate = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { count } = await supabase
      .from('task_templates')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('trigger_status', 'performed')
    if ((count ?? 0) > 0) return // already exists

    const { data: t, error } = await supabase
      .from('task_templates')
      .insert({
        user_id: user.id,
        name: 'Post-Performance Pack',
        description: 'Auto-tasks after a show is marked as performed.',
        trigger_status: 'performed',
      })
      .select()
      .single()
    if (error || !t) return

    await supabase.from('task_template_items').insert([
      { template_id: t.id, title: 'Send performance report form', days_offset: 0, priority: 'high' as TaskPriority, recurrence: 'none' as TaskRecurrence, sort_order: 0, email_type: 'performance_report_request' },
      { template_id: t.id, title: 'Review show notes and update deal record', days_offset: 3, priority: 'medium' as TaskPriority, recurrence: 'none' as TaskRecurrence, sort_order: 1, email_type: null },
      { template_id: t.id, title: 'Post-show thank-you to venue', days_offset: 7, priority: 'medium' as TaskPriority, recurrence: 'none' as TaskRecurrence, sort_order: 2, email_type: 'post_show_thanks' },
    ])

    await fetchTemplates()
  }

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addTemplateItem,
    updateTemplateItem,
    deleteTemplateItem,
    applyTemplate,
    seedDefaultTemplates,
    seedMissingPipelineStatusTemplates,
    seedPerformanceTemplate,
  }
}
