import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { GoogleCalendarSyncResponseBody } from '@/lib/calendar/googleCalendarSyncToast'
import { googleCalendarSyncSuccessMessageSettings } from '@/lib/calendar/googleCalendarSyncToast'
import type { Database } from '@/types/database'

type ConnectionRow = Database['public']['Tables']['google_calendar_connection']['Row']

function fnPath(name: string): string {
  return `/.netlify/functions/${name}`
}

export function GoogleCalendarSettingsCard({
  userId,
  showToast,
}: {
  userId: string | null
  showToast: (msg: string, type: 'ok' | 'err') => void
}) {
  const [loading, setLoading] = useState(true)
  const [connection, setConnection] = useState<ConnectionRow | null>(null)
  const [sourceCal, setSourceCal] = useState('')
  const [pastDays, setPastDays] = useState('7')
  const [futureDays, setFutureDays] = useState('180')
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [dedupScanning, setDedupScanning] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  /** `google_email` can be null if an older OAuth flow lacked email scopes; tokens still work. */
  const connected = !!connection?.connected_at

  const load = useCallback(async () => {
    if (!userId) {
      setLoading(false)
      setConnection(null)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('google_calendar_connection')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
    setLoading(false)
    if (error) {
      console.warn('[GoogleCalendarSettings]', error)
      setConnection(null)
      return
    }
    setConnection(data)
    if (data) {
      setSourceCal(data.source_calendar_id ?? '')
      setPastDays(String(data.sync_past_days ?? 7))
      setFutureDays(String(data.sync_future_days ?? 180))
    }
  }, [userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('calendar_oauth')
    if (!q) return
    const messages: Record<string, string> = {
      success: 'Google Calendar connected. Add your shared calendar ID below, then import events to the dashboard.',
      denied: 'Google sign-in was cancelled.',
      invalid: 'OAuth callback missing parameters.',
      bad_state: 'OAuth session expired. Try connecting again.',
      token_failed: 'Could not complete Google sign-in.',
      no_refresh: 'Google did not return a refresh token. Try revoking app access in Google Account settings, then connect again.',
      misconfigured: 'Google OAuth is not configured on the server.',
      server: 'Server error during sign-in.',
      db: 'Saved tokens but database update failed.',
    }
    showToast(messages[q] ?? `Calendar OAuth: ${q}`, q === 'success' ? 'ok' : 'err')
    params.delete('calendar_oauth')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
    if (q === 'success') void load()
  }, [showToast, load])

  const getAccessToken = useCallback(async () => {
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session?.access_token) return null
    return data.session.access_token
  }, [])

  const handleConnect = async () => {
    const token = await getAccessToken()
    if (!token) {
      showToast('Sign in again to connect Google.', 'err')
      return
    }
    const res = await fetch(fnPath('google-calendar-oauth-start'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
    if (!res.ok || !j.url) {
      showToast(j.error ?? 'Could not start Google sign-in.', 'err')
      return
    }
    window.location.href = j.url
  }

  const handleSaveSettings = async () => {
    if (!userId || !connected) {
      showToast('Connect Google first.', 'err')
      return
    }
    const p = Math.max(0, Math.min(365, parseInt(pastDays, 10) || 0))
    const f = Math.max(0, Math.min(730, parseInt(futureDays, 10) || 0))
    setSaving(true)
    const { error } = await supabase
      .from('google_calendar_connection')
      .update({
        source_calendar_id: sourceCal.trim(),
        sync_past_days: p,
        sync_future_days: f,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    setSaving(false)
    if (error) {
      showToast(error.message, 'err')
      return
    }
    showToast('Calendar sync settings saved.', 'ok')
    void load()
  }

  const handleSync = async () => {
    if (!connected) {
      showToast('Connect Google and set a source calendar ID first.', 'err')
      return
    }
    if (!sourceCal.trim()) {
      showToast('Set the shared source calendar ID before syncing.', 'err')
      return
    }
    const token = await getAccessToken()
    if (!token) {
      showToast('Sign in again.', 'err')
      return
    }
    setSyncing(true)
    const res = await fetch(fnPath('google-calendar-sync'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = (await res.json().catch(() => ({}))) as GoogleCalendarSyncResponseBody & {
      error?: string
    }
    setSyncing(false)
    if (!res.ok) {
      showToast(j.error ?? 'Sync failed.', 'err')
      return
    }
    showToast(googleCalendarSyncSuccessMessageSettings(j), 'ok')
    void load()
    window.dispatchEvent(new CustomEvent('calendar-sync-events-changed'))
  }

  const handleDedupScan = async () => {
    if (!connected) {
      showToast('Connect Google first.', 'err')
      return
    }
    const token = await getAccessToken()
    if (!token) {
      showToast('Sign in again.', 'err')
      return
    }
    setDedupScanning(true)
    const res = await fetch(fnPath('google-calendar-dedup-scan'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    const j = (await res.json().catch(() => ({}))) as {
      error?: string
      scanned?: number
      hidden_duplicates?: number
      needs_review?: number
    }
    setDedupScanning(false)
    if (!res.ok) {
      showToast(j.error ?? 'Duplicate scan failed.', 'err')
      return
    }
    showToast(
      `Duplicate scan: ${j.hidden_duplicates ?? 0} hidden as duplicates, ${j.needs_review ?? 0} flagged for review (${j.scanned ?? 0} rows).`,
      'ok',
    )
    void load()
    window.dispatchEvent(new CustomEvent('calendar-sync-events-changed'))
  }

  const handleDisconnect = async () => {
    const token = await getAccessToken()
    if (!token) return
    setDisconnecting(true)
    await fetch(fnPath('google-calendar-disconnect'), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDisconnecting(false)
    showToast('Disconnected Google Calendar.', 'ok')
    void load()
  }

  const summary = connection?.last_sync_summary as
    | {
        imported?: number
        copied?: number
        refreshed?: number
        skipped?: number
        tasksCreated?: number
        errorCount?: number
        listed?: number
        errors?: string[]
      }
    | null
    | undefined

  const hint = 'text-xs text-neutral-600 leading-snug'

  return (
    <section
      className={cn(
        'bg-neutral-900 border border-neutral-800 rounded-lg p-4 sm:p-5 md:p-6 space-y-4 md:space-y-5',
        'lg:col-span-2',
      )}
    >
      <header className="space-y-1 border-b border-neutral-800/80 pb-3 md:pb-4">
        <h2 className="text-sm font-semibold tracking-tight text-neutral-100">Google Calendar sync</h2>
        <p className="text-xs text-neutral-500 leading-relaxed max-w-prose">
          Use one shared calendar ID (the one you share with your DJ). Events import into the Gig calendar here; when you book a gig in Earnings,
          it is also created or updated on that same Google calendar. Your Google account must have write access to that calendar.
          Imports that don&apos;t match a venue get a Pipeline task. The server also runs import + duplicate scan on a schedule (about every 12 minutes)
          for connected accounts, so the Gig calendar stays fresh without opening this page. Use <strong className="text-neutral-400">Sync now</strong> and{' '}
          <strong className="text-neutral-400">Scan for duplicates</strong> when you want an immediate refresh.
        </p>
      </header>

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            {connected ? (
              <p className="text-sm text-neutral-300">
                Connected
                {connection?.google_email ? (
                  <>
                    {' '}
                    as <span className="text-white font-medium">{connection.google_email}</span>
                  </>
                ) : (
                  <span className="text-neutral-500"> (open email not stored — use Sync or reconnect to refresh)</span>
                )}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">Not connected to Google.</p>
            )}
            {!connected ? (
              <Button type="button" size="sm" className="h-8 text-xs" onClick={() => void handleConnect()}>
                Connect Google Calendar
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs border-neutral-700 text-neutral-400"
                disabled={disconnecting}
                onClick={() => void handleDisconnect()}
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </Button>
            )}
          </div>

          <p className={hint}>
            If the app said you connected but this page looked empty before, refresh after deploy — or use{' '}
            <strong className="text-neutral-400">Disconnect</strong> then <strong className="text-neutral-400">Connect</strong>{' '}
            once so Google grants email + calendar permissions together.
          </p>

          <p className={hint}>
            In Google Calendar → Settings → your shared calendar → <strong className="text-neutral-400">Integrate calendar</strong>{' '}
            → copy the Calendar ID (looks like <code className="text-neutral-400">…@group.calendar.google.com</code>).
            Add authorized redirect URI in Google Cloud:{' '}
            <code className="text-neutral-500 break-all">
              {typeof window !== 'undefined' ? window.location.origin : ''}/.netlify/functions/google-calendar-oauth-callback
            </code>
          </p>

          <div className="space-y-1">
            <Label htmlFor="gcal-source">Shared calendar ID (import + publish)</Label>
            <Input
              id="gcal-source"
              value={sourceCal}
              onChange={e => setSourceCal(e.target.value)}
              placeholder="xxxx@group.calendar.google.com"
              disabled={!connected}
              className="bg-neutral-950 border-neutral-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="gcal-past">Sync past (days)</Label>
              <Input
                id="gcal-past"
                type="number"
                min={0}
                max={365}
                value={pastDays}
                onChange={e => setPastDays(e.target.value)}
                disabled={!connected}
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="gcal-future">Sync future (days)</Label>
              <Input
                id="gcal-future"
                type="number"
                min={0}
                max={730}
                value={futureDays}
                onChange={e => setFutureDays(e.target.value)}
                disabled={!connected}
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              disabled={!connected || saving}
              onClick={() => void handleSaveSettings()}
            >
              {saving ? 'Saving…' : 'Save settings'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={!connected || syncing || !sourceCal.trim()}
              onClick={() => void handleSync()}
            >
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs border-neutral-700"
              disabled={!connected || dedupScanning}
              onClick={() => void handleDedupScan()}
            >
              {dedupScanning ? 'Scanning…' : 'Scan for duplicates'}
            </Button>
          </div>

          {connection?.last_deal_push_error && (
            <div className="rounded-md border border-amber-800/60 bg-amber-950/30 p-3 text-xs text-amber-100/90">
              <p className="font-medium text-amber-50">Last gig publish to Google failed</p>
              <p className="mt-1 text-amber-100/85">{connection.last_deal_push_error}</p>
              {connection.last_deal_push_at && (
                <p className="mt-1 text-[11px] text-amber-200/70">
                  {new Date(connection.last_deal_push_at).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {connection?.last_sync_at && summary && (
            <div className="rounded-md border border-neutral-800 bg-neutral-950/60 p-3 text-xs text-neutral-400 space-y-1">
              <p className="text-neutral-300 font-medium">Last sync · {new Date(connection.last_sync_at).toLocaleString()}</p>
              <p>
                Listed {summary.listed ?? '—'} · Added {summary.imported ?? summary.copied ?? 0}
                {(summary.refreshed ?? 0) > 0 && <> · Refreshed {summary.refreshed}</>} · Skipped {summary.skipped ?? 0} · Tasks{' '}
                {summary.tasksCreated ?? 0}
                {(summary.errorCount ?? 0) > 0 && (
                  <span className="text-amber-400"> · {summary.errorCount} errors</span>
                )}
              </p>
              {summary.errors && summary.errors.length > 0 && (
                <ul className="list-disc pl-4 text-[11px] text-amber-200/90 space-y-0.5">
                  {summary.errors.slice(0, 5).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
