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

function parseNonNegativeIntEnv(raw: string | undefined): number {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

/**
 * Sends already counted by Resend before this app stored `resend_message_id`, or sent outside this dashboard.
 * Added to DB-backed counts so Today/Month match your Resend dashboard baseline, then new sends increment from there.
 *
 * Netlify / `.env`: `VITE_RESEND_USAGE_DAY_OFFSET=4` `VITE_RESEND_USAGE_MONTH_OFFSET=18`
 */
export function resendUsageBaselineOffsets(): { day: number; month: number } {
  return {
    day: parseNonNegativeIntEnv(import.meta.env.VITE_RESEND_USAGE_DAY_OFFSET),
    month: parseNonNegativeIntEnv(import.meta.env.VITE_RESEND_USAGE_MONTH_OFFSET),
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

export type VenueEmailSendUsageResult = {
  today: number
  month: number
  /** Total baseline added (env + Settings); tooltip / support. */
  offsetsApplied: { day: number; month: number }
}

function clampNonNegativeInt(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.floor(n)
  return 0
}

/**
 * Sent rows in `venue_emails` for the signed-in user (Pacific calendar day / month).
 * Counts only rows where Resend accepted the message (`resend_message_id` set), then adds baselines from
 * `VITE_RESEND_USAGE_*` (build env) and `artist_profile.email_usage_*_offset` (Settings).
 */
export async function fetchVenueEmailSentCountsForUser(userId: string): Promise<VenueEmailSendUsageResult | null> {
  const todayYmd = pacificTodayYmd()
  const dayStart = pacificWallToUtcIso(todayYmd, '00:00')
  const dayEndEx = pacificDayEndExclusiveUtcIso(todayYmd)
  const monthR = pacificMonthRangeExclusiveFromToday()
  if (!dayStart || !dayEndEx || !monthR) return null

  const [dayQ, monthQ, profQ] = await Promise.all([
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
    supabase
      .from('artist_profile')
      .select('email_usage_day_offset, email_usage_month_offset')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (dayQ.error || monthQ.error) {
    console.error('[fetchVenueEmailSentCountsForUser]', dayQ.error ?? monthQ.error)
    return null
  }
  if (profQ.error) {
    console.warn('[fetchVenueEmailSentCountsForUser] profile offsets skipped:', profQ.error.message)
  }

  const envOff = resendUsageBaselineOffsets()
  const prof = !profQ.error
    ? (profQ.data as {
      email_usage_day_offset?: number | null
      email_usage_month_offset?: number | null
    } | null)
    : null
  const profDay = clampNonNegativeInt(prof?.email_usage_day_offset)
  const profMonth = clampNonNegativeInt(prof?.email_usage_month_offset)
  const baseDay = envOff.day + profDay
  const baseMonth = envOff.month + profMonth

  return {
    today: (dayQ.count ?? 0) + baseDay,
    month: (monthQ.count ?? 0) + baseMonth,
    offsetsApplied: { day: baseDay, month: baseMonth },
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
