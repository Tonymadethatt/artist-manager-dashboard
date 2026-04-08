import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Deal, CommissionTier } from '@/types'
import { COMMISSION_TIER_RATES as RATES } from '@/types'

type DealUpdate = Database['public']['Tables']['deals']['Update']

export function useDeals() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDeals = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('deals')
      .select('*, venue:venues(id, name, outreach_track)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setDeals((data ?? []) as Deal[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchDeals() }, [fetchDeals])

  const addDeal = async (deal: {
    description: string
    venue_id: string | null
    event_date: string | null
    gross_amount: number
    commission_tier: CommissionTier
    commission_rate?: number
    payment_due_date?: string | null
    agreement_url?: string | null
    agreement_generated_file_id?: string | null
    notes: string | null
  }) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const rate = deal.commission_rate ?? RATES[deal.commission_tier]
    const amount = Math.round(deal.gross_amount * rate * 100) / 100

    const { data, error } = await supabase
      .from('deals')
      .insert({
        user_id: user.id,
        description: deal.description,
        venue_id: deal.venue_id,
        event_date: deal.event_date,
        gross_amount: deal.gross_amount,
        commission_tier: deal.commission_tier,
        commission_rate: rate,
        commission_amount: amount,
        payment_due_date: deal.payment_due_date ?? null,
        agreement_url: deal.agreement_url ?? null,
        agreement_generated_file_id: deal.agreement_generated_file_id ?? null,
        notes: deal.notes,
      })
      .select('*, venue:venues(id, name, outreach_track)')
      .single()
    if (error) return { error }
    setDeals(prev => [data as Deal, ...prev])
    return { data: data as Deal }
  }

  const updateDeal = async (id: string, updates: Omit<DealUpdate, 'id' | 'user_id'>) => {
    // Recalculate commission_amount if gross or rate changed
    const existing = deals.find(d => d.id === id)
    const gross = (updates.gross_amount as number | undefined) ?? existing?.gross_amount ?? 0
    const rate = (updates.commission_rate as number | undefined) ??
      (updates.commission_tier ? RATES[updates.commission_tier as CommissionTier] : undefined) ??
      existing?.commission_rate ?? 0

    const patch: Omit<DealUpdate, 'id' | 'user_id'> = {
      ...updates,
      commission_amount: Math.round(gross * rate * 100) / 100,
    }

    const { data, error } = await supabase
      .from('deals')
      .update(patch)
      .eq('id', id)
      .select('*, venue:venues(id, name, outreach_track)')
      .single()
    if (error) return { error }
    setDeals(prev => prev.map(d => d.id === id ? data as Deal : d))
    return { data: data as Deal }
  }

  const deleteDeal = async (id: string) => {
    const { error } = await supabase.from('deals').delete().eq('id', id)
    if (error) return { error }
    setDeals(prev => prev.filter(d => d.id !== id))
    return {}
  }

  const toggleArtistPaid = async (id: string, paid: boolean) => {
    return updateDeal(id, {
      artist_paid: paid,
      artist_paid_date: paid ? new Date().toISOString().split('T')[0] : null,
    })
  }

  const toggleManagerPaid = async (id: string, paid: boolean) => {
    return updateDeal(id, {
      manager_paid: paid,
      manager_paid_date: paid ? new Date().toISOString().split('T')[0] : null,
    })
  }

  return {
    deals,
    loading,
    error,
    refetch: fetchDeals,
    addDeal,
    updateDeal,
    deleteDeal,
    toggleArtistPaid,
    toggleManagerPaid,
  }
}
