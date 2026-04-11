import { supabase } from '@/lib/supabase'
import type { Deal, Venue } from '@/types'
import { dealQualifiesForCalendar } from '@/lib/calendar/gigCalendarRules'

type VenueStatus = Pick<Venue, 'status'> | null | undefined

function calendarFnPath(name: string): string {
  return `/.netlify/functions/${name}`
}

export function shouldRunGoogleCalendarDealPush(args: {
  beforeDeal: Deal | null
  afterDeal: Deal
  venueAfter: VenueStatus
}): boolean {
  const { beforeDeal, afterDeal, venueAfter } = args
  if (dealQualifiesForCalendar(afterDeal, venueAfter)) return true
  if (afterDeal.google_shared_calendar_event_id) return true
  if (beforeDeal?.google_shared_calendar_event_id) return true
  return false
}

/**
 * Non-blocking: logs failures. Server updates google_calendar_connection.last_deal_push_error.
 */
export async function syncDealToGoogleSharedCalendar(dealId: string): Promise<void> {
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session?.access_token) return
  try {
    const res = await fetch(calendarFnPath('google-calendar-deal-push'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${data.session.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ dealId }),
    })
    if (!res.ok) {
      const t = await res.text().catch(() => '')
      console.warn('[syncDealToGoogleSharedCalendar]', res.status, t)
    }
  } catch (e) {
    console.warn('[syncDealToGoogleSharedCalendar]', e)
  }
}
