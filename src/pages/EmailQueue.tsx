import { useState, useEffect, useCallback } from 'react'
import { MailOpen, Send, X, Clock, CheckCircle, XCircle, RefreshCw, Zap, Eye } from 'lucide-react'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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
import { buildCustomEmailDocument } from '@/lib/email/renderCustomEmail'
import { buildVenueEmailDocument } from '@/lib/email/renderVenueEmail'
import { normalizeEmailTemplateLayout } from '@/lib/emailLayout'
import {
  EMAIL_QUEUE_BUFFER_OPTIONS,
  clampEmailQueueBufferMinutes,
  DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES,
  type EmailQueueBufferMinutes,
} from '@/lib/emailQueueBuffer'
import { isQueuedBuiltinArtistEmailType, isQueueBufferZeroEmailType } from '@/lib/email/queuedBuiltinArtistEmail'
import { parsePerfFormQueueNotes } from '@/lib/email/performanceFormQueuePayload'
import { formatOutboundEmailNotes } from '@/lib/email/recordOutboundEmail'
import { fetchReportInputsForUser } from '@/lib/reports/fetchReportInputsForUser'
import {
  buildManagementReportData,
  buildRetainerReceivedPayload,
  buildRetainerReminderPayload,
  defaultQueuedManagementReportDateRange,
} from '@/lib/reports/buildManagementReportData'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function getMinutesUntilSend(createdAt: string, bufferMinutes: number): number {
  const sendAt = new Date(createdAt).getTime() + bufferMinutes * 60 * 1000
  return Math.max(0, Math.ceil((sendAt - Date.now()) / 60000))
}

function pendingNotesLine(email: VenueEmail): string | null {
  if (email.email_type === 'performance_report_request') {
    const p = parsePerfFormQueueNotes(email.notes)
    if (p) {
      const when = p.eventDate ? ` · show ${p.eventDate}` : ''
      return `Performance form · ${p.venueName}${when}`
    }
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

function CountdownBadge({ createdAt, bufferMinutes }: { createdAt: string; bufferMinutes: number }) {
  const [minsLeft, setMinsLeft] = useState(() => getMinutesUntilSend(createdAt, bufferMinutes))

  useEffect(() => {
    const tick = () => setMinsLeft(getMinutesUntilSend(createdAt, bufferMinutes))
    const id = setInterval(tick, 30000)
    tick()
    return () => clearInterval(id)
  }, [createdAt, bufferMinutes])

  if (minsLeft <= 0) return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400">
      <Zap className="h-2.5 w-2.5" />Sending soon…
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
          <CountdownBadge createdAt={email.created_at} bufferMinutes={bufferMinutes} />
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

export default function EmailQueue() {
  const { pendingEmails, sentEmails, loading, refetch, dismissQueued, updateEmailStatus } = useVenueEmails()
  const { profile, updateProfile } = useArtistProfile()
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [bufferSaving, setBufferSaving] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState<string>('')
  const [previewLoading, setPreviewLoading] = useState(false)

  const bufferMinutes = profile
    ? clampEmailQueueBufferMinutes(profile.email_queue_buffer_minutes)
    : DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES

  const handleBufferChange = async (value: string) => {
    const n = parseInt(value, 10) as EmailQueueBufferMinutes
    if (!EMAIL_QUEUE_BUFFER_OPTIONS.includes(n)) return
    setBufferSaving(true)
    const { error } = await updateProfile({ email_queue_buffer_minutes: n })
    if (error) {
      const msg = error instanceof Error
        ? error.message
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : 'Could not save delay setting'
      setSendError(msg)
    }
    else setSendError(null)
    setBufferSaving(false)
  }

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
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e5e5e5;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:#888;font-size:11px;margin:0 0 16px">Summary preview (rolling 7 days through today) · sent to <strong>${toe}</strong></p>`
            + `<p style="margin:0 0 12px"><strong>Outreach</strong><br/>`
            + `New venues: ${report.outreach.venuesContacted} · Engaged: ${report.outreach.venuesUpdated} · In discussion: ${report.outreach.inDiscussion} · Booked: ${report.outreach.venuesBooked}</p>`
            + `<p style="margin:0 0 12px"><strong>Deals</strong><br/>`
            + `New: ${report.deals.count} · Gross: ${report.deals.totalGross.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · Commission owed to management: ${report.deals.allOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + `<p style="margin:0 0 12px"><strong>Retainer</strong><br/>`
            + `Outstanding: ${report.retainer.feeOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + `<p style="margin:0;color:#666;font-size:11px">Layout matches Reports → Send management update.</p></div></body></html>`,
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
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e5e5e5;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:#888;font-size:11px;margin:0 0 16px">Retainer reminder preview · total outstanding ${totalOutstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>`
            + rows
            + `<p style="margin:16px 0 0;color:#666;font-size:11px">Layout matches Earnings → Send reminder.</p></div></body></html>`,
          )
        } else {
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
            `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e5e5e5;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
            + `<div style="padding:24px;max-width:560px;margin:0 auto">`
            + `<p style="color:#888;font-size:11px;margin:0 0 16px">Retainer received preview · total acknowledged ${totalAcknowledged.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} · sent to <strong>${toe}</strong></p>`
            + rows
            + `<p style="margin:16px 0 0;color:#666;font-size:11px">Layout matches Email templates → Retainer payment received.</p></div></body></html>`,
          )
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
          ? `<p style="margin:0 0 12px;color:#a3a3a3">Show: ${esc(perfPayload.eventDate)}</p>` : ''
        setPreviewHtml(
          `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="margin:0;background:#0d0d0d;color:#e5e5e5;font-family:system-ui,sans-serif;font-size:13px;line-height:1.5">`
          + `<div style="padding:24px;max-width:560px;margin:0 auto">`
          + `<p style="color:#888;font-size:11px;margin:0 0 16px">Performance form · to <strong>${toe}</strong></p>`
          + `<p style="margin:0 0 8px">Venue: <strong>${esc(perfPayload.venueName)}</strong></p>`
          + ev
          + `<p style="margin:16px 0 8px;word-break:break-all"><a href="${formUrl}" style="color:#93c5fd">${esc(formUrl)}</a></p>`
          + `<p style="margin:0;color:#666;font-size:11px">Real send uses your template layout from Email templates.</p></div></body></html>`,
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
          setPreviewHtml('<div style="padding:40px;color:#888;text-align:center;">Template not found</div>')
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
        const html = buildVenueEmailDocument({
          type: email.email_type as 'booking_confirmation',
          profile: profileForRender,
          recipient: recipientForRender,
          deal: dealForRender,
          venue: venueForRender,
          customIntro: tmpl?.custom_intro as string | null ?? null,
          customSubject: tmpl?.custom_subject as string | null ?? null,
          layout,
          logoBaseUrl: '',
          responsiveClasses: false,
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
          manager_email: profile.manager_email,
          from_email: profile.from_email,
          company_name: profile.company_name,
          website: profile.website,
          social_handle: profile.social_handle,
          phone: profile.phone,
          reply_to_email: profile.reply_to_email,
        }

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
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
        } else {
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
            }),
          })
          if (!res.ok) throw new Error(await parseErr(res))
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
            custom_subject: perfTmpl?.custom_subject ?? null,
            custom_intro: perfTmpl?.custom_intro ?? null,
            layout: perfTmpl?.layout ?? null,
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
      }

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

        <div className="flex items-center gap-2 shrink-0 pb-1">
          {activeTab === 'queue' && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-neutral-500 whitespace-nowrap max-[420px]:hidden">
                Auto-send
              </span>
              <Select
                value={String(bufferMinutes)}
                onValueChange={handleBufferChange}
                disabled={bufferSaving || !profile}
              >
                <SelectTrigger
                  className="w-[108px] sm:w-[118px] h-8 text-xs bg-neutral-950 border-neutral-700"
                  aria-label="Auto-send after queued (minutes)"
                  title="Minutes after queue before auto-send"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_QUEUE_BUFFER_OPTIONS.map(m => (
                    <SelectItem key={m} value={String(m)} className="text-xs">
                      {m} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
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
      </div>

      {sendError && (
        <div className="px-3 py-2 rounded-lg bg-red-950 border border-red-800 text-xs text-red-400">
          {sendError}
        </div>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-950/60 px-3 py-2.5 text-[11px] text-neutral-500 leading-relaxed">
        <p className="font-medium text-neutral-400 mb-1.5">About the queue</p>
        <ul className="list-disc pl-4 space-y-1">
          <li>
            <span className="text-neutral-400">Queue</span> is for delayed <code className="text-neutral-600">pending</code> sends.
            Management report, retainer reminder, and performance form requests send on the next worker run (no minute buffer), or use Send now.
          </li>
          <li>
            <span className="text-neutral-400">History</span> includes cron-sent rows, Send now from here, pipeline &quot;Send email&quot; modal (logged immediately), and Reports / Earnings sends.
          </li>
          <li>
            Reports, Earnings, and Performance reports &quot;send form&quot; from their pages deliver immediately—they do not add a pending row unless you use task automation (performance form queues through Email queue when a task completes).
          </li>
        </ul>
      </div>

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
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                <p className="text-xs font-medium text-neutral-500">
                  {pendingEmails.length} pending email{pendingEmails.length !== 1 ? 's' : ''}
                </p>
              </div>
              {pendingEmails.map(email => (
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
