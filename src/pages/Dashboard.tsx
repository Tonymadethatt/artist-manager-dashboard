import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckSquare, AlertCircle, DollarSign, Inbox,
  ArrowRight, Clock, Building2, Mail,
} from 'lucide-react'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { useMonthlyFees } from '@/hooks/useMonthlyFees'
import { useTasks } from '@/hooks/useTasks'
import { useVenueEmails } from '@/hooks/useVenueEmails'
import { StatusBadge } from '@/components/outreach/StatusBadge'
import {
  VENUE_EMAIL_TYPE_LABELS,
  OUTREACH_STATUS_LABELS,
  type OutreachStatus,
  type VenueEmailType,
} from '@/types'
import { cn } from '@/lib/utils'

// ── Helpers ────────────────────────────────────────────────────────────────

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}, ${y}`
}

function fmtShortDate(iso: string) {
  const [, m, d] = iso.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m) - 1]} ${parseInt(d)}`
}

const PRIORITY_DOT: Record<string, string> = {
  high:   'bg-red-500',
  medium: 'bg-amber-400',
  low:    'bg-neutral-600',
}

const FUNNEL_STATUSES: OutreachStatus[] = [
  'not_contacted', 'reached_out', 'in_discussion', 'agreement_sent', 'booked',
  'performed', 'post_follow_up', 'rebooking', 'closed_won',
]

const FUNNEL_COLORS: Record<OutreachStatus, string> = {
  not_contacted:  'bg-neutral-600',
  reached_out:    'bg-blue-500',
  in_discussion:  'bg-amber-400',
  agreement_sent: 'bg-purple-500',
  booked:         'bg-green-500',
  performed:      'bg-white/80',
  post_follow_up: 'bg-blue-400',
  rebooking:      'bg-amber-400',
  closed_won:     'bg-emerald-500',
  closed_lost:    'bg-red-700',
  rejected:       'bg-red-700',
  archived:       'bg-neutral-700',
}

// ── Sub-components ─────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  to,
}: {
  icon: React.ElementType
  title: string
  to: string
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
      <span className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
        <Icon className="h-4 w-4 text-neutral-500" />
        {title}
      </span>
      <Link to={to} className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1 transition-colors">
        View all <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden', className)}>
      {children}
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return <p className="text-xs text-neutral-600 px-4 py-6 text-center">{msg}</p>
}

// ── Main component ─────────────────────────────────────────────────────────

export default function Dashboard() {
  const { venues, loading: l1 } = useVenues()
  const { deals,  loading: l2 } = useDeals()
  const { fees,   loading: l3 } = useMonthlyFees()
  const { tasks,  loading: l4 } = useTasks()
  const { emails, loading: l5 } = useVenueEmails()

  const today    = new Date().toISOString().split('T')[0]
  const weekEnd  = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  const loading  = l1 || l2 || l3 || l4 || l5

  // ── Stat card counts ─────────────────────────────────────────────────────

  const tasksDueToday = useMemo(() =>
    tasks.filter(t => !t.completed && t.due_date && t.due_date <= today).length,
  [tasks, today])

  const overdueFollowUps = useMemo(() =>
    venues.filter(v =>
      v.follow_up_date &&
      v.follow_up_date < today &&
      !['rejected', 'archived', 'booked'].includes(v.status)
    ).length,
  [venues, today])

  const totalOwed = useMemo(() => {
    const commission = deals
      .filter(d => d.artist_paid && !d.manager_paid)
      .reduce((s, d) => s + d.commission_amount, 0)
    const retainer = fees.reduce((s, f) => {
      const paid = (f.payments ?? []).reduce((p, pay) => p + pay.amount, 0)
      return s + Math.max(0, f.amount - paid)
    }, 0)
    return commission + retainer
  }, [deals, fees])

  const pendingEmailCount = useMemo(() =>
    emails.filter(e => e.status === 'pending').length,
  [emails])

  // ── Row 2: tasks list + follow-ups ────────────────────────────────────────

  const openTasks = useMemo(() =>
    tasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        // overdue / due today first, then by priority
        const aOverdue = a.due_date && a.due_date <= today ? 0 : 1
        const bOverdue = b.due_date && b.due_date <= today ? 0 : 1
        if (aOverdue !== bOverdue) return aOverdue - bOverdue
        const pOrder = { high: 0, medium: 1, low: 2 }
        return pOrder[a.priority] - pOrder[b.priority]
      })
      .slice(0, 6),
  [tasks, today])

  const followUps = useMemo(() =>
    venues
      .filter(v =>
        v.follow_up_date &&
        v.follow_up_date <= weekEnd &&
        !['rejected', 'archived', 'booked'].includes(v.status)
      )
      .sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))
      .slice(0, 6),
  [venues, weekEnd])

  // ── Row 3: financial snapshot ─────────────────────────────────────────────

  const unpaidDeals = useMemo(() =>
    deals
      .filter(d => d.artist_paid && !d.manager_paid)
      .slice(0, 4),
  [deals])

  const commissionOutstanding = useMemo(() =>
    deals.filter(d => d.artist_paid && !d.manager_paid)
      .reduce((s, d) => s + d.commission_amount, 0),
  [deals])

  const unpaidFees = useMemo(() =>
    fees
      .map(f => {
        const paid = (f.payments ?? []).reduce((s, p) => s + p.amount, 0)
        return { ...f, balance: Math.max(0, f.amount - paid) }
      })
      .filter(f => f.balance > 0)
      .slice(0, 4),
  [fees])

  const retainerOutstanding = useMemo(() =>
    fees.reduce((s, f) => {
      const paid = (f.payments ?? []).reduce((p, pay) => p + pay.amount, 0)
      return s + Math.max(0, f.amount - paid)
    }, 0),
  [fees])

  // ── Row 4: outreach funnel + email queue ──────────────────────────────────

  const funnelCounts = useMemo(() => {
    const counts: Record<OutreachStatus, number> = {
      not_contacted: 0, reached_out: 0, in_discussion: 0,
      agreement_sent: 0, booked: 0, performed: 0, post_follow_up: 0,
      rebooking: 0, closed_won: 0, closed_lost: 0, rejected: 0, archived: 0,
    }
    venues.forEach(v => counts[v.status]++)
    return counts
  }, [venues])

  const funnelTotal = useMemo(() =>
    FUNNEL_STATUSES.reduce((s, st) => s + funnelCounts[st], 0),
  [funnelCounts])

  const recentEmails = useMemo(() =>
    [...emails]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5),
  [emails])

  // ── Format helpers for months ─────────────────────────────────────────────

  function fmtMonth(dateStr: string) {
    const [y, m] = dateStr.split('-')
    const months = ['January','February','March','April','May','June',
      'July','August','September','October','November','December']
    return `${months[parseInt(m) - 1]} ${y}`
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-5 w-full min-w-0">
      {/* ── Row 1: Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Tasks due */}
        <Link to="/pipeline" className={cn(
          'rounded-lg border p-4 space-y-2 transition-colors hover:border-neutral-600',
          tasksDueToday > 0 ? 'border-amber-800 bg-amber-950/60' : 'border-neutral-800 bg-neutral-900'
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Tasks due</span>
            <CheckSquare className={cn('h-4 w-4', tasksDueToday > 0 ? 'text-amber-500' : 'text-neutral-600')} />
          </div>
          <div className={cn('text-2xl font-bold tabular-nums', tasksDueToday > 0 ? 'text-amber-400' : 'text-neutral-100')}>
            {tasksDueToday}
          </div>
          <p className="text-xs text-neutral-500">open today</p>
        </Link>

        {/* Overdue follow-ups */}
        <Link to="/outreach" className={cn(
          'rounded-lg border p-4 space-y-2 transition-colors hover:border-neutral-600',
          overdueFollowUps > 0 ? 'border-red-900 bg-red-950/60' : 'border-neutral-800 bg-neutral-900'
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Follow-ups</span>
            <AlertCircle className={cn('h-4 w-4', overdueFollowUps > 0 ? 'text-red-500' : 'text-neutral-600')} />
          </div>
          <div className={cn('text-2xl font-bold tabular-nums', overdueFollowUps > 0 ? 'text-red-400' : 'text-neutral-100')}>
            {overdueFollowUps}
          </div>
          <p className="text-xs text-neutral-500">overdue</p>
        </Link>

        {/* Total owed */}
        <Link to="/earnings" className={cn(
          'rounded-lg border p-4 space-y-2 transition-colors hover:border-neutral-600',
          totalOwed > 0 ? 'border-orange-800 bg-orange-950/60' : 'border-neutral-800 bg-neutral-900'
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Owed to you</span>
            <DollarSign className={cn('h-4 w-4', totalOwed > 0 ? 'text-orange-500' : 'text-neutral-600')} />
          </div>
          <div className={cn('text-2xl font-bold tabular-nums', totalOwed > 0 ? 'text-orange-400' : 'text-neutral-100')}>
            {money(totalOwed)}
          </div>
          <p className="text-xs text-neutral-500">commission + retainer</p>
        </Link>

        {/* Emails pending */}
        <Link to="/email-queue" className={cn(
          'rounded-lg border p-4 space-y-2 transition-colors hover:border-neutral-600',
          pendingEmailCount > 0 ? 'border-blue-900 bg-blue-950/40' : 'border-neutral-800 bg-neutral-900'
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-500 font-medium">Emails pending</span>
            <Inbox className={cn('h-4 w-4', pendingEmailCount > 0 ? 'text-blue-400' : 'text-neutral-600')} />
          </div>
          <div className={cn('text-2xl font-bold tabular-nums', pendingEmailCount > 0 ? 'text-blue-400' : 'text-neutral-100')}>
            {pendingEmailCount}
          </div>
          <p className="text-xs text-neutral-500">awaiting send</p>
        </Link>
      </div>

      {/* ── Row 2: Open tasks + Follow-ups ────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Open tasks */}
        <Card>
          <SectionHeader icon={CheckSquare} title="Open tasks" to="/pipeline" />
          {openTasks.length === 0 ? (
            <EmptyState msg="No open tasks — pipeline is clear." />
          ) : (
            <div className="divide-y divide-neutral-800">
              {openTasks.map(task => {
                const isOverdue = task.due_date && task.due_date < today
                const isDueToday = task.due_date === today
                return (
                  <div key={task.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', PRIORITY_DOT[task.priority])} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 truncate">{task.title}</div>
                      {task.venue?.name && (
                        <div className="text-xs text-neutral-600 truncate">{task.venue.name}</div>
                      )}
                    </div>
                    {task.due_date && (
                      <span className={cn(
                        'text-xs tabular-nums shrink-0 font-medium',
                        isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-neutral-500'
                      )}>
                        {isOverdue ? '⚠ ' : isDueToday ? '→ ' : ''}{fmtShortDate(task.due_date)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Follow-ups */}
        <Card>
          <SectionHeader icon={Clock} title="Follow-ups this week" to="/outreach" />
          {followUps.length === 0 ? (
            <EmptyState msg="All caught up — no follow-ups due." />
          ) : (
            <div className="divide-y divide-neutral-800">
              {followUps.map(v => {
                const isOverdue = v.follow_up_date! < today
                const isDueToday = v.follow_up_date === today
                return (
                  <div key={v.id} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="text-sm font-medium text-neutral-200 truncate">{v.name}</div>
                      <StatusBadge status={v.status} className="mt-0.5" />
                    </div>
                    <span className={cn(
                      'text-xs font-medium tabular-nums shrink-0',
                      isOverdue ? 'text-red-400' : isDueToday ? 'text-amber-400' : 'text-neutral-500'
                    )}>
                      {isOverdue ? '⚠ ' : isDueToday ? '→ ' : ''}{fmtShortDate(v.follow_up_date!)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Financial snapshot ──────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Commission */}
        <Card className={commissionOutstanding > 0 ? 'border-orange-800 bg-orange-950/30' : ''}>
          <SectionHeader icon={DollarSign} title="Commission outstanding" to="/earnings" />
          {unpaidDeals.length === 0 ? (
            <EmptyState msg="No outstanding commission." />
          ) : (
            <>
              <div className="divide-y divide-neutral-800/60">
                {unpaidDeals.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-4 py-2.5">
                      <div className="min-w-0 flex-1 mr-3">
                        <div className="text-sm text-neutral-200 truncate">{d.description}</div>
                        {d.venue?.name && <div className="text-xs text-neutral-600 truncate">{d.venue.name}</div>}
                      </div>
                      <span className="text-sm font-semibold text-orange-400 tabular-nums shrink-0">
                        {money(d.commission_amount)}
                      </span>
                    </div>
                  ))}
              </div>
              <div className="px-4 py-2.5 border-t border-neutral-800/60 flex items-center justify-between">
                <span className="text-xs text-neutral-500">
                  {deals.filter(d => d.artist_paid && !d.manager_paid).length} deal{deals.filter(d => d.artist_paid && !d.manager_paid).length !== 1 ? 's' : ''} unpaid
                </span>
                <span className="text-sm font-bold text-orange-400">{money(commissionOutstanding)}</span>
              </div>
            </>
          )}
        </Card>

        {/* Retainer */}
        <Card className={retainerOutstanding > 0 ? 'border-orange-800 bg-orange-950/30' : ''}>
          <SectionHeader icon={DollarSign} title="Retainer outstanding" to="/earnings" />
          {unpaidFees.length === 0 ? (
            <EmptyState msg="Retainer is fully paid." />
          ) : (
            <>
              <div className="divide-y divide-neutral-800/60">
                {unpaidFees.map(f => (
                  <div key={f.id} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-sm text-neutral-200">{fmtMonth(f.month)}</span>
                    <span className="text-sm font-semibold text-orange-400 tabular-nums">{money(f.balance)}</span>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-neutral-800/60 flex items-center justify-between">
                <span className="text-xs text-neutral-500">{unpaidFees.length} month{unpaidFees.length !== 1 ? 's' : ''} with balance</span>
                <span className="text-sm font-bold text-orange-400">{money(retainerOutstanding)}</span>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* ── Row 4: Outreach funnel + Email queue ───────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Outreach funnel */}
        <Card>
          <SectionHeader icon={Building2} title="Outreach pipeline" to="/outreach" />
          {venues.length === 0 ? (
            <EmptyState msg="No venues tracked yet." />
          ) : (
            <div className="px-4 py-3 space-y-2">
              {FUNNEL_STATUSES.map(status => {
                const count = funnelCounts[status]
                const pct = funnelTotal > 0 ? (count / funnelTotal) * 100 : 0
                return (
                  <div key={status} className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 w-36 shrink-0">
                      <div className={cn('w-2 h-2 rounded-full shrink-0', FUNNEL_COLORS[status])} />
                      <span className="text-xs text-neutral-400 truncate">{OUTREACH_STATUS_LABELS[status]}</span>
                    </div>
                    <div className="flex-1 bg-neutral-800 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', FUNNEL_COLORS[status])}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-neutral-500 tabular-nums w-5 text-right">{count}</span>
                  </div>
                )
              })}
              {(funnelCounts.rejected > 0 || funnelCounts.archived > 0) && (
                <p className="text-xs text-neutral-700 pt-1">
                  {funnelCounts.rejected > 0 && `${funnelCounts.rejected} rejected`}
                  {funnelCounts.rejected > 0 && funnelCounts.archived > 0 && ' · '}
                  {funnelCounts.archived > 0 && `${funnelCounts.archived} archived`}
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Email queue */}
        <Card>
          <SectionHeader icon={Mail} title="Recent emails" to="/email-queue" />
          {recentEmails.length === 0 ? (
            <EmptyState msg="No emails sent yet." />
          ) : (
            <div className="divide-y divide-neutral-800">
              {recentEmails.map(email => {
                const statusColor = email.status === 'sent'
                  ? 'text-green-500'
                  : email.status === 'failed'
                    ? 'text-red-500'
                    : 'text-blue-400'
                const statusDot = email.status === 'sent'
                  ? 'bg-green-500'
                  : email.status === 'failed'
                    ? 'bg-red-500'
                    : 'bg-blue-400'
                return (
                  <div key={email.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className={cn('w-1.5 h-1.5 rounded-full shrink-0', statusDot)} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-neutral-200 truncate">
                        {email.venue?.name ?? email.recipient_email}
                      </div>
                      <div className="text-xs text-neutral-600">
                        {VENUE_EMAIL_TYPE_LABELS[email.email_type as VenueEmailType]
                          ?? (email.email_type.startsWith('custom:') ? 'Custom email' : email.email_type)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn('text-xs font-medium capitalize', statusColor)}>{email.status}</div>
                      <div className="text-[10px] text-neutral-700">{fmtDate(email.created_at.split('T')[0])}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

    </div>
  )
}
