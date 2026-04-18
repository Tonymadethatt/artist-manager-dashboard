import { supabase } from '@/lib/supabase'
import {
  pacificDayEndExclusiveUtcIso,
  pacificTodayYmd,
  pacificWallToUtcIso,
} from '@/lib/calendar/pacificWallTime'

/**
 * Fallback caps when `artist_profile.resend_*_email_cap` is unset.
 * Defaults match common Resend **free** tier (100/day); monthly 3k. Override via Settings or
 * `VITE_RESEND_DAILY_EMAIL_CAP` / `VITE_RESEND_MONTHLY_EMAIL_CAP`.
 */
export function resendPlanCaps(): { daily: number; monthly: number } {
  const d = parseInt(String(import.meta.env.VITE_RESEND_DAILY_EMAIL_CAP ?? ''), 10)
  const m = parseInt(String(import.meta.env.VITE_RESEND_MONTHLY_EMAIL_CAP ?? ''), 10)
  return {
    daily: Number.isFinite(d) && d > 0 ? d : 100,
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
  /** Effective caps (Settings overrides + env + defaults). */
  caps: { daily: number; monthly: number }
}

function clampNonNegativeInt(n: unknown): number {
  if (typeof n === 'number' && Number.isFinite(n) && n >= 0) return Math.floor(n)
  if (typeof n === 'string' && n.trim() !== '') {
    const x = parseInt(n.trim(), 10)
    if (Number.isFinite(x) && x >= 0) return x
  }
  return 0
}

function resolveCapsFromProfile(
  prof: {
    resend_daily_email_cap?: number | string | null
    resend_monthly_email_cap?: number | string | null
  } | null,
  defaults: { daily: number; monthly: number },
): { daily: number; monthly: number } {
  const dRaw = prof?.resend_daily_email_cap
  const mRaw = prof?.resend_monthly_email_cap
  const d = clampNonNegativeInt(dRaw)
  const m = clampNonNegativeInt(mRaw)
  return {
    daily: d > 0 ? d : defaults.daily,
    monthly: m > 0 ? m : defaults.monthly,
  }
}

function rpcCountToNumber(data: unknown): number {
  if (typeof data === 'number' && Number.isFinite(data)) return Math.max(0, Math.floor(data))
  if (typeof data === 'string' && data.trim() !== '') {
    const x = parseInt(data.trim(), 10)
    if (Number.isFinite(x) && x >= 0) return x
  }
  return 0
}

/**
 * Distinct successful Resend sends for the signed-in user (Pacific calendar day / month):
 * `resend_outbound_send_log` ∪ `venue_emails` with `resend_message_id` (deduped per message id),
 * plus baselines from `VITE_RESEND_USAGE_*` and `artist_profile.email_usage_*_offset`.
 */
export async function fetchVenueEmailSentCountsForUser(userId: string): Promise<VenueEmailSendUsageResult | null> {
  const todayYmd = pacificTodayYmd()
  const dayStart = pacificWallToUtcIso(todayYmd, '00:00')
  const dayEndEx = pacificDayEndExclusiveUtcIso(todayYmd)
  const monthR = pacificMonthRangeExclusiveFromToday()
  if (!dayStart || !dayEndEx || !monthR) return null

  const [dayQ, monthQ, profQ] = await Promise.all([
    supabase.rpc('count_distinct_resend_sends', {
      p_start: dayStart,
      p_end_exclusive: dayEndEx,
    }),
    supabase.rpc('count_distinct_resend_sends', {
      p_start: monthR.startIso,
      p_end_exclusive: monthR.endExclusiveIso,
    }),
    supabase
      .from('artist_profile')
      .select(
        'email_usage_day_offset, email_usage_month_offset, resend_daily_email_cap, resend_monthly_email_cap',
      )
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
  const defaults = resendPlanCaps()
  const prof = !profQ.error
    ? (profQ.data as {
      email_usage_day_offset?: number | string | null
      email_usage_month_offset?: number | string | null
      resend_daily_email_cap?: number | string | null
      resend_monthly_email_cap?: number | string | null
    } | null)
    : null
  const profDay = clampNonNegativeInt(prof?.email_usage_day_offset)
  const profMonth = clampNonNegativeInt(prof?.email_usage_month_offset)
  const baseDay = envOff.day + profDay
  const baseMonth = envOff.month + profMonth
  const caps = resolveCapsFromProfile(prof, defaults)
  const dayCount = rpcCountToNumber(dayQ.data)
  const monthCount = rpcCountToNumber(monthQ.data)

  return {
    today: dayCount + baseDay,
    month: monthCount + baseMonth,
    offsetsApplied: { day: baseDay, month: baseMonth },
    caps,
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
