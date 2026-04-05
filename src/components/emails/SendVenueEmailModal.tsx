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
import { useVenueEmails } from '@/hooks/useVenueEmails'
import type { Deal, Venue, VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'

interface SendVenueEmailModalProps {
  open: boolean
  onClose: () => void
  defaultType?: VenueEmailType
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
]

function getDefaultType(deal?: Deal | null): VenueEmailType {
  if (!deal) return 'follow_up'
  if (deal.agreement_url) return 'agreement_ready'
  const today = new Date().toISOString().split('T')[0]
  if (deal.payment_due_date && deal.payment_due_date < today && !deal.artist_paid) return 'payment_reminder'
  if (deal.artist_paid) return 'payment_receipt'
  return 'booking_confirmation'
}

function getTypeDescription(type: VenueEmailType, deal?: Deal | null, venueName?: string): string {
  const venue = venueName || 'the venue'
  switch (type) {
    case 'booking_confirmation':
      return `Confirms the booking details with ${venue}. Mentions the event date, agreed amount, and that a formal agreement will follow.`
    case 'booking_confirmed':
      return `Sends a final booking confirmed notice to ${venue} with event details and what comes next.`
    case 'agreement_ready':
      return `Notifies ${venue} that the agreement is ready for review${deal?.agreement_url ? ' and includes the link' : ''}.`
    case 'payment_reminder':
      return `A friendly reminder to ${venue} about the outstanding payment${deal?.payment_due_date ? ` due on ${deal.payment_due_date}` : ''}.`
    case 'payment_receipt':
      return `Confirms to ${venue} that payment has been received. Thank you message.`
    case 'follow_up':
      return `A soft check-in to ${venue} about the potential booking. No pressure, just keeping the conversation going.`
  }
}

export function SendVenueEmailModal({
  open,
  onClose,
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
  const { logEmail } = useVenueEmails()

  const [emailType, setEmailType] = useState<VenueEmailType>(defaultType ?? getDefaultType(deal))
  const [recipientEmail, setRecipientEmail] = useState(initialEmail)
  const [recipientName, setRecipientName] = useState(initialName)
  const [sending, setSending] = useState(false)
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (open) {
      setEmailType(defaultType ?? getDefaultType(deal))
      setRecipientEmail(initialEmail)
      setRecipientName(initialName)
      setStatus('idle')
      setErrorMsg('')
    }
  }, [open, defaultType, deal, initialEmail, initialName])

  const handleSend = async () => {
    if (!recipientEmail || !profile) return
    setSending(true)
    setStatus('idle')

    const companyName = profile.company_name || profile.artist_name
    const subjectMap: Record<VenueEmailType, string> = {
      booking_confirmation: `Booking Confirmation - ${companyName} at ${venue?.name || 'your venue'}`,
      payment_receipt: `Payment Received - Thank You | ${companyName}`,
      payment_reminder: `Payment Reminder - ${companyName}`,
      agreement_ready: `Agreement Ready for Review - ${companyName}`,
      booking_confirmed: `Booking Confirmed - ${companyName} | ${venue?.name || 'your venue'}`,
      follow_up: `Following Up - ${companyName}`,
    }

    try {
      const res = await fetch('/.netlify/functions/send-venue-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: emailType,
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
              agreement_url: deal.agreement_url,
              notes: deal.notes,
            }
          } : {}),
          ...(venue ? {
            venue: { name: venue.name, city: venue.city ?? null, location: venue.location ?? null }
          } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Send failed' }))
        throw new Error(err.message ?? 'Send failed')
      }

      // Log the sent email
      await logEmail({
        venue_id: venueId ?? null,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        email_type: emailType,
        recipient_email: recipientEmail,
        subject: subjectMap[emailType],
        status: 'sent',
      })

      setStatus('success')
      setTimeout(() => { onClose() }, 1500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to send')
      setStatus('error')

      // Log as failed
      await logEmail({
        venue_id: venueId ?? null,
        deal_id: dealId ?? null,
        contact_id: contactId ?? null,
        email_type: emailType,
        recipient_email: recipientEmail,
        subject: subjectMap[emailType],
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
            <Select value={emailType} onValueChange={v => setEmailType(v as VenueEmailType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_TYPE_OPTIONS.map(t => (
                  <SelectItem key={t} value={t}>{VENUE_EMAIL_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-neutral-500 leading-relaxed">
              {getTypeDescription(emailType, deal, venue?.name)}
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
