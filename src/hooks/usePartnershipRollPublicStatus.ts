import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { getPartnershipRollOwnerId } from '@/lib/partnerships/partnershipRollOwner'

export type PartnershipRollPublicOwnerRow = {
  confirmed_at: string | null
  edit_window_ends_at: string | null
  confirmation_document_downloaded_at: string | null
}

/** Loads partnership_roll_public_owner (id=1) when the signed-in user is the designated roll owner. */
export function usePartnershipRollPublicStatus(userId: string | null) {
  const ownerEnvId = getPartnershipRollOwnerId()
  const enabled = Boolean(userId && ownerEnvId && userId === ownerEnvId)

  const [row, setRow] = useState<PartnershipRollPublicOwnerRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!enabled) {
      setRow(null)
      setError(null)
      return
    }
    const { data, error: qErr } = await supabase
      .from('partnership_roll_public_owner')
      .select('confirmed_at, edit_window_ends_at, confirmation_document_downloaded_at')
      .eq('id', 1)
      .single()

    if (qErr) {
      setError(qErr.message)
      return
    }
    setError(null)
    setRow({
      confirmed_at: data?.confirmed_at ?? null,
      edit_window_ends_at: data?.edit_window_ends_at ?? null,
      confirmation_document_downloaded_at: data?.confirmation_document_downloaded_at ?? null,
    })
  }, [enabled])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!enabled) return
    const t = window.setInterval(() => void load(), 12000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [enabled, load])

  return { row, error, reload: load, enabled }
}
