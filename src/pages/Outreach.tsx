import { useState, useMemo } from 'react'
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

export default function Outreach() {
  const { venues, loading, addVenue, updateVenue, deleteVenue } = useVenues()
  const { templates, applyTemplate } = useTaskTemplates()
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<OutreachStatus | 'all'>('all')
  const [filterType, setFilterType] = useState<VenueType | 'all'>('all')
  const [sortBy, setSortBy] = useState<'updated' | 'priority' | 'name' | 'follow_up'>('updated')
  const [addOpen, setAddOpen] = useState(false)
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)

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
                      <StatusBadge status={venue.status} />
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      {venue.follow_up_date ? (
                        <span className={cn(
                          'text-xs',
                          overdue && 'text-red-500 font-medium',
                          dueToday && 'text-orange-400 font-medium',
                          !overdue && !dueToday && 'text-neutral-500'
                        )}>
                          {overdue ? '⚠ ' : dueToday ? '→ ' : ''}{venue.follow_up_date}
                        </span>
                      ) : (
                        <span className="text-neutral-600 text-xs">—</span>
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
