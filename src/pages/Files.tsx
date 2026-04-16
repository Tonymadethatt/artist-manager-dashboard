import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Trash2, Eye, X, Files as FilesIcon, Link2, Copy, Check, Upload } from 'lucide-react'
import { useFiles } from '@/hooks/useFiles'
import { useDeals } from '@/hooks/useDeals'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sanitizeFilenameStem } from '@/lib/agreement'
import { publicSiteOrigin, resolvedPdfHref } from '@/lib/files/pdfShareUrl'
import { resolveGeneratedFileDownloadUrl } from '@/lib/files/resolveGeneratedFileDownloadUrl'
import { copyTextToClipboard } from '@/lib/copyToClipboard'
import type { Deal, GeneratedFile } from '@/types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

type TaskFileLink = { id: string; title: string; completed: boolean }

type FileKind = 'upload' | 'pdf' | 'text'

function fileKind(f: GeneratedFile): FileKind {
  if (f.file_source === 'upload') return 'upload'
  return f.output_format === 'pdf' ? 'pdf' : 'text'
}

export default function Files() {
  const navigate = useNavigate()
  const { files, loading, deleteFile, addUploadedAsset, refetch } = useFiles()
  const { deals, updateDeal } = useDeals()
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const [uploadDealId, setUploadDealId] = useState<string>('__none__')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [preview, setPreview] = useState<GeneratedFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GeneratedFile | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [dealForUrl, setDealForUrl] = useState<string>('')
  const [settingUrl, setSettingUrl] = useState(false)
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [clipboardBanner, setClipboardBanner] = useState<string | null>(null)
  const [taskLinksByFileId, setTaskLinksByFileId] = useState<Map<string, TaskFileLink[]>>(new Map())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('tasks')
        .select('id, title, completed, generated_file_id')
        .eq('user_id', user.id)
        .not('generated_file_id', 'is', null)
      if (cancelled || !data) return
      const m = new Map<string, TaskFileLink[]>()
      for (const row of data as { id: string; title: string; completed: boolean; generated_file_id: string }[]) {
        const fid = row.generated_file_id
        const list = m.get(fid) ?? []
        list.push({ id: row.id, title: row.title, completed: !!row.completed })
        m.set(fid, list)
      }
      setTaskLinksByFileId(m)
    })()
    return () => { cancelled = true }
  }, [preview?.id])

  const canonicalDealsByFileId = useMemo(() => {
    const m = new Map<string, Deal>()
    for (const d of deals) {
      const fid = d.agreement_generated_file_id
      if (fid) m.set(fid, d)
    }
    return m
  }, [deals])

  const taskLinkSummary = (fileId: string): { open: TaskFileLink[]; done: number } => {
    const all = taskLinksByFileId.get(fileId) ?? []
    const open = all.filter(t => !t.completed)
    const done = all.length - open.length
    return { open, done: Math.max(0, done) }
  }

  const handleDownload = async (file: GeneratedFile) => {
    const href = resolveGeneratedFileDownloadUrl(file, publicSiteOrigin())
    if (href) {
      const ext =
        file.file_source === 'upload' && file.upload_mime_type === 'image/png'
          ? 'png'
          : file.file_source === 'upload' && file.upload_mime_type === 'image/jpeg'
            ? 'jpg'
            : file.file_source === 'upload' && file.upload_mime_type === 'image/webp'
              ? 'webp'
              : file.file_source === 'upload' && file.upload_mime_type === 'application/pdf'
                ? 'pdf'
                : file.output_format === 'pdf'
                  ? 'pdf'
                  : 'bin'
      const filename = `${sanitizeFilenameStem(file.name)}.${ext}`
      try {
        const res = await fetch(href, { mode: 'cors', credentials: 'omit' })
        if (!res.ok) throw new Error('fetch failed')
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = objectUrl
        a.download = filename
        a.rel = 'noreferrer'
        a.click()
        URL.revokeObjectURL(objectUrl)
      } catch {
        const a = document.createElement('a')
        a.href = href
        a.target = '_blank'
        a.rel = 'noreferrer'
        a.click()
      }
      return
    }
    if (fileKind(file) !== 'text') return
    const blob = new Blob([file.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeFilenameStem(file.name)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyPdfLink = async (file: GeneratedFile) => {
    setClipboardBanner(null)
    const href = resolveGeneratedFileDownloadUrl(file, publicSiteOrigin())
    if (!href) {
      setClipboardBanner('This file has no public download URL yet.')
      window.setTimeout(() => setClipboardBanner(null), 5000)
      return
    }
    const ok = await copyTextToClipboard(href)
    if (ok) {
      setCopiedId(file.id)
      window.setTimeout(() => setCopiedId(null), 2000)
      return
    }
    const msg =
      'Could not copy automatically. Open the PDF with Download, or copy the link from your browser address bar.'
    setClipboardBanner(msg)
    window.setTimeout(() => setClipboardBanner(null), 8000)
  }

  const handleSetDealAgreementUrl = async () => {
    const pdfHref = preview ? resolvedPdfHref(preview) : null
    if (!preview || fileKind(preview) !== 'pdf' || !pdfHref || !dealForUrl) return
    setSettingUrl(true)
    setUrlFeedback(null)
    const res = await updateDeal(dealForUrl, {
      agreement_url: pdfHref,
      agreement_generated_file_id: preview.id,
    })
    setSettingUrl(false)
    if (res.error) {
      setUrlFeedback('Could not update deal.')
      return
    }
    setUrlFeedback('Deal agreement URL updated.')
    window.setTimeout(() => setUrlFeedback(null), 3000)
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {clipboardBanner && (
        <p className="text-xs text-amber-400/90 border border-amber-900/50 bg-amber-950/30 rounded-md px-3 py-2">
          {clipboardBanner}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
        <div className="flex flex-wrap gap-2 justify-end">
          <input
            ref={uploadInputRef}
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp,application/pdf"
            className="hidden"
            onChange={async e => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (!f) return
              setUploadError(null)
              setUploading(true)
              const dealId = uploadDealId === '__none__' ? null : uploadDealId
              const res = await addUploadedAsset({ file: f, deal_id: dealId })
              setUploading(false)
              if (res.error) {
                setUploadError(res.error.message)
                return
              }
              void refetch()
            }}
          />
          <div className="flex flex-col gap-1 min-w-[200px]">
            <Select value={uploadDealId} onValueChange={setUploadDealId}>
              <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-800">
                <SelectValue placeholder="Link to deal (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No deal link</SelectItem>
                {deals.map(d => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.description}{d.venue ? ` — ${d.venue.name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => uploadInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? 'Uploading…' : 'Upload file'}
          </Button>
          <Button onClick={() => navigate('/files/new')}>
            <Plus className="h-3.5 w-3.5" />
            Generate file
          </Button>
        </div>
      </div>
      {uploadError && (
        <p className="text-xs text-red-400 border border-red-900/50 bg-red-950/30 rounded-md px-3 py-2">{uploadError}</p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FilesIcon className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">No files yet</p>
          <p className="text-xs text-neutral-500 mb-4">
            Upload a PDF or image for email attachments, or generate a file from a template.
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/files/new')}>
              Generate file
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded border border-neutral-800 overflow-hidden bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950">
                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs">Name</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Type</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Venue</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">Template</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs">Date</th>
                <th className="px-3 py-2.5 w-28" />
              </tr>
            </thead>
            <tbody>
              {files.map(file => {
                const fmt = fileKind(file)
                const canon = canonicalDealsByFileId.get(file.id)
                return (
                  <tr key={file.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-medium text-neutral-100">{file.name}</span>
                        {canon && (
                          <Badge variant="outline" className="text-[10px] w-fit border-emerald-700/50 text-emerald-400">
                            Canonical agreement · {canon.venue?.name ?? canon.description}
                          </Badge>
                        )}
                        {(() => {
                          const { open, done } = taskLinkSummary(file.id)
                          if (open.length === 0 && done === 0) return null
                          return (
                            <div className="flex flex-col gap-1">
                              {open.slice(0, 2).map(t => (
                                <Badge
                                  key={t.id}
                                  variant="secondary"
                                  className="text-[10px] w-fit border-neutral-600 text-neutral-300"
                                >
                                  Pipeline task · {t.title}
                                </Badge>
                              ))}
                              {open.length > 2 && (
                                <span className="text-[10px] text-neutral-500">
                                  +{open.length - 2} more open task{open.length - 2 !== 1 ? 's' : ''}
                                </span>
                              )}
                              {open.length === 0 && done > 0 && (
                                <span className="text-[10px] text-neutral-500">
                                  {done} completed task{done !== 1 ? 's' : ''} linked this PDF
                                </span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <Badge
                        variant={fmt === 'pdf' ? 'blue' : fmt === 'upload' ? 'outline' : 'secondary'}
                        className="text-xs"
                      >
                        {fmt === 'upload' ? 'Upload' : fmt === 'pdf' ? 'PDF' : 'Text'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      {file.venue ? (
                        <span className="text-xs text-neutral-400">{file.venue.name}</span>
                      ) : (
                        <span className="text-neutral-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {file.template ? (
                        <Badge variant="secondary" className="text-xs">{file.template.name}</Badge>
                      ) : (
                        <span className="text-neutral-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-neutral-500">
                        {new Date(file.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1 justify-end flex-wrap">
                        {resolveGeneratedFileDownloadUrl(file, publicSiteOrigin()) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copy PDF link"
                            onClick={() => copyPdfLink(file)}
                          >
                            {copiedId === file.id ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreview(file)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(file)}>
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500 hover:text-red-400"
                          onClick={() => setConfirmDelete(file)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {preview && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => { setPreview(null); setDealForUrl(''); setUrlFeedback(null) }} />
          <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-neutral-900 border-l border-neutral-800 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
              <div>
                <h2 className="font-semibold text-sm text-neutral-100">{preview.name}</h2>
                <p className="text-xs text-neutral-500 mt-0.5">{new Date(preview.created_at).toLocaleString()}</p>
                <Badge
                  variant={fileKind(preview) === 'pdf' ? 'blue' : fileKind(preview) === 'upload' ? 'outline' : 'secondary'}
                  className="text-[10px] mt-2"
                >
                  {fileKind(preview) === 'upload' ? 'Upload' : fileKind(preview) === 'pdf' ? 'PDF' : 'Text'}
                </Badge>
                {canonicalDealsByFileId.get(preview.id) && (
                  <Badge variant="outline" className="text-[10px] mt-2 border-emerald-700/50 text-emerald-400 block w-fit">
                    Canonical agreement ·{' '}
                    {canonicalDealsByFileId.get(preview.id)?.venue?.name ??
                      canonicalDealsByFileId.get(preview.id)?.description}
                  </Badge>
                )}
                {(() => {
                  const { open, done } = taskLinkSummary(preview.id)
                  if (open.length === 0 && done === 0) return null
                  return (
                    <div className="flex flex-col gap-1 mt-2">
                      {open.slice(0, 3).map(t => (
                        <Badge
                          key={t.id}
                          variant="secondary"
                          className="text-[10px] w-fit border-neutral-600 text-neutral-300"
                        >
                          Pipeline task · {t.title}
                        </Badge>
                      ))}
                      {open.length > 3 && (
                        <span className="text-[10px] text-neutral-500">
                          +{open.length - 3} more open
                        </span>
                      )}
                      {open.length === 0 && done > 0 && (
                        <span className="text-[10px] text-neutral-500">
                          {done} completed task{done !== 1 ? 's' : ''} linked this PDF
                        </span>
                      )}
                    </div>
                  )
                })()}
              </div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => handleDownload(preview)}>
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
                <Button variant="ghost" size="icon" onClick={() => { setPreview(null); setDealForUrl(''); setUrlFeedback(null) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {fileKind(preview) === 'pdf' && resolvedPdfHref(preview) && (
              <div className="px-5 py-3 border-b border-neutral-800 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2"
                  onClick={() => copyPdfLink(preview)}
                >
                  <Link2 className="h-3.5 w-3.5" />
                  Copy public PDF link
                </Button>
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-neutral-500">Set as canonical agreement for a deal (URL + PDF record)</p>
                  <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
                    <Select value={dealForUrl || '__none__'} onValueChange={v => setDealForUrl(v === '__none__' ? '' : v)}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select deal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Choose deal…</SelectItem>
                        {deals.map(d => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.description}{d.venue ? ` — ${d.venue.name}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!dealForUrl || settingUrl}
                      onClick={handleSetDealAgreementUrl}
                    >
                      {settingUrl ? 'Saving…' : 'Apply'}
                    </Button>
                  </div>
                  {urlFeedback && <p className="text-xs text-emerald-400">{urlFeedback}</p>}
                </div>
              </div>
            )}

            {fileKind(preview) === 'pdf' && resolvedPdfHref(preview) ? (
              <iframe
                title="PDF preview"
                src={resolvedPdfHref(preview) ?? ''}
                className={cn('flex-1 w-full min-h-[50vh] border-0 bg-neutral-950')}
              />
            ) : fileKind(preview) === 'upload' && preview.upload_public_url ? (
              preview.upload_mime_type?.startsWith('image/') ? (
                <div className="flex-1 overflow-auto p-5 flex items-start justify-center bg-neutral-950">
                  <img
                    src={preview.upload_public_url}
                    alt=""
                    className="max-w-full max-h-[70vh] object-contain"
                  />
                </div>
              ) : preview.upload_mime_type === 'application/pdf' ? (
                <iframe
                  title="Uploaded PDF"
                  src={preview.upload_public_url}
                  className={cn('flex-1 w-full min-h-[50vh] border-0 bg-neutral-950')}
                />
              ) : (
                <div className="flex-1 p-5 text-sm text-neutral-400">
                  <a
                    href={preview.upload_public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-200 underline"
                  >
                    Open file
                  </a>
                </div>
              )
            ) : (
              <pre className="flex-1 overflow-y-auto p-5 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed">
                {preview.content}
              </pre>
            )}
          </div>
        </>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete file?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.name}</strong> will be permanently deleted.
            </p>
            {deleteError && <p className="text-xs text-red-400 mb-3">{deleteError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => { setConfirmDelete(null); setDeleteError(null) }}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  setDeleteError(null)
                  const res = await deleteFile(confirmDelete.id)
                  if (res.error) {
                    setDeleteError(res.error.message)
                    return
                  }
                  setConfirmDelete(null)
                  if (preview?.id === confirmDelete.id) setPreview(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
