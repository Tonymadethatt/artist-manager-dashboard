import { useMemo } from 'react'
import { Monitor, Eye, Loader2 } from 'lucide-react'
import { ShowReportWizard, type ShowReportFormContext } from '@/components/performance/ShowReportWizard'
import { brandingFromArtistProfileRow } from '@/lib/publicFormBranding'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { cn } from '@/lib/utils'

const MOCK_SHOW_REPORT_CONTEXT: ShowReportFormContext = {
  venueName: 'Skyline Bar',
  eventDate: '2026-06-15',
  dealDescription: 'Evening DJ set — sample deal for preview',
  dealGrossAmount: 1200,
}

export default function FormPreviews() {
  const { profile, loading: profileLoading } = useArtistProfile()
  const previewBranding = useMemo(() => brandingFromArtistProfileRow(profile), [profile])

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 max-w-[1600px] mx-auto md:min-h-[calc(100dvh-7.5rem)]">
      <p className="text-sm text-neutral-500 shrink-0">
        Walk through form UI without saving. Sample venue and deal text only; header and footer use your live{' '}
        <span className="text-neutral-400">Settings → Artist profile</span> (company name, tagline, links, manager).
      </p>

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900',
        )}
      >
        <div className="px-4 py-2.5 border-b border-neutral-800 flex flex-wrap items-center gap-x-2 gap-y-1 shrink-0">
          <Monitor className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <span className="text-xs font-medium text-neutral-400">Preview — Show report (artist link)</span>
          <span className="text-[10px] text-neutral-600">Sample venue/deal · nothing saved</span>
          <span className="text-[10px] text-neutral-600 min-[480px]:ml-auto flex items-center gap-1">
            <Eye className="h-3 w-3 opacity-70" />
            Alex / Skyline Bar
          </span>
        </div>
        <div className={cn('flex-1 min-h-0 overflow-y-auto flex flex-col', 'bg-black')}>
          {profileLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-neutral-500">
              <Loader2 className="h-7 w-7 animate-spin" aria-hidden />
              <p className="text-xs">Loading profile for preview…</p>
            </div>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <ShowReportWizard
                token="__preview__"
                previewContext={MOCK_SHOW_REPORT_CONTEXT}
                submittedBy="artist_link"
                footerMode="embedded"
                preview
                branding={previewBranding}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
