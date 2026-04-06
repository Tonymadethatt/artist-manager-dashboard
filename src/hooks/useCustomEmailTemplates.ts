import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { defaultCustomBlocksDoc } from '@/lib/email/customEmailBlocks'

export type CustomEmailAudience = 'venue' | 'artist'

export interface CustomEmailTemplateRow {
  id: string
  user_id: string
  audience: CustomEmailAudience
  name: string
  subject_template: string
  blocks: CustomEmailBlocksDoc | unknown
  created_at: string
  updated_at: string
}

export function useCustomEmailTemplates() {
  const [rows, setRows] = useState<CustomEmailTemplateRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('custom_email_templates')
      .select('*')
      .order('updated_at', { ascending: false })
    setRows((data ?? []) as CustomEmailTemplateRow[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchRows() }, [fetchRows])

  const insertRow = async (input: {
    audience: CustomEmailAudience
    name: string
    subject_template?: string
    blocks?: CustomEmailBlocksDoc
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('custom_email_templates')
      .insert({
        user_id: user.id,
        audience: input.audience,
        name: input.name.trim(),
        subject_template: input.subject_template?.trim() ?? 'Update from {{profile.artist_name}}',
        blocks: (input.blocks ?? defaultCustomBlocksDoc()) as never,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) return { error: new Error(error.message) }
    const row = data as CustomEmailTemplateRow
    setRows(prev => [row, ...prev.filter(r => r.id !== row.id)])
    return { data: row }
  }

  const updateRow = async (id: string, patch: Partial<{
    name: string
    subject_template: string
    blocks: CustomEmailBlocksDoc
    audience: CustomEmailAudience
  }>) => {
    const { data, error } = await supabase
      .from('custom_email_templates')
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error: new Error(error.message) }
    const row = data as CustomEmailTemplateRow
    setRows(prev => prev.map(r => r.id === id ? row : r))
    return { data: row }
  }

  const deleteRow = async (id: string) => {
    const { error } = await supabase.from('custom_email_templates').delete().eq('id', id)
    if (error) return { error: new Error(error.message) }
    setRows(prev => prev.filter(r => r.id !== id))
    return {}
  }

  const duplicateRow = async (id: string) => {
    const src = rows.find(r => r.id === id)
    if (!src) return { error: new Error('Not found') }
    return insertRow({
      audience: src.audience,
      name: `${src.name} (copy)`,
      subject_template: src.subject_template,
      blocks: parseBlocks(src.blocks),
    })
  }

  return {
    rows,
    loading,
    refetch: fetchRows,
    insertRow,
    updateRow,
    deleteRow,
    duplicateRow,
  }
}

function parseBlocks(b: unknown): CustomEmailBlocksDoc {
  if (b && typeof b === 'object' && 'version' in b && 'blocks' in b) {
    return b as CustomEmailBlocksDoc
  }
  return defaultCustomBlocksDoc()
}
