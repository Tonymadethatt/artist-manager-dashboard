import { useState } from 'react'
import { MailOpen, Send, X, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { SendVenueEmailModal } from '@/components/emails/SendVenueEmailModal'
import { Button } from '@/components/ui/button'
import type { VenueEmail, VenueEmailType } from '@/types'
import { VENUE_EMAIL_TYPE_LABELS } from '@/types'
import { cn } from '@/lib/utils'

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
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

interface PendingRowProps {
  email: VenueEmail
  onApprove: (email: VenueEmail) => void
  onDismiss: (id: string) => void
  dismissing: boolean
}

function PendingRow({ email, onApprove, onDismiss, dismissing }: PendingRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-neutral-800 last:border-0">
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <TypeBadge type={email.email_type} />
          {email.venue && (
            <span className="text-xs text-neutral-400">{email.venue.name}</span>
          )}
        </div>
        <p className="text-sm text-neutral-300 truncate">{email.recipient_email}</p>
        <p className="text-xs text-neutral-600">{fmtDate(email.created_at)}</p>
        {email.notes && <p className="text-xs text-neutral-600 italic">{email.notes}</p>}
      </div>
      <div className="flex gap-2 shrink-0 items-start pt-0.5">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          onClick={() => onApprove(email)}
        >
          <Send className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 w-8 p-0 text-neutral-500 hover:text-red-400"
          onClick={() => onDismiss(email.id)}
          disabled={dismissing}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

interface HistoryRowProps {
  email: VenueEmail
}

function HistoryRow({ email }: HistoryRowProps) {
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
        <p className="text-sm text-neutral-300 truncate">{email.recipient_email}</p>
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
  const { pendingEmails, sentEmails, loading, refetch, dismissQueued } = useVenueEmails()
  const [activeTab, setActiveTab] = useState<'queue' | 'history'>('queue')
  const [approveEmail, setApproveEmail] = useState<VenueEmail | null>(null)
  const [dismissingId, setDismissingId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

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

      {/* Queue tab */}
      {activeTab === 'queue' && (
        <>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            </div>
          ) : pendingEmails.length === 0 ? (
            <EmptyState message="No emails queued. Follow-up emails queued from the Outreach panel will appear here." />
          ) : (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                <p className="text-xs font-medium text-neutral-500">
                  {pendingEmails.length} pending email{pendingEmails.length !== 1 ? 's' : ''} — review before sending
                </p>
              </div>
              {pendingEmails.map(email => (
                <PendingRow
                  key={email.id}
                  email={email}
                  onApprove={e => setApproveEmail(e)}
                  onDismiss={handleDismiss}
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

      {/* Approve modal (opens SendVenueEmailModal pre-filled) */}
      {approveEmail && (
        <SendVenueEmailModal
          open={!!approveEmail}
          onClose={() => setApproveEmail(null)}
          defaultType={approveEmail.email_type as VenueEmailType}
          recipientEmail={approveEmail.recipient_email}
          venueId={approveEmail.venue_id}
          dealId={approveEmail.deal_id}
          contactId={approveEmail.contact_id}
          venue={approveEmail.venue ? { id: approveEmail.venue.id, name: approveEmail.venue.name, city: null, location: null } : null}
        />
      )}
    </div>
  )
}
