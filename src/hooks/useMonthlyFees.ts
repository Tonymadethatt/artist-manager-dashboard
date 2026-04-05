import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MonthlyFee, MonthlyFeePayment, PaymentMethod } from '@/types'

function currentMonthFirst() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function useMonthlyFees() {
  const [fees, setFees] = useState<MonthlyFee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFees = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: feesData, error: feesErr } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false })

    if (feesErr) { setError(feesErr.message); setLoading(false); return }

    let list = (feesData ?? []) as MonthlyFee[]

    // Auto-create current month entry if missing
    const thisMonth = currentMonthFirst()
    if (!list.find(f => f.month === thisMonth)) {
      const { data: created, error: insertErr } = await supabase
        .from('monthly_fees')
        .insert({ user_id: user.id, month: thisMonth })
        .select()
        .single()
      if (!insertErr && created) {
        list = [created as MonthlyFee, ...list]
      }
    }

    // Fetch all payments for these fees
    const feeIds = list.map(f => f.id)
    if (feeIds.length > 0) {
      const { data: paymentsData } = await supabase
        .from('monthly_fee_payments')
        .select('*')
        .in('fee_id', feeIds)
        .order('paid_date', { ascending: true })

      const payments = (paymentsData ?? []) as MonthlyFeePayment[]
      list = list.map(f => ({
        ...f,
        payments: payments.filter(p => p.fee_id === f.id),
      }))
    } else {
      list = list.map(f => ({ ...f, payments: [] }))
    }

    setFees(list)
    setLoading(false)
  }, [])

  useEffect(() => { fetchFees() }, [fetchFees])

  const addPayment = async (
    feeId: string,
    amount: number,
    paidDate: string,
    paymentMethod: PaymentMethod,
    notes?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('monthly_fee_payments')
      .insert({
        fee_id: feeId,
        user_id: user.id,
        amount,
        paid_date: paidDate,
        payment_method: paymentMethod,
        notes: notes ?? null,
      })
      .select()
      .single()

    if (error) return { error }

    const payment = data as MonthlyFeePayment

    // Update local state
    setFees(prev => prev.map(f => {
      if (f.id !== feeId) return f
      const updatedPayments = [...(f.payments ?? []), payment]
      const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0)
      const nowFullyPaid = totalPaid >= f.amount
      return { ...f, payments: updatedPayments, paid: nowFullyPaid }
    }))

    // Keep the monthly_fees.paid flag in sync
    const fee = fees.find(f => f.id === feeId)
    if (fee) {
      const existingTotal = (fee.payments ?? []).reduce((s, p) => s + p.amount, 0)
      const newTotal = existingTotal + amount
      if (newTotal >= fee.amount && !fee.paid) {
        await supabase
          .from('monthly_fees')
          .update({ paid: true, paid_date: paidDate })
          .eq('id', feeId)
      }
    }

    return { data: payment }
  }

  const deletePayment = async (paymentId: string, feeId: string) => {
    const { error } = await supabase
      .from('monthly_fee_payments')
      .delete()
      .eq('id', paymentId)

    if (error) return { error }

    // Recalculate paid status after deletion and sync to DB if changed
    const fee = fees.find(f => f.id === feeId)
    if (fee) {
      const updatedPayments = (fee.payments ?? []).filter(p => p.id !== paymentId)
      const newTotal = updatedPayments.reduce((s, p) => s + p.amount, 0)
      const nowPaid = newTotal >= fee.amount
      if (fee.paid && !nowPaid) {
        // Payment deletion brought total below threshold — un-mark as paid in DB
        await supabase
          .from('monthly_fees')
          .update({ paid: false, paid_date: null })
          .eq('id', feeId)
      }
    }

    setFees(prev => prev.map(f => {
      if (f.id !== feeId) return f
      const updatedPayments = (f.payments ?? []).filter(p => p.id !== paymentId)
      const totalPaid = updatedPayments.reduce((s, p) => s + p.amount, 0)
      return { ...f, payments: updatedPayments, paid: totalPaid >= f.amount }
    }))

    return {}
  }

  const updateFee = async (id: string, updates: Partial<Pick<MonthlyFee, 'amount' | 'notes'>>) => {
    const { data, error } = await supabase
      .from('monthly_fees')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    setFees(prev => prev.map(f => f.id === id ? { ...f, ...(data as MonthlyFee) } : f))
    return { data: data as MonthlyFee }
  }

  const addFee = async (month: string, amount = 350) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }
    const { data, error } = await supabase
      .from('monthly_fees')
      .insert({ user_id: user.id, month, amount })
      .select()
      .single()
    if (error) return { error }
    const newFee = { ...(data as MonthlyFee), payments: [] }
    setFees(prev => [newFee, ...prev].sort((a, b) => b.month.localeCompare(a.month)))
    return { data: newFee }
  }

  const deleteFee = async (id: string) => {
    // Delete child payments first (safe even if FK cascade is set)
    await supabase.from('monthly_fee_payments').delete().eq('fee_id', id)
    const { error } = await supabase.from('monthly_fees').delete().eq('id', id)
    if (error) return { error }
    setFees(prev => prev.filter(f => f.id !== id))
    return {}
  }

  return { fees, loading, error, refetch: fetchFees, addPayment, deletePayment, updateFee, addFee, deleteFee }
}
