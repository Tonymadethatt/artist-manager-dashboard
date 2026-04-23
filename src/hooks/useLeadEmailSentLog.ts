import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export type LeadEmailSentRow = { lead_id: string; sent_at: string }

/**
 * Sent rows from `lead_email_events` for management report / Reports (date filtering in build).
 */
export function useLeadEmailSentLog() {
  const [rows, setRows] = useState<LeadEmailSentRow[]>([])

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setRows([])
      return
    }
    const { data, error } = await supabase
      .from('lead_email_events')
      .select('lead_id, sent_at')
      .eq('user_id', user.id)
      .eq('status', 'sent')
      .not('sent_at', 'is', null)
    if (error) {
      console.warn('[useLeadEmailSentLog]', error.message)
      setRows([])
      return
    }
    setRows((data ?? []) as LeadEmailSentRow[])
  }, [])

  useEffect(() => {
    void refetch()
  }, [refetch])

  return { leadEmailSentRows: rows, refetchLeadEmailSentLog: refetch }
}
