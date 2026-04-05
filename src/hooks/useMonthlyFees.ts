import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { MonthlyFee } from '@/types'

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

    const { data, error } = await supabase
      .from('monthly_fees')
      .select('*')
      .eq('user_id', user.id)
      .order('month', { ascending: false })
    if (error) { setError(error.message); setLoading(false); return }

    const list = (data ?? []) as MonthlyFee[]

    // Auto-create current month entry if missing
    const thisMonth = currentMonthFirst()
    if (!list.find(f => f.month === thisMonth)) {
      const { data: created, error: insertErr } = await supabase
        .from('monthly_fees')
        .insert({ user_id: user.id, month: thisMonth })
        .select()
        .single()
      if (!insertErr && created) {
        list.unshift(created as MonthlyFee)
      }
    }

    setFees(list)
    setLoading(false)
  }, [])

  useEffect(() => { fetchFees() }, [fetchFees])

  const togglePaid = async (id: string, paid: boolean) => {
    const patch = {
      paid,
      paid_date: paid ? new Date().toISOString().split('T')[0] : null,
    }
    const { data, error } = await supabase
      .from('monthly_fees')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    setFees(prev => prev.map(f => f.id === id ? data as MonthlyFee : f))
    return { data: data as MonthlyFee }
  }

  const updateFee = async (id: string, updates: Partial<Pick<MonthlyFee, 'amount' | 'notes'>>) => {
    const { data, error } = await supabase
      .from('monthly_fees')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    setFees(prev => prev.map(f => f.id === id ? data as MonthlyFee : f))
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
    setFees(prev => [data as MonthlyFee, ...prev].sort((a, b) => b.month.localeCompare(a.month)))
    return { data: data as MonthlyFee }
  }

  return { fees, loading, error, refetch: fetchFees, togglePaid, updateFee, addFee }
}
