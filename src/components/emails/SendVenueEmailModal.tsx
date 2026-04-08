import { useState, useEffect } from 'react'
import { Send, Mail } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { useCustomEmailTemplates } from '@/hooks/useCustomEmailTemplates'
import { customEmailTypeValue, isCustomEmailType } from '@/lib/email/customTemplateId'
import { supabase } from '@/lib/supabase'
import { publicSiteOrigin } from '@/lib/files/pdfShareUrl'
import { buildEmailAttachmentPayloadFromFile } from '@/lib/files/templateEmailAttachmentPayload'
import { resolveDealAgreementUrlForEmailPayload } from '@/lib/resolveAgreementUrl'
import type { Deal, GeneratedFile, Venue, VenueEmailType } from '@/types'
import { recordOutboundEmail } from '@/lib/email/recordOutboundEmail'
import { venueEmailTypeToCaptureKind, EMAIL_CAPTURE_KIND_LABELS, type EmailCaptureKind } from '@/lib/emailCapture/kinds'
import { appendEmailCaptureTokenNote } from '@/lib/emailCapture/tokenNotes'
import { defaultEmailCaptureExpiresAt } from '@/lib/emailCapture/expiry'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

const CUSTOM_CAPTURE_KIND_OPTIONS: { value: EmailCaptureKind; label: string }[] = [
  { value: 'first_outreach',              label: EMAIL_CAPTURE_KIND_LABELS.first_outreach },
  { value: 'follow_up',                   label: EMAIL_CAPTURE_KIND_LABELS.follow_up },
  { value: 'booking_confirmation',        label: EMAIL_CAPTURE_KIND_LABELS.booking_confirmation },
  { value: 'pre_event_checkin',           label: EMAIL_CAPTURE_KIND_LABELS.pre_event_checkin },
  { value: 'payment_reminder_ack',        label: EMAIL_CAPTURE_KIND_LABELS.payment_reminder_ack },
  { value: 'payment_receipt',             label: EMAIL_CAPTURE_KIND_LABELS.payment_receipt },
  { value: 'post_show_thanks',            label: EMAIL_CAPTURE_KIND_LABELS.post_show_thanks },
  { value: 'rebooking_inquiry',           label: EMAIL_CAPTURE_KIND_LABELS.rebooking_inquiry },
  { value: 'show_cancelled_or_postponed', label: EMAIL_CAPTURE_KIND_LABELS.show_cancelled_or_postponed },
  { value: 'invoice_sent',               label: EMAIL_CAPTURE_KIND_LABELS.invoice_sent },
]

interface SendVenueEmailModalProps {
  open: boolean
  onClose: () => void
  onSent?: () => void
  defaultType?: VenueEmailType | string
  deal?: Deal | null
  venue?: Pick<Venue, 'id' | 'name' | 'city' | 'location'> | null
  recipientEmail?: string
  recipientName?: string
  venueId?: string | null
  dealId?: string | null
  contactId?: string | null
}

const EMAIL_TYPE_OPTIONS: VenueEmailType[] = [
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

function getDefaultType(deal?: Deal | null): VenueEmailType {
  if (!deal) return 'follow_up'
  if (deal.agreement_url?.trim() || deal.agreement_generated_file_id) return 'agreement_ready'
  const today = new Date().toISOString().split('T')[0]
  if (deal.payment_due_date && deal.payment_due_date < today && !deal.artist_paid) return 'payment_reminder'
  if (deal.artist_paid) return 'payment_receipt'
  return 'booking_confirmation'
}

function getTypeDescription(type: VenueEmailType, deal?: Deal | null, venueName?: string): string {
  const venue = venueName || 'the venue'
  switch (type) {
    case 'booking_confirmation':
      return `Confirms the booking with ${venue}: event date, agreed amount, and next steps including agreement.`
    case 'agreement_ready':
      return `Notifies ${venue} that the agreement is ready for review${
        deal?.agreement_url?.trim() || deal?.agreement_generated_file_id ? ' and includes the link' : ''
      }.`
    case 'payment_reminder':
      return `A friendly reminder to ${venue} about the outstanding payment${deal?.payment_due_date ? ` due on ${deal.payment_due_date}` : ''}.`
    case 'payment_receipt':
      return `Confirms to ${venue} that payment has been received. Thank you message.`
    case 'follow_up':
      return `A soft check-in to ${venue} about the potential booking. No pressure, just keeping the conversation going.`
    case 'rebooking_inquiry':
      return `Reaches out to ${venue} about booking again based on a positive post-show report.`
    case 'first_outreach':
      return `Introduces the artist and opens a first conversation with ${venue} about a potential booking.`
    case 'pre_event_checkin':
      return `As ${venue} approaches the event date: logistics, settlement, and day-of contact.`
    case 'post_show_thanks':
      return `Thanks ${venue} for hosting the show without pushing a rebook hard.`
    case 'agreement_followup':
      return `Short nudge to ${venue} on agreement status or signature.`
    case 'invoice_sent':
      return `Shares billing / invoice context with ${venue}. For a live PDF link, queue from a task with a generated file or use a custom template with attachment.`
    case 'show_cancelled_or_postponed':
      return `Professional note to ${venue} when a show moves or is cancelled.`
    case 'pass_for_now':
      return `Polite pause or pass message to ${venue}.`
    default:
      return `Email to ${venue}.`
  }
}

export function SendVenueEmailModal({
  open,
  onClose,
  onSent,
  defaultType,
  deal,
  venue,
  recipientEmail: initialEmail = '',
  recipientName: initialName = '',
  venueId,
  dealId,
  contactId,
}: SendVenueEmailModalProps) {
  const { profile } = useArtistProfile()
  const { getTemplate } = useEmailTemplates()
  const { rows: customRows } = useCustomEmailTemplates()

  const venueCustomOptions = customRows.filter(r => r.audience === 'venue')

  const [emailType, setEmailType] = useState<string>(
    (defaultType as string) ?? getDefaultType(deal),
  )
  const [recipientEmail, setRecipientEmail] = useState(initialEmail)
  const [recipientName, setRecipientName] = useState(initialName)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [customCaptureKind, setCustomCaptureKind] = useState<EmailCaptureKind | ''>('')
  /** Deal with `agreement_url` resolved from `agreement_generated_file_id` when needed (matches send payload). */
  const [dealForPreview, setDealForPreview] = useState<Deal | null>(null)

  useEffect(() => {
    if (open) {
      setEmailType((defaultType as string) ?? getDefaultType(deal))
      setRecipientEmail(initialEmail)
      setRecipientName(initialName)
      setStatus('idle')
      setErrorMsg('')
      setCustomCaptureKind('')
    }
  }, [open, defaultType, deal, initialEmail, initialName])

  useEffect(() => {
    if (!open || !deal) {
      setDealForPreview(null)
      return
    }
    setDealForPreview(deal)
    let cancelled = false
    ;(async () => {
      const url = await resolveDealAgreementUrlForEmailPayload(
        async id => {
          const { data } = await supabase.from('generated_files').select('*').eq('id', id).maybeSingle()
          return (data as GeneratedFile | null) ?? null
        },
        deal,
        publicSiteOrigin()
      )
      if (cancelled) return
      setDealForPreview({ ...deal, agreement_url: url ?? deal.agreement_url ?? null })
    })()
    return () => { cancelled = true }
  }, [open, deal])

  const handleSend = async () => {
    if (!recipientEmail || !profile) return
    setSending(true)
    setStatus('idle')

    const companyName = profile.company_name || profile.artist_name
    const vName = venue?.name || 'your venue'
    const subjectMap: Record<VenueEmailType, string> = {
      booking_confirmation: `Booking Confirmation - ${companyName} at ${vName}`,
      payment_receipt: `Payment Received - Thank You | ${companyName}`,
      payment_reminder: `Payment Reminder - ${companyName}`,
      agreement_ready: `Agreement Ready for Review - ${companyName}`,
      agreement_followup: `Following up — agreement | ${companyName}`,
      follow_up: `Following Up - ${companyName}`,
      rebooking_inquiry: `Rebooking Inquiry - ${companyName} at ${vName}`,
      first_outreach: `${companyName} — booking inquiry | ${vName}`,
      pre_event_checkin: `Pre-event check-in — ${companyName} | ${vName}`,
      post_show_thanks: `Thank you — ${companyName} at ${vName}`,
      invoice_sent: `Invoice — ${companyName} | ${vName}`,
      show_cancelled_or_postponed: `Update — date change / cancellation | ${companyName} | ${vName}`,
      pass_for_now: `Thanks — ${companyName} | ${vName}`,
    }

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) throw new Error('Not signed in')

      const customRow = isCustomEmailType(emailType)
        ? customRows.find(r => customEmailTypeValue(r.id) === emailType)
        : undefined
      const tmpl = !customRow ? getTemplate(emailType as VenueEmailType) : undefined

      let agreementUrl: string | null = deal?.agreement_url ?? null
      if (deal) {
        agreementUrl =
          (await resolveDealAgreementUrlForEmailPayload(
            async id => {
              const { data } = await supabase.from('generated_files').select('*').eq('id', id).maybeSingle()
              return (data as GeneratedFile | null) ?? null
            },
            deal,
            publicSiteOrigin()
          )) ?? agreementUrl
      }

      const payload: Record<string, unknown> = {
        profile: {
          artist_name: profile.artist_name,
          company_name: profile.company_name,
          from_email: profile.from_email,
          reply_to_email: profile.reply_to_email,
          website: profile.website,
          phone: profile.phone,
          social_handle: profile.social_handle,
          tagline: profile.tagline,
        },
        recipient: { name: recipientName || recipientEmail, email: recipientEmail },
        ...(deal ? {
          deal: {
            description: deal.description,
            gross_amount: deal.gross_amount,
            event_date: deal.event_date,
            payment_due_date: deal.payment_due_date,
            agreement_url: agreementUrl,
            notes: deal.notes,
          },
        } : {}),
        ...(venue ? {
          venue: { name: venue.name, city: venue.city ?? null, location: venue.location ?? null },
        } : {}),
      }

      if (customRow) {
        payload.custom_venue_template = {
          subject_template: customRow.subject_template,
          blocks: customRow.blocks,
        }
        const { data: { user: u } } = await supabase.auth.getUser()
        const aid = customRow.attachment_generated_file_id
        if (u && aid) {
          const { data: gf } = await supabase
            .from('generated_files')
            .select('*')
            .eq('id', aid)
            .eq('user_id', u.id)
            .maybeSingle()
          const att = buildEmailAttachmentPayloadFromFile(gf as GeneratedFile | null, publicSiteOrigin())
          if (att) payload.attachment = att
        }
        // Mint capture token if sender chose a form kind
        if (customCaptureKind) {
          const { data: tokRow, error: capErr } = await supabase.from('email_capture_tokens').insert({
            user_id: authUser.id,
            kind: customCaptureKind,
            venue_id: venueId ?? null,
            deal_id: dealId ?? null,
            contact_id: contactId ?? null,
            expires_at: defaultEmailCaptureExpiresAt(),
          }).select('token').single()
          if (!capErr && tokRow?.token) {
            payload.capture_url = `${publicSiteOrigin()}/email-capture/${tokRow.token as string}`
          }
        }
      } else {
        payload.type = emailType
        payload.custom_subject = tmpl?.custom_subject ?? null
        payload.custom_intro = tmpl?.custom_intro ?? null
        payload.layout = tmpl?.layout ?? null
      }

      let captureTokenUuid: string | null = null
      if (!customRow && venueEmailTypeToCaptureKind(emailType as VenueEmailType)) {
        const capKind = venueEmailTypeToCaptureKind(emailType as VenueEmailType)!
        const { data: tokRow, error: capErr } = await supabase.from('email_capture_tokens').insert({
          user_id: authUser.id,
          kind: capKind,
          venue_id: venueId ?? null,
          deal_id: dealId ?? null,
          contact_id: contactId ?? null,
          expires_at: defaultEmailCaptureExpiresAt(),
        }).select('token').single()
        if (!capErr && tokRow?.token) {
          captureTokenUuid = tokRow.token as string
          payload.capture_url = `${publicSiteOrigin()}/email-capture/${captureTokenUuid}`
        }
      }

      const res = await fetch('/.netlify/functions/send-venue-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Send failed' }))
        throw new Error(err.message ?? 'Send failed')
      }

      const logSubject = customRow
        ? `${customRow.name} · ${venue?.name ?? 'venue'}`
        : subjectMap[emailType as VenueEmailType]

      const noteCapture = captureTokenUuid ? appendEmailCaptureTokenNote(null, captureTokenUuid) : undefined
      const logRes = await recordOutboundEmail(supabase, {
        user_id: authUser.id,
        venue_id: venueId ?? null,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        email_type: customRow ? customEmailTypeValue(customRow.id) : emailType,
        recipient_email: recipientEmail,
        subject: logSubject,
        status: 'sent',
        source: 'modal_immediate',
        notes: noteCapture,
      })
      if (captureTokenUuid && logRes.id && !logRes.error) {
        await supabase
          .from('email_capture_tokens')
          .update({ venue_emails_id: logRes.id })
          .eq('token', captureTokenUuid)
          .eq('user_id', authUser.id)
      }

      setStatus('success')
      onSent?.()
      setTimeout(() => { onClose() }, 1500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send')
      setStatus('error')

      // Log as failed
      const customRowFail = isCustomEmailType(emailType)
        ? customRows.find(r => customEmailTypeValue(r.id) === emailType)
        : undefined
      const { data: { user: uFail } } = await supabase.auth.getUser()
      if (uFail) {
        await recordOutboundEmail(supabase, {
          user_id: uFail.id,
          venue_id: venueId ?? null,
          deal_id: dealId ?? null,
          contact_id: contactId ?? null,
          email_type: customRowFail ? customEmailTypeValue(customRowFail.id) : emailType,
          recipient_email: recipientEmail,
          subject: customRowFail
            ? `${customRowFail.name} · ${venue?.name ?? 'venue'}`
            : subjectMap[emailType as VenueEmailType],
          status: 'failed',
          source: 'modal_immediate',
          detail: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    } finally {
      setSending(false)
    }
  }

  const canSend = !!recipientEmail && !!profile?.from_email && status !== 'success'

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Send Email
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Email type */}
          <div className="space-y-1.5">
            <Label>Email type</Label>
            <Select value={emailType} onValueChange={v => setEmailType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPE_OPTIONS.map(t => (
                  <SelectItem key={t} value={t}>{VENUE_EMAIL_TYPE_LABELS[t]}</SelectItem>
                ))}
                {venueCustomOptions.map(r => (
                  <SelectItem key={r.id} value={customEmailTypeValue(r.id)}>
                    {r.name} (custom)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {isCustomEmailType(emailType)
                ? 'Your block-based client template. Merge tokens fill from deal and venue when you send.'
                : getTypeDescription(emailType as VenueEmailType, dealForPreview ?? deal, venue?.name)}
            </p>
          </div>

          {/* Capture kind picker for custom venue templates */}
          {isCustomEmailType(emailType) && (
            <div className="space-y-1.5">
              <Label>Response form (optional)</Label>
              <Select
                value={customCaptureKind}
                onValueChange={v => setCustomCaptureKind(v as EmailCaptureKind | '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="No response form" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No response form</SelectItem>
                  {CUSTOM_CAPTURE_KIND_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-neutral-500">
                Adds a secure one-time response button to the email. Pick the form that matches what you want the venue to fill in.
              </p>
            </div>
          )}

          {/* Recipient */}
          <div className="space-y-1.5">
            <Label>Recipient name</Label>
            <Input
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder="Contact name"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Recipient email</Label>
            <Input
              type="email"
              value={recipientEmail}
              onChange={e => setRecipientEmail(e.target.value)}
              placeholder="contact@venue.com"
            />
            {!initialEmail && (
              <p className="text-xs text-amber-500">No email found on the linked contact. Enter one manually to proceed.</p>
            )}
          </div>

          {/* Sent from info */}
          {profile && (
            <div className="bg-neutral-900 border border-neutral-800 rounded p-3 space-y-0.5">
              <p className="text-xs text-neutral-500">
                Sending as <span className="text-neutral-300">{profile.company_name || profile.artist_name}</span>
                {' '}from <span className="text-neutral-300">{profile.from_email}</span>
              </p>
              {profile.reply_to_email && (
                <p className="text-xs text-neutral-500">
                  Reply-to: <span className="text-neutral-300">{profile.reply_to_email}</span>
                </p>
              )}
            </div>
          )}

          {/* Status feedback */}
          {status === 'success' && (
            <p className="text-xs text-green-400">Email sent successfully.</p>
          )}
          {status === 'error' && (
            <p className="text-xs text-red-400">{errorMsg}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={!canSend || sending}>
            <Send className="h-3.5 w-3.5" />
            {sending ? 'Sending...' : 'Send email'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
