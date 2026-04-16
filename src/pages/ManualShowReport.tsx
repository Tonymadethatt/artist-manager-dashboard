import { useLocation, useNavigate } from 'react-router-dom'
import { ShowReportWizard } from '@/components/performance/ShowReportWizard'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { brandingFromArtistProfileRow } from '@/lib/publicFormBranding'

export type ManualShowReportLocationState = {
  token: string
}

export default function ManualShowReport() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as ManualShowReportLocationState | null
  const { profile } = useArtistProfile()
  const branding = brandingFromArtistProfileRow(profile)

  if (!state?.token) {
    return (
      <div className="p-6 w-full max-w-2xl mx-auto text-neutral-400 text-sm">
        Nothing to show. Open{' '}
        <button
          type="button"
          className="text-white underline"
          onClick={() => navigate('/performance-reports')}
        >
          Show Reports
        </button>{' '}
        and start a manual report.
      </div>
    )
  }

  return (
    <div className="min-h-[calc(100dvh-6rem)] bg-[#0d0d0d] text-white">
      <div className="w-full max-w-4xl mx-auto px-4 py-6">
        <ShowReportWizard
          token={state.token}
          submittedBy="manager_dashboard"
          footerMode="embedded"
          branding={branding}
          onSuccess={() => navigate('/performance-reports')}
          onCancel={() => navigate('/performance-reports')}
        />
      </div>
    </div>
  )
}
