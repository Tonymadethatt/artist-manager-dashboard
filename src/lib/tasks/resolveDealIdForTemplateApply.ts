import { supabase } from '@/lib/supabase'

export type DealPickOption = { id: string; description: string; event_date: string | null }

/**
 * Resolves which deal to attach to tasks when applying a pipeline template.
 * 0 deals → null; 1 deal → that id; 2+ without explicit id → needsPick.
 */
export async function resolveDealIdForTemplateApply(
  venueId: string,
  explicitDealId: string | null | undefined,
): Promise<
  | { ok: true; dealId: string | null }
  | { ok: false; needsPick: true; options: DealPickOption[] }
> {
  if (explicitDealId) return { ok: true, dealId: explicitDealId }

  const { data, error } = await supabase
    .from('deals')
    .select('id, description, event_date')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })

  if (error) return { ok: true, dealId: null }

  const options = (data ?? []) as DealPickOption[]
  if (options.length === 0) return { ok: true, dealId: null }
  if (options.length === 1) return { ok: true, dealId: options[0].id }
  return { ok: false, needsPick: true, options }
}
