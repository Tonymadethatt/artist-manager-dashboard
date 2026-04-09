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

/**
 * Thank-you page: success icon + card copy; one “Back to mail” control below the card.
 * Click uses history.back() when the tab has prior history, else document.referrer (often the webmail page that opened this link). No provider picker.
 */
function htmlShellThankYou(title: string, inner: string): string {
  const successIcon = `<div class="ack-icon-wrap" aria-hidden="true">
  <svg class="ack-check-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="12" fill="#22c55e"/>
    <path d="M6.5 12.5l3.5 3.5 7.5-8.5" fill="none" stroke="#fafafa" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>
</div>`
  const mailBack = `<div class="mail-back">
  <button type="button" class="mail-btn" id="ack-back-mail">Back to mail</button>
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
  .mail-back { margin-top: 24px; text-align: center; }
  .mail-btn { width: 100%; display: block; cursor: pointer; font: inherit; font-size: 0.9rem; font-weight: 600;
    text-align: center; color: #fafafa; background: #1a1a1a; border: 1px solid #333333; border-radius: 8px; padding: 14px 16px;
    min-height: 48px; line-height: 1.3; -webkit-tap-highlight-color: transparent; }
  .mail-btn:active { background: #262626; }
</style>
</head>
<body>
  <div class="ack-wrap">
    <div class="card">${successIcon}${inner}</div>
    ${mailBack}
  </div>
<script>
(function () {
  var btn = document.getElementById('ack-back-mail')
  if (!btn) return
  btn.addEventListener('click', function () {
    try {
      if (window.history.length > 1) {
        window.history.back()
        return
      }
    } catch (e) {}
    try {
      var r = document.referrer
      if (!r) return
      var u = new URL(r)
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        window.location.assign(r)
      }
    } catch (e2) {}
  })
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
  const body = htmlShellThankYou(copy.heading, `<h1>${esc(copy.heading)}</h1>${paras}`)

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
