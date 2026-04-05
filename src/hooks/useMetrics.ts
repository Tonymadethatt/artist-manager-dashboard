import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Metric, MetricCategory } from '@/types'

export function useMetrics() {
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMetrics = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('metrics')
      .select('*, deal:deals(id, description)')
      .order('date', { ascending: false })
    if (error) setError(error.message)
    else setMetrics((data ?? []) as Metric[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchMetrics() }, [fetchMetrics])

  const addMetric = async (metric: {
    date: string
    category: MetricCategory
    title: string
    numeric_value: number | null
    description: string | null
    deal_id: string | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const { data, error } = await supabase
      .from('metrics')
      .insert({ user_id: user.id, ...metric })
      .select('*, deal:deals(id, description)')
      .single()
    if (error) return { error }
    setMetrics(prev => [data as Metric, ...prev])
    return { data: data as Metric }
  }

  const updateMetric = async (id: string, updates: Partial<Omit<Metric, 'id' | 'user_id' | 'created_at' | 'deal'>>) => {
    const { data, error } = await supabase
      .from('metrics')
      .update(updates)
      .eq('id', id)
      .select('*, deal:deals(id, description)')
      .single()
    if (error) return { error }
    setMetrics(prev => prev.map(m => m.id === id ? data as Metric : m))
    return { data: data as Metric }
  }

  const deleteMetric = async (id: string) => {
    const { error } = await supabase.from('metrics').delete().eq('id', id)
    if (error) return { error }
    setMetrics(prev => prev.filter(m => m.id !== id))
    return {}
  }

  return { metrics, loading, error, refetch: fetchMetrics, addMetric, updateMetric, deleteMetric }
}
