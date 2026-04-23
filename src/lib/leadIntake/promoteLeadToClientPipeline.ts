import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { Venue } from '@/types'

type LeadRow = Database['public']['Tables']['leads']['Row']

/**
 * Create an outreach (`venues`) row from a lead, optional contact, and stamp promotion on the lead.
 * Rolls back the new venue if the lead link fails.
 */
export async function promoteLeadToClientPipeline(lead: LeadRow): Promise<
  { ok: true; venue: Venue } | { ok: false; message: string }
> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Not signed in' }
  if (lead.promoted_venue_id) {
    return { ok: false, message: 'This lead is already linked to a venue.' }
  }

  const name = (lead.venue_name ?? '').trim() || 'New venue'
  const { data: venue, error: vErr } = await supabase
    .from('venues')
    .insert({
      user_id: user.id,
      name,
      city: lead.city,
      location: null,
      venue_type: 'other',
      priority: 3,
      status: 'not_contacted',
      outreach_track: 'pipeline',
    })
    .select()
    .single()

  if (vErr || !venue) {
    return { ok: false, message: vErr?.message ?? 'Could not create venue' }
  }

  const v = venue as Venue
  const email = lead.contact_email?.trim()
  const phone = lead.contact_phone?.trim()
  if (email || phone) {
    const { error: cErr } = await supabase.from('contacts').insert({
      user_id: user.id,
      venue_id: v.id,
      name: 'Primary contact',
      email: email || null,
      phone: phone || null,
      role: 'Booking',
    })
    if (cErr) {
      await supabase.from('venues').delete().eq('id', v.id)
      return { ok: false, message: cErr.message }
    }
  }

  const { error: uErr } = await supabase
    .from('leads')
    .update({
      promoted_venue_id: v.id,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', lead.id)
    .eq('user_id', user.id)

  if (uErr) {
    await supabase.from('venues').delete().eq('id', v.id)
    return { ok: false, message: uErr.message }
  }

  return { ok: true, venue: v }
}
