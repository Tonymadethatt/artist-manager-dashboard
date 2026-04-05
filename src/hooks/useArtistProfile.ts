import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { ArtistProfile } from '@/types'

const DEFAULTS: Omit<ArtistProfile, 'user_id' | 'created_at' | 'updated_at'> = {
  artist_name: 'DJ Luijay',
  artist_email: 'Djluijay3@gmail.com',
  manager_name: null,
  manager_email: null,
  from_email: 'management@djluijay.live',
}

export function useArtistProfile() {
  const [profile, setProfile] = useState<ArtistProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data, error } = await supabase
      .from('artist_profile')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) { setError(error.message); setLoading(false); return }

    if (!data) {
      // Auto-create with defaults on first load
      const { data: created, error: insertErr } = await supabase
        .from('artist_profile')
        .insert({ user_id: user.id, ...DEFAULTS })
        .select()
        .single()
      if (insertErr) setError(insertErr.message)
      else setProfile(created as ArtistProfile)
    } else {
      setProfile(data as ArtistProfile)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfile() }, [fetchProfile])

  const updateProfile = async (updates: Partial<Omit<ArtistProfile, 'user_id' | 'created_at' | 'updated_at'>>) => {
    if (!profile) return { error: new Error('No profile loaded') }
    const { data, error } = await supabase
      .from('artist_profile')
      .update(updates)
      .eq('user_id', profile.user_id)
      .select()
      .single()
    if (error) return { error }
    setProfile(data as ArtistProfile)
    return { data: data as ArtistProfile }
  }

  return { profile, loading, error, updateProfile, refetch: fetchProfile }
}
