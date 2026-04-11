import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useDeals } from '@/hooks/useDeals'
import { useVenues } from '@/hooks/useVenues'
import { GigCalendar, type CalendarSyncEventChip } from '@/components/dashboard/GigCalendar'
import { useNavBadges } from '@/context/NavBadgesContext'
import { supabase } from '@/lib/supabase'

export default function GigCalendarPage() {
  const { user } = useAuth()
  const { deals, loading: dealsLoading } = useDeals()
  const { venues, loading: venuesLoading } = useVenues()
  const { markSeen } = useNavBadges()
  const loading = dealsLoading || venuesLoading
  const [calendarSyncEvents, setCalendarSyncEvents] = useState<CalendarSyncEventChip[]>([])

  const loadSync = useCallback(async () => {
    if (!user?.id) {
      setCalendarSyncEvents([])
      return
    }
    const start = new Date()
    start.setUTCDate(start.getUTCDate() - 120)
    const end = new Date()
    end.setUTCDate(end.getUTCDate() + 400)
    const { data, error } = await supabase
      .from('calendar_sync_event')
      .select('id, event_start_at, event_end_at, summary, location, matched_venue_id')
      .eq('user_id', user.id)
      .gte('event_start_at', start.toISOString())
      .lte('event_start_at', end.toISOString())
      .order('event_start_at', { ascending: true })
    if (error) {
      console.warn('[GigCalendarPage] calendar_sync_event', error)
      setCalendarSyncEvents([])
      return
    }
    setCalendarSyncEvents(
      (data ?? [])
        .filter(row => row.event_start_at)
        .map(row => ({
          id: row.id,
          event_start_at: row.event_start_at as string,
          event_end_at: row.event_end_at,
          summary: row.summary,
          location: row.location,
          matched_venue_id: row.matched_venue_id,
        })),
    )
  }, [user?.id])

  useEffect(() => {
    void markSeen('calendar')
  }, [markSeen])

  useEffect(() => {
    void loadSync()
  }, [loadSync])

  useEffect(() => {
    const onChange = () => void loadSync()
    window.addEventListener('calendar-sync-events-changed', onChange)
    return () => window.removeEventListener('calendar-sync-events-changed', onChange)
  }, [loadSync])

  return (
    <div className="max-w-5xl space-y-4">
      <GigCalendar
        deals={deals}
        venues={venues}
        calendarSyncEvents={calendarSyncEvents}
        loading={loading}
      />
    </div>
  )
}
