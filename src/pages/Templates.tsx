import { useCallback, useState } from 'react'
import { Plus, FileText, Pencil, Trash2, ChevronRight, Download, Loader2 } from 'lucide-react'
import { useTemplates } from '@/hooks/useTemplates'
import { TemplateEditor } from '@/components/templates/TemplateEditor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { Template } from '@/types'
import {
  parseDocumentTemplateFromJsonText,
  type DocumentTemplateImportPayload,
} from '@/lib/templates/coerceDocumentTemplateImport'

function publicReferenceUrl(pathFromReferenceFolder: string): string {
  const base = import.meta.env.BASE_URL
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const path = pathFromReferenceFolder.startsWith('/') ? pathFromReferenceFolder : `/${pathFromReferenceFolder}`
  return `${trimmedBase}${path}`.replace(/([^:]\/)\/+/g, '$1')
}

async function fetchPublicReferenceAsDownload(pathFromReferenceFolder: string, downloadAs: string): Promise<void> {
  const res = await fetch(publicReferenceUrl(pathFromReferenceFolder))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const a = document.createElement('a')
  const href = URL.createObjectURL(blob)
  a.href = href
  a.download = downloadAs
  a.click()
  URL.revokeObjectURL(href)
}

function templateImportSummaryLines(payload: DocumentTemplateImportPayload): string[] {
  const kinds: Record<string, number> = {}
  for (const s of payload.sections) {
    const k = s.section_kind ?? 'body'
    kinds[k] = (kinds[k] ?? 0) + 1
  }
  return [
    `Name: ${payload.name}`,
    `Type: ${payload.type}`,
    `Sections: ${payload.sections.length} (header ${kinds.header ?? 0}, body ${kinds.body ?? 0}, signatures ${kinds.signatures ?? 0}, footer ${kinds.footer ?? 0})`,
  ]
}

export default function Templates() {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useTemplates()
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<DocumentTemplateImportPayload | null>(null)
  const [importParseError, setImportParseError] = useState<string | null>(null)
  const [importSaveError, setImportSaveError] = useState<string | null>(null)
  const [importDownloadError, setImportDownloadError] = useState<string | null>(null)
  const [importSaving, setImportSaving] = useState(false)

  const resetImportDialog = useCallback(() => {
    setImportText('')
    setImportPreview(null)
    setImportParseError(null)
    setImportSaveError(null)
    setImportDownloadError(null)
  }, [])

  const runImportPreview = useCallback(() => {
    const result = parseDocumentTemplateFromJsonText(importText)
    if (!result.ok) {
      setImportPreview(null)
      setImportParseError(result.message)
      return
    }
    setImportParseError(null)
    setImportPreview(result.payload)
  }, [importText])

  const confirmImport = useCallback(async () => {
    if (!importPreview) return
    setImportSaving(true)
    setImportSaveError(null)
    const r = await addTemplate(importPreview)
    setImportSaving(false)
    if (r.error) {
      setImportSaveError(r.error.message)
      return
    }
    setImportOpen(false)
    resetImportDialog()
    if (r.data) setEditing(r.data)
  }, [importPreview, addTemplate, resetImportDialog])

  const downloadImportSpec = useCallback(async () => {
    setImportDownloadError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/document-template-v1-import-spec.md',
        'document-template-v1-import-spec.md',
      )
    } catch {
      setImportDownloadError('Could not download the spec file. Check your connection or try again.')
    }
  }, [])

  const downloadImportExample = useCallback(async () => {
    setImportDownloadError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/document-template.v1.example.json',
        'document-template.v1.example.json',
      )
    } catch {
      setImportDownloadError('Could not download the example JSON. Check your connection or try again.')
    }
  }, [])

  if (editing !== null) {
    return (
      <TemplateEditor
        template={editing === 'new' ? null : editing}
        onSave={async (data) => {
          if (editing === 'new') {
            const r = await addTemplate(data)
            if (r.error) return { error: r.error.message }
          } else {
            const r = await updateTemplate(editing.id, data)
            if (r.error) return { error: r.error.message }
          }
          setEditing(null)
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      <Dialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) resetImportDialog()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle>Import document template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 space-y-2">
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-[11px] text-neutral-500">AI / tooling templates</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => void downloadImportSpec()}
                  >
                    <FileText className="h-3.5 w-3.5" /> Spec (.md)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => void downloadImportExample()}
                  >
                    <Download className="h-3.5 w-3.5" /> Example (.json)
                  </Button>
                </div>
              </div>
              {importDownloadError ? (
                <p className="text-xs text-red-400">{importDownloadError}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-neutral-400">Paste JSON</Label>
              <textarea
                className={cn(
                  'w-full min-h-[160px] rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm font-mono',
                )}
                value={importText}
                onChange={e => {
                  setImportText(e.target.value)
                  setImportPreview(null)
                  setImportParseError(null)
                  setImportSaveError(null)
                }}
                placeholder='{ "v": 1, "name": "…", "type": "agreement", "sections": [ … ] }'
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={runImportPreview}>
                Review import
              </Button>
              <label className="text-xs text-neutral-400 cursor-pointer border border-neutral-700 rounded-md px-2 py-1.5 hover:bg-neutral-800">
                Choose file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const t = typeof reader.result === 'string' ? reader.result : ''
                      setImportText(t)
                      setImportPreview(null)
                      setImportParseError(null)
                      setImportSaveError(null)
                    }
                    reader.onerror = () => {
                      setImportParseError('Could not read file.')
                      setImportPreview(null)
                    }
                    reader.readAsText(file, 'UTF-8')
                  }}
                />
              </label>
            </div>
            {importParseError ? (
              <p className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap break-words">
                {importParseError}
              </p>
            ) : null}
            {importSaveError ? (
              <p className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap break-words">
                {importSaveError}
              </p>
            ) : null}
            {importPreview ? (
              <div className="rounded border border-neutral-700 bg-neutral-950/80 px-3 py-2 space-y-1.5">
                <p className="text-xs font-medium text-neutral-300">Ready to create a new template:</p>
                <ul className="text-[11px] text-neutral-400 list-disc pl-4 space-y-0.5">
                  {templateImportSummaryLines(importPreview).map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!importPreview || importSaving}
              onClick={() => void confirmImport()}
            >
              {importSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…
                </>
              ) : (
                'Import template'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-neutral-500">
          {templates.length} document template{templates.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { resetImportDialog(); setImportOpen(true) }}>
            <Download className="h-3.5 w-3.5" />
            Import JSON
          </Button>
          <Button onClick={() => setEditing('new')}>
            <Plus className="h-3.5 w-3.5" />
            New template
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FileText className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">No document templates yet</p>
          <p className="text-xs text-neutral-500 mb-4">Create one or import JSON from the spec.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => { resetImportDialog(); setImportOpen(true) }}>
              Import JSON
            </Button>
            <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
              Create template
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 hover:border-neutral-600 transition-colors group"
            >
              <button
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => setEditing(t)}
              >
                <FileText className="h-4 w-4 text-neutral-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-neutral-100">{t.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} · Updated {new Date(t.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant={t.type === 'agreement' ? 'blue' : 'warning'} className="ml-2 shrink-0">
                  {t.type}
                </Badge>
              </button>

              <div className="flex items-center gap-1 ml-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-400"
                  onClick={() => setConfirmDelete(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete template?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.name}</strong> will be permanently deleted. Generated files using this template will remain.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteTemplate(confirmDelete.id)
                  setConfirmDelete(null)
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
