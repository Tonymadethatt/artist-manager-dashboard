import { useLayoutEffect } from 'react'
import { useParams } from 'react-router-dom'
import { isEmailCaptureTokenUuid } from '@/lib/emailCapture/applyVenueEmailOneTapAck'

/**
 * When `/venue-email-ack/**` is handled by the SPA (local Vite without Netlify rewrites, or misrouting),
 * send the browser to the Netlify function in one GET so the token is processed and thank-you HTML is shown.
 * In production, Netlify `_redirects` normally proxies this path before the SPA loads.
 */
export default function VenueEmailAckBridge() {
  const { token } = useParams<{ token: string }>()
  const raw = (token ?? '').trim()
  const valid = isEmailCaptureTokenUuid(raw)

  useLayoutEffect(() => {
    if (!valid) return
    const url = `${window.location.origin}/.netlify/functions/venue-email-ack?token=${encodeURIComponent(raw)}`
    window.location.replace(url)
  }, [raw, valid])

  if (!valid) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
        <p className="max-w-sm text-center text-sm text-neutral-400">
          This link is invalid. Use the button in your email, or reply to that message directly.
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <p className="text-sm text-neutral-500">Confirming…</p>
    </div>
  )
}
