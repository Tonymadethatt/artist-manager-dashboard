import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Clock, Mail, ClipboardList, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, CalendarOff, RotateCcw, Copy, Download, Upload } from 'lucide-react'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { useMonthlyFees } from '@/hooks/useMonthlyFees'
import { useBookingRequests } from '@/hooks/useBookingRequests'
import { usePerformanceReports } from '@/hooks/usePerformanceReports'
import { SendVenueEmailModal } from '@/components/emails/SendVenueEmailModal'
import { AgreementPdfPicker } from '@/components/pipeline/AgreementPdfPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Contact, Deal, CommissionTier, PaymentMethod, DealPricingFinalSource } from '@/types'
import { isDealPricingSnapshot } from '@/types'
import { ARTIST_EMAIL_TYPE_LABELS, COMMISSION_TIER_LABELS, COMMISSION_TIER_RATES, PAYMENT_METHOD_LABELS } from '@/types'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { recordOutboundEmail } from '@/lib/email/recordOutboundEmail'
import { hasPendingArtistEmail } from '@/lib/queueEmailsFromTemplate'
import {
  SHOW_REPORT_PRESETS,
  ARTIST_SHOW_REPORT_PRESETS,
  buildPromiseLinesDocV2FromUi,
  customLabelsFromDealDoc,
  artistCustomLabelsFromDealDoc,
  presetToggleStateFromDealDoc,
  artistPresetToggleStateFromDealDoc,
  defaultArtistPromisePresets,
} from '@/lib/showReportCatalog'
import { usePricingCatalog } from '@/hooks/usePricingCatalog'
import {
  EarningsPricingPanel,
  type EarningsPricingPanelHandle,
} from '@/components/earnings/EarningsPricingPanel'
import { copyCatalogJsonToClipboard, triggerDownloadCatalogJson } from '@/lib/pricing/catalogExportActions'
import {
  catalogHasMinimumForDealLogging,
  computeDealPrice,
  pickDefaultServiceId,
} from '@/lib/pricing/computeDealPrice'
import { buildRetainerReceivedPayload } from '@/lib/reports/buildManagementReportData'
import { overlappingDealIds } from '@/lib/calendar/dealTimeOverlap'
import {
  pacificWallToUtcIso,
  utcIsoToPacificDateAndTime,
  addCalendarDaysPacific,
} from '@/lib/calendar/pacificWallTime'
import { syncDealCalendarSideEffects } from '@/lib/calendar/queueGigCalendarEmails'
import { useNavBadges } from '@/context/NavBadgesContext'

const RETAINER_RESEND_CONFIRM_MS = 3 * 60 * 1000
import { publicSiteOrigin, resolvedPdfHrefFromOrigin } from '@/lib/files/pdfShareUrl'
import type { GeneratedFile } from '@/types'

const PAGE_SIZE = 10

const DEAL_FORM_TABS = [
  { id: 'basics' as const, label: 'Show' },
  { id: 'terms' as const, label: 'Terms' },
  { id: 'agreement' as const, label: 'Agreement' },
  { id: 'recap' as const, label: 'Recap' },
]
type DealFormTab = (typeof DEAL_FORM_TABS)[number]['id']

function Paginator({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / PAGE_SIZE)
  if (totalPages <= 1) return null
  const start = (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  return (
    <div className="flex items-center justify-between px-1 pt-1">
      <span className="text-xs text-neutral-500">{start}-{end} of {total}</span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page === 1}
          className="flex items-center justify-center h-7 w-7 rounded border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="text-xs text-neutral-500 px-1 tabular-nums">{page} / {totalPages}</span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page === totalPages}
          className="flex items-center justify-center h-7 w-7 rounded border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
function fmtMonth(dateStr: string) {
  const [y, m] = dateStr.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

function RetainerTab(_: { hideSummary?: boolean }) {
  const { fees, loading, addPayment, deletePayment, updateFee, addFee, deleteFee } = useMonthlyFees()
  const { profile } = useArtistProfile()
  const { getTemplate } = useEmailTemplates()
  const reminderTemplate = getTemplate('retainer_reminder')
  const [retainerPage, setRetainerPage] = useState(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [addMonth, setAddMonth] = useState('')
  const [addAmount, setAddAmount] = useState('350')
  const [addOpen, setAddOpen] = useState(false)
  const [expandedFee, setExpandedFee] = useState<string | null>(null)
  const [deletingFeeId, setDeletingFeeId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [reminderStatus, setReminderStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [reminderMsg, setReminderMsg] = useState('')
  const lastReminderSendAt = useRef(0)
  const [receivedQueueStatus, setReceivedQueueStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle')
  const [receivedQueueMsg, setReceivedQueueMsg] = useState('')
  const lastReceivedQueueAt = useRef(0)

  // Payment dialog state
  const [payOpen, setPayOpen] = useState(false)
  const [payFeeId, setPayFeeId] = useState('')
  const [payAmount, setPayAmount] = useState('')
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0])
  const [payMethod, setPayMethod] = useState<PaymentMethod>('zelle')
  const [payNotes, setPayNotes] = useState('')
  const [payingSaving, setPayingSaving] = useState(false)

  const feesWithTotals = useMemo(() => fees.map(f => {
    const totalPaid = (f.payments ?? []).reduce((s, p) => s + p.amount, 0)
    const balance = f.amount - totalPaid
    return { ...f, totalPaid, balance }
  }), [fees])

  const totals = useMemo(() => {
    const owed = feesWithTotals.reduce((s, f) => s + f.amount, 0)
    const received = feesWithTotals.reduce((s, f) => s + f.totalPaid, 0)
    return { owed, received, outstanding: owed - received }
  }, [feesWithTotals])

  const retainerReceivedReady = useMemo(() => {
    const { settledFees } = buildRetainerReceivedPayload(fees)
    return totals.outstanding === 0 && settledFees.length > 0
  }, [fees, totals.outstanding])

  const openPayDialog = (feeId: string, balance: number) => {
    setPayFeeId(feeId)
    setPayAmount(balance > 0 ? String(balance) : '')
    setPayDate(new Date().toISOString().split('T')[0])
    setPayMethod('zelle')
    setPayNotes('')
    setPayOpen(true)
  }

  const handleLogPayment = async () => {
    const amount = parseFloat(payAmount)
    if (isNaN(amount) || amount <= 0 || !payFeeId) return
    setPayingSaving(true)
    await addPayment(payFeeId, amount, payDate, payMethod, payNotes || undefined)
    setPayingSaving(false)
    setPayOpen(false)
  }

  const handleSaveAmount = async (id: string) => {
    const amount = parseFloat(editAmount)
    if (!isNaN(amount) && amount > 0) await updateFee(id, { amount })
    setEditingId(null)
  }

  const handleDeleteFee = async (id: string) => {
    await deleteFee(id)
    setDeletingFeeId(null)
  }

  const handleAddMonth = async () => {
    if (!addMonth) return
    setSaving(true)
    await addFee(addMonth + '-01', parseFloat(addAmount) || 350)
    setSaving(false)
    setAddOpen(false)
    setAddMonth('')
    setAddAmount('350')
  }

  const handleSendReminder = async () => {
    if (!profile) return
    const now = Date.now()
    if (now - lastReminderSendAt.current < RETAINER_RESEND_CONFIRM_MS) {
      if (!window.confirm('You sent a retainer reminder recently. Send another now?')) return
    }
    setReminderStatus('sending')
    const unpaidFees = feesWithTotals
      .filter(f => f.balance > 0)
      .map(f => ({ month: fmtMonth(f.month), owed: f.amount, paid: f.totalPaid, balance: f.balance }))
    try {
      const res = await fetch('/.netlify/functions/send-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          unpaidFees,
          totalOutstanding: totals.outstanding,
          custom_subject: reminderTemplate?.custom_subject ?? null,
          custom_intro: reminderTemplate?.custom_intro ?? null,
          layout: reminderTemplate?.layout ?? null,
        }),
      })
      if (res.ok) {
        lastReminderSendAt.current = Date.now()
        setReminderStatus('success')
        setReminderMsg(`Reminder sent to ${profile.artist_email}`)
        const { data: { user } } = await supabase.auth.getUser()
        if (user && profile.artist_email) {
          const firstName = (profile.artist_name ?? 'Artist').split(/\s+/)[0] || 'Artist'
          const subj = (reminderTemplate?.custom_subject as string | null)?.trim()
            || `Hey ${firstName}, quick note from management`
          await recordOutboundEmail(supabase, {
            user_id: user.id,
            email_type: 'retainer_reminder',
            recipient_email: profile.artist_email,
            subject: subj,
            status: 'sent',
            source: 'earnings_manual',
            detail: `Outstanding ${totals.outstanding.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`,
          })
        }
      } else {
        const err = await res.json().catch(() => ({}))
        setReminderStatus('error')
        setReminderMsg((err as { message?: string }).message ?? 'Send failed')
      }
    } catch {
      setReminderStatus('error')
      setReminderMsg('Network error — make sure site is deployed.')
    }
    setTimeout(() => setReminderStatus('idle'), 4000)
  }

  const handleQueueRetainerReceived = async () => {
    if (!profile?.artist_email || !profile.from_email) {
      setReceivedQueueStatus('error')
      setReceivedQueueMsg('Set artist email and from address in Settings.')
      setTimeout(() => setReceivedQueueStatus('idle'), 4000)
      return
    }
    if (!retainerReceivedReady) return
    const now = Date.now()
    if (now - lastReceivedQueueAt.current < RETAINER_RESEND_CONFIRM_MS) {
      if (!window.confirm('You queued this email recently. Add another to the queue now?')) return
    }
    setReceivedQueueStatus('working')
    setReceivedQueueMsg('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setReceivedQueueStatus('error')
        setReceivedQueueMsg('Not signed in')
        setTimeout(() => setReceivedQueueStatus('idle'), 4000)
        return
      }
      if (await hasPendingArtistEmail(user.id, 'retainer_received', profile.artist_email)) {
        setReceivedQueueStatus('error')
        setReceivedQueueMsg('Already in email queue (pending). Check Email Queue.')
        setTimeout(() => setReceivedQueueStatus('idle'), 5000)
        return
      }
      const { error } = await supabase.from('venue_emails').insert({
        user_id: user.id,
        venue_id: null,
        deal_id: null,
        contact_id: null,
        email_type: 'retainer_received',
        recipient_email: profile.artist_email,
        subject: `${ARTIST_EMAIL_TYPE_LABELS.retainer_received} - ${profile.artist_name ?? 'Artist'}`,
        status: 'pending',
        notes: 'Queued from Earnings · retainer fully paid',
      })
      if (error) {
        setReceivedQueueStatus('error')
        setReceivedQueueMsg(error.message)
      } else {
        lastReceivedQueueAt.current = Date.now()
        setReceivedQueueStatus('success')
        setReceivedQueueMsg('Added to email queue — sends on next run')
      }
    } catch {
      setReceivedQueueStatus('error')
      setReceivedQueueMsg('Could not add to queue')
    }
    setTimeout(() => setReceivedQueueStatus('idle'), 4000)
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <div className="flex items-center gap-2 min-w-0 sm:flex-1">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest shrink-0">
            Monthly Retainer
          </h2>
          <div className="hidden sm:block flex-1 min-w-[1rem] h-px bg-neutral-800" />
        </div>
        <div className="flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between sm:justify-end sm:gap-3 sm:shrink-0">
          <p className="text-xs text-neutral-500 tabular-nums">
            {fees.length} month{fees.length !== 1 ? 's' : ''} tracked
          </p>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {totals.outstanding > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSendReminder}
                  disabled={reminderStatus === 'sending'}
                >
                  {reminderStatus === 'sending' ? 'Sending…' : 'Send payment reminder'}
                </Button>
                {reminderStatus === 'success' && <span className="text-xs text-green-400">{reminderMsg}</span>}
                {reminderStatus === 'error' && <span className="text-xs text-red-400">{reminderMsg}</span>}
              </>
            )}
            {retainerReceivedReady && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleQueueRetainerReceived}
                  disabled={
                    receivedQueueStatus === 'working'
                    || !profile?.artist_email
                    || !profile?.from_email
                  }
                  title={
                    !profile?.artist_email || !profile?.from_email
                      ? 'Artist email and from address are required (Settings).'
                      : undefined
                  }
                >
                  {receivedQueueStatus === 'working' ? 'Queueing…' : 'Queue payment received email'}
                </Button>
                {receivedQueueStatus === 'success' && <span className="text-xs text-green-400">{receivedQueueMsg}</span>}
                {receivedQueueStatus === 'error' && <span className="text-xs text-red-400">{receivedQueueMsg}</span>}
              </>
            )}
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              Add month
            </Button>
          </div>
        </div>
      </div>

      {/* Month list */}
      <div className="space-y-2">
        {feesWithTotals.slice((retainerPage - 1) * PAGE_SIZE, retainerPage * PAGE_SIZE).map(fee => {
          const isExpanded = expandedFee === fee.id
          const statusLabel = fee.balance <= 0 ? 'Paid in full' : fee.totalPaid > 0 ? `Partial — $${fee.balance.toFixed(2)} remaining` : 'Unpaid'
          const statusColor = fee.balance <= 0 ? 'text-green-400' : fee.totalPaid > 0 ? 'text-amber-400' : 'text-neutral-500'

          return (
            <div key={fee.id} className="rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden">
              {/* Month header row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-medium text-neutral-100 text-sm">{fmtMonth(fee.month)}</span>
                    <span className={cn('text-xs font-medium', statusColor)}>{statusLabel}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-neutral-500">
                    {editingId === fee.id ? (
                      <Input
                        type="number"
                        value={editAmount}
                        onChange={e => setEditAmount(e.target.value)}
                        className="w-24 h-6 text-xs"
                        onBlur={() => handleSaveAmount(fee.id)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveAmount(fee.id)}
                        autoFocus
                      />
                    ) : (
                      <button
                        className="tabular-nums hover:text-neutral-300 transition-colors"
                        onClick={() => { setEditingId(fee.id); setEditAmount(String(fee.amount)) }}
                        title="Click to edit amount"
                      >
                        Invoiced: ${fee.amount.toFixed(2)}
                      </button>
                    )}
                    {fee.totalPaid > 0 && (
                      <span className="text-green-600">Paid: ${fee.totalPaid.toFixed(2)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {fee.balance > 0 && (
                    <Button size="sm" variant="outline" onClick={() => openPayDialog(fee.id, fee.balance)}>
                      <Plus className="h-3 w-3" />
                      Log payment
                    </Button>
                  )}
                  {(fee.payments ?? []).length > 0 && (
                    <button
                      onClick={() => setExpandedFee(isExpanded ? null : fee.id)}
                      className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1"
                    >
                      {isExpanded ? 'Hide' : `${fee.payments!.length} payment${fee.payments!.length !== 1 ? 's' : ''}`}
                    </button>
                  )}
                  {deletingFeeId === fee.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-neutral-400">Delete month?</span>
                      <button
                        onClick={() => handleDeleteFee(fee.id)}
                        className="text-xs px-2 py-0.5 rounded bg-red-900/60 text-red-400 border border-red-800/60 hover:bg-red-800/60 transition-colors"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => setDeletingFeeId(null)}
                        className="text-xs px-2 py-0.5 rounded bg-neutral-800 text-neutral-400 border border-neutral-700 hover:bg-neutral-700 transition-colors"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setDeletingFeeId(fee.id)}
                      className="text-neutral-700 hover:text-red-500 transition-colors p-1"
                      title="Delete this month"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Payment history */}
              {isExpanded && (fee.payments ?? []).length > 0 && (
                <div className="border-t border-neutral-800 divide-y divide-neutral-800">
                  {fee.payments!.map(p => (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-2 bg-neutral-950/40">
                      <div className="flex-1 min-w-0 flex items-center gap-3 flex-wrap">
                        <span className="text-sm font-medium text-green-400 tabular-nums">${p.amount.toFixed(2)}</span>
                        <span className="text-xs bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">
                          {PAYMENT_METHOD_LABELS[p.payment_method]}
                        </span>
                        <span className="text-xs text-neutral-500">{p.paid_date}</span>
                        {p.notes && <span className="text-xs text-neutral-600 truncate">{p.notes}</span>}
                      </div>
                      <button
                        onClick={() => deletePayment(p.id, fee.id)}
                        className="text-neutral-700 hover:text-red-500 transition-colors text-xs px-1"
                        title="Remove this payment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Paginator page={retainerPage} total={feesWithTotals.length} onPage={p => { setRetainerPage(p); setExpandedFee(null) }} />

      {/* Log payment dialog */}
      <Dialog open={payOpen} onOpenChange={v => !v && setPayOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Log a payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Amount ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={payDate}
                  onChange={e => setPayDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Payment method *</Label>
              <Select value={payMethod} onValueChange={v => setPayMethod(v as PaymentMethod)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="zelle">Zelle</SelectItem>
                  <SelectItem value="venmo">Venmo</SelectItem>
                  <SelectItem value="apple_pay">Apple Pay</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="check">Check</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                value={payNotes}
                onChange={e => setPayNotes(e.target.value)}
                placeholder="Any additional context…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button onClick={handleLogPayment} disabled={payingSaving || !payAmount}>
              {payingSaving ? 'Logging…' : 'Log payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add month dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Add a month</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Month</Label>
              <Input
                type="month"
                value={addMonth}
                onChange={e => setAddMonth(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Amount ($)</Label>
              <Input
                type="number"
                value={addAmount}
                onChange={e => setAddAmount(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAddMonth} disabled={saving || !addMonth}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

const TIER_BADGE_VARIANT: Record<CommissionTier, 'blue' | 'purple' | 'warning' | 'secondary'> = {
  new_doors: 'blue',
  kept_doors: 'purple',
  bigger_doors: 'warning',
  artist_network: 'secondary',
}

function defaultPromisePresets(): Record<string, boolean> {
  return Object.fromEntries(SHOW_REPORT_PRESETS.map(p => [p.id, true])) as Record<string, boolean>
}

const EMPTY_FORM = {
  description: '',
  venue_id: '',
  /** Show date in Pacific (YYYY-MM-DD); synced to legacy event_date on save. */
  event_date: '',
  event_start_time: '20:00',
  event_end_time: '23:00',
  gross_amount: '',
  commission_tier: 'new_doors' as CommissionTier,
  payment_due_date: '',
  agreement_url: '',
  agreement_generated_file_id: '',
  deposit_paid_amount: '',
  notes: '',
  performance_genre: '',
  performance_start_time: '',
  performance_end_time: '',
  onsite_contact_id: '',
  venue_capacity: '',
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function PayToggle({
  label,
  paid,
  date,
  onToggle,
  disabled,
}: {
  label: string
  paid: boolean
  date: string | null
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'flex flex-col items-center gap-0.5 px-2 py-1 rounded text-xs font-medium transition-colors min-w-[64px]',
        paid
          ? 'bg-green-950 text-green-400 hover:bg-green-900'
          : 'bg-neutral-800 text-neutral-500 hover:bg-neutral-700 hover:text-neutral-300',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span>{paid ? '✓' : '○'} {label}</span>
      {paid && date && <span className="text-[10px] opacity-70">{date}</span>}
    </button>
  )
}

export default function Earnings() {
  const location = useLocation()
  const navigate = useNavigate()
  const pricingCatalog = usePricingCatalog()
  const pricingPanelRef = useRef<EarningsPricingPanelHandle>(null)
  const [pricingToolbarError, setPricingToolbarError] = useState<string | null>(null)
  const { deals, loading, addDeal, updateDeal, deleteDeal, toggleArtistPaid, toggleManagerPaid, refetch } = useDeals()
  const { venues, updateVenue, refetch: refetchVenues } = useVenues()
  const { profile } = useArtistProfile()
  const { reports: perfReports, createReport } = usePerformanceReports()
  const { fees } = useMonthlyFees()
  const { requests: bookingRequests, loading: bookingRequestsLoading, deleteRequest: deleteBookingRequest } = useBookingRequests()
  const { refreshNavBadges } = useNavBadges()
  const [earningsSection, setEarningsSection] = useState<'deals' | 'pricing'>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'pricing' ? 'pricing' : 'deals',
  )
  const [dealsPage, setDealsPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null)
  const [calendarConfirm, setCalendarConfirm] = useState<{ deal: Deal; mode: 'off' | 'on' } | null>(null)
  const [calendarSaving, setCalendarSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [sendEmailDeal, setSendEmailDeal] = useState<Deal | null>(null)
  const [sendingFormDealId, setSendingFormDealId] = useState<string | null>(null)
  const [formToast, setFormToast] = useState<string | null>(null)
  const [promisePresets, setPromisePresets] = useState<Record<string, boolean>>(defaultPromisePresets)
  const [promiseCustomLines, setPromiseCustomLines] = useState<string[]>([''])
  const [artistPromisePresets, setArtistPromisePresets] = useState<Record<string, boolean>>(defaultArtistPromisePresets())
  const [artistPromiseCustomLines, setArtistPromiseCustomLines] = useState<string[]>([''])
  const [dealFormTab, setDealFormTab] = useState<DealFormTab>('basics')
  const [addonPickerOpen, setAddonPickerOpen] = useState(false)
  const [venueContacts, setVenueContacts] = useState<Contact[]>([])

  const [pricingBaseMode, setPricingBaseMode] = useState<'package' | 'hourly'>('hourly')
  const [pricingPackageId, setPricingPackageId] = useState<string | null>(null)
  const [pricingServiceId, setPricingServiceId] = useState<string | null>(null)
  const [pricingOvertimeServiceId, setPricingOvertimeServiceId] = useState<string | null>(null)
  const [pricingPerformanceHours, setPricingPerformanceHours] = useState(4)
  const [pricingAddonQty, setPricingAddonQty] = useState<Record<string, number>>({})
  const [pricingSurchargeIds, setPricingSurchargeIds] = useState<string[]>([])
  const [pricingDiscountIds, setPricingDiscountIds] = useState<string[]>([])

  useEffect(() => {
    const t = new URLSearchParams(location.search).get('tab')
    setEarningsSection(t === 'pricing' ? 'pricing' : 'deals')
  }, [location.search])

  useEffect(() => {
    if (!addOpen) setAddonPickerOpen(false)
  }, [addOpen])

  useEffect(() => {
    if (!addOpen) return
    let cancelled = false
    async function loadContacts() {
      if (!form.venue_id) {
        setVenueContacts([])
        return
      }
      const { data } = await supabase
        .from('contacts')
        .select('*')
        .eq('venue_id', form.venue_id)
        .order('created_at')
      if (!cancelled) setVenueContacts((data ?? []) as Contact[])
    }
    void loadContacts()
    return () => {
      cancelled = true
    }
  }, [addOpen, form.venue_id])

  const goEarningsSection = useCallback(
    (s: 'deals' | 'pricing') => {
      setPricingToolbarError(null)
      const p = new URLSearchParams(location.search)
      if (s === 'pricing') p.set('tab', 'pricing')
      else p.delete('tab')
      const qs = p.toString()
      navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true })
      setEarningsSection(s)
    },
    [location.pathname, location.search, navigate],
  )

  const onPricingCopyJson = useCallback(async () => {
    if (pricingCatalog.loading) return
    setPricingToolbarError(null)
    try {
      await copyCatalogJsonToClipboard(pricingCatalog.doc)
    } catch {
      setPricingToolbarError('Could not copy.')
    }
  }, [pricingCatalog.doc, pricingCatalog.loading])

  const onPricingDownloadJson = useCallback(() => {
    if (pricingCatalog.loading) return
    setPricingToolbarError(null)
    triggerDownloadCatalogJson(pricingCatalog.doc)
  }, [pricingCatalog.doc, pricingCatalog.loading])

  function showFormToast(msg: string) {
    setFormToast(msg)
    setTimeout(() => setFormToast(null), 3000)
  }

  const dealHasShowTimes = (d: Deal) => Boolean(d.event_start_at && d.event_end_at)

  async function handleConfirmCalendarAction() {
    if (!calendarConfirm || calendarSaving) return
    const { deal: d0, mode } = calendarConfirm
    setCalendarSaving(true)
    const ts = mode === 'off' ? new Date().toISOString() : null
    const r = await updateDeal(d0.id, { event_cancelled_at: ts })
    setCalendarSaving(false)
    if (r.error) {
      showFormToast(r.error.message ?? 'Update failed')
      return
    }
    const saved = r.data ?? null
    if (saved) {
      const vAfter = saved.venue_id ? venues.find(v => v.id === saved.venue_id) ?? saved.venue : saved.venue
      const vBefore = d0.venue_id ? venues.find(v => v.id === d0.venue_id) ?? d0.venue : d0.venue
      await syncDealCalendarSideEffects({
        beforeDeal: d0,
        afterDeal: saved,
        venueBefore: vBefore ?? null,
        venueAfter: vAfter ?? null,
        artistEmail: profile?.artist_email,
      })
      await refetch()
      await refreshNavBadges()
    }
    setCalendarConfirm(null)
    showFormToast(mode === 'off' ? 'Show removed from calendar (cancelled).' : 'Show restored to calendar.')
  }

  async function handleSendPerfForm(deal: Deal) {
    if (!profile || !deal.venue_id) return
    setSendingFormDealId(deal.id)
    const venue = venues.find(v => v.id === deal.venue_id)
    const venueName = venue?.name ?? deal.description
    const { error } = await createReport(deal.venue_id, deal.id, profile, venueName, deal.event_date)
    setSendingFormDealId(null)
    if (error && !error.includes('email failed')) {
      showFormToast(`Error: ${error}`)
    } else {
      showFormToast('Performance form sent to artist.')
    }
  }

  const stats = useMemo(() => {
    const earned = deals
      .filter(d => d.artist_paid)
      .reduce((sum, d) => sum + d.commission_amount, 0)
    const received = deals
      .filter(d => d.manager_paid)
      .reduce((sum, d) => sum + d.commission_amount, 0)
    const outstanding = earned - received
    const totalCommission = deals.reduce((sum, d) => sum + d.commission_amount, 0)
    return { earned, received, outstanding, totalCommission, count: deals.length }
  }, [deals])

  const retainerStats = useMemo(() => {
    const invoiced = fees.reduce((s, f) => s + f.amount, 0)
    const received = fees.reduce((s, f) => s + (f.payments ?? []).reduce((ps, p) => ps + p.amount, 0), 0)
    return { invoiced, received, outstanding: invoiced - received }
  }, [fees])

  const artistBookingStats = useMemo(() => {
    const paidDeals = deals.filter(d => d.artist_paid)
    return {
      dealCount: deals.length,
      totalGrossLogged: deals.reduce((s, d) => s + d.gross_amount, 0),
      grossMarkedPaid: paidDeals.reduce((s, d) => s + d.gross_amount, 0),
    }
  }, [deals])

  const previewCommission = useMemo(() => {
    const gross = parseFloat(form.gross_amount)
    if (isNaN(gross) || gross <= 0) return null
    return gross * COMMISSION_TIER_RATES[form.commission_tier]
  }, [form.gross_amount, form.commission_tier])

  const resetPricingFromCatalog = (eventDate: string) => {
    const cat = pricingCatalog.doc
    const svc = pickDefaultServiceId(cat, eventDate || null)
    const firstPkg = cat.packages[0]?.id ?? null
    setPricingBaseMode(firstPkg ? 'package' : 'hourly')
    setPricingPackageId(firstPkg)
    setPricingServiceId(svc)
    setPricingOvertimeServiceId(svc)
    setPricingPerformanceHours(4)
    setPricingAddonQty({})
    setPricingSurchargeIds([])
    setPricingDiscountIds([])
  }

  const pricingComputed = useMemo(() => {
    if (!catalogHasMinimumForDealLogging(pricingCatalog.doc)) return null
    try {
      return computeDealPrice({
        catalog: pricingCatalog.doc,
        eventDate: form.event_date.trim() || null,
        baseMode: pricingBaseMode,
        packageId: pricingPackageId,
        serviceId: pricingServiceId,
        overtimeServiceId: pricingOvertimeServiceId,
        performanceHours: pricingPerformanceHours,
        addonQuantities: pricingAddonQty,
        surchargeIds: pricingSurchargeIds,
        discountIds: pricingDiscountIds,
      })
    } catch {
      return null
    }
  }, [
    pricingCatalog.doc,
    form.event_date,
    pricingBaseMode,
    pricingPackageId,
    pricingServiceId,
    pricingOvertimeServiceId,
    pricingPerformanceHours,
    pricingAddonQty,
    pricingSurchargeIds,
    pricingDiscountIds,
  ])

  /** New deals: auto-sync gross from calculator (discovery). Edited deals: manual-first. */
  useEffect(() => {
    if (!addOpen || editDeal || !pricingComputed) return
    setForm(prev => ({ ...prev, gross_amount: String(pricingComputed.gross) }))
  }, [addOpen, editDeal, pricingComputed])

  useEffect(() => {
    if (!addOpen || editDeal || pricingBaseMode !== 'hourly') return
    const pick = pickDefaultServiceId(pricingCatalog.doc, form.event_date.trim() || null)
    if (pick) setPricingServiceId(pick)
  }, [addOpen, editDeal, pricingBaseMode, form.event_date, pricingCatalog.doc])

  const canLogDeal = catalogHasMinimumForDealLogging(pricingCatalog.doc)

  const openAdd = () => {
    if (!canLogDeal) {
      showFormToast('Add at least one package or hourly rate under Pricing & fees first.')
      goEarningsSection('pricing')
      return
    }
    setForm(EMPTY_FORM)
    setEditDeal(null)
    setPromisePresets(defaultPromisePresets())
    setPromiseCustomLines([''])
    setArtistPromisePresets(defaultArtistPromisePresets())
    setArtistPromiseCustomLines([''])
    resetPricingFromCatalog('')
    setDealFormTab('basics')
    setAddOpen(true)
  }

  const openEdit = (deal: Deal) => {
    const sPart = deal.event_start_at ? utcIsoToPacificDateAndTime(deal.event_start_at) : null
    const ePart = deal.event_end_at ? utcIsoToPacificDateAndTime(deal.event_end_at) : null
    const hasTimes = sPart && ePart
    const ed = deal.event_date ?? ''
    setForm({
      description: deal.description,
      venue_id: deal.venue_id ?? '',
      event_date: hasTimes ? sPart.date : ed,
      event_start_time: hasTimes ? sPart.time : '20:00',
      event_end_time: hasTimes ? ePart.time : '23:00',
      gross_amount: String(deal.gross_amount),
      commission_tier: deal.commission_tier,
      payment_due_date: deal.payment_due_date ?? '',
      agreement_url: deal.agreement_url ?? '',
      agreement_generated_file_id: deal.agreement_generated_file_id ?? '',
      deposit_paid_amount:
        deal.deposit_paid_amount != null && Number.isFinite(Number(deal.deposit_paid_amount))
          ? String(deal.deposit_paid_amount)
          : '',
      notes: deal.notes ?? '',
      performance_genre: deal.performance_genre ?? '',
      performance_start_time: (() => {
        const ps = deal.performance_start_at ? utcIsoToPacificDateAndTime(deal.performance_start_at) : null
        const pe = deal.performance_end_at ? utcIsoToPacificDateAndTime(deal.performance_end_at) : null
        return ps && pe ? ps.time : ''
      })(),
      performance_end_time: (() => {
        const ps = deal.performance_start_at ? utcIsoToPacificDateAndTime(deal.performance_start_at) : null
        const pe = deal.performance_end_at ? utcIsoToPacificDateAndTime(deal.performance_end_at) : null
        return ps && pe ? pe.time : ''
      })(),
      onsite_contact_id: deal.onsite_contact_id ?? '',
      venue_capacity:
        (deal.venue_id
          ? venues.find(v => v.id === deal.venue_id)?.capacity ?? deal.venue?.capacity ?? ''
          : '') || '',
    })
    setPromisePresets(presetToggleStateFromDealDoc(deal.promise_lines ?? null))
    const customs = customLabelsFromDealDoc(deal.promise_lines ?? null)
    setPromiseCustomLines(customs.length ? customs : [''])
    setArtistPromisePresets(artistPresetToggleStateFromDealDoc(deal.promise_lines ?? null))
    const ac = artistCustomLabelsFromDealDoc(deal.promise_lines ?? null)
    setArtistPromiseCustomLines(ac.length ? ac : [''])
    const snap = deal.pricing_snapshot
    if (isDealPricingSnapshot(snap)) {
      setPricingBaseMode(snap.baseMode)
      setPricingPackageId(snap.packageId)
      setPricingServiceId(snap.serviceId)
      setPricingOvertimeServiceId(snap.overtimeServiceId)
      setPricingPerformanceHours(snap.performanceHours)
      setPricingAddonQty(snap.addonQuantities ?? {})
      setPricingSurchargeIds(snap.surchargeIds ?? [])
      setPricingDiscountIds(snap.discountIds ?? [])
    } else {
      resetPricingFromCatalog(hasTimes ? sPart.date : ed)
    }
    setEditDeal(deal)
    setDealFormTab('basics')
    setAddOpen(true)
  }

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleVenueSelect = (venueId: string) => {
    setField('venue_id', venueId)
    const v = venues.find(vn => vn.id === venueId)
    setField('venue_capacity', v?.capacity ?? '')
    setField('onsite_contact_id', '')
    if (v && (v.outreach_track ?? 'pipeline') === 'community') {
      setField('commission_tier', 'artist_network')
    } else if (v && !editDeal) {
      setField('commission_tier', 'new_doors')
    }
  }

  const handleSave = async () => {
    const gross = parseFloat(form.gross_amount)
    if (!form.description.trim() || isNaN(gross) || gross <= 0) return
    const promiseDoc = buildPromiseLinesDocV2FromUi(
      promisePresets,
      promiseCustomLines,
      artistPromisePresets,
      artistPromiseCustomLines,
    )
    if (promiseDoc.venue.lines.length === 0) {
      showFormToast('Select at least one venue recap line (or add a custom line).')
      setDealFormTab('recap')
      return
    }
    setSaving(true)

    if (form.venue_id) {
      const cur = venues.find(v => v.id === form.venue_id)
      const cap = form.venue_capacity.trim() || null
      if (cur && (cur.capacity ?? null) !== cap) {
        const ur = await updateVenue(form.venue_id, { capacity: cap })
        if (ur.error) {
          setSaving(false)
          showFormToast(ur.error.message ?? 'Could not update venue capacity')
          return
        }
        await refetchVenues()
      }
    }

    let agreementUrl: string | null = form.agreement_url.trim() || null
    const agreementFileId = form.agreement_generated_file_id.trim() || null
    if (agreementFileId) {
      const { data: f } = await supabase
        .from('generated_files')
        .select('*')
        .eq('id', agreementFileId)
        .maybeSingle()
      if (f && (f as GeneratedFile).output_format === 'pdf') {
        const href = resolvedPdfHrefFromOrigin(f as GeneratedFile, publicSiteOrigin())
        if (href) agreementUrl = href
      }
    }
    const linkedVenue = form.venue_id ? venues.find(vn => vn.id === form.venue_id) : undefined
    const isCommunityVenue = linkedVenue && (linkedVenue.outreach_track ?? 'pipeline') === 'community'
    const commissionTier: CommissionTier = isCommunityVenue
      ? 'artist_network'
      : form.commission_tier === 'artist_network'
        ? 'new_doors'
        : form.commission_tier

    const showDate = form.event_date.trim()
    const st = form.event_start_time.trim()
    const et = form.event_end_time.trim()
    let event_start_at: string | null = null
    let event_end_at: string | null = null
    if (showDate && st && et) {
      const [sh, sm] = st.split(':').map(Number)
      const [eh, em] = et.split(':').map(Number)
      let endYmd = showDate
      if (Number.isFinite(sh) && Number.isFinite(sm) && Number.isFinite(eh) && Number.isFinite(em)) {
        if (eh * 60 + em <= sh * 60 + sm) endYmd = addCalendarDaysPacific(showDate, 1)
      }
      const sIso = pacificWallToUtcIso(showDate, st)
      const eIso = pacificWallToUtcIso(endYmd, et)
      if (sIso && eIso) {
        event_start_at = sIso
        event_end_at = eIso
      }
    }

    let performance_start_at: string | null = null
    let performance_end_at: string | null = null
    const pst = form.performance_start_time.trim()
    const pet = form.performance_end_time.trim()
    if (showDate && pst && pet) {
      const [psh, psm] = pst.split(':').map(Number)
      const [peh, pem] = pet.split(':').map(Number)
      let endYmdP = showDate
      if (Number.isFinite(psh) && Number.isFinite(psm) && Number.isFinite(peh) && Number.isFinite(pem)) {
        if (peh * 60 + pem <= psh * 60 + psm) endYmdP = addCalendarDaysPacific(showDate, 1)
      }
      const psIso = pacificWallToUtcIso(showDate, pst)
      const peIso = pacificWallToUtcIso(endYmdP, pet)
      if (psIso && peIso) {
        performance_start_at = psIso
        performance_end_at = peIso
      }
    }

    let onsite_contact_id: string | null = form.onsite_contact_id.trim() || null
    if (onsite_contact_id && form.venue_id) {
      const ok = venueContacts.some(c => c.id === onsite_contact_id && c.venue_id === form.venue_id)
      if (!ok) onsite_contact_id = null
    } else if (!form.venue_id) {
      onsite_contact_id = null
    }

    const tentativeId = editDeal?.id ?? '__new__'
    const tentative: Pick<Deal, 'id' | 'event_start_at' | 'event_end_at'> = {
      id: tentativeId,
      event_start_at,
      event_end_at,
    }
    const overlaps = overlappingDealIds(
      tentative,
      deals.map(d => ({ id: d.id, event_start_at: d.event_start_at, event_end_at: d.event_end_at })),
    )
    if (overlaps.length > 0) {
      const ok = window.confirm(
        'This show overlaps another deal in time (Pacific). Save anyway?',
      )
      if (!ok) {
        setSaving(false)
        return
      }
    }

    const depPaidRaw = parseFloat(form.deposit_paid_amount)
    const depositPaidSafe = !isNaN(depPaidRaw) && depPaidRaw >= 0 ? depPaidRaw : 0

    let pricingSnapshotPayload: import('@/types').DealPricingSnapshot | null = null
    if (pricingComputed && canLogDeal) {
      const roundedFormGross = Math.round(gross)
      const finalSource: DealPricingFinalSource =
        pricingComputed.gross === roundedFormGross ? 'calculated' : 'manual'
      pricingSnapshotPayload = {
        ...pricingComputed.snapshot,
        finalSource,
        computedAt: new Date().toISOString(),
      }
    } else if (editDeal?.pricing_snapshot && isDealPricingSnapshot(editDeal.pricing_snapshot)) {
      pricingSnapshotPayload = editDeal.pricing_snapshot
    }

    const payload = {
      description: form.description.trim(),
      venue_id: form.venue_id || null,
      event_date: showDate || null,
      event_start_at,
      event_end_at,
      performance_genre: form.performance_genre.trim() || null,
      performance_start_at,
      performance_end_at,
      onsite_contact_id,
      gross_amount: gross,
      commission_tier: commissionTier,
      payment_due_date: form.payment_due_date || null,
      agreement_url: agreementUrl,
      agreement_generated_file_id: agreementFileId,
      promise_lines: promiseDoc,
      pricing_snapshot: pricingSnapshotPayload,
      deposit_due_amount: pricingSnapshotPayload?.depositDue ?? editDeal?.deposit_due_amount ?? null,
      deposit_paid_amount: depositPaidSafe,
      notes: form.notes || null,
    }
    let saved: Deal | null = null
    if (editDeal) {
      const r = await updateDeal(editDeal.id, payload)
      if (r.error) {
        setSaving(false)
        showFormToast(r.error.message ?? 'Save failed')
        return
      }
      saved = r.data ?? null
    } else {
      const r = await addDeal(payload)
      if (r.error) {
        setSaving(false)
        showFormToast(r.error.message ?? 'Save failed')
        return
      }
      saved = r.data ?? null
    }

    if (saved) {
      const vAfter = saved.venue_id ? venues.find(v => v.id === saved.venue_id) ?? saved.venue : saved.venue
      const vBefore = editDeal
        ? venues.find(v => v.id === editDeal.venue_id) ?? editDeal.venue
        : null
      await syncDealCalendarSideEffects({
        beforeDeal: editDeal,
        afterDeal: saved,
        venueBefore: vBefore,
        venueAfter: vAfter ?? null,
        artistEmail: profile?.artist_email,
      })
      await refetch()
      await refreshNavBadges()
    }

    setSaving(false)
    setAddonPickerOpen(false)
    setAddOpen(false)
    if (!editDeal) setDealsPage(1)
  }

  const handleToggleArtist = async (deal: Deal) => {
    setToggling(`artist-${deal.id}`)
    await toggleArtistPaid(deal.id, !deal.artist_paid)
    setToggling(null)
  }

  const handleToggleManager = async (deal: Deal) => {
    setToggling(`manager-${deal.id}`)
    await toggleManagerPaid(deal.id, !deal.manager_paid)
    setToggling(null)
  }

  const combinedOutstanding = stats.outstanding + retainerStats.outstanding

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Performance form toast */}
      {formToast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg border bg-neutral-900 border-emerald-500/30 text-emerald-400">
          {formToast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-neutral-800 p-0.5 bg-neutral-900/80">
          <button
            type="button"
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
              earningsSection === 'deals' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300',
            )}
            onClick={() => goEarningsSection('deals')}
          >
            Deals
          </button>
          <button
            type="button"
            className={cn(
              'px-3 py-1.5 text-xs font-semibold rounded-md transition-colors',
              earningsSection === 'pricing' ? 'bg-neutral-700 text-white' : 'text-neutral-500 hover:text-neutral-300',
            )}
            onClick={() => goEarningsSection('pricing')}
          >
            Pricing &amp; fees
          </button>
        </div>
        {earningsSection === 'pricing' && !pricingCatalog.loading ? (
          <div className="flex flex-wrap items-center gap-2 justify-end">
            {pricingToolbarError ? (
              <span className="text-xs text-red-400 max-w-[200px] sm:max-w-none">{pricingToolbarError}</span>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => void onPricingCopyJson()}
            >
              <Copy className="h-3.5 w-3.5" /> Copy JSON
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={onPricingDownloadJson}>
              <Download className="h-3.5 w-3.5" /> Download JSON
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => pricingPanelRef.current?.openImport()}
            >
              <Upload className="h-3.5 w-3.5" /> Import…
            </Button>
          </div>
        ) : null}
      </div>

      {earningsSection === 'pricing' && (
        <EarningsPricingPanel ref={pricingPanelRef} catalog={pricingCatalog} />
      )}

      {earningsSection === 'deals' && (
        <>
      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {combinedOutstanding > 0 && (
          <div className="flex flex-wrap items-baseline justify-end gap-x-2 gap-y-0.5 text-xs leading-tight">
            <span className="inline-flex items-center gap-1.5 text-neutral-500">
              <Clock className="h-3.5 w-3.5 shrink-0 text-orange-400" aria-hidden />
              <span>
                Combined outstanding
                <span className="hidden sm:inline text-neutral-600">
                  {' '}
                  · commission{retainerStats.outstanding > 0 ? ' + retainer' : ''}
                </span>
              </span>
            </span>
            <span className="font-semibold tabular-nums text-orange-400">{fmtMoney(combinedOutstanding)}</span>
          </div>
        )}

        {/* Financial overview — compact strip; detail lives in Deals + Retainer */}
        <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-neutral-800">
            <div className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Bookings (gross)</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-neutral-100 truncate min-w-0" title={fmtMoney(artistBookingStats.totalGrossLogged)}>
                {fmtMoney(artistBookingStats.totalGrossLogged)}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 leading-snug tabular-nums min-w-0">
                <span className="text-neutral-400">{artistBookingStats.dealCount}</span>
                {' '}deal{artistBookingStats.dealCount !== 1 ? 's' : ''}
                <span className="text-neutral-600"> · </span>
                {fmtMoney(artistBookingStats.grossMarkedPaid)} marked paid
              </p>
            </div>
            <div className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Commission</p>
              <p
                className={cn(
                  'mt-0.5 text-lg font-semibold tabular-nums truncate min-w-0',
                  stats.outstanding > 0 ? 'text-orange-400' : 'text-neutral-100',
                )}
                title={fmtMoney(stats.outstanding > 0 ? stats.outstanding : stats.earned)}
              >
                {fmtMoney(stats.outstanding > 0 ? stats.outstanding : stats.earned)}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 leading-snug tabular-nums min-w-0">
                {stats.outstanding > 0 ? (
                  <>
                    Earned {fmtMoney(stats.earned)}
                    <span className="text-neutral-600"> · </span>
                    Recv {fmtMoney(stats.received)}
                  </>
                ) : (
                  <>
                    Recv {fmtMoney(stats.received)}
                  </>
                )}
                <span className="text-neutral-600"> · </span>
                {stats.count} deal{stats.count !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Retainer</p>
              <p
                className={cn(
                  'mt-0.5 text-lg font-semibold tabular-nums truncate min-w-0',
                  retainerStats.outstanding > 0 ? 'text-orange-400' : 'text-green-400/90',
                )}
                title={fmtMoney(retainerStats.outstanding > 0 ? retainerStats.outstanding : retainerStats.received)}
              >
                {fmtMoney(retainerStats.outstanding > 0 ? retainerStats.outstanding : retainerStats.received)}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-500 leading-snug tabular-nums min-w-0">
                {retainerStats.outstanding > 0 ? (
                  <>
                    Recv {fmtMoney(retainerStats.received)}
                    <span className="text-neutral-600"> · </span>
                    Inv {fmtMoney(retainerStats.invoiced)}
                  </>
                ) : (
                  <>Inv {fmtMoney(retainerStats.invoiced)}</>
                )}
                <span className="text-neutral-600"> · </span>
                {fees.length} mo
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Deals (gross = artist booking; My cut = your commission) ───── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="flex items-center gap-2 min-w-0 sm:flex-1">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest shrink-0">
              Deals
            </h2>
            <div className="hidden sm:block flex-1 min-w-[1rem] h-px bg-neutral-800" />
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end sm:shrink-0">
            <p className="text-xs text-neutral-500 tabular-nums">
              {deals.length} deal{deals.length !== 1 ? 's' : ''} logged
            </p>
            <Button onClick={openAdd}>
              <Plus className="h-3.5 w-3.5" />
              Log deal
            </Button>
          </div>
        </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <p className="font-medium text-neutral-400 text-sm mb-1">No deals logged yet</p>
          <p className="text-xs text-neutral-500 mb-4">Log a booking to track artist gross and your commission (if any).</p>
          <Button variant="outline" size="sm" onClick={openAdd}>Log first deal</Button>
        </div>
      ) : (
        <div className="rounded border border-neutral-800 overflow-hidden bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950">
                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs">Deal</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Tier</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-500 text-xs">Gross</th>
                <th className="text-right px-3 py-2.5 font-medium text-neutral-500 text-xs">My cut</th>
                <th className="text-center px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">Artist paid</th>
                <th className="text-center px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">I got paid</th>
                <th className="px-3 py-2.5 w-16" />
              </tr>
            </thead>
            <tbody>
              {deals.slice((dealsPage - 1) * PAGE_SIZE, dealsPage * PAGE_SIZE).map(deal => (
                <tr
                  key={deal.id}
                  id={`earnings-deal-${deal.id}`}
                  className={cn(
                    'border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50 transition-colors',
                    deal.event_cancelled_at && 'opacity-[0.88]',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-100 leading-tight flex items-center gap-2 flex-wrap">
                      {deal.description}
                      {deal.event_cancelled_at && (
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400/95 bg-red-950/50 border border-red-900/50 px-1.5 py-0.5 rounded">
                          Off calendar
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {deal.venue && (
                        <span className="text-xs text-neutral-500">{deal.venue.name}</span>
                      )}
                      {(deal.event_start_at && deal.event_end_at) ? (
                        <span className="text-xs text-neutral-600 tabular-nums">
                          {utcIsoToPacificDateAndTime(deal.event_start_at)?.date}{' '}
                          {utcIsoToPacificDateAndTime(deal.event_start_at)?.time}–
                          {utcIsoToPacificDateAndTime(deal.event_end_at)?.time} PT
                        </span>
                      ) : deal.event_date ? (
                        <span className="text-xs text-neutral-600">{deal.event_date}</span>
                      ) : null}
                      {/* Commission flagged indicator */}
                      {perfReports.some(r => r.deal_id === deal.id && r.commission_flagged) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          Commission
                        </span>
                      )}
                      {/* Report received indicator */}
                      {perfReports.some(r => r.deal_id === deal.id && r.submitted) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          Report received
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 hidden sm:table-cell">
                    <Badge variant={TIER_BADGE_VARIANT[deal.commission_tier]}>
                      {COMMISSION_TIER_LABELS[deal.commission_tier]}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className="text-neutral-200 font-medium tabular-nums">{fmtMoney(deal.gross_amount)}</span>
                    <div className="text-xs text-neutral-600 tabular-nums">{Math.round(deal.commission_rate * 100)}%</div>
                  </td>
                  <td className="px-3 py-3 text-right">
                    <span className={cn(
                      'font-bold tabular-nums',
                      deal.manager_paid ? 'text-green-400' : deal.artist_paid ? 'text-orange-400' : 'text-neutral-300'
                    )}>
                      {fmtMoney(deal.commission_amount)}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <div className="flex justify-center">
                      <PayToggle
                        label="Artist"
                        paid={deal.artist_paid}
                        date={deal.artist_paid_date}
                        onToggle={() => handleToggleArtist(deal)}
                        disabled={toggling === `artist-${deal.id}`}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3 text-center hidden md:table-cell">
                    <div className="flex justify-center">
                      <PayToggle
                        label="Me"
                        paid={deal.manager_paid}
                        date={deal.manager_paid_date}
                        onToggle={() => handleToggleManager(deal)}
                        disabled={toggling === `manager-${deal.id}` || !deal.artist_paid}
                      />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-1 justify-end">
                      {deal.event_cancelled_at ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-emerald-600 hover:text-emerald-400"
                          title="Put show back on calendar"
                          onClick={() => setCalendarConfirm({ deal, mode: 'on' })}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      ) : dealHasShowTimes(deal) ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-neutral-500 hover:text-red-400"
                          title="Cancel show — removes from calendar (keeps deal in Earnings)"
                          onClick={() => setCalendarConfirm({ deal, mode: 'off' })}
                        >
                          <CalendarOff className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                      {/* Send performance report form — only when venue is linked and no existing report for this deal */}
                      {deal.venue_id && !perfReports.some(r => r.deal_id === deal.id) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-neutral-500 hover:text-blue-400"
                          title="Send performance report form to artist"
                          onClick={() => handleSendPerfForm(deal)}
                          disabled={sendingFormDealId === deal.id}
                        >
                          <ClipboardList className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-neutral-400 hover:text-neutral-100"
                        title="Send email to venue contact"
                        onClick={() => setSendEmailDeal(deal)}
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(deal)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-400"
                        onClick={() => setConfirmDelete(deal)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {deals.length > 1 && (
              <tfoot>
                <tr className="border-t border-neutral-800 bg-neutral-950">
                  <td colSpan={3} className="px-4 py-2.5 text-xs text-neutral-500 hidden sm:table-cell">
                    {deals.length} deals
                  </td>
                  <td className="px-3 py-2.5 text-right font-bold text-neutral-100 tabular-nums">
                    {fmtMoney(stats.totalCommission)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
      <Paginator page={dealsPage} total={deals.length} onPage={setDealsPage} />

      {/* Add / Edit dialog — tabbed so it fits the viewport */}
      <Dialog
        open={addOpen}
        onOpenChange={open => {
          if (!open) {
            setAddonPickerOpen(false)
            setAddOpen(false)
          }
        }}
      >
        <DialogContent className="flex h-[min(92dvh,52rem)] max-h-[min(92dvh,52rem)] w-full max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md">
          <DialogHeader className="shrink-0 space-y-0 border-b border-neutral-800 px-6 pb-3 pt-6 pr-14">
            <DialogTitle>{editDeal ? 'Edit deal' : 'Log a deal'}</DialogTitle>
          </DialogHeader>

          <div
            className="shrink-0 border-b border-neutral-800 px-4 pt-2 pb-2"
            role="tablist"
            aria-label="Deal form sections"
          >
            <div className="flex gap-0.5 rounded-lg border border-neutral-700/90 bg-neutral-900/90 p-1">
              {DEAL_FORM_TABS.map(t => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={dealFormTab === t.id}
                  className={cn(
                    'min-w-0 flex-1 rounded-md px-2 py-1.5 text-center text-[11px] font-semibold transition-colors',
                    dealFormTab === t.id
                      ? 'bg-neutral-600 text-white shadow-sm'
                      : 'text-neutral-500 hover:bg-neutral-800/80 hover:text-neutral-300',
                  )}
                  onClick={() => setDealFormTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3">
            {dealFormTab === 'basics' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Description *</Label>
                  <Input
                    value={form.description}
                    onChange={e => setField('description', e.target.value)}
                    placeholder="e.g. Private event at Blue Room"
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label>Show date (Pacific)</Label>
                  <Input
                    type="date"
                    value={form.event_date}
                    onChange={e => setField('event_date', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Start time</Label>
                    <Input
                      type="time"
                      value={form.event_start_time}
                      onChange={e => setField('event_start_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>End time</Label>
                    <Input
                      type="time"
                      value={form.event_end_time}
                      onChange={e => setField('event_end_time', e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-neutral-600 leading-snug">
                  If end is earlier than start on the same day, end is treated as the next calendar day (overnight gig).
                </p>
                <div className="space-y-1">
                  <Label>Genre (performance)</Label>
                  <Input
                    value={form.performance_genre}
                    onChange={e => setField('performance_genre', e.target.value)}
                    placeholder="e.g. House, open format"
                  />
                </div>
                <p className="text-[10px] font-medium text-neutral-500">DJ / performance set (optional)</p>
                <p className="text-[10px] text-neutral-600 leading-snug -mt-1">
                  Uses the same show date as above. Leave blank if the set matches the event window.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Set start</Label>
                    <Input
                      type="time"
                      value={form.performance_start_time}
                      onChange={e => setField('performance_start_time', e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Set end</Label>
                    <Input
                      type="time"
                      value={form.performance_end_time}
                      onChange={e => setField('performance_end_time', e.target.value)}
                    />
                  </div>
                </div>
                {form.venue_id ? (
                  <>
                    <div className="space-y-1">
                      <Label>Venue capacity</Label>
                      <Input
                        value={form.venue_capacity}
                        onChange={e => setField('venue_capacity', e.target.value)}
                        placeholder="e.g. 500"
                      />
                      <p className="text-[10px] text-neutral-600 leading-snug">
                        Saved on the venue record. You can also edit under{' '}
                        <a href="/outreach" className="text-neutral-400 underline hover:text-neutral-200">
                          Outreach
                        </a>
                        .
                      </p>
                    </div>
                    <div className="space-y-1">
                      <Label>On-site contact</Label>
                      <Select
                        value={form.onsite_contact_id || '__none__'}
                        onValueChange={v =>
                          setField('onsite_contact_id', v === '__none__' ? '' : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Optional — defaults in File Builder" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">None (use primary in File Builder)</SelectItem>
                          {venueContacts.map(c => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                              {c.role ? ` · ${c.role}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Input
                    value={form.notes}
                    onChange={e => setField('notes', e.target.value)}
                    placeholder="Any deal notes…"
                  />
                </div>
              </div>
            )}

            {dealFormTab === 'terms' && (
              <div className="space-y-3">
                {canLogDeal && pricingComputed && (
                  <div className="rounded-md border border-neutral-700 bg-neutral-900/50 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Price calculator</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-neutral-400">Base</Label>
                        <Select
                          value={pricingBaseMode}
                          onValueChange={v => setPricingBaseMode(v as 'package' | 'hourly')}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="package">Package</SelectItem>
                            <SelectItem value="hourly">Hourly / flat service</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {pricingBaseMode === 'package' ? (
                        <div className="space-y-1 col-span-2">
                          <Label className="text-neutral-400">Package</Label>
                          <Select
                            value={pricingPackageId ?? '__none__'}
                            onValueChange={v => setPricingPackageId(v === '__none__' ? null : v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {pricingCatalog.doc.packages.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ) : (
                        <div className="space-y-1 col-span-2">
                          <Label className="text-neutral-400">Service rate</Label>
                          <Select
                            value={pricingServiceId ?? '__none__'}
                            onValueChange={v => setPricingServiceId(v === '__none__' ? null : v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {pricingCatalog.doc.services.map(s => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} (${s.price}{s.priceType === 'per_hour' ? '/hr' : ' flat'})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {pricingBaseMode === 'package' && (
                        <div className="space-y-1 col-span-2">
                          <Label className="text-neutral-400">Overtime hourly rate (service)</Label>
                          <Select
                            value={pricingOvertimeServiceId ?? '__none__'}
                            onValueChange={v => setPricingOvertimeServiceId(v === '__none__' ? null : v)}
                          >
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">—</SelectItem>
                              {pricingCatalog.doc.services.filter(s => s.priceType === 'per_hour').map(s => (
                                <SelectItem key={s.id} value={s.id}>{s.name} (${s.price}/hr)</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1 col-span-2">
                        <Label className="text-neutral-400">Performance hours</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.5}
                          value={pricingPerformanceHours}
                          onChange={e => setPricingPerformanceHours(Number(e.target.value) || 0)}
                        />
                        {pricingBaseMode === 'hourly' &&
                          pricingCatalog.doc.policies.minimumBillableHours > 0 &&
                          pricingPerformanceHours < pricingCatalog.doc.policies.minimumBillableHours ? (
                          <p className="text-[10px] text-amber-500/90 leading-snug">
                            Billable hours for pricing use the catalog minimum (
                            {pricingCatalog.doc.policies.minimumBillableHours} h). You entered{' '}
                            {pricingPerformanceHours} h — the calculator uses the higher of the two.
                          </p>
                        ) : null}
                      </div>
                    </div>
                    {pricingCatalog.doc.addons.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-neutral-500">Add-ons</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 text-xs"
                            onClick={() => setAddonPickerOpen(true)}
                          >
                            {(() => {
                              const n = pricingCatalog.doc.addons.filter(
                                a => (pricingAddonQty[a.id] ?? 0) > 0,
                              ).length
                              return n > 0 ? `${n} selected` : 'Choose add-ons…'
                            })()}
                          </Button>
                        </div>
                        {(() => {
                          const lines = pricingCatalog.doc.addons
                            .filter(a => (pricingAddonQty[a.id] ?? 0) > 0)
                            .map(a => `${a.name} ×${pricingAddonQty[a.id]}`)
                          if (lines.length === 0) return null
                          const text = lines.join(' · ')
                          return (
                            <p className="text-[10px] text-neutral-500 leading-snug line-clamp-2" title={text}>
                              {text}
                            </p>
                          )
                        })()}
                      </div>
                    )}
                    {pricingCatalog.doc.surcharges.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pricingCatalog.doc.surcharges.map(s => {
                          const on = pricingSurchargeIds.includes(s.id)
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() =>
                                setPricingSurchargeIds(prev =>
                                  on ? prev.filter(x => x !== s.id) : [...prev, s.id],
                                )
                              }
                              className={cn(
                                'text-[10px] px-2 py-1 rounded border',
                                on ? 'border-neutral-400 bg-neutral-800 text-white' : 'border-neutral-700 text-neutral-500',
                              )}
                            >
                              {s.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {pricingCatalog.doc.discounts.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {pricingCatalog.doc.discounts.map(d => {
                          const on = pricingDiscountIds.includes(d.id)
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() =>
                                setPricingDiscountIds(prev =>
                                  on ? prev.filter(x => x !== d.id) : [...prev, d.id],
                                )
                              }
                              className={cn(
                                'text-[10px] px-2 py-1 rounded border',
                                on ? 'border-neutral-400 bg-neutral-800 text-white' : 'border-neutral-700 text-neutral-500',
                              )}
                            >
                              {d.name} ({d.percent}%)
                            </button>
                          )
                        })}
                      </div>
                    )}
                    <div className="text-xs space-y-0.5 text-neutral-400 border-t border-neutral-800 pt-2">
                      <div className="flex justify-between">
                        <span>Subtotal + tax</span>
                        <span className="tabular-nums text-neutral-200">
                          {fmtMoney((pricingComputed?.snapshot.subtotalBeforeTax ?? 0) + (pricingComputed?.snapshot.taxAmount ?? 0))}
                        </span>
                      </div>
                      <div className="flex justify-between font-semibold text-neutral-100">
                        <span>Total (rounded)</span>
                        <span className="tabular-nums">{fmtMoney(pricingComputed?.gross ?? 0)}</span>
                      </div>
                      <div className="flex justify-between text-[10px]">
                        <span>Deposit due (catalog %)</span>
                        <span className="tabular-nums">{fmtMoney(pricingComputed?.snapshot.depositDue ?? 0)}</span>
                      </div>
                    </div>
                  </div>
                )}
                {!canLogDeal && (
                  <p className="text-xs text-amber-500/90">
                    Set up at least one package or hourly rate under Pricing &amp; fees to use the calculator.
                  </p>
                )}
                <div className="space-y-1">
                  <Label>Gross amount ($) *</Label>
                  <p className="text-[10px] text-neutral-600 leading-snug">
                    Agreement tokens: <span className="font-mono text-[10px]">gross_amount_display</span> is this
                    field. <span className="font-mono text-[10px]">pricing_total_display</span> comes from the saved
                    calculator snapshot when present.
                  </p>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.gross_amount}
                    onChange={e => setField('gross_amount', e.target.value)}
                    placeholder="0"
                  />
                  {editDeal && pricingComputed && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs mt-1"
                      onClick={() => setField('gross_amount', String(pricingComputed.gross))}
                    >
                      Apply calculated {fmtMoney(pricingComputed.gross)}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Deposit paid ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={form.deposit_paid_amount}
                    onChange={e => setField('deposit_paid_amount', e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Commission tier *</Label>
                  <Select value={form.commission_tier} onValueChange={v => setField('commission_tier', v as CommissionTier)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new_doors">New Doors — 20% (pipeline venue you sourced)</SelectItem>
                      <SelectItem value="kept_doors">Kept Doors — 20% (rebooking from your intro)</SelectItem>
                      <SelectItem value="bigger_doors">Bigger Doors — 10% (artist closed, new client)</SelectItem>
                      <SelectItem value="artist_network">Artist network — 0% (community venue; gross still tracked)</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.venue_id && (venues.find(v => v.id === form.venue_id)?.outreach_track ?? 'pipeline') === 'community' && (
                    <p className="text-[10px] text-neutral-500 leading-snug">
                      This venue is on the community track. Booking commission stays $0; you still log gross and payments for the artist.
                    </p>
                  )}
                </div>
                {previewCommission !== null && (
                  <div className="bg-neutral-800 rounded px-3 py-2 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-neutral-400">
                        {form.commission_tier === 'artist_network' ? 'Booking commission (this deal)' : 'Your commission (this deal)'}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${form.commission_tier === 'artist_network' ? 'text-neutral-300' : 'text-green-400'}`}>
                        {fmtMoney(previewCommission)}
                      </span>
                    </div>
                    {form.commission_tier === 'artist_network' && (
                      <p className="text-[10px] text-neutral-600 leading-snug">
                        Retainers and pipeline deals are unchanged—this line is only the per-show booking commission on artist-network gigs.
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label>Venue (optional)</Label>
                  <Select
                    value={form.venue_id || '__none__'}
                    onValueChange={v => v === '__none__' ? setField('venue_id', '') : handleVenueSelect(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Link to a venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No venue</SelectItem>
                      {venues.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Payment due date</Label>
                  <Input
                    type="date"
                    value={form.payment_due_date}
                    onChange={e => setField('payment_due_date', e.target.value)}
                  />
                </div>
              </div>
            )}

            {dealFormTab === 'agreement' && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Agreement PDF (from Files)</Label>
                  <AgreementPdfPicker
                    value={form.agreement_generated_file_id || null}
                    onChange={id => setField('agreement_generated_file_id', id ?? '')}
                    venueId={form.venue_id || null}
                    dealId={editDeal?.id ?? null}
                    preferScoped
                  />
                  <p className="text-[10px] text-neutral-600 leading-snug">
                    Pick a PDF already in Files to attach to this deal for emails. File Builder can also set this when
                    you save a PDF to the deal. On save, the first-party share URL is stored when available. Use the
                    field below for an external link (DocuSign, Drive), or clear the PDF.
                  </p>
                </div>
                <div className="space-y-1">
                  <Label>Agreement URL (optional manual / external)</Label>
                  <Input
                    type="url"
                    value={form.agreement_url}
                    onChange={e => setField('agreement_url', e.target.value)}
                    placeholder="https://…"
                  />
                  <p className="text-[10px] text-neutral-600">
                    If both PDF and URL are set, saving uses the PDF (first-party link when valid, otherwise the
                    Supabase file URL). Clear this field if it still shows an old broken &quot;/agreements/…&quot; link,
                    pick the PDF above, and save again.
                  </p>
                </div>
              </div>
            )}

            {dealFormTab === 'recap' && (
              <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-900/50 p-3">
                <Label className="text-neutral-300">Venue commitments</Label>
                <p className="text-[10px] text-neutral-500 leading-snug">
                  What the venue promises on the post-show form. Up to 5 custom lines on this side.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-[min(32vh,14rem)] overflow-y-auto pr-1">
                  {SHOW_REPORT_PRESETS.map(p => (
                    <label key={p.id} className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={promisePresets[p.id] ?? false}
                        onChange={e =>
                          setPromisePresets(prev => ({ ...prev, [p.id]: e.target.checked }))
                        }
                        className="rounded border-neutral-600"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Custom lines (venue)</span>
                  {promiseCustomLines.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={line}
                        onChange={e => {
                          const v = e.target.value
                          setPromiseCustomLines(prev => prev.map((s, j) => (j === i ? v : s)))
                        }}
                        placeholder={`Venue custom ${i + 1}`}
                        className="text-sm"
                      />
                      {promiseCustomLines.length > 1 ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 px-2"
                          onClick={() => setPromiseCustomLines(prev => prev.filter((_, j) => j !== i))}
                        >
                          ✕
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  {promiseCustomLines.length < 5 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-neutral-400"
                      onClick={() => setPromiseCustomLines(prev => [...prev, ''])}
                    >
                      + Add venue custom line
                    </Button>
                  ) : null}
                </div>
                <div className="space-y-2 rounded-md border border-neutral-700 bg-neutral-900/50 p-3 mt-3">
                  <Label className="text-neutral-300">Artist (self) commitments</Label>
                  <p className="text-[10px] text-neutral-500 leading-snug">
                    Optional checklist for your side on the post-show form. Up to 5 custom lines.
                  </p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 max-h-[min(28vh,12rem)] overflow-y-auto pr-1">
                    {ARTIST_SHOW_REPORT_PRESETS.map(p => (
                      <label key={p.id} className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={artistPromisePresets[p.id] ?? false}
                          onChange={e =>
                            setArtistPromisePresets(prev => ({ ...prev, [p.id]: e.target.checked }))
                          }
                          className="rounded border-neutral-600"
                        />
                        {p.label}
                      </label>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-neutral-500 uppercase tracking-wide">Custom lines (artist)</span>
                    {artistPromiseCustomLines.map((line, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={line}
                          onChange={e => {
                            const v = e.target.value
                            setArtistPromiseCustomLines(prev => prev.map((s, j) => (j === i ? v : s)))
                          }}
                          placeholder={`Artist custom ${i + 1}`}
                          className="text-sm"
                        />
                        {artistPromiseCustomLines.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="shrink-0 px-2"
                            onClick={() => setArtistPromiseCustomLines(prev => prev.filter((_, j) => j !== i))}
                          >
                            x
                          </Button>
                        ) : null}
                      </div>
                    ))}
                    {artistPromiseCustomLines.length < 5 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-neutral-400"
                        onClick={() => setArtistPromiseCustomLines(prev => [...prev, ''])}
                      >
                        + Add artist custom line
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="mt-0 shrink-0 gap-2 border-t border-neutral-800 bg-neutral-950/90 px-6 py-3 backdrop-blur-sm">
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.description.trim() || !form.gross_amount}
            >
              {saving ? 'Saving…' : editDeal ? 'Save changes' : 'Log deal'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addonPickerOpen} onOpenChange={setAddonPickerOpen}>
        <DialogContent
          overlayClassName="z-[100] bg-black/50"
          className="z-[100] flex max-h-[min(88dvh,36rem)] w-[calc(100vw-1.5rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-neutral-800 px-5 pb-3 pt-5 pr-12">
            <DialogTitle>Add-ons</DialogTitle>
            <DialogDescription className="text-xs text-neutral-500">
              Set quantity for each line. Empty or 0 removes it from the quote.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-3">
            <div className="space-y-3">
              {pricingCatalog.doc.addons.map(a => (
                <div key={a.id} className="flex items-start gap-3 border-b border-neutral-800/80 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm font-medium text-neutral-200 leading-tight">{a.name}</p>
                    <p className="text-[10px] text-neutral-500 mt-0.5">
                      ${a.price}
                      {a.priceType === 'flat_fee'
                        ? ' flat'
                        : a.priceType === 'per_event'
                          ? ' / event'
                          : a.priceType === 'per_artist'
                            ? ' / artist'
                            : a.priceType === 'per_sq_ft'
                              ? ` / ${a.unitLabel ?? 'sq ft'}`
                              : a.priceType === 'per_effect'
                                ? ' / effect'
                                : a.priceType === 'per_setup'
                                  ? ' / setup'
                                  : ''}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <Label className="text-[10px] text-neutral-500 sr-only sm:not-sr-only sm:mb-0">Qty</Label>
                    <Input
                      className="h-9 w-[4.5rem] text-center tabular-nums"
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={pricingAddonQty[a.id] ?? ''}
                      onChange={e => {
                        const raw = e.target.value
                        const n = Number(raw)
                        setPricingAddonQty(prev => {
                          const next = { ...prev }
                          if (!raw.trim() || n <= 0) delete next[a.id]
                          else next[a.id] = Math.floor(n)
                          return next
                        })
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 flex-row items-center justify-between gap-2 border-t border-neutral-800 bg-neutral-950/90 px-5 py-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-neutral-400 hover:text-neutral-200"
              onClick={() => setPricingAddonQty({})}
            >
              Clear all
            </Button>
            <Button type="button" size="sm" onClick={() => setAddonPickerOpen(false)}>
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      </div>

      {/* Confirm delete */}
      {calendarConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => !calendarSaving && setCalendarConfirm(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">
              {calendarConfirm.mode === 'off' ? 'Cancel show?' : 'Restore to calendar?'}
            </h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{calendarConfirm.deal.description}</strong>
              {calendarConfirm.mode === 'off'
                ? ' will be removed from the gig calendar and artist calendar emails for this date. The deal stays here for earnings history.'
                : ' will appear on the gig calendar again when it still meets booking status and venue rules.'}
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" disabled={calendarSaving} onClick={() => setCalendarConfirm(null)}>
                Back
              </Button>
              <Button
                variant={calendarConfirm.mode === 'off' ? 'destructive' : 'default'}
                size="sm"
                disabled={calendarSaving}
                onClick={() => void handleConfirmCalendarAction()}
              >
                {calendarSaving ? 'Saving…' : calendarConfirm.mode === 'off' ? 'Cancel show' : 'Restore'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete deal?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.description}</strong> ({fmtMoney(confirmDelete.commission_amount)} commission) will be permanently removed.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteDeal(confirmDelete.id)
                  setConfirmDelete(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      <SendVenueEmailModal
        open={!!sendEmailDeal}
        onClose={() => setSendEmailDeal(null)}
        deal={sendEmailDeal}
        venue={sendEmailDeal?.venue ? { id: sendEmailDeal.venue.id, name: sendEmailDeal.venue.name, city: null, location: null } : null}
        dealId={sendEmailDeal?.id ?? null}
        venueId={sendEmailDeal?.venue_id ?? null}
      />

      {/* ── Booking requests ─────────────────────────────────────────────── */}
      {(bookingRequestsLoading || bookingRequests.length > 0) && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest shrink-0">Booking Requests</h2>
            <div className="flex-1 min-w-[1rem] h-px bg-neutral-800" />
            <p className="text-xs text-neutral-500 tabular-nums shrink-0">{bookingRequests.length} request{bookingRequests.length !== 1 ? 's' : ''}</p>
          </div>
          {bookingRequestsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-2">
              {bookingRequests.map(req => (
                <div key={req.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {req.venue && (
                          <span className="text-sm font-medium text-neutral-200">{req.venue.name}</span>
                        )}
                        {req.rebook_interest && (
                          <span className={cn(
                            'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded',
                            req.rebook_interest === 'yes' ? 'bg-emerald-900/60 text-emerald-400' :
                            req.rebook_interest === 'maybe' ? 'bg-yellow-900/60 text-yellow-400' :
                            'bg-neutral-800 text-neutral-500'
                          )}>
                            {req.rebook_interest === 'yes' ? 'Interested' : req.rebook_interest === 'maybe' ? 'Maybe' : 'Not now'}
                          </span>
                        )}
                        <span className="text-[10px] text-neutral-600 uppercase tracking-wide">{req.source_kind.replace(/_/g, ' ')}</span>
                      </div>
                      {req.preferred_dates && (
                        <p className="text-xs text-neutral-400">Dates: {req.preferred_dates}</p>
                      )}
                      {req.budget_note && (
                        <p className="text-xs text-neutral-400">Budget: {req.budget_note}</p>
                      )}
                      {req.note && (
                        <p className="text-xs text-neutral-500 leading-relaxed">{req.note}</p>
                      )}
                      <p className="text-[10px] text-neutral-700">{new Date(req.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                    </div>
                    <button
                      onClick={() => deleteBookingRequest(req.id)}
                      className="shrink-0 text-neutral-700 hover:text-red-400 transition-colors p-1"
                      title="Remove request"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Monthly retainer ─────────────────────────────────────────────── */}
      <RetainerTab hideSummary />
        </>
      )}
    </div>
  )
}
