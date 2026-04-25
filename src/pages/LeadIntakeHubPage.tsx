import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  FolderPlus,
  Folders,
  Building2,
  ListTodo,
  Loader2,
  Plus,
  Search,
  FileText,
  Download,
  Trash2,
  Upload,
} from 'lucide-react'
import { useLeadFolders } from '@/hooks/useLeadFolders'
import { useLeads } from '@/hooks/useLeads'
import { useVenues } from '@/hooks/useVenues'
import { useLeadEmailEvents } from '@/hooks/useLeadEmailEvents'
import { parseLeadResearchImportText, type LeadImportPickedFields } from '@/lib/leadIntake/parseLeadResearchImport'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { TASK_LIST_SELECT } from '@/lib/tasks/taskListSelect'
import { useNavBadges } from '@/context/NavBadgesContext'
import { linkLeadToExistingVenue, promoteLeadToClientPipeline } from '@/lib/leadIntake/promoteLeadToClientPipeline'

type DateFilter = 'all' | '7d' | '30d'

const LEAD_LIST_PAGE_SIZE = 30

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function publicReferenceUrl(pathFromReferenceFolder: string): string {
  const base = import.meta.env.BASE_URL
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const path = pathFromReferenceFolder.startsWith('/') ? pathFromReferenceFolder : `/${pathFromReferenceFolder}`
  return `${trimmedBase}${path}`.replace(/([^:]\/)\/+/g, '$1')
}

async function fetchPublicReferenceAsDownload(
  pathFromReferenceFolder: string,
  downloadAs: string,
): Promise<void> {
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

function emptyPicked(): LeadImportPickedFields {
  return {
    venue_name: '',
    instagram_handle: '',
    genre: '',
    event_name: '',
    crowd_type: '',
    resident_dj: '',
    city: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    research_notes: '',
  }
}

export default function LeadIntakeHubPage() {
  const {
    folders,
    loading: foldersLoading,
    error: foldersError,
    createFolder,
    deleteFolder,
    notContactedFolderId,
    refetch: refetchFolders,
  } = useLeadFolders()
  const folderNameById = useMemo(() => new Map(folders.map(f => [f.id, f.name])), [folders])
  const reachedOutFolderId = useMemo(
    () => folders.find(f => f.name === 'Reached Out')?.id ?? null,
    [folders],
  )
  const { leads, loading: leadsLoading, error: leadsError, refetch: refetchLeads, insertLeads, addLead, updateLead, deleteLead } =
    useLeads(folderNameById)
  const { venues, loading: venuesLoading } = useVenues()
  const venuesSorted = useMemo(
    () => [...venues].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [venues],
  )

  const [search, setSearch] = useState('')
  const [filterFolder, setFilterFolder] = useState<string | 'all'>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [filterCity, setFilterCity] = useState('')
  const [filterGenre, setFilterGenre] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { rows: emailEvents, loading: emailLogLoading, refetch: refetchEmailLog } = useLeadEmailEvents(selectedId)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importDownloadError, setImportDownloadError] = useState<string | null>(null)

  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState<LeadImportPickedFields>(() => emptyPicked())
  const [addFolderId, setAddFolderId] = useState<string>('')
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [deleteLeadError, setDeleteLeadError] = useState<string | null>(null)

  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [newFolderBusy, setNewFolderBusy] = useState(false)

  const [manageFoldersOpen, setManageFoldersOpen] = useState(false)
  const [folderDeleteConfirm, setFolderDeleteConfirm] = useState<{
    id: string
    name: string
    leadCount: number
  } | null>(null)
  const [deleteFolderBusy, setDeleteFolderBusy] = useState(false)
  const [manageFoldersError, setManageFoldersError] = useState<string | null>(null)

  const [editForm, setEditForm] = useState<LeadImportPickedFields | null>(null)
  const [editFolderId, setEditFolderId] = useState<string>('')
  const [editDirty, setEditDirty] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const { refreshNavBadges } = useNavBadges()
  const [followUpOpen, setFollowUpOpen] = useState(false)
  const [followUpTitle, setFollowUpTitle] = useState('Follow up')
  const [followUpDue, setFollowUpDue] = useState('')
  const [followUpBusy, setFollowUpBusy] = useState(false)
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoteMode, setPromoteMode] = useState<'create' | 'link'>('create')
  const [linkVenueId, setLinkVenueId] = useState('')
  const [promoteBusy, setPromoteBusy] = useState(false)
  const [promoteError, setPromoteError] = useState<string | null>(null)

  const openPromoteDialog = useCallback(() => {
    setPromoteError(null)
    setPromoteMode('create')
    setLinkVenueId('')
    setPromoteOpen(true)
  }, [])

  const [listPage, setListPage] = useState(0)

  useEffect(() => {
    if (folders.length === 0) return
    if (!addFolderId || !folders.some(f => f.id === addFolderId)) {
      setAddFolderId(notContactedFolderId ?? folders[0]!.id)
    }
  }, [folders, addFolderId, notContactedFolderId])

  useEffect(() => {
    if (filterFolder === 'all') return
    if (!folders.some(f => f.id === filterFolder)) {
      setFilterFolder('all')
    }
  }, [folders, filterFolder])

  useEffect(() => {
    setListPage(0)
  }, [search, filterFolder, dateFilter, filterCity, filterGenre])

  const selected = useMemo(() => leads.find(l => l.id === selectedId) ?? null, [leads, selectedId])

  useEffect(() => {
    if (selected) {
      setEditForm({
        venue_name: selected.venue_name ?? '',
        instagram_handle: selected.instagram_handle ?? '',
        genre: selected.genre ?? '',
        event_name: selected.event_name ?? '',
        crowd_type: selected.crowd_type ?? '',
        resident_dj: selected.resident_dj ?? '',
        city: selected.city ?? '',
        contact_email: selected.contact_email ?? '',
        contact_phone: selected.contact_phone ?? '',
        website: selected.website ?? '',
        research_notes: selected.research_notes ?? '',
      })
      setEditFolderId(selected.folder_id)
    } else {
      setEditForm(null)
    }
    setEditDirty(false)
    setDeleteLeadError(null)
  }, [selected?.id, selectedId])

  useEffect(() => {
    if (leadsLoading) return
    if (leads.length === 0) {
      setSelectedId(null)
      return
    }
    setSelectedId(prev => (prev && leads.some(l => l.id === prev) ? prev : null))
  }, [leadsLoading, leads])

  const dateCutoff = useMemo(() => {
    if (dateFilter === 'all') return null
    const d = new Date()
    if (dateFilter === '7d') d.setDate(d.getDate() - 7)
    if (dateFilter === '30d') d.setDate(d.getDate() - 30)
    d.setHours(0, 0, 0, 0)
    return d
  }, [dateFilter])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const c = filterCity.toLowerCase().trim()
    const g = filterGenre.toLowerCase().trim()
    return leads.filter(lead => {
      if (filterFolder !== 'all' && lead.folder_id !== filterFolder) return false
      if (dateCutoff) {
        const created = new Date(lead.created_at)
        if (Number.isNaN(created.getTime()) || created < dateCutoff) return false
      }
      if (c) {
        const city = (lead.city ?? '').toLowerCase()
        if (!city.includes(c)) return false
      }
      if (g) {
        const genre = (lead.genre ?? '').toLowerCase()
        if (!genre.includes(g)) return false
      }
      if (!q) return true
      return (
        (lead.venue_name ?? '').toLowerCase().includes(q) ||
        (lead.city ?? '').toLowerCase().includes(q) ||
        (lead.genre ?? '').toLowerCase().includes(q) ||
        (lead.instagram_handle ?? '').toLowerCase().includes(q)
      )
    })
  }, [leads, search, filterFolder, dateCutoff, filterCity, filterGenre])

  const listMaxPage = useMemo(
    () =>
      filtered.length === 0 ? 0 : Math.max(0, Math.ceil(filtered.length / LEAD_LIST_PAGE_SIZE) - 1),
    [filtered],
  )
  const safeListPage = Math.min(listPage, listMaxPage)

  useEffect(() => {
    if (listPage > listMaxPage) setListPage(listMaxPage)
  }, [listPage, listMaxPage])

  const pagedLeads = useMemo(() => {
    const start = safeListPage * LEAD_LIST_PAGE_SIZE
    return filtered.slice(start, start + LEAD_LIST_PAGE_SIZE)
  }, [filtered, safeListPage])

  const listPageLabelTotal = useMemo(
    () => Math.max(1, Math.ceil(Math.max(0, filtered.length) / LEAD_LIST_PAGE_SIZE)),
    [filtered.length],
  )
  const listRangeText = useMemo(() => {
    if (filtered.length === 0) return null
    const a = safeListPage * LEAD_LIST_PAGE_SIZE + 1
    const b = Math.min((safeListPage + 1) * LEAD_LIST_PAGE_SIZE, filtered.length)
    return `${a}–${b} of ${filtered.length}`
  }, [filtered.length, safeListPage])

  const importPreview = useMemo(() => {
    if (!importText.trim()) return []
    return parseLeadResearchImportText(importText)
  }, [importText])

  const downloadLeadImportSpec = useCallback(async () => {
    setImportDownloadError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/lead-intake-mass-import-spec.md',
        'lead-intake-mass-import-spec.md',
      )
    } catch {
      setImportDownloadError('Could not download the spec file. Check your connection or try again.')
    }
  }, [])

  const downloadLeadImportExample = useCallback(async () => {
    setImportDownloadError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/lead-intake-mass-import.example.json',
        'lead-intake-mass-import.example.json',
      )
    } catch {
      setImportDownloadError('Could not download the example JSON. Check your connection or try again.')
    }
  }, [])

  const handleOpenAdd = useCallback(() => {
    setAddForm(emptyPicked())
    setAddFolderId(notContactedFolderId ?? folders[0]?.id ?? '')
    setAddError(null)
    setAddOpen(true)
  }, [notContactedFolderId, folders])

  const handleSaveEdit = useCallback(async () => {
    if (!selected || !editForm) return
    setSaveBusy(true)
    const prevFolderId = selected.folder_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSaveBusy(false)
      return
    }
    const { error } = await updateLead(selected.id, {
      folder_id: editFolderId,
      venue_name: editForm.venue_name || null,
      instagram_handle: editForm.instagram_handle || null,
      genre: editForm.genre || null,
      event_name: editForm.event_name || null,
      crowd_type: editForm.crowd_type || null,
      resident_dj: editForm.resident_dj || null,
      city: editForm.city || null,
      contact_email: editForm.contact_email || null,
      contact_phone: editForm.contact_phone || null,
      website: editForm.website || null,
      research_notes: editForm.research_notes || null,
    })
    setSaveBusy(false)
    if (!error) {
      if (prevFolderId !== editFolderId) {
        const { error: moveErr } = await supabase.from('lead_folder_movements').insert({
          user_id: user.id,
          lead_id: selected.id,
          from_folder_id: prevFolderId,
          to_folder_id: editFolderId,
          source: 'manual',
        })
        if (moveErr) console.error('[lead_folder_movements]', moveErr.message)
      }
      setEditDirty(false)
      void refetchEmailLog()
    }
  }, [selected, editForm, editFolderId, updateLead, refetchEmailLog])

  const handleDelete = useCallback(async () => {
    if (!selected) return
    if (!window.confirm('Delete this lead? This cannot be undone.')) return
    setDeleteLeadError(null)
    const id = selected.id
    const res = await deleteLead(id)
    if (res && 'error' in res && res.error) {
      setDeleteLeadError(res.error instanceof Error ? res.error.message : 'Delete failed.')
      return
    }
    setSelectedId(null)
  }, [selected, deleteLead])

  const runImport = useCallback(async () => {
    const folderId = notContactedFolderId ?? folders[0]?.id
    if (!folderId) {
      setImportMessage('No folder available — try refreshing.')
      return
    }
    const toImport = importPreview.filter(p => p.importable).map(p => p.row)
    if (toImport.length === 0) {
      setImportMessage('Nothing to import — fix vital fields (venue, Instagram, genre) for at least one row.')
      return
    }
    setImportBusy(true)
    setImportMessage(null)
    const { error } = await insertLeads(toImport, folderId)
    setImportBusy(false)
    if (error) {
      setImportMessage(error.message)
      return
    }
    setImportText('')
    setImportOpen(false)
    setImportMessage(null)
  }, [importPreview, notContactedFolderId, folders, insertLeads])

  const runAdd = useCallback(async () => {
    if (!addFolderId) return
    setAddBusy(true)
    setAddError(null)
    const { error } = await addLead(addForm, addFolderId)
    setAddBusy(false)
    if (error) {
      setAddError(error.message)
      return
    }
    setAddOpen(false)
    setAddForm(emptyPicked())
  }, [addForm, addFolderId, addLead])

  const openFollowUpTask = useCallback(() => {
    setFollowUpTitle('Follow up')
    setFollowUpDue('')
    setFollowUpError(null)
    setFollowUpOpen(true)
  }, [])

  const runFollowUpTask = useCallback(async () => {
    if (!selected) return
    const title = followUpTitle.trim()
    if (!title) {
      setFollowUpError('Add a title.')
      return
    }
    setFollowUpBusy(true)
    setFollowUpError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setFollowUpBusy(false)
      setFollowUpError('Not signed in.')
      return
    }
    const { error } = await supabase
      .from('tasks')
      .insert({
        user_id: user.id,
        title,
        notes: null,
        due_date: followUpDue || null,
        priority: 'medium',
        recurrence: 'none',
        completed: false,
        venue_id: null,
        deal_id: null,
        lead_id: selected.id,
        lead_folder_id: selected.folder_id,
      })
      .select(TASK_LIST_SELECT)
      .single()
    setFollowUpBusy(false)
    if (error) {
      setFollowUpError(error.message)
      return
    }
    setFollowUpOpen(false)
    void refreshNavBadges()
  }, [selected, followUpTitle, followUpDue, refreshNavBadges])

  const runPromoteToPipeline = useCallback(async () => {
    if (!selected) return
    setPromoteError(null)
    if (promoteMode === 'link' && !linkVenueId) {
      setPromoteError('Select a venue.')
      return
    }
    setPromoteBusy(true)
    const r =
      promoteMode === 'link'
        ? await linkLeadToExistingVenue(selected, linkVenueId)
        : await promoteLeadToClientPipeline(selected)
    setPromoteBusy(false)
    if (!r.ok) {
      setPromoteError(r.message)
      return
    }
    setPromoteOpen(false)
    void refetchLeads()
    void refreshNavBadges()
  }, [selected, promoteMode, linkVenueId, refetchLeads, refreshNavBadges])

  const runMarkReachedOut = useCallback(async () => {
    if (!selected || !reachedOutFolderId) return
    if (selected.folder_id === reachedOutFolderId) return
    const previousFolderId = selected.folder_id
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSaveBusy(true)
    const { error } = await updateLead(selected.id, { folder_id: reachedOutFolderId })
    setSaveBusy(false)
    if (error) return

    const { error: moveErr } = await supabase.from('lead_folder_movements').insert({
      user_id: user.id,
      lead_id: selected.id,
      from_folder_id: previousFolderId,
      to_folder_id: reachedOutFolderId,
      source: 'manual',
    })
    if (moveErr) console.error('[lead_folder_movements]', moveErr.message)

    setEditFolderId(reachedOutFolderId)
    setEditDirty(false)
  }, [selected, reachedOutFolderId, updateLead])

  const runNewFolder = useCallback(async () => {
    setNewFolderBusy(true)
    const { error } = await createFolder(newFolderName)
    setNewFolderBusy(false)
    if (!error) {
      setNewFolderName('')
      setNewFolderOpen(false)
      void refetchFolders()
    }
  }, [newFolderName, createFolder, refetchFolders])

  const runConfirmDeleteFolder = useCallback(async () => {
    if (!folderDeleteConfirm) return
    setDeleteFolderBusy(true)
    setManageFoldersError(null)
    const res = await deleteFolder(folderDeleteConfirm.id)
    setDeleteFolderBusy(false)
    if (res.error) {
      setManageFoldersError(res.error.message)
      return
    }
    setFolderDeleteConfirm(null)
    void refetchLeads()
  }, [folderDeleteConfirm, deleteFolder, refetchLeads])

  if (foldersLoading) {
    return (
      <div className="flex min-h-[min(50vh,20rem)] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  const skipped = importPreview.filter(p => !p.importable)
  const importable = importPreview.filter(p => p.importable)

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3 text-neutral-100 md:min-h-[calc(100dvh-7.5rem)]">
      <p className="text-[11px] text-neutral-500 leading-relaxed max-w-3xl">
        <span className="text-neutral-600">Works with: </span>
        <Link
          to="/email-templates?group=leads"
          className="text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline"
        >
          Lead email templates
        </Link>
        <span className="text-neutral-600 mx-1" aria-hidden>
          ·
        </span>
        <Link to="/pipeline" className="text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline">
          Tasks
        </Link>
        <span className="text-neutral-600"> (link leads &amp; email on complete)</span>
        <span className="text-neutral-600 mx-1" aria-hidden>
          ·
        </span>
        <Link
          to="/email-queue"
          className="text-neutral-400 hover:text-neutral-200 underline-offset-2 hover:underline"
        >
          Email queue
        </Link>
        <span className="text-neutral-600"> (custom lead sends)</span>
      </p>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-neutral-600 text-neutral-200"
          onClick={() => setNewFolderOpen(true)}
        >
          <FolderPlus className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">New folder</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-neutral-600 text-neutral-200"
          onClick={() => {
            setManageFoldersError(null)
            setFolderDeleteConfirm(null)
            setManageFoldersOpen(true)
          }}
        >
          <Folders className="h-3.5 w-3.5 mr-1" />
          <span className="hidden sm:inline">Manage folders</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-9 border-neutral-600"
          onClick={() => {
            setImportText('')
            setImportMessage(null)
            setImportOpen(true)
          }}
        >
          <Upload className="h-3.5 w-3.5 mr-1" />
          Import
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-9 gap-1.5 shrink-0 bg-neutral-100 text-neutral-950 hover:bg-white"
          onClick={handleOpenAdd}
        >
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-950/40">
        <div className="flex flex-col min-h-0 bg-neutral-950/60 w-full min-w-0">
          <div className="p-2 sm:p-3 border-b border-neutral-800/80 shrink-0">
            {foldersError || leadsError ? (
              <p className="text-xs text-red-400 mb-2">{foldersError ?? leadsError}</p>
            ) : null}
            <div
              className="flex w-full min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin] sm:gap-2"
              title="Search and filters (scroll horizontally on narrow screens)"
            >
              <div
                className="min-w-[35%] max-w-full grow-[2] basis-0"
                title="Search leads (opens query field)"
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className={cn(
                        'h-8 w-full min-w-0 justify-start gap-1.5 border-neutral-700 bg-neutral-950/80 px-2.5 text-xs',
                        search.trim() && 'border-neutral-500/70',
                      )}
                      aria-label={search.trim() ? `Search: ${search}` : 'Open search'}
                    >
                      <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden />
                      {search.trim() ? (
                        <span className="min-w-0 flex-1 truncate text-left text-neutral-200">{search}</span>
                      ) : (
                        <span className="text-neutral-500">Search</span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-[min(20rem,calc(100vw-1.5rem))] p-0 border-neutral-800 bg-neutral-900"
                  onCloseAutoFocus={e => e.preventDefault()}
                >
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-[10px] font-medium text-neutral-500">Search leads</p>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
                      <Input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Name, city, handle…"
                        className="h-8 pl-8 text-sm border-neutral-700 bg-neutral-950/80"
                        autoFocus
                        aria-label="Search leads by name, city, or handle"
                      />
                    </div>
                  </div>
                </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <Select value={filterFolder} onValueChange={v => setFilterFolder(v as typeof filterFolder)}>
                <SelectTrigger
                  className="h-8 w-[4.75rem] sm:min-w-[6.5rem] sm:w-32 shrink-0 text-xs border-neutral-700 bg-neutral-950/80 px-2"
                  aria-label="Filter by folder"
                >
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={dateFilter} onValueChange={v => setDateFilter(v as DateFilter)}>
                <SelectTrigger
                  className="h-8 w-[3.5rem] sm:min-w-[4.5rem] sm:w-24 shrink-0 text-xs border-neutral-700 bg-neutral-950/80 px-2"
                  aria-label="Date added"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any</SelectItem>
                  <SelectItem value="7d">7 days</SelectItem>
                  <SelectItem value="30d">30 days</SelectItem>
                </SelectContent>
              </Select>

              <Input
                value={filterCity}
                onChange={e => setFilterCity(e.target.value)}
                placeholder="City"
                className="h-8 min-w-[4.5rem] flex-1 basis-0 text-xs border-neutral-700 bg-neutral-950/80"
                aria-label="Filter by city"
              />
              <Input
                value={filterGenre}
                onChange={e => setFilterGenre(e.target.value)}
                placeholder="Genre"
                className="h-8 min-w-[4.5rem] flex-1 basis-0 text-xs border-neutral-700 bg-neutral-950/80"
                aria-label="Filter by genre"
              />
            </div>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto p-2 sm:p-3 space-y-1.5 min-h-0">
            {leadsLoading && leads.length === 0 ? (
              <div className="flex justify-center py-12 text-neutral-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? null : (
              pagedLeads.map(lead => {
                const active = lead.id === selectedId
                const noEmail = !lead.contact_email?.trim()
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => setSelectedId(lead.id)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      active
                        ? 'border-neutral-200 bg-neutral-900/80 shadow-sm'
                        : 'border-white/[0.06] bg-neutral-900/20 hover:border-white/10 hover:bg-neutral-900/40',
                    )}
                  >
                    <div className="text-sm font-medium text-neutral-100 line-clamp-2 leading-snug">
                      {lead.venue_name?.trim() || 'Untitled lead'}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500 space-y-0.5">
                      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                        {(lead.city || lead.genre) && (
                          <span>
                            {[lead.city, lead.genre].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {noEmail && (
                          <span className="rounded border border-amber-900/50 bg-amber-950/30 px-1.5 text-[10px] text-amber-200/90">
                            No email
                          </span>
                        )}
                        {lead.promoted_venue_id && (
                          <span className="rounded border border-neutral-600 bg-neutral-800/50 px-1.5 text-[10px] text-neutral-300">
                            In pipeline
                          </span>
                        )}
                      </div>
                      <div className="flex justify-between gap-2 text-neutral-600">
                        <span>{lead.folder_name ?? '—'}</span>
                        <span className="shrink-0 flex items-center gap-1" title="Last email sent">
                          <Calendar className="h-3 w-3 opacity-70" />
                          {fmtDate(lead.last_contacted_at)}
                        </span>
                      </div>
                    </div>
                  </button>
                )
              })
            )}
            </div>
            {filtered.length > LEAD_LIST_PAGE_SIZE && listRangeText ? (
              <div
                className="shrink-0 border-t border-neutral-800/80 flex flex-wrap items-center justify-between gap-1.5 px-2 sm:px-3 py-2"
                role="navigation"
                aria-label="Lead list pages"
              >
                <span className="text-[11px] text-neutral-500 tabular-nums min-w-0 pr-1">{listRangeText}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-1.5 border-neutral-600"
                    disabled={safeListPage <= 0}
                    onClick={() => setListPage(p => Math.max(0, p - 1))}
                    aria-label="Previous page"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-[11px] text-neutral-400 tabular-nums px-0.5 min-w-[4.5rem] text-center">
                    {safeListPage + 1} / {listPageLabelTotal}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-1.5 border-neutral-600"
                    disabled={safeListPage >= listMaxPage}
                    onClick={() => setListPage(p => p + 1)}
                    aria-label="Next page"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        {filtered.length === 0 && !leadsLoading ? (
          <p className="shrink-0 p-4 sm:p-6 text-sm text-neutral-500 text-center sm:text-left">
            {leads.length === 0
              ? 'No leads yet — import, add one, or clear filters to see the list here. Click a lead when it appears to open details.'
              : 'No matches — adjust search or filters. Click a lead in the list to open details in a pop-up.'}
          </p>
        ) : null}
      </div>

      <Dialog
        open={Boolean(selectedId && selected && editForm)}
        onOpenChange={open => {
          if (open) return
          if (editDirty) {
            if (!window.confirm('You have unsaved changes. Close without saving?')) return
          }
          setSelectedId(null)
        }}
      >
        <DialogContent
          className="max-h-[min(90dvh,900px)] w-full max-w-2xl overflow-y-auto border-neutral-800 bg-neutral-950 p-0 gap-0 text-neutral-100"
        >
          {selected && editForm ? (
            <div className="p-4 sm:p-5 space-y-5">
              <DialogHeader className="text-left space-y-1.5 p-0">
                <DialogTitle className="text-lg font-semibold tracking-tight text-neutral-100 leading-snug pr-8">
                  {editForm.venue_name.trim() || 'Lead'}
                </DialogTitle>
                <DialogDescription asChild>
                  <p className="text-sm text-neutral-500">Created {fmtDate(selected.created_at)}</p>
                </DialogDescription>
                {selected.promoted_venue_id ? (
                  <p className="text-sm text-neutral-400 pt-1">
                    <Link
                      to="/outreach"
                      className="inline-flex items-center gap-1.5 font-medium text-neutral-200 hover:text-white underline-offset-2 hover:underline"
                    >
                      <Building2 className="h-4 w-4 shrink-0" />
                      Client pipeline: {selected.promoted_venue_name?.trim() || 'Venue'}
                    </Link>
                  </p>
                ) : null}
              </DialogHeader>
              <div className="flex flex-wrap gap-2">
                {selected.promoted_venue_id ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-neutral-600"
                    onClick={openPromoteDialog}
                  >
                    <Building2 className="h-4 w-4 mr-1" />
                    Add to client pipeline
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-neutral-600"
                  onClick={openFollowUpTask}
                >
                  <ListTodo className="h-4 w-4 mr-1" />
                  Follow-up task
                </Button>
                {reachedOutFolderId && selected.folder_id !== reachedOutFolderId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-9 border-neutral-500 text-neutral-100"
                    onClick={() => void runMarkReachedOut()}
                    disabled={saveBusy}
                  >
                    Mark reached out
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="h-9 bg-neutral-100 text-neutral-950 hover:bg-white"
                  disabled={saveBusy || !editDirty}
                  onClick={() => void handleSaveEdit()}
                >
                  {saveBusy ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-9 border-red-900/50 text-red-300 hover:bg-red-950/40"
                  onClick={() => void handleDelete()}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
              {deleteLeadError ? (
                <p className="text-sm text-red-400">{deleteLeadError}</p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Folder</Label>
                  <Select
                    value={editFolderId}
                    onValueChange={v => {
                      setEditFolderId(v)
                      setEditDirty(true)
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-neutral-500">
                    Move this lead here and click <span className="text-neutral-300">Save changes</span>.
                  </p>
                </div>
                {(
                  [
                    ['venue_name', 'Venue / brand name'],
                    ['instagram_handle', 'Instagram handle (no @)'],
                    ['genre', 'Genre(s)'],
                    ['event_name', 'Event name'],
                    ['crowd_type', 'Crowd type'],
                    ['resident_dj', 'Resident DJ'],
                    ['city', 'City'],
                    ['contact_email', 'Contact email'],
                    ['contact_phone', 'Contact phone'],
                    ['website', 'Website'],
                  ] as const
                ).map(([key, lab]) => (
                  <div key={key} className="space-y-1">
                    <Label>{lab}</Label>
                    <Input
                      value={editForm[key]}
                      onChange={e => {
                        setEditForm(f => (f ? { ...f, [key]: e.target.value } : f))
                        setEditDirty(true)
                      }}
                    />
                  </div>
                ))}
                <div className="space-y-1 sm:col-span-2">
                  <Label>Research notes</Label>
                  <Textarea
                    rows={4}
                    value={editForm.research_notes}
                    onChange={e => {
                      setEditForm(f => (f ? { ...f, research_notes: e.target.value } : f))
                      setEditDirty(true)
                    }}
                    className="border-neutral-700 bg-neutral-950/80"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-neutral-800/90 bg-neutral-900/20 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">Email history</h3>
                {emailLogLoading ? (
                  <p className="text-sm text-neutral-500">Loading…</p>
                ) : emailEvents.length === 0 ? (
                  <p className="text-sm text-neutral-500">No emails logged yet for this lead.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-neutral-300">
                    {emailEvents.map(ev => (
                      <li
                        key={ev.id}
                        className="border-b border-neutral-800/80 pb-2 last:border-0 last:pb-0"
                      >
                        <div className="flex flex-wrap justify-between gap-2 text-neutral-200">
                          <span className="font-medium">
                            {ev.template_name || ev.email_type}
                          </span>
                          <span className="text-xs text-neutral-500">{fmtDate(ev.sent_at ?? ev.created_at)}</span>
                        </div>
                        {ev.status !== 'sent' && (
                          <p className="text-[11px] text-amber-400/90 mt-0.5">Status: {ev.status}</p>
                        )}
                        <p className="text-xs text-neutral-500 mt-0.5 truncate" title={ev.subject}>
                          {ev.subject}
                        </p>
                        {ev.moved_to_folder_id ? (
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            Folder after send:{' '}
                            {folders.find(f => f.id === ev.moved_to_folder_id)?.name ?? '—'}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={promoteOpen} onOpenChange={v => { if (!v) setPromoteOpen(false) }}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add to client pipeline</DialogTitle>
            <DialogDescription className="text-neutral-500">
              {promoteMode === 'create' ? (
                <>Creates a new venue in Outreach with this lead’s name and city, adds a contact when email or phone is set, and links the lead to that record. You can keep using this lead for research notes.</>
              ) : (
                <>Links this lead to a venue you already have in Outreach. The venue’s existing contacts and fields are not replaced by the lead; edit the venue in Outreach if you need to add this lead’s details.</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant={promoteMode === 'create' ? 'default' : 'outline'}
              className={promoteMode === 'create' ? 'bg-neutral-100 text-neutral-950 hover:bg-white' : 'border-neutral-600'}
              onClick={() => {
                setPromoteMode('create')
                setPromoteError(null)
              }}
            >
              Create new venue
            </Button>
            <Button
              type="button"
              size="sm"
              variant={promoteMode === 'link' ? 'default' : 'outline'}
              className={promoteMode === 'link' ? 'bg-neutral-100 text-neutral-950 hover:bg-white' : 'border-neutral-600'}
              onClick={() => {
                setPromoteMode('link')
                setPromoteError(null)
                setLinkVenueId(prev => prev || venuesSorted[0]?.id || '')
              }}
            >
              Link existing
            </Button>
          </div>
          {promoteMode === 'link' ? (
            <div className="space-y-1.5">
              <Label className="text-neutral-300">Outreach venue</Label>
              {venuesLoading ? (
                <p className="text-sm text-neutral-500">Loading venues…</p>
              ) : venuesSorted.length === 0 ? (
                <p className="text-sm text-amber-400/90">Add a venue in Outreach first, or choose “Create new venue” above.</p>
              ) : (
                <Select value={linkVenueId} onValueChange={setLinkVenueId}>
                  <SelectTrigger className="border-neutral-700 bg-neutral-950/80">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {venuesSorted.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.name.trim() || 'Venue'}
                        {v.city ? ` — ${v.city}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : null}
          {promoteError && <p className="text-xs text-red-400">{promoteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPromoteOpen(false)}
              className="border-neutral-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-neutral-100 text-neutral-950 hover:bg-white"
              onClick={() => void runPromoteToPipeline()}
              disabled={
                promoteBusy
                || (promoteMode === 'link' && (venuesLoading || venuesSorted.length === 0))
              }
            >
              {promoteBusy
                ? promoteMode === 'link'
                  ? 'Linking…'
                  : 'Creating…'
                : promoteMode === 'link'
                  ? 'Link to venue'
                  : 'Create venue & link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={followUpOpen} onOpenChange={v => !v && setFollowUpOpen(false)}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add follow-up task</DialogTitle>
            <DialogDescription className="text-neutral-500">
              Creates a task on Pipeline and Tasks linked to this lead.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                value={followUpTitle}
                onChange={e => setFollowUpTitle(e.target.value)}
                className="border-neutral-700 bg-neutral-950/80"
                placeholder="e.g. Follow up on reply"
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), void runFollowUpTask())}
              />
            </div>
            <div className="space-y-1">
              <Label>Due date</Label>
              <Input
                type="date"
                value={followUpDue}
                onChange={e => setFollowUpDue(e.target.value)}
                className="border-neutral-700 bg-neutral-950/80"
              />
            </div>
            {followUpError && <p className="text-xs text-red-400">{followUpError}</p>}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFollowUpOpen(false)}
              className="border-neutral-600"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-neutral-100 text-neutral-950"
              onClick={() => void runFollowUpTask()}
              disabled={followUpBusy || !followUpTitle.trim()}
            >
              {followUpBusy ? 'Adding…' : 'Add task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) {
            setImportMessage(null)
            setImportDownloadError(null)
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0 border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Import leads</DialogTitle>
            <DialogDescription className="text-neutral-500">
              Paste research output, a JSON array, or a single object. Rows missing venue name, Instagram handle, or
              genre are skipped. Use the spec and example so bulk JSON matches the parser exactly.
            </DialogDescription>
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
                    onClick={() => void downloadLeadImportSpec()}
                  >
                    <FileText className="h-3.5 w-3.5" /> Spec (.md)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => void downloadLeadImportExample()}
                  >
                    <Download className="h-3.5 w-3.5" /> Example (.json)
                  </Button>
                </div>
              </div>
              {importDownloadError ? <p className="text-xs text-red-400">{importDownloadError}</p> : null}
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-neutral-400">Paste or load file</Label>
              <Textarea
                className="min-h-[200px] font-mono text-sm border border-neutral-700 bg-neutral-950 px-2 py-1.5"
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder='[ { "venue_name": "…", "instagram_handle": "…", "genre": "…" }, … ]  or  venue_name: …'
                spellCheck={false}
              />
            </div>
            <div>
              <Input
                type="file"
                accept=".txt,.json,.md,.text,text/plain,application/json"
                className="h-9 text-xs file:mr-2 file:text-xs file:text-neutral-400 border-neutral-800 bg-neutral-900/30"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => {
                    setImportText(String(r.result ?? ''))
                    e.target.value = ''
                  }
                  r.readAsText(f, 'utf-8')
                }}
              />
            </div>
          </div>
          {importPreview.length > 0 && (
            <div className="text-xs space-y-2 max-h-40 overflow-y-auto pr-1">
              <p className="text-neutral-400">Ready: {importable.length} · Skipped: {skipped.length}</p>
              {skipped.length > 0 && (
                <p className="text-amber-400/90">Skipped rows need venue, Instagram, and genre before import.</p>
              )}
            </div>
          )}
          {importMessage && <p className="text-xs text-red-400">{importMessage}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)} className="border-neutral-600">
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-neutral-100 text-neutral-950"
              onClick={() => void runImport()}
              disabled={importBusy || importable.length === 0}
            >
              {importBusy ? 'Importing…' : `Import ${importable.length || ''}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>Add lead</DialogTitle>
            <DialogDescription className="text-neutral-500">Enter what you have; you can complete fields later.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1">
              <Label>Folder</Label>
              <Select value={addFolderId} onValueChange={setAddFolderId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {folders.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(
              [
                ['venue_name', 'Venue / brand name'],
                ['instagram_handle', 'Instagram handle'],
                ['genre', 'Genre(s)'],
                ['city', 'City'],
                ['contact_email', 'Contact email'],
              ] as const
            ).map(([k, lab]) => (
              <div key={k} className="space-y-1">
                <Label>{lab}</Label>
                <Input
                  value={addForm[k]}
                  onChange={e => setAddForm(f => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
            <div className="space-y-1">
              <Label>Research notes</Label>
              <Textarea
                rows={3}
                value={addForm.research_notes}
                onChange={e => setAddForm(f => ({ ...f, research_notes: e.target.value }))}
                className="border-neutral-700 bg-neutral-900/50"
              />
            </div>
            {addError && <p className="text-xs text-red-400">{addError}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)} className="border-neutral-600">
              Cancel
            </Button>
            <Button type="button" className="bg-neutral-100 text-neutral-950" onClick={() => void runAdd()} disabled={!addFolderId || addBusy}>
              {addBusy ? 'Saving…' : 'Save lead'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="max-w-sm border-neutral-800 bg-neutral-950 text-neutral-100">
          <DialogHeader>
            <DialogTitle>New folder</DialogTitle>
            <DialogDescription className="text-neutral-500">Create a custom folder to organize leads.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} className="border-neutral-700" />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)} className="border-neutral-600">
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-neutral-100 text-neutral-950"
              onClick={() => void runNewFolder()}
              disabled={!newFolderName.trim() || newFolderBusy}
            >
              {newFolderBusy ? 'Creating…' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={manageFoldersOpen}
        onOpenChange={o => {
          setManageFoldersOpen(o)
          if (!o) {
            setFolderDeleteConfirm(null)
            setManageFoldersError(null)
          }
        }}
      >
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 text-neutral-100 max-h-[85vh] flex flex-col">
          {folderDeleteConfirm ? (
            <>
              <DialogHeader>
                <DialogTitle>Delete folder?</DialogTitle>
                <DialogDescription className="text-neutral-500">
                  This removes the folder only. Leads are kept and moved to your default pipeline folder,{' '}
                  <span className="text-neutral-300">Not Contacted</span>, so you can re-sort them later.
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm text-neutral-300">
                <span className="font-medium text-neutral-200">{folderDeleteConfirm.name}</span>
                {folderDeleteConfirm.leadCount === 0
                  ? ' has no leads in it right now.'
                  : ` has ${folderDeleteConfirm.leadCount} lead${folderDeleteConfirm.leadCount === 1 ? '' : 's'} that will move to Not Contacted.`}
              </p>
              {manageFoldersError ? <p className="text-xs text-red-400">{manageFoldersError}</p> : null}
              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFolderDeleteConfirm(null)
                    setManageFoldersError(null)
                  }}
                  className="border-neutral-600"
                >
                  Back
                </Button>
                <Button
                  type="button"
                  className="bg-red-600 text-white hover:bg-red-500"
                  onClick={() => void runConfirmDeleteFolder()}
                  disabled={deleteFolderBusy}
                >
                  {deleteFolderBusy ? 'Removing…' : 'Delete folder'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Manage folders</DialogTitle>
                <DialogDescription className="text-neutral-500">
                  Built-in folders are always part of your pipeline. You can remove custom folders; leads in a removed folder
                  are moved to <span className="text-neutral-300">Not Contacted</span> (nothing is deleted).
                </DialogDescription>
              </DialogHeader>
              {manageFoldersError ? <p className="text-xs text-red-400">{manageFoldersError}</p> : null}
              <ul className="min-h-0 flex-1 overflow-y-auto space-y-2 pr-0.5 text-sm" aria-label="Folders">
                {folders.map(f => {
                  const isBuiltIn = f.is_system
                  const n = leads.filter(l => l.folder_id === f.id).length
                  return (
                    <li
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-neutral-800/90 bg-neutral-900/30 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-100 truncate">{f.name}</div>
                        <div className="text-[11px] text-neutral-500">
                          {isBuiltIn ? 'Built-in · ' : null}
                          {n === 0 ? 'No leads' : `${n} lead${n === 1 ? '' : 's'}`}
                          {f.name === 'Not Contacted' ? ' · default bucket for new / reassigned leads' : ''}
                        </div>
                      </div>
                      {!isBuiltIn ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-red-400 hover:text-red-300 hover:bg-red-950/50"
                          title="Delete folder"
                          onClick={() =>
                            setFolderDeleteConfirm({ id: f.id, name: f.name, leadCount: n })
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
