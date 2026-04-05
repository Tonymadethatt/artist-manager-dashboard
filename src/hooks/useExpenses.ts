import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Expense } from '@/types'

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('expenses')
      .select(`
        *,
        venue:venues(id, name)
      `)
      .order('date', { ascending: false })
    setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const addExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'venue'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('expenses')
      .insert({ ...expense, user_id: user!.id })
      .select(`
        *,
        venue:venues(id, name)
      `)
      .single()
    if (error) return { error }
    setExpenses(prev => [data as Expense, ...prev])
    return { data: data as Expense }
  }

  const updateExpense = async (id: string, updates: Partial<Omit<Expense, 'id' | 'created_at' | 'venue'>>) => {
    const { data, error } = await supabase
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        venue:venues(id, name)
      `)
      .single()
    if (error) return { error }
    setExpenses(prev => prev.map(e => e.id === id ? data as Expense : e))
    return { data: data as Expense }
  }

  const deleteExpense = async (id: string) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error) return { error }
    setExpenses(prev => prev.filter(e => e.id !== id))
    return {}
  }

  return { expenses, loading, refetch: fetchExpenses, addExpense, updateExpense, deleteExpense }
}
