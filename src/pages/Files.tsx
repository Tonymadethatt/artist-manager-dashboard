import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Download, Trash2, Eye, X, Files as FilesIcon, Link2, Copy, Check } from 'lucide-react'
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
import { hasResolvablePdfLink, resolvedPdfHref } from '@/lib/files/pdfShareUrl'
import { copyTextToClipboard } from '@/lib/copyToClipboard'
import type { Deal, GeneratedFile } from '@/types'
import { cn } from '@/lib/utils'

function formatOf(f: GeneratedFile): 'text' | 'pdf' {
  return f.output_format === 'pdf' ? 'pdf' : 'text'
}

export default function Files() {
  const navigate = useNavigate()
  const { files, loading, deleteFile } = useFiles()
  const { deals, updateDeal } = useDeals()
  const [preview, setPreview] = useState<GeneratedFile | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<GeneratedFile | null>(null)
  const [dealForUrl, setDealForUrl] = useState<string>('')
  const [settingUrl, setSettingUrl] = useState(false)
  const [urlFeedback, setUrlFeedback] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [clipboardBanner, setClipboardBanner] = useState<string | null>(null)

  const canonicalDealsByFileId = useMemo(() => {
    const m = new Map<string, Deal>()
    for (const d of deals) {
      const fid = d.agreement_generated_file_id
      if (fid) m.set(fid, d)
    }
    return m
  }, [deals])

  const handleDownload = async (file: GeneratedFile) => {
    if (formatOf(file) === 'pdf') {
      const href = resolvedPdfHref(file)
      if (!href) return
      const filename = `${sanitizeFilenameStem(file.name)}.pdf`
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
    const href = resolvedPdfHref(file)
    if (!href) {
      setClipboardBanner('This file has no public PDF URL yet.')
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
    if (!preview || formatOf(preview) !== 'pdf' || !pdfHref || !dealForUrl) return
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
    <div className="space-y-4 max-w-3xl">
      {clipboardBanner && (
        <p className="text-xs text-amber-400/90 border border-amber-900/50 bg-amber-950/30 rounded-md px-3 py-2">
          {clipboardBanner}
        </p>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => navigate('/files/new')}>
          <Plus className="h-3.5 w-3.5" />
          Generate file
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : files.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FilesIcon className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">No files yet</p>
          <p className="text-xs text-neutral-500 mb-4">Generate a file from a template to see it here.</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/files/new')}>
            Generate first file
          </Button>
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
                const fmt = formatOf(file)
                return (
                  <tr key={file.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-neutral-100">{file.name}</span>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <Badge variant={fmt === 'pdf' ? 'blue' : 'secondary'} className="text-xs">
                        {fmt === 'pdf' ? 'PDF' : 'Text'}
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
                        {fmt === 'pdf' && hasResolvablePdfLink(file) && (
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
                <Badge variant={formatOf(preview) === 'pdf' ? 'blue' : 'secondary'} className="text-[10px] mt-2">
                  {formatOf(preview) === 'pdf' ? 'PDF' : 'Text'}
                </Badge>
                {canonicalDealsByFileId.get(preview.id) && (
                  <Badge variant="outline" className="text-[10px] mt-2 border-emerald-700/50 text-emerald-400 block w-fit">
                    Canonical agreement ·{' '}
                    {canonicalDealsByFileId.get(preview.id)?.venue?.name ??
                      canonicalDealsByFileId.get(preview.id)?.description}
                  </Badge>
                )}
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

            {formatOf(preview) === 'pdf' && resolvedPdfHref(preview) && (
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

            {formatOf(preview) === 'pdf' && resolvedPdfHref(preview) ? (
              <iframe
                title="PDF preview"
                src={resolvedPdfHref(preview) ?? ''}
                className={cn('flex-1 w-full min-h-[50vh] border-0 bg-neutral-950')}
              />
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteFile(confirmDelete.id)
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
