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
  const body = htmlShell(copy.heading, `<h1>${esc(copy.heading)}</h1>${paras}`)

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
