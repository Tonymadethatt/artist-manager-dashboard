import { useState, useEffect, useCallback } from 'react'
import { MailOpen, Send, X, Clock, CheckCircle, XCircle, RefreshCw, Zap } from 'lucide-react'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { VenueEmail, VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'
import {
  EMAIL_QUEUE_BUFFER_OPTIONS,
  clampEmailQueueBufferMinutes,
  DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES,
  type EmailQueueBufferMinutes,
} from '@/lib/emailQueueBuffer'

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

function TypeBadge({ type }: { type: VenueEmailType }) {
  return (
    <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
      {VENUE_EMAIL_TYPE_LABELS[type]}
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
  sending: boolean
  dismissing: boolean
}

function PendingRow({ email, bufferMinutes, onSendNow, onDismiss, sending, dismissing }: PendingRowProps) {
  const recipientName = email.contact?.name || null

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
        {email.notes && <p className="text-xs text-neutral-600 italic">{email.notes}</p>}
      </div>
      <div className="flex gap-2 shrink-0 items-start pt-0.5">
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

function HistoryRow({ email }: { email: VenueEmail }) {
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

  const handleSendNow = useCallback(async (email: VenueEmail) => {
    if (!profile?.from_email) {
      setSendError('Artist profile not configured. Set up your profile first.')
      return
    }

    setSendingId(email.id)
    setSendError(null)

    try {
      const res = await fetch('/.netlify/functions/send-venue-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: email.email_type,
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
          recipient: {
            name: email.contact?.name || email.recipient_email,
            email: email.recipient_email,
          },
          ...(email.deal ? {
            deal: {
              description: email.deal.description,
              gross_amount: email.deal.gross_amount,
              event_date: email.deal.event_date,
              payment_due_date: email.deal.payment_due_date,
              agreement_url: email.deal.agreement_url,
              notes: email.deal.notes,
            }
          } : {}),
          ...(email.venue ? {
            venue: {
              name: email.venue.name,
              city: email.venue.city ?? null,
              location: email.venue.location ?? null,
            }
          } : {}),
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Send failed' }))
        throw new Error((err as { message?: string }).message ?? 'Send failed')
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
      {/* Tabs + refresh */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 border-b border-neutral-800 flex-1">
          <button
            onClick={() => setActiveTab('queue')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'queue'
                ? 'border-neutral-300 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            Queue
            {pendingEmails.length > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-neutral-700 text-neutral-200 rounded-full">
                {pendingEmails.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === 'history'
                ? 'border-neutral-300 text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            History
          </button>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 ml-2"
          onClick={handleRefresh}
          disabled={refreshing || loading}
          title="Refresh"
        >
          <RefreshCw className={cn('h-4 w-4', (refreshing || loading) && 'animate-spin')} />
        </Button>
      </div>

      {/* Auto-send delay (applies per account; cron every ~1 min may add up to a minute after the delay) */}
      {activeTab === 'queue' && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-3 py-2.5 rounded-lg bg-neutral-900 border border-neutral-800">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-neutral-400">Auto-send delay</p>
            <p className="text-[11px] text-neutral-600 leading-snug max-w-md">
              Pending emails send automatically this long after they are queued (external cron, typically within about a minute after that). Shorter delays need the cron job to run often (e.g. every minute).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Select
              value={String(bufferMinutes)}
              onValueChange={handleBufferChange}
              disabled={bufferSaving || !profile}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs bg-neutral-950 border-neutral-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EMAIL_QUEUE_BUFFER_OPTIONS.map(m => (
                  <SelectItem key={m} value={String(m)} className="text-xs">
                    {m} minutes{m === DEFAULT_EMAIL_QUEUE_BUFFER_MINUTES ? ' (default)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {activeTab === 'queue' && pendingEmails.length > 0 && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-xs text-neutral-400">
          <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
          <span>
            Emails auto-send <strong className="text-neutral-300">{bufferMinutes} minutes</strong> after being queued. Click <strong className="text-neutral-300">Send now</strong> to send immediately, or <strong className="text-neutral-300">✕</strong> to cancel.
          </span>
        </div>
      )}

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
            <EmptyState message="No emails queued. Completing tasks with an email action will queue emails here." />
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
                  bufferMinutes={bufferMinutes}
                  onSendNow={handleSendNow}
                  onDismiss={handleDismiss}
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
                <HistoryRow key={email.id} email={email} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
