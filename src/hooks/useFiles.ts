import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { GeneratedFile, GeneratedFileOutputFormat } from '@/types'

const FILE_SELECT = `
  *,
  venue:venues(id, name),
  template:templates(id, name)
`

export type AddTextFileInput = {
  name: string
  content: string
  template_id: string | null
  venue_id: string | null
  deal_id?: string | null
}

export type AddPdfFileInput = AddTextFileInput & {
  pdfBlob: Blob
}

export function useFiles() {
  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('generated_files')
      .select(FILE_SELECT)
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setFiles((data ?? []) as GeneratedFile[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  /** Plain-text generated file (legacy + default). */
  const addTextFile = async (file: AddTextFileInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('generated_files')
      .insert({
        user_id: user.id,
        name: file.name,
        content: file.content,
        template_id: file.template_id,
        venue_id: file.venue_id,
        deal_id: file.deal_id ?? null,
        output_format: 'text' satisfies GeneratedFileOutputFormat,
        pdf_storage_path: null,
        pdf_public_url: null,
      })
      .select(FILE_SELECT)
      .single()

    if (error) return { error }
    setFiles(prev => [data as GeneratedFile, ...prev])
    return { data: data as GeneratedFile }
  }

  /**
   * Insert row, upload PDF to Storage, update row with paths + public URL.
   * Rolls back DB row or Storage object on failure.
   */
  const addPdfFile = async (file: AddPdfFileInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const { data: inserted, error: insErr } = await supabase
      .from('generated_files')
      .insert({
        user_id: user.id,
        name: file.name,
        content: file.content,
        template_id: file.template_id,
        venue_id: file.venue_id,
        deal_id: file.deal_id ?? null,
        output_format: 'pdf' satisfies GeneratedFileOutputFormat,
        pdf_storage_path: null,
        pdf_public_url: null,
      })
      .select('id')
      .single()

    if (insErr || !inserted) return { error: insErr ?? new Error('Insert failed') }

    const fileId = inserted.id as string
    const path = `${user.id}/${fileId}.pdf`

    const { error: upErr } = await supabase.storage
      .from('agreement-pdfs')
      .upload(path, file.pdfBlob, { contentType: 'application/pdf', upsert: false })

    if (upErr) {
      await supabase.from('generated_files').delete().eq('id', fileId)
      return { error: upErr }
    }

    const { data: pub } = supabase.storage.from('agreement-pdfs').getPublicUrl(path)
    const pdf_public_url = pub.publicUrl

    const { data: final, error: updErr } = await supabase
      .from('generated_files')
      .update({ pdf_storage_path: path, pdf_public_url })
      .eq('id', fileId)
      .select(FILE_SELECT)
      .single()

    if (updErr || !final) {
      await supabase.storage.from('agreement-pdfs').remove([path])
      await supabase.from('generated_files').delete().eq('id', fileId)
      return { error: updErr ?? new Error('Update failed') }
    }

    setFiles(prev => [final as GeneratedFile, ...prev])
    return { data: final as GeneratedFile }
  }

  const deleteFile = async (id: string) => {
    const { data: row, error: selErr } = await supabase
      .from('generated_files')
      .select('pdf_storage_path')
      .eq('id', id)
      .maybeSingle()

    if (selErr) return { error: selErr }

    if (row?.pdf_storage_path) {
      const { error: stErr } = await supabase.storage.from('agreement-pdfs').remove([row.pdf_storage_path])
      if (stErr) return { error: stErr }
    }

    const { error } = await supabase.from('generated_files').delete().eq('id', id)
    if (error) return { error }
    setFiles(prev => prev.filter(f => f.id !== id))
    return {}
  }

  return {
    files,
    loading,
    error,
    refetch: fetchFiles,
    addTextFile,
    addPdfFile,
    deleteFile,
  }
}
