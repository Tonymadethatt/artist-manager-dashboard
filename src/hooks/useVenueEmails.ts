import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { VenueEmail, VenueEmailType, VenueEmailStatus } from '@/types'

interface LogEmailParams {
  venue_id?: string | null
  deal_id?: string | null
  contact_id?: string | null
  email_type: VenueEmailType
  recipient_email: string
  subject: string
  status: VenueEmailStatus
  notes?: string | null
}

export function useVenueEmails() {
  const [emails, setEmails] = useState<VenueEmail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEmails = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('venue_emails')
      .select('*, venue:venues(id, name, city, location), deal:deals(id, description, event_date, gross_amount, agreement_url, notes, payment_due_date, artist_paid), contact:contacts(id, name, email)')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setEmails((data ?? []) as VenueEmail[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchEmails() }, [fetchEmails])

  const logEmail = async (params: LogEmailParams): Promise<{ data?: VenueEmail; error?: Error }> => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: new Error('Not authenticated') }

    const sentAt = params.status === 'sent' ? new Date().toISOString() : null

    const { data, error } = await supabase
      .from('venue_emails')
      .insert({
        user_id: user.id,
        venue_id: params.venue_id ?? null,
        deal_id: params.deal_id ?? null,
        contact_id: params.contact_id ?? null,
        email_type: params.email_type,
        recipient_email: params.recipient_email,
        subject: params.subject,
        status: params.status,
        sent_at: sentAt,
        notes: params.notes ?? null,
      })
      .select('*, venue:venues(id, name), deal:deals(id, description)')
      .single()

    if (error) return { error: new Error(error.message) }
    const entry = data as VenueEmail
    setEmails(prev => [entry, ...prev])
    return { data: entry }
  }

  const queueEmail = async (params: Omit<LogEmailParams, 'status'>) => {
    return logEmail({ ...params, status: 'pending' })
  }

  const updateEmailStatus = async (id: string, status: VenueEmailStatus) => {
    const sentAt = status === 'sent' ? new Date().toISOString() : null
    const { error } = await supabase
      .from('venue_emails')
      .update({ status, ...(sentAt ? { sent_at: sentAt } : {}) })
      .eq('id', id)
    if (error) return { error: new Error(error.message) }
    setEmails(prev => prev.map(e => e.id === id ? { ...e, status, sent_at: sentAt ?? e.sent_at } : e))
    return {}
  }

  const dismissQueued = async (id: string) => {
    const { error } = await supabase.from('venue_emails').delete().eq('id', id)
    if (error) return { error: new Error(error.message) }
    setEmails(prev => prev.filter(e => e.id !== id))
    return {}
  }

  const pendingEmails = emails.filter(e => e.status === 'pending')
  const sentEmails = emails.filter(e => e.status !== 'pending')

  return {
    emails,
    pendingEmails,
    sentEmails,
    loading,
    error,
    refetch: fetchEmails,
    logEmail,
    queueEmail,
    updateEmailStatus,
    dismissQueued,
  }
}
