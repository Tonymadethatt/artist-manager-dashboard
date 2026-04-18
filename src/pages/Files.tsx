import { useState, useMemo, useEffect, useRef, type DragEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Download,
  Trash2,
  Eye,
  X,
  Files as FilesIcon,
  Link2,
  Copy,
  Upload,
  Folder,
  FileText,
  MoreHorizontal,
  ChevronRight,
  Pencil,
  FolderInput,
  GripVertical,
  Check,
  Square,
  Search,
} from 'lucide-react'
import { useFiles } from '@/hooks/useFiles'
import { useDeals } from '@/hooks/useDeals'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { sanitizeFilenameStem } from '@/lib/agreement'
import { publicSiteOrigin, resolvedPdfHref } from '@/lib/files/pdfShareUrl'
import {
  folderBreadcrumbItems,
  flatFolderPickList,
  collectFolderSubtreeIds,
  folderDisplayPath,
} from '@/lib/files/folderTree'
import {
  FOLDER_ACCENT_FOLDER_BORDER,
  FOLDER_ACCENT_FOLDER_ICON,
  FOLDER_ACCENT_DROP_RING,
  FOLDER_ACCENT_LABELS,
} from '@/lib/files/folderAccent'
import { resolveGeneratedFileDownloadUrl } from '@/lib/files/resolveGeneratedFileDownloadUrl'
import { copyTextToClipboard } from '@/lib/copyToClipboard'
import type { Deal, GeneratedFile, DocumentFolder } from '@/types'
import { FOLDER_ACCENTS } from '@/types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function parseFolderQuery(raw: string | null): string | null {
  if (!raw?.trim()) return null
  const t = raw.trim()
  return UUID_RE.test(t) ? t : null
}

type TaskFileLink = { id: string; title: string; completed: boolean }

type FileKind = 'upload' | 'pdf' | 'text'

function fileKind(f: GeneratedFile): FileKind {
  if (f.file_source === 'upload') return 'upload'
  return f.output_format === 'pdf' ? 'pdf' : 'text'
}

const DOC_SORT_KEY_LS = 'documents:sort:key'
const DOC_SORT_DIR_LS = 'documents:sort:dir'

type DocSortKey = 'name' | 'date' | 'kind'
type DocSortDir = 'asc' | 'desc'

function readDocSortKey(): DocSortKey {
  try {
    const v = localStorage.getItem(DOC_SORT_KEY_LS)
    if (v === 'name' || v === 'date' || v === 'kind') return v
  } catch { /* ignore */ }
  return 'date'
}

function readDocSortDir(): DocSortDir {
  try {
    const v = localStorage.getItem(DOC_SORT_DIR_LS)
    if (v === 'asc' || v === 'desc') return v
  } catch { /* ignore */ }
  return 'desc'
}

const FILE_DRAG_MIME = 'application/x-artist-manager-file-ids'

export default function Files() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const folderParamRaw = searchParams.get('folder')
  const folderIdFromUrl = useMemo(() => parseFolderQuery(folderParamRaw), [folderParamRaw])
  const filterFolderId: string | null = folderIdFromUrl

  const [searchDraft, setSearchDraft] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [searchAll, setSearchAll] = useState(false)
  const [sortKey, setSortKey] = useState<DocSortKey>(() => readDocSortKey())
  const [sortDir, setSortDir] = useState<DocSortDir>(() => readDocSortDir())
  const [selectionMode, setSelectionMode] = useState(false)
  const [fileSelection, setFileSelection] = useState<Set<string>>(new Set())
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null)
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false)
  const [bulkMoveDest, setBulkMoveDest] = useState<string>('__root__')
  const [bulkMoveSaving, setBulkMoveSaving] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false)
  const [bulkDeleteSummary, setBulkDeleteSummary] = useState<string | null>(null)
  const [accentFolder, setAccentFolder] = useState<DocumentFolder | null>(null)
  const [accentSavingKey, setAccentSavingKey] = useState<string | null>(null)

  const {
    files,
    folders,
    loading,
    error,
    folderFileCounts,
    deleteFile,
    addUploadedAsset,
    createFolder,
    renameFolder,
    deleteFolder,
    moveFolder,
    moveFile,
    moveFiles,
    deleteFiles,
    updateFolderAccent,
  } = useFiles({
    filterFolderId,
    searchQuery: debouncedSearch,
    searchAll: searchAll && debouncedSearch.trim().length > 0,
  })

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
  const [clipboardBanner, setClipboardBanner] = useState<string | null>(null)
  const [taskLinksByFileId, setTaskLinksByFileId] = useState<Map<string, TaskFileLink[]>>(new Map())

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderSaving, setNewFolderSaving] = useState(false)
  const [newFolderErr, setNewFolderErr] = useState<string | null>(null)

  const [renameOpen, setRenameOpen] = useState(false)
  const [renameFolderRow, setRenameFolderRow] = useState<DocumentFolder | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameSaving, setRenameSaving] = useState(false)

  const [moveFileOpen, setMoveFileOpen] = useState(false)
  const [moveFileRow, setMoveFileRow] = useState<GeneratedFile | null>(null)
  const [moveFileDest, setMoveFileDest] = useState<string>('__root__')
  const [moveFileSaving, setMoveFileSaving] = useState(false)

  const [moveFolderOpen, setMoveFolderOpen] = useState(false)
  const [moveFolderRow, setMoveFolderRow] = useState<DocumentFolder | null>(null)
  const [moveFolderDest, setMoveFolderDest] = useState<string>('__root__')
  const [moveFolderSaving, setMoveFolderSaving] = useState(false)

  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<DocumentFolder | null>(null)

  useEffect(() => {
    if (folderParamRaw?.trim() && !UUID_RE.test(folderParamRaw.trim())) {
      setSearchParams({}, { replace: true })
    }
  }, [folderParamRaw, setSearchParams])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchDraft.trim()), 200)
    return () => window.clearTimeout(t)
  }, [searchDraft])

  useEffect(() => {
    if (!searchDraft.trim()) setSearchAll(false)
  }, [searchDraft])

  useEffect(() => {
    try {
      localStorage.setItem(DOC_SORT_KEY_LS, sortKey)
    } catch { /* ignore */ }
  }, [sortKey])

  useEffect(() => {
    try {
      localStorage.setItem(DOC_SORT_DIR_LS, sortDir)
    } catch { /* ignore */ }
  }, [sortDir])

  useEffect(() => {
    setFileSelection(new Set())
    setSelectionMode(false)
  }, [filterFolderId])

  useEffect(() => {
    if (!loading && folderIdFromUrl && !folders.some(f => f.id === folderIdFromUrl)) {
      setSearchParams({}, { replace: true })
    }
  }, [loading, folderIdFromUrl, folders, setSearchParams])

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

  const breadcrumb = useMemo(
    () => folderBreadcrumbItems(folders, filterFolderId),
    [folders, filterFolderId],
  )

  const childFolders = useMemo(() => {
    return folders
      .filter(f => f.parent_id === filterFolderId)
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [folders, filterFolderId])

  const effectiveSearchAll = searchAll && debouncedSearch.trim().length > 0
  const showChildFolders = !effectiveSearchAll

  const sortedFiles = useMemo(() => {
    const list = [...files]
    const dirMul = sortDir === 'asc' ? 1 : -1
    list.sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      else if (sortKey === 'date') cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      else cmp = fileKind(a).localeCompare(fileKind(b))
      if (cmp !== 0) return cmp * dirMul
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
    return list
  }, [files, sortKey, sortDir])

  const fileIdsInView = useMemo(() => new Set(files.map(f => f.id)), [files])
  useEffect(() => {
    setFileSelection(prev => {
      const next = new Set<string>()
      for (const id of prev) {
        if (fileIdsInView.has(id)) next.add(id)
      }
      if (next.size === prev.size) {
        let same = true
        for (const id of prev) {
          if (!next.has(id)) {
            same = false
            break
          }
        }
        if (same) return prev
      }
      return next
    })
  }, [fileIdsInView])

  const fileMoveTargets = useMemo(() => flatFolderPickList(folders), [folders])

  const folderMoveOmit = useMemo(
    () => (moveFolderRow ? collectFolderSubtreeIds(folders, moveFolderRow.id) : undefined),
    [folders, moveFolderRow],
  )

  const folderMoveTargets = useMemo(
    () => flatFolderPickList(folders, folderMoveOmit),
    [folders, folderMoveOmit],
  )

  const taskLinkSummary = (fileId: string): { open: TaskFileLink[]; done: number } => {
    const all = taskLinksByFileId.get(fileId) ?? []
    const open = all.filter(t => !t.completed)
    const done = all.length - open.length
    return { open, done: Math.max(0, done) }
  }

  const setFolderInUrl = (id: string | null) => {
    if (id === null) setSearchParams({}, { replace: true })
    else setSearchParams({ folder: id }, { replace: true })
  }

  const filesNewPath = filterFolderId ? `/files/new?folder=${encodeURIComponent(filterFolderId)}` : '/files/new'

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
      setClipboardBanner('Link copied.')
      window.setTimeout(() => setClipboardBanner(null), 2000)
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

  const totalItemsHere = (showChildFolders ? childFolders.length : 0) + sortedFiles.length

  const toggleFileSelected = (id: string) => {
    setFileSelection(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAllInView = () => {
    setFileSelection(new Set(sortedFiles.map(f => f.id)))
  }

  const clearFileSelection = () => setFileSelection(new Set())

  const exitSelectionMode = () => {
    setSelectionMode(false)
    setFileSelection(new Set())
  }

  const parseDraggedFileIds = (e: DragEvent): string[] | null => {
    const raw = e.dataTransfer.getData(FILE_DRAG_MIME) || e.dataTransfer.getData('text/plain')
    if (!raw) return null
    try {
      const parsed = JSON.parse(raw) as unknown
      if (!Array.isArray(parsed) || !parsed.every(x => typeof x === 'string')) return null
      return parsed as string[]
    } catch {
      return null
    }
  }

  return (
    <div className="space-y-4 w-full min-w-0">
      {clipboardBanner && (
        <p className="text-xs text-amber-400/90 border border-amber-900/50 bg-amber-950/30 rounded-md px-3 py-2">
          {clipboardBanner}
        </p>
      )}
      {error && (
        <p className="text-xs text-red-400 border border-red-900/50 bg-red-950/30 rounded-md px-3 py-2">{error}</p>
      )}

      <nav className="flex flex-wrap items-center gap-1 text-sm text-neutral-400 min-w-0" aria-label="Folder path">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb.id ?? 'root'} className="flex items-center gap-1 min-w-0">
            {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0 text-neutral-600" aria-hidden />}
            {i === breadcrumb.length - 1 ? (
              <span className="text-neutral-100 font-medium truncate">{crumb.name}</span>
            ) : (
              <button
                type="button"
                className="hover:text-neutral-100 truncate transition-colors"
                onClick={() => setFolderInUrl(crumb.id)}
              >
                {crumb.name}
              </button>
            )}
          </span>
        ))}
      </nav>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
            <Input
              value={searchDraft}
              onChange={e => setSearchDraft(e.target.value)}
              placeholder="Search by file name…"
              className="pl-8 h-9 bg-neutral-950 border-neutral-800 text-sm"
              aria-label="Search documents"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-neutral-400 shrink-0 cursor-pointer select-none">
            <input
              type="checkbox"
              className="rounded border-neutral-600 bg-neutral-950"
              checked={searchAll}
              onChange={e => setSearchAll(e.target.checked)}
              disabled={!searchDraft.trim()}
            />
            All documents
          </label>
          {effectiveSearchAll && (
            <span className="text-[11px] text-neutral-500">Up to 200 matches, newest first.</span>
          )}
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <span className="text-xs text-neutral-500">Sort</span>
            <Select value={sortKey} onValueChange={v => setSortKey(v as DocSortKey)}>
              <SelectTrigger className="h-8 w-[120px] text-xs bg-neutral-950 border-neutral-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="date">Date</SelectItem>
                <SelectItem value="kind">Type</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortDir} onValueChange={v => setSortDir(v as DocSortDir)}>
              <SelectTrigger className="h-8 w-[100px] text-xs bg-neutral-950 border-neutral-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">Ascending</SelectItem>
                <SelectItem value="desc">Descending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectionMode ? (
          <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 py-2 px-3 rounded-lg border border-neutral-800 bg-neutral-950/95 backdrop-blur supports-[backdrop-filter]:bg-neutral-950/80">
            <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAllInView}>
              Select all
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={clearFileSelection}
              disabled={fileSelection.size === 0}
            >
              Deselect
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={fileSelection.size === 0}
              onClick={() => {
                setBulkMoveDest('__root__')
                setBulkMoveOpen(true)
              }}
            >
              <FolderInput className="h-3.5 w-3.5 mr-1" />
              Move to…{fileSelection.size > 0 ? ` (${fileSelection.size})` : ''}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              disabled={fileSelection.size === 0}
              onClick={() => {
                setBulkDeleteSummary(null)
                setBulkDeleteOpen(true)
              }}
            >
              Delete{fileSelection.size > 0 ? ` (${fileSelection.size})` : ''}
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs ml-auto" onClick={exitSelectionMode}>
              Cancel
            </Button>
          </div>
        ) : (
          sortedFiles.length > 0 && (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-neutral-500 hover:text-neutral-200"
                onClick={() => setSelectionMode(true)}
              >
                Select files
              </Button>
            </div>
          )
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-neutral-500">
          {totalItemsHere} item{totalItemsHere !== 1 ? 's' : ''}
          {effectiveSearchAll ? ' found' : ' in this folder'}
          {filterFolderId === null && folders.length > 0 && !effectiveSearchAll && (
            <span className="text-neutral-600"> · {folders.length} folder{folders.length !== 1 ? 's' : ''} total</span>
          )}
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
              const res = await addUploadedAsset({ file: f, deal_id: dealId, folder_id: filterFolderId })
              setUploading(false)
              if (res.error) {
                setUploadError(res.error.message)
                return
              }
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
          <Button variant="outline" onClick={() => { setNewFolderErr(null); setNewFolderName(''); setNewFolderOpen(true) }}>
            <Folder className="h-3.5 w-3.5" />
            New folder
          </Button>
          <Button onClick={() => navigate(filesNewPath)}>
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
      ) : totalItemsHere === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FilesIcon className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">
            {debouncedSearch.trim() ? 'No matching files' : 'This folder is empty'}
          </p>
          <p className="text-xs text-neutral-500 mb-4">
            {debouncedSearch.trim()
              ? 'Try different keywords or clear the search.'
              : 'Upload a file, create a folder, or generate from a template.'}
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Button variant="outline" size="sm" onClick={() => uploadInputRef.current?.click()}>
              <Upload className="h-3.5 w-3.5" />
              Upload
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setNewFolderName(''); setNewFolderErr(null); setNewFolderOpen(true) }}>
              <Folder className="h-3.5 w-3.5" />
              New folder
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(filesNewPath)}>
              Generate file
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {showChildFolders &&
            childFolders.map(sub => {
              const subCount = folders.filter(f => f.parent_id === sub.id).length
              const fileCount = folderFileCounts.byFolderId[sub.id] ?? 0
              const accent = sub.accent
              return (
                <div
                  key={sub.id}
                  className={cn(
                    'group relative rounded-lg border bg-neutral-900/80 p-3',
                    FOLDER_ACCENT_FOLDER_BORDER[accent],
                    'hover:border-neutral-600 hover:bg-neutral-900 transition-colors min-w-0 flex flex-col',
                    dragOverFolderId === sub.id && FOLDER_ACCENT_DROP_RING[accent],
                  )}
                  onDragOver={e => {
                    const types = Array.from(e.dataTransfer.types)
                    if (!types.includes(FILE_DRAG_MIME) && !types.includes('text/plain')) return
                    e.preventDefault()
                    e.dataTransfer.dropEffect = 'move'
                    setDragOverFolderId(sub.id)
                  }}
                  onDragLeave={e => {
                    if (e.currentTarget.contains(e.relatedTarget as Node)) return
                    setDragOverFolderId(null)
                  }}
                  onDrop={e => {
                    const ids = parseDraggedFileIds(e)
                    if (!ids?.length) {
                      setDragOverFolderId(null)
                      return
                    }
                    e.preventDefault()
                    setDragOverFolderId(null)
                    void moveFiles(ids, sub.id)
                  }}
                >
                  <button
                    type="button"
                    className="flex flex-col items-stretch text-left min-w-0 flex-1"
                    onClick={() => setFolderInUrl(sub.id)}
                  >
                    <Folder
                      className={cn('h-8 w-8 mb-2 shrink-0', FOLDER_ACCENT_FOLDER_ICON[accent])}
                      strokeWidth={1.5}
                    />
                    <span className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug">{sub.name}</span>
                    <span className="text-[11px] text-neutral-500 mt-1 tabular-nums">
                      {subCount} folder{subCount !== 1 ? 's' : ''}, {fileCount} file{fileCount !== 1 ? 's' : ''}
                    </span>
                  </button>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Folder ${sub.name} actions`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setRenameFolderRow(sub)
                            setRenameValue(sub.name)
                            setRenameOpen(true)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5 mr-2" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAccentFolder(sub)}>
                          <span className="h-3.5 w-3.5 mr-2 inline-block rounded-sm border border-neutral-600 bg-neutral-800" />
                          Folder color…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setMoveFolderRow(sub)
                            setMoveFolderDest('__root__')
                            setMoveFolderOpen(true)
                          }}
                        >
                          <FolderInput className="h-3.5 w-3.5 mr-2" />
                          Move to…
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-400 focus:text-red-400"
                          onClick={() => setConfirmDeleteFolder(sub)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              )
            })}

          {sortedFiles.map(file => {
            const fmt = fileKind(file)
            const canon = canonicalDealsByFileId.get(file.id)
            const { open: openTasks, done: doneTasks } = taskLinkSummary(file.id)
            const selected = fileSelection.has(file.id)
            const dragIds =
              fileSelection.size > 0 && fileSelection.has(file.id)
                ? Array.from(fileSelection)
                : [file.id]
            const inPathLabel = effectiveSearchAll
              ? folderDisplayPath(folders, file.folder_id ?? null)
              : null
            return (
              <div
                key={file.id}
                className={cn(
                  'group relative rounded-lg border border-neutral-800 bg-neutral-900/80 p-3',
                  'hover:border-neutral-600 hover:bg-neutral-900 transition-colors min-w-0 flex flex-col',
                  selected && selectionMode && 'ring-1 ring-neutral-400 border-neutral-500',
                )}
              >
                {selectionMode && (
                  <button
                    type="button"
                    className="absolute top-2 left-2 z-[1] rounded p-0.5 text-neutral-400 hover:text-neutral-100"
                    aria-label={selected ? 'Deselect file' : 'Select file'}
                    onClick={e => {
                      e.stopPropagation()
                      toggleFileSelected(file.id)
                    }}
                  >
                    {selected ? <Check className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                )}
                <button
                  type="button"
                  draggable
                  onDragStart={e => {
                    e.stopPropagation()
                    const payload = JSON.stringify(dragIds)
                    e.dataTransfer.setData(FILE_DRAG_MIME, payload)
                    e.dataTransfer.setData('text/plain', payload)
                    e.dataTransfer.effectAllowed = 'move'
                  }}
                  className={cn(
                    'absolute top-2 left-2 z-[1] rounded p-0.5 text-neutral-500 hover:text-neutral-200 cursor-grab active:cursor-grabbing',
                    selectionMode && 'left-8',
                  )}
                  aria-label="Drag onto a folder to move"
                  title="Drag onto a folder"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="flex flex-col items-stretch text-left min-w-0 flex-1 pt-5"
                  onClick={() => {
                    if (selectionMode) toggleFileSelected(file.id)
                    else setPreview(file)
                  }}
                >
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <FileText className="h-8 w-8 text-neutral-400 shrink-0" strokeWidth={1.5} />
                    <Badge
                      variant={fmt === 'pdf' ? 'blue' : fmt === 'upload' ? 'outline' : 'secondary'}
                      className="text-[10px] shrink-0"
                    >
                      {fmt === 'upload' ? 'Upload' : fmt === 'pdf' ? 'PDF' : 'Text'}
                    </Badge>
                  </div>
                  <span className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug" title={file.name}>
                    {file.name}
                  </span>
                  {inPathLabel && (
                    <span className="text-[10px] text-neutral-500 mt-0.5 line-clamp-2" title={inPathLabel}>
                      In: {inPathLabel}
                    </span>
                  )}
                  <span className="text-[11px] text-neutral-500 mt-1">
                    {new Date(file.created_at).toLocaleDateString()}
                  </span>
                  {(canon || openTasks.length > 0 || doneTasks > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {canon && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-800/50 text-emerald-400/95 truncate max-w-full"
                          title={`Canonical · ${canon.venue?.name ?? canon.description}`}
                        >
                          Canonical
                        </span>
                      )}
                      {openTasks.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-400">
                          {openTasks.length} task{openTasks.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {openTasks.length === 0 && doneTasks > 0 && (
                        <span className="text-[10px] text-neutral-500">{doneTasks} done</span>
                      )}
                    </div>
                  )}
                </button>
                <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`${file.name} actions`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {resolveGeneratedFileDownloadUrl(file, publicSiteOrigin()) && (
                        <DropdownMenuItem onClick={() => copyPdfLink(file)}>
                          <Copy className="h-3.5 w-3.5 mr-2" />
                          Copy link
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => setPreview(file)}>
                        <Eye className="h-3.5 w-3.5 mr-2" />
                        Preview
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDownload(file)}>
                        <Download className="h-3.5 w-3.5 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          setMoveFileRow(file)
                          setMoveFileDest(file.folder_id ?? '__root__')
                          setMoveFileOpen(true)
                        }}
                      >
                        <FolderInput className="h-3.5 w-3.5 mr-2" />
                        Move to…
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-400 focus:text-red-400"
                        onClick={() => setConfirmDelete(file)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
          </DialogHeader>
          <Input
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            placeholder="Folder name"
            className="bg-neutral-950 border-neutral-800"
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void (async () => {
                  setNewFolderSaving(true)
                  setNewFolderErr(null)
                  const r = await createFolder(newFolderName, filterFolderId)
                  setNewFolderSaving(false)
                  if (r.error) {
                    setNewFolderErr(r.error.message)
                    return
                  }
                  setNewFolderOpen(false)
                  setNewFolderName('')
                })()
              }
            }}
          />
          {newFolderErr && <p className="text-xs text-red-400">{newFolderErr}</p>}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
            <Button
              disabled={newFolderSaving || !newFolderName.trim()}
              onClick={async () => {
                setNewFolderSaving(true)
                setNewFolderErr(null)
                const r = await createFolder(newFolderName, filterFolderId)
                setNewFolderSaving(false)
                if (r.error) {
                  setNewFolderErr(r.error.message)
                  return
                }
                setNewFolderOpen(false)
                setNewFolderName('')
              }}
            >
              {newFolderSaving ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename folder</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            className="bg-neutral-950 border-neutral-800"
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button
              disabled={renameSaving || !renameFolderRow || !renameValue.trim()}
              onClick={async () => {
                if (!renameFolderRow) return
                setRenameSaving(true)
                const r = await renameFolder(renameFolderRow.id, renameValue)
                setRenameSaving(false)
                if (r.error) return
                setRenameOpen(false)
                setRenameFolderRow(null)
              }}
            >
              {renameSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveFileOpen} onOpenChange={setMoveFileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move file</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-500 truncate">{moveFileRow?.name}</p>
          <Select value={moveFileDest} onValueChange={setMoveFileDest}>
            <SelectTrigger className="bg-neutral-950 border-neutral-800">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              {fileMoveTargets.map(t => (
                <SelectItem key={t.id ?? '__root__'} value={t.id ?? '__root__'}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMoveFileOpen(false)}>Cancel</Button>
            <Button
              disabled={moveFileSaving || !moveFileRow}
              onClick={async () => {
                if (!moveFileRow) return
                setMoveFileSaving(true)
                const dest = moveFileDest === '__root__' ? null : moveFileDest
                const r = await moveFile(moveFileRow.id, dest)
                setMoveFileSaving(false)
                if (r.error) return
                setMoveFileOpen(false)
                setMoveFileRow(null)
              }}
            >
              {moveFileSaving ? 'Moving…' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={moveFolderOpen} onOpenChange={setMoveFolderOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move folder</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-500 truncate">{moveFolderRow?.name}</p>
          <Select value={moveFolderDest} onValueChange={setMoveFolderDest}>
            <SelectTrigger className="bg-neutral-950 border-neutral-800">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              {folderMoveTargets.map(t => (
                <SelectItem key={t.id ?? '__root__'} value={t.id ?? '__root__'}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setMoveFolderOpen(false)}>Cancel</Button>
            <Button
              disabled={moveFolderSaving || !moveFolderRow}
              onClick={async () => {
                if (!moveFolderRow) return
                setMoveFolderSaving(true)
                const dest = moveFolderDest === '__root__' ? null : moveFolderDest
                const r = await moveFolder(moveFolderRow.id, dest)
                setMoveFolderSaving(false)
                if (r.error) return
                setMoveFolderOpen(false)
                setMoveFolderRow(null)
              }}
            >
              {moveFolderSaving ? 'Moving…' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkMoveOpen} onOpenChange={setBulkMoveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {fileSelection.size} file{fileSelection.size !== 1 ? 's' : ''}</DialogTitle>
          </DialogHeader>
          <Select value={bulkMoveDest} onValueChange={setBulkMoveDest}>
            <SelectTrigger className="bg-neutral-950 border-neutral-800">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              {fileMoveTargets.map(t => (
                <SelectItem key={t.id ?? '__root__'} value={t.id ?? '__root__'}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBulkMoveOpen(false)}>Cancel</Button>
            <Button
              disabled={bulkMoveSaving || fileSelection.size === 0}
              onClick={async () => {
                setBulkMoveSaving(true)
                const dest = bulkMoveDest === '__root__' ? null : bulkMoveDest
                const r = await moveFiles(Array.from(fileSelection), dest)
                setBulkMoveSaving(false)
                if (r.error) return
                setBulkMoveOpen(false)
                clearFileSelection()
              }}
            >
              {bulkMoveSaving ? 'Moving…' : 'Move'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={o => {
          setBulkDeleteOpen(o)
          if (!o) setBulkDeleteSummary(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {fileSelection.size} file{fileSelection.size !== 1 ? 's' : ''}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Selected files will be permanently removed. Files linked to email template attachments are skipped automatically.
          </p>
          {bulkDeleteSummary && (
            <p className="text-xs text-amber-400/95 whitespace-pre-wrap">{bulkDeleteSummary}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => { setBulkDeleteOpen(false); setBulkDeleteSummary(null) }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={bulkDeleteSaving || fileSelection.size === 0}
              onClick={async () => {
                setBulkDeleteSaving(true)
                setBulkDeleteSummary(null)
                const res = await deleteFiles(Array.from(fileSelection))
                setBulkDeleteSaving(false)
                if (res.error) {
                  setBulkDeleteSummary(res.error.message)
                  return
                }
                const parts: string[] = []
                if (res.skippedTemplate > 0) {
                  parts.push(
                    `${res.skippedTemplate} file${res.skippedTemplate !== 1 ? 's were' : ' was'} skipped (linked to an email template).`,
                  )
                }
                if (res.errors.length > 0) {
                  parts.push(
                    `Some files could not be deleted:\n${res.errors.slice(0, 5).join('\n')}${res.errors.length > 5 ? '\n…' : ''}`,
                  )
                }
                if (res.deleted > 0) parts.push(`Deleted ${res.deleted} file${res.deleted !== 1 ? 's' : ''}.`)
                const msg = parts.filter(Boolean).join('\n\n')
                if (res.errors.length > 0) {
                  if (msg) setBulkDeleteSummary(msg)
                  return
                }
                setBulkDeleteOpen(false)
                clearFileSelection()
                if (msg) {
                  setClipboardBanner(msg)
                  window.setTimeout(() => setClipboardBanner(null), 8000)
                }
              }}
            >
              {bulkDeleteSaving ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!accentFolder} onOpenChange={o => { if (!o) setAccentFolder(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Folder color{accentFolder ? ` · ${accentFolder.name}` : ''}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-500 mb-2">Choose an accent for this folder tile.</p>
          <div className="grid grid-cols-4 gap-2">
            {FOLDER_ACCENTS.map(ac => (
              <button
                key={ac}
                type="button"
                disabled={accentSavingKey !== null}
                className={cn(
                  'h-10 rounded-md border-2 bg-neutral-900/80 transition-opacity flex items-center justify-center px-1 text-[10px] text-neutral-300',
                  FOLDER_ACCENT_FOLDER_BORDER[ac],
                  accentFolder?.accent === ac && 'ring-2 ring-offset-2 ring-offset-neutral-950 ring-neutral-200',
                )}
                title={FOLDER_ACCENT_LABELS[ac]}
                onClick={async () => {
                  if (!accentFolder) return
                  setAccentSavingKey(ac)
                  const r = await updateFolderAccent(accentFolder.id, ac)
                  setAccentSavingKey(null)
                  if (r.error) return
                  setAccentFolder(null)
                }}
              >
                {FOLDER_ACCENT_LABELS[ac]}
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccentFolder(null)} type="button">
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {confirmDeleteFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDeleteFolder(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete folder?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDeleteFolder.name}</strong> and any subfolders will be removed.
              Files inside will move to <strong className="text-neutral-200">Documents</strong> (root).
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDeleteFolder(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  const r = await deleteFolder(confirmDeleteFolder.id)
                  if (r.error) return
                  if (filterFolderId === confirmDeleteFolder.id) setFolderInUrl(null)
                  setConfirmDeleteFolder(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
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
