import { supabase } from '@/lib/supabase'
import {
  pacificDayEndExclusiveUtcIso,
  pacificTodayYmd,
  pacificWallToUtcIso,
} from '@/lib/calendar/pacificWallTime'

/**
 * Optional caps — match your Resend plan. Defaults align with common Pro-style limits (300/day, 3k/mo).
 * Set in `.env`: VITE_RESEND_DAILY_EMAIL_CAP=300 VITE_RESEND_MONTHLY_EMAIL_CAP=3000
 */
export function resendPlanCaps(): { daily: number; monthly: number } {
  const d = parseInt(String(import.meta.env.VITE_RESEND_DAILY_EMAIL_CAP ?? ''), 10)
  const m = parseInt(String(import.meta.env.VITE_RESEND_MONTHLY_EMAIL_CAP ?? ''), 10)
  return {
    daily: Number.isFinite(d) && d > 0 ? d : 300,
    monthly: Number.isFinite(m) && m > 0 ? m : 3000,
  }
}

function pacificMonthRangeExclusiveFromToday(): { startIso: string; endExclusiveIso: string } | null {
  const today = pacificTodayYmd()
  const [yStr, moStr] = today.split('-')
  const y = Number(yStr)
  const mo = Number(moStr)
  if (!Number.isFinite(y) || !Number.isFinite(mo)) return null
  const nextMo = mo === 12 ? 1 : mo + 1
  const nextY = mo === 12 ? y + 1 : y
  const monthStartYmd = `${y}-${String(mo).padStart(2, '0')}-01`
  const nextMonthStartYmd = `${nextY}-${String(nextMo).padStart(2, '0')}-01`
  const startIso = pacificWallToUtcIso(monthStartYmd, '00:00')
  const endExclusiveIso = pacificWallToUtcIso(nextMonthStartYmd, '00:00')
  if (!startIso || !endExclusiveIso) return null
  return { startIso, endExclusiveIso }
}

/**
 * Sent rows in `venue_emails` for the signed-in user (Pacific calendar day / month).
 * Counts only rows where Resend accepted the message (`resend_message_id` set), so the meter tracks
 * provider-confirmed sends rather than queue rows merely marked sent.
 */
export async function fetchVenueEmailSentCountsForUser(userId: string): Promise<{
  today: number
  month: number
} | null> {
  const todayYmd = pacificTodayYmd()
  const dayStart = pacificWallToUtcIso(todayYmd, '00:00')
  const dayEndEx = pacificDayEndExclusiveUtcIso(todayYmd)
  const monthR = pacificMonthRangeExclusiveFromToday()
  if (!dayStart || !dayEndEx || !monthR) return null

  const [dayQ, monthQ] = await Promise.all([
    supabase
      .from('venue_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('resend_message_id', 'is', null)
      .gte('sent_at', dayStart)
      .lt('sent_at', dayEndEx),
    supabase
      .from('venue_emails')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'sent')
      .not('resend_message_id', 'is', null)
      .gte('sent_at', monthR.startIso)
      .lt('sent_at', monthR.endExclusiveIso),
  ])

  if (dayQ.error || monthQ.error) {
    console.error('[fetchVenueEmailSentCountsForUser]', dayQ.error ?? monthQ.error)
    return null
  }

  return {
    today: dayQ.count ?? 0,
    month: monthQ.count ?? 0,
  }
}

/** Red styling when ≤20 sends left today or ≤300 left this month (per product spec). */
export function usageNearLimitFlags(args: {
  sentToday: number
  sentMonth: number
  dailyCap: number
  monthlyCap: number
}): { dailyHot: boolean; monthlyHot: boolean } {
  const { sentToday, sentMonth, dailyCap, monthlyCap } = args
  return {
    dailyHot: dailyCap - sentToday <= 20,
    monthlyHot: monthlyCap - sentMonth <= 300,
  }
}
