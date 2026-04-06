import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft, Plus, RotateCcw, Save, Monitor, Search, Trash2, ChevronUp, ChevronDown, Pencil, Copy,
} from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useCustomEmailTemplates } from '@/hooks/useCustomEmailTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { VenueEmailType, ArtistEmailType, AnyEmailType, EmailTemplate } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS, ARTIST_EMAIL_TYPE_LABELS } from '@/types'
import {
  buildVenueEmailHtml,
  PREVIEW_MOCK_PROFILE,
  PREVIEW_MOCK_RECIPIENT,
  PREVIEW_MOCK_VENUE,
  PREVIEW_MOCK_DEAL,
  type PreviewEmailType,
} from '@/lib/buildVenueEmailHtml'
import {
  buildManagementReportHtml,
  buildRetainerReminderHtml,
  buildPerformanceReportRequestHtml,
} from '@/lib/buildArtistEmailHtml'
import type { EmailTemplateAppendBlock, EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import {
  artistLayoutForSend,
  layoutHasAnyCustomization,
  normalizeEmailTemplateLayout,
} from '@/lib/emailLayout'
import { cn } from '@/lib/utils'
import { fetchEmailTemplateUsage } from '@/lib/emailTemplateUsage'
import { buildCustomEmailDocument } from '@/lib/email/renderCustomEmail'
import type { CustomEmailBlock, CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { defaultCustomBlocksDoc, parseCustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { customEmailTypeValue } from '@/lib/email/customTemplateId'
import { ARTIST_CUSTOM_MERGE_KEYS, VENUE_CUSTOM_MERGE_KEYS } from '@/lib/email/customEmailMerge'

const EYEBROW = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-500'

function draftFromSaved(t: EmailTemplate | undefined): EmailTemplateLayoutV1 {
  if (!t) return { footer: { showReplyButton: true } }
  const L = artistLayoutForSend(t.layout, t.custom_subject, t.custom_intro)
  const footer = {
    showReplyButton: L.footer?.showReplyButton !== false,
    replyButtonLabel: L.footer?.replyButtonLabel ?? null,
  }
  return {
    ...L,
    footer,
  }
}

function layoutsEqual(a: EmailTemplateLayoutV1, b: EmailTemplateLayoutV1): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

// ── Client email metadata ──────────────────────────────────────────────────

const CLIENT_DESCRIPTIONS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Confirms booking details with the venue (initial summary or final confirmation).',
  agreement_ready:      'Notifies venue the agreement is ready, includes the link.',
  payment_reminder:     'Friendly reminder about an outstanding payment.',
  payment_receipt:      'Confirms payment has been received.',
  booking_confirmed:    'Final confirmed notice with event details and next steps.',
  follow_up:            "Check-in to venues that haven't responded.",
  rebooking_inquiry:    'Sent after a positive post-show report. Asks venue about booking again.',
}

const CLIENT_DEFAULT_SUBJECTS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Booking Confirmation - {artist} at {venue}',
  booking_confirmed:    'Booking Confirmed - {artist} | {venue}',
  agreement_ready:      'Agreement Ready for Review - {artist}',
  payment_reminder:     'Payment Reminder - {artist}',
  payment_receipt:      'Payment Received - Thank You | {artist}',
  follow_up:            'Following Up - {artist}',
  rebooking_inquiry:    'Interested in Booking Again - {artist}',
}

const CLIENT_ORDER: VenueEmailType[] = [
  'follow_up',
  'booking_confirmation',
  'agreement_ready',
  'booking_confirmed',
  'payment_reminder',
  'payment_receipt',
  'rebooking_inquiry',
]

const ARTIST_DESCRIPTIONS: Record<ArtistEmailType, string> = {
  management_report:          'Weekly or custom-range report sent to DJ Luijay. Shows outreach, deals, retainer, and impact.',
  retainer_reminder:          'Gentle nudge email about outstanding management retainer balance.',
  performance_report_request: 'Sent to DJ Luijay after a show. Links to the post-show report form.',
}

const ARTIST_DEFAULT_SUBJECTS: Record<ArtistEmailType, string> = {
  management_report:          'Management Update - {start} to {end}',
  retainer_reminder:          'Hey DJ, quick note from management',
  performance_report_request: 'Quick check-in: How did the show go at {venue}?',
}

const ARTIST_ORDER: ArtistEmailType[] = ['management_report', 'retainer_reminder', 'performance_report_request']

type Group = 'client' | 'artist'

type SidebarMode = 'browse' | 'edit' | 'edit-custom'

export default function EmailTemplates() {
  const { loading, upsertTemplate, resetTemplate, getTemplate, deleteTemplate } = useEmailTemplates()
  const {
    rows: customRows,
    loading: customLoading,
    insertRow: insertCustomRow,
    updateRow: updateCustomRow,
    deleteRow: deleteCustomRow,
    duplicateRow: duplicateCustomRow,
  } = useCustomEmailTemplates()
  const [activeGroup, setActiveGroup] = useState<Group>('client')
  const [selectedType, setSelectedType] = useState<AnyEmailType>('follow_up')
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('browse')
  const [editorDraft, setEditorDraft] = useState<EmailTemplateLayoutV1>({ footer: { showReplyButton: true } })
  const [extraOpen, setExtraOpen] = useState(false)
  const [blockMenuOpen, setBlockMenuOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [resetConfirm, setResetConfirm] = useState<AnyEmailType | null>(null)
  const [discardConfirm, setDiscardConfirm] = useState(false)
  const [pendingGroup, setPendingGroup] = useState<Group | null>(null)
  const [saved, setSaved] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null)
  const [customNameDraft, setCustomNameDraft] = useState('')
  const [customSubjectDraft, setCustomSubjectDraft] = useState('')
  const [customBlocksDraft, setCustomBlocksDraft] = useState<CustomEmailBlocksDoc>(defaultCustomBlocksDoc())
  const [deleteBuiltinTarget, setDeleteBuiltinTarget] = useState<AnyEmailType | null>(null)
  const [deleteBuiltinUsage, setDeleteBuiltinUsage] = useState<{ pipelineTemplateItemCount: number; taskCount: number } | null>(null)
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateSourceType, setDuplicateSourceType] = useState<AnyEmailType | null>(null)
  const [duplicateTargetType, setDuplicateTargetType] = useState<AnyEmailType>(CLIENT_ORDER[0])
  const [deleteCustomId, setDeleteCustomId] = useState<string | null>(null)
  const [deleteCustomUsage, setDeleteCustomUsage] = useState<{ pipelineTemplateItemCount: number; taskCount: number } | null>(null)
  const [newCustomOpen, setNewCustomOpen] = useState(false)
  const [newCustomName, setNewCustomName] = useState('')
  const [newCustomError, setNewCustomError] = useState<string | null>(null)
  const [newCustomSubmitting, setNewCustomSubmitting] = useState(false)

  const filteredEmailTypes = useMemo((): AnyEmailType[] => {
    const types = (activeGroup === 'client' ? CLIENT_ORDER : ARTIST_ORDER) as AnyEmailType[]
    const q = templateSearch.trim().toLowerCase()
    if (!q) return types
    return types.filter(emailType => {
      const label = activeGroup === 'client'
        ? VENUE_EMAIL_TYPE_LABELS[emailType as VenueEmailType]
        : ARTIST_EMAIL_TYPE_LABELS[emailType as ArtistEmailType]
      const description = activeGroup === 'client'
        ? CLIENT_DESCRIPTIONS[emailType as VenueEmailType]
        : ARTIST_DESCRIPTIONS[emailType as ArtistEmailType]
      const hay = `${label} ${description} ${emailType}`.toLowerCase()
      return hay.includes(q)
    })
  }, [activeGroup, templateSearch])

  const filteredCustomRows = useMemo(() => {
    const want: 'venue' | 'artist' = activeGroup === 'client' ? 'venue' : 'artist'
    const q = templateSearch.trim().toLowerCase()
    return customRows.filter(r => {
      if (r.audience !== want) return false
      if (!q) return true
      return `${r.name} ${customEmailTypeValue(r.id)}`.toLowerCase().includes(q)
    })
  }, [activeGroup, customRows, templateSearch])

  useEffect(() => {
    if (filteredEmailTypes.length === 0) return
    if (!filteredEmailTypes.includes(selectedType)) {
      setSelectedType(filteredEmailTypes[0])
    }
  }, [filteredEmailTypes, selectedType])

  const savedTmpl = getTemplate(selectedType)
  const savedLayoutNormalized = useMemo(() => draftFromSaved(savedTmpl), [savedTmpl])

  const selectedCustomRow = selectedCustomId ? customRows.find(r => r.id === selectedCustomId) : undefined

  const tryExitEdit = useCallback((fn: () => void) => {
    if (sidebarMode === 'edit') {
      if (!layoutsEqual(editorDraft, savedLayoutNormalized)) {
        setDiscardConfirm(true)
        return
      }
    } else if (sidebarMode === 'edit-custom' && selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      if (row) {
        const parsed = parseCustomEmailBlocksDoc(row.blocks) ?? defaultCustomBlocksDoc()
        const dirty =
          customNameDraft !== row.name
          || customSubjectDraft !== row.subject_template
          || JSON.stringify(customBlocksDraft) !== JSON.stringify(parsed)
        if (dirty) {
          setDiscardConfirm(true)
          return
        }
      }
    }
    fn()
  }, [
    sidebarMode,
    editorDraft,
    savedLayoutNormalized,
    selectedCustomId,
    customRows,
    customNameDraft,
    customSubjectDraft,
    customBlocksDraft,
  ])

  const handleGroupSwitch = (g: Group) => {
    if (g === activeGroup) return
    tryExitEdit(() => {
      setActiveGroup(g)
      setTemplateSearch('')
      setSelectedType(g === 'client' ? CLIENT_ORDER[0] : ARTIST_ORDER[0])
      setSelectedCustomId(null)
      setSaved(false)
      setSidebarMode('browse')
      setPendingGroup(null)
    })
  }

  const handleGroupClickBlocked = (g: Group) => {
    if (sidebarMode === 'edit' && !layoutsEqual(editorDraft, savedLayoutNormalized)) {
      setPendingGroup(g)
      setDiscardConfirm(true)
      return
    }
    if (sidebarMode === 'edit-custom' && selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      if (row) {
        const parsed = parseCustomEmailBlocksDoc(row.blocks) ?? defaultCustomBlocksDoc()
        const dirty =
          customNameDraft !== row.name
          || customSubjectDraft !== row.subject_template
          || JSON.stringify(customBlocksDraft) !== JSON.stringify(parsed)
        if (dirty) {
          setPendingGroup(g)
          setDiscardConfirm(true)
          return
        }
      }
    }
    handleGroupSwitch(g)
  }

  const defaultSubject = activeGroup === 'client'
    ? CLIENT_DEFAULT_SUBJECTS[selectedType as VenueEmailType]
    : ARTIST_DEFAULT_SUBJECTS[selectedType as ArtistEmailType]

  const typeLabel = selectedCustomRow
    ? selectedCustomRow.name
    : activeGroup === 'client'
      ? VENUE_EMAIL_TYPE_LABELS[selectedType as VenueEmailType]
      : ARTIST_EMAIL_TYPE_LABELS[selectedType as ArtistEmailType]

  useEffect(() => {
    if (sidebarMode === 'browse') {
      setEditorDraft(draftFromSaved(getTemplate(selectedType)))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, sidebarMode, savedTmpl?.id, savedTmpl?.updated_at])

  useEffect(() => {
    const blocks = editorDraft.appendBlocks
    setExtraOpen(!!blocks && blocks.length > 0)
  }, [selectedType, sidebarMode, editorDraft.appendBlocks?.length])

  const previewLayout = sidebarMode === 'edit'
    ? editorDraft
    : draftFromSaved(getTemplate(selectedType))

  const previewHtml = useMemo(() => {
    if (selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      const doc = sidebarMode === 'edit-custom'
        ? customBlocksDraft
        : (parseCustomEmailBlocksDoc(row?.blocks) ?? defaultCustomBlocksDoc())
      const subj = sidebarMode === 'edit-custom'
        ? customSubjectDraft
        : (row?.subject_template ?? '')
      const aud = row?.audience ?? (activeGroup === 'client' ? 'venue' : 'artist')
      const { html } = buildCustomEmailDocument({
        audience: aud,
        subjectTemplate: subj.trim() || ' ',
        blocksRaw: doc,
        profile: PREVIEW_MOCK_PROFILE,
        recipient: PREVIEW_MOCK_RECIPIENT,
        deal: PREVIEW_MOCK_DEAL,
        venue: PREVIEW_MOCK_VENUE,
        logoBaseUrl: '',
        responsiveClasses: false,
        showReplyButton: aud === 'venue',
      })
      return html
    }

    const layout = normalizeEmailTemplateLayout(previewLayout) ?? previewLayout
    if (activeGroup === 'artist') {
      if (selectedType === 'management_report') {
        return buildManagementReportHtml(
          layout.intro ?? null,
          layout.subject ?? null,
          layout,
        )
      }
      if (selectedType === 'performance_report_request') {
        return buildPerformanceReportRequestHtml(
          layout.intro ?? null,
          layout.subject ?? null,
          layout,
        )
      }
      return buildRetainerReminderHtml(layout.intro ?? null, layout.subject ?? null, layout)
    }
    return buildVenueEmailHtml(
      selectedType as PreviewEmailType,
      PREVIEW_MOCK_PROFILE,
      PREVIEW_MOCK_RECIPIENT,
      PREVIEW_MOCK_DEAL,
      PREVIEW_MOCK_VENUE,
      layout.intro ?? null,
      layout.subject ?? null,
      layout,
    )
  }, [
    activeGroup,
    selectedType,
    previewLayout,
    sidebarMode,
    selectedCustomId,
    customRows,
    customBlocksDraft,
    customSubjectDraft,
  ])

  const isDirty = !layoutsEqual(editorDraft, savedLayoutNormalized)
  const hasCustom = !!(savedTmpl && layoutHasAnyCustomization(artistLayoutForSend(
    savedTmpl.layout,
    savedTmpl.custom_subject,
    savedTmpl.custom_intro,
  )))
  const isCustomDirty = (() => {
    if (sidebarMode !== 'edit-custom' || !selectedCustomRow) return false
    const parsed = parseCustomEmailBlocksDoc(selectedCustomRow.blocks) ?? defaultCustomBlocksDoc()
    return customNameDraft !== selectedCustomRow.name
      || customSubjectDraft !== selectedCustomRow.subject_template
      || JSON.stringify(customBlocksDraft) !== JSON.stringify(parsed)
  })()

  const enterEditFor = (emailType: AnyEmailType) => {
    setSelectedCustomId(null)
    setSelectedType(emailType)
    setEditorDraft(draftFromSaved(getTemplate(emailType)))
    setSidebarMode('edit')
    setSaved(false)
  }

  const enterEditCustom = (id: string) => {
    const row = customRows.find(r => r.id === id)
    if (!row) return
    setSelectedCustomId(id)
    setCustomNameDraft(row.name)
    setCustomSubjectDraft(row.subject_template)
    setCustomBlocksDraft(parseCustomEmailBlocksDoc(row.blocks) ?? defaultCustomBlocksDoc())
    setSidebarMode('edit-custom')
    setSaved(false)
  }

  const backToBrowse = () => {
    tryExitEdit(() => {
      setSidebarMode('browse')
      setEditorDraft(draftFromSaved(getTemplate(selectedType)))
    })
  }

  const saveCustomTemplate = async () => {
    if (!selectedCustomId) return
    setSaving(true)
    await updateCustomRow(selectedCustomId, {
      name: customNameDraft.trim() || 'Untitled',
      subject_template: customSubjectDraft,
      blocks: customBlocksDraft,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mergeKeyOptions = (activeGroup === 'client' ? VENUE_CUSTOM_MERGE_KEYS : ARTIST_CUSTOM_MERGE_KEYS) as readonly string[]

  const updateCustomBlock = (index: number, patch: Partial<CustomEmailBlock>) => {
    setCustomBlocksDraft(prev => {
      const blocks = [...prev.blocks]
      const cur = blocks[index]
      if (!cur) return prev
      blocks[index] = { ...cur, ...patch } as CustomEmailBlock
      return { ...prev, blocks }
    })
  }

  const removeCustomBlock = (index: number) => {
    setCustomBlocksDraft(prev => {
      const blocks = prev.blocks.filter((_, i) => i !== index)
      return { ...prev, blocks }
    })
  }

  const moveCustomBlock = (index: number, dir: -1 | 1) => {
    setCustomBlocksDraft(prev => {
      const blocks = [...prev.blocks]
      const j = index + dir
      if (j < 0 || j >= blocks.length) return prev
      ;[blocks[index], blocks[j]] = [blocks[j], blocks[index]]
      return { ...prev, blocks }
    })
  }

  const addCustomBlock = (kind: CustomEmailBlock['kind']) => {
    setBlockMenuOpen(false)
    setCustomBlocksDraft(prev => {
      const nb: CustomEmailBlock =
        kind === 'prose' ? { kind: 'prose', title: '', body: '' }
          : kind === 'bullet_list' ? { kind: 'bullet_list', title: '', items: [''] }
            : kind === 'key_value' ? { kind: 'key_value', title: '', rows: [{ label: 'Field', value: '' }] }
              : kind === 'table' ? { kind: 'table', title: '', headers: ['Col A', 'Col B'], rows: [['', '']] }
                : { kind: 'divider' }
      return { ...prev, blocks: [...prev.blocks, nb] }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const clean: EmailTemplateLayoutV1 = {
      ...editorDraft,
      subject: editorDraft.subject?.trim() || null,
      greeting: editorDraft.greeting?.trim() || null,
      intro: editorDraft.intro?.trim() || null,
      closing: editorDraft.closing?.trim() || null,
      appendBlocks: editorDraft.appendBlocks?.filter(b =>
        b.kind === 'prose_card'
          ? b.body.trim().length > 0 || (b.title?.trim() ?? '').length > 0
          : b.items.some(t => t.trim()),
      ),
    }
    if (!clean.appendBlocks?.length) delete clean.appendBlocks
    await upsertTemplate(selectedType, { layout: clean })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleReset = async (emailType: AnyEmailType) => {
    await resetTemplate(emailType)
    setResetConfirm(null)
    setEditorDraft({ footer: { showReplyButton: true } })
  }

  const updateBlock = (index: number, patch: Partial<EmailTemplateAppendBlock>) => {
    setEditorDraft(prev => {
      const blocks = [...(prev.appendBlocks ?? [])]
      const cur = blocks[index]
      if (!cur) return prev
      blocks[index] = { ...cur, ...patch } as EmailTemplateAppendBlock
      return { ...prev, appendBlocks: blocks }
    })
  }

  const removeBlock = (index: number) => {
    setEditorDraft(prev => {
      const blocks = [...(prev.appendBlocks ?? [])]
      blocks.splice(index, 1)
      return { ...prev, appendBlocks: blocks.length ? blocks : undefined }
    })
  }

  const moveBlock = (index: number, dir: -1 | 1) => {
    setEditorDraft(prev => {
      const blocks = [...(prev.appendBlocks ?? [])]
      const j = index + dir
      if (j < 0 || j >= blocks.length) return prev
      ;[blocks[index], blocks[j]] = [blocks[j], blocks[index]]
      return { ...prev, appendBlocks: blocks }
    })
  }

  const addBlock = (kind: 'prose_card' | 'bullet_card') => {
    setBlockMenuOpen(false)
    setExtraOpen(true)
    setEditorDraft(prev => ({
      ...prev,
      appendBlocks: [
        ...(prev.appendBlocks ?? []),
        kind === 'prose_card'
          ? { kind: 'prose_card', title: '', body: '' }
          : { kind: 'bullet_card', title: '', items: [''] },
      ],
    }))
  }

  if (loading || customLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-5 shrink-0 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold text-white">Email templates</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Customize copy, optional sections, and footer for each automated email. Preview matches what recipients see.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 text-xs shrink-0 self-stretch sm:self-center sm:whitespace-nowrap"
          onClick={() => {
            setNewCustomError(null)
            setNewCustomName('')
            setNewCustomOpen(true)
          }}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          New custom template
        </Button>
      </div>

      <div className="flex gap-5 flex-1 min-h-0">

        <div className="w-[300px] shrink-0 flex flex-col gap-2 min-h-0 self-stretch border-r border-neutral-800/80 pr-4">

          {sidebarMode === 'browse' ? (
            <>
              <div className="shrink-0 flex flex-col gap-2">
                <div className="flex rounded-lg border border-neutral-800 overflow-hidden">
                  {(['client', 'artist'] as Group[]).map(g => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleGroupClickBlocked(g)}
                      className={cn(
                        'flex-1 py-1.5 text-xs font-medium transition-colors',
                        activeGroup === g
                          ? 'bg-neutral-700 text-white'
                          : 'bg-neutral-900 text-neutral-500 hover:text-neutral-300',
                      )}
                    >
                      {g === 'client' ? 'Client' : 'Artist'}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-600 pointer-events-none" />
                  <Input
                    value={templateSearch}
                    onChange={e => setTemplateSearch(e.target.value)}
                    placeholder="Search templates..."
                    aria-label="Search email templates"
                    className="h-8 pl-8 text-xs bg-neutral-950 border-neutral-800 placeholder:text-neutral-600"
                  />
                </div>
              </div>

              <div
                className={cn(
                  'flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto overflow-x-hidden pr-0.5',
                  '[scrollbar-width:none] [-ms-overflow-style:none]',
                  '[&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0',
                )}
              >
                <div>
                  <p className={EYEBROW}>Standard</p>
                  <div className="flex flex-col gap-2 mt-2">
                    {filteredEmailTypes.map(emailType => {
                      const tmpl = getTemplate(emailType)
                      const customized = !!(tmpl && layoutHasAnyCustomization(artistLayoutForSend(
                        tmpl.layout,
                        tmpl.custom_subject,
                        tmpl.custom_intro,
                      )))
                      const isSelected = selectedType === emailType && !selectedCustomId
                      const label = activeGroup === 'client'
                        ? VENUE_EMAIL_TYPE_LABELS[emailType as VenueEmailType]
                        : ARTIST_EMAIL_TYPE_LABELS[emailType as ArtistEmailType]
                      const description = activeGroup === 'client'
                        ? CLIENT_DESCRIPTIONS[emailType as VenueEmailType]
                        : ARTIST_DESCRIPTIONS[emailType as ArtistEmailType]
                      return (
                        <div
                          key={emailType}
                          className={cn(
                            'w-full rounded-lg border transition-all',
                            isSelected
                              ? 'bg-neutral-800 border-neutral-600'
                              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80',
                          )}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full text-left px-3 py-2.5 cursor-pointer"
                            onClick={() => {
                              setSelectedCustomId(null)
                              setSelectedType(emailType)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedCustomId(null)
                                setSelectedType(emailType)
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm font-medium truncate', isSelected ? 'text-white' : 'text-neutral-300')}>
                                {label}
                              </span>
                              {customized && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-900/60 text-blue-400 border border-blue-800/60 font-medium shrink-0">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-neutral-600 mt-0.5 leading-snug line-clamp-2">{description}</p>
                          </div>
                          <div className="flex flex-wrap gap-1 px-2 pb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2"
                              onClick={e => {
                                e.stopPropagation()
                                enterEditFor(emailType)
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            {customized && (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2"
                                  onClick={e => {
                                    e.stopPropagation()
                                    const order = (activeGroup === 'client' ? CLIENT_ORDER : ARTIST_ORDER) as AnyEmailType[]
                                    const other = order.find(t => t !== emailType) ?? emailType
                                    setDuplicateSourceType(emailType)
                                    setDuplicateTargetType(other)
                                    setDuplicateOpen(true)
                                  }}
                                >
                                  <Copy className="h-3 w-3 mr-1" />
                                  Copy to…
                                </Button>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[11px] px-2 text-red-400/90 border-red-900/50"
                                  onClick={async e => {
                                    e.stopPropagation()
                                    const u = await fetchEmailTemplateUsage(emailType)
                                    setDeleteBuiltinUsage(u)
                                    setDeleteBuiltinTarget(emailType)
                                  }}
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Remove
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {filteredEmailTypes.length === 0 && (
                      <p className="text-[11px] text-neutral-600 leading-snug px-1 py-4 text-center">
                        No standard templates match &ldquo;{templateSearch.trim()}&rdquo;.
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <p className={EYEBROW}>My templates</p>
                  <div className="flex flex-col gap-2 mt-2">
                    {filteredCustomRows.map(row => {
                      const sel = selectedCustomId === row.id
                      return (
                        <div
                          key={row.id}
                          className={cn(
                            'w-full rounded-lg border transition-all',
                            sel
                              ? 'bg-neutral-800 border-neutral-600'
                              : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80',
                          )}
                        >
                          <div
                            role="button"
                            tabIndex={0}
                            className="w-full text-left px-3 py-2.5 cursor-pointer"
                            onClick={() => setSelectedCustomId(row.id)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setSelectedCustomId(row.id)
                              }
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className={cn('text-sm font-medium truncate', sel ? 'text-white' : 'text-neutral-300')}>
                                {row.name}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-neutral-800 text-neutral-500 border border-neutral-700 shrink-0">
                                {row.audience === 'venue' ? 'Client' : 'Artist'}
                              </span>
                            </div>
                            <p className="text-[11px] text-neutral-600 mt-0.5 font-mono truncate">
                              {customEmailTypeValue(row.id)}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1 px-2 pb-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2"
                              onClick={e => {
                                e.stopPropagation()
                                enterEditCustom(row.id)
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2"
                              onClick={async e => {
                                e.stopPropagation()
                                const { data } = await duplicateCustomRow(row.id)
                                if (data) {
                                  setSelectedCustomId(data.id)
                                  setCustomNameDraft(data.name)
                                  setCustomSubjectDraft(data.subject_template)
                                  setCustomBlocksDraft(parseCustomEmailBlocksDoc(data.blocks) ?? defaultCustomBlocksDoc())
                                  setSidebarMode('edit-custom')
                                }
                              }}
                            >
                              <Copy className="h-3 w-3 mr-1" />
                              Duplicate
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px] px-2 text-red-400/90 border-red-900/50"
                              onClick={async e => {
                                e.stopPropagation()
                                const u = await fetchEmailTemplateUsage(customEmailTypeValue(row.id))
                                setDeleteCustomUsage(u)
                                setDeleteCustomId(row.id)
                              }}
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                    {filteredCustomRows.length === 0 && (
                      <p className="text-[11px] text-neutral-600 leading-snug px-1 py-3">
                        No custom templates yet. Use New to create one for {activeGroup === 'client' ? 'client' : 'artist'} emails.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : sidebarMode === 'edit-custom' && selectedCustomRow ? (
            <>
              <div className="shrink-0 flex flex-col gap-2 border-b border-neutral-800 pb-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={backToBrowse}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white shrink-0 mt-0.5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <div className="flex-1 min-w-0 text-right flex flex-col items-end gap-1.5">
                    <span className="text-sm font-medium text-white truncate max-w-full">{customNameDraft || 'Untitled'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500">
                      Custom · {selectedCustomRow.audience === 'venue' ? 'Client' : 'Artist'}
                    </span>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saving || !isCustomDirty}
                        onClick={saveCustomTemplate}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div
                className={cn(
                  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-4 pt-3',
                  '[scrollbar-width:thin]',
                )}
              >
                <div>
                  <p className={EYEBROW}>Template name</p>
                  <Input
                    value={customNameDraft}
                    onChange={e => setCustomNameDraft(e.target.value)}
                    className="text-sm mt-1"
                  />
                </div>
                <div>
                  <p className={EYEBROW}>Subject</p>
                  <Input
                    value={customSubjectDraft}
                    onChange={e => setCustomSubjectDraft(e.target.value)}
                    placeholder="Use merge tokens like {{venue.name}}"
                    className="text-sm mt-1"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Allowed tokens: {(activeGroup === 'client' ? VENUE_CUSTOM_MERGE_KEYS : ARTIST_CUSTOM_MERGE_KEYS).join(', ')}.
                  </p>
                </div>
                <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50">
                  <div className="flex items-center justify-between">
                    <span className={EYEBROW}>Blocks</span>
                    <span className="text-xs text-neutral-500">{customBlocksDraft.blocks.length} block(s)</span>
                  </div>
                  <div className="relative mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs w-full"
                      onClick={() => setBlockMenuOpen(o => !o)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add block
                    </Button>
                    {blockMenuOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-neutral-700 bg-neutral-950 shadow-lg py-1">
                        {(['prose', 'bullet_list', 'key_value', 'table', 'divider'] as const).map(k => (
                          <button
                            key={k}
                            type="button"
                            className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 capitalize"
                            onClick={() => addCustomBlock(k)}
                          >
                            {k.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-3 mt-3">
                    {customBlocksDraft.blocks.map((block, i) => (
                      <div key={i} className="border border-neutral-800 rounded-md p-2 space-y-2 bg-neutral-950/60">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-neutral-500 uppercase">{block.kind.replace('_', ' ')}</span>
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-500"
                              onClick={() => moveCustomBlock(i, -1)}
                              aria-label="Move up"
                            >
                              <ChevronUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-neutral-800 text-neutral-500"
                              onClick={() => moveCustomBlock(i, 1)}
                              aria-label="Move down"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              className="p-1 rounded hover:bg-neutral-800 text-red-400/80"
                              onClick={() => removeCustomBlock(i)}
                              aria-label="Remove block"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                        {block.kind !== 'divider' && (
                          <Input
                            value={'title' in block ? block.title ?? '' : ''}
                            onChange={e => updateCustomBlock(i, { title: e.target.value } as Partial<CustomEmailBlock>)}
                            placeholder="Section title (optional)"
                            className="h-8 text-xs"
                          />
                        )}
                        {block.kind === 'prose' && (
                          <textarea
                            value={block.body}
                            onChange={e => updateCustomBlock(i, { body: e.target.value } as Partial<CustomEmailBlock>)}
                            rows={4}
                            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 resize-none"
                          />
                        )}
                        {block.kind === 'bullet_list' && (
                          <div className="space-y-1">
                            {block.items.map((line, li) => (
                              <div key={li} className="flex gap-1">
                                <Input
                                  value={line}
                                  onChange={e => {
                                    const items = [...block.items]
                                    items[li] = e.target.value
                                    updateCustomBlock(i, { items } as Partial<CustomEmailBlock>)
                                  }}
                                  className="h-8 text-xs flex-1"
                                />
                                <button
                                  type="button"
                                  className="shrink-0 px-2 rounded border border-neutral-800 text-neutral-500 hover:text-red-400 text-xs"
                                  onClick={() => updateCustomBlock(i, {
                                    items: block.items.filter((_, j) => j !== li),
                                  } as Partial<CustomEmailBlock>)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px]"
                              onClick={() => updateCustomBlock(i, { items: [...block.items, ''] } as Partial<CustomEmailBlock>)}
                            >
                              + Item
                            </Button>
                          </div>
                        )}
                        {block.kind === 'key_value' && (
                          <div className="space-y-2">
                            {block.rows.map((rowkv, ri) => (
                              <div key={ri} className="space-y-1 border border-neutral-800/80 rounded p-2">
                                <Input
                                  value={rowkv.label}
                                  onChange={e => {
                                    const rows = block.rows.map((x, j) =>
                                      j === ri ? { ...x, label: e.target.value } : x)
                                    updateCustomBlock(i, { rows } as Partial<CustomEmailBlock>)
                                  }}
                                  placeholder="Label"
                                  className="h-8 text-xs"
                                />
                                <Select
                                  value={rowkv.valueKey ?? '__static__'}
                                  onValueChange={v => {
                                    const rows = block.rows.map((x, j) =>
                                      j === ri
                                        ? v === '__static__'
                                          ? { ...x, valueKey: null, value: x.value ?? '' }
                                          : { ...x, valueKey: v, value: null }
                                        : x)
                                    updateCustomBlock(i, { rows } as Partial<CustomEmailBlock>)
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700">
                                    <SelectValue placeholder="Value source" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__static__" className="text-xs">Static text</SelectItem>
                                    {mergeKeyOptions.map(k => (
                                      <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {!(rowkv.valueKey) && (
                                  <Input
                                    value={rowkv.value ?? ''}
                                    onChange={e => {
                                      const rows = block.rows.map((x, j) =>
                                        j === ri ? { ...x, value: e.target.value } : x)
                                      updateCustomBlock(i, { rows } as Partial<CustomEmailBlock>)
                                    }}
                                    placeholder="Text (supports merge tokens)"
                                    className="h-8 text-xs"
                                  />
                                )}
                                <button
                                  type="button"
                                  className="text-[10px] text-red-400/80"
                                  onClick={() => updateCustomBlock(i, {
                                    rows: block.rows.filter((_, j) => j !== ri),
                                  } as Partial<CustomEmailBlock>)}
                                >
                                  Remove row
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px]"
                              onClick={() => updateCustomBlock(i, {
                                rows: [...block.rows, { label: 'New', value: '' }],
                              } as Partial<CustomEmailBlock>)}
                            >
                              + Row
                            </Button>
                          </div>
                        )}
                        {block.kind === 'table' && (
                          <div className="space-y-2 text-[10px] text-neutral-500">
                            <p>Headers</p>
                            <div className="flex flex-wrap gap-1">
                              {block.headers.map((h, hi) => (
                                <Input
                                  key={hi}
                                  value={h}
                                  onChange={e => {
                                    const headers = [...block.headers]
                                    headers[hi] = e.target.value
                                    updateCustomBlock(i, { headers } as Partial<CustomEmailBlock>)
                                  }}
                                  className="h-8 text-xs w-24"
                                />
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 text-[10px]"
                                onClick={() => updateCustomBlock(i, {
                                  headers: [...block.headers, 'Column'],
                                } as Partial<CustomEmailBlock>)}
                              >
                                + Col
                              </Button>
                            </div>
                            <p>Rows</p>
                            {block.rows.map((cells, ri) => (
                              <div key={ri} className="flex flex-wrap gap-1 items-center">
                                {cells.map((c, ci) => (
                                  <Input
                                    key={ci}
                                    value={c}
                                    onChange={e => {
                                      const rows = block.rows.map((r, rj) =>
                                        rj === ri
                                          ? r.map((cell, ck) => (ck === ci ? e.target.value : cell))
                                          : r)
                                      updateCustomBlock(i, { rows } as Partial<CustomEmailBlock>)
                                    }}
                                    className="h-8 text-xs w-24"
                                  />
                                ))}
                                <button
                                  type="button"
                                  className="text-red-400/80 px-1"
                                  onClick={() => updateCustomBlock(i, {
                                    rows: block.rows.filter((_, j) => j !== ri),
                                  } as Partial<CustomEmailBlock>)}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[10px]"
                              onClick={() => updateCustomBlock(i, {
                                rows: [...block.rows, block.headers.map(() => '')],
                              } as Partial<CustomEmailBlock>)}
                            >
                              + Row
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="shrink-0 flex flex-col gap-2 border-b border-neutral-800 pb-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={backToBrowse}
                    className="flex items-center gap-1 text-xs text-neutral-400 hover:text-white shrink-0 mt-0.5"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Back
                  </button>
                  <div className="flex-1 min-w-0 text-right flex flex-col items-end gap-1.5">
                    <span className="text-sm font-medium text-white truncate max-w-full">{typeLabel}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-700 text-neutral-500">
                      {activeGroup === 'client' ? 'Client email' : 'Artist email'}
                    </span>
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {hasCustom && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setResetConfirm(selectedType)}
                        >
                          <RotateCcw className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 text-xs"
                        disabled={saving || !isDirty}
                        onClick={handleSave}
                      >
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1 space-y-4 pt-3',
                  '[scrollbar-width:thin]',
                )}
              >
                <div>
                  <p className={EYEBROW}>Subject</p>
                  <Input
                    value={editorDraft.subject ?? ''}
                    onChange={e => setEditorDraft(p => ({ ...p, subject: e.target.value }))}
                    placeholder={defaultSubject}
                    className="text-sm mt-1"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">Leave empty to use the default subject.</p>
                </div>

                {activeGroup === 'client' && (
                <div>
                  <p className={EYEBROW}>Greeting</p>
                  <Input
                    value={editorDraft.greeting ?? ''}
                    onChange={e => setEditorDraft(p => ({ ...p, greeting: e.target.value }))}
                    placeholder="Hi {firstName},"
                    className="text-sm mt-1"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Use {'{firstName}'} for the recipient’s first name. Leave empty for default.
                  </p>
                </div>
                )}

                <div>
                  <p className={EYEBROW}>Opening paragraph</p>
                  <textarea
                    value={editorDraft.intro ?? ''}
                    onChange={e => setEditorDraft(p => ({ ...p, intro: e.target.value }))}
                    placeholder="Custom intro before type-specific content…"
                    rows={4}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none mt-1"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Standard deal/venue blocks still render when applicable. Performance request: {'{venue}'} {'{artist}'} in copy.
                  </p>
                </div>

                <div>
                  <p className={EYEBROW}>Closing paragraph</p>
                  <p className="text-[10px] text-neutral-600 mb-1">Sign-off before the footer.</p>
                  <textarea
                    value={editorDraft.closing ?? ''}
                    onChange={e => setEditorDraft(p => ({ ...p, closing: e.target.value }))}
                    placeholder="Optional — overrides the default closing line where supported."
                    rows={3}
                    className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-200 placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-none mt-1"
                  />
                </div>

                <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50">
                  <button
                    type="button"
                    className="flex items-center justify-between w-full text-left"
                    onClick={() => setExtraOpen(o => !o)}
                  >
                    <span className={EYEBROW}>Additional sections</span>
                    <span className="text-xs text-neutral-500">
                      {(editorDraft.appendBlocks?.length ?? 0)} block{(editorDraft.appendBlocks?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </button>
                  <p className="text-[10px] text-neutral-600 mt-1 mb-2">
                    Appended after standard content for this template. Plain text only; styled like your other emails.
                  </p>
                  {extraOpen && (
                    <div className="space-y-3 mt-2">
                      <div className="relative">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs w-full"
                          onClick={() => setBlockMenuOpen(o => !o)}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add block
                        </Button>
                        {blockMenuOpen && (
                          <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-neutral-700 bg-neutral-950 shadow-lg py-1">
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800"
                              onClick={() => addBlock('prose_card')}
                            >
                              Text card
                            </button>
                            <button
                              type="button"
                              className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800"
                              onClick={() => addBlock('bullet_card')}
                            >
                              Bullet list
                            </button>
                          </div>
                        )}
                      </div>

                      {(editorDraft.appendBlocks ?? []).map((block, i) => (
                        <div key={i} className="border border-neutral-800 rounded-md p-2 space-y-2 bg-neutral-950/60">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] text-neutral-500 uppercase">
                              {block.kind === 'prose_card' ? 'Text card' : 'Bullets'}
                            </span>
                            <div className="flex items-center gap-0.5">
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-neutral-800 text-neutral-500"
                                onClick={() => moveBlock(i, -1)}
                                aria-label="Move up"
                              >
                                <ChevronUp className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-neutral-800 text-neutral-500"
                                onClick={() => moveBlock(i, 1)}
                                aria-label="Move down"
                              >
                                <ChevronDown className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                className="p-1 rounded hover:bg-neutral-800 text-red-400/80"
                                onClick={() => removeBlock(i)}
                                aria-label="Remove block"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                          <Input
                            value={block.title ?? ''}
                            onChange={e => updateBlock(i, { title: e.target.value })}
                            placeholder="Section title (optional)"
                            className="h-8 text-xs"
                          />
                          {block.kind === 'prose_card' ? (
                            <textarea
                              value={block.body}
                              onChange={e => updateBlock(i, { body: e.target.value } as Partial<EmailTemplateAppendBlock>)}
                              rows={3}
                              className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-xs text-neutral-200 resize-none"
                            />
                          ) : (
                            <div className="space-y-1">
                              {block.items.map((line, li) => (
                                <div key={li} className="flex gap-1">
                                  <Input
                                    value={line}
                                    onChange={e => {
                                      const items = [...block.items]
                                      items[li] = e.target.value
                                      updateBlock(i, { items } as Partial<EmailTemplateAppendBlock>)
                                    }}
                                    className="h-8 text-xs flex-1"
                                    placeholder={`Bullet ${li + 1}`}
                                  />
                                  <button
                                    type="button"
                                    className="shrink-0 px-2 rounded border border-neutral-800 text-neutral-500 hover:text-red-400 text-xs"
                                    onClick={() => {
                                      const items = block.items.filter((_, j) => j !== li)
                                      updateBlock(i, { items } as Partial<EmailTemplateAppendBlock>)
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 text-[10px]"
                                onClick={() => updateBlock(i, { items: [...block.items, ''] } as Partial<EmailTemplateAppendBlock>)}
                              >
                                + Bullet
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {activeGroup === 'client' ? (
                  <div className="space-y-2 pb-2">
                    <p className={EYEBROW}>Footer</p>
                    <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-neutral-600"
                        checked={editorDraft.footer?.showReplyButton !== false}
                        onChange={e => setEditorDraft(p => ({
                          ...p,
                          footer: { ...p.footer, showReplyButton: e.target.checked },
                        }))}
                      />
                      Show reply button (mailto)
                    </label>
                    {editorDraft.footer?.showReplyButton !== false && (
                      <Input
                        value={editorDraft.footer?.replyButtonLabel ?? ''}
                        onChange={e => setEditorDraft(p => ({
                          ...p,
                          footer: { ...p.footer, showReplyButton: true, replyButtonLabel: e.target.value || null },
                        }))}
                        placeholder="Optional custom button label"
                        className="text-sm"
                      />
                    )}
                  </div>
                ) : (
                  <p className="text-[10px] text-neutral-600 pb-2">
                    Footer uses the artist email layout (branding + links). Reply-style footer controls apply to client emails only.
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col min-h-0">
          <div className="flex-1 min-h-0 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center gap-2 shrink-0">
              <Monitor className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-400">Preview — {typeLabel}</span>
              <span className="text-[10px] text-neutral-600 ml-auto">
                {activeGroup === 'client'
                  ? 'Mock: Alex / Skyline Bar'
                  : 'Mock: DJ Luijay'}
              </span>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              <iframe
                key={`${activeGroup}-${selectedType}-${sidebarMode}-${selectedCustomId ?? ''}`}
                srcDoc={previewHtml}
                title={`Email preview - ${selectedCustomId ?? selectedType}`}
                className="w-full h-full border-0 min-h-[480px]"
                sandbox="allow-same-origin"
              />
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!resetConfirm} onOpenChange={v => !v && setResetConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">
            Subject, greeting, intro, closing, extra sections, and footer options for{' '}
            <span className="text-neutral-200">
              {resetConfirm
                ? (activeGroup === 'client'
                    ? VENUE_EMAIL_TYPE_LABELS[resetConfirm as VenueEmailType]
                    : ARTIST_EMAIL_TYPE_LABELS[resetConfirm as ArtistEmailType])
                : ''}
            </span>{' '}
            will be cleared.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => resetConfirm && handleReset(resetConfirm)}>
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={discardConfirm} onOpenChange={v => !v && setDiscardConfirm(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400">Your edits will be lost.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDiscardConfirm(false); setPendingGroup(null) }}>
              Keep editing
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setDiscardConfirm(false)
                if (pendingGroup !== null) {
                  setActiveGroup(pendingGroup)
                  setTemplateSearch('')
                  setSelectedType(pendingGroup === 'client' ? CLIENT_ORDER[0] : ARTIST_ORDER[0])
                  setSelectedCustomId(null)
                  setSidebarMode('browse')
                  setPendingGroup(null)
                } else {
                  setSidebarMode('browse')
                  if (sidebarMode === 'edit-custom' && selectedCustomId) {
                    const row = customRows.find(r => r.id === selectedCustomId)
                    if (row) {
                      setCustomNameDraft(row.name)
                      setCustomSubjectDraft(row.subject_template)
                      setCustomBlocksDraft(parseCustomEmailBlocksDoc(row.blocks) ?? defaultCustomBlocksDoc())
                    }
                  } else {
                    setEditorDraft(draftFromSaved(getTemplate(selectedType)))
                  }
                }
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteBuiltinTarget} onOpenChange={v => { if (!v) { setDeleteBuiltinTarget(null); setDeleteBuiltinUsage(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove saved template?</DialogTitle>
          </DialogHeader>
          {deleteBuiltinUsage && (deleteBuiltinUsage.pipelineTemplateItemCount > 0 || deleteBuiltinUsage.taskCount > 0) ? (
            <p className="text-sm text-neutral-400">
              Pipeline templates or tasks still reference this email type. Removing only deletes <strong>your</strong> saved copy—automations will fall back to product defaults until you pick another template in those tasks.
            </p>
          ) : (
            <p className="text-sm text-neutral-400">
              Removes your overrides for this type. Built-in wording and layout come back.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteBuiltinTarget(null); setDeleteBuiltinUsage(null) }}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (deleteBuiltinTarget) {
                  await deleteTemplate(deleteBuiltinTarget)
                  setDeleteBuiltinTarget(null)
                  setDeleteBuiltinUsage(null)
                  setEditorDraft(draftFromSaved(getTemplate(deleteBuiltinTarget)))
                }
              }}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={duplicateOpen} onOpenChange={v => !v && setDuplicateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Copy customization to…</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-400 mb-2">
            Copies your saved layout and sections to another standard template in this group.
                    </p>
          <Select
            value={duplicateTargetType}
            onValueChange={v => setDuplicateTargetType(v as AnyEmailType)}
          >
            <SelectTrigger className="bg-neutral-950 border-neutral-700"><SelectValue /></SelectTrigger>
            <SelectContent>
              {(activeGroup === 'client' ? CLIENT_ORDER : ARTIST_ORDER).map(t => (
                <SelectItem key={t} value={t} disabled={t === duplicateSourceType}>
                  {activeGroup === 'client'
                    ? VENUE_EMAIL_TYPE_LABELS[t as VenueEmailType]
                    : ARTIST_EMAIL_TYPE_LABELS[t as ArtistEmailType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateOpen(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!duplicateSourceType) return
                const srcTmpl = getTemplate(duplicateSourceType)
                const layout = artistLayoutForSend(
                  srcTmpl?.layout ?? null,
                  srcTmpl?.custom_subject ?? null,
                  srcTmpl?.custom_intro ?? null,
                )
                await upsertTemplate(duplicateTargetType, { layout })
                setDuplicateOpen(false)
              }}
            >
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={newCustomOpen}
        onOpenChange={v => {
          if (!v) {
            setNewCustomOpen(false)
            setNewCustomError(null)
            setNewCustomSubmitting(false)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create a custom template</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-neutral-400 leading-relaxed">
              You’ll open the block editor next: set the subject line, add sections (text, lists, tables, merge fields),
              and preview the full email before saving.
            </p>
            <p className="text-xs text-neutral-500">
              {activeGroup === 'client'
                ? 'Audience: venues (client emails). You can use this template from Pipeline, the email queue, and manual sends.'
                : 'Audience: your artist profile email. You can attach it to pipeline tasks that complete with this template.'}
            </p>
            <Input
              value={newCustomName}
              onChange={e => { setNewCustomName(e.target.value); setNewCustomError(null) }}
              placeholder="Name (e.g. Post-show check-in)"
              className="text-sm"
              aria-label="Custom template name"
              onKeyDown={e => {
                if (e.key === 'Enter' && newCustomName.trim() && !newCustomSubmitting) {
                  e.preventDefault()
                  void (document.getElementById('new-custom-create-btn') as HTMLButtonElement | null)?.click()
                }
              }}
            />
            {newCustomError && (
              <p className="text-xs text-red-400 leading-snug">{newCustomError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={newCustomSubmitting}
              onClick={() => { setNewCustomOpen(false); setNewCustomError(null) }}
            >
              Cancel
            </Button>
            <Button
              id="new-custom-create-btn"
              disabled={!newCustomName.trim() || newCustomSubmitting}
              onClick={async () => {
                setNewCustomError(null)
                setNewCustomSubmitting(true)
                const res = await insertCustomRow({
                  audience: activeGroup === 'client' ? 'venue' : 'artist',
                  name: newCustomName.trim(),
                })
                setNewCustomSubmitting(false)
                if (res.error) {
                  setNewCustomError(res.error.message)
                  return
                }
                if (res.data) {
                  setNewCustomOpen(false)
                  setNewCustomName('')
                  setSelectedCustomId(res.data.id)
                  setCustomNameDraft(res.data.name)
                  setCustomSubjectDraft(res.data.subject_template)
                  setCustomBlocksDraft(parseCustomEmailBlocksDoc(res.data.blocks) ?? defaultCustomBlocksDoc())
                  setSidebarMode('edit-custom')
                }
              }}
            >
              {newCustomSubmitting ? 'Creating…' : 'Continue to editor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCustomId} onOpenChange={v => { if (!v) { setDeleteCustomId(null); setDeleteCustomUsage(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete custom template?</DialogTitle>
          </DialogHeader>
          {deleteCustomUsage && (deleteCustomUsage.pipelineTemplateItemCount > 0 || deleteCustomUsage.taskCount > 0) ? (
            <p className="text-sm text-neutral-400">
              This template is still referenced by {deleteCustomUsage.pipelineTemplateItemCount} pipeline step(s) and{' '}
              {deleteCustomUsage.taskCount} task(s). Duplicate it to a new template, update those references, then delete this one.
            </p>
          ) : (
            <p className="text-sm text-neutral-400">
              Permanently deletes this template. There is no built-in fallback for this email type.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteCustomId(null); setDeleteCustomUsage(null) }}>
              {deleteCustomUsage && (deleteCustomUsage.pipelineTemplateItemCount > 0 || deleteCustomUsage.taskCount > 0)
                ? 'Close'
                : 'Cancel'}
            </Button>
            {!(deleteCustomUsage && (deleteCustomUsage.pipelineTemplateItemCount > 0 || deleteCustomUsage.taskCount > 0)) && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (deleteCustomId) {
                    await deleteCustomRow(deleteCustomId)
                    if (selectedCustomId === deleteCustomId) setSelectedCustomId(null)
                  }
                  setDeleteCustomId(null)
                  setDeleteCustomUsage(null)
                }}
              >
                Delete
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
