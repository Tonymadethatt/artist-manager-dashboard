import { useMemo, useState } from 'react'
import { ClipboardList, Eye, Loader2, Monitor, type LucideIcon } from 'lucide-react'
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

type PreviewKind = 'show-report'

const PREVIEWS: { id: PreviewKind; label: string; description: string; icon: LucideIcon }[] = [
  {
    id: 'show-report',
    label: 'Show report',
    description: 'Artist-facing post-show form',
    icon: ClipboardList,
  },
]

export default function FormPreviews() {
  const { profile, loading: profileLoading } = useArtistProfile()
  const previewBranding = useMemo(() => brandingFromArtistProfileRow(profile), [profile])
  const [active, setActive] = useState<PreviewKind>('show-report')

  return (
    <div className="flex flex-col gap-4 min-h-0 flex-1 w-full min-w-0 md:min-h-[calc(100dvh-7.5rem)]">
      <p className="text-sm text-neutral-500 shrink-0">
        Pick a preview on the left. Nothing is saved — walk through UI with sample data only. Show report uses your live{' '}
        <span className="text-neutral-400">Settings → Artist profile</span> for header/footer branding.
      </p>

      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col md:flex-row overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900',
        )}
      >
        {/* Left: preview picker */}
        <aside
          className={cn(
            'shrink-0 border-neutral-800 bg-neutral-950/90',
            'w-full md:w-52 md:border-r border-b md:border-b-0',
          )}
        >
          <div className="px-3 py-2 border-b border-neutral-800/80">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              General forms
            </p>
          </div>
          <nav className="p-2 space-y-0.5" aria-label="General forms">
            {PREVIEWS.map(({ id, label, description, icon: Icon }) => {
              const isOn = active === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActive(id)}
                  className={cn(
                    'w-full text-left rounded-lg px-2.5 py-2 transition-colors flex gap-2.5 items-start',
                    isOn
                      ? 'bg-neutral-800 text-white border border-white/10'
                      : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200 border border-transparent',
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', isOn ? 'text-neutral-200' : 'text-neutral-500')} />
                  <span className="min-w-0">
                    <span className="block text-xs font-medium leading-tight">{label}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5 leading-snug">{description}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Right: active preview */}
        <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
          {active === 'show-report' && (
            <>
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
            </>
          )}

        </div>
      </div>
    </div>
  )
}
