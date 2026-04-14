import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { seedPartnershipRollIfEmpty } from '@/lib/partnerships/seedPartnershipRollIfEmpty'
import { getPartnershipRollOwnerId } from '@/lib/partnerships/partnershipRollOwner'
import { applySocialPreviewMeta } from '@/lib/documentMeta'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Database } from '@/types/database'
import { Download, Loader2, Plus, Trash2 } from 'lucide-react'

type Row = Database['public']['Tables']['artist_partnership_roll_entries']['Row']

const PREVIOUS_CLIENTS_PAGE = {
  artistDisplayName: 'DJ Luijay',
  managementEmail: 'management@djluijay.live',
  documentHeading: 'Previous Clients and Partnerships',
} as const

function buildConfirmedListDocument(params: {
  confirmedAtIso: string
  entryNames: string[]
}): string {
  const confirmed = new Date(params.confirmedAtIso)
  const confirmedReadable = Number.isNaN(confirmed.getTime())
    ? params.confirmedAtIso
    : confirmed.toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'long' })
  const lines: string[] = [
    PREVIOUS_CLIENTS_PAGE.documentHeading.toUpperCase(),
    'Official confirmation record',
    '',
    PREVIOUS_CLIENTS_PAGE.artistDisplayName,
    `Management: ${PREVIOUS_CLIENTS_PAGE.managementEmail}`,
    '',
    `Confirmed: ${confirmedReadable}`,
    '',
    '---',
    '',
    'Confirmation',
    '',
    'You confirmed that the clients, venues, and partners listed below are part of your',
    'previous relationships from the last 12 months and should be kept on the official list.',
    'After confirmation, the review page locks. To request a change later, email',
    `${PREVIOUS_CLIENTS_PAGE.managementEmail}.`,
    '',
    '---',
    '',
    `Official list (${params.entryNames.length} ${params.entryNames.length === 1 ? 'entry' : 'entries'})`,
    '',
  ]
  if (params.entryNames.length === 0) {
    lines.push('(No entries.)', '')
  } else {
    for (let i = 0; i < params.entryNames.length; i += 1) {
      lines.push(`${String(i + 1).padStart(2, '0')}. ${params.entryNames[i]}`)
    }
    lines.push('')
  }
  lines.push('---', '', 'End of document')
  return lines.join('\n')
}

function triggerTextDownload(filename: string, text: string) {
  const blob = new Blob([`\uFEFF${text}`], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function parseDeadlineRpc(raw: unknown): {
  edit_window_ends_at: string | null
  confirmed_at: string | null
} | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const endsRaw = o.edit_window_ends_at
  const confRaw = o.confirmed_at
  return {
    edit_window_ends_at:
      endsRaw == null ? null : typeof endsRaw === 'string' ? endsRaw : String(endsRaw),
    confirmed_at: confRaw == null ? null : typeof confRaw === 'string' ? confRaw : String(confRaw),
  }
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '0:00:00'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function PublicListRowEditor({
  row,
  reload,
  flash,
}: {
  row: Row
  reload: () => Promise<void>
  flash: (msg: string) => void
}) {
  const [text, setText] = useState(row.name)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    setText(row.name)
  }, [row.id, row.name])

  const persistName = async () => {
    const t = text.trim()
    if (t === row.name) return
    if (!t) {
      setText(row.name)
      flash('Name cannot be empty.')
      return
    }
    const { error } = await supabase.from('artist_partnership_roll_entries').update({ name: t }).eq('id', row.id)
    if (error) {
      flash(error.message)
      setText(row.name)
      return
    }
    flash('Saved.')
    await reload()
  }

  const remove = async () => {
    setDeleting(true)
    const { error } = await supabase.from('artist_partnership_roll_entries').delete().eq('id', row.id)
    setDeleting(false)
    if (error) {
      flash(error.message)
      return
    }
    flash('Removed.')
    await reload()
  }

  return (
    <div className="group flex items-center gap-1 py-1.5">
      <Input
        className="h-8 flex-1 min-w-0 border-neutral-800 bg-neutral-950/80 text-[13px]"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => void persistName()}
        onKeyDown={e => {
          if (e.key === 'Enter') e.currentTarget.blur()
        }}
        aria-label={`Edit ${row.name}`}
      />
      <button
        type="button"
        aria-label="Remove from list"
        title="Remove"
        className="shrink-0 flex h-8 w-8 items-center justify-center rounded-md text-neutral-500 transition-opacity duration-150 hover:bg-white/[0.06] hover:text-red-400 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-neutral-500 disabled:pointer-events-none disabled:opacity-25 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
        disabled={deleting}
        onClick={() => void remove()}
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />}
      </button>
    </div>
  )
}

export default function PublicPreviousClientsPage() {
  const ownerId = getPartnershipRollOwnerId()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [editWindowEndsAt, setEditWindowEndsAt] = useState<string | null>(null)
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(() => Date.now())
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmStep, setConfirmStep] = useState<'review' | 'confirmed'>('review')
  /** Timestamp from DB right after confirm (avoids React state lag for the download file). */
  const [docConfirmedAt, setDocConfirmedAt] = useState<string | null>(null)
  const [confirmSubmitting, setConfirmSubmitting] = useState(false)
  const [bulkAddOpen, setBulkAddOpen] = useState(false)
  const [bulkNames, setBulkNames] = useState<string[]>([''])
  const [bulkSubmitting, setBulkSubmitting] = useState(false)

  const openBulkAdd = useCallback(() => {
    setBulkNames([''])
    setBulkAddOpen(true)
  }, [])

  const applyWindowRow = useCallback((editEnd: string | null, confirmed: string | null) => {
    setEditWindowEndsAt(editEnd)
    setConfirmedAt(confirmed)
  }, [])

  const loadWindow = useCallback(async () => {
    const { data, error: qErr } = await supabase
      .from('partnership_roll_public_owner')
      .select('edit_window_ends_at, confirmed_at')
      .eq('id', 1)
      .single()

    if (qErr) {
      return {
        error: qErr.message as string,
        edit_window_ends_at: null as string | null,
        confirmed_at: null as string | null,
      }
    }
    const editEnd = data?.edit_window_ends_at ?? null
    const confirmed = data?.confirmed_at ?? null
    applyWindowRow(editEnd, confirmed)
    return { error: null as string | null, edit_window_ends_at: editEnd, confirmed_at: confirmed }
  }, [applyWindowRow])

  const load = useCallback(async () => {
    if (!ownerId) {
      setRows([])
      setLoading(false)
      return
    }
    const { data, error: qErr } = await supabase
      .from('artist_partnership_roll_entries')
      .select('*')
      .eq('user_id', ownerId)
      .eq('cohort', 'recent')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })

    if (qErr) {
      setError(qErr.message)
      setLoading(false)
      return
    }
    setError(null)
    setRows((data ?? []) as Row[])
    setLoading(false)
  }, [ownerId])

  useEffect(() => {
    document.title = 'Previous Clients and Partnerships · The Office'
    return applySocialPreviewMeta(
      'Previous clients, venues, and brand relationships from the last 12 months.',
    )
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!ownerId) {
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data: rpcData, error: rpcErr } = await supabase.rpc('partnership_roll_ensure_deadline')
      if (rpcErr && !cancelled) setError(rpcErr.message)
      else if (!cancelled) {
        const parsed = parseDeadlineRpc(rpcData)
        if (parsed) applyWindowRow(parsed.edit_window_ends_at, parsed.confirmed_at)
      }

      const wErr = await loadWindow()
      if (wErr.error && !cancelled) setError(wErr.error)

      const { count, error: cErr } = await supabase
        .from('artist_partnership_roll_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', ownerId)

      if (!cancelled && !cErr && (count ?? 0) === 0) {
        const { error: seedErr } = await seedPartnershipRollIfEmpty(ownerId)
        if (seedErr && !cancelled) setError(seedErr)
      }
      if (cancelled) return
      await load()
    })()
    return () => {
      cancelled = true
    }
  }, [ownerId, load, loadWindow, applyWindowRow])

  useEffect(() => {
    if (!ownerId) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void loadWindow()
    }
    document.addEventListener('visibilitychange', onVis)
    const t = window.setInterval(() => void load(), 8000)
    const t2 = window.setInterval(() => void loadWindow(), 15000)
    const ch = supabase
      .channel(`public-partnership-roll-${ownerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'artist_partnership_roll_entries',
          filter: `user_id=eq.${ownerId}`,
        },
        () => void load(),
      )
      .subscribe()
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.clearInterval(t)
      window.clearInterval(t2)
      void supabase.removeChannel(ch)
    }
  }, [ownerId, load, loadWindow])

  const flash = (msg: string) => {
    setActionMsg(msg)
    window.setTimeout(() => setActionMsg(null), 3200)
  }

  const deadlineMs = editWindowEndsAt ? new Date(editWindowEndsAt).getTime() : null
  const remainingMs = deadlineMs != null ? deadlineMs - nowTick : Number.POSITIVE_INFINITY
  const isConfirmed = confirmedAt != null
  const windowOpen = !isConfirmed && (deadlineMs == null || remainingMs > 0)

  const insertRow = async (name: string, sortOrder: number) => {
    return supabase.from('artist_partnership_roll_entries').insert({
      user_id: ownerId!,
      name,
      cohort: 'recent',
      source: 'dj',
      sort_order: sortOrder,
    })
  }

  const handleAdd = async () => {
    if (!ownerId || !newName.trim() || !windowOpen) return
    const maxSort = rows.reduce((m, e) => Math.max(m, e.sort_order), -1) + 1
    const { error: e } = await insertRow(newName.trim(), maxSort)
    if (e) {
      flash(e.message)
      return
    }
    setNewName('')
    flash('Added.')
    await load()
  }

  const handleBulkAdd = async () => {
    if (!ownerId || !windowOpen) return
    const names = bulkNames.map(n => n.trim()).filter(Boolean)
    if (names.length === 0) {
      flash('Add at least one name.')
      return
    }
    setBulkSubmitting(true)
    let sortBase = rows.reduce((m, e) => Math.max(m, e.sort_order), -1)
    for (const name of names) {
      sortBase += 1
      const { error: e } = await insertRow(name, sortBase)
      if (e) {
        setBulkSubmitting(false)
        flash(e.message)
        return
      }
    }
    setBulkSubmitting(false)
    setBulkAddOpen(false)
    setBulkNames([''])
    flash(names.length === 1 ? 'Added.' : `Added ${names.length} entries.`)
    await load()
  }

  const handleConfirmList = async () => {
    setConfirmSubmitting(true)
    const { data, error: e } = await supabase.rpc('partnership_roll_confirm_list')
    setConfirmSubmitting(false)
    if (e) {
      flash(e.message)
      return
    }
    if (data !== true) {
      flash('This list couldn’t be confirmed — the update window may have ended. Email management@djluijay.live if you need help.')
      await loadWindow()
      setConfirmOpen(false)
      return
    }
    const win = await loadWindow()
    await load()
    if (!win.confirmed_at) {
      flash('This list was confirmed, but the confirmation time could not be loaded. Refresh the page to download a copy.')
      setConfirmOpen(false)
      return
    }
    setDocConfirmedAt(win.confirmed_at)
    setConfirmStep('confirmed')
    flash('Thank you — this list is now confirmed.')
  }

  const handleDownloadConfirmedDocument = async () => {
    const confirmedIso = docConfirmedAt ?? confirmedAt
    if (!confirmedIso) {
      flash('Confirmation time is not available yet. Try again in a moment.')
      return
    }
    const entryNames = rows.map(r => r.name.trim()).filter(n => n.length > 0)
    const body = buildConfirmedListDocument({ confirmedAtIso: confirmedIso, entryNames })
    const d = new Date(confirmedIso)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const slug = `${y}-${m}-${day}`
    triggerTextDownload(`dj-luijay-previous-clients-confirmed-${slug}.txt`, body)
    const { error: dlErr } = await supabase.rpc('partnership_roll_mark_document_downloaded')
    if (dlErr) {
      flash(dlErr.message)
    }
  }

  if (!ownerId) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-lg border border-neutral-800 bg-neutral-900/40 p-5 text-sm text-neutral-300 space-y-2">
          <p className="font-semibold text-white">Previous clients page isn’t configured</p>
          <p>
            Set <span className="font-mono text-xs">VITE_PARTNERSHIP_ROLL_OWNER_ID</span> to your dashboard account’s
            user UUID (Supabase → Authentication → Users), redeploy, and add the same UUID to{' '}
            <span className="font-mono text-xs">partnership_roll_public_owner</span> per migration{' '}
            <span className="font-mono text-xs">054_partnership_roll_public_anon_access.sql</span>.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="border-b border-neutral-800 px-4 py-3 sm:px-6">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <img
            src="/dj-luijay-logo.png"
            alt="DJ Luijay"
            className="h-8 w-auto max-w-[140px] object-contain object-left shrink-0"
          />
          <a
            href="mailto:management@djluijay.live"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors shrink-0"
          >
            management@djluijay.live
          </a>
        </div>
      </header>

      <main
        className={`max-w-2xl mx-auto px-4 py-8 sm:px-6 ${windowOpen ? 'pb-24' : ''}`}
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <h1 className="text-base font-semibold text-neutral-100 tracking-tight leading-snug flex-1 min-w-0">
            Previous Clients and Partnerships
          </h1>
          {windowOpen ? (
            <button
              type="button"
              className="shrink-0 rounded-md border border-white/[0.12] bg-neutral-900/90 p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition-colors"
              aria-label="Open add entries"
              onClick={openBulkAdd}
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
            </button>
          ) : null}
        </div>
        {windowOpen ? (
          <p className="text-[11px] text-neutral-500 leading-relaxed mb-6 max-w-xl">
            Review the names below: edit, remove, or add clients, venues, or partners until the list matches your{' '}
            <span className="font-medium text-neutral-300">last 12 months</span>, then confirm. After confirm, this page
            locks and this becomes the official list.
          </p>
        ) : (
          <div className="mb-6" />
        )}

        {!isConfirmed && deadlineMs != null && remainingMs <= 0 ? (
          <p className="text-xs text-neutral-500 mb-4 leading-relaxed">
            This update window has closed. If something still needs to change, email{' '}
            <a href="mailto:management@djluijay.live" className="text-neutral-400 underline underline-offset-2">
              management@djluijay.live
            </a>{' '}
            and we’ll take care of it.
          </p>
        ) : null}

        {error ? (
          <p className="text-xs text-red-400/90 mb-4">
            {error}
            {' — '}
            Apply migration <span className="font-mono">055</span> if you just added the confirm window.
          </p>
        ) : null}
        {actionMsg ? <p className="text-xs text-emerald-600/90 mb-3">{actionMsg}</p> : null}

        {loading && rows.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-neutral-500 py-8">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : null}

        <section className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Last 12 months</h2>
          <div className="rounded-lg border border-white/[0.08] bg-neutral-900/20 px-2 py-1 space-y-0.5">
            {rows.length === 0 && !loading ? (
              <p className="text-xs text-neutral-500 py-3 px-0.5">Nothing here yet — add below.</p>
            ) : (
              rows.map(row =>
                windowOpen ? (
                  <PublicListRowEditor key={row.id} row={row} reload={load} flash={flash} />
                ) : (
                  <div key={row.id} className="py-1.5 text-[13px] text-neutral-200 leading-snug">
                    {row.name}
                  </div>
                ),
              )
            )}
            {windowOpen ? (
              <div
                className={`flex items-center gap-2 py-2 ${rows.length > 0 ? 'mt-1 border-t border-white/[0.06] pt-2' : ''}`}
              >
                <Input
                  className="h-8 flex-1 min-w-0 border-neutral-800 bg-neutral-950/80 text-[13px]"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Add client, venue, or brand…"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newName.trim() && !loading && windowOpen) void handleAdd()
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3 text-[12px] border border-neutral-700 shrink-0"
                  disabled={!newName.trim() || loading}
                  onClick={() => void handleAdd()}
                >
                  Add
                </Button>
              </div>
            ) : null}
          </div>
        </section>

        {windowOpen ? (
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button
              type="button"
              size="default"
              variant="default"
              className="min-w-[200px] border-0 bg-emerald-600 text-white shadow-none hover:bg-emerald-500 focus-visible:ring-emerald-500/30 disabled:opacity-50"
              onClick={() => {
                setConfirmStep('review')
                setConfirmOpen(true)
              }}
            >
              Confirm
            </Button>
            <div className="inline-flex items-center gap-2 flex-wrap justify-center text-[11px]">
              {deadlineMs != null ? (
                <>
                  <span className="font-medium uppercase tracking-[0.12em] text-neutral-600">Time to review</span>
                  <span className="font-medium tabular-nums text-neutral-300">{formatRemaining(remainingMs)}</span>
                </>
              ) : (
                <span className="text-neutral-600">Starting timer…</span>
              )}
            </div>
          </div>
        ) : null}

        {isConfirmed ? (
          <div className="mt-6 flex flex-col items-center gap-4 max-w-md mx-auto text-center">
            <p className="text-xs text-neutral-500 leading-relaxed">
              This list is confirmed and locked on this page. To request an update later, reach out at{' '}
              <a
                href={`mailto:${PREVIOUS_CLIENTS_PAGE.managementEmail}`}
                className="text-neutral-400 underline underline-offset-2"
              >
                {PREVIOUS_CLIENTS_PAGE.managementEmail}
              </a>
              .
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-neutral-700 text-[12px] gap-2"
              onClick={() => void handleDownloadConfirmedDocument()}
            >
              <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Download official list (.txt)
            </Button>
          </div>
        ) : null}

        {windowOpen ? (
          <button
            type="button"
            className="fixed bottom-5 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-white/[0.12] bg-neutral-800 text-neutral-100 shadow-lg shadow-black/40 hover:bg-neutral-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500"
            aria-label="Add entries"
            onClick={openBulkAdd}
          >
            <Plus className="h-6 w-6" strokeWidth={2} />
          </button>
        ) : null}
      </main>

      <Dialog
        open={bulkAddOpen}
        onOpenChange={o => {
          setBulkAddOpen(o)
          if (!o) setBulkNames([''])
        }}
      >
        <DialogContent className="max-w-md p-5">
          <DialogHeader>
            <DialogTitle className="text-sm">Add to list</DialogTitle>
            <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
              Type a client, venue, or brand per line. You can add several before saving.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[min(50vh,280px)] overflow-y-auto pr-1">
            {bulkNames.map((val, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  className="h-9 border-neutral-800 bg-neutral-950/80 text-[13px]"
                  value={val}
                  placeholder={`Name ${i + 1}`}
                  onChange={e => {
                    const next = [...bulkNames]
                    next[i] = e.target.value
                    setBulkNames(next)
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !bulkSubmitting) {
                      e.preventDefault()
                      void handleBulkAdd()
                    }
                  }}
                />
                {bulkNames.length > 1 ? (
                  <button
                    type="button"
                    className="shrink-0 text-[11px] text-neutral-500 hover:text-red-400 px-1"
                    onClick={() => setBulkNames(bulkNames.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full border-neutral-700 px-3 text-[13px] font-normal"
            onClick={() => setBulkNames([...bulkNames, ''])}
          >
            Add another client.
          </Button>
          <DialogFooter className="mt-8 gap-2 sm:gap-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => setBulkAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={bulkSubmitting || !bulkNames.some(n => n.trim())}
              className="border-0 bg-emerald-600 text-white hover:bg-emerald-500"
              onClick={() => void handleBulkAdd()}
            >
              {bulkSubmitting ? 'Adding…' : 'Add to list'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmOpen}
        onOpenChange={o => {
          setConfirmOpen(o)
          if (!o) {
            setConfirmStep('review')
            setDocConfirmedAt(null)
          }
        }}
      >
        <DialogContent className="max-w-md p-5">
          {confirmStep === 'review' ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">Confirm this list?</DialogTitle>
                <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
                  You’re confirming that the clients, venues, and partners shown here are part of your previous
                  relationships from the <span className="text-neutral-300">last 12 months</span> and should be kept on
                  the official list. After you confirm, this page locks - if anything should be updated, email{' '}
                  <a href="mailto:management@djluijay.live" className="text-neutral-300 underline underline-offset-2">
                    management@djluijay.live
                  </a>
                  .
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>
                  Go back
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={confirmSubmitting}
                  className="border-0 bg-emerald-600 text-white shadow-none hover:bg-emerald-500 focus-visible:ring-emerald-500/30 disabled:opacity-50"
                  onClick={() => void handleConfirmList()}
                >
                  {confirmSubmitting ? 'Confirming…' : 'Confirm list'}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-sm">Your list is confirmed</DialogTitle>
                <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
                  Download a plain-text copy for your records. It includes the confirmation time, this acknowledgment,
                  and every name from your official list as shown on this page.
                </DialogDescription>
              </DialogHeader>
              <Button
                type="button"
                variant="outline"
                className="w-full border-neutral-700 text-[13px] gap-2 h-10"
                onClick={() => void handleDownloadConfirmedDocument()}
              >
                <Download className="h-4 w-4 shrink-0" aria-hidden />
                Download official list (.txt)
              </Button>
              <DialogFooter className="gap-2 sm:gap-0 mt-2">
                <Button type="button" variant="ghost" size="sm" className="w-full sm:w-auto" onClick={() => setConfirmOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
