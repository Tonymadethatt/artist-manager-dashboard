import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { makeAgreementPdfSlug } from '@/lib/agreement/sanitize'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import type { GeneratedFile, GeneratedFileOutputFormat } from '@/types'

const FILE_SELECT = `
  *,
  venue:venues(id, name),
  template:templates(id, name)
`

const PDF_MIGRATION_HINT =
  'PDF storage needs the latest database migration. In Supabase: SQL editor → run supabase/migrations/010_agreement_pdf_files.sql (or supabase db push).'

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

/** PostgREST when a column exists in types but not on the remote DB. */
function isMissingColumnError(err: { message?: string } | null | undefined): boolean {
  const m = err?.message ?? ''
  return m.includes('schema cache') || m.includes('Could not find') || m.includes('column')
}

function normalizeGeneratedRow(
  row: Record<string, unknown>,
  fallbackDealId: string | null | undefined
): GeneratedFile {
  return {
    ...(row as unknown as GeneratedFile),
    deal_id: (row.deal_id as string | null | undefined) ?? fallbackDealId ?? null,
    output_format: (row.output_format as GeneratedFileOutputFormat | undefined) ?? 'text',
    pdf_storage_path: (row.pdf_storage_path as string | null | undefined) ?? null,
    pdf_public_url: (row.pdf_public_url as string | null | undefined) ?? null,
    pdf_share_slug: (row.pdf_share_slug as string | null | undefined) ?? null,
  }
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
    else
      setFiles(
        (data ?? []).map(r => normalizeGeneratedRow(r as Record<string, unknown>, null))
      )
    setLoading(false)
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles])

  /** Plain-text generated file (legacy + default). */
  const addTextFile = async (file: AddTextFileInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const base = {
      user_id: user.id,
      name: file.name,
      content: file.content,
      template_id: file.template_id,
      venue_id: file.venue_id,
    }

    const full = {
      ...base,
      deal_id: file.deal_id ?? null,
      output_format: 'text' as const,
      pdf_storage_path: null,
      pdf_public_url: null,
    }

    let { data, error } = await supabase.from('generated_files').insert(full).select(FILE_SELECT).single()

    if (error && isMissingColumnError(error)) {
      const { deal_id: _d, ...withoutDeal } = full
      const retry = await supabase.from('generated_files').insert(withoutDeal).select(FILE_SELECT).single()
      data = retry.data
      error = retry.error
    }

    if (error && isMissingColumnError(error)) {
      const retry = await supabase.from('generated_files').insert(base).select(FILE_SELECT).single()
      data = retry.data
      error = retry.error
    }

    if (error) return { error }
    const row = normalizeGeneratedRow(data as Record<string, unknown>, file.deal_id ?? null)
    setFiles(prev => [row, ...prev])
    return { data: row }
  }

  /**
   * Insert row, upload PDF to Storage, update row with paths + public URL.
   * Rolls back DB row or Storage object on failure.
   *
   * Each save creates a **new** `generated_files` row (new slug). To “replace” an agreement for a deal,
   * point the deal at the new row (File Builder toggle, Files panel, or Earnings) — we do not upsert storage in-place here.
   */
  const addPdfFile = async (file: AddPdfFileInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const base = {
      user_id: user.id,
      name: file.name,
      content: file.content,
      template_id: file.template_id,
      venue_id: file.venue_id,
    }

    const full = {
      ...base,
      deal_id: file.deal_id ?? null,
      output_format: 'pdf' as const,
      pdf_storage_path: null,
      pdf_public_url: null,
    }

    let { data: inserted, error: insErr } = await supabase
      .from('generated_files')
      .insert(full)
      .select('id')
      .single()

    if (insErr && isMissingColumnError(insErr)) {
      const { deal_id: _d, ...withoutDeal } = full
      const retry = await supabase.from('generated_files').insert(withoutDeal).select('id').single()
      inserted = retry.data
      insErr = retry.error
    }

    if (insErr && isMissingColumnError(insErr)) {
      return {
        error: new Error(
          `${PDF_MIGRATION_HINT} (${insErr.message})`
        ),
      }
    }

    if (insErr || !inserted) return { error: insErr ?? new Error('Insert failed') }

    const fileId = inserted.id as string
    const slug = makeAgreementPdfSlug(file.name, fileId)
    const path = `${user.id}/${slug}.pdf`

    const { error: upErr } = await supabase.storage
      .from('agreement-pdfs')
      .upload(path, file.pdfBlob, { contentType: 'application/pdf', upsert: false })

    if (upErr) {
      await supabase.from('generated_files').delete().eq('id', fileId)
      return { error: upErr }
    }

    const shareOrigin = publicSiteOrigin()
    const shareUrl = shareOrigin ? `${shareOrigin}/agreements/${slug}` : ''
    const { data: pub } = supabase.storage.from('agreement-pdfs').getPublicUrl(path)
    const storagePublicUrl = pub.publicUrl

    let finalUpdate = await supabase
      .from('generated_files')
      .update({
        pdf_storage_path: path,
        pdf_public_url: shareUrl || storagePublicUrl,
        pdf_share_slug: slug,
      })
      .eq('id', fileId)
      .select(FILE_SELECT)
      .single()

    if (finalUpdate.error && isMissingColumnError(finalUpdate.error)) {
      finalUpdate = await supabase
        .from('generated_files')
        .update({ pdf_storage_path: path, pdf_public_url: storagePublicUrl })
        .eq('id', fileId)
        .select(FILE_SELECT)
        .single()
    }

    const { data: final, error: updErr } = finalUpdate

    if (updErr || !final) {
      await supabase.storage.from('agreement-pdfs').remove([path])
      await supabase.from('generated_files').delete().eq('id', fileId)
      const msg = updErr?.message ?? 'Update failed'
      return {
        error: new Error(
          isMissingColumnError(updErr)
            ? `${PDF_MIGRATION_HINT} (${msg})`
            : msg
        ),
      }
    }

    const row = normalizeGeneratedRow(final as Record<string, unknown>, file.deal_id ?? null)
    setFiles(prev => [row, ...prev])
    return { data: row }
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
