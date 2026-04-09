import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Copy, RefreshCw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Clock, ExternalLink, Send, Trash2, UserPen } from 'lucide-react'
import { usePerformanceReports } from '@/hooks/usePerformanceReports'
import { useVenues } from '@/hooks/useVenues'
import { useDeals } from '@/hooks/useDeals'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import type { PerformanceReport } from '@/types'
import {
  CANCELLATION_REASON_LABELS,
  formatFrictionTagsForNote,
} from '@/lib/performanceReportV1'
import { useNavBadges } from '@/context/NavBadgesContext'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import type { ManualShowReportLocationState } from '@/pages/ManualShowReport'

function formatDate(iso: string) {
  const [y, m, d] = iso.split('T')[0].split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`
}

function RatingDots({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-neutral-600 text-xs">-</span>
  return (
    <span className="flex gap-0.5 items-center">
      {[1,2,3,4,5].map(i => (
        <span key={i} className={`w-2 h-2 rounded-full ${i <= rating ? 'bg-white' : 'bg-neutral-700'}`} />
      ))}
    </span>
  )
}

function StatusPill({ submitted }: { submitted: boolean }) {
  if (submitted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
        <CheckCircle2 className="h-3 w-3" /> Submitted
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700">
      <Clock className="h-3 w-3" /> Pending
    </span>
  )
}

function PaidStatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-neutral-600 text-xs">-</span>
  const map: Record<string, string> = { yes: 'text-emerald-400', partial: 'text-amber-400', no: 'text-red-400' }
  const labels: Record<string, string> = { yes: 'Paid', partial: 'Partial', no: 'Unpaid' }
  return <span className={`text-xs font-medium ${map[status] ?? 'text-neutral-400'}`}>{labels[status] ?? status}</span>
}

function frictionSummary(report: PerformanceReport): string | null {
  const raw = report.production_friction_tags
  if (!raw || !Array.isArray(raw) || raw.length === 0) return null
  return formatFrictionTagsForNote(raw.filter((x): x is string => typeof x === 'string'))
}

function ReportDetail({ report }: { report: PerformanceReport }) {
  const cancel =
    report.cancellation_reason && report.event_happened !== 'yes'
      ? CANCELLATION_REASON_LABELS[report.cancellation_reason as keyof typeof CANCELLATION_REASON_LABELS] ??
        report.cancellation_reason
      : null
  const fields = [
    { label: 'Did event happen', value: report.event_happened ?? '-' },
    ...(cancel ? [{ label: 'Situation', value: cancel }] : []),
    { label: 'Rating', value: report.event_rating ? `${report.event_rating}/5` : '-' },
    { label: 'Attendance', value: report.attendance != null ? String(report.attendance) : '-' },
    { label: 'Artist paid', value: report.artist_paid_status ?? '-' },
    { label: 'Gig fee (reported)', value: report.fee_total != null ? `$${report.fee_total}` : '-' },
    { label: 'Amount received', value: report.amount_received != null ? `$${report.amount_received}` : '-' },
    { label: 'Disputed owed (claim)', value: report.payment_dispute_claimed_amount != null ? `$${report.payment_dispute_claimed_amount}` : '-' },
    { label: 'Amount reported (legacy)', value: report.payment_amount ? `$${report.payment_amount}` : '-' },
    { label: 'Chase payment ask', value: report.chase_payment_followup ?? '-' },
    { label: 'Payment disagreement', value: report.payment_dispute ?? '-' },
    { label: 'Production / safety', value: report.production_issue_level ?? '-' },
    { label: 'Friction areas', value: frictionSummary(report) ?? '-' },
    { label: 'Venue interest', value: report.venue_interest ?? '-' },
    { label: 'Rebooking timing', value: report.rebooking_timeline?.replace(/_/g, ' ') ?? '-' },
    { label: 'Book next call', value: report.wants_booking_call ?? '-' },
    { label: 'Relationship quality', value: report.relationship_quality ?? '-' },
    { label: 'Play again?', value: report.would_play_again ?? '-' },
    { label: 'Manager contact venue', value: report.wants_manager_venue_contact ?? '-' },
    { label: 'Referral / buyer', value: report.referral_lead ?? '-' },
    { label: 'Submitted by', value: report.submitted_by === 'manager_dashboard' ? 'Manager (dashboard)' : report.submitted_by === 'artist_link' ? 'Artist link' : '-' },
    { label: 'Row created via', value: report.creation_source === 'task_automation' ? 'Task automation' : report.creation_source === 'artist_email' ? 'Emailed to artist' : report.creation_source === 'manager_dashboard' ? 'Manager (no email)' : '-' },
  ]

  return (
    <div className="px-4 pb-4 pt-2 border-t border-neutral-800 bg-neutral-950/50">
      {report.commission_flagged && (
        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-md px-3 py-2 mb-3 mt-1">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-xs text-amber-300">
            {report.submitted_by === 'manager_dashboard'
              ? 'Commission flagged — payment noted on this manager-entered report. Confirm in Earnings before chasing the artist.'
              : 'Commission flagged - artist reported payment. Send a reminder from Earnings.'}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
        {fields.map(f => (
          <div key={f.label} className="flex flex-col">
            <span className="text-[10px] text-neutral-600 uppercase tracking-wide">{f.label}</span>
            <span className="text-xs text-neutral-300 capitalize">{f.value}</span>
          </div>
        ))}
      </div>
      {report.notes && (
        <div className="mb-2">
          <span className="text-[10px] text-neutral-600 uppercase tracking-wide block mb-0.5">Notes</span>
          <p className="text-xs text-neutral-400 leading-relaxed">{report.notes}</p>
        </div>
      )}
      {report.media_links && (
        <div>
          <span className="text-[10px] text-neutral-600 uppercase tracking-wide block mb-0.5">Media links</span>
          <p className="text-xs text-neutral-400 break-all">{report.media_links}</p>
        </div>
      )}
    </div>
  )
}

export default function PerformanceReports() {
  const navigate = useNavigate()
  const { reports, loading, refetch, resendReport, deleteReport, createReportWithoutEmail } = usePerformanceReports()
  const { venues } = useVenues()
  const { deals } = useDeals()
  const { profile } = useArtistProfile()
  const { markSeen } = useNavBadges()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [manualOpen, setManualOpen] = useState(false)
  const [manualVenueId, setManualVenueId] = useState('')
  const [manualDealId, setManualDealId] = useState('')
  const [manualSaving, setManualSaving] = useState(false)

  // Mark Show Reports as seen on mount — clears the badge for newly submitted reports
  useEffect(() => { void markSeen('show-reports') }, [markSeen])
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PerformanceReport | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function copyLink(report: PerformanceReport) {
    const url = `${window.location.origin}/performance-report/${report.token}`
    navigator.clipboard.writeText(url)
    setCopiedId(report.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function handleResend(report: PerformanceReport) {
    if (!profile) return
    setActionLoading(report.id)
    const { formUrl, error } = await resendReport(report.id, profile)
    setActionLoading(null)
    if (error && !formUrl) {
      showToast(error, 'err')
    } else {
      showToast('New form link sent to artist.', 'ok')
    }
  }

  const dealsForVenue = useMemo(
    () => deals.filter(d => d.venue_id === manualVenueId),
    [deals, manualVenueId],
  )

  const pendingDealConflict = Boolean(
    manualDealId && reports.some(r => r.deal_id === manualDealId && !r.submitted),
  )

  function goManualWizard(state: ManualShowReportLocationState) {
    navigate('/performance-reports/manual', { state })
  }

  async function handleCreateManualShell() {
    if (!manualVenueId || pendingDealConflict) return
    setManualSaving(true)
    const dealId = manualDealId || null
    const { report, error } = await createReportWithoutEmail(manualVenueId, dealId)
    setManualSaving(false)
    if (error || !report) {
      showToast(error ?? 'Could not create report', 'err')
      return
    }
    const venueName = report.venue?.name ?? null
    const eventDate = report.deal?.event_date ?? null
    const dealDescription = report.deal?.description ?? null
    const selectedDeal = manualDealId ? deals.find(d => d.id === manualDealId) : null
    const dealGrossAmount =
      selectedDeal?.gross_amount != null && Number.isFinite(Number(selectedDeal.gross_amount))
        ? Number(selectedDeal.gross_amount)
        : null
    setManualOpen(false)
    setManualVenueId('')
    setManualDealId('')
    goManualWizard({
      token: report.token,
      context: { venueName, eventDate, dealDescription, dealGrossAmount },
    })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    const { error } = await deleteReport(deleteTarget.id)
    setDeleteSubmitting(false)
    if (error) {
      showToast(error, 'err')
      return
    }
    showToast('Report deleted.', 'ok')
    const removedId = deleteTarget.id
    setExpanded(prev => (prev === removedId ? null : prev))
    setDeleteTarget(null)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg border ${toast.type === 'ok' ? 'bg-neutral-900 border-emerald-500/30 text-emerald-400' : 'bg-neutral-900 border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-neutral-800 border border-neutral-700">
            <ClipboardList className="h-4 w-4 text-neutral-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Show Reports</h1>
            <p className="text-xs text-neutral-500">Performance feedback submitted by DJ Luijay</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs border-neutral-700 bg-neutral-900 text-neutral-200"
            onClick={() => { setManualOpen(true); setManualVenueId(''); setManualDealId('') }}
          >
            <UserPen className="h-3.5 w-3.5 mr-1.5" />
            Manual report
          </Button>
          <button
            onClick={refetch}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white px-2.5 py-1.5 rounded-md hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-all"
          >
            <RefreshCw className="h-3 w-3" />
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-neutral-600 text-sm py-12 text-center">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-neutral-800 rounded-xl">
          <ClipboardList className="h-8 w-8 text-neutral-700 mx-auto mb-3" />
          <p className="text-neutral-500 text-sm">No performance reports yet.</p>
          <p className="text-neutral-600 text-xs mt-1">Send a form from Earnings or Outreach after a show.</p>
          <Button type="button" variant="outline" size="sm" className="mt-4 border-neutral-700" onClick={() => setManualOpen(true)}>
            <UserPen className="h-3.5 w-3.5 mr-2" />
            Enter report manually
          </Button>
        </div>
      ) : (
        <div className="border border-neutral-800 rounded-xl overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[1fr_120px_100px_80px_80px_80px_auto] gap-3 px-4 py-2.5 bg-neutral-900 border-b border-neutral-800">
            {['Venue', 'Event Date', 'Sent', 'Status', 'Rating', 'Paid', 'Actions'].map((h, i) => (
              <span key={i} className="text-[10px] text-neutral-600 uppercase tracking-wide font-medium">{h}</span>
            ))}
          </div>

          {reports.map(report => (
            <div key={report.id} className="border-b border-neutral-800 last:border-0">
              <div
                className="grid grid-cols-[1fr_120px_100px_80px_80px_80px_auto] gap-3 px-4 py-3 hover:bg-neutral-900/50 cursor-pointer items-center"
                onClick={() => setExpanded(expanded === report.id ? null : report.id)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {expanded === report.id ? <ChevronDown className="h-3 w-3 text-neutral-500 shrink-0" /> : <ChevronRight className="h-3 w-3 text-neutral-600 shrink-0" />}
                  <span className="text-sm text-white font-medium truncate">{report.venue?.name ?? 'Unknown venue'}</span>
                  {report.commission_flagged && <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" aria-label="Commission flagged" />}
                </div>
                <span className="text-xs text-neutral-400">{report.deal?.event_date ? formatDate(report.deal.event_date) : '-'}</span>
                <span className="text-xs text-neutral-500">{formatDate(report.created_at)}</span>
                <StatusPill submitted={report.submitted} />
                <RatingDots rating={report.event_rating} />
                <PaidStatusBadge status={report.artist_paid_status} />
                <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                  {report.submitted ? (
                    <a
                      href={report.deal_id ? `/earnings` : `/outreach`}
                      className="p-1 text-neutral-600 hover:text-neutral-300 transition-colors"
                      title="View in dashboard"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : (
                    <>
                      <button
                        onClick={() => handleResend(report)}
                        disabled={actionLoading === report.id}
                        className="p-1 text-neutral-600 hover:text-blue-400 transition-colors disabled:opacity-40"
                        title="Resend email with new link"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => copyLink(report)}
                        className={`p-1 transition-colors ${copiedId === report.id ? 'text-emerald-400' : 'text-neutral-600 hover:text-neutral-300'}`}
                        title="Copy form link for artist"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => goManualWizard({
                          token: report.token,
                          context: {
                            venueName: report.venue?.name ?? null,
                            eventDate: report.deal?.event_date ?? null,
                            dealDescription: report.deal?.description ?? null,
                          },
                        })}
                        className="p-1 text-neutral-600 hover:text-white transition-colors"
                        title="Complete manually (same as artist form)"
                      >
                        <UserPen className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(report)}
                    disabled={actionLoading === report.id || deleteSubmitting}
                    className="p-1 text-neutral-600 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Delete report"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {expanded === report.id && report.submitted && (
                <ReportDetail report={report} />
              )}

              {expanded === report.id && !report.submitted && (
                <div className="px-4 pb-4 pt-2 border-t border-neutral-800 bg-neutral-950/50">
                  <p className="text-xs text-neutral-500 mb-3">
                    Pending — not submitted. While a shell exists for this deal, Earnings will not offer &quot;send form&quot;; use Copy link for the artist or complete it yourself.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => goManualWizard({
                        token: report.token,
                        context: {
                          venueName: report.venue?.name ?? null,
                          eventDate: report.deal?.event_date ?? null,
                          dealDescription: report.deal?.description ?? null,
                        },
                      })}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-md text-neutral-200 transition-all"
                    >
                      <UserPen className="h-3 w-3" />
                      Complete manually
                    </button>
                    <button
                      onClick={() => handleResend(report)}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-md text-neutral-300 transition-all disabled:opacity-40"
                    >
                      <RefreshCw className="h-3 w-3" />
                      {actionLoading === report.id ? 'Sending...' : 'Resend with new link'}
                    </button>
                    <button
                      onClick={() => copyLink(report)}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-all ${copiedId === report.id ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-neutral-800 hover:bg-neutral-700 border-neutral-700 text-neutral-300'}`}
                    >
                      <Copy className="h-3 w-3" />
                      {copiedId === report.id ? 'Copied!' : 'Copy link'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={manualOpen} onOpenChange={v => !manualSaving && setManualOpen(v)}>
        <DialogContent className="max-w-md border-neutral-800 bg-neutral-950 text-neutral-200">
          <DialogHeader>
            <DialogTitle className="text-white">Manual show report</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Creates a pending report (no email). You will use the same steps as the artist; automations run on submit. If this deal already has a pending row, open that row instead or delete it first.
          </p>
          <div className="space-y-3 pt-2">
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Venue</label>
              <Select value={manualVenueId || undefined} onValueChange={v => { setManualVenueId(v); setManualDealId('') }}>
                <SelectTrigger className="bg-neutral-900 border-neutral-700 text-sm">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  {venues.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-400 mb-1.5 block">Deal (optional)</label>
              <Select
                value={manualDealId || 'none'}
                onValueChange={v => setManualDealId(v === 'none' ? '' : v)}
                disabled={!manualVenueId}
              >
                <SelectTrigger className="bg-neutral-900 border-neutral-700 text-sm">
                  <SelectValue placeholder="Link a deal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No deal linked</SelectItem>
                  {dealsForVenue.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.description} · {d.event_date ? formatDate(d.event_date) : 'no date'}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {pendingDealConflict && (
              <p className="text-xs text-amber-400">A pending report already exists for this deal. Delete or complete that one first.</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setManualOpen(false )} disabled={manualSaving}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleCreateManualShell()}
              disabled={!manualVenueId || pendingDealConflict || manualSaving}
            >
              {manualSaving ? 'Creating…' : 'Create & continue'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={v => !v && !deleteSubmitting && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete report?</DialogTitle>
          </DialogHeader>
          {deleteTarget && (
            <>
              <p className="text-sm text-neutral-400">
                Permanently delete this report for{' '}
                <span className="text-neutral-200 font-medium">{deleteTarget.venue?.name ?? 'Unknown venue'}</span>?
                The form link will stop working.
              </p>
              {deleteTarget.submitted && (
                <p className="text-sm text-amber-200/90 mt-2">
                  This report was submitted — all saved answers will be lost.
                </p>
              )}
            </>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleteSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => void handleConfirmDelete()}
              disabled={deleteSubmitting}
            >
              {deleteSubmitting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
