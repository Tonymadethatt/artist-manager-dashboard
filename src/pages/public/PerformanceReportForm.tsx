import { useParams } from 'react-router-dom'
import { ShowReportWizard } from '@/components/performance/ShowReportWizard'

export default function PerformanceReportForm() {
  const { token } = useParams<{ token: string }>()
  if (!token) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center text-neutral-500 text-sm">
        Invalid link
      </div>
    )
  }
  return (
    <ShowReportWizard token={token} submittedBy="artist_link" footerMode="viewport" />
  )
}
