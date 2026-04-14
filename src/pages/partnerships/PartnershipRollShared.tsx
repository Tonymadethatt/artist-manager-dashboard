import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ListChecks, Loader2, Trash2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { usePartnershipRoll, type PartnershipRollEntry } from '@/hooks/usePartnershipRoll'
import { usePartnershipRollPublicStatus } from '@/hooks/usePartnershipRollPublicStatus'
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
import { cn } from '@/lib/utils'
import { applySocialPreviewMeta } from '@/lib/documentMeta'
import { PREVIOUS_CLIENTS_FORM_PATH, previousClientsFormUrl } from '@/lib/shareUrls'

export type PartnershipRollVariant = 'artist' | 'admin'

function sourceLabel(source: string): string {
  if (source === 'mock') return 'sample'
  if (source === 'system') return 'list'
  return source
}

const COPY: Record<
  PartnershipRollVariant,
  {
    pageTitle: string
    adminSubtitle?: string
    namePlaceholder: string
    lastHeading: string
    lastEmpty: string
    footnote?: string
    modalTitle: string
    modalBody: (name: string) => string
    modalCancel: string
    modalConfirm: string
    crossLink?: { to: string; label: string }
    copyLinkLabel: string
    copyLinkDone: string
  }
> = {
  artist: {
    pageTitle: 'Previous Clients and Partnerships',
    namePlaceholder: 'Add client, venue, or brand…',
    lastHeading: 'Last 12 months',
    lastEmpty: 'Nothing here yet — add below.',
    modalTitle: '',
    modalBody: () => '',
    modalCancel: '',
    modalConfirm: '',
    copyLinkLabel: '',
    copyLinkDone: '',
  },
  admin: {
    pageTitle: 'Previous Clients — Workspace',
    adminSubtitle:
      'Shared list with the artist. Copy the link below to send the client-facing page. Edits sync live.',
    namePlaceholder: 'Add name…',
    lastHeading: 'Last 12 months',
    lastEmpty: 'No rows yet.',
    footnote: 'Table: artist_partnership_roll_entries.',
    modalTitle: 'Confirm on behalf of list?',
    modalBody: name =>
      `Mark “${name}” as confirmed for the last-12-months list? Use when you’ve aligned offline.`,
    modalCancel: 'Cancel',
    modalConfirm: 'Confirm relationship',
    crossLink: { to: PREVIOUS_CLIENTS_FORM_PATH, label: 'Open client-facing page' },
    copyLinkLabel: 'Copy shareable link',
    copyLinkDone: 'Link copied',
  },
}

function PartnershipRowArtist({ row }: { row: PartnershipRollEntry }) {
  return (
    <div className="py-2 border-b border-white/[0.06] text-[13px] text-neutral-200 leading-snug last:border-b-0">
      {row.name}
    </div>
  )
}

function PartnershipRowAdmin(props: {
  row: PartnershipRollEntry
  onRename: (id: string, name: string) => void
  onConfirmClick: (row: PartnershipRollEntry) => void
  onUnconfirm: (id: string) => void
  onRemove: (id: string) => void
}) {
  const { row, onRename, onConfirmClick, onUnconfirm, onRemove } = props
  const [draft, setDraft] = useState(row.name)
  useEffect(() => {
    setDraft(row.name)
  }, [row.id, row.name])

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 border-b border-white/[0.06] text-[13px]',
        row.is_confirmed && 'opacity-90',
      )}
    >
      <Input
        className="h-8 flex-1 min-w-[160px] max-w-xl border-neutral-800 bg-neutral-950/80 text-[13px] px-2"
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== row.name) onRename(row.id, draft)
        }}
      />
      <span className="text-[10px] uppercase tracking-wide text-neutral-500 shrink-0 w-14 text-right">
        {sourceLabel(row.source)}
      </span>
      {row.is_confirmed ? (
        <span className="text-[11px] text-emerald-600/90 shrink-0 whitespace-nowrap">Confirmed</span>
      ) : null}
      <div className="flex items-center gap-1 shrink-0 ml-auto flex-wrap justify-end">
        {!row.is_confirmed ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-7 px-2 text-[11px] border-neutral-700"
            onClick={() => onConfirmClick(row)}
          >
            Confirm relationship
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[11px] text-neutral-500"
            onClick={() => onUnconfirm(row.id)}
          >
            Undo confirmation
          </Button>
        )}
        <button
          type="button"
          className="p-1 rounded text-neutral-500 hover:text-red-400 hover:bg-neutral-900"
          title="Remove from list"
          onClick={() => {
            if (window.confirm(`Remove “${row.name}” from this shared list?`)) onRemove(row.id)
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function formatStatusTs(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
}

export function PartnershipRollView({ variant }: { variant: PartnershipRollVariant }) {
  const { user } = useAuth()
  const roll = usePartnershipRoll(user?.id ?? null)
  const publicRoll = usePartnershipRollPublicStatus(variant === 'admin' ? user?.id ?? null : null)
  const c = COPY[variant]
  const [newName, setNewName] = useState('')
  const [confirmTarget, setConfirmTarget] = useState<PartnershipRollEntry | null>(null)
  const [actionMsg, setActionMsg] = useState<string | null>(null)

  const rows = useMemo(() => roll.entries, [roll.entries])

  useEffect(() => {
    const description =
      variant === 'artist'
        ? 'Previous clients, venues, and brand relationships from the last 12 months.'
        : 'Manage the shared previous-clients list for outreach and records.'
    return applySocialPreviewMeta(description)
  }, [variant])

  const flash = (msg: string) => {
    setActionMsg(msg)
    window.setTimeout(() => setActionMsg(null), 3200)
  }

  const handleAdd = async () => {
    const source = variant === 'artist' ? 'dj' : 'admin'
    const r = await roll.addEntry(newName, 'recent', source)
    if (r.error) flash(r.error)
    else {
      setNewName('')
      flash(variant === 'artist' ? 'Added.' : 'Saved.')
    }
  }

  const handleRename = async (id: string, name: string) => {
    const r = await roll.updateName(id, name)
    if (r.error) flash(r.error)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return
    const r = await roll.confirm(confirmTarget.id)
    setConfirmTarget(null)
    if (r.error) flash(r.error)
    else flash('Marked confirmed.')
  }

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(previousClientsFormUrl())
      flash(c.copyLinkDone)
    } catch {
      flash('Could not copy — copy the URL from the address bar.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="space-y-2">
        <h1 className="text-base font-semibold text-neutral-100 tracking-tight">{c.pageTitle}</h1>
        {variant === 'admin' ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-xs text-neutral-500 leading-snug max-w-xl">{c.adminSubtitle}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px] border-neutral-700 shrink-0"
              onClick={() => void copyShareLink()}
            >
              {c.copyLinkLabel}
            </Button>
            {c.crossLink ? (
              <Link
                to={c.crossLink.to}
                className="text-[11px] text-neutral-400 underline underline-offset-2 hover:text-neutral-200 shrink-0"
              >
                {c.crossLink.label}
              </Link>
            ) : null}
          </div>
        ) : null}
        {variant === 'admin' && publicRoll.enabled ? (
          <div className="rounded-md border border-white/[0.08] bg-neutral-900/30 px-3 py-2.5 space-y-1.5 max-w-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Public page (client link)</p>
            {publicRoll.error ? (
              <p className="text-[11px] text-red-400/90">{publicRoll.error}</p>
            ) : (
              <>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  <span className="text-neutral-500">List confirmation: </span>
                  {publicRoll.row?.confirmed_at ? (
                    <span className="text-neutral-200">Confirmed {formatStatusTs(publicRoll.row.confirmed_at)}</span>
                  ) : (
                    <span className="text-neutral-500">Not confirmed yet</span>
                  )}
                </p>
                <p className="text-[11px] text-neutral-400 leading-snug">
                  <span className="text-neutral-500">Confirmation .txt downloaded: </span>
                  {publicRoll.row?.confirmed_at ? (
                    publicRoll.row.confirmation_document_downloaded_at ? (
                      <span className="text-neutral-200">
                        Yes · {formatStatusTs(publicRoll.row.confirmation_document_downloaded_at)}
                      </span>
                    ) : (
                      <span className="text-amber-600/90">Not yet</span>
                    )
                  ) : (
                    <span className="text-neutral-600">—</span>
                  )}
                </p>
              </>
            )}
          </div>
        ) : null}
      </div>

      {roll.error ? (
        <p className="text-xs text-red-400/90">
          {roll.error}
          {' — '}
          Apply migration <span className="font-mono">051_artist_partnership_roll.sql</span> in Supabase, then refresh.
        </p>
      ) : null}
      {actionMsg ? <p className="text-xs text-emerald-600/90">{actionMsg}</p> : null}

      {roll.loading && roll.entries.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-neutral-500 py-6">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{c.lastHeading}</h2>
          <span className="text-[10px] text-neutral-600">
            {rows.length} row{rows.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="rounded-lg border border-white/[0.08] bg-neutral-900/20 px-2">
          {rows.length === 0 ? (
            <p className="text-xs text-neutral-500 py-3 px-0.5">{c.lastEmpty}</p>
          ) : variant === 'artist' ? (
            rows.map(row => <PartnershipRowArtist key={row.id} row={row} />)
          ) : (
            rows.map(row => (
              <PartnershipRowAdmin
                key={row.id}
                row={row}
                onRename={handleRename}
                onConfirmClick={setConfirmTarget}
                onUnconfirm={id => void roll.unconfirm(id)}
                onRemove={id => void roll.remove(id)}
              />
            ))
          )}
          <div className="flex items-center gap-2 py-2 border-t border-white/[0.06] mt-0.5">
            <Input
              className="h-8 flex-1 min-w-0 border-neutral-800 bg-neutral-950/80 text-[13px]"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={c.namePlaceholder}
              onKeyDown={e => {
                if (e.key === 'Enter' && newName.trim() && !roll.loading) void handleAdd()
              }}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-3 text-[12px] border border-neutral-700 shrink-0"
              disabled={!newName.trim() || roll.loading}
              onClick={() => void handleAdd()}
            >
              Add
            </Button>
          </div>
        </div>
      </section>

      {variant === 'admin' && c.footnote ? (
        <p className="text-[10px] text-neutral-600 leading-snug flex items-center gap-2">
          <ListChecks className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
          {c.footnote}
        </p>
      ) : null}

      {variant === 'admin' ? (
        <Dialog open={!!confirmTarget} onOpenChange={open => !open && setConfirmTarget(null)}>
          <DialogContent className="max-w-md p-5">
            <DialogHeader>
              <DialogTitle className="text-sm">{c.modalTitle}</DialogTitle>
              <DialogDescription className="text-xs text-neutral-400 leading-relaxed">
                {confirmTarget ? c.modalBody(confirmTarget.name) : null}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmTarget(null)}>
                {c.modalCancel}
              </Button>
              <Button type="button" size="sm" onClick={() => void handleConfirm()}>
                {c.modalConfirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  )
}
