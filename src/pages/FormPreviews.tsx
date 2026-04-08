import { useMemo, useState } from 'react'
import { Monitor, Eye, Loader2 } from 'lucide-react'
import { ShowReportWizard, type ShowReportFormContext } from '@/components/performance/ShowReportWizard'
import { EmailCaptureFormPreviewBody } from '@/pages/public/EmailCaptureForm'
import { EMAIL_CAPTURE_KIND_LABELS, type EmailCaptureKind } from '@/lib/emailCapture/kinds'
import { brandingFromArtistProfileRow } from '@/lib/publicFormBranding'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { cn } from '@/lib/utils'

const MOCK_SHOW_REPORT_CONTEXT: ShowReportFormContext = {
  venueName: 'Skyline Bar',
  eventDate: '2026-06-15',
  dealDescription: 'Evening DJ set — sample deal for preview',
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
  const { profile, loading: profileLoading } = useArtistProfile()
  const previewBranding = useMemo(() => brandingFromArtistProfileRow(profile), [profile])

  const previewLabel = useMemo(() => {
    if (selection.scope === 'artist') return 'Show report (artist link)'
    return EMAIL_CAPTURE_KIND_LABELS[selection.kind]
  }, [selection])

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 max-w-[1600px] mx-auto md:min-h-[calc(100dvh-7.5rem)]">
      <p className="text-sm text-neutral-500 shrink-0">
        Walk through form UI without saving. Sample venue and deal text only; header and footer use your live{' '}
        <span className="text-neutral-400">Settings → Artist profile</span> (company name, tagline, links, manager).
      </p>

      <div className="flex flex-1 min-h-0 flex-row gap-4">
        <div
          className={cn(
            'flex min-h-0 min-w-[11rem] flex-[2] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50',
          )}
        >
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

        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-[3] flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900',
          )}
        >
          <div className="px-4 py-2.5 border-b border-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
            <Monitor className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
            <span className="text-xs font-medium text-neutral-400">Preview — {previewLabel}</span>
            <span className="text-[10px] text-neutral-600">
              Sample venue/deal · nothing saved
            </span>
            <span className="text-[10px] text-neutral-600 min-[480px]:ml-auto flex items-center gap-1">
              <Eye className="h-3 w-3 opacity-70" />
              Alex / Skyline Bar
            </span>
          </div>
          <div
            className={cn(
              'flex-1 min-h-0 overflow-y-auto flex flex-col',
              'bg-black',
            )}
          >
            {profileLoading ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-neutral-500">
                <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
                <p className="text-xs">Loading profile for preview…</p>
              </div>
            ) : selection.scope === 'artist' ? (
              <div key={selectionKey(selection)} className="flex flex-col flex-1 min-h-0">
                <ShowReportWizard
                  token="__preview__"
                  embeddedContext={MOCK_SHOW_REPORT_CONTEXT}
                  submittedBy="artist_link"
                  footerMode="embedded"
                  preview
                  branding={previewBranding}
                />
              </div>
            ) : (
              <div key={selectionKey(selection)} className="flex flex-col flex-1 min-h-0">
                <EmailCaptureFormPreviewBody kind={selection.kind} branding={previewBranding} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
