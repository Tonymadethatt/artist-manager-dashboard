import { useMemo, useState } from 'react'
import { Monitor, Eye } from 'lucide-react'
import { ShowReportWizard, type ShowReportFormContext } from '@/components/performance/ShowReportWizard'
import { EmailCaptureFormPreviewBody } from '@/pages/public/EmailCaptureForm'
import { EMAIL_CAPTURE_KIND_LABELS, type EmailCaptureKind } from '@/lib/emailCapture/kinds'
import { cn } from '@/lib/utils'

const MOCK_SHOW_REPORT_CONTEXT: ShowReportFormContext = {
  venueName: 'Skyline Bar',
  eventDate: '2026-06-15',
  dealDescription: 'Evening DJ set — sample deal for preview',
}

const MOCK_VENUE_CAPTURE = {
  venueName: 'Skyline Bar',
  dealDescription: null as string | null,
  eventDate: '2026-06-15' as string | null,
}

const VENUE_KIND_ORDER: EmailCaptureKind[] = [
  'pre_event_checkin',
  'first_outreach',
  'follow_up',
  'show_cancelled_or_postponed',
  'agreement_followup',
  'agreement_ready',
  'booking_confirmation',
  'booking_confirmed',
  'invoice_sent',
  'post_show_thanks',
  'pass_for_now',
  'rebooking_inquiry',
  'payment_reminder_ack',
  'payment_receipt',
]

type FormSelection =
  | { scope: 'artist'; id: 'show_report' }
  | { scope: 'venue'; kind: EmailCaptureKind }

function selectionKey(s: FormSelection): string {
  return s.scope === 'artist' ? 'artist:show_report' : `venue:${s.kind}`
}

export default function FormPreviews() {
  const [selection, setSelection] = useState<FormSelection>({
    scope: 'artist',
    id: 'show_report',
  })

  const previewLabel = useMemo(() => {
    if (selection.scope === 'artist') return 'Show report (artist link)'
    return EMAIL_CAPTURE_KIND_LABELS[selection.kind]
  }, [selection])

  return (
    <div className="flex flex-col gap-4 h-[calc(100dvh-7.5rem)] min-h-[520px] max-w-[1600px] mx-auto">
      <p className="text-sm text-neutral-500 shrink-0">
        Walk through real form UI without saving. Mock data only.
      </p>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        <div className="lg:w-[280px] lg:shrink-0 flex flex-col min-h-0 border border-neutral-800 rounded-lg bg-neutral-900/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-800 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Artist</p>
          </div>
          <div className="p-2 border-b border-neutral-800">
            <button
              type="button"
              onClick={() => setSelection({ scope: 'artist', id: 'show_report' })}
              className={cn(
                'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                selection.scope === 'artist'
                  ? 'bg-neutral-800 text-white'
                  : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
              )}
            >
              Show report
            </button>
          </div>
          <div className="px-3 py-2 border-b border-neutral-800 shrink-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Venue / client</p>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-0.5">
            {VENUE_KIND_ORDER.map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => setSelection({ scope: 'venue', kind })}
                className={cn(
                  'w-full text-left rounded-md px-3 py-2 text-sm transition-colors',
                  selection.scope === 'venue' && selection.kind === kind
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800/60 hover:text-neutral-200',
                )}
              >
                {EMAIL_CAPTURE_KIND_LABELS[kind]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col flex-1 min-h-0 min-w-0 border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900">
          <div className="px-4 py-2.5 border-b border-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
            <Monitor className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-xs font-medium text-neutral-400">Preview — {previewLabel}</span>
            <span className="text-[10px] text-neutral-600">
              Mock data · nothing saved
            </span>
            <span className="text-[10px] text-neutral-600 min-[480px]:ml-auto flex items-center gap-1">
              <Eye className="h-3 w-3 opacity-70" />
              Alex / Skyline Bar
            </span>
          </div>
          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto flex flex-col',
              selection.scope === 'artist' ? 'bg-[#0d0d0d]' : 'bg-neutral-950',
            )}
          >
            {selection.scope === 'artist' ? (
              <div key={selectionKey(selection)} className="flex flex-col flex-1 min-h-0">
                <ShowReportWizard
                  token="__preview__"
                  embeddedContext={MOCK_SHOW_REPORT_CONTEXT}
                  submittedBy="artist_link"
                  footerMode="embedded"
                  preview
                />
              </div>
            ) : (
              <div key={selectionKey(selection)} className="flex flex-col flex-1 min-h-0">
                <EmailCaptureFormPreviewBody
                  kind={selection.kind}
                  venueName={MOCK_VENUE_CAPTURE.venueName}
                  dealDescription={MOCK_VENUE_CAPTURE.dealDescription}
                  eventDate={MOCK_VENUE_CAPTURE.eventDate}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
