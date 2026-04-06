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
import type { Deal, GeneratedFile, Venue, VenueEmailType, VenueEmailStatus } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

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
  'booking_confirmation',
  'booking_confirmed',
  'agreement_ready',
  'payment_reminder',
  'payment_receipt',
  'follow_up',
  'rebooking_inquiry',
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
      return `Confirms the booking details with ${venue}: event date, agreed amount, and next steps including agreement.`
    case 'booking_confirmed':
      return `Officially confirms the booking with ${venue}: event summary and what happens next.`
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

  const logEmail = async (params: {
    venue_id?: string | null; deal_id?: string | null; contact_id?: string | null
    email_type: string; recipient_email: string; subject: string
    status: VenueEmailStatus; notes?: string | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const sentAt = params.status === 'sent' ? new Date().toISOString() : null
    await supabase.from('venue_emails').insert({
      user_id: user.id,
      venue_id: params.venue_id ?? null,
      deal_id: params.deal_id ?? null,
      contact_id: params.contact_id ?? null,
      email_type: params.email_type,
      recipient_email: params.recipient_email,
      subject: params.subject,
      status: params.status,
      sent_at: sentAt,
      notes: params.notes ?? null,
    })
  }

  const venueCustomOptions = customRows.filter(r => r.audience === 'venue')

  const [emailType, setEmailType] = useState<string>(
    (defaultType as string) ?? getDefaultType(deal),
  )
  const [recipientEmail, setRecipientEmail] = useState(initialEmail)
  const [recipientName, setRecipientName] = useState(initialName)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  /** Deal with `agreement_url` resolved from `agreement_generated_file_id` when needed (matches send payload). */
  const [dealForPreview, setDealForPreview] = useState<Deal | null>(null)

  useEffect(() => {
    if (open) {
      setEmailType((defaultType as string) ?? getDefaultType(deal))
      setRecipientEmail(initialEmail)
      setRecipientName(initialName)
      setStatus('idle')
      setErrorMsg('')
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
    const subjectMap: Record<VenueEmailType, string> = {
      booking_confirmation: `Booking Confirmation - ${companyName} at ${venue?.name || 'your venue'}`,
      booking_confirmed: `Booking Confirmed - ${companyName} | ${venue?.name || 'your venue'}`,
      payment_receipt: `Payment Received - Thank You | ${companyName}`,
      payment_reminder: `Payment Reminder - ${companyName}`,
      agreement_ready: `Agreement Ready for Review - ${companyName}`,
      follow_up: `Following Up - ${companyName}`,
      rebooking_inquiry: `Rebooking Inquiry - ${companyName} at ${venue?.name || 'your venue'}`,
    }

    try {
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
      } else {
        payload.type = emailType
        payload.custom_subject = tmpl?.custom_subject ?? null
        payload.custom_intro = tmpl?.custom_intro ?? null
        payload.layout = tmpl?.layout ?? null
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

      // Log the sent email — custom types stored as custom:<uuid> for queue/history parity
      await logEmail({
        venue_id: venueId ?? null,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        email_type: customRow ? customEmailTypeValue(customRow.id) : emailType,
        recipient_email: recipientEmail,
        subject: logSubject,
        status: 'sent',
      })

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
      await logEmail({
        venue_id: venueId ?? null,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        email_type: customRowFail ? customEmailTypeValue(customRowFail.id) : emailType,
        recipient_email: recipientEmail,
        subject: customRowFail
          ? `${customRowFail.name} · ${venue?.name ?? 'venue'}`
          : subjectMap[emailType as VenueEmailType],
        status: 'failed',
        notes: err instanceof Error ? err.message : 'Unknown error',
      })
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
