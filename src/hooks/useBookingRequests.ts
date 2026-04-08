import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type BookingRequest = {
  id: string
  user_id: string
  venue_id: string | null
  deal_id: string | null
  capture_token_id: string | null
  source_kind: string
  rebook_interest: string | null
  preferred_dates: string | null
  budget_note: string | null
  note: string | null
  raw_payload: Record<string, unknown> | null
  created_at: string
  updated_at: string
  venue: { id: string; name: string } | null
  deal: { id: string; description: string } | null
}

export function useBookingRequests() {
  const [requests, setRequests] = useState<BookingRequest[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('booking_requests')
      .select('*, venue:venues(id, name), deal:deals(id, description)')
      .order('created_at', { ascending: false })
      .limit(100)
    setRequests((data ?? []) as BookingRequest[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const deleteRequest = useCallback(async (id: string) => {
    await supabase.from('booking_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
  }, [])

  return { requests, loading, reload: load, deleteRequest }
}
