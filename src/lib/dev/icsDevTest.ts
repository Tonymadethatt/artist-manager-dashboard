import { supabase } from '@/lib/supabase'

/** Overview + Settings show the ICS dev control when local dev runs, or when explicitly enabled for deploys. */
export function isIcsDevToolEnabled(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ENABLE_ICS_DEV_TOOL === 'true'
}

export async function sendDevIcsTestEmail(): Promise<{ ok: boolean; message: string }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) {
    return { ok: false, message: 'Sign in again to send the test.' }
  }
  const res = await fetch('/.netlify/functions/send-dev-ics-test', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  })
  let data: { message?: string } = {}
  try {
    data = (await res.json()) as { message?: string }
  } catch {
    /* empty body */
  }
  if (!res.ok) {
    const msg = typeof data.message === 'string' ? data.message : `Request failed (${res.status})`
    return { ok: false, message: msg }
  }
  return { ok: true, message: typeof data.message === 'string' ? data.message : 'Test .ics sent.' }
}
