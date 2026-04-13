import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Venue, Contact, OutreachNote } from '@/types'
import { ensureCalendarEmailsForVenueDeals } from '@/lib/calendar/queueGigCalendarEmails'

type VenueUpdate = Database['public']['Tables']['venues']['Update']
type ContactUpdate = Database['public']['Tables']['contacts']['Update']

function normalizeContactFromDb(raw: unknown): Contact {
  const c = raw as Contact
  return { ...c, title_key: c.title_key ?? null, role: c.role ?? null }
}

export function useVenues() {
  const [venues, setVenues] = useState<Venue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVenues = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('venues')
      .select('*')
      .order('updated_at', { ascending: false })

    if (error) setError(error.message)
    else setVenues((data ?? []) as Venue[])
    setLoading(false)
  }, [])

  useEffect(() => { fetchVenues() }, [fetchVenues])

  const addVenue = async (venue: Omit<Venue, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('venues')
      .insert({
        user_id: user!.id,
        name: venue.name,
        location: venue.location,
        city: venue.city,
        address_line2: venue.address_line2,
        region: venue.region,
        postal_code: venue.postal_code,
        country: venue.country,
        venue_type: venue.venue_type,
        priority: venue.priority,
        status: venue.status,
        outreach_track: venue.outreach_track ?? 'pipeline',
        follow_up_date: venue.follow_up_date,
        deal_terms: venue.deal_terms,
        capacity: venue.capacity ?? null,
      })
      .select()
      .single()
    if (error) return { error }
    setVenues(prev => [data as Venue, ...prev])
    return { data: data as Venue }
  }

  const updateVenue = async (id: string, updates: Omit<VenueUpdate, 'id' | 'user_id'>) => {
    const { data, error } = await supabase
      .from('venues')
      .update(updates)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    setVenues(prev => prev.map(v => v.id === id ? data as Venue : v))
    if ('status' in updates) {
      void ensureCalendarEmailsForVenueDeals(id)
    }
    return { data: data as Venue }
  }

  const deleteVenue = async (id: string) => {
    const { error } = await supabase.from('venues').delete().eq('id', id)
    if (error) return { error }
    setVenues(prev => prev.filter(v => v.id !== id))
    return {}
  }

  return { venues, loading, error, refetch: fetchVenues, addVenue, updateVenue, deleteVenue }
}

export function useVenueDetail(venueId: string | null) {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [notes, setNotes] = useState<OutreachNote[]>([])
  const [loading, setLoading] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!venueId) return
    setLoading(true)
    const [contactsRes, notesRes] = await Promise.all([
      supabase.from('contacts').select('*').eq('venue_id', venueId).order('created_at'),
      supabase.from('outreach_notes').select('*').eq('venue_id', venueId).order('created_at', { ascending: false }),
    ])
    setContacts((contactsRes.data ?? []).map(normalizeContactFromDb))
    setNotes((notesRes.data ?? []) as OutreachNote[])
    setLoading(false)
  }, [venueId])

  useEffect(() => { fetchDetail() }, [fetchDetail])

  const addContact = async (contact: Omit<Contact, 'id' | 'user_id' | 'created_at'>) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        user_id: user!.id,
        venue_id: contact.venue_id,
        name: contact.name,
        title_key: contact.title_key ?? null,
        role: contact.role,
        email: contact.email,
        phone: contact.phone,
        company: contact.company,
      })
      .select()
      .single()
    if (error) return { error }
    const row = normalizeContactFromDb(data)
    setContacts(prev => [...prev, row])
    return { data: row }
  }

  const updateContact = async (id: string, updates: Omit<ContactUpdate, 'id' | 'user_id'>) => {
    const patch: ContactUpdate = {
      name: updates.name,
      company: updates.company ?? null,
      title_key: updates.title_key ?? null,
      role: updates.role ?? null,
      email: updates.email ?? null,
      phone: updates.phone ?? null,
    }
    const { data, error } = await supabase
      .from('contacts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) return { error }
    const row = normalizeContactFromDb(data)
    setContacts(prev => prev.map(c => (c.id === id ? row : c)))
    return { data: row }
  }

  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('contacts').delete().eq('id', id)
    if (error) return { error }
    setContacts(prev => prev.filter(c => c.id !== id))
    return {}
  }

  const addNote = async (venueId: string, note: string, category?: string | null) => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('outreach_notes')
      .insert({ venue_id: venueId, note, user_id: user!.id, category: category ?? null })
      .select()
      .single()
    if (error) return { error }
    setNotes(prev => [data as OutreachNote, ...prev])
    return { data: data as OutreachNote }
  }

  return { contacts, notes, loading, refetch: fetchDetail, addContact, updateContact, deleteContact, addNote }
}
