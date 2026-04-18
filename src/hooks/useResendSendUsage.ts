import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  fetchVenueEmailSentCountsForUser,
  resendPlanCaps,
  usageNearLimitFlags,
  type VenueEmailSendUsageResult,
} from '@/lib/email/emailQueueSendUsage'
import { useArtistProfile } from '@/hooks/useArtistProfile'

export type UseResendSendUsageOptions = {
  /** Values that trigger a debounced reload (e.g. `emails` from the queue page). */
  reloadTriggers?: readonly unknown[]
  /** Background refresh interval in ms (e.g. sidebar `30000`). Omit to disable. */
  pollMs?: number | null
}

/**
 * Shared Resend usage (today/month caps, near-limit flags) for Email Queue and sidebar micro tracker.
 */
export function useResendSendUsage(options: UseResendSendUsageOptions = {}) {
  const { reloadTriggers = [], pollMs = null } = options
  const { profile } = useArtistProfile()
  const [sendUsage, setSendUsage] = useState<VenueEmailSendUsageResult | null>(null)
  const [sendUsageLoadFailed, setSendUsageLoadFailed] = useState(false)

  const loadSendUsage = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const c = await fetchVenueEmailSentCountsForUser(user.id)
    if (c) {
      setSendUsage(c)
      setSendUsageLoadFailed(false)
    } else {
      setSendUsageLoadFailed(true)
    }
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => void loadSendUsage(), 400)
    return () => window.clearTimeout(t)
  }, [
    loadSendUsage,
    profile?.email_usage_day_offset,
    profile?.email_usage_month_offset,
    profile?.resend_daily_email_cap,
    profile?.resend_monthly_email_cap,
    ...reloadTriggers,
  ])

  useEffect(() => {
    if (pollMs == null || pollMs <= 0) return
    const id = window.setInterval(() => void loadSendUsage(), pollMs)
    return () => window.clearInterval(id)
  }, [loadSendUsage, pollMs])

  const displayCaps = useMemo(
    () => sendUsage?.caps ?? resendPlanCaps(),
    [sendUsage],
  )

  const usageHot = useMemo(
    () =>
      sendUsage
        ? usageNearLimitFlags({
            sentToday: sendUsage.today,
            sentMonth: sendUsage.month,
            dailyCap: displayCaps.daily,
            monthlyCap: displayCaps.monthly,
          })
        : { dailyHot: false, monthlyHot: false },
    [sendUsage, displayCaps.daily, displayCaps.monthly],
  )

  return {
    sendUsage,
    sendUsageLoadFailed,
    displayCaps,
    usageHot,
    reloadSendUsage: loadSendUsage,
  }
}
