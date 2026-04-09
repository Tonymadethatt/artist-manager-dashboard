import { useEffect } from 'react'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { GigCalendar } from '@/components/dashboard/GigCalendar'
import { useNavBadges } from '@/context/NavBadgesContext'

export default function GigCalendarPage() {
  const { deals, loading: dealsLoading } = useDeals()
  const { venues, loading: venuesLoading } = useVenues()
  const { markSeen } = useNavBadges()
  const loading = dealsLoading || venuesLoading

  useEffect(() => {
    void markSeen('calendar')
  }, [markSeen])

  return (
    <div className="max-w-5xl space-y-4">
      <GigCalendar deals={deals} venues={venues} loading={loading} />
    </div>
  )
}
