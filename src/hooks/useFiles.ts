import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { makeAgreementPdfSlug } from '@/lib/agreement/sanitize'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { wouldCreateFolderCycle } from '@/lib/files/folderTree'
import type {
  DocumentFolder,
  FolderAccent,
  GeneratedFile,
  GeneratedFileOutputFormat,
  GeneratedFileSource,
} from '@/types'
import { isFolderAccent } from '@/types'

const FILE_SELECT = `
  *,
  venue:venues(id, name),
  template:templates(id, name)
`

const PDF_MIGRATION_HINT =
  'PDF storage needs the latest database migration. In Supabase: SQL editor → run supabase/migrations/010_agreement_pdf_files.sql (or supabase db push).'

export type UseFilesOptions = {
  /**
   * When set (including `null` for root), list only files in that folder and load folder tree + counts.
   * When omitted, list all files (e.g. Email templates, Agreement picker).
   */
  filterFolderId?: string | null
  /**
   * Scoped Documents only: optional `ilike` on `name`. Ignored when `filterFolderId` is omitted.
   * `%`, `_`, and `\` are stripped so they are not treated as wildcards.
   */
  searchQuery?: string
  /**
   * Scoped + non-empty `searchQuery`: when true, search all folders (limit 200, newest first).
   */
  searchAll?: boolean
}

export type AddTextFileInput = {
  name: string
  content: string
  template_id: string | null
  venue_id: string | null
  deal_id?: string | null
  folder_id?: string | null
}

export type AddPdfFileInput = AddTextFileInput & {
  pdfBlob: Blob
}

export const EMAIL_ASSET_ALLOWED_MIMES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const
export const EMAIL_ASSET_MAX_BYTES = 25 * 1024 * 1024

export type AddUploadedAssetInput = {
  file: File
  /** Row label; defaults to file.name */
  name?: string
  deal_id?: string | null
  folder_id?: string | null
}

/** PostgREST when a column exists in types but not on the remote DB. */
function isMissingColumnError(err: { message?: string } | null | undefined): boolean {
  const m = err?.message ?? ''
  return m.includes('schema cache') || m.includes('Could not find') || m.includes('column')
}

function normalizeGeneratedRow(
  row: Record<string, unknown>,
  fallbackDealId: string | null | undefined,
): GeneratedFile {
  const src = row.file_source as GeneratedFileSource | undefined
  return {
    ...(row as unknown as GeneratedFile),
    deal_id: (row.deal_id as string | null | undefined) ?? fallbackDealId ?? null,
    folder_id: (row.folder_id as string | null | undefined) ?? null,
    output_format: (row.output_format as GeneratedFileOutputFormat | undefined) ?? 'text',
    file_source: src ?? 'generated',
    pdf_storage_path: (row.pdf_storage_path as string | null | undefined) ?? null,
    pdf_public_url: (row.pdf_public_url as string | null | undefined) ?? null,
    pdf_share_slug: (row.pdf_share_slug as string | null | undefined) ?? null,
    upload_storage_path: (row.upload_storage_path as string | null | undefined) ?? null,
    upload_public_url: (row.upload_public_url as string | null | undefined) ?? null,
    upload_mime_type: (row.upload_mime_type as string | null | undefined) ?? null,
  }
}

function safeUploadObjectName(original: string, fileId: string): string {
  const base = original.split(/[/\\]/).pop() ?? 'file'
  const cleaned = base.replace(/[^\w.\- ]+/g, '_').trim() || 'file'
  return `${fileId}_${cleaned.slice(0, 100)}`
}

function normalizeDocumentFolder(row: Record<string, unknown>): DocumentFolder {
  const accentRaw = row.accent as string | undefined
  return {
    ...(row as unknown as DocumentFolder),
    accent: isFolderAccent(accentRaw) ? accentRaw : 'default',
  }
}

/** Strip LIKE metacharacters so user input cannot widen the match. */
function sanitizeFilenameSearchFragment(raw: string): string {
  return raw.replace(/[%_\\]/g, '').trim()
}

async function deleteGeneratedFileStorageAndRow(id: string): Promise<{ error: Error | null }> {
  const { data: row, error: selErr } = await supabase
    .from('generated_files')
    .select('pdf_storage_path,upload_storage_path,file_source')
    .eq('id', id)
    .maybeSingle()

  if (selErr) return { error: selErr }

  const rec = row as {
    pdf_storage_path?: string | null
    upload_storage_path?: string | null
    file_source?: string | null
  } | null

  if (rec?.upload_storage_path) {
    const { error: stErr } = await supabase.storage.from('email-assets').remove([rec.upload_storage_path])
    if (stErr) return { error: stErr }
  } else if (rec?.pdf_storage_path) {
    const { error: stErr } = await supabase.storage.from('agreement-pdfs').remove([rec.pdf_storage_path])
    if (stErr) return { error: stErr }
  }

  const { error } = await supabase.from('generated_files').delete().eq('id', id)
  if (error) return { error }
  return { error: null }
}

function aggregateFolderCounts(rows: { folder_id: string | null }[]): {
  root: number
  byFolderId: Record<string, number>
} {
  const byFolderId: Record<string, number> = {}
  let root = 0
  for (const r of rows) {
    if (r.folder_id == null) root++
    else byFolderId[r.folder_id] = (byFolderId[r.folder_id] ?? 0) + 1
  }
  return { root, byFolderId }
}

export function useFiles(options: UseFilesOptions = {}) {
  const filterFolderId = options.filterFolderId
  const scoped = filterFolderId !== undefined
  const searchQueryRaw = options.searchQuery ?? ''
  const searchAllOpt = options.searchAll ?? false
  const searchTrimmed = searchQueryRaw.trim()
  const effectiveSearchAll = scoped && searchAllOpt && searchTrimmed.length > 0

  const [files, setFiles] = useState<GeneratedFile[]>([])
  const [folders, setFolders] = useState<DocumentFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [folderFileCounts, setFolderFileCounts] = useState<{ root: number; byFolderId: Record<string, number> }>({
    root: 0,
    byFolderId: {},
  })

  const refetch = useCallback(async () => {
    setLoading(true)
    setError(null)

    if (scoped) {
      const { data: folderRows, error: folderErr } = await supabase
        .from('document_folders')
        .select('*')
        .order('name')
      if (folderErr) setError(folderErr.message)
      setFolders(((folderRows ?? []) as Record<string, unknown>[]).map(normalizeDocumentFolder))

      const { data: countRows, error: countErr } = await supabase.from('generated_files').select('folder_id')
      if (countErr && !isMissingColumnError(countErr)) setError(countErr.message)
      if (!countErr) setFolderFileCounts(aggregateFolderCounts((countRows ?? []) as { folder_id: string | null }[]))
    } else {
      setFolders([])
      setFolderFileCounts({ root: 0, byFolderId: {} })
    }

    let q = supabase.from('generated_files').select(FILE_SELECT)

    if (scoped) {
      const safeSearch = searchTrimmed ? sanitizeFilenameSearchFragment(searchTrimmed) : ''
      if (searchTrimmed && !safeSearch) {
        setFiles([])
        setLoading(false)
        return
      }

      if (searchTrimmed) {
        q = q.ilike('name', `%${safeSearch}%`)
      }

      if (!searchTrimmed || !effectiveSearchAll) {
        if (filterFolderId === null) q = q.is('folder_id', null)
        else q = q.eq('folder_id', filterFolderId)
      }

      q = q.order('created_at', { ascending: false })
      if (searchTrimmed && effectiveSearchAll) {
        q = q.limit(200)
      }
    } else {
      q = q.order('created_at', { ascending: false })
    }

    const { data, error: fileErr } = await q
    if (fileErr) setError(fileErr.message)
    else setFiles((data ?? []).map(r => normalizeGeneratedRow(r as Record<string, unknown>, null)))

    setLoading(false)
  }, [scoped, filterFolderId, searchTrimmed, effectiveSearchAll])

  useEffect(() => {
    void refetch()
  }, [refetch])

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
      folder_id: file.folder_id ?? null,
      output_format: 'text' as const,
      pdf_storage_path: null,
      pdf_public_url: null,
    }

    let { data, error } = await supabase.from('generated_files').insert(full).select(FILE_SELECT).single()

    if (error && isMissingColumnError(error)) {
      const { deal_id: _d, folder_id: _f, ...withoutOptional } = full
      const retry = await supabase.from('generated_files').insert(withoutOptional).select(FILE_SELECT).single()
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
    void refetch()
    return { data: row }
  }

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
      folder_id: file.folder_id ?? null,
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
      const { deal_id: _d, folder_id: _f, ...withoutOptional } = full
      const retry = await supabase.from('generated_files').insert(withoutOptional).select('id').single()
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
    void refetch()
    return { data: row }
  }

  const addUploadedAsset = async (input: AddUploadedAssetInput) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const f = input.file
    if (!EMAIL_ASSET_ALLOWED_MIMES.includes(f.type as (typeof EMAIL_ASSET_ALLOWED_MIMES)[number])) {
      return { error: new Error('Allowed types: PDF, PNG, JPG, WebP.') }
    }
    if (f.size > EMAIL_ASSET_MAX_BYTES) {
      return { error: new Error('File is too large (max 25 MB).') }
    }

    const label = (input.name?.trim() || f.name).trim() || 'Upload'

    const insertPayload = {
      user_id: user.id,
      name: label,
      content: '',
      template_id: null as string | null,
      venue_id: null as string | null,
      deal_id: input.deal_id ?? null,
      folder_id: input.folder_id ?? null,
      output_format: 'text' as const,
      file_source: 'upload' as const,
      pdf_storage_path: null as string | null,
      pdf_public_url: null as string | null,
      pdf_share_slug: null as string | null,
      upload_storage_path: null as string | null,
      upload_public_url: null as string | null,
      upload_mime_type: f.type || null,
    }

    let { data: inserted, error: insErr } = await supabase
      .from('generated_files')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insErr && isMissingColumnError(insErr)) {
      return {
        error: new Error(
          'Uploads require the latest DB migration (email assets). Run migrations or contact support.',
        ),
      }
    }

    if (insErr || !inserted) return { error: insErr ?? new Error('Insert failed') }

    const fileId = inserted.id as string
    const objectName = safeUploadObjectName(f.name, fileId)
    const path = `${user.id}/${objectName}`

    const { error: upErr } = await supabase.storage
      .from('email-assets')
      .upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false })

    if (upErr) {
      await supabase.from('generated_files').delete().eq('id', fileId)
      return { error: upErr }
    }

    const { data: pub } = supabase.storage.from('email-assets').getPublicUrl(path)
    const publicUrl = pub.publicUrl

    const { data: final, error: updErr } = await supabase
      .from('generated_files')
      .update({
        upload_storage_path: path,
        upload_public_url: publicUrl,
        upload_mime_type: f.type || null,
      })
      .eq('id', fileId)
      .select(FILE_SELECT)
      .single()

    if (updErr || !final) {
      await supabase.storage.from('email-assets').remove([path])
      await supabase.from('generated_files').delete().eq('id', fileId)
      return { error: updErr ?? new Error('Update failed') }
    }

    const row = normalizeGeneratedRow(final as Record<string, unknown>, input.deal_id ?? null)
    void refetch()
    return { data: row }
  }

  const createFolder = async (name: string, parentId: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const trimmed = name.trim()
    if (!trimmed) return { error: new Error('Folder name is required.') }
    const { data, error } = await supabase
      .from('document_folders')
      .insert({ user_id: user.id, name: trimmed, parent_id: parentId })
      .select('*')
      .single()
    if (error) {
      if (error.code === '23505') return { error: new Error('A folder with that name already exists here.') }
      return { error }
    }
    void refetch()
    return { data: normalizeDocumentFolder(data as Record<string, unknown>) }
  }

  const renameFolder = async (id: string, name: string) => {
    const trimmed = name.trim()
    if (!trimmed) return { error: new Error('Folder name is required.') }
    const { error } = await supabase.from('document_folders').update({ name: trimmed }).eq('id', id)
    if (error) {
      if (error.code === '23505') return { error: new Error('A folder with that name already exists here.') }
      return { error }
    }
    void refetch()
    return {}
  }

  const deleteFolder = async (id: string) => {
    const { error } = await supabase.from('document_folders').delete().eq('id', id)
    if (error) return { error }
    void refetch()
    return {}
  }

  const moveFolder = async (folderId: string, newParentId: string | null) => {
    if (wouldCreateFolderCycle(folders, folderId, newParentId)) {
      return { error: new Error('Cannot move a folder into itself or one of its subfolders.') }
    }
    const { error } = await supabase.from('document_folders').update({ parent_id: newParentId }).eq('id', folderId)
    if (error) {
      if (error.code === '23505') return { error: new Error('A folder with that name already exists here.') }
      return { error }
    }
    void refetch()
    return {}
  }

  const moveFile = async (fileId: string, targetFolderId: string | null) => {
    const { error } = await supabase.from('generated_files').update({ folder_id: targetFolderId }).eq('id', fileId)
    if (error) return { error }
    void refetch()
    return {}
  }

  const moveFiles = async (fileIds: string[], targetFolderId: string | null) => {
    if (!scoped) {
      return { error: new Error('Bulk move is only available on the Documents page.') }
    }
    if (fileIds.length === 0) return {}
    const { error } = await supabase
      .from('generated_files')
      .update({ folder_id: targetFolderId })
      .in('id', fileIds)
    if (error) return { error }
    void refetch()
    return {}
  }

  const deleteFile = async (id: string) => {
    const { count, error: cntErr } = await supabase
      .from('custom_email_templates')
      .select('*', { count: 'exact', head: true })
      .eq('attachment_generated_file_id', id)

    if (cntErr) return { error: cntErr }
    if (count != null && count > 0) {
      return {
        error: new Error('This file is linked to a custom email template. Remove the attachment in Email templates first.'),
      }
    }

    const del = await deleteGeneratedFileStorageAndRow(id)
    if (del.error) return { error: del.error }
    void refetch()
    return {}
  }

  const deleteFiles = async (
    fileIds: string[],
  ): Promise<{ deleted: number; skippedTemplate: number; errors: string[]; error: Error | null }> => {
    if (!scoped) {
      return {
        deleted: 0,
        skippedTemplate: 0,
        errors: [],
        error: new Error('Bulk delete is only available on the Documents page.'),
      }
    }
    if (fileIds.length === 0) return { deleted: 0, skippedTemplate: 0, errors: [], error: null }

    const { data: tmplRows, error: tmplErr } = await supabase
      .from('custom_email_templates')
      .select('attachment_generated_file_id')
      .in('attachment_generated_file_id', fileIds)

    if (tmplErr) {
      return { deleted: 0, skippedTemplate: 0, errors: [], error: tmplErr }
    }

    const blocked = new Set<string>()
    for (const row of tmplRows ?? []) {
      const fid = (row as { attachment_generated_file_id: string | null }).attachment_generated_file_id
      if (fid) blocked.add(fid)
    }

    const toDelete = fileIds.filter(id => !blocked.has(id))
    const skippedTemplate = fileIds.length - toDelete.length
    const errors: string[] = []
    let deleted = 0
    for (const id of toDelete) {
      const r = await deleteGeneratedFileStorageAndRow(id)
      if (r.error) errors.push(r.error.message)
      else deleted++
    }
    void refetch()
    return { deleted, skippedTemplate, errors, error: null }
  }

  const updateFolderAccent = async (id: string, accent: FolderAccent) => {
    if (!scoped) {
      return { error: new Error('Folder color is only available on the Documents page.') }
    }
    const { error } = await supabase.from('document_folders').update({ accent }).eq('id', id)
    if (error) return { error }
    void refetch()
    return {}
  }

  return {
    files,
    folders,
    loading,
    error,
    folderFileCounts,
    refetch,
    addTextFile,
    addPdfFile,
    addUploadedAsset,
    deleteFile,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveFile,
    moveFiles,
    deleteFiles,
    updateFolderAccent,
  }
}
