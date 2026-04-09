import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import {
  isEmailCaptureTokenUuid,
  runVenueEmailOneTapAck,
  oneTapAckThanksCopy,
} from '../../src/lib/emailCapture/applyVenueEmailOneTapAck'

/**
 * GET /.netlify/functions/venue-email-ack?token=uuid
 * Proxied from /venue-email-ack/:token so ack links stay on the site domain and
 * do not load the authenticated SPA (which would send managers to the dashboard).
 */
function resolveTokenFromEvent(event: HandlerEvent): string | null {
  const fromParams = event.queryStringParameters?.token?.trim()
  if (fromParams && isEmailCaptureTokenUuid(fromParams)) return fromParams

  const rawQ = event.rawQuery?.replace(/^\?/, '') ?? ''
  if (rawQ) {
    const t = new URLSearchParams(rawQ).get('token')?.trim()
    if (t && isEmailCaptureTokenUuid(t)) return t
  }

  const pathMatch = (event.path || '').match(/\/venue-email-ack\/([^/?#]+)/)
  if (pathMatch?.[1] && isEmailCaptureTokenUuid(pathMatch[1])) return pathMatch[1]

  try {
    const u = new URL(event.rawUrl)
    const seg = u.pathname.match(/\/venue-email-ack\/([^/?#]+)/)?.[1]
    if (seg && isEmailCaptureTokenUuid(seg)) return seg
    const t2 = u.searchParams.get('token')?.trim()
    if (t2 && isEmailCaptureTokenUuid(t2)) return t2
  } catch {
    // ignore invalid rawUrl
  }

  return null
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlShell(title: string, inner: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #0d0d0d; color: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; -webkit-font-smoothing: antialiased; }
  .card { max-width: 420px; width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 10px; padding: 28px 24px; text-align: center; }
  h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 14px; color: #fafafa; }
  p { font-size: 0.9rem; color: #a3a3a3; line-height: 1.6; margin-bottom: 10px; }
  p:last-child { margin-bottom: 0; }
</style>
</head>
<body>
  <div class="card">${inner}</div>
</body>
</html>`
}

/** Thank-you page only: big success icon in card; countdown + history.back() live below the card. */
function htmlShellWithCountdown(title: string, inner: string, opts: { seconds: number }): string {
  const seconds = Math.max(1, Math.min(30, Math.floor(opts.seconds)))
  const successIcon = `<div class="ack-icon-wrap" aria-hidden="true">
  <svg class="ack-check-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#22c55e"/>
    <path d="M6.5 12.5l3.5 3.5 7.5-8.5" fill="none" stroke="#fafafa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>`
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    background: #0d0d0d; color: #fafafa; min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; -webkit-font-smoothing: antialiased; }
  .ack-wrap { width: 100%; max-width: 420px; }
  .card { width: 100%; background: #141414; border: 1px solid #2a2a2a; border-radius: 10px; padding: 28px 24px; text-align: center; }
  .ack-icon-wrap { display: flex; justify-content: center; margin-bottom: 20px; }
  .ack-check-svg { width: 72px; height: 72px; display: block; }
  .card h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 14px; color: #fafafa; }
  .card p { font-size: 0.9rem; color: #a3a3a3; line-height: 1.6; margin-bottom: 10px; }
  .card p:last-child { margin-bottom: 0; }
  #ack-status { margin-top: 20px; font-size: 0.9rem; color: #a3a3a3; line-height: 1.6; text-align: center; min-height: 1.5em; }
</style>
</head>
<body>
  <div class="ack-wrap">
    <div class="card">${successIcon}${inner}</div>
    <p id="ack-status" role="status" aria-live="polite" aria-atomic="true"></p>
  </div>
<script>
(function () {
  var el = document.getElementById('ack-status')
  if (!el) return
  var total = ${seconds}
  var reduce = false
  try {
    reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (e) {}
  function finish() {
    try {
      if (window.history.length > 1) window.history.back()
    } catch (e) {}
    el.textContent = ''
  }
  if (reduce) {
    finish()
    return
  }
  var n = total
  el.textContent = 'Returning to the previous page in ' + n + '…'
  var id = window.setInterval(function () {
    n -= 1
    if (n < 1) {
      window.clearInterval(id)
      finish()
    } else {
      el.textContent = 'Returning to the previous page in ' + n + '…'
    }
  }, 1000)
})()
</script>
</body>
</html>`
}

const handler: Handler = async event => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return {
      statusCode: 405,
      body: 'Method not allowed',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    }
  }

  const token = resolveTokenFromEvent(event)
  if (!token) {
    const body = htmlShell(
      'Link issue',
      '<h1>This link is invalid</h1><p>Please use the button in your email, or reply to that message directly.</p>',
    )
    return { statusCode: 400, body, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  }

  if (event.httpMethod === 'HEAD') {
    return { statusCode: 200, body: '', headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    const body = htmlShell(
      'Unavailable',
      '<h1>Something went wrong</h1><p>Please try again later or reply to the email.</p>',
    )
    return { statusCode: 500, body, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)
  const result = await runVenueEmailOneTapAck(supabase, token)

  if (result.kind === 'error') {
    const body = htmlShell(
      'Link issue',
      `<h1>We couldn’t complete that</h1><p>${esc(result.message)}</p>`,
    )
    return {
      statusCode: 200,
      body,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    }
  }

  const copy = oneTapAckThanksCopy(result.captureKind, result.alreadyReceived)
  const paras = copy.lines.map(l => `<p>${esc(l)}</p>`).join('')
  const body = htmlShellWithCountdown(copy.heading, `<h1>${esc(copy.heading)}</h1>${paras}`, {
    seconds: 5,
  })

  return {
    statusCode: 200,
    body,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  }
}

export { handler }
