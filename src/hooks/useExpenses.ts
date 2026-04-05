import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Expense } from '@/types'

type ExpenseUpdate = Database['public']['Tables']['expenses']['Update']

export function useExpenses() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchExpenses = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expenses')
      .select(`
        *,
        venue:venues(id, name)
      `)
      .order('date', { ascending: false })
    if (error) setError(error.message)
    else setExpenses((data ?? []) as Expense[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchExpenses() }, [fetchExpenses])

  const addExpense = async (expense: Omit<Expense, 'id' | 'user_id' | 'created_at' | 'venue'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('expenses')
      .insert({
        user_id: user!.id,
        amount: expense.amount,
        category: expense.category,
        description: expense.description,
        date: expense.date,
        venue_id: expense.venue_id,
      })
      .select(`
        *,
        venue:venues(id, name)
      `)
      .single()
    if (error) return { error }
    setExpenses(prev => [data as Expense, ...prev])
    return { data: data as Expense }
  }

  const updateExpense = async (id: string, updates: Omit<ExpenseUpdate, 'id' | 'user_id'>) => {
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

  return { expenses, loading, error, refetch: fetchExpenses, addExpense, updateExpense, deleteExpense }
}
