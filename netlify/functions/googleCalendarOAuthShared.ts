import { createHmac, randomBytes } from 'node:crypto'

export function calendarOAuthBaseUrl(): string {
  const u = (
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    ''
  ).replace(/\/$/, '')
  if (u) return u
  return 'http://localhost:8888'
}

export function getGoogleOAuthEnv(): {
  clientId: string | undefined
  clientSecret: string | undefined
  stateSecret: string | undefined
} {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim(),
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim(),
    stateSecret: process.env.GOOGLE_OAUTH_STATE_SECRET?.trim(),
  }
}

export const GOOGLE_CALENDAR_EVENTS_SCOPE = 'https://www.googleapis.com/auth/calendar.events'

export function signOAuthState(userId: string, secret: string): string {
  const payload = JSON.stringify({
    uid: userId,
    exp: Date.now() + 15 * 60_000,
    n: randomBytes(8).toString('hex'),
  })
  const body = Buffer.from(payload).toString('base64url')
  const sig = createHmac('sha256', secret).update(body).digest('base64url')
  return `${body}.${sig}`
}

export function verifyOAuthState(
  state: string,
  secret: string,
): { uid: string } | null {
  const dot = state.lastIndexOf('.')
  if (dot <= 0) return null
  const body = state.slice(0, dot)
  const sig = state.slice(dot + 1)
  const expected = createHmac('sha256', secret).update(body).digest('base64url')
  if (sig.length !== expected.length || !timingSafeEqualStr(sig, expected)) return null
  try {
    const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      uid?: string
      exp?: number
    }
    if (!json.uid || typeof json.exp !== 'number') return null
    if (Date.now() > json.exp) return null
    return { uid: json.uid }
  } catch {
    return null
  }
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

export async function exchangeCodeForTokens(args: {
  code: string
  clientId: string
  clientSecret: string
  redirectUri: string
}): Promise<{
  access_token: string
  refresh_token?: string
  expires_in: number
}> {
  const body = new URLSearchParams({
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: args.redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`token exchange failed: ${res.status} ${t}`)
  }
  return res.json() as Promise<{
    access_token: string
    refresh_token?: string
    expires_in: number
  }>
}

export async function refreshAccessToken(args: {
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ access_token: string; expires_in: number }> {
  const body = new URLSearchParams({
    refresh_token: args.refreshToken,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    grant_type: 'refresh_token',
  })
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  if (!res.ok) {
    const t = await res.text()
    throw new Error(`refresh failed: ${res.status} ${t}`)
  }
  return res.json() as Promise<{ access_token: string; expires_in: number }>
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) return null
  const j = (await res.json()) as { email?: string }
  return j.email ?? null
}
