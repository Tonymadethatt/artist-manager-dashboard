import { useState, useMemo } from 'react'
import { Plus, Pencil, Trash2, TrendingUp, DollarSign, Clock, Briefcase } from 'lucide-react'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { useMonthlyFees } from '@/hooks/useMonthlyFees'
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
import { cn } from '@/lib/utils'

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
function fmtMonth(dateStr: string) {
  const [y, m] = dateStr.split('-')
  return `${MONTHS[parseInt(m) - 1]} ${y}`
}

function RetainerTab() {
  const { fees, loading, addPayment, deletePayment, updateFee, addFee } = useMonthlyFees()
  const { profile } = useArtistProfile()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editAmount, setEditAmount] = useState('')
  const [addMonth, setAddMonth] = useState('')
  const [addAmount, setAddAmount] = useState('350')
  const [addOpen, setAddOpen] = useState(false)
  const [expandedFee, setExpandedFee] = useState<string | null>(null)
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
        body: JSON.stringify({ profile, unpaidFees, totalOutstanding: totals.outstanding }),
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
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-xs text-neutral-500 mb-1">Total invoiced</p>
          <p className="text-xl font-bold text-neutral-100">${totals.owed.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <p className="text-xs text-neutral-500 mb-1">Received</p>
          <p className="text-xl font-bold text-green-400">${totals.received.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className={cn(
          'rounded-lg border p-4',
          totals.outstanding > 0 ? 'bg-orange-950 border-orange-800' : 'bg-neutral-900 border-neutral-800'
        )}>
          <p className="text-xs text-neutral-500 mb-1">Outstanding</p>
          <p className={cn('text-xl font-bold', totals.outstanding > 0 ? 'text-orange-400' : 'text-neutral-100')}>
            ${totals.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

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
        {feesWithTotals.map(fee => {
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
  const [activeTab, setActiveTab] = useState<'deals' | 'retainer'>('deals')
  const { deals, loading, addDeal, updateDeal, deleteDeal, toggleArtistPaid, toggleManagerPaid } = useDeals()
  const { venues } = useVenues()
  const [addOpen, setAddOpen] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Deal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)

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
      notes: form.notes || null,
    }
    if (editDeal) {
      await updateDeal(editDeal.id, payload)
    } else {
      await addDeal(payload)
    }
    setSaving(false)
    setAddOpen(false)
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

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-800">
        <button
          onClick={() => setActiveTab('deals')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'deals'
              ? 'border-neutral-300 text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          )}
        >
          Commission deals
        </button>
        <button
          onClick={() => setActiveTab('retainer')}
          className={cn(
            'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
            activeTab === 'retainer'
              ? 'border-neutral-300 text-neutral-100'
              : 'border-transparent text-neutral-500 hover:text-neutral-300'
          )}
        >
          Monthly retainer
        </button>
      </div>

      {activeTab === 'retainer' ? <RetainerTab /> : null}
      {activeTab !== 'deals' ? null : <>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 font-medium">Commission earned</span>
            <TrendingUp className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-100">{fmtMoney(stats.earned)}</div>
          <p className="text-xs text-neutral-500 mt-1">Artist has paid</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 font-medium">Received by you</span>
            <DollarSign className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-bold text-green-400">{fmtMoney(stats.received)}</div>
          <p className="text-xs text-neutral-500 mt-1">In your pocket</p>
        </div>

        <div className={cn(
          'rounded-lg border p-4',
          stats.outstanding > 0 ? 'bg-orange-950 border-orange-800' : 'bg-neutral-900 border-neutral-800'
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 font-medium">Outstanding</span>
            <Clock className={cn('h-4 w-4', stats.outstanding > 0 ? 'text-orange-500' : 'text-neutral-600')} />
          </div>
          <div className={cn('text-2xl font-bold', stats.outstanding > 0 ? 'text-orange-400' : 'text-neutral-100')}>
            {fmtMoney(stats.outstanding)}
          </div>
          <p className="text-xs text-neutral-500 mt-1">Earned but unpaid</p>
        </div>

        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-neutral-500 font-medium">Total commission</span>
            <Briefcase className="h-4 w-4 text-neutral-600" />
          </div>
          <div className="text-2xl font-bold text-neutral-100">{fmtMoney(stats.totalCommission)}</div>
          <p className="text-xs text-neutral-500 mt-1">Across {stats.count} deal{stats.count !== 1 ? 's' : ''}</p>
        </div>
      </div>

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
              {deals.map(deal => (
                <tr key={deal.id} className="border-b border-neutral-800 last:border-0 hover:bg-neutral-800/50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-neutral-100 leading-tight">{deal.description}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {deal.venue && (
                        <span className="text-xs text-neutral-500">{deal.venue.name}</span>
                      )}
                      {deal.event_date && (
                        <span className="text-xs text-neutral-600">{deal.event_date}</span>
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
      </>}
    </div>
  )
}
