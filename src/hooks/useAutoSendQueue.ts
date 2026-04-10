import { useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 60_000

/**
 * Background poller: every 60s, calls process-email-queue with the user's
 * Supabase JWT so the server processes any pending venue_emails that have
 * passed their buffer / scheduled_send_at.
 *
 * Runs only while the app is open and the user is logged in. Replaces the
 * dependency on an external cron or Netlify scheduled function.
 */
export function useAutoSendQueue() {
  const running = useRef(false)

  useEffect(() => {
    async function tick() {
      if (running.current) return
      running.current = true
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) return

        await fetch('/.netlify/functions/process-email-queue', {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
      } catch {
        // Network error, offline, etc. — silently retry next tick.
      } finally {
        running.current = false
      }
    }

    // Fire once immediately, then every 60s.
    tick()
    const id = setInterval(tick, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [])
}
