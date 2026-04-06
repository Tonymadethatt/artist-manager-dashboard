import { useState, useMemo, useEffect, useCallback } from 'react'
import { ChevronLeft, Plus, RotateCcw, Save, Monitor, Search, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

type SidebarMode = 'browse' | 'edit'

export default function EmailTemplates() {
  const { loading, upsertTemplate, resetTemplate, getTemplate } = useEmailTemplates()
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

  useEffect(() => {
    if (filteredEmailTypes.length === 0) return
    if (!filteredEmailTypes.includes(selectedType)) {
      setSelectedType(filteredEmailTypes[0])
    }
  }, [filteredEmailTypes, selectedType])

  const savedTmpl = getTemplate(selectedType)
  const savedLayoutNormalized = useMemo(() => draftFromSaved(savedTmpl), [savedTmpl])

  const tryExitEdit = useCallback((fn: () => void) => {
    if (sidebarMode !== 'edit') {
      fn()
      return
    }
    if (!layoutsEqual(editorDraft, savedLayoutNormalized)) {
      setDiscardConfirm(true)
      return
    }
    fn()
  }, [sidebarMode, editorDraft, savedLayoutNormalized])

  const handleGroupSwitch = (g: Group) => {
    if (g === activeGroup) return
    tryExitEdit(() => {
      setActiveGroup(g)
      setTemplateSearch('')
      setSelectedType(g === 'client' ? CLIENT_ORDER[0] : ARTIST_ORDER[0])
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
    handleGroupSwitch(g)
  }

  const defaultSubject = activeGroup === 'client'
    ? CLIENT_DEFAULT_SUBJECTS[selectedType as VenueEmailType]
    : ARTIST_DEFAULT_SUBJECTS[selectedType as ArtistEmailType]

  const typeLabel = activeGroup === 'client'
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
  }, [activeGroup, selectedType, previewLayout, sidebarMode])

  const isDirty = !layoutsEqual(editorDraft, savedLayoutNormalized)
  const hasCustom = !!(savedTmpl && layoutHasAnyCustomization(artistLayoutForSend(
    savedTmpl.layout,
    savedTmpl.custom_subject,
    savedTmpl.custom_intro,
  )))

  const enterEdit = () => {
    setEditorDraft(draftFromSaved(getTemplate(selectedType)))
    setSidebarMode('edit')
    setSaved(false)
  }

  const backToBrowse = () => {
    tryExitEdit(() => {
      setSidebarMode('browse')
      setEditorDraft(draftFromSaved(getTemplate(selectedType)))
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-400 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="mb-5 shrink-0">
        <h1 className="text-base font-semibold text-white">Email templates</h1>
        <p className="text-xs text-neutral-500 mt-0.5">
          Customize copy, optional sections, and footer for each automated email. Preview matches what recipients see.
        </p>
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
                <Button
                  type="button"
                  size="sm"
                  className="h-8 text-xs w-full"
                  disabled={!filteredEmailTypes.includes(selectedType)}
                  onClick={enterEdit}
                >
                  Edit template
                </Button>
              </div>

              <div
                className={cn(
                  'flex-1 min-h-0 flex flex-col gap-2 overflow-y-auto overflow-x-hidden pr-0.5',
                  '[scrollbar-width:none] [-ms-overflow-style:none]',
                  '[&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0',
                )}
              >
                {filteredEmailTypes.map(emailType => {
                  const tmpl = getTemplate(emailType)
                  const customized = !!(tmpl && layoutHasAnyCustomization(artistLayoutForSend(
                    tmpl.layout,
                    tmpl.custom_subject,
                    tmpl.custom_intro,
                  )))
                  const isSelected = selectedType === emailType
                  const label = activeGroup === 'client'
                    ? VENUE_EMAIL_TYPE_LABELS[emailType as VenueEmailType]
                    : ARTIST_EMAIL_TYPE_LABELS[emailType as ArtistEmailType]
                  const description = activeGroup === 'client'
                    ? CLIENT_DESCRIPTIONS[emailType as VenueEmailType]
                    : ARTIST_DESCRIPTIONS[emailType as ArtistEmailType]
                  return (
                    <button
                      key={emailType}
                      type="button"
                      onClick={() => setSelectedType(emailType)}
                      className={cn(
                        'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                        isSelected
                          ? 'bg-neutral-800 border-neutral-600'
                          : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80',
                      )}
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
                    </button>
                  )
                })}
                {filteredEmailTypes.length === 0 && (
                  <p className="text-[11px] text-neutral-600 leading-snug px-1 py-6 text-center">
                    No templates match &ldquo;{templateSearch.trim()}&rdquo;.
                  </p>
                )}
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
                key={`${activeGroup}-${selectedType}-${sidebarMode}`}
                srcDoc={previewHtml}
                title={`Email preview - ${selectedType}`}
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
                  setSidebarMode('browse')
                  setPendingGroup(null)
                } else {
                  setSidebarMode('browse')
                  setEditorDraft(draftFromSaved(getTemplate(selectedType)))
                }
              }}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
