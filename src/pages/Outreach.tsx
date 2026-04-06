import { useState, useMemo, useRef, useEffect } from 'react'
import { Plus, Search, SlidersHorizontal, Star } from 'lucide-react'
import { useVenues } from '@/hooks/useVenues'
import { useTaskTemplates } from '@/hooks/useTaskTemplates'
import { StatusBadge } from '@/components/outreach/StatusBadge'
import { VenueDialog } from '@/components/outreach/VenueDialog'
import { VenueDetailPanel } from '@/components/outreach/VenueDetailPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Venue, OutreachStatus, VenueType } from '@/types'
import { OUTREACH_STATUS_LABELS, OUTREACH_STATUS_ORDER } from '@/types'
import { cn } from '@/lib/utils'

const VENUE_TYPE_LABELS: Record<VenueType, string> = {
  bar: 'Bar',
  club: 'Club',
  festival: 'Festival',
  theater: 'Theater',
  lounge: 'Lounge',
  other: 'Other',
}

function fmtFollowUp(dateStr: string) {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(m)}/${parseInt(d)}/${y}`
}

export default function Outreach() {
  const { venues, loading, addVenue, updateVenue, deleteVenue } = useVenues()
  const { templates, applyTemplate } = useTaskTemplates()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<OutreachStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<VenueType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'priority' | 'name' | 'follow_up'>('updated')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)

  // Inline follow-up date editing
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null)
  const [editingFollowUpValue, setEditingFollowUpValue] = useState('')
  const followUpInputRef = useRef<HTMLInputElement>(null)

  // Toast state
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast(msg)
    toastTimer.current = setTimeout(() => setToast(null), 1500)
  }

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current) }, [])

  const handleStatusChange = async (venue: Venue, newStatus: OutreachStatus) => {
    await updateVenue(venue.id, { status: newStatus })
    const matching = templates.filter(t => t.trigger_status === newStatus)
    let totalTasks = 0
    let emailsQueued = 0
    for (const t of matching) {
      const { count, emailsQueued: q } = await applyTemplate(t.id, venue.id)
      totalTasks += count
      emailsQueued += q ?? 0
    }
    const parts: string[] = []
    if (totalTasks > 0) parts.push(`${totalTasks} task${totalTasks !== 1 ? 's' : ''} created`)
    if (emailsQueued > 0) parts.push(`${emailsQueued} email${emailsQueued !== 1 ? 's' : ''} queued`)
    showToast(
      parts.length > 0
        ? `${venue.name} → ${OUTREACH_STATUS_LABELS[newStatus]} · ${parts.join(' · ')}`
        : `${venue.name} - ${OUTREACH_STATUS_LABELS[newStatus]}`
    )
    // Keep detail panel in sync if open
    if (selectedVenue?.id === venue.id) {
      setSelectedVenue(v => v ? { ...v, status: newStatus } : v)
    }
  }

  const startEditFollowUp = (venue: Venue, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingFollowUpId(venue.id)
    setEditingFollowUpValue(venue.follow_up_date ?? '')
    setTimeout(() => followUpInputRef.current?.focus(), 0)
  }

  const saveFollowUp = async (venue: Venue) => {
    const val = editingFollowUpValue || null
    setEditingFollowUpId(null)
    if (val !== venue.follow_up_date) {
      await updateVenue(venue.id, { follow_up_date: val })
      showToast('Follow-up date updated')
      if (selectedVenue?.id === venue.id) {
        setSelectedVenue(v => v ? { ...v, follow_up_date: val } : v)
      }
    }
  }

  const filtered = useMemo(() => {
    let list = venues
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        (v.city?.toLowerCase().includes(q) ?? false) ||
        (v.location?.toLowerCase().includes(q) ?? false)
      )
    }
    if (filterStatus !== 'all') list = list.filter(v => v.status === filterStatus)
    if (filterType !== 'all') list = list.filter(v => v.venue_type === filterType)

    return [...list].sort((a, b) => {
      if (sortBy === 'priority') return b.priority - a.priority
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'follow_up') {
        if (!a.follow_up_date) return 1
        if (!b.follow_up_date) return -1
        return a.follow_up_date.localeCompare(b.follow_up_date)
      }
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [venues, search, filterStatus, filterType, sortBy])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-4">
      {/* Top-right toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-neutral-800 border border-neutral-700 text-neutral-100 text-sm px-4 py-2 rounded-lg shadow-lg animate-in fade-in slide-in-from-top-2 duration-150">
          {toast}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
          <Input
            placeholder="Search venues, cities…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as OutreachStatus | 'all')}>
            <SelectTrigger className="w-[145px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {OUTREACH_STATUS_ORDER.map(s => (
                <SelectItem key={s} value={s}>{OUTREACH_STATUS_LABELS[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={v => setFilterType(v as VenueType | 'all')}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {(Object.keys(VENUE_TYPE_LABELS) as VenueType[]).map(t => (
                <SelectItem key={t} value={t}>{VENUE_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={v => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="w-[120px]">
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5 opacity-50" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">Last updated</SelectItem>
              <SelectItem value="priority">Priority</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="follow_up">Follow-up date</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add venue
          </Button>
        </div>
      </div>

      <p className="text-xs text-neutral-500">
        {filtered.length} venue{filtered.length !== 1 ? 's' : ''}
        {filterStatus !== 'all' || filterType !== 'all' || search ? ' matching filters' : ''}
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-neutral-500 text-sm">
          {venues.length === 0 ? (
            <>
              <p className="font-medium text-neutral-400 mb-1">No venues yet</p>
              <p>Add your first venue to start tracking outreach.</p>
            </>
          ) : (
            <p>No venues match the current filters.</p>
          )}
        </div>
      ) : (
        <div className="rounded border border-neutral-800 overflow-hidden bg-neutral-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-950">
                <th className="text-left px-4 py-2.5 font-medium text-neutral-500 text-xs">Venue</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden sm:table-cell">Type</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs">Status</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden md:table-cell">Follow-up</th>
                <th className="text-left px-3 py-2.5 font-medium text-neutral-500 text-xs hidden lg:table-cell">Priority</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((venue, i) => {
                const overdue = venue.follow_up_date && venue.follow_up_date < today && venue.status !== 'booked' && venue.status !== 'rejected' && venue.status !== 'archived'
                const dueToday = venue.follow_up_date === today
                const isEditingFollowUp = editingFollowUpId === venue.id

                return (
                  <tr
                    key={venue.id}
                    onClick={() => setSelectedVenue(venue)}
                    className={cn(
                      'border-b border-neutral-800 last:border-0 cursor-pointer hover:bg-neutral-800 transition-colors',
                      i % 2 === 1 && 'bg-neutral-900/60'
                    )}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-neutral-100 leading-tight">{venue.name}</div>
                      {(venue.city || venue.location) && (
                        <div className="text-xs text-neutral-500 mt-0.5">
                          {[venue.city, venue.location].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <span className="text-xs text-neutral-500 capitalize">{VENUE_TYPE_LABELS[venue.venue_type]}</span>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge
                        status={venue.status}
                        onStatusChange={newStatus => handleStatusChange(venue, newStatus)}
                      />
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell" onClick={e => e.stopPropagation()}>
                      {isEditingFollowUp ? (
                        <input
                          ref={followUpInputRef}
                          type="date"
                          value={editingFollowUpValue}
                          onChange={e => setEditingFollowUpValue(e.target.value)}
                          onBlur={() => saveFollowUp(venue)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveFollowUp(venue)
                            if (e.key === 'Escape') setEditingFollowUpId(null)
                          }}
                          className="bg-neutral-800 border border-neutral-600 rounded px-2 py-0.5 text-xs text-neutral-100 focus:outline-none focus:border-neutral-400 w-[130px]"
                        />
                      ) : (
                        <button
                          onClick={e => startEditFollowUp(venue, e)}
                          className={cn(
                            'text-xs transition-colors hover:underline underline-offset-2',
                            overdue && 'text-red-500 font-medium',
                            dueToday && 'text-orange-400 font-medium',
                            !overdue && !dueToday && venue.follow_up_date && 'text-neutral-400',
                            !venue.follow_up_date && 'text-neutral-600'
                          )}
                          title="Click to edit follow-up date"
                        >
                          {venue.follow_up_date
                            ? `${overdue ? '⚠ ' : dueToday ? '→ ' : ''}${fmtFollowUp(venue.follow_up_date)}`
                            : 'Set date'}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              'h-3 w-3',
                              i < venue.priority ? 'fill-neutral-400 text-neutral-400' : 'text-neutral-700'
                            )}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <VenueDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSave={addVenue}
        templates={templates}
        onApplyTemplate={async (templateId, venueId) => {
          await applyTemplate(templateId, venueId)
        }}
      />

      {selectedVenue && (
        <VenueDetailPanel
          venue={selectedVenue}
          onClose={() => setSelectedVenue(null)}
          onUpdate={async (id, updates) => {
            const result = await updateVenue(id, updates)
            if (result.data) setSelectedVenue(result.data)
            return result
          }}
          onDelete={async (id) => {
            await deleteVenue(id)
            setSelectedVenue(null)
          }}
        />
      )}
    </div>
  )
}
