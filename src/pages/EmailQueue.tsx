import { useState, useEffect, useCallback, useMemo } from 'react'
import { MailOpen, Send, X, Clock, CheckCircle, XCircle, RefreshCw, Eye, HelpCircle } from 'lucide-react'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import type { ArtistEmailType, GeneratedFile, VenueEmail, VenueEmailType } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS, VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import { resolveDealAgreementUrlForEmailPayload } from '@/lib/resolveAgreementUrl'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { loadCustomEmailBlocksDoc } from '@/lib/email/customEmailBlocks'
import { buildCustomEmailDocument } from '@/lib/email/renderCustomEmail'
import { EMAIL_FOOTER_MUTED, EMAIL_HINT, EMAIL_LABEL } from '@/lib/email/emailDarkSurfacePalette'
import { buildVenueEmailDocument, type VenueRenderEmailType } from '@/lib/email/renderVenueEmail'
import { artistLayoutForSend, normalizeEmailTemplateLayout } from '@/lib/emailLayout'
import {
  artistTransactionalGreetingFirstName,
  buildArtistTransactionalEmailHtml,
} from '@/lib/email/artistTransactionalEmailDocument'
import {
  clampEmailQueueBufferMinutes,
  DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES,
} from '@/lib/emailQueueBuffer'
import { isQueuedBuiltinArtistEmailType, isQueueBufferZeroEmailType } from '@/lib/email/queuedBuiltinArtistEmail'
import { parsePerfFormQueueNotes } from '@/lib/email/performanceFormQueuePayload'
import { parseInvoiceQueueNotes } from '@/lib/email/invoiceQueuePayload'
import { parseArtistTxnQueueNotes } from '@/lib/email/artistTxnQueuePayload'
import { parseGigCalendarQueueNotes } from '@/lib/email/gigCalendarQueueNotes'
import { buildBrandedGigCalendarEmail, buildGigCalendarTableRow } from '@/lib/email/gigCalendarEmailHtml'
import { buildGigBookedEmailMiddleHtml, catalogDocFromSupabaseRow } from '@/lib/email/gigBookedEmailSections'
import { dealQualifiesForCalendar } from '@/lib/calendar/gigCalendarRules'
import { shouldSendGigReminderNow } from '@/lib/calendar/gigReminderSchedule'
import {
  addCalendarDaysPacific,
  formatPacificDateLongFromYmd,
  pacificDayEndExclusiveUtcIso,
  pacificWallToUtcIso,
  performanceWindowCompactFromDeal,
  stripOnTheHourMinutes12h,
  whenLineCompactFromDeal,
} from '@/lib/calendar/pacificWallTime'
import type { Deal, Venue } from '@/types'
import { formatOutboundEmailNotes } from '@/lib/email/recordOutboundEmail'
import { ensureQueueCaptureUrl } from '@/lib/emailCapture/ensureQueueCaptureUrl'
import {
  EMAIL_CAPTURE_KIND_LABELS,
  captureLinkLabel,
  isEmailCaptureKind,
  isVenueEmailOneTapAckKind,
  venueEmailAckPublicUrl,
  venueEmailTypeToCaptureKind,
} from '@/lib/emailCapture/kinds'
import { parseEmailCaptureTokenFromNotes } from '@/lib/emailCapture/tokenNotes'
import { fetchReportInputsForUser } from '@/lib/reports/fetchReportInputsForUser'
import {
  buildManagementReportData,
  buildRetainerReceivedPayload,
  buildRetainerReminderPayload,
  defaultQueuedManagementReportDateRange,
} from '@/lib/reports/buildManagementReportData'

function fmtDate(iso: string) {
  return stripOnTheHourMinutes12h(new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }))
}

function getMinutesUntilSend(createdAt: string, bufferMinutes: number): number {
  const sendAt = new Date(createdAt).getTime() + bufferMinutes * 60 * 1000
  return Math.max(0, Math.ceil((sendAt - Date.now()) / 60000))
}

function pendingNotesLine(email: VenueEmail): string | null {
  if (parseEmailCaptureTokenFromNotes(email.notes)) {
    return 'Includes venue quick-response link in body when sent'
  }
  if (email.email_type === 'performance_report_request') {
    const p = parsePerfFormQueueNotes(email.notes)
    if (p) {
      const when = p.eventDate ? ` · show ${p.eventDate}` : ''
      return `Performance form · ${p.venueName}${when}`
    }
  }
  if (email.email_type === 'invoice_sent') {
    const inv = parseInvoiceQueueNotes(email.notes)
    if (inv?.url) return 'Invoice link attached to this send'
  }
  if (email.email_type === 'performance_report_received') {
    const t = parseArtistTxnQueueNotes(email.notes)
    if (t) {
      const when = t.eventDate ? ` · ${t.eventDate}` : ''
      return `Report received · ${t.venueName}${when}`
    }
  }
  if (email.email_type === 'gig_calendar_digest_weekly') {
    const n = parseGigCalendarQueueNotes(email.notes)
    if (n?.kind === 'gig_calendar_digest_weekly') {
      const weekLabel = formatPacificDateLongFromYmd(n.weekStart)
      return `Weekly gig digest · week of ${weekLabel} · next 2 weeks of shows`
    }
  }
  if (email.email_type === 'gig_day_summary_manual') {
    const n = parseGigCalendarQueueNotes(email.notes)
    if (n?.kind === 'gig_day_summary_manual') return `Day summary · ${n.ymd}`
  }
  if (email.email_type === 'gig_reminder_24h' || email.email_type === 'gig_booked_ics') {
    const n = parseGigCalendarQueueNotes(email.notes)
    if (n?.kind === email.email_type) return email.email_type === 'gig_booked_ics' ? 'Booked gig email · queued' : '24h reminder · queued'
  }
  return email.notes?.trim() || null
}

/** Same rules as `process-email-queue` (artist custom = 0; management, retainer, performance form = 0). */
function effectiveQueueBufferMinutes(email: VenueEmail, userBuffer: number): number {
  const cid = parseCustomTemplateId(email.email_type)
  if (cid && !email.venue_id) return 0
  if (isQueueBufferZeroEmailType(email.email_type)) return 0
  return userBuffer
}

/** Pending row is held until a future wall time (e.g. 24h reminder)—show under Scheduled, not Active. */
function isPendingScheduledForLater(email: VenueEmail): boolean {
  const raw = email.scheduled_send_at
  if (raw == null || String(raw).trim() === '') return false
  const ms = new Date(raw).getTime()
  return Number.isFinite(ms) && ms > Date.now()
}

function splitPendingBySchedule(pending: VenueEmail[]): {
  immediate: VenueEmail[]
  scheduled: VenueEmail[]
} {
  const immediate: VenueEmail[] = []
  const scheduled: VenueEmail[] = []
  for (const e of pending) {
    if (isPendingScheduledForLater(e)) scheduled.push(e)
    else immediate.push(e)
  }
  scheduled.sort(
    (a, b) =>
      new Date(a.scheduled_send_at!).getTime() - new Date(b.scheduled_send_at!).getTime(),
  )
  return { immediate, scheduled }
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'sent') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-950 text-green-400 border border-green-800">
      <CheckCircle className="h-3 w-3" />Sent
    </span>
  )
  if (status === 'failed') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-red-950 text-red-400 border border-red-800">
      <XCircle className="h-3 w-3" />Failed
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700">
      <Clock className="h-3 w-3" />Pending
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const label = VENUE_EMAIL_TYPE_LABELS[type as VenueEmailType]
    ?? ARTIST_EMAIL_TYPE_LABELS[type as ArtistEmailType]
    ?? (type.startsWith('custom:') ? 'Custom email' : type)
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
      {label}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-14 text-center border-2 border-dashed border-neutral-800 rounded-lg">
      <MailOpen className="h-7 w-7 text-neutral-700 mx-auto mb-2" />
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  )
}

function CountdownBadge({
  createdAt,
  bufferMinutes,
  scheduledSendAt,
  emailType,
}: {
  createdAt: string
  bufferMinutes: number
  scheduledSendAt?: string | null
  emailType: string
}) {
  const [minsLeft, setMinsLeft] = useState(() => getMinutesUntilSend(createdAt, bufferMinutes))

  useEffect(() => {
    if (bufferMinutes <= 0) return
    const tick = () => setMinsLeft(getMinutesUntilSend(createdAt, bufferMinutes))
    const id = setInterval(tick, 30000)
    tick()
    return () => clearInterval(id)
  }, [createdAt, bufferMinutes])

  if (scheduledSendAt) {
    const schedMs = new Date(scheduledSendAt).getTime()
    if (Number.isFinite(schedMs) && schedMs > Date.now()) {
      const label = new Date(scheduledSendAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      })
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
          <Clock className="h-2.5 w-2.5" />Scheduled · {label}
        </span>
      )
    }
  }

  if (bufferMinutes <= 0) {
    if (emailType === 'gig_reminder_24h') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
          <Clock className="h-2.5 w-2.5" />Automated — ~24h before show
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
        <Clock className="h-2.5 w-2.5" />Automated — next queue run
      </span>
    )
  }

  if (minsLeft <= 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <Clock className="h-2.5 w-2.5" />Sending soon…
    </span>
  )

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-neutral-500">
      <Clock className="h-2.5 w-2.5" />Auto-sends in {minsLeft} min
    </span>
  )
}

interface PendingRowProps {
  email: VenueEmail
  bufferMinutes: number
  onSendNow: (email: VenueEmail) => void
  onDismiss: (id: string) => void
  onPreview: (email: VenueEmail) => void
  sending: boolean
  dismissing: boolean
}

function PendingRow({ email, bufferMinutes, onSendNow, onDismiss, onPreview, sending, dismissing }: PendingRowProps) {
  const recipientName = email.contact?.name || null
  const noteLine = pendingNotesLine(email)

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-neutral-800 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={email.email_type} />
          {email.venue && (
            <span className="text-xs text-neutral-400">{email.venue.name}</span>
          )}
        </div>
        <p className="text-sm text-neutral-300 truncate">
          {recipientName ? `${recipientName} · ` : ''}{email.recipient_email}
        </p>
        <div className="flex items-center gap-3">
          <CountdownBadge
            createdAt={email.created_at}
            bufferMinutes={bufferMinutes}
            scheduledSendAt={email.scheduled_send_at}
            emailType={email.email_type}
          />
          <span className="text-[10px] text-neutral-700">{fmtDate(email.created_at)}</span>
        </div>
        {noteLine && (
          <p className="text-xs text-neutral-600 italic">{noteLine}</p>
        )}
      </div>
      <div className="flex gap-2 shrink-0 items-start pt-0.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-300"
          onClick={() => onPreview(email)}
          title="Preview email"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onSendNow(email)}
          disabled={sending || dismissing}
        >
          <Send className="h-3.5 w-3.5" />
          Send now
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-neutral-500 hover:text-red-400"
          onClick={() => onDismiss(email.id)}
          disabled={dismissing || sending}
          title="Cancel & remove"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function HistoryRow({ email, onPreview }: { email: VenueEmail; onPreview: (email: VenueEmail) => void }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-neutral-800 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <StatusBadge status={email.status} />
          <TypeBadge type={email.email_type} />
          {email.venue && (
            <span className="text-xs text-neutral-400">{email.venue.name}</span>
          )}
        </div>
        <p className="text-sm text-neutral-300 truncate">
          {email.contact?.name ? `${email.contact.name} · ` : ''}{email.recipient_email}
        </p>
        <p className="text-xs text-neutral-600">
          {email.sent_at ? fmtDate(email.sent_at) : fmtDate(email.created_at)}
        </p>
        {email.notes && email.status === 'failed' && (
          <p className="text-xs text-red-500 italic">{email.notes}</p>
        )}
      </div>
      <div className="shrink-0 pt-0.5">
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-neutral-500 hover:text-neutral-300"
          onClick={() => onPreview(email)}
          title="Preview email"
        >
          <Eye className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

type RecentCaptureRow = {
  id: string
  kind: string
  consumed_at: string
  venue: { name: string } | null
}

export default function EmailQueue() {
  const { pendingEmails, sentEmails, loading, refetch, dismissQueued, updateEmailStatus } = useVenueEmails()
  const { profile } = useArtistProfile()
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
  const [queueSubTab, setQueueSubTab] = useState<'immediate' | 'scheduled'>('immediate')
  const [recentCaptures, setRecentCaptures] = useState<RecentCaptureRow[]>([])
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const bufferMinutes = profile
    ? clampEmailQueueBufferMinutes(profile.email_queue_buffer_minutes)
    : DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES

  const { immediate: pendingImmediate, scheduled: pendingScheduled } = useMemo(
    () => splitPendingBySchedule(pendingEmails),
    [pendingEmails],
  )

  const displayedPending =
    queueSubTab === 'scheduled' ? pendingScheduled : pendingImmediate

  useEffect(() => {
    if (activeTab !== 'queue') return
    const id = window.setInterval(() => {
      void refetch({ silent: true })
    }, 30_000)
    return () => window.clearInterval(id)
  }, [activeTab, refetch])

  useEffect(() => {
    if (activeTab !== 'history') return
    let cancelled = false
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('email_capture_tokens')
        .select('id, kind, consumed_at, venue:venues(name)')
        .eq('user_id', user.id)
        .not('consumed_at', 'is', null)
        .order('consumed_at', { ascending: false })
        .limit(12)
      if (!cancelled) setRecentCaptures((data ?? []) as RecentCaptureRow[])
    })()
    return () => { cancelled = true }
  }, [activeTab])

  const handleDismiss = async (id: string) => {
    setDismissingId(id)
    await dismissQueued(id)
    setDismissingId(null)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handlePreview = useCallback(async (email: VenueEmail) => {
    if (!profile) return
    setPreviewLoading(true)
    setPreviewHtml(null)
    setPreviewSubject(email.subject || '')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setPreviewLoading(false); return }

      const profileForRender = {
        artist_name: profile.artist_name ?? '',
        company_name: profile.company_name ?? null,
        from_email: profile.from_email,
        reply_to_email: profile.reply_to_email,
        manager_name: profile.manager_name ?? null,
        manager_title: profile.manager_title ?? null,
        website: profile.website,
        phone: profile.phone,
        social_handle: profile.social_handle,
        tagline: profile.tagline,
      }

      if (isQueuedBuiltinArtistEmailType(email.email_type)) {
        const inputs = await fetchReportInputsForUser(supabase, user.id)
        const esc = (s: string) => s
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')

        if (email.email_type === 'management_report') {
          const { start, end } = defaultQueuedManagementReportDateRange()
          const report = buildManagementReportData(inputs, start, end)
          const { data: mrTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject')
            .eq('user_id', user.id)
            .eq('email_type', 'management_report')
            .maybeSingle()
          const startFmt = new Date(`${start}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const endFmt = new Date(`${end}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
          const subj = (mrTmpl?.custom_subject as string | null)?.trim() || `Management Update - ${startFmt} to ${endFmt}`
          setPreviewSubject(subj)
          const toe = esc(profile.artist_email ?? '')
          setPreviewHtml(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e6e6e6;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:${EMAIL_FOOTER_MUTED};font-size:11px;margin:0 0 16px">Summary preview (rolling 7 days through today) · sent to <strong>${toe}</strong></p>`
            + `<p style="margin:0 0 12px"><strong>Outreach</strong><br/>`
            + `New venues: ${report.outreach.venuesContacted} · Engaged: ${report.outreach.venuesUpdated} · In discussion: ${report.outreach.inDiscussion} · Booked: ${report.outreach.venuesBooked}</p>`
            + `<p style="margin:0 0 12px"><strong>Artist earnings</strong><br/>`
            + `Booking gross: ${report.artistEarnings.grossBookedInPeriod.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · Paid toggle gross: ${report.artistEarnings.grossArtistPaidInPeriod.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + `<p style="margin:0 0 12px"><strong>Your commission</strong><br/>`
            + `On new deals in window: ${report.deals.totalCommission.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · Outstanding: ${report.deals.allOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + `<p style="margin:0 0 12px"><strong>Retainer</strong><br/>`
            + `Outstanding: ${report.retainer.feeOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + `<p style="margin:0;color:${EMAIL_HINT};font-size:11px">Layout matches Reports → Send management update.</p></div></body></html>`,
          )
        } else if (email.email_type === 'retainer_reminder') {
          const { unpaidFees, totalOutstanding } = buildRetainerReminderPayload(inputs.fees)
          const { data: rrTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject')
            .eq('user_id', user.id)
            .eq('email_type', 'retainer_reminder')
            .maybeSingle()
          const firstName = (profile.artist_name ?? 'Artist').split(/\s+/)[0] || 'Artist'
          const subj = (rrTmpl?.custom_subject as string | null)?.trim() || `Hey ${firstName}, quick note from management`
          setPreviewSubject(subj)
          const rows = unpaidFees.length === 0
            ? '<p style="color:#f87171">No outstanding balance — send would be skipped.</p>'
            : `<ul style="margin:0;padding-left:18px">${unpaidFees.map(f =>
              `<li>${esc(f.month)}: balance ${f.balance.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</li>`,
            ).join('')}</ul>`
          setPreviewHtml(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e6e6e6;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:${EMAIL_FOOTER_MUTED};font-size:11px;margin:0 0 16px">Retainer reminder preview · total outstanding ${totalOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + rows
            + `<p style="margin:16px 0 0;color:${EMAIL_HINT};font-size:11px">Layout matches Earnings → Send reminder.</p></div></body></html>`,
          )
        } else if (email.email_type === 'retainer_received') {
          const { settledFees, totalAcknowledged } = buildRetainerReceivedPayload(inputs.fees)
          const { data: rxTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject')
            .eq('user_id', user.id)
            .eq('email_type', 'retainer_received')
            .maybeSingle()
          const firstName = (profile.artist_name ?? 'Artist').split(/\s+/)[0] || 'Artist'
          const subj = (rxTmpl?.custom_subject as string | null)?.trim() || `${firstName}, retainer received — thank you`
          setPreviewSubject(subj)
          const toe = esc(profile.artist_email ?? '')
          const rows = settledFees.length === 0
            ? `<p style="color:#86efac">No settled invoice rows in Earnings yet — live email still sends a short thank-you.</p>`
            : `<ul style="margin:0;padding-left:18px">${settledFees.map(f =>
              `<li>${esc(f.month)}: ${f.paid.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} paid (invoiced ${f.invoiced.toLocaleString('en-US', { style: 'currency', currency: 'USD' })})</li>`,
            ).join('')}</ul>`
          setPreviewHtml(
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e6e6e6;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:${EMAIL_FOOTER_MUTED};font-size:11px;margin:0 0 16px">Retainer received preview · total acknowledged ${totalAcknowledged.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · sent to <strong>${toe}</strong></p>`
            + rows
            + `<p style="margin:16px 0 0;color:${EMAIL_HINT};font-size:11px">Layout matches Email templates → Retainer payment received.</p></div></body></html>`,
          )
        } else if (email.email_type === 'performance_report_received') {
          const txn = parseArtistTxnQueueNotes(email.notes)
          if (!txn || txn.kind !== 'performance_report_received') {
            setPreviewHtml('<div style="padding:40px;color:#f87171;text-align:center;">Missing artist transactional payload on this row.</div>')
            setPreviewLoading(false)
            return
          }
          const { data: txTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', email.email_type)
            .maybeSingle()
          const L = artistLayoutForSend(txTmpl?.layout ?? null, txTmpl?.custom_subject ?? null, txTmpl?.custom_intro ?? null)
          const site = publicSiteOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
          const html = buildArtistTransactionalEmailHtml(
            'performance_report_received',
            {
              artistName: profile.artist_name ?? '',
              venueName: txn.venueName,
              eventDate: txn.eventDate,
              managerName: profile.manager_name?.trim() || 'Management',
              managerTitle: profile.manager_title ?? null,
              website: profile.website ?? null,
              social_handle: profile.social_handle ?? null,
              phone: profile.phone ?? null,
            },
            L,
            site,
          )
          setPreviewHtml(html)
          const firstName = artistTransactionalGreetingFirstName(profile.artist_name ?? '') || 'Artist'
          setPreviewSubject(L.subject?.trim() || `${firstName}, we received your show check-in`)
        } else if (
          email.email_type === 'gig_calendar_digest_weekly'
          || email.email_type === 'gig_reminder_24h'
          || email.email_type === 'gig_booked_ics'
          || email.email_type === 'gig_day_summary_manual'
        ) {
          const gigN = parseGigCalendarQueueNotes(email.notes)
          const { data: gcTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', email.email_type)
            .maybeSingle()
          const Lg = artistLayoutForSend(gcTmpl?.layout ?? null, gcTmpl?.custom_subject ?? null, gcTmpl?.custom_intro ?? null)
          const subj = Lg.subject?.trim() || email.subject
          setPreviewSubject(subj)
          const siteG = publicSiteOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
          const gigShellP = {
            artistName: profile.artist_name ?? '',
            managerName: profile.manager_name?.trim() || 'Management',
            managerTitle: profile.manager_title ?? null,
            website: profile.website ?? null,
            social_handle: profile.social_handle ?? null,
            phone: profile.phone ?? null,
          }

          if (email.email_type === 'gig_calendar_digest_weekly' && gigN?.kind === 'gig_calendar_digest_weekly') {
            const venues = inputs.venues as Venue[]
            const deals = inputs.deals as Deal[]
            const vmap = new Map(venues.map(v => [v.id, v]))
            const startIso = pacificWallToUtcIso(gigN.weekStart, '00:00')
            const endDay = addCalendarDaysPacific(gigN.weekStart, 14)
            const endExclusiveIso = pacificDayEndExclusiveUtcIso(endDay)
            const digestDeals: Deal[] = []
            if (startIso && endExclusiveIso) {
              const t0 = new Date(startIso).getTime()
              const tExclusiveEnd = new Date(endExclusiveIso).getTime()
              for (const d of deals) {
                const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
                if (!dealQualifiesForCalendar(d, v ?? null)) continue
                if (!d.event_start_at) continue
                const ts = new Date(d.event_start_at).getTime()
                if (ts < t0 || ts >= tExclusiveEnd) continue
                digestDeals.push(d)
              }
            }
            digestDeals.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
            const rows = digestDeals.map(d => {
              const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
              return buildGigCalendarTableRow(
                d,
                d.description?.trim() || 'Gig',
                v?.name?.trim() || '—',
              )
            })
            setPreviewHtml(buildBrandedGigCalendarEmail({
              kind: 'gig_calendar_digest_weekly',
              L: Lg,
              logoBaseUrl: siteG,
              ...gigShellP,
              digest: { rows },
            }))
          } else if (email.email_type === 'gig_day_summary_manual' && gigN?.kind === 'gig_day_summary_manual') {
            const ymdD = gigN.ymd
            const venuesD = inputs.venues as Venue[]
            const dealsD = inputs.deals as Deal[]
            const vmapD = new Map(venuesD.map(v => [v.id, v]))
            const startD = pacificWallToUtcIso(ymdD, '00:00')
            const endExclusiveD = pacificDayEndExclusiveUtcIso(ymdD)
            const dayDeals: Deal[] = []
            if (startD && endExclusiveD) {
              const t0d = new Date(startD).getTime()
              const tExclusiveD = new Date(endExclusiveD).getTime()
              for (const d of dealsD) {
                const v = d.venue ?? (d.venue_id ? vmapD.get(d.venue_id) : undefined)
                if (!dealQualifiesForCalendar(d, v ?? null)) continue
                if (!d.event_start_at) continue
                const ts = new Date(d.event_start_at).getTime()
                if (ts < t0d || ts >= tExclusiveD) continue
                dayDeals.push(d)
              }
            }
            dayDeals.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
            const rowsD = dayDeals.map(d => {
              const v = d.venue ?? (d.venue_id ? vmapD.get(d.venue_id) : undefined)
              return buildGigCalendarTableRow(
                d,
                d.description?.trim() || 'Gig',
                v?.name?.trim() || '—',
              )
            })
            const noonD = pacificWallToUtcIso(ymdD, '12:00')
            const dayLabelD = noonD
              ? new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'America/Los_Angeles',
              }).format(new Date(noonD))
              : ymdD
            setPreviewHtml(buildBrandedGigCalendarEmail({
              kind: 'gig_day_summary_manual',
              L: Lg,
              logoBaseUrl: siteG,
              ...gigShellP,
              daySummary: { dayLabel: dayLabelD, rows: rowsD },
            }))
          } else if (gigN?.kind === 'gig_reminder_24h' || gigN?.kind === 'gig_booked_ics') {
            const { data: dealRow } = await supabase
              .from('deals')
              .select('*')
              .eq('id', gigN.dealId)
              .eq('user_id', user.id)
              .maybeSingle()
            const deal = dealRow as Deal | null
            if (!deal?.event_start_at || !deal.event_end_at) {
              setPreviewHtml('<div style="padding:40px;color:#f87171;text-align:center;">Deal or show times missing.</div>')
            } else if (gigN.kind === 'gig_reminder_24h') {
              const { data: venueRow } = await supabase.from('venues').select('name').eq('id', deal.venue_id as string).maybeSingle()
              const vn = (venueRow as { name?: string } | null)?.name?.trim() || deal.description?.trim() || 'Show'
              setPreviewHtml(buildBrandedGigCalendarEmail({
                kind: 'gig_reminder_24h',
                L: Lg,
                logoBaseUrl: siteG,
                ...gigShellP,
                reminder: {
                  venueName: vn,
                  dealDescription: deal.description?.trim() || 'Gig',
                  whenLine: whenLineCompactFromDeal(deal),
                  setLine: performanceWindowCompactFromDeal(deal),
                },
              }))
            } else {
              const { data: venueRow } = await supabase
                .from('venues')
                .select('*')
                .eq('id', deal.venue_id as string)
                .eq('user_id', user.id)
                .maybeSingle()
              const venue = venueRow as Venue | null
              const { data: catRow } = await supabase
                .from('user_pricing_catalog')
                .select('doc')
                .eq('user_id', user.id)
                .maybeSingle()
              const catalog = catalogDocFromSupabaseRow(catRow?.doc ?? null)
              const middleSectionsHtml = buildGigBookedEmailMiddleHtml({ deal, venue, catalog })
              setPreviewHtml(buildBrandedGigCalendarEmail({
                kind: 'gig_booked_ics',
                L: Lg,
                logoBaseUrl: siteG,
                ...gigShellP,
                icsBody: { middleSectionsHtml },
              }))
            }
          } else {
            setPreviewHtml('<div style="padding:40px;color:#f87171;text-align:center;">Missing gig calendar queue payload.</div>')
          }
        } else {
          setPreviewHtml(`<div style="padding:40px;color:${EMAIL_HINT};text-align:center;">Preview not available for this email type.</div>`)
        }
        setPreviewLoading(false)
        return
      }

      if (email.email_type === 'performance_report_request') {
        const perfPayload = parsePerfFormQueueNotes(email.notes)
        if (!perfPayload) {
          setPreviewHtml('<div style="padding:40px;color:#f87171;text-align:center;">Missing performance form data on this row.</div>')
          setPreviewLoading(false)
          return
        }
        const { data: perfTmpl } = await supabase
          .from('email_templates')
          .select('custom_subject')
          .eq('user_id', user.id)
          .eq('email_type', 'performance_report_request')
          .maybeSingle()
        const subj = (perfTmpl?.custom_subject as string | null)?.trim()
          || `Quick check-in: How did the show go at ${perfPayload.venueName}?`
        setPreviewSubject(subj)
        const site = publicSiteOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')
        const formUrl = `${site}/performance-report/${perfPayload.token}`
        const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        const toe = esc(profile.artist_email ?? email.recipient_email)
        const ev = perfPayload.eventDate
          ? `<p style="margin:0 0 12px;color:${EMAIL_LABEL}">Show: ${esc(perfPayload.eventDate)}</p>` : ''
        setPreviewHtml(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e6e6e6;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:${EMAIL_FOOTER_MUTED};font-size:11px;margin:0 0 16px">Performance form · to <strong>${toe}</strong></p>`
          + `<p style="margin:0 0 8px">Venue: <strong>${esc(perfPayload.venueName)}</strong></p>`
          + ev
          + `<p style="margin:16px 0 8px;word-break:break-all"><a href="${formUrl}" style="color:#93c5fd">${esc(formUrl)}</a></p>`
          + `<p style="margin:0;color:${EMAIL_HINT};font-size:11px">Real send uses your template layout from Email templates.</p></div></body></html>`,
        )
        setPreviewLoading(false)
        return
      }

      let agreementUrl: string | null = email.deal?.agreement_url ?? null
      if (email.deal) {
        agreementUrl =
          (await resolveDealAgreementUrlForEmailPayload(
            async id => {
              const { data } = await supabase.from('generated_files').select('*').eq('id', id).maybeSingle()
              return (data as GeneratedFile | null) ?? null
            },
            email.deal,
            publicSiteOrigin()
          )) ?? agreementUrl
      }

      const dealForRender = email.deal ? {
        description: email.deal.description,
        gross_amount: email.deal.gross_amount,
        event_date: email.deal.event_date,
        payment_due_date: email.deal.payment_due_date,
        agreement_url: agreementUrl,
        notes: email.deal.notes,
      } : undefined

      const venueForRender = email.venue ? {
        name: email.venue.name,
        city: email.venue.city ?? null,
        location: email.venue.location ?? null,
      } : undefined

      const cid = parseCustomTemplateId(email.email_type)

      if (cid) {
        const { data: row } = await supabase
          .from('custom_email_templates')
          .select('subject_template, blocks, audience, attachment_generated_file_id')
          .eq('id', cid)
          .eq('user_id', user.id)
          .maybeSingle()

        if (!row) {
          setPreviewHtml(`<div style="padding:40px;color:${EMAIL_HINT};text-align:center;">Template not found</div>`)
          setPreviewLoading(false)
          return
        }

        const previewRecipient = row.audience === 'artist'
          ? { name: (profile.artist_name ?? '').split(/\s+/)[0] || 'Artist', email: email.recipient_email }
          : { name: email.contact?.name || email.recipient_email, email: email.recipient_email }

        let attachment: { url: string; fileName: string } | undefined
        if (row.attachment_generated_file_id) {
          const { data: gf } = await supabase
            .from('generated_files')
            .select('*')
            .eq('id', row.attachment_generated_file_id as string)
            .eq('user_id', user.id)
            .maybeSingle()
          const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
          if (att) attachment = att
        }

        const customCapKind =
          row.audience === 'venue' ? loadCustomEmailBlocksDoc(row.blocks).captureKind ?? null : null
        const customCapTok =
          row.audience === 'venue' ? parseEmailCaptureTokenFromNotes(email.notes) : null
        const customCaptureUrl =
          customCapTok && customCapKind && isVenueEmailOneTapAckKind(customCapKind)
            ? venueEmailAckPublicUrl(publicSiteOrigin(), customCapTok)
            : null

        const { html, subject } = buildCustomEmailDocument({
          audience: row.audience as 'venue' | 'artist',
          subjectTemplate: row.subject_template as string,
          blocksRaw: row.blocks,
          profile: profileForRender,
          recipient: previewRecipient,
          deal: dealForRender,
          venue: venueForRender ?? { name: '', city: null, location: null },
          logoBaseUrl: '',
          responsiveClasses: false,
          showReplyButton: row.audience === 'venue',
          ...(attachment ? { attachment } : {}),
          ...(customCaptureUrl && customCapKind
            ? { captureUrl: customCaptureUrl, captureCTALabel: captureLinkLabel(customCapKind) }
            : {}),
        })
        setPreviewHtml(html)
        setPreviewSubject(subject)
      } else {
        const recipientForRender = {
          name: email.contact?.name || email.recipient_email,
          email: email.recipient_email,
        }

        const { data: tmpl } = await supabase
          .from('email_templates')
          .select('custom_subject, custom_intro, layout')
          .eq('user_id', user.id)
          .eq('email_type', email.email_type)
          .maybeSingle()

        const layout = normalizeEmailTemplateLayout(tmpl?.layout ?? null)
        const invoiceUrl =
          email.email_type === 'invoice_sent'
            ? parseInvoiceQueueNotes(email.notes)?.url ?? null
            : null
        const capKind = venueEmailTypeToCaptureKind(email.email_type as VenueEmailType)
        const capTok = parseEmailCaptureTokenFromNotes(email.notes)
        const captureUrl =
          capTok && capKind && isVenueEmailOneTapAckKind(capKind)
            ? venueEmailAckPublicUrl(publicSiteOrigin(), capTok)
            : null
        const html = buildVenueEmailDocument({
          type: email.email_type as VenueRenderEmailType,
          profile: profileForRender,
          recipient: recipientForRender,
          deal: dealForRender,
          venue: venueForRender,
          customIntro: tmpl?.custom_intro as string | null ?? null,
          customSubject: tmpl?.custom_subject as string | null ?? null,
          layout,
          logoBaseUrl: '',
          responsiveClasses: false,
          invoiceUrl,
          captureUrl,
        })
        setPreviewHtml(html)
        setPreviewSubject(email.subject || '')
      }
    } catch (err) {
      console.error('[EmailQueue] preview error:', err)
      setPreviewHtml('<div style="padding:40px;color:#f87171;text-align:center;">Failed to load preview</div>')
    } finally {
      setPreviewLoading(false)
    }
  }, [profile])

  const handleSendNow = useCallback(async (email: VenueEmail) => {
    if (!profile?.from_email) {
      setSendError('Artist profile not configured. Set up your profile first.')
      return
    }

    setSendingId(email.id)
    setSendError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setSendError('Not signed in.')
        return
      }

      if (isQueuedBuiltinArtistEmailType(email.email_type)) {
        const inputs = await fetchReportInputsForUser(supabase, user.id)
        const profileForArtistSend = {
          artist_name: profile.artist_name,
          artist_email: profile.artist_email,
          manager_name: profile.manager_name,
          manager_title: profile.manager_title,
          manager_email: profile.manager_email,
          from_email: profile.from_email,
          company_name: profile.company_name,
          website: profile.website,
          social_handle: profile.social_handle,
          phone: profile.phone,
          reply_to_email: profile.reply_to_email,
        }

        const siteUrl = publicSiteOrigin() || (typeof window !== 'undefined' ? window.location.origin : '')

        const parseErr = async (res: Response) => {
          const text = await res.text()
          let msg = `Send failed (${res.status})`
          try {
            const err = JSON.parse(text) as { message?: string }
            if (err.message) msg = err.message
          } catch {
            if (text.trim()) msg = `${res.status}: ${text.slice(0, 240)}`
          }
          return msg
        }

        if (email.email_type === 'management_report') {
          const { start, end } = defaultQueuedManagementReportDateRange()
          const report = buildManagementReportData(inputs, start, end)
          const { data: tmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', 'management_report')
            .maybeSingle()
          const res = await fetch('/.netlify/functions/send-report', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: profileForArtistSend,
              report,
              dateRange: { start, end },
              cc: profile.manager_email ? [profile.manager_email] : [],
              custom_subject: tmpl?.custom_subject ?? null,
              custom_intro: tmpl?.custom_intro ?? null,
              layout: tmpl?.layout ?? null,
              user_id: user.id,
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
        } else if (email.email_type === 'retainer_reminder') {
          const { unpaidFees, totalOutstanding } = buildRetainerReminderPayload(inputs.fees)
          if (unpaidFees.length === 0) {
            throw new Error('No outstanding retainer balance')
          }
          const { data: tmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', 'retainer_reminder')
            .maybeSingle()
          const res = await fetch('/.netlify/functions/send-reminder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: profileForArtistSend,
              unpaidFees,
              totalOutstanding,
              custom_subject: tmpl?.custom_subject ?? null,
              custom_intro: tmpl?.custom_intro ?? null,
              layout: tmpl?.layout ?? null,
              user_id: user.id,
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
        } else if (email.email_type === 'retainer_received') {
          const { settledFees, totalAcknowledged } = buildRetainerReceivedPayload(inputs.fees)
          const { data: tmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', 'retainer_received')
            .maybeSingle()
          const res = await fetch('/.netlify/functions/send-retainer-received', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              profile: profileForArtistSend,
              settledFees,
              totalAcknowledged,
              custom_subject: tmpl?.custom_subject ?? null,
              custom_intro: tmpl?.custom_intro ?? null,
              layout: tmpl?.layout ?? null,
              user_id: user.id,
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
        } else if (email.email_type === 'performance_report_received') {
          const txn = parseArtistTxnQueueNotes(email.notes)
          if (!txn || txn.kind !== 'performance_report_received') {
            throw new Error('Missing artist transactional payload on this row.')
          }
          const { data: txTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', email.email_type)
            .maybeSingle()
          const res = await fetch('/.netlify/functions/send-artist-transactional', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              kind: 'performance_report_received',
              profile: profileForArtistSend,
              venueName: txn.venueName,
              eventDate: txn.eventDate,
              custom_subject: txTmpl?.custom_subject ?? null,
              custom_intro: txTmpl?.custom_intro ?? null,
              layout: txTmpl?.layout ?? null,
              user_id: user.id,
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
        } else if (
          email.email_type === 'gig_calendar_digest_weekly'
          || email.email_type === 'gig_reminder_24h'
          || email.email_type === 'gig_booked_ics'
          || email.email_type === 'gig_day_summary_manual'
        ) {
          if (!profile.artist_email?.trim()) throw new Error('Artist email not set in profile.')
          const gigN = parseGigCalendarQueueNotes(email.notes)
          const { data: gcTmpl } = await supabase
            .from('email_templates')
            .select('custom_subject, custom_intro, layout')
            .eq('user_id', user.id)
            .eq('email_type', email.email_type)
            .maybeSingle()
          const Lsend = artistLayoutForSend(gcTmpl?.layout ?? null, gcTmpl?.custom_subject ?? null, gcTmpl?.custom_intro ?? null)
          const subj = Lsend.subject?.trim() || email.subject
          const sendProfile = {
            artist_name: profileForArtistSend.artist_name ?? '',
            from_email: profileForArtistSend.from_email,
            reply_to_email: profileForArtistSend.reply_to_email,
            manager_email: profileForArtistSend.manager_email,
          }
          const shellQ = {
            artistName: profileForArtistSend.artist_name ?? '',
            managerName: profileForArtistSend.manager_name?.trim() || 'Management',
            managerTitle: profileForArtistSend.manager_title ?? null,
            website: profileForArtistSend.website ?? null,
            social_handle: profileForArtistSend.social_handle ?? null,
            phone: profileForArtistSend.phone ?? null,
          }
          if (email.email_type === 'gig_calendar_digest_weekly' && gigN?.kind === 'gig_calendar_digest_weekly') {
            const venues = inputs.venues as Venue[]
            const deals = inputs.deals as Deal[]
            const vmap = new Map(venues.map(v => [v.id, v]))
            const startIso = pacificWallToUtcIso(gigN.weekStart, '00:00')
            const endDay = addCalendarDaysPacific(gigN.weekStart, 14)
            const endExclusiveIso = pacificDayEndExclusiveUtcIso(endDay)
            if (!startIso || !endExclusiveIso) throw new Error('Invalid digest window')
            const t0 = new Date(startIso).getTime()
            const tExclusiveEnd = new Date(endExclusiveIso).getTime()
            const digestDealsQ: Deal[] = []
            for (const d of deals) {
              const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
              if (!dealQualifiesForCalendar(d, v ?? null)) continue
              if (!d.event_start_at) continue
              const ts = new Date(d.event_start_at).getTime()
              if (ts < t0 || ts >= tExclusiveEnd) continue
              digestDealsQ.push(d)
            }
            digestDealsQ.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
            const rows = digestDealsQ.map(d => {
              const v = d.venue ?? (d.venue_id ? vmap.get(d.venue_id) : undefined)
              return buildGigCalendarTableRow(
                d,
                d.description?.trim() || 'Gig',
                v?.name?.trim() || '—',
              )
            })
            const html = buildBrandedGigCalendarEmail({
              kind: 'gig_calendar_digest_weekly',
              L: Lsend,
              logoBaseUrl: siteUrl,
              ...shellQ,
              digest: { rows },
            })
            const res = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind: 'gig_calendar_digest_weekly',
                profile: sendProfile,
                to: profile.artist_email.trim(),
                subject: subj,
                html,
                user_id: user.id,
              }),
            })
            if (!res.ok) throw new Error(await parseErr(res))
          } else if (email.email_type === 'gig_day_summary_manual' && gigN?.kind === 'gig_day_summary_manual') {
            const ymdS = gigN.ymd
            const venuesS = inputs.venues as Venue[]
            const dealsS = inputs.deals as Deal[]
            const vmapS = new Map(venuesS.map(v => [v.id, v]))
            const startS = pacificWallToUtcIso(ymdS, '00:00')
            const endExclusiveS = pacificDayEndExclusiveUtcIso(ymdS)
            if (!startS || !endExclusiveS) throw new Error('Invalid day summary date')
            const t0s = new Date(startS).getTime()
            const tExclusiveS = new Date(endExclusiveS).getTime()
            const dayDealsS: Deal[] = []
            for (const d of dealsS) {
              const v = d.venue ?? (d.venue_id ? vmapS.get(d.venue_id) : undefined)
              if (!dealQualifiesForCalendar(d, v ?? null)) continue
              if (!d.event_start_at) continue
              const ts = new Date(d.event_start_at).getTime()
              if (ts < t0s || ts >= tExclusiveS) continue
              dayDealsS.push(d)
            }
            dayDealsS.sort((a, b) => String(a.event_start_at).localeCompare(String(b.event_start_at)))
            const rowsS = dayDealsS.map(d => {
              const v = d.venue ?? (d.venue_id ? vmapS.get(d.venue_id) : undefined)
              return buildGigCalendarTableRow(
                d,
                d.description?.trim() || 'Gig',
                v?.name?.trim() || '—',
              )
            })
            const noonS = pacificWallToUtcIso(ymdS, '12:00')
            const dayLabelS = noonS
              ? new Intl.DateTimeFormat('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'America/Los_Angeles',
              }).format(new Date(noonS))
              : ymdS
            const html = buildBrandedGigCalendarEmail({
              kind: 'gig_day_summary_manual',
              L: Lsend,
              logoBaseUrl: siteUrl,
              ...shellQ,
              daySummary: { dayLabel: dayLabelS, rows: rowsS },
            })
            const res = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kind: 'gig_day_summary_manual',
                profile: sendProfile,
                to: profile.artist_email.trim(),
                subject: subj,
                html,
                user_id: user.id,
              }),
            })
            if (!res.ok) throw new Error(await parseErr(res))
          } else if (gigN?.kind === 'gig_reminder_24h' || gigN?.kind === 'gig_booked_ics') {
            const { data: dealRow } = await supabase
              .from('deals')
              .select('*')
              .eq('id', gigN.dealId)
              .eq('user_id', user.id)
              .maybeSingle()
            const deal = dealRow as Deal | null
            if (!deal?.event_start_at || !deal.event_end_at) throw new Error('Deal or show times missing.')
            if (gigN.kind === 'gig_reminder_24h' && !shouldSendGigReminderNow(Date.now(), deal.event_start_at)) {
              throw new Error(
                'This 24h reminder is not due yet — it is sent automatically about one day before show time.',
              )
            }
            const { data: venueRow } = await supabase
              .from('venues')
              .select('*')
              .eq('id', deal.venue_id as string)
              .eq('user_id', user.id)
              .maybeSingle()
            const venue = venueRow as Venue | null
            if (gigN.kind === 'gig_reminder_24h') {
              const venueName = venue?.name?.trim() || deal.description?.trim() || 'Show'
              const html = buildBrandedGigCalendarEmail({
                kind: 'gig_reminder_24h',
                L: Lsend,
                logoBaseUrl: siteUrl,
                ...shellQ,
                reminder: {
                  venueName,
                  dealDescription: deal.description?.trim() || 'Gig',
                  whenLine: whenLineCompactFromDeal(deal),
                  setLine: performanceWindowCompactFromDeal(deal),
                },
              })
              const res = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  kind: 'gig_reminder_24h',
                  profile: sendProfile,
                  to: profile.artist_email.trim(),
                  subject: subj,
                  html,
                  showStartIso: deal.event_start_at,
                  user_id: user.id,
                }),
              })
              if (!res.ok) throw new Error(await parseErr(res))
            } else {
              const { data: catRow } = await supabase
                .from('user_pricing_catalog')
                .select('doc')
                .eq('user_id', user.id)
                .maybeSingle()
              const catalog = catalogDocFromSupabaseRow(catRow?.doc ?? null)
              const middleSectionsHtml = buildGigBookedEmailMiddleHtml({
                deal,
                venue,
                catalog,
              })
              const html = buildBrandedGigCalendarEmail({
                kind: 'gig_booked_ics',
                L: Lsend,
                logoBaseUrl: siteUrl,
                ...shellQ,
                icsBody: { middleSectionsHtml },
              })
              const res = await fetch(`${siteUrl}/.netlify/functions/send-artist-gig-calendar-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  kind: 'gig_booked_ics',
                  profile: sendProfile,
                  to: profile.artist_email.trim(),
                  subject: subj,
                  html,
                  user_id: user.id,
                }),
              })
              if (!res.ok) throw new Error(await parseErr(res))
              if (!deal.ics_invite_sent_at) {
                await supabase
                  .from('deals')
                  .update({ ics_invite_sent_at: new Date().toISOString() })
                  .eq('id', deal.id)
              }
            }
          } else {
            throw new Error('Missing gig calendar queue payload.')
          }
        } else {
          throw new Error('Unsupported built-in artist email type.')
        }

        await updateEmailStatus(email.id, 'sent')
        return
      }

      if (email.email_type === 'performance_report_request') {
        const perfPayload = parsePerfFormQueueNotes(email.notes)
        if (!perfPayload?.token) throw new Error('Missing performance form data on this row.')
        if (!profile.artist_email) throw new Error('Artist email not set in profile.')
        const { data: perfTmpl } = await supabase
          .from('email_templates')
          .select('custom_subject, custom_intro, layout')
          .eq('user_id', user.id)
          .eq('email_type', 'performance_report_request')
          .maybeSingle()
        const res = await fetch('/.netlify/functions/send-performance-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: perfPayload.token,
            venueName: perfPayload.venueName,
            eventDate: perfPayload.eventDate,
            artistName: profile.artist_name ?? '',
            artistEmail: profile.artist_email,
            fromEmail: profile.from_email,
            replyToEmail: profile.reply_to_email || profile.from_email,
            managerName: profile.manager_name || 'Your Manager',
            managerTitle: profile.manager_title ?? null,
            website: profile.website ?? null,
            social_handle: profile.social_handle ?? null,
            phone: profile.phone ?? null,
            custom_subject: perfTmpl?.custom_subject ?? null,
            custom_intro: perfTmpl?.custom_intro ?? null,
            layout: perfTmpl?.layout ?? null,
            user_id: user.id,
          }),
        })
        if (!res.ok) {
          const text = await res.text()
          let msg = `Send failed (${res.status})`
          try {
            const err = JSON.parse(text) as { message?: string }
            if (err.message) msg = err.message
          } catch {
            if (text.trim()) msg = text.slice(0, 240)
          }
          throw new Error(msg)
        }
        await updateEmailStatus(email.id, 'sent', {
          notes: formatOutboundEmailNotes('email_queue_send_now', 'Performance form email'),
        })
        return
      }

      const profilePayload = {
        artist_name: profile.artist_name,
        company_name: profile.company_name,
        from_email: profile.from_email,
        reply_to_email: profile.reply_to_email,
        artist_email: profile.artist_email ?? null,
        manager_email: profile.manager_email ?? null,
        manager_name: profile.manager_name ?? null,
        manager_title: profile.manager_title ?? null,
        website: profile.website,
        phone: profile.phone,
        social_handle: profile.social_handle,
        tagline: profile.tagline,
      }

      let agreementUrl: string | null = email.deal?.agreement_url ?? null
      if (email.deal) {
        agreementUrl =
          (await resolveDealAgreementUrlForEmailPayload(
            async id => {
              const { data } = await supabase.from('generated_files').select('*').eq('id', id).maybeSingle()
              return (data as GeneratedFile | null) ?? null
            },
            email.deal,
            publicSiteOrigin()
          )) ?? agreementUrl
      }

      const dealPayload = email.deal ? {
        deal: {
          description: email.deal.description,
          gross_amount: email.deal.gross_amount,
          event_date: email.deal.event_date,
          payment_due_date: email.deal.payment_due_date,
          agreement_url: agreementUrl,
          notes: email.deal.notes,
        },
      } : {}

      const venuePayload = email.venue ? {
        venue: {
          name: email.venue.name,
          city: email.venue.city ?? null,
          location: email.venue.location ?? null,
        },
      } : {}

      const recipientPayload = {
        name: email.contact?.name || email.recipient_email,
        email: email.recipient_email,
      }

      const payload: Record<string, unknown> = {
        profile: profilePayload,
        recipient: recipientPayload,
        ...dealPayload,
        ...venuePayload,
      }

      const sendPath = '/.netlify/functions/send-venue-email'

      const cid = parseCustomTemplateId(email.email_type)
      if (cid) {
        const { data: row } = await supabase
          .from('custom_email_templates')
          .select('subject_template, blocks, audience, attachment_generated_file_id')
          .eq('id', cid)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!row) {
          throw new Error('Custom template not found')
        }
        if (row.audience === 'artist') {
          payload.custom_artist_template = {
            subject_template: row.subject_template,
            blocks: row.blocks,
          }
          payload.recipient = {
            name: (profile.artist_name ?? '').split(/\s+/)[0] || profile.artist_name || 'Artist',
            email: email.recipient_email,
          }
          if (!email.venue) {
            payload.venue = { name: '', city: null, location: null }
          }
        } else if (row.audience === 'venue') {
          payload.custom_venue_template = {
            subject_template: row.subject_template,
            blocks: row.blocks,
          }
          const capKind = loadCustomEmailBlocksDoc(row.blocks).captureKind ?? null
          if (capKind) {
            const capUrl = await ensureQueueCaptureUrl(
              supabase,
              {
                id: email.id,
                user_id: user.id,
                venue_id: email.venue_id ?? null,
                deal_id: email.deal_id ?? null,
                contact_id: email.contact_id ?? null,
                email_type: email.email_type,
                notes: email.notes ?? null,
              },
              publicSiteOrigin(),
              capKind,
            )
            if (capUrl) payload.capture_url = capUrl
          }
        } else {
          throw new Error('Custom template not found')
        }
        const aid = row.attachment_generated_file_id as string | null | undefined
        if (aid) {
          const { data: gf } = await supabase
            .from('generated_files')
            .select('*')
            .eq('id', aid)
            .eq('user_id', user.id)
            .maybeSingle()
          const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
          if (att) payload.attachment = att
        }
      } else {
        payload.type = email.email_type
        const { data: tmpl } = await supabase
          .from('email_templates')
          .select('custom_subject, custom_intro, layout')
          .eq('user_id', user.id)
          .eq('email_type', email.email_type)
          .maybeSingle()
        if (tmpl) {
          payload.custom_subject = tmpl.custom_subject
          payload.custom_intro = tmpl.custom_intro
          payload.layout = tmpl.layout
        }
        if (email.email_type === 'invoice_sent') {
          const inv = parseInvoiceQueueNotes(email.notes)
          if (inv?.url) payload.invoice_url = inv.url
        }
        const capUrl = await ensureQueueCaptureUrl(
          supabase,
          {
            id: email.id,
            user_id: user.id,
            venue_id: email.venue_id ?? null,
            deal_id: email.deal_id ?? null,
            contact_id: email.contact_id ?? null,
            email_type: email.email_type,
            notes: email.notes ?? null,
          },
          publicSiteOrigin(),
        )
        if (capUrl) payload.capture_url = capUrl
      }

      payload.user_id = user.id

      const res = await fetch(sendPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text()
        let msg = `Send failed (${res.status})`
        try {
          const err = JSON.parse(text) as { message?: string }
          if (err.message) msg = err.message
        } catch {
          if (text.trim()) msg = `${res.status}: ${text.slice(0, 240)}`
        }
        throw new Error(msg)
      }

      await updateEmailStatus(email.id, 'sent')
    } catch (err) {
      setSendError(err instanceof Error ? err.message : 'Failed to send email')
    } finally {
      setSendingId(null)
    }
  }, [profile, updateEmailStatus])

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-2 border-b border-neutral-800">
        <div className="flex gap-1 flex-1 min-w-[12rem]">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
              'px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'queue'
                ? 'border-neutral-300 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            Queue
            {pendingEmails.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center min-w-[1rem] h-4 px-1 text-[10px] font-bold bg-neutral-700 text-neutral-200 rounded-full">
                {pendingEmails.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'history'
                ? 'border-neutral-300 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            History
          </button>
        </div>

        <TooltipProvider delayDuration={200}>
          <div className="flex items-center gap-2 shrink-0 pb-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-neutral-500 hover:text-neutral-300"
                  aria-label="About the queue and history"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="bottom"
                align="end"
                sideOffset={6}
                className="max-w-[min(20rem,calc(100vw-2rem))] border border-neutral-700 bg-neutral-950 px-3 py-2.5 text-[11px] font-normal leading-relaxed text-neutral-400 shadow-xl"
              >
                <p className="font-medium text-neutral-200 mb-1.5">About the queue</p>
                <ul className="list-disc pl-4 space-y-1 text-left">
                  <li>
                    <span className="text-neutral-300">Venue delay</span> (minutes after a row is queued) lives in{' '}
                    <span className="text-neutral-300">Settings</span> and applies only to{' '}
                    <span className="text-neutral-400">venue-targeted</span> queued emails. Gig reminders, ICS, weekly digest, artist automations, and similar types send on the{' '}
                    <span className="text-neutral-400">next queue run</span> or at their{' '}
                    <span className="text-neutral-400">scheduled</span> time—not that delay.
                  </li>
                  <li>
                    <span className="text-neutral-300">Active queue</span> lists pending rows that can go out soon (next run, venue buffer, or past their scheduled time).{' '}
                    <span className="text-neutral-300">Scheduled</span> lists rows whose <span className="text-neutral-400">send time is still in the future</span>.
                  </li>
                  <li>
                    <span className="text-neutral-300">Send now</span> only works when the server allows it—some scheduled types block until their window.
                  </li>
                  <li>
                    <span className="text-neutral-300">History</span> includes cron-sent rows, Send now from here, pipeline &quot;Send email&quot; modal (logged immediately), and Reports / Earnings sends.
                  </li>
                  <li>
                    Reports, Earnings, and Performance reports &quot;send form&quot; from their pages deliver immediately—they do not add a pending row unless you use task automation (performance form queues through Email queue when a task completes).
                  </li>
                </ul>
              </TooltipContent>
            </Tooltip>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              title="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
            </Button>
          </div>
        </TooltipProvider>
      </div>

      {sendError && (
        <div className="px-3 py-2 rounded-lg bg-red-950 border border-red-800 text-xs text-red-400">
          {sendError}
        </div>
      )}

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            </div>
          ) : pendingEmails.length === 0 ? (
            <EmptyState message="No emails queued. Pending rows from tasks and outreach appear here. Artist custom templates and zero-buffer types send on the next queue run." />
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-neutral-900/80 border border-neutral-800">
                <button
                  type="button"
                  onClick={() => setQueueSubTab('immediate')}
                  className={cn(
                    'flex-1 min-w-[9rem] px-3 py-2 text-xs font-medium rounded-md transition-colors',
                    queueSubTab === 'immediate'
                      ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent',
                  )}
                >
                  Active queue
                  <span className="ml-1.5 tabular-nums text-neutral-500">({pendingImmediate.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setQueueSubTab('scheduled')}
                  className={cn(
                    'flex-1 min-w-[9rem] px-3 py-2 text-xs font-medium rounded-md transition-colors',
                    queueSubTab === 'scheduled'
                      ? 'bg-neutral-800 text-neutral-100 border border-neutral-700'
                      : 'text-neutral-500 hover:text-neutral-300 border border-transparent',
                  )}
                >
                  Scheduled
                  <span className="ml-1.5 tabular-nums text-neutral-500">({pendingScheduled.length})</span>
                </button>
              </div>

              {displayedPending.length === 0 ? (
                <EmptyState
                  message={
                    queueSubTab === 'scheduled'
                      ? 'No emails scheduled for a future send time. Timed reminders and similar sends appear here when their scheduled time is still ahead.'
                      : pendingScheduled.length > 0
                        ? 'Nothing queued to send soon. Check the Scheduled tab for emails waiting on a future send time.'
                        : 'No emails in this view.'
                  }
                />
              ) : (
                <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                    <p className="text-xs font-medium text-neutral-500">
                      {displayedPending.length}{' '}
                      {queueSubTab === 'scheduled' ? 'scheduled' : 'active'} pending email
                      {displayedPending.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {displayedPending.map(email => (
                    <PendingRow
                      key={email.id}
                      email={email}
                      bufferMinutes={effectiveQueueBufferMinutes(email, bufferMinutes)}
                      onSendNow={handleSendNow}
                      onDismiss={handleDismiss}
                      onPreview={handlePreview}
                      sending={sendingId === email.id}
                      dismissing={dismissingId === email.id}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* History tab */}
      {activeTab === 'history' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            </div>
          ) : sentEmails.length === 0 ? (
            <EmptyState message="No emails sent yet. Sent and failed emails will appear here." />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                <p className="text-xs font-medium text-neutral-500">
                  {sentEmails.length} email{sentEmails.length !== 1 ? 's' : ''} in history
                </p>
              </div>
              {sentEmails.map(email => (
                <HistoryRow key={email.id} email={email} onPreview={handlePreview} />
              ))}
            </div>
          )}
          {recentCaptures.length > 0 && (
            <div className="mt-5 bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                <p className="text-xs font-medium text-neutral-500">Recent venue form responses</p>
              </div>
              <ul className="divide-y divide-neutral-800">
                {recentCaptures.map(row => {
                  const label = isEmailCaptureKind(row.kind)
                    ? EMAIL_CAPTURE_KIND_LABELS[row.kind]
                    : row.kind
                  const vname = row.venue?.name ?? 'Venue'
                  return (
                    <li key={row.id} className="px-4 py-3 text-sm">
                      <span className="text-neutral-300">{vname}</span>
                      <span className="text-neutral-600 mx-2">·</span>
                      <span className="text-neutral-400">{label}</span>
                      <span className="block text-[10px] text-neutral-600 mt-1">
                        {fmtDate(row.consumed_at)}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </>
      )}

      {/* Preview dialog */}
      <Dialog open={previewHtml !== null || previewLoading} onOpenChange={v => { if (!v) { setPreviewHtml(null); setPreviewSubject('') } }}>
        <DialogContent className="max-w-2xl h-[85vh] flex flex-col p-0 gap-0 bg-neutral-950 border-neutral-800">
          <DialogHeader className="px-5 pt-4 pb-3 border-b border-neutral-800 shrink-0">
            <DialogTitle className="text-sm font-medium text-neutral-200 truncate">
              {previewSubject || 'Email Preview'}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-hidden">
            {previewLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
              </div>
            ) : previewHtml ? (
              <iframe
                srcDoc={previewHtml}
                title="Email preview"
                className="w-full h-full border-0"
                sandbox="allow-same-origin"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
