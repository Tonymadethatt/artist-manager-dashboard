import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft, Plus, RotateCcw, Save, Monitor, Search, Trash2, ChevronUp, ChevronDown, Pencil, Copy, Send,
} from 'lucide-react'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useCustomEmailTemplates } from '@/hooks/useCustomEmailTemplates'
import { useFiles } from '@/hooks/useFiles'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { supabase } from '@/lib/supabase'
import { sendEmailTemplateTest } from '@/lib/email/sendEmailTemplateTest'
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
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import type { VenueEmailType, ArtistEmailType, AnyEmailType, EmailTemplate } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS, ARTIST_EMAIL_TYPE_LABELS } from '@/types'
import {
  buildVenueEmailHtml,
  EMAIL_TEMPLATE_PREVIEW_INVOICE_URL,
  PREVIEW_MOCK_PROFILE,
  PREVIEW_MOCK_RECIPIENT,
  PREVIEW_MOCK_VENUE,
  PREVIEW_MOCK_DEAL,
  type PreviewEmailType,
  type PreviewProfile,
} from '@/lib/buildVenueEmailHtml'
import { buildBrandedGigCalendarEmail, buildGigCalendarTableRow } from '@/lib/email/gigCalendarEmailHtml'
import { formatPacificTimeRangeCompact, pacificWallToUtcIso } from '@/lib/calendar/pacificWallTime'
import {
  EMAIL_CAPTURE_KIND_LABELS,
  venueEmailTypeToCaptureKind,
  type EmailCaptureKind,
} from '@/lib/emailCapture/kinds'
import {
  buildManagementReportHtml,
  buildRetainerReminderHtml,
  buildRetainerReceivedHtml,
  buildPerformanceReportRequestHtml,
} from '@/lib/buildArtistEmailHtml'
import {
  artistTransactionalGreetingFirstName,
  buildArtistTransactionalEmailHtml,
} from '@/lib/email/artistTransactionalEmailDocument'
import type { EmailTemplateAppendBlock, EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import {
  artistLayoutForSend,
  layoutHasAnyCustomization,
  normalizeEmailTemplateLayout,
} from '@/lib/emailLayout'
import { cn } from '@/lib/utils'
import { fetchEmailTemplateUsage } from '@/lib/emailTemplateUsage'
import { buildCustomEmailDocument } from '@/lib/email/renderCustomEmail'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { isTemplateAttachmentEligibleFile, resolveGeneratedFileDownloadUrl } from '@/lib/files/resolveGeneratedFileDownloadUrl'
import type { CustomEmailBlock, CustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import {
  defaultCustomBlocksDoc,
  loadCustomEmailBlocksDoc,
  normalizeCustomEmailBlocksDoc,
  normalizeTableBlock,
} from '@/lib/email/customEmailBlocks'
import { CustomTemplateBlocksEditorSection } from '@/components/email-templates/CustomTemplateBlockEditors'
import { customEmailTypeValue } from '@/lib/email/customTemplateId'

const CustomBlocksEditorSection = CustomTemplateBlocksEditorSection
import { ARTIST_CUSTOM_MERGE_KEYS, VENUE_CUSTOM_MERGE_KEYS } from '@/lib/email/customEmailMerge'

const EYEBROW = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-500'

function gigEmailPreviewWhenLine(): string {
  const d = PREVIEW_MOCK_DEAL.event_date?.trim()
  if (!d) return ''
  const a = pacificWallToUtcIso(d, '20:00')
  const b = pacificWallToUtcIso(d, '23:00')
  return a && b ? formatPacificTimeRangeCompact(a, b) : d
}

function gigEmailPreviewTableRow() {
  const d = PREVIEW_MOCK_DEAL.event_date?.trim()
  const start = d ? pacificWallToUtcIso(d, '20:00') : null
  const end = d ? pacificWallToUtcIso(d, '23:00') : null
  return buildGigCalendarTableRow(
    {
      event_start_at: start,
      event_end_at: end,
      event_date: PREVIEW_MOCK_DEAL.event_date,
    },
    PREVIEW_MOCK_DEAL.description,
    PREVIEW_MOCK_VENUE.name,
  )
}

const CLIENT_CUSTOM_CAPTURE_OPTIONS: { value: EmailCaptureKind; label: string }[] = [
  { value: 'first_outreach', label: EMAIL_CAPTURE_KIND_LABELS.first_outreach },
  { value: 'follow_up', label: EMAIL_CAPTURE_KIND_LABELS.follow_up },
  { value: 'booking_confirmation', label: EMAIL_CAPTURE_KIND_LABELS.booking_confirmation },
  { value: 'pre_event_checkin', label: EMAIL_CAPTURE_KIND_LABELS.pre_event_checkin },
  { value: 'payment_reminder_ack', label: EMAIL_CAPTURE_KIND_LABELS.payment_reminder_ack },
  { value: 'payment_receipt', label: EMAIL_CAPTURE_KIND_LABELS.payment_receipt },
  { value: 'post_show_thanks', label: EMAIL_CAPTURE_KIND_LABELS.post_show_thanks },
  { value: 'rebooking_inquiry', label: EMAIL_CAPTURE_KIND_LABELS.rebooking_inquiry },
  { value: 'show_cancelled_or_postponed', label: EMAIL_CAPTURE_KIND_LABELS.show_cancelled_or_postponed },
  { value: 'invoice_sent', label: EMAIL_CAPTURE_KIND_LABELS.invoice_sent },
]

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

/** Same normalization as handleSave — persisted layout shape. */
function buildCleanLayoutFromDraft(editorDraft: EmailTemplateLayoutV1): EmailTemplateLayoutV1 {
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
  return clean
}

/** Re-run the same load pipeline as saved templates so dirty compare is apples-to-apples. */
function layoutComparableFromEditorDraft(emailType: AnyEmailType, editorDraft: EmailTemplateLayoutV1): EmailTemplateLayoutV1 {
  const clean = buildCleanLayoutFromDraft(editorDraft)
  const synthetic: EmailTemplate = {
    id: '_',
    user_id: '_',
    email_type: emailType,
    custom_subject: clean.subject?.trim() || null,
    custom_intro: clean.intro?.trim() || null,
    layout: clean,
    layout_version: 1,
    created_at: '',
    updated_at: '',
  }
  return draftFromSaved(synthetic)
}

function customBlocksSemanticallyEqual(a: CustomEmailBlocksDoc, b: CustomEmailBlocksDoc): boolean {
  return JSON.stringify(normalizeCustomEmailBlocksDoc(a)) === JSON.stringify(normalizeCustomEmailBlocksDoc(b))
}

// ── Client email metadata ──────────────────────────────────────────────────

const CLIENT_DESCRIPTIONS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Confirms the booking with the venue: details, agreed amount, and next steps.',
  agreement_ready:      'Notifies venue the agreement is ready, includes the link.',
  payment_reminder:     'Friendly reminder about an outstanding payment.',
  payment_receipt:      'Confirms payment has been received.',
  follow_up:            "Check-in to venues that haven't responded.",
  rebooking_inquiry:    'Sent after a positive post-show report. Asks venue about booking again.',
  first_outreach:       'Cold first touch: introduces the artist and asks about booking interest.',
  pre_event_checkin:    'Ahead of the date: logistics, settlement, load-in, and day-of contact.',
  post_show_thanks:     'Neutral thank-you after the show (not a hard pitch for rebooking).',
  agreement_followup:   'Short nudge on agreement review or signature without resending the full “ready” email.',
  invoice_sent:         'Points the venue to an invoice or billing PDF (link from the completed task’s file).',
  show_cancelled_or_postponed: 'Professional note when a date moves or a show does not happen.',
  pass_for_now:         'Polite close when you are pausing or passing on the opportunity.',
}

const CLIENT_DEFAULT_SUBJECTS: Record<VenueEmailType, string> = {
  booking_confirmation: 'Booking Confirmation - {artist} at {venue}',
  agreement_ready:      'Agreement Ready for Review - {artist}',
  payment_reminder:     'Payment Reminder - {artist}',
  payment_receipt:      'Payment Received - Thank You | {artist}',
  follow_up:            'Following Up - {artist}',
  rebooking_inquiry:    'Interested in Booking Again - {artist}',
  first_outreach:       '{artist} — booking inquiry | {venue}',
  pre_event_checkin:    'Pre-event check-in — {artist} | {venue}',
  post_show_thanks:     'Thank you — {artist} at {venue}',
  agreement_followup:   'Following up — agreement | {artist}',
  invoice_sent:         'Invoice — {artist} | {venue}',
  show_cancelled_or_postponed: 'Update — date change / cancellation | {artist} | {venue}',
  pass_for_now:         'Thanks — {artist} | {venue}',
}

const CLIENT_ORDER: VenueEmailType[] = [
  'first_outreach',
  'follow_up',
  'booking_confirmation',
  'agreement_ready',
  'agreement_followup',
  'pre_event_checkin',
  'payment_reminder',
  'payment_receipt',
  'invoice_sent',
  'post_show_thanks',
  'rebooking_inquiry',
  'show_cancelled_or_postponed',
  'pass_for_now',
]

const ARTIST_DESCRIPTIONS: Record<ArtistEmailType, string> = {
  management_report:          'Weekly or custom-range report sent to the artist. Shows outreach, deals, retainer, and impact.',
  retainer_reminder:          'Gentle nudge email about outstanding management retainer balance.',
  retainer_received:          'Confirmation to the artist when retainer / base fee is paid in full (queued from a completed task).',
  performance_report_request: 'Sent to the artist after a show. Links to the post-show report form.',
  performance_report_received: 'Confirmation after the post-show form is submitted (auto-queued on submit).',
  gig_calendar_digest_weekly: 'Weekly on Sundays ~5am PT: digest of booked gigs in the next 14 days (Netlify schedule enqueues; email sends on next queue run).',
  gig_reminder_24h:           'Per show: one email 24 hours before start (queued when a gig is on the calendar).',
  gig_booked_ics:             'First time a gig qualifies for the calendar: confirmation email to the artist (shared calendar is updated for them; idempotent per deal).',
  gig_day_summary_manual:     'From Gig calendar: send the artist a table of every booked gig on one day (queued; sends on next cron tick).',
}

const ARTIST_DEFAULT_SUBJECTS: Record<ArtistEmailType, string> = {
  management_report:          'Management Update - {start} to {end}',
  retainer_reminder:          'Hey {firstName}, quick note from management',
  retainer_received:          '{firstName}, retainer received — thank you',
  performance_report_request: 'Quick check-in: How did the show go at {venue}?',
  performance_report_received: '{firstName}, we received your show check-in',
  gig_calendar_digest_weekly: '{firstName}, your gigs — next two weeks',
  gig_reminder_24h:           '{firstName}, reminder: {venue} in 24 hours',
  gig_booked_ics:             '{firstName}, you’re booked — show details',
  gig_day_summary_manual:     '{firstName}, your gigs — one day',
}

const ARTIST_ORDER: ArtistEmailType[] = [
  'management_report',
  'retainer_reminder',
  'retainer_received',
  'performance_report_request',
  'performance_report_received',
  'gig_calendar_digest_weekly',
  'gig_reminder_24h',
  'gig_booked_ics',
  'gig_day_summary_manual',
]

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
  const { files: generatedFilesForTemplates } = useFiles()
  const { profile: artistProfile } = useArtistProfile()
  const [testSendLoading, setTestSendLoading] = useState(false)
  const [testSendBanner, setTestSendBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
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
  const [saveError, setSaveError] = useState<string | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [selectedCustomId, setSelectedCustomId] = useState<string | null>(null)
  const [customNameDraft, setCustomNameDraft] = useState('')
  const [customSubjectDraft, setCustomSubjectDraft] = useState('')
  const [customBlocksDraft, setCustomBlocksDraft] = useState<CustomEmailBlocksDoc>(defaultCustomBlocksDoc())
  const [customAttachmentFileIdDraft, setCustomAttachmentFileIdDraft] = useState<string | null>(null)
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

  const attachmentEligibleFiles = useMemo(() => {
    const origin = publicSiteOrigin()
    return generatedFilesForTemplates.filter(f => isTemplateAttachmentEligibleFile(f, origin))
  }, [generatedFilesForTemplates])

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
  const editorLayoutComparable = useMemo(
    () => layoutComparableFromEditorDraft(selectedType, editorDraft),
    [selectedType, editorDraft],
  )

  const selectedCustomRow = selectedCustomId ? customRows.find(r => r.id === selectedCustomId) : undefined

  const tryExitEdit = useCallback((fn: () => void) => {
    if (sidebarMode === 'edit') {
      if (!layoutsEqual(editorLayoutComparable, savedLayoutNormalized)) {
        setDiscardConfirm(true)
        return
      }
    } else if (sidebarMode === 'edit-custom' && selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      if (row) {
        const parsed = loadCustomEmailBlocksDoc(row.blocks)
        const dirty =
          customNameDraft !== row.name
          || customSubjectDraft !== row.subject_template
          || !customBlocksSemanticallyEqual(customBlocksDraft, parsed)
          || (customAttachmentFileIdDraft ?? null) !== (row.attachment_generated_file_id ?? null)
        if (dirty) {
          setDiscardConfirm(true)
          return
        }
      }
    }
    fn()
  }, [
    sidebarMode,
    editorLayoutComparable,
    savedLayoutNormalized,
    selectedCustomId,
    customRows,
    customNameDraft,
    customSubjectDraft,
    customBlocksDraft,
    customAttachmentFileIdDraft,
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
    if (sidebarMode === 'edit' && !layoutsEqual(editorLayoutComparable, savedLayoutNormalized)) {
      setPendingGroup(g)
      setDiscardConfirm(true)
      return
    }
    if (sidebarMode === 'edit-custom' && selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      if (row) {
        const parsed = loadCustomEmailBlocksDoc(row.blocks)
        const dirty =
          customNameDraft !== row.name
          || customSubjectDraft !== row.subject_template
          || !customBlocksSemanticallyEqual(customBlocksDraft, parsed)
          || (customAttachmentFileIdDraft ?? null) !== (row.attachment_generated_file_id ?? null)
        if (dirty) {
          setPendingGroup(g)
          setDiscardConfirm(true)
          return
        }
      }
    }
    handleGroupSwitch(g)
  }

  const defaultSubject = useMemo(() => {
    if (activeGroup === 'client') {
      return CLIENT_DEFAULT_SUBJECTS[selectedType as VenueEmailType]
    }
    const raw = ARTIST_DEFAULT_SUBJECTS[selectedType as ArtistEmailType]
    const fn = artistTransactionalGreetingFirstName(PREVIEW_MOCK_PROFILE.artist_name)
    return raw
      .replace(/\{firstName\}/gi, fn)
      .replace(/\{venue\}/gi, PREVIEW_MOCK_VENUE.name)
      .replace(/\{start\}/gi, 'Mar 28, 2026')
      .replace(/\{end\}/gi, 'Apr 4, 2026')
  }, [activeGroup, selectedType])

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

  useEffect(() => {
    setTestSendBanner(null)
  }, [selectedType, selectedCustomId, activeGroup, sidebarMode])

  useEffect(() => {
    setSaveError(null)
  }, [selectedType, sidebarMode, selectedCustomId])

  const previewLayout = sidebarMode === 'edit'
    ? editorDraft
    : draftFromSaved(getTemplate(selectedType))

  const previewHtml = useMemo(() => {
    const customPreviewProfile: PreviewProfile = artistProfile
      ? {
        artist_name: artistProfile.artist_name ?? '',
        company_name: artistProfile.company_name ?? null,
        from_email: artistProfile.from_email,
        reply_to_email: artistProfile.reply_to_email ?? null,
        manager_name: artistProfile.manager_name ?? null,
        manager_title: artistProfile.manager_title ?? null,
        website: artistProfile.website ?? null,
        phone: artistProfile.phone ?? null,
        social_handle: artistProfile.social_handle ?? null,
        tagline: artistProfile.tagline ?? null,
      }
      : PREVIEW_MOCK_PROFILE

    if (selectedCustomId) {
      const row = customRows.find(r => r.id === selectedCustomId)
      const doc = sidebarMode === 'edit-custom'
        ? customBlocksDraft
        : loadCustomEmailBlocksDoc(row?.blocks)
      const subj = sidebarMode === 'edit-custom'
        ? customSubjectDraft
        : (row?.subject_template ?? '')
      const aud = row?.audience ?? (activeGroup === 'client' ? 'venue' : 'artist')
      const attachId = sidebarMode === 'edit-custom'
        ? customAttachmentFileIdDraft
        : (row?.attachment_generated_file_id ?? null)
      const siteO = publicSiteOrigin()
      const attachFile = attachId ? generatedFilesForTemplates.find(f => f.id === attachId) : undefined
      const attachUrl = attachFile ? resolveGeneratedFileDownloadUrl(attachFile, siteO) : null
      const attachment = attachUrl && attachFile?.name?.trim()
        ? { url: attachUrl, fileName: attachFile.name.trim() }
        : undefined
      const previewRecipient = aud === 'artist'
        ? { name: PREVIEW_MOCK_PROFILE.artist_name, email: 'artist@preview.local' }
        : PREVIEW_MOCK_RECIPIENT
      const previewCaptureCustom =
        aud === 'venue' && doc.captureKind ? 'https://preview.example.com/venue-email-ack/mock-preview-token' : undefined
      const { html } = buildCustomEmailDocument({
        audience: aud,
        subjectTemplate: subj.trim() || ' ',
        blocksRaw: doc,
        profile: customPreviewProfile,
        recipient: previewRecipient,
        deal: PREVIEW_MOCK_DEAL,
        venue: PREVIEW_MOCK_VENUE,
        logoBaseUrl: publicSiteOrigin(),
        responsiveClasses: true,
        showReplyButton: aud === 'venue',
        ...(attachment ? { attachment } : {}),
        ...(previewCaptureCustom ? { captureUrl: previewCaptureCustom } : {}),
      })
      return html
    }

    const layout = normalizeEmailTemplateLayout(previewLayout) ?? previewLayout
    const transactionalManagerName =
      artistProfile?.manager_name?.trim()
      || artistProfile?.company_name?.trim()
      || PREVIEW_MOCK_PROFILE.company_name?.trim()
      || 'Management'
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
      if (selectedType === 'retainer_received') {
        return buildRetainerReceivedHtml(layout.intro ?? null, layout.subject ?? null, layout)
      }
      if (selectedType === 'performance_report_received') {
        return buildArtistTransactionalEmailHtml(
          'performance_report_received',
          {
            artistName: artistProfile?.artist_name ?? PREVIEW_MOCK_PROFILE.artist_name,
            venueName: PREVIEW_MOCK_VENUE.name,
            eventDate: null,
            managerName: transactionalManagerName,
            managerTitle: artistProfile?.manager_title ?? PREVIEW_MOCK_PROFILE.manager_title ?? null,
            website: artistProfile?.website ?? PREVIEW_MOCK_PROFILE.website,
            social_handle: artistProfile?.social_handle ?? PREVIEW_MOCK_PROFILE.social_handle,
            phone: artistProfile?.phone ?? PREVIEW_MOCK_PROFILE.phone,
          },
          layout,
          publicSiteOrigin(),
        )
      }
      if (selectedType === 'gig_reminder_24h') {
        const Lsend = artistLayoutForSend(layout, null, null)
        return buildBrandedGigCalendarEmail({
          kind: 'gig_reminder_24h',
          L: Lsend,
          logoBaseUrl: publicSiteOrigin(),
          artistName: artistProfile?.artist_name ?? PREVIEW_MOCK_PROFILE.artist_name,
          managerName: transactionalManagerName,
          managerTitle: artistProfile?.manager_title ?? PREVIEW_MOCK_PROFILE.manager_title ?? null,
          website: artistProfile?.website ?? PREVIEW_MOCK_PROFILE.website,
          social_handle: artistProfile?.social_handle ?? PREVIEW_MOCK_PROFILE.social_handle,
          phone: artistProfile?.phone ?? PREVIEW_MOCK_PROFILE.phone,
          reminder: {
            venueName: PREVIEW_MOCK_VENUE.name,
            dealDescription: PREVIEW_MOCK_DEAL.description,
            whenLine: gigEmailPreviewWhenLine(),
          },
        })
      }
      if (selectedType === 'gig_booked_ics') {
        const Lsend = artistLayoutForSend(layout, null, null)
        return buildBrandedGigCalendarEmail({
          kind: 'gig_booked_ics',
          L: Lsend,
          logoBaseUrl: publicSiteOrigin(),
          artistName: artistProfile?.artist_name ?? PREVIEW_MOCK_PROFILE.artist_name,
          managerName: transactionalManagerName,
          managerTitle: artistProfile?.manager_title ?? PREVIEW_MOCK_PROFILE.manager_title ?? null,
          website: artistProfile?.website ?? PREVIEW_MOCK_PROFILE.website,
          social_handle: artistProfile?.social_handle ?? PREVIEW_MOCK_PROFILE.social_handle,
          phone: artistProfile?.phone ?? PREVIEW_MOCK_PROFILE.phone,
          icsBody: {
            dealDescription: PREVIEW_MOCK_DEAL.description,
            venueLine: [PREVIEW_MOCK_VENUE.name, PREVIEW_MOCK_VENUE.city].filter(Boolean).join(', '),
          },
        })
      }
      if (selectedType === 'gig_calendar_digest_weekly') {
        const Lsend = artistLayoutForSend(layout, null, null)
        return buildBrandedGigCalendarEmail({
          kind: 'gig_calendar_digest_weekly',
          L: Lsend,
          logoBaseUrl: publicSiteOrigin(),
          artistName: artistProfile?.artist_name ?? PREVIEW_MOCK_PROFILE.artist_name,
          managerName: transactionalManagerName,
          managerTitle: artistProfile?.manager_title ?? PREVIEW_MOCK_PROFILE.manager_title ?? null,
          website: artistProfile?.website ?? PREVIEW_MOCK_PROFILE.website,
          social_handle: artistProfile?.social_handle ?? PREVIEW_MOCK_PROFILE.social_handle,
          phone: artistProfile?.phone ?? PREVIEW_MOCK_PROFILE.phone,
          digest: {
            rows: [gigEmailPreviewTableRow()],
          },
        })
      }
      if (selectedType === 'gig_day_summary_manual') {
        const Lsend = artistLayoutForSend(layout, null, null)
        return buildBrandedGigCalendarEmail({
          kind: 'gig_day_summary_manual',
          L: Lsend,
          logoBaseUrl: publicSiteOrigin(),
          artistName: artistProfile?.artist_name ?? PREVIEW_MOCK_PROFILE.artist_name,
          managerName: transactionalManagerName,
          managerTitle: artistProfile?.manager_title ?? PREVIEW_MOCK_PROFILE.manager_title ?? null,
          website: artistProfile?.website ?? PREVIEW_MOCK_PROFILE.website,
          social_handle: artistProfile?.social_handle ?? PREVIEW_MOCK_PROFILE.social_handle,
          phone: artistProfile?.phone ?? PREVIEW_MOCK_PROFILE.phone,
          daySummary: {
            dayLabel: 'Sample show day',
            rows: [gigEmailPreviewTableRow()],
          },
        })
      }
      return buildRetainerReminderHtml(layout.intro ?? null, layout.subject ?? null, layout)
    }
    const previewCaptureUrl = venueEmailTypeToCaptureKind(selectedType as VenueEmailType)
      ? 'https://preview.example.com/venue-email-ack/mock-preview-token'
      : null
    const previewInvoiceUrl = selectedType === 'invoice_sent'
      ? EMAIL_TEMPLATE_PREVIEW_INVOICE_URL
      : null
    return buildVenueEmailHtml(
      selectedType as PreviewEmailType,
      customPreviewProfile,
      PREVIEW_MOCK_RECIPIENT,
      PREVIEW_MOCK_DEAL,
      PREVIEW_MOCK_VENUE,
      layout.intro ?? null,
      layout.subject ?? null,
      layout,
      previewInvoiceUrl,
      previewCaptureUrl,
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
    customAttachmentFileIdDraft,
    generatedFilesForTemplates,
    artistProfile,
  ])

  const handleSendTemplateTest = useCallback(async () => {
    if (!artistProfile) return
    setTestSendLoading(true)
    setTestSendBanner(null)
    const result = await sendEmailTemplateTest({
      supabase,
      profile: artistProfile,
      previewLayout,
      activeGroup,
      selectedType,
      selectedCustomId,
      sidebarMode,
      customRows,
      customBlocksDraft,
      customSubjectDraft,
      customAttachmentFileIdDraft,
      generatedFilesForTemplates,
    })
    setTestSendLoading(false)
    if (result.ok) {
      setTestSendBanner({
        kind: 'ok',
        text: `Test sent to ${artistProfile.manager_email ?? 'your manager email'}`,
      })
    } else {
      setTestSendBanner({ kind: 'err', text: result.message })
    }
  }, [
    artistProfile,
    previewLayout,
    activeGroup,
    selectedType,
    selectedCustomId,
    sidebarMode,
    customRows,
    customBlocksDraft,
    customSubjectDraft,
    customAttachmentFileIdDraft,
    generatedFilesForTemplates,
  ])

  const testSendDisabled = !artistProfile?.manager_email?.trim()
    || !artistProfile?.from_email?.trim()
    || testSendLoading

  const isDirty = !layoutsEqual(editorLayoutComparable, savedLayoutNormalized)
  const hasCustom = !!(savedTmpl && layoutHasAnyCustomization(artistLayoutForSend(
    savedTmpl.layout,
    savedTmpl.custom_subject,
    savedTmpl.custom_intro,
  )))
  const isCustomDirty = (() => {
    if (sidebarMode !== 'edit-custom' || !selectedCustomRow) return false
    const parsed = loadCustomEmailBlocksDoc(selectedCustomRow.blocks)
    return customNameDraft !== selectedCustomRow.name
      || customSubjectDraft !== selectedCustomRow.subject_template
      || !customBlocksSemanticallyEqual(customBlocksDraft, parsed)
      || (customAttachmentFileIdDraft ?? null) !== (selectedCustomRow.attachment_generated_file_id ?? null)
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
    setCustomBlocksDraft(loadCustomEmailBlocksDoc(row.blocks))
    setCustomAttachmentFileIdDraft(row.attachment_generated_file_id ?? null)
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
    const res = await updateCustomRow(selectedCustomId, {
      name: customNameDraft.trim() || 'Untitled',
      subject_template: customSubjectDraft,
      blocks: customBlocksDraft,
      attachment_generated_file_id: customAttachmentFileIdDraft,
    })
    setSaving(false)
    if (res && 'data' in res && res.data) {
      const row = res.data
      setCustomNameDraft(row.name)
      setCustomSubjectDraft(row.subject_template)
      setCustomBlocksDraft(loadCustomEmailBlocksDoc(row.blocks))
      setCustomAttachmentFileIdDraft(row.attachment_generated_file_id ?? null)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const mergeKeyOptions = (activeGroup === 'client' ? VENUE_CUSTOM_MERGE_KEYS : ARTIST_CUSTOM_MERGE_KEYS) as readonly string[]

  const updateCustomBlock = (index: number, patch: Partial<CustomEmailBlock>) => {
    setCustomBlocksDraft(prev => {
      const blocks = [...prev.blocks]
      const cur = blocks[index]
      if (!cur) return prev
      let next = { ...cur, ...patch } as CustomEmailBlock
      if (next.kind === 'table') {
        next = normalizeTableBlock(next)
      }
      blocks[index] = next
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
          : kind === 'bullet_list' ? { kind: 'bullet_list', title: '', items: ['', '', ''] }
            : kind === 'key_value' ? { kind: 'key_value', title: '', rows: [{ label: 'Field', value: '' }] }
              : kind === 'table' ? { kind: 'table', title: '', headers: ['Col A', 'Col B'], rows: [['', '']] }
                : { kind: 'divider' }
      const pushed = nb.kind === 'table' ? normalizeTableBlock(nb) : nb
      return { ...prev, blocks: [...prev.blocks, pushed] }
    })
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    const clean = buildCleanLayoutFromDraft(editorDraft)
    const res = await upsertTemplate(selectedType, { layout: clean })
    setSaving(false)
    if (res && 'error' in res && res.error) {
      setSaveError(res.error.message)
      return
    }
    if (res && 'data' in res && res.data) {
      const nextDraft = draftFromSaved(res.data)
      setEditorDraft(nextDraft)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } else {
      setSaveError('Save failed — no data returned.')
    }
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

      <div className="flex gap-5 flex-1 min-h-0 min-w-0">

        <div
          className={cn(
            'flex flex-col gap-2 min-h-0 self-stretch border-r border-neutral-800/80 pr-4 min-w-0',
            sidebarMode === 'browse' ? 'w-[300px] shrink-0' : 'flex-[1.85] basis-0 min-w-0',
          )}
        >

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
                                  setCustomBlocksDraft(loadCustomEmailBlocksDoc(data.blocks))
                                  setCustomAttachmentFileIdDraft(data.attachment_generated_file_id ?? null)
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
                <div>
                  <p className={EYEBROW}>Opening line</p>
                  <Input
                    value={customBlocksDraft.greeting ?? ''}
                    onChange={e => {
                      const v = e.target.value
                      setCustomBlocksDraft(prev => ({
                        ...prev,
                        greeting: v === '' ? undefined : v,
                      }))
                    }}
                    placeholder={
                      activeGroup === 'client'
                        ? 'Default: Hi + contact first name'
                        : 'Default: Hey {{profile.artist_name}},'
                    }
                    className="text-sm mt-1"
                  />
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Optional. Same merge tokens as subject. Leave empty for the default.
                  </p>
                </div>
                {selectedCustomRow.audience === 'venue' && (
                  <div>
                    <p className={EYEBROW}>Response form (optional)</p>
                    <Select
                      value={customBlocksDraft.captureKind ?? '__none__'}
                      onValueChange={v => {
                        setCustomBlocksDraft(prev => ({
                          ...prev,
                          captureKind: v === '__none__' ? undefined : v as EmailCaptureKind,
                        }))
                      }}
                    >
                      <SelectTrigger className="text-sm mt-1 h-9">
                        <SelectValue placeholder="No form link" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">No form link</SelectItem>
                        {CLIENT_CUSTOM_CAPTURE_OPTIONS.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-neutral-600 mt-1">
                      When set, sends and the email queue include the same capture button as built-in client templates.
                    </p>
                  </div>
                )}
                <div>
                  <p className={EYEBROW}>Attachment (optional)</p>
                  <Select
                    value={customAttachmentFileIdDraft ?? '__none__'}
                    onValueChange={v => setCustomAttachmentFileIdDraft(v === '__none__' ? null : v)}
                  >
                    <SelectTrigger className="text-sm mt-1 h-9">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {attachmentEligibleFiles.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                          {f.file_source === 'upload' ? ' · upload' : f.output_format === 'pdf' ? ' · PDF' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Adds a download block after the template body (PDFs and uploaded files from Files with a public link).
                  </p>
                </div>
                <CustomBlocksEditorSection
                  blocks={customBlocksDraft.blocks}
                  mergeKeyOptions={mergeKeyOptions}
                  blockMenuOpen={blockMenuOpen}
                  onBlockMenuOpenChange={setBlockMenuOpen}
                  onAddBlock={addCustomBlock}
                  onUpdateBlock={updateCustomBlock}
                  onMoveBlock={moveCustomBlock}
                  onRemoveBlock={removeCustomBlock}
                />
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
                    {saveError && (
                      <p className="text-[10px] text-red-400 max-w-[280px] text-right mt-1 leading-snug">
                        {saveError}
                      </p>
                    )}
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

        <div
          className={cn(
            'flex flex-col min-h-0 min-w-0',
            sidebarMode === 'browse' ? 'flex-1' : 'flex-[0.92] basis-0 shrink-0 min-w-[280px]',
          )}
        >
          <div className="flex-1 min-h-0 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col min-w-0">
            <div className="px-4 py-2.5 border-b border-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1.5 shrink-0">
              <Monitor className="h-3.5 w-3.5 text-neutral-500" />
              <span className="text-xs font-medium text-neutral-400">Preview — {typeLabel}</span>
              <span className="text-[10px] text-neutral-600">
                {activeGroup === 'client'
                  ? 'Mock: Alex / Skyline Bar'
                  : 'Mock: DJ Luijay'}
              </span>
              <div className="w-full min-[520px]:w-auto min-[520px]:ml-auto flex flex-col items-stretch min-[520px]:items-end gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  disabled={testSendDisabled}
                  onClick={() => void handleSendTemplateTest()}
                  title={
                    !artistProfile?.manager_email?.trim()
                      ? 'Add manager email in Settings to send tests'
                      : !artistProfile?.from_email?.trim()
                        ? 'Set from email in your artist profile'
                        : 'Send this preview to your manager email'
                  }
                >
                  {testSendLoading ? (
                    <span className="text-neutral-400">Sending…</span>
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      Send test to myself
                    </>
                  )}
                </Button>
                {!artistProfile?.manager_email?.trim() && (
                  <span className="text-[10px] text-neutral-600 text-right">
                    Requires manager email (Settings).
                  </span>
                )}
                {activeGroup === 'artist'
                  && selectedType === 'performance_report_request'
                  && !selectedCustomId && (
                  <span className="text-[10px] text-neutral-600 text-right max-w-[280px]">
                    Test email uses a sample form link (not a real report).
                  </span>
                )}
              </div>
            </div>
            {testSendBanner && (
              <div
                className={cn(
                  'px-4 py-2 text-[11px] border-b border-neutral-800',
                  testSendBanner.kind === 'ok'
                    ? 'text-green-400 bg-green-950/20'
                    : 'text-red-400 bg-red-950/20',
                )}
              >
                {testSendBanner.text}
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
              <iframe
                key={`${activeGroup}-${selectedType}-${sidebarMode}-${selectedCustomId ?? ''}`}
                srcDoc={previewHtml}
                title={`Email preview - ${selectedCustomId ?? selectedType}`}
                className="w-full h-full border-0 min-h-[480px]"
                sandbox="allow-same-origin allow-scripts"
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
            <DialogDescription className="text-sm text-neutral-400">
              Your edits will be lost.
            </DialogDescription>
          </DialogHeader>
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
                      setCustomBlocksDraft(loadCustomEmailBlocksDoc(row.blocks))
                      setCustomAttachmentFileIdDraft(row.attachment_generated_file_id ?? null)
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
                  setCustomBlocksDraft(loadCustomEmailBlocksDoc(res.data.blocks))
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
