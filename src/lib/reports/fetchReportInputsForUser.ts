import type { SupabaseClient } from '@supabase/supabase-js'
import type { Deal, Metric, MonthlyFee, MonthlyFeePayment, PerformanceReport, Task, Venue } from '@/types'

/**
 * Loads the same domain rows the Reports page and management-report email use.
 * Works with the browser Supabase client (RLS) or the Netlify service-role client.
 */
export async function fetchReportInputsForUser(
  client: SupabaseClient,
  userId: string,
): Promise<{
  venues: Venue[]
  deals: Deal[]
  metrics: Metric[]
  fees: MonthlyFee[]
  tasks: Task[]
  perfReports: PerformanceReport[]
}> {
  const [
    { data: venuesRaw, error: vErr },
    { data: dealsRaw, error: dErr },
    { data: metricsRaw, error: mErr },
    { data: feesRaw, error: fErr },
    { data: tasksRaw, error: tErr },
    { data: perfRaw, error: pErr },
  ] = await Promise.all([
    client.from('venues').select('*').eq('user_id', userId),
    client.from('deals').select('*').eq('user_id', userId),
    client.from('metrics').select('*').eq('user_id', userId),
    client.from('monthly_fees').select('*').eq('user_id', userId).order('month', { ascending: false }),
    client.from('tasks').select('*').eq('user_id', userId),
    client.from('performance_reports').select('*').eq('user_id', userId),
  ])

  if (vErr) throw new Error(vErr.message)
  if (dErr) throw new Error(dErr.message)
  if (mErr) throw new Error(mErr.message)
  if (fErr) throw new Error(fErr.message)
  if (tErr) throw new Error(tErr.message)
  if (pErr) throw new Error(pErr.message)

  const venues = (venuesRaw ?? []) as Venue[]
  const deals = (dealsRaw ?? []) as Deal[]
  const metrics = (metricsRaw ?? []) as Metric[]
  const tasks = (tasksRaw ?? []) as Task[]
  const perfReports = (perfRaw ?? []) as PerformanceReport[]
  let fees = (feesRaw ?? []) as MonthlyFee[]

  const feeIds = fees.map(f => f.id)
  if (feeIds.length > 0) {
    const { data: paymentsData, error: payErr } = await client
      .from('monthly_fee_payments')
      .select('*')
      .in('fee_id', feeIds)
    if (payErr) throw new Error(payErr.message)
    const payments = (paymentsData ?? []) as MonthlyFeePayment[]
    fees = fees.map(f => ({
      ...f,
      payments: payments.filter(p => p.fee_id === f.id),
    }))
  } else {
    fees = fees.map(f => ({ ...f, payments: [] as MonthlyFeePayment[] }))
  }

  return { venues, deals, metrics, fees, tasks, perfReports }
}
