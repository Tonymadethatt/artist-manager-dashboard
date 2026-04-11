import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Plus,
  Trash2,
  Loader2,
  Search,
  ChevronLeft,
  Check,
  Circle,
} from 'lucide-react'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useBookingIntakes } from '@/hooks/useBookingIntakes'
import { usePricingCatalog } from '@/hooks/usePricingCatalog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  CALL_INTAKE_SECTIONS,
  personalizeScriptText,
  type ScriptBlock,
} from '@/lib/intake/callIntakeDefinition'
import {
  parseVenueBundle,
  parseShowBundle,
  type VenueIntakeBundle,
  type ShowIntakeBundle,
  type IntakeContactDraft,
} from '@/lib/intake/intakePayload'
import {
  catalogHasMinimumForDealLogging,
  computeDealPrice,
  pickDefaultServiceId,
} from '@/lib/pricing/computeDealPrice'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CommissionTier, OutreachStatus, OutreachTrack, VenueType } from '@/types'
import {
  OUTREACH_STATUS_LABELS,
  OUTREACH_STATUS_ORDER,
  OUTREACH_TRACK_LABELS,
  OUTREACH_TRACK_ORDER,
  COMMISSION_TIER_LABELS,
} from '@/types'
import { SHOW_REPORT_PRESETS } from '@/lib/showReportCatalog'

const VENUE_TYPES: VenueType[] = ['bar', 'club', 'festival', 'theater', 'lounge', 'other']

function fmtUpdated(iso: string) {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  } catch {
    return iso
  }
}

function QuestionRow({
  text,
  checked,
  onToggle,
  children,
}: {
  text: string
  checked: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-white/[0.08] bg-neutral-950/50 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full text-left flex gap-3 px-3 py-2.5 transition-colors',
          checked ? 'opacity-60' : 'hover:bg-neutral-900/80',
        )}
      >
        <span
          className={cn(
            'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
            checked
              ? 'border-emerald-600/80 bg-emerald-600/20 text-emerald-400'
              : 'border-neutral-600 text-neutral-600',
          )}
        >
          {checked ? <Check className="w-3.5 h-3.5" strokeWidth={2.5} /> : <Circle className="w-3 h-3 opacity-40" />}
        </span>
        <span
          className={cn(
            'text-sm leading-relaxed flex-1 min-w-0',
            checked ? 'text-neutral-500 line-through decoration-neutral-600' : 'text-neutral-100',
          )}
        >
          {text}
        </span>
      </button>
      {children && <div className="px-3 pb-3 pt-0 border-t border-white/[0.05] space-y-2">{children}</div>}
    </div>
  )
}

export default function IntakeForms() {
  const { profile } = useArtistProfile()
  const artistName = profile?.artist_name ?? ''
  const managerLine =
    [profile?.manager_name?.trim(), profile?.manager_title?.trim()].filter(Boolean).join(', ') ||
    profile?.manager_name ||
    ''

  const pricingCatalog = usePricingCatalog()
  const {
    intakes,
    showsByIntake,
    loading,
    error,
    refetch,
    createIntake,
    deleteIntake,
    updateVenueBundle,
    updateTitle,
    updateShowBundle,
    updateShowLabel,
    addShowDraft,
  } = useBookingIntakes()

  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeShowId, setActiveShowId] = useState<string | null>(null)
  const [mobileList, setMobileList] = useState(true)

  useEffect(() => {
    if (!loading && intakes.length > 0 && !selectedId) {
      setSelectedId(intakes[0].id)
    }
  }, [loading, intakes, selectedId])

  const selected = intakes.find(i => i.id === selectedId)
  const shows = selectedId ? showsByIntake[selectedId] ?? [] : []
  const activeShow = shows.find(s => s.id === activeShowId)

  useEffect(() => {
    if (shows.length && !activeShowId) setActiveShowId(shows[0].id)
    if (shows.length && activeShowId && !shows.some(s => s.id === activeShowId)) {
      setActiveShowId(shows[0].id)
    }
  }, [shows, activeShowId])

  const venueBundle = useMemo(
    () => (selected ? parseVenueBundle(selected.venue_data) : null),
    [selected],
  )
  const showBundle = useMemo(
    () => (activeShow ? parseShowBundle(activeShow.show_data) : null),
    [activeShow],
  )

  const setVenue = useCallback(
    (next: VenueIntakeBundle) => {
      if (!selectedId) return
      updateVenueBundle(selectedId, next)
    },
    [selectedId, updateVenueBundle],
  )

  const setShow = useCallback(
    (next: ShowIntakeBundle) => {
      if (!selectedId || !activeShowId) return
      updateShowBundle(activeShowId, selectedId, next)
    },
    [selectedId, activeShowId, updateShowBundle],
  )

  const previewGross = useMemo(() => {
    if (!showBundle || !catalogHasMinimumForDealLogging(pricingCatalog.doc)) return null
    const f = showBundle.fields
    const p = f.pricing
    try {
      return computeDealPrice({
        catalog: pricingCatalog.doc,
        eventDate: f.event_date.trim() || null,
        baseMode: p.baseMode,
        packageId: p.packageId,
        serviceId: p.serviceId,
        overtimeServiceId: p.overtimeServiceId,
        performanceHours: p.performanceHours,
        addonQuantities: p.addonQuantities,
        surchargeIds: p.surchargeIds,
        discountIds: p.discountIds,
      }).gross
    } catch {
      return null
    }
  }, [showBundle, pricingCatalog.doc])

  const filteredIntakes = useMemo(() => {
    if (!search.trim()) return intakes
    const q = search.toLowerCase()
    return intakes.filter(i => i.title.toLowerCase().includes(q))
  }, [intakes, search])

  const personalize = useCallback(
    (text: string) =>
      personalizeScriptText(text, {
        artistName,
        managerName: managerLine,
        clientName: venueBundle?.fields.call_contact_name ?? '',
      }),
    [artistName, managerLine, venueBundle?.fields.call_contact_name],
  )

  const renderBlock = (block: ScriptBlock, i: number) => {
    if (!venueBundle || !showBundle) return null
    const vb = venueBundle
    const sb = showBundle

    if (block.type === 'heading') {
      return (
        <h3 key={i} className="text-sm font-semibold text-white pt-2">
          {personalize(block.text)}
        </h3>
      )
    }
    if (block.type === 'subheading') {
      return (
        <p key={i} className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 pt-2">
          {personalize(block.text)}
        </p>
      )
    }
    if (block.type === 'paragraph') {
      return (
        <p key={i} className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap">
          {personalize(block.text)}
        </p>
      )
    }
    if (block.type === 'coach') {
      return (
        <p key={i} className="text-xs text-neutral-500 leading-relaxed italic border-l-2 border-amber-500/40 pl-3">
          {personalize(block.text)}
        </p>
      )
    }

    const id = block.id
    const checked = !!vb.checklist[id]
    const toggle = () =>
      setVenue({
        ...vb,
        checklist: { ...vb.checklist, [id]: !checked },
      })

    const line = personalize(block.text)

    const freeVal = vb.freeText[id] ?? ''
    const setFree = (v: string) =>
      setVenue({ ...vb, freeText: { ...vb.freeText, [id]: v } })

    if (id === 'q-date') {
      return (
        <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
          <Label className="text-[11px] text-neutral-500">Event date</Label>
          <Input
            type="date"
            value={sb.fields.event_date}
            onChange={e => setShow({ ...sb, fields: { ...sb.fields, event_date: e.target.value } })}
            className="bg-neutral-950 border-neutral-700"
          />
        </QuestionRow>
      )
    }
    if (id === 'q-city-venue') {
      return (
        <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label className="text-[11px] text-neutral-500">Venue name</Label>
              <Input
                value={vb.fields.name}
                onChange={e =>
                  setVenue({ ...vb, fields: { ...vb.fields, name: e.target.value } })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div>
              <Label className="text-[11px] text-neutral-500">City</Label>
              <Input
                value={vb.fields.city}
                onChange={e =>
                  setVenue({ ...vb, fields: { ...vb.fields, city: e.target.value } })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-[11px] text-neutral-500">Street address</Label>
              <Input
                value={vb.fields.location}
                onChange={e =>
                  setVenue({ ...vb, fields: { ...vb.fields, location: e.target.value } })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
          </div>
        </QuestionRow>
      )
    }
    if (id === 'q-times') {
      return (
        <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[11px] text-neutral-500">Event start</Label>
              <Input
                type="time"
                value={sb.fields.event_start_time}
                onChange={e =>
                  setShow({ ...sb, fields: { ...sb.fields, event_start_time: e.target.value } })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div>
              <Label className="text-[11px] text-neutral-500">Event end</Label>
              <Input
                type="time"
                value={sb.fields.event_end_time}
                onChange={e =>
                  setShow({ ...sb, fields: { ...sb.fields, event_end_time: e.target.value } })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div>
              <Label className="text-[11px] text-neutral-500">Performance start</Label>
              <Input
                type="time"
                value={sb.fields.performance_start_time}
                onChange={e =>
                  setShow({
                    ...sb,
                    fields: { ...sb.fields, performance_start_time: e.target.value },
                  })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
            <div>
              <Label className="text-[11px] text-neutral-500">Performance end</Label>
              <Input
                type="time"
                value={sb.fields.performance_end_time}
                onChange={e =>
                  setShow({
                    ...sb,
                    fields: { ...sb.fields, performance_end_time: e.target.value },
                  })
                }
                className="bg-neutral-950 border-neutral-700"
              />
            </div>
          </div>
        </QuestionRow>
      )
    }
    if (id === 'q-guests') {
      return (
        <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
          <Label className="text-[11px] text-neutral-500">Capacity / guest count</Label>
          <Input
            value={vb.fields.capacity ?? ''}
            onChange={e =>
              setVenue({
                ...vb,
                fields: { ...vb.fields, capacity: e.target.value.trim() ? e.target.value : null },
              })
            }
            className="bg-neutral-950 border-neutral-700"
          />
        </QuestionRow>
      )
    }
    if (id === 'q-contact-info') {
      return (
        <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
          <Label className="text-[11px] text-neutral-500">Client first name (script)</Label>
          <Input
            value={vb.fields.call_contact_name}
            onChange={e =>
              setVenue({ ...vb, fields: { ...vb.fields, call_contact_name: e.target.value } })
            }
            placeholder="First name"
            className="bg-neutral-950 border-neutral-700"
          />
          <p className="text-[10px] text-neutral-600">Add full contacts in the panel below.</p>
        </QuestionRow>
      )
    }

    return (
      <QuestionRow key={id} text={line} checked={checked} onToggle={toggle}>
        <Label className="text-[11px] text-neutral-500">Notes</Label>
        <textarea
          value={freeVal}
          onChange={e => setFree(e.target.value)}
          rows={2}
          className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm text-neutral-100"
        />
      </QuestionRow>
    )
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 flex-1 max-w-[1600px] mx-auto md:min-h-[calc(100dvh-7.5rem)]">
      {error && (
        <div className="text-sm text-red-400 border border-red-900/50 bg-red-950/30 rounded-lg px-3 py-2">
          {error}
          <button type="button" className="ml-2 underline text-red-300" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col md:flex-row overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900">
        {/* List */}
        <aside
          className={cn(
            'shrink-0 border-neutral-800 bg-neutral-950/90 flex flex-col min-h-0',
            'w-full md:w-64 md:border-r border-b md:border-b-0',
            mobileList ? 'flex' : 'hidden md:flex',
 )}
        >
          <div className="p-2 border-b border-neutral-800 space-y-2">
            <div className="flex items-center gap-2 md:hidden">
              {selectedId && (
                <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => setMobileList(false)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search intakes…"
                className="pl-7 h-8 text-xs bg-neutral-900 border-neutral-700"
              />
            </div>
            <Button
              size="sm"
              className="w-full h-8 text-xs"
              onClick={async () => {
                const row = await createIntake()
                if (row) {
                  setSelectedId(row.id)
                  setMobileList(false)
                }
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New intake
            </Button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-0.5">
            {loading ? (
              <div className="flex justify-center py-8 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : filteredIntakes.length === 0 ? (
              <p className="text-xs text-neutral-500 px-2 py-4 text-center">No intakes yet.</p>
            ) : (
              filteredIntakes.map(intake => {
                const on = intake.id === selectedId
                return (
                  <button
                    key={intake.id}
                    type="button"
                    onClick={() => {
                      setSelectedId(intake.id)
                      setMobileList(false)
                    }}
                    className={cn(
                      'w-full text-left rounded-lg px-2.5 py-2 text-xs transition-colors',
                      on ? 'bg-neutral-800 text-white' : 'text-neutral-400 hover:bg-neutral-900',
                    )}
                  >
                    <span className="font-medium line-clamp-1">{intake.title || 'Untitled'}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">
                      {fmtUpdated(intake.updated_at)}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </aside>

        {/* Editor */}
        <div
          className={cn(
            'flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden',
            mobileList ? 'hidden md:flex' : 'flex',
          )}
        >
          {!selected || !venueBundle || !showBundle || !activeShow ? (
            <div className="flex-1 flex items-center justify-center text-sm text-neutral-500 p-6">
              Select or create an intake.
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-neutral-800 px-3 py-2 flex flex-wrap items-center gap-2">
                <Button variant="ghost" size="sm" className="md:hidden px-2" onClick={() => setMobileList(true)}>
                  <ChevronLeft className="h-4 w-4" />
                  List
                </Button>
                <Input
                  value={selected.title}
                  onChange={e => updateTitle(selected.id, e.target.value)}
                  className="flex-1 min-w-[120px] max-w-md h-8 text-sm bg-neutral-950 border-neutral-700"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-400 border-red-900/50 hover:bg-red-950/40"
                  onClick={() => {
                    if (window.confirm('Delete this intake and all show drafts?')) {
                      void deleteIntake(selected.id)
                      setSelectedId(null)
                      setMobileList(true)
                    }
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-3 py-4 space-y-6">
                  {/* Show switcher */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-500">
                      Show drafts
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {shows.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setActiveShowId(s.id)}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs border transition-colors',
                            s.id === activeShowId
                              ? 'bg-neutral-100 text-neutral-900 border-white'
                              : 'border-neutral-700 text-neutral-400 hover:border-neutral-500',
                          )}
                        >
                          {s.label || 'Show'}
                        </button>
                      ))}
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={async () => {
                          const row = await addShowDraft(selected.id)
                          if (row) setActiveShowId(row.id)
                        }}
                      >
                        <Plus className="h-3 w-3 mr-0.5" />
                        Add
                      </Button>
                    </div>
                    {activeShow && (
                      <Input
                        value={activeShow.label}
                        onChange={e => void updateShowLabel(activeShow.id, selected.id, e.target.value)}
                        className="h-7 text-xs w-36 bg-neutral-950 border-neutral-700"
                        placeholder="Label"
                      />
                    )}
                  </div>

                  {/* Venue quick fields */}
                  <section className="rounded-xl border border-white/[0.07] bg-neutral-900/40 p-4 space-y-3">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                      Venue (import to Outreach)
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <Label className="text-[11px] text-neutral-500">Track</Label>
                        <Select
                          value={venueBundle.fields.outreach_track}
                          onValueChange={v =>
                            setVenue({
                              ...venueBundle,
                              fields: { ...venueBundle.fields, outreach_track: v as OutreachTrack },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTREACH_TRACK_ORDER.map(t => (
                              <SelectItem key={t} value={t}>
                                {OUTREACH_TRACK_LABELS[t]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Follow-up date</Label>
                        <Input
                          type="date"
                          value={venueBundle.fields.follow_up_date ?? ''}
                          onChange={e =>
                            setVenue({
                              ...venueBundle,
                              fields: {
                                ...venueBundle.fields,
                                follow_up_date: e.target.value || null,
                              },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Priority (1–5)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={5}
                          value={venueBundle.fields.priority}
                          onChange={e =>
                            setVenue({
                              ...venueBundle,
                              fields: {
                                ...venueBundle.fields,
                                priority: Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 3)),
                              },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Status</Label>
                        <Select
                          value={venueBundle.fields.status}
                          onValueChange={v =>
                            setVenue({
                              ...venueBundle,
                              fields: { ...venueBundle.fields, status: v as OutreachStatus },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {OUTREACH_STATUS_ORDER.map(s => (
                              <SelectItem key={s} value={s}>
                                {OUTREACH_STATUS_LABELS[s]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Venue type</Label>
                        <Select
                          value={venueBundle.fields.venue_type}
                          onValueChange={v =>
                            setVenue({
                              ...venueBundle,
                              fields: { ...venueBundle.fields, venue_type: v as VenueType },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {VENUE_TYPES.map(t => (
                              <SelectItem key={t} value={t} className="capitalize">
                                {t}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div>
                      <Label className="text-[11px] text-neutral-500 mb-1 block">Contacts</Label>
                      <div className="space-y-2">
                        {venueBundle.contacts.map((c, idx) => (
                          <div
                            key={idx}
                            className="grid gap-1.5 sm:grid-cols-2 border border-neutral-800 rounded-lg p-2 bg-neutral-950/50"
                          >
                            <Input
                              placeholder="Name *"
                              value={c.name}
                              onChange={e => {
                                const next = [...venueBundle.contacts]
                                next[idx] = { ...c, name: e.target.value }
                                setVenue({ ...venueBundle, contacts: next })
                              }}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Role"
                              value={c.role}
                              onChange={e => {
                                const next = [...venueBundle.contacts]
                                next[idx] = { ...c, role: e.target.value }
                                setVenue({ ...venueBundle, contacts: next })
                              }}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Email"
                              value={c.email}
                              onChange={e => {
                                const next = [...venueBundle.contacts]
                                next[idx] = { ...c, email: e.target.value }
                                setVenue({ ...venueBundle, contacts: next })
                              }}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Phone"
                              value={c.phone}
                              onChange={e => {
                                const next = [...venueBundle.contacts]
                                next[idx] = { ...c, phone: e.target.value }
                                setVenue({ ...venueBundle, contacts: next })
                              }}
                              className="h-7 text-xs"
                            />
                            <Input
                              placeholder="Company"
                              value={c.company}
                              onChange={e => {
                                const next = [...venueBundle.contacts]
                                next[idx] = { ...c, company: e.target.value }
                                setVenue({ ...venueBundle, contacts: next })
                              }}
                              className="h-7 text-xs sm:col-span-2"
                            />
                            <div className="sm:col-span-2 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs text-red-400"
                                onClick={() => {
                                  const next = venueBundle.contacts.filter((_, j) => j !== idx)
                                  setVenue({ ...venueBundle, contacts: next })
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const next: IntakeContactDraft[] = [
                              ...venueBundle.contacts,
                              { name: '', role: '', email: '', phone: '', company: '' },
                            ]
                            setVenue({ ...venueBundle, contacts: next })
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add contact
                        </Button>
                      </div>
                    </div>
                  </section>

                  {/* Deal / show fields */}
                  <section className="rounded-xl border border-white/[0.07] bg-neutral-900/40 p-4 space-y-3">
                    <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">
                      Show / deal (import to Earnings)
                    </h2>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <Label className="text-[11px] text-neutral-500">Deal title / description</Label>
                        <Input
                          value={showBundle.fields.description}
                          onChange={e =>
                            setShow({
                              ...showBundle,
                              fields: { ...showBundle.fields, description: e.target.value },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Genre</Label>
                        <Input
                          value={showBundle.fields.performance_genre}
                          onChange={e =>
                            setShow({
                              ...showBundle,
                              fields: { ...showBundle.fields, performance_genre: e.target.value },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Payment due date</Label>
                        <Input
                          type="date"
                          value={showBundle.fields.payment_due_date}
                          onChange={e =>
                            setShow({
                              ...showBundle,
                              fields: { ...showBundle.fields, payment_due_date: e.target.value },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Commission tier</Label>
                        <Select
                          value={showBundle.fields.commission_tier}
                          onValueChange={v =>
                            setShow({
                              ...showBundle,
                              fields: { ...showBundle.fields, commission_tier: v as CommissionTier },
                            })
                          }
                        >
                          <SelectTrigger className="h-8 text-xs bg-neutral-950 border-neutral-700">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(['new_doors', 'kept_doors', 'bigger_doors', 'artist_network'] as const).map(
                              t => (
                                <SelectItem key={t} value={t}>
                                  {COMMISSION_TIER_LABELS[t]}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-neutral-500">Venue capacity (deal form)</Label>
                        <Input
                          value={showBundle.fields.venue_capacity}
                          onChange={e =>
                            setShow({
                              ...showBundle,
                              fields: { ...showBundle.fields, venue_capacity: e.target.value },
                            })
                          }
                          className="h-8 text-xs bg-neutral-950 border-neutral-700"
                        />
                      </div>
 </div>

                    <div className="border border-neutral-800 rounded-lg p-3 space-y-2 bg-neutral-950/40">
                      <p className="text-[11px] font-medium text-neutral-400">Pricing calculator</p>
                      {pricingCatalog.loading ? (
                        <p className="text-xs text-neutral-500">Loading catalog…</p>
                      ) : !catalogHasMinimumForDealLogging(pricingCatalog.doc) ? (
                        <p className="text-xs text-amber-200/90">
                          Add packages or hourly rates under Earnings → Pricing & fees to use the calculator here.
                        </p>
                      ) : (
                        <>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <div>
                              <Label className="text-[11px] text-neutral-500">Base</Label>
                              <Select
                                value={showBundle.fields.pricing.baseMode}
                                onValueChange={v =>
                                  setShow({
                                    ...showBundle,
                                    fields: {
                                      ...showBundle.fields,
                                      pricing: {
                                        ...showBundle.fields.pricing,
                                        baseMode: v as 'package' | 'hourly',
                                      },
                                    },
                                  })
                                }
                              >
                                <SelectTrigger className="h-8 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="hourly">Hourly</SelectItem>
                                  <SelectItem value="package">Package</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label className="text-[11px] text-neutral-500">Performance hours</Label>
                              <Input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={showBundle.fields.pricing.performanceHours}
                                onChange={e =>
                                  setShow({
                                    ...showBundle,
                                    fields: {
                                      ...showBundle.fields,
                                      pricing: {
                                        ...showBundle.fields.pricing,
                                        performanceHours: parseFloat(e.target.value) || 0,
                                      },
                                    },
                                  })
                                }
                                className="h-8 text-xs"
                              />
                            </div>
                            {showBundle.fields.pricing.baseMode === 'package' ? (
                              <div className="sm:col-span-2">
                                <Label className="text-[11px] text-neutral-500">Package</Label>
                                <Select
                                  value={showBundle.fields.pricing.packageId ?? '__none__'}
                                  onValueChange={v =>
                                    setShow({
                                      ...showBundle,
                                      fields: {
                                        ...showBundle.fields,
                                        pricing: {
                                          ...showBundle.fields.pricing,
                                          packageId: v === '__none__' ? null : v,
                                        },
                                      },
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {pricingCatalog.doc.packages.map(p => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            ) : (
                              <div className="sm:col-span-2">
                                <Label className="text-[11px] text-neutral-500">Hourly service</Label>
                                <Select
                                  value={showBundle.fields.pricing.serviceId ?? '__none__'}
                                  onValueChange={v => {
                                    const id = v === '__none__' ? null : v
                                    setShow({
                                      ...showBundle,
                                      fields: {
                                        ...showBundle.fields,
                                        pricing: {
                                          ...showBundle.fields.pricing,
                                          serviceId: id,
                                          overtimeServiceId: id,
                                        },
                                      },
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">—</SelectItem>
                                    {pricingCatalog.doc.services.map(s => (
                                      <SelectItem key={s.id} value={s.id}>
                                        {s.name} (${s.price}/hr)
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-neutral-500">Computed gross:</span>
                            <span className="font-mono tabular-nums text-neutral-200">
                              {previewGross != null ? `$${previewGross.toLocaleString()}` : '—'}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                const pick = pickDefaultServiceId(
                                  pricingCatalog.doc,
                                  showBundle.fields.event_date.trim() || null,
                                )
                                setShow({
                                  ...showBundle,
                                  fields: {
                                    ...showBundle.fields,
                                    gross_amount:
                                      previewGross != null ? String(previewGross) : showBundle.fields.gross_amount,
                                    pricing: {
                                      ...showBundle.fields.pricing,
                                      serviceId: pick ?? showBundle.fields.pricing.serviceId,
                                      overtimeServiceId: pick ?? showBundle.fields.pricing.overtimeServiceId,
                                    },
                                  },
                                })
                              }}
                            >
                              Sync gross from calculator
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-medium text-neutral-400 mb-2">Recap presets</p>
                      <div className="flex flex-wrap gap-2">
                        {SHOW_REPORT_PRESETS.map(p => (
                          <label
                            key={p.id}
                            className="flex items-center gap-1.5 text-[11px] text-neutral-300 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={showBundle.fields.promisePresets[p.id] ?? false}
                              onChange={e =>
                                setShow({
                                  ...showBundle,
                                  fields: {
                                    ...showBundle.fields,
                                    promisePresets: {
                                      ...showBundle.fields.promisePresets,
                                      [p.id]: e.target.checked,
                                    },
                                  },
                                })
                              }
                              className="rounded border-neutral-600"
                            />
                            {p.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  </section>

                  {/* Script */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
                      Call script
                    </p>
                    <p className="text-xs text-neutral-500 border-l-2 border-white/10 pl-3">
                      Checklist and notes auto-save. Artist: {artistName || '—'} · Manager: {managerLine || '—'}
                    </p>
                  </div>

                  <div className="space-y-8 pb-12">
                    {CALL_INTAKE_SECTIONS.map(section => (
                      <section
                        key={section.title}
                        className="rounded-xl border border-white/[0.07] bg-neutral-900/40 overflow-hidden"
                      >
                        <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 px-4 py-2.5 border-b border-white/[0.06] bg-neutral-900/60">
                          {section.title}
                        </h2>
                        <div className="p-4 space-y-3">
                          {section.blocks.map((block, i) => renderBlock(block, i))}
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
