import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, Clock, Briefcase, Mail, ClipboardList, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { useMonthlyFees } from '@/hooks/useMonthlyFees'
import { usePerformanceReports } from '@/hooks/usePerformanceReports'
import { SendVenueEmailModal } from '@/components/emails/SendVenueEmailModal'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import type { Deal, CommissionTier, PaymentMethod } from '@/types'
import { COMMISSION_TIER_LABELS, COMMISSION_TIER_RATES, PAYMENT_METHOD_LABELS } from '@/types'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 10

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
        }),
      })
      if (res.ok) {
        setReminderStatus('success')
        setReminderMsg(`Reminder sent to ${profile.artist_email}`)
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

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 justify-between">
        <div className="flex items-center gap-2">
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
        </div>
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" />
          Add month
        </Button>
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

const TIER_BADGE_VARIANT: Record<CommissionTier, 'blue' | 'purple' | 'warning'> = {
  new_doors: 'blue',
  kept_doors: 'purple',
  bigger_doors: 'warning',
}

const EMPTY_FORM = {
  description: '',
  venue_id: '',
  event_date: '',
  gross_amount: '',
  commission_tier: 'new_doors' as CommissionTier,
  payment_due_date: '',
  agreement_url: '',
  notes: '',
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
  const { deals, loading, addDeal, updateDeal, deleteDeal, toggleArtistPaid, toggleManagerPaid } = useDeals()
  const { venues } = useVenues()
  const { profile } = useArtistProfile()
  const { reports: perfReports, createReport } = usePerformanceReports()
  const { fees } = useMonthlyFees()
  const [dealsPage, setDealsPage] = useState(1)
  const [addOpen, setAddOpen] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const [sendEmailDeal, setSendEmailDeal] = useState<Deal | null>(null)
  const [sendingFormDealId, setSendingFormDealId] = useState<string | null>(null)
  const [formToast, setFormToast] = useState<string | null>(null)

  function showFormToast(msg: string) {
    setFormToast(msg)
    setTimeout(() => setFormToast(null), 3000)
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

  const previewCommission = useMemo(() => {
    const gross = parseFloat(form.gross_amount)
    if (isNaN(gross) || gross <= 0) return null
    return gross * COMMISSION_TIER_RATES[form.commission_tier]
  }, [form.gross_amount, form.commission_tier])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditDeal(null)
    setAddOpen(true)
  }

  const openEdit = (deal: Deal) => {
    setForm({
      description: deal.description,
      venue_id: deal.venue_id ?? '',
      event_date: deal.event_date ?? '',
      gross_amount: String(deal.gross_amount),
      commission_tier: deal.commission_tier,
      payment_due_date: deal.payment_due_date ?? '',
      agreement_url: deal.agreement_url ?? '',
      notes: deal.notes ?? '',
    })
    setEditDeal(deal)
    setAddOpen(true)
  }

  const setField = <K extends keyof typeof form>(key: K, value: typeof form[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  const handleSave = async () => {
    const gross = parseFloat(form.gross_amount)
    if (!form.description.trim() || isNaN(gross) || gross <= 0) return
    setSaving(true)
    const payload = {
      description: form.description.trim(),
      venue_id: form.venue_id || null,
      event_date: form.event_date || null,
      gross_amount: gross,
      commission_tier: form.commission_tier,
      payment_due_date: form.payment_due_date || null,
      agreement_url: form.agreement_url || null,
      notes: form.notes || null,
    }
    if (editDeal) {
      await updateDeal(editDeal.id, payload)
    } else {
      await addDeal(payload)
    }
    setSaving(false)
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

      {/* ── Overview ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Combined outstanding callout — only when money is owed */}
        {combinedOutstanding > 0 && (
          <div className="flex items-center justify-between bg-orange-950/50 border border-orange-800/60 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-400 shrink-0" />
              <span className="text-sm font-medium text-orange-300">Total outstanding</span>
              <span className="text-xs text-orange-500">
                across commission{retainerStats.outstanding > 0 ? ' and retainer' : ''}
              </span>
            </div>
            <span className="text-lg font-bold text-orange-400 tabular-nums">{fmtMoney(combinedOutstanding)}</span>
          </div>
        )}

        {/* Two-panel summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Commission panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Commission</span>
              <Briefcase className="h-3.5 w-3.5 text-neutral-700" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Earned</p>
                <p className="text-base font-bold text-neutral-200 tabular-nums">{fmtMoney(stats.earned)}</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">artist paid</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Received</p>
                <p className="text-base font-bold text-green-400 tabular-nums">{fmtMoney(stats.received)}</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">in your pocket</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Owed</p>
                <p className={cn('text-base font-bold tabular-nums', stats.outstanding > 0 ? 'text-orange-400' : 'text-neutral-500')}>
                  {fmtMoney(stats.outstanding)}
                </p>
                <p className="text-[10px] text-neutral-600 mt-0.5">{stats.count} deal{stats.count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>

          {/* Retainer panel */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-neutral-500">Monthly Retainer</span>
              <TrendingUp className="h-3.5 w-3.5 text-neutral-700" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Invoiced</p>
                <p className="text-base font-bold text-neutral-200 tabular-nums">{fmtMoney(retainerStats.invoiced)}</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">total billed</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Received</p>
                <p className="text-base font-bold text-green-400 tabular-nums">{fmtMoney(retainerStats.received)}</p>
                <p className="text-[10px] text-neutral-600 mt-0.5">in your pocket</p>
              </div>
              <div>
                <p className="text-[10px] text-neutral-600 mb-0.5 uppercase tracking-wide">Owed</p>
                <p className={cn('text-base font-bold tabular-nums', retainerStats.outstanding > 0 ? 'text-orange-400' : 'text-neutral-500')}>
                  {fmtMoney(retainerStats.outstanding)}
                </p>
                <p className="text-[10px] text-neutral-600 mt-0.5">{fees.length} month{fees.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Commission deals ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest">Commission Deals</h2>
          <div className="flex-1 h-px bg-neutral-800" />
        </div>
      <>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {deals.length} deal{deals.length !== 1 ? 's' : ''} logged
        </p>
        <Button onClick={openAdd}>
          <Plus className="h-3.5 w-3.5" />
          Log deal
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <p className="font-medium text-neutral-400 text-sm mb-1">No deals logged yet</p>
          <p className="text-xs text-neutral-500 mb-4">Log a booking or deal to start tracking your commission.</p>
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
                <tr key={deal.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-100 leading-tight">{deal.description}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {deal.venue && (
                        <span className="text-xs text-neutral-500">{deal.venue.name}</span>
                      )}
                      {deal.event_date && (
                        <span className="text-xs text-neutral-600">{deal.event_date}</span>
                      )}
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
        <Paginator page={dealsPage} total={deals.length} onPage={setDealsPage} />
      )}

      {/* Add / Edit dialog */}
      <Dialog open={addOpen} onOpenChange={v => !v && setAddOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editDeal ? 'Edit deal' : 'Log a deal'}</DialogTitle>
          </DialogHeader>
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Gross amount ($) *</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.gross_amount}
                  onChange={e => setField('gross_amount', e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label>Event date</Label>
                <Input
                  type="date"
                  value={form.event_date}
                  onChange={e => setField('event_date', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Commission tier *</Label>
              <Select value={form.commission_tier} onValueChange={v => setField('commission_tier', v as CommissionTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new_doors">New Doors — 20% (deal you sourced)</SelectItem>
                  <SelectItem value="kept_doors">Kept Doors — 20% (rebooking from your intro)</SelectItem>
                  <SelectItem value="bigger_doors">Bigger Doors — 10% (artist closed, new client)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {previewCommission !== null && (
              <div className="bg-neutral-800 rounded px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-neutral-400">Your commission</span>
                <span className="text-sm font-bold text-green-400">{fmtMoney(previewCommission)}</span>
              </div>
            )}

            <div className="space-y-1">
              <Label>Venue (optional)</Label>
              <Select
                value={form.venue_id || '__none__'}
                onValueChange={v => setField('venue_id', v === '__none__' ? '' : v)}
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Payment due date</Label>
                <Input
                  type="date"
                  value={form.payment_due_date}
                  onChange={e => setField('payment_due_date', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Agreement URL</Label>
                <Input
                  type="url"
                  value={form.agreement_url}
                  onChange={e => setField('agreement_url', e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
                placeholder="Any deal notes…"
              />
            </div>
          </div>

          <DialogFooter>
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

      {/* Confirm delete */}
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
      </>
      </div>

      {/* ── Monthly retainer ─────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-300 uppercase tracking-widest">Monthly Retainer</h2>
          <div className="flex-1 h-px bg-neutral-800" />
        </div>
        <RetainerTab hideSummary />
      </div>
    </div>
  )
}
