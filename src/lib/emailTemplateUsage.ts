import { supabase } from '@/lib/supabase'

export type EmailTemplateUsage = {
  pipelineTemplateItemCount: number
  taskCount: number
}

/**
 * Counts references to an email_type (built-in or `custom:<uuid>`) in the current user's
 * pipeline template items and tasks.
 */
export async function fetchEmailTemplateUsage(emailType: string): Promise<EmailTemplateUsage> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { pipelineTemplateItemCount: 0, taskCount: 0 }
  }

  const { data: templates } = await supabase
    .from('task_templates')
    .select('id')
    .eq('user_id', user.id)

  const templateIds = (templates ?? []).map(t => t.id)

  let pipelineTemplateItemCount = 0
  if (templateIds.length > 0) {
    const { count } = await supabase
      .from('task_template_items')
      .select('id', { count: 'exact', head: true })
      .eq('email_type', emailType)
      .in('template_id', templateIds)
    pipelineTemplateItemCount = count ?? 0
  }

  const { count: taskCnt } = await supabase
    .from('tasks')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('email_type', emailType)

  return {
    pipelineTemplateItemCount,
    taskCount: taskCnt ?? 0,
  }
}
