import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { queueImmediateEmailsForTemplate } from '@/lib/queueEmailsFromTemplate'
import type { TaskTemplate, TaskTemplateItem, TaskPriority, TaskRecurrence } from '@/types'

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
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
    dealId?: string | null
  ): Promise<{ count: number; emailsQueued?: number; error?: Error }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { count: 0, error: new Error('Not authenticated') }

    const template = templates.find(t => t.id === templateId)
    if (!template || !template.items?.length) return { count: 0 }

    const today = new Date().toISOString().split('T')[0]
    const inserts = template.items.map(item => ({
      user_id: user.id,
      title: item.title,
      notes: item.notes ?? null,
      due_date: item.days_offset === 0 ? today : addDays(today, item.days_offset),
      priority: item.priority,
      recurrence: item.recurrence,
      venue_id: venueId,
      deal_id: dealId ?? null,
      email_type: item.email_type ?? null,
      generated_file_id: item.generated_file_id ?? null,
      completed: false,
    }))

    const { error } = await supabase.from('tasks').insert(inserts)
    if (error) return { count: 0, error: new Error(error.message) }

    const { queued: emailsQueued } = await queueImmediateEmailsForTemplate(venueId, template, dealId)
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

    const defaults: Array<{
      name: string; description: string; trigger_status: string | null
      items: Array<{ title: string; days_offset: number; priority: TaskPriority; sort_order: number; email_type?: string | null }>
    }> = [
      {
        name: 'New Venue Outreach',
        description: 'Standard tasks for when you first reach out to a venue.',
        trigger_status: 'reached_out',
        items: [
          { title: 'Send intro email', days_offset: 0, priority: 'high', sort_order: 0, email_type: 'follow_up' },
          { title: 'Follow-up call or check-in', days_offset: 3, priority: 'medium', sort_order: 1, email_type: null },
          { title: 'Send agreement', days_offset: 7, priority: 'medium', sort_order: 2, email_type: 'agreement_ready' },
        ],
      },
      {
        name: 'Booked Venue',
        description: 'Tasks to complete once a venue is booked.',
        trigger_status: 'booked',
        items: [
          { title: 'Confirm booking details', days_offset: 0, priority: 'high', sort_order: 0, email_type: 'booking_confirmation' },
          { title: 'Post-event check-in', days_offset: 1, priority: 'low', sort_order: 1, email_type: null },
        ],
      },
    ]

    for (const def of defaults) {
      const { data: t, error } = await supabase
        .from('task_templates')
        .insert({ user_id: user.id, name: def.name, description: def.description, trigger_status: def.trigger_status })
        .select()
        .single()
      if (error || !t) continue
      await supabase.from('task_template_items').insert(
        def.items.map(item => ({ template_id: t.id, ...item, recurrence: 'none' as const }))
      )
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
      { template_id: t.id, title: 'Post-show follow-up with venue', days_offset: 7, priority: 'medium' as TaskPriority, recurrence: 'none' as TaskRecurrence, sort_order: 2, email_type: null },
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
    seedPerformanceTemplate,
  }
}
