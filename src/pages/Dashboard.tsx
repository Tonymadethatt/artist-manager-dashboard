import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, CheckCircle, Clock, FileText, AlertCircle, ArrowRight } from 'lucide-react'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { StatusBadge } from '@/components/outreach/StatusBadge'
import { cn } from '@/lib/utils'

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
  warn,
}: {
  label: string
  value: number | string
  icon: React.ElementType
  sub?: string
  warn?: boolean
}) {
  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-2',
      warn ? 'border-orange-800 bg-orange-950' : 'border-neutral-800 bg-neutral-900'
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-500 font-medium">{label}</span>
        <Icon className={cn('h-4 w-4', warn ? 'text-orange-500' : 'text-neutral-600')} />
      </div>
      <div className={cn('text-2xl font-bold tabular-nums', warn ? 'text-orange-400' : 'text-neutral-100')}>
        {value}
      </div>
      {sub && <p className="text-xs text-neutral-500">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { venues, loading: venuesLoading } = useVenues()
  const { deals, loading: dealsLoading } = useDeals()
  const today = new Date().toISOString().split('T')[0]
  const thisWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

  const stats = useMemo(() => {
    const total = venues.length
    const booked = venues.filter(v => v.status === 'booked').length
    const pending = venues.filter(v => v.status === 'agreement_sent').length
    const active = venues.filter(v =>
      !['rejected', 'archived', 'booked'].includes(v.status)
    ).length

    const overdueFollowUps = venues.filter(v =>
      v.follow_up_date &&
      v.follow_up_date < today &&
      !['rejected', 'archived', 'booked'].includes(v.status)
    ).length

    const dueThisWeek = venues.filter(v =>
      v.follow_up_date &&
      v.follow_up_date >= today &&
      v.follow_up_date <= thisWeek &&
      !['rejected', 'archived', 'booked'].includes(v.status)
    ).length

    const commissionEarned = deals.filter(d => d.artist_paid).reduce((sum, d) => sum + d.commission_amount, 0)
    const commissionReceived = deals.filter(d => d.manager_paid).reduce((sum, d) => sum + d.commission_amount, 0)
    const outstanding = commissionEarned - commissionReceived

    return { total, booked, pending, active, overdueFollowUps, dueThisWeek, commissionEarned, commissionReceived, outstanding }
  }, [venues, deals, today, thisWeek])

  const recentActivity = useMemo(() => {
    return [...venues]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8)
  }, [venues])

  const followUpsDue = useMemo(() => {
    return venues
      .filter(v =>
        v.follow_up_date &&
        v.follow_up_date <= thisWeek &&
        !['rejected', 'archived', 'booked'].includes(v.status)
      )
      .sort((a, b) => (a.follow_up_date ?? '').localeCompare(b.follow_up_date ?? ''))
      .slice(0, 5)
  }, [venues, thisWeek])

  const loading = venuesLoading || dealsLoading

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total venues" value={stats.total} icon={MapPin} sub={`${stats.active} active`} />
        <StatCard label="Booked" value={stats.booked} icon={CheckCircle} />
        <StatCard label="Agreement sent" value={stats.pending} icon={FileText} />
        <StatCard
          label="Follow-ups overdue"
          value={stats.overdueFollowUps}
          icon={AlertCircle}
          sub={`${stats.dueThisWeek} due this week`}
          warn={stats.overdueFollowUps > 0}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
              <Clock className="h-4 w-4 text-neutral-500" />
              Follow-ups due
            </span>
            <Link to="/outreach" className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {followUpsDue.length === 0 ? (
            <p className="text-xs text-neutral-500 px-4 py-6">No upcoming follow-ups.</p>
          ) : (
            <div>
              {followUpsDue.map(v => {
                const overdue = v.follow_up_date! < today
                return (
                  <Link
                    key={v.id}
                    to="/outreach"
                    className="flex items-center justify-between px-4 py-2.5 hover:bg-neutral-800 transition-colors border-b border-neutral-800 last:border-0"
                  >
                    <div>
                      <div className="text-sm font-medium text-neutral-200">{v.name}</div>
                      <StatusBadge status={v.status} className="mt-0.5" />
                    </div>
                    <span className={cn(
                      'text-xs font-medium tabular-nums',
                      overdue ? 'text-red-500' : 'text-orange-400'
                    )}>
                      {v.follow_up_date}
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
            <span className="text-sm font-semibold text-neutral-100">Recent activity</span>
            <Link to="/outreach" className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-xs text-neutral-500 px-4 py-6">No venues tracked yet.</p>
          ) : (
            <div>
              {recentActivity.map(v => (
                <div key={v.id} className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-200 truncate">{v.name}</div>
                    <div className="text-xs text-neutral-500">{v.city ?? v.location ?? '—'}</div>
                  </div>
                  <StatusBadge status={v.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        'rounded-lg border p-4',
        stats.outstanding > 0 ? 'bg-orange-950 border-orange-800' : 'bg-neutral-900 border-neutral-800'
      )}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-neutral-100">Commission outstanding</span>
          <Link to="/earnings" className="text-xs text-neutral-500 hover:text-neutral-300 flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className={cn(
          'text-2xl font-bold',
          stats.outstanding > 0 ? 'text-orange-400' : 'text-neutral-100'
        )}>
          ${stats.outstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          ${stats.commissionEarned.toLocaleString('en-US', { minimumFractionDigits: 2 })} earned · ${stats.commissionReceived.toLocaleString('en-US', { minimumFractionDigits: 2 })} received
        </p>
      </div>
    </div>
  )
}
