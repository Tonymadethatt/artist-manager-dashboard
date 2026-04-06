import { useState, useMemo } from 'react'
import { Send, Calendar, RefreshCw } from 'lucide-react'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { useMetrics } from '@/hooks/useMetrics'
import { useMonthlyFees } from '@/hooks/useMonthlyFees'
import { useTasks } from '@/hooks/useTasks'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useEmailTemplates } from '@/hooks/useEmailTemplates'
import { usePerformanceReports } from '@/hooks/usePerformanceReports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type Preset = '7d' | '30d' | 'custom'

function toDate(str: string) {
  return new Date(str + 'T00:00:00')
}

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function fmtDateDisplay(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function StatRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-800 last:border-0">
      <span className="text-sm text-neutral-400">{label}</span>
      <span className={cn('text-sm font-medium tabular-nums', highlight ? 'text-orange-400' : 'text-neutral-100')}>
        {value}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">{title}</h3>
      {children}
    </div>
  )
}

export default function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const minus7 = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const minus30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

  const [preset, setPreset] = useState<Preset>('7d')
  const [startDate, setStartDate] = useState(minus7)
  const [endDate, setEndDate] = useState(today)
  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [sendMsg, setSendMsg] = useState('')
  const [ccMyself, setCcMyself] = useState(true)
  const [testSending, setTestSending] = useState(false)
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMsg, setTestMsg] = useState('')

  const { venues } = useVenues()
  const { deals } = useDeals()
  const { metrics } = useMetrics()
  const { fees } = useMonthlyFees()
  const { tasks } = useTasks()
  const { profile } = useArtistProfile()
  const { getTemplate } = useEmailTemplates()
  const { reports: perfReports } = usePerformanceReports()

  const reportTemplate = getTemplate('management_report')

  const setPresetRange = (p: Preset) => {
    setPreset(p)
    if (p === '7d') { setStartDate(minus7); setEndDate(today) }
    if (p === '30d') { setStartDate(minus30); setEndDate(today) }
  }

  const inRange = (dateStr: string) => {
    const d = toDate(dateStr)
    return d >= toDate(startDate) && d <= toDate(endDate)
  }

  const report = useMemo(() => {
    // Outreach
    const venuesContacted = venues.filter(v => inRange(v.created_at)).length
    const venuesUpdated = venues.filter(v =>
      v.status !== 'not_contacted' && inRange(v.updated_at)
    ).length
    const venuesBooked = venues.filter(v => v.status === 'booked' && inRange(v.updated_at)).length
    const inDiscussion = venues.filter(v =>
      ['in_discussion', 'agreement_sent'].includes(v.status) && inRange(v.updated_at)
    ).length

    // Deals
    const periodDeals = deals.filter(d => inRange(d.created_at))
    const totalGross = periodDeals.reduce((s, d) => s + d.gross_amount, 0)
    const totalCommission = periodDeals.reduce((s, d) => s + d.commission_amount, 0)
    const commissionEarned = deals.filter(d => d.artist_paid && d.artist_paid_date && inRange(d.artist_paid_date))
      .reduce((s, d) => s + d.commission_amount, 0)
    const commissionReceived = deals.filter(d => d.manager_paid && d.manager_paid_date && inRange(d.manager_paid_date))
      .reduce((s, d) => s + d.commission_amount, 0)
    const allOutstanding = deals.filter(d => d.artist_paid && !d.manager_paid)
      .reduce((s, d) => s + d.commission_amount, 0)

    // Monthly retainer — use actual payment sums, not the boolean paid flag,
    // so partial payments are correctly reflected
    const feeTotal = fees.reduce((s, f) => s + f.amount, 0)
    const feePaid = fees.reduce((s, f) => s + (f.payments ?? []).reduce((p, pay) => p + pay.amount, 0), 0)
    const feeOutstanding = feeTotal - feePaid
    const unpaidMonths = fees.filter(f => {
      const paid = (f.payments ?? []).reduce((ps, p) => ps + p.amount, 0)
      return paid < f.amount
    }).length

    // Metrics
    const periodMetrics = metrics.filter(m => inRange(m.date))
    const partnerships = periodMetrics.filter(m => m.category === 'brand_partnership')
    const partnershipValue = partnerships.reduce((s, m) => s + (m.numeric_value ?? 0), 0)
    const attendance = periodMetrics.filter(m => m.category === 'event_attendance')
    const totalAttendance = attendance.reduce((s, m) => s + (m.numeric_value ?? 0), 0)
    const press = periodMetrics.filter(m => m.category === 'press_mention')
    const totalReach = press.reduce((s, m) => s + (m.numeric_value ?? 0), 0)

    // Tasks
    const completedTasks = tasks.filter(t =>
      t.completed && t.completed_at && inRange(t.completed_at.split('T')[0])
    ).length

    // Performance reports
    const perfInPeriod = perfReports.filter(r => r.submitted && r.submitted_at && inRange(r.submitted_at.split('T')[0]))
    const showsPerformed = perfInPeriod.length
    const rebookingLeads = perfInPeriod.filter(r => r.venue_interest === 'yes').length
    const ratedShows = perfInPeriod.filter(r => r.event_rating !== null)
    const avgRating = ratedShows.length > 0
      ? Math.round((ratedShows.reduce((s, r) => s + (r.event_rating ?? 0), 0) / ratedShows.length) * 10) / 10
      : null
    const totalReportedAttendance = perfInPeriod.reduce((s, r) => s + (r.attendance ?? 0), 0)

    return {
      outreach: { venuesContacted, venuesUpdated, inDiscussion, venuesBooked },
      deals: { count: periodDeals.length, totalGross, totalCommission, commissionEarned, commissionReceived, allOutstanding },
      retainer: { feeTotal, feePaid, feeOutstanding, unpaidMonths },
      metrics: { partnerships: partnerships.length, partnershipValue, attendance: attendance.length, totalAttendance, press: press.length, totalReach },
      tasks: { completedTasks },
      performance: { showsPerformed, rebookingLeads, avgRating, totalAttendance: totalReportedAttendance },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, deals, metrics, fees, tasks, perfReports, startDate, endDate])

  const doSend = async (testOnly: boolean) => {
    if (!profile) return
    const setS = testOnly ? setTestSending : setSending
    const setStatus = testOnly ? setTestStatus : setSendStatus
    const setMsg = testOnly ? setTestMsg : setSendMsg

    setS(true)
    setStatus('idle')

    const cc: string[] = ccMyself && profile.manager_email ? [profile.manager_email] : []

    try {
      const res = await fetch('/.netlify/functions/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          report,
          dateRange: { start: startDate, end: endDate },
          cc,
          testOnly,
          custom_subject: reportTemplate?.custom_subject ?? null,
          custom_intro: reportTemplate?.custom_intro ?? null,
          layout: reportTemplate?.layout ?? null,
        }),
      })
      if (res.ok) {
        setStatus('success')
        const recipient = testOnly ? (profile.manager_email ?? 'you') : profile.artist_email
        setMsg(`Report sent to ${recipient}`)
      } else if (res.status === 404) {
        setStatus('error')
        setMsg('Functions not found — this only works on the deployed Netlify site, not localhost.')
      } else {
        const err = await res.json().catch(() => ({}))
        setStatus('error')
        setMsg((err as { message?: string }).message ?? 'Send failed. Check Netlify function logs.')
      }
    } catch {
      setStatus('error')
      setMsg('Functions only run on the deployed site — open your Netlify URL to send real emails.')
    }
    setS(false)
  }

  const handleSend = () => doSend(false)
  const handleTestSend = () => doSend(true)

  return (
    <div className="space-y-5 max-w-2xl">
      {/* Date range */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-200">Date range</span>
        </div>
        <div className="flex gap-2 mb-3">
          {(['7d', '30d', 'custom'] as Preset[]).map(p => (
            <button
              key={p}
              onClick={() => setPresetRange(p)}
              className={cn(
                'px-3 py-1.5 rounded text-xs font-medium transition-colors',
                preset === p
                  ? 'bg-neutral-200 text-neutral-900'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700'
              )}
            >
              {p === '7d' ? 'Last 7 days' : p === '30d' ? 'Last 30 days' : 'Custom'}
            </button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>From</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>To</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
        {preset !== 'custom' && (
          <p className="text-xs text-neutral-500">{fmtDateDisplay(startDate)} → {fmtDateDisplay(endDate)}</p>
        )}
      </div>

      {/* Report preview */}
      <Section title="Outreach activity">
        <StatRow label="New venues added" value={String(report.outreach.venuesContacted)} />
        <StatRow label="Venues engaged (status updated)" value={String(report.outreach.venuesUpdated)} />
        <StatRow label="Active discussions" value={String(report.outreach.inDiscussion)} />
        <StatRow label="Bookings confirmed" value={String(report.outreach.venuesBooked)} />
      </Section>

      <Section title="Deals & revenue">
        <StatRow label="New deals logged" value={String(report.deals.count)} />
        <StatRow label="Total artist revenue" value={fmtMoney(report.deals.totalGross)} />
        <StatRow label="Commission generated" value={fmtMoney(report.deals.totalCommission)} />
        <StatRow label="Commission earned (artist paid)" value={fmtMoney(report.deals.commissionEarned)} />
        <StatRow label="Commission received by you" value={fmtMoney(report.deals.commissionReceived)} />
        <StatRow
          label="Outstanding commission balance"
          value={fmtMoney(report.deals.allOutstanding)}
          highlight={report.deals.allOutstanding > 0}
        />
      </Section>

      <Section title="Monthly retainer">
        <StatRow label="Total invoiced (all time)" value={fmtMoney(report.retainer.feeTotal)} />
        <StatRow label="Total received" value={fmtMoney(report.retainer.feePaid)} />
        <StatRow
          label="Retainer balance owed"
          value={fmtMoney(report.retainer.feeOutstanding)}
          highlight={report.retainer.feeOutstanding > 0}
        />
        {report.retainer.unpaidMonths > 0 && (
          <StatRow
            label="Unpaid months"
            value={String(report.retainer.unpaidMonths)}
            highlight
          />
        )}
      </Section>

      <Section title="Impact metrics">
        <StatRow
          label="Brand partnerships"
          value={report.metrics.partnerships > 0
            ? `${report.metrics.partnerships} (${fmtMoney(report.metrics.partnershipValue)} value)`
            : '0'
          }
        />
        <StatRow
          label="Event attendance"
          value={report.metrics.attendance > 0
            ? `${report.metrics.attendance} event${report.metrics.attendance !== 1 ? 's' : ''} · ${report.metrics.totalAttendance.toLocaleString()} total`
            : '0'
          }
        />
        <StatRow
          label="Press mentions"
          value={report.metrics.press > 0
            ? `${report.metrics.press} (${report.metrics.totalReach.toLocaleString()} reach)`
            : '0'
          }
        />
      </Section>

      <Section title="Tasks">
        <StatRow label="Tasks completed in period" value={String(report.tasks.completedTasks)} />
      </Section>

      {/* Send */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-200">
              Send to {profile?.artist_name ?? 'artist'}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {profile?.artist_email ?? '—'} · from {profile?.from_email ?? '—'}
            </p>
          </div>
        </div>

        {/* CC + send options */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {profile?.manager_email && (
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={ccMyself}
                onChange={e => setCcMyself(e.target.checked)}
                className="rounded border-neutral-700 bg-neutral-800 text-neutral-100 focus:ring-0 focus:ring-offset-0"
              />
              <span className="text-xs text-neutral-400">CC myself ({profile.manager_email})</span>
            </label>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Test send */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleTestSend}
                disabled={testSending || !profile || !profile.manager_email}
              >
                {testSending ? (
                  <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                ) : (
                  'Send test to myself'
                )}
              </Button>
              {testStatus === 'success' && <span className="text-xs text-green-400">{testMsg}</span>}
              {testStatus === 'error' && <span className="text-xs text-red-400">{testMsg}</span>}
            </div>
            {!profile?.manager_email && (
              <p className="text-xs text-amber-500">
                Add your email in <a href="/settings" className="underline hover:text-amber-400">Settings</a> to enable test sends.
              </p>
            )}
          </div>

          {/* Send to artist */}
          <div className="flex items-center gap-2">
            <Button onClick={handleSend} disabled={sending || !profile}>
              {sending ? (
                <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Send to {profile?.artist_name ?? 'artist'}</>
              )}
            </Button>
            {sendStatus === 'success' && <span className="text-xs text-green-400">{sendMsg}</span>}
            {sendStatus === 'error' && <span className="text-xs text-red-400 max-w-[200px]">{sendMsg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
