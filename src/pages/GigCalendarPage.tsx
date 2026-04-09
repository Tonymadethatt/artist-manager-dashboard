import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { GigCalendar } from '@/components/dashboard/GigCalendar'

export default function GigCalendarPage() {
  const { deals, loading: dealsLoading } = useDeals()
  const { venues, loading: venuesLoading } = useVenues()
  const loading = dealsLoading || venuesLoading

  return (
    <div className="max-w-5xl space-y-4">
      <GigCalendar deals={deals} venues={venues} loading={loading} />
    </div>
  )
}
