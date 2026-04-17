import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ChevronDown, Loader2, PhoneForwarded, Save } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useColdCalls } from '@/hooks/useColdCalls'
import { useVenues } from '@/hooks/useVenues'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useBookingIntakes } from '@/hooks/useBookingIntakes'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import {
  advanceFromLiveCard,
  applyAskResponseTemperatureHint,
} from '@/lib/coldCall/coldCallLiveRouting'
import { buildIntakeBundleFromColdCall } from '@/lib/coldCall/mapColdCallToBookingIntake'
import {
  COLD_CALL_HOW_FOUND_LABELS,
  COLD_CALL_NEXT_ACTION_LABELS,
  COLD_CALL_OUTCOME_LABELS,
  COLD_CALL_REJECTION_LABELS,
  COLD_CALL_TARGET_ROLE_LABELS,
  COLD_CALL_TEMPERATURE_META,
  COLD_CALL_WEEKDAY_LABELS,
  defaultColdCallTitle,
  genreMatchHint,
  type ColdCallDataV1,
  type ColdCallLiveCardId,
  type ColdCallNextActionKey,
  type ColdCallTemperature,
} from '@/lib/coldCall/coldCallPayload'
import { MUSIC_VIBE_PRESETS, US_STATE_OPTIONS } from '@/lib/intake/intakePayloadV3'
import type { Contact, Venue, VenueType } from '@/types'
import { VENUE_TYPE_LABELS } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  IntakeCompactChipRow,
  IntakeCompactDual,
  IntakeLiveScriptCaptureStack,
} from '@/pages/booking-intake/intakeLivePrimitives'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { liveCardStepTitle, scriptForCard } from '@/pages/cold-call/liveCardCopy'
import {
  ASK_RESPONSE_OPTIONS,
  BEST_TIME_OPTIONS,
  BOOKING_PROCESS_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  CALL_PURPOSE_TOGGLE,
  CAPACITY_OPTIONS,
  CONFIRMED_NAME_OPTIONS,
  DECISION_SAME_OPTIONS,
  DURATION_OPTIONS,
  ENDED_OPTIONS,
  GATEKEEPER_RESULT_OPTIONS,
  INITIAL_REACTION_OPTIONS,
  PARKING_OPTIONS,
  PIVOT_OPTIONS,
  RATE_REACTION_OPTIONS,
  SEND_TO_OPTIONS,
  VENUE_TYPE_CONFIRM_OPTIONS,
  WHO_ANSWERED_OPTIONS,
} from '@/pages/cold-call/liveFieldOptions'
import type { OutreachStatus } from '@/types'

const LIVE_WAYPOINTS = [
  { id: 'opener', label: 'Opener' },
  { id: 'gate', label: 'Gatekeeper' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'qual', label: 'Qualify' },
  { id: 'ask', label: 'Ask' },
  { id: 'close', label: 'Close' },
] as const

function waypointIndex(card: ColdCallLiveCardId): number {
  if (card === 'p1') return 0
  if (card === 'p2a' || card === 'p2a_detail' || card === 'p2_msg') return 1
  if (card === 'p3' || card === 'p3b' || card === 'p3c') return 2
  if (card === 'p4a' || card === 'p4b' || card === 'p4c' || card === 'p4d' || card === 'p4e') return 3
  if (card === 'p5') return 4
  return 5
}

function tempAccentClass(t: ColdCallTemperature): string {
  switch (t) {
    case 'dead':
      return 'border-neutral-600'
    case 'cold':
      return 'border-sky-600'
    case 'warm':
      return 'border-amber-500'
    case 'hot':
      return 'border-orange-500'
    case 'converting':
      return 'border-emerald-500'
    default:
      return 'border-white/[0.08]'
  }
}

function SelectChipRow<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T | ''
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => {
        const on = value === o.id
        return (
          <button
            key={String(o.id)}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'min-h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors text-left',
              on
                ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function TemperatureMenu({
  value,
  onChange,
}: {
  value: ColdCallTemperature
  onChange: (v: ColdCallTemperature) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const label =
    value && COLD_CALL_TEMPERATURE_META[value as Exclude<ColdCallTemperature, ''>]
      ? `${COLD_CALL_TEMPERATURE_META[value as Exclude<ColdCallTemperature, ''>].emoji} ${COLD_CALL_TEMPERATURE_META[value as Exclude<ColdCallTemperature, ''>].label}`
      : 'Temperature'
  return (
    <div className="relative" ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn('h-9 gap-1 border-neutral-700', tempAccentClass(value))}
        onClick={() => setOpen(!open)}
      >
        {label}
        <ChevronDown className="h-3.5 w-3.5 opacity-60" />
      </Button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-lg border border-white/[0.12] bg-neutral-900 py-1 shadow-xl">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs text-neutral-400 hover:bg-neutral-800"
            onClick={() => {
              onChange('')
              setOpen(false)
            }}
          >
            Clear
          </button>
          {(Object.keys(COLD_CALL_TEMPERATURE_META) as Exclude<ColdCallTemperature, ''>[]).map(k => {
            const m = COLD_CALL_TEMPERATURE_META[k]
            return (
              <button
                key={k}
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-neutral-100 hover:bg-neutral-800"
                onClick={() => {
                  onChange(k)
                  setOpen(false)
                }}
              >
                {m.emoji} {m.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

export default function ColdCallFormPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const cold = useColdCalls()
  const booking = useBookingIntakes()
  const { venues, addVenue, refetch: refetchVenues } = useVenues()
  const { profile } = useArtistProfile()

  const callIdParam = searchParams.get('callId')
  const [selectedId, setSelectedId] = useState<string | null>(callIdParam)
  const [precallError, setPrecallError] = useState<string | null>(null)
  const [savingUi, setSavingUi] = useState(false)
  const [convertBusy, setConvertBusy] = useState(false)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)

  useEffect(() => {
    if (callIdParam) setSelectedId(callIdParam)
  }, [callIdParam])

  const selectedRow = useMemo(
    () => cold.calls.find(c => c.id === selectedId) ?? null,
    [cold.calls, selectedId],
  )
  const data = useMemo(
    () => (selectedRow ? cold.parseData(selectedRow) : null),
    [selectedRow, cold],
  )

  const patch = useCallback(
    (p: Partial<ColdCallDataV1>) => {
      if (!selectedId) return
      cold.updateCallData(selectedId, d => ({ ...d, ...p }))
    },
    [selectedId, cold],
  )

  const applyVenuePick = useCallback(
    async (venue: Venue) => {
      if (!selectedId) return
      const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', venue.id).order('created_at')
      const list = (rows ?? []) as Contact[]
      const primary = list[0]
      cold.updateCallData(selectedId, d => ({
        ...d,
        venue_source: 'existing',
        existing_venue_id: venue.id,
        venue_name: venue.name,
        city: venue.city ?? '',
        state_region: venue.region ?? '',
        venue_type: venue.venue_type ?? '',
        target_phone: primary?.phone ?? d.target_phone,
        target_email: primary?.email ?? d.target_email,
        target_name: primary?.name ?? d.target_name,
      }))
    },
    [selectedId, cold],
  )

  const handleNew = async () => {
    const row = await cold.createColdCall()
    if (row) {
      setSelectedId(row.id)
      setSearchParams({ callId: row.id }, { replace: true })
    }
  }

  const handleSave = async () => {
    setSavingUi(true)
    try {
      await cold.flushAllPending()
    } finally {
      setSavingUi(false)
    }
  }

  const handleExit = async () => {
    if (!window.confirm('Leave cold call workspace? Changes will be saved first.')) return
    await cold.flushAllPending()
    navigate('/forms/cold-calls')
  }

  const handleBeginCall = async () => {
    if (!selectedId || !data) return
    if (!data.venue_name.trim() || !data.target_phone.trim()) {
      setPrecallError('Add venue name and phone before you start the call.')
      return
    }
    setPrecallError(null)
    await cold.flushImmediate(selectedId)
    await cold.patchRow(selectedId, { call_date: new Date().toISOString() })
    const title = defaultColdCallTitle(data.venue_name.trim())
    cold.updateTitle(selectedId, title)
    patch({
      session_mode: 'live_call',
      live_card: 'p1',
      live_history: ['p1'],
    })
  }

  const handleLiveContinue = () => {
    if (!data || !selectedId) return
    const next = advanceFromLiveCard(data)
    if (next === 'post') {
      patch({
        session_mode: 'post_call',
        final_temperature: data.final_temperature || data.operator_temperature,
        save_to_pipeline:
          (data.final_temperature || data.operator_temperature) === 'dead' ? false : data.save_to_pipeline,
      })
      return
    }
    if (Object.keys(next).length === 0) return
    patch(next)
  }

  const handleEndCallLive = () => {
    handleLiveContinue()
  }

  const handleConvert = async () => {
    if (!selectedId || !data) return
    setConvertBusy(true)
    try {
      await cold.flushAllPending()
      const bundle = buildIntakeBundleFromColdCall({
        ...data,
        operator_temperature: 'converting',
        final_temperature: 'converting',
      })
      const row = await booking.createIntakeFromColdCall({
        coldCallId: selectedId,
        title: bundle.title,
        venueData: bundle.venue,
        showData: bundle.show,
      })
      if (row) navigate(`/forms/intake?intakeId=${encodeURIComponent(row.id)}`)
    } finally {
      setConvertBusy(false)
    }
  }

  const outreachStatusForTemp = (t: ColdCallTemperature): OutreachStatus => {
    if (t === 'hot' || t === 'converting' || t === 'warm') return 'in_discussion'
    if (t === 'cold') return 'reached_out'
    return 'reached_out'
  }

  const handlePipelineImport = async () => {
    if (!selectedId || !data) return
    setImportBusy(true)
    setImportMsg(null)
    try {
      await cold.flushAllPending()
      const status = outreachStatusForTemp(data.final_temperature || data.operator_temperature)
      const capLabel = CAPACITY_OPTIONS.find(c => c.id === data.capacity_range)?.label ?? null
      const res = await addVenue({
        name: data.venue_name.trim() || 'Venue',
        location: null,
        city: data.city.trim() || null,
        address_line2: null,
        region: data.state_region.trim() || null,
        postal_code: null,
        country: null,
        venue_type: (data.venue_type_confirm || data.venue_type || 'other') as VenueType,
        priority: data.priority,
        status,
        outreach_track: 'pipeline',
        follow_up_date: data.follow_up_date.trim() || null,
        deal_terms: null,
        capacity: capLabel,
      })
      if (res.error) {
        setImportMsg(res.error.message ?? 'Import failed')
        return
      }
      const venueId = res.data!.id
      const { data: auth } = await supabase.auth.getUser()
      if (auth.user) {
        const name =
          data.target_name.trim() ||
          data.decision_maker_name.trim() ||
          'Contact'
        await supabase.from('contacts').insert({
          user_id: auth.user.id,
          venue_id: venueId,
          name,
          title_key: null,
          role: data.target_role ? COLD_CALL_TARGET_ROLE_LABELS[data.target_role] : null,
          email: data.target_email.trim() || null,
          phone: data.target_phone.trim() || null,
          company: null,
        })
      }
      await cold.patchRow(selectedId, { venue_id: venueId })
      patch({ existing_venue_id: venueId, venue_source: 'existing' })
      await refetchVenues()
      setImportMsg('Imported to Outreach.')
    } finally {
      setImportBusy(false)
    }
  }

  const managerPhone = profile?.manager_phone ?? ''

  const prevCallsForVenue = useMemo(() => {
    if (!data?.existing_venue_id) return cold.calls.filter(c => c.id !== selectedId).slice(0, 12)
    return cold.calls.filter(c => c.venue_id === data.existing_venue_id && c.id !== selectedId).slice(0, 12)
  }, [cold.calls, data?.existing_venue_id, selectedId])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  if (cold.loading && cold.calls.length === 0) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-neutral-500" />
      </div>
    )
  }

  if (!selectedRow || !data) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col">
        <header className="h-12 border-b border-neutral-800 flex items-center px-4 shrink-0">
          <Button variant="ghost" size="sm" className="gap-2" asChild>
            <Link to="/forms/cold-calls">
              <ArrowLeft className="h-4 w-4" />
              All cold calls
            </Link>
          </Button>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <PhoneForwarded className="h-10 w-10 text-neutral-600 mb-4" />
          <p className="text-neutral-400 text-sm mb-4 text-center max-w-sm">Open a cold call from the hub or start a new one.</p>
          <Button type="button" onClick={() => void handleNew()}>
            New cold call
          </Button>
          {cold.error ? <p className="text-red-400 text-xs mt-4">{cold.error}</p> : null}
        </div>
      </div>
    )
  }

  const wIdx = data.session_mode === 'post_call' ? 6 : waypointIndex(data.live_card)
  const activeTemp = data.session_mode === 'post_call' ? data.final_temperature : data.operator_temperature

  const liveCapture = (() => {
    const card = data.live_card
    const script = <p>{scriptForCard(card, data, managerPhone)}</p>
    switch (card) {
      case 'p1':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Who picked up?</Label>
                  <SelectChipRow
                    value={data.who_answered}
                    onChange={v => patch({ who_answered: v })}
                    options={WHO_ANSWERED_OPTIONS}
                  />
                </div>
                {data.who_answered === 'right_person' ? (
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Name check</Label>
                    <SelectChipRow
                      value={data.confirmed_name}
                      onChange={v => patch({ confirmed_name: v })}
                      options={CONFIRMED_NAME_OPTIONS}
                    />
                    {data.confirmed_name === 'different' ? (
                      <Input
                        className="h-10 border-neutral-800 bg-neutral-950/80"
                        value={data.different_name_note}
                        onChange={e => patch({ different_name_note: e.target.value })}
                        placeholder="Their name"
                      />
                    ) : null}
                  </div>
                ) : null}
              </div>
            }
          />
        )
      case 'p2a':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <Label className="text-neutral-400 text-xs">What happened?</Label>
                <SelectChipRow
                  value={data.gatekeeper_result}
                  onChange={v => {
                    const patchP: Partial<ColdCallDataV1> = { gatekeeper_result: v }
                    if (v === 'shut_down') patchP.operator_temperature = data.operator_temperature || 'dead'
                    patch(patchP)
                  }}
                  options={GATEKEEPER_RESULT_OPTIONS}
                />
              </div>
            }
          />
        )
      case 'p2a_detail':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Name they gave</Label>
                  <Input
                    className="h-10 border-neutral-800 bg-neutral-950/80"
                    value={data.decision_maker_name}
                    onChange={e => patch({ decision_maker_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Role</Label>
                  <Select
                    value={data.decision_maker_role || '__none__'}
                    onValueChange={v => patch({ decision_maker_role: v === '__none__' ? '' : (v as ColdCallDataV1['decision_maker_role']) })}
                  >
                    <SelectTrigger className="h-10 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(COLD_CALL_TARGET_ROLE_LABELS) as (keyof typeof COLD_CALL_TARGET_ROLE_LABELS)[]).map(
                        k => (
                          <SelectItem key={k} value={k}>
                            {COLD_CALL_TARGET_ROLE_LABELS[k]}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Best time</Label>
                  <SelectChipRow value={data.best_time} onChange={v => patch({ best_time: v })} options={BEST_TIME_OPTIONS} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Direct line / email?</Label>
                  <SelectChipRow
                    value={data.direct_line_flag}
                    onChange={v => patch({ direct_line_flag: v })}
                    options={[
                      { id: 'yes_later', label: 'Yes — capture later' },
                      { id: 'no', label: 'No' },
                    ]}
                  />
                </div>
              </div>
            }
          />
        )
      case 'p2_msg':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow
                  value={data.message_left_with}
                  onChange={v => patch({ message_left_with: v })}
                  options={[
                    { id: 'got_name_later', label: 'Got name — later' },
                    { id: 'no_name', label: 'No name' },
                  ]}
                />
                <SelectChipRow
                  value={data.callback_expected}
                  onChange={v => patch({ callback_expected: v })}
                  options={[
                    { id: 'yes', label: 'Expecting callback' },
                    { id: 'no_retry', label: 'No — I’ll try again' },
                  ]}
                />
              </div>
            }
          />
        )
      case 'p3':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-1.5">
                <Label className="text-neutral-400 text-xs">How did they respond?</Label>
                <SelectChipRow value={data.initial_reaction} onChange={v => patch({ initial_reaction: v })} options={INITIAL_REACTION_OPTIONS} />
              </div>
            }
          />
        )
      case 'p3b':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <SelectChipRow value={data.pivot_response} onChange={v => patch({ pivot_response: v })} options={PIVOT_OPTIONS} />
            }
          />
        )
      case 'p3c':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow value={data.parking_result} onChange={v => patch({ parking_result: v })} options={PARKING_OPTIONS} />
                <SelectChipRow value={data.send_to} onChange={v => patch({ send_to: v })} options={SEND_TO_OPTIONS} />
              </div>
            }
          />
        )
      case 'p4a': {
        const dayLabels = Object.fromEntries([...COLD_CALL_WEEKDAY_LABELS].map(d => [d, d])) as Record<string, string>
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <IntakeCompactChipRow
                  label="What nights?"
                  selected={data.event_nights}
                  ids={COLD_CALL_WEEKDAY_LABELS as unknown as string[]}
                  labels={dayLabels}
                  onChange={next => patch({ event_nights: next })}
                />
                <SelectChipRow
                  value={data.night_details_flag}
                  onChange={v => patch({ night_details_flag: v })}
                  options={[
                    { id: 'yes_later', label: 'Yes — specifics later' },
                    { id: 'days_only', label: 'Just the days' },
                  ]}
                />
              </div>
            }
          />
        )
      }
      case 'p4b': {
        const ids = MUSIC_VIBE_PRESETS.map(p => p.id)
        const labels = Object.fromEntries(MUSIC_VIBE_PRESETS.map(p => [p.id, p.label])) as Record<string, string>
        const hint = genreMatchHint(data.venue_vibes)
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-2">
                <IntakeCompactChipRow label="Vibe" selected={data.venue_vibes} ids={ids} labels={labels} onChange={v => patch({ venue_vibes: v })} />
                <p className="text-[11px] text-neutral-500">
                  Fit hint: {hint === 'match' ? '✅ Strong overlap' : hint === 'caution' ? '⚠️ Verify fit' : '❌ Mismatch risk'}
                </p>
              </div>
            }
          />
        )
      }
      case 'p4c':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow value={data.booking_process} onChange={v => patch({ booking_process: v })} options={BOOKING_PROCESS_OPTIONS} />
                <SelectChipRow value={data.decision_maker_same} onChange={v => patch({ decision_maker_same: v })} options={DECISION_SAME_OPTIONS} />
                <SelectChipRow
                  value={data.other_decision_maker_flag}
                  onChange={v => patch({ other_decision_maker_flag: v })}
                  options={[
                    { id: 'got_info_later', label: 'Got info — later' },
                    { id: 'vague', label: 'They were vague' },
                  ]}
                />
              </div>
            }
          />
        )
      case 'p4d':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Budget range</Label>
                  <SelectChipRow value={data.budget_range} onChange={v => patch({ budget_range: v })} options={BUDGET_RANGE_OPTIONS} />
                </div>
                <SelectChipRow value={data.rate_reaction} onChange={v => patch({ rate_reaction: v })} options={RATE_REACTION_OPTIONS} />
              </div>
            }
          />
        )
      case 'p4e':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Capacity</Label>
                  <SelectChipRow value={data.capacity_range} onChange={v => patch({ capacity_range: v })} options={CAPACITY_OPTIONS} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Venue type</Label>
                  <SelectChipRow
                    value={data.venue_type_confirm}
                    onChange={v => patch({ venue_type_confirm: v })}
                    options={VENUE_TYPE_CONFIRM_OPTIONS}
                  />
                </div>
              </div>
            }
          />
        )
      case 'p5':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <SelectChipRow
                value={data.ask_response}
                onChange={v => {
                  const hint = applyAskResponseTemperatureHint(v)
                  patch({
                    ask_response: v,
                    ...(hint ? { operator_temperature: hint } : {}),
                  })
                }}
                options={ASK_RESPONSE_OPTIONS}
              />
            }
          />
        )
      case 'p6':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow value={data.call_ended_naturally} onChange={v => patch({ call_ended_naturally: v })} options={ENDED_OPTIONS} />
                <SelectChipRow value={data.call_duration_feel} onChange={v => patch({ call_duration_feel: v })} options={DURATION_OPTIONS} />
                {data.operator_temperature === 'converting' ? (
                  <Button
                    type="button"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={convertBusy}
                    onClick={() => void handleConvert()}
                  >
                    {convertBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💰 Convert to booking →'}
                  </Button>
                ) : null}
                <Button type="button" variant={data.operator_temperature === 'converting' ? 'outline' : 'default'} className="w-full border-neutral-700" onClick={() => handleEndCallLive()}>
                  End call — wrap up
                </Button>
              </div>
            }
          />
        )
      case 'p6_vm':
      case 'p6_na':
        return (
          <IntakeLiveScriptCaptureStack
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <Button type="button" className="w-full" onClick={() => patch({ session_mode: 'post_call', final_temperature: data.operator_temperature })}>
                Continue to post-call
              </Button>
            }
          />
        )
      default:
        return null
    }
  })()

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      <header className="h-12 border-b border-neutral-800 flex items-center gap-3 px-3 shrink-0 bg-neutral-950 z-20">
        <Button variant="ghost" size="sm" className="gap-1 text-neutral-400 shrink-0" asChild>
          <Link to="/forms/cold-calls" title="All cold calls">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Select
            value={selectedId ?? ''}
            onValueChange={v => {
              setSelectedId(v)
              setSearchParams({ callId: v }, { replace: true })
            }}
          >
            <SelectTrigger className="h-9 max-w-[220px] border-neutral-800 bg-neutral-900/80 text-sm">
              <SelectValue placeholder="Cold call" />
            </SelectTrigger>
            <SelectContent>
              {cold.calls.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title || 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" variant="outline" size="sm" className="h-9 shrink-0 border-neutral-700" onClick={() => void handleNew()}>
            New
          </Button>
        </div>
        <Input
          className="h-9 max-w-md border-neutral-800 bg-neutral-900/80 text-sm hidden md:block"
          value={selectedRow.title}
          onChange={e => cold.updateTitle(selectedId!, e.target.value)}
          placeholder="Call title"
        />
        <div className="flex items-center gap-2 shrink-0">
          <TemperatureMenu
            value={data.session_mode === 'post_call' ? data.final_temperature : data.operator_temperature}
            onChange={v =>
              data.session_mode === 'post_call' ? patch({ final_temperature: v }) : patch({ operator_temperature: v })
            }
          />
          <span className="text-[11px] text-neutral-500 hidden sm:inline">Auto-saved</span>
          <Button type="button" variant="secondary" size="sm" className="h-9 gap-1" disabled={savingUi} onClick={() => void handleSave()}>
            {savingUi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Save
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 text-neutral-400" onClick={() => void handleExit()}>
            Exit
          </Button>
        </div>
      </header>

      {data.session_mode === 'pre_call' ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 pb-24">
            {precallError ? (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{precallError}</div>
            ) : null}

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Venue source</h2>
              <IntakeCompactDual
                value={data.venue_source === 'existing'}
                onChange={v => patch({ venue_source: v ? 'existing' : 'new', existing_venue_id: v ? data.existing_venue_id : null })}
                a={{ id: 'new', label: 'New venue' }}
                b={{ id: 'ex', label: 'Existing venue' }}
              />
              {data.venue_source === 'existing' ? (
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Venue</Label>
                  <Select
                    value={data.existing_venue_id ?? '__none__'}
                    onValueChange={v => {
                      if (v === '__none__') patch({ existing_venue_id: null })
                      else {
                        const venue = venues.find(x => x.id === v)
                        if (venue) void applyVenuePick(venue)
                      }
                    }}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Select venue" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {venues.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Who am I calling?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Venue name *</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.venue_name} onChange={e => patch({ venue_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Venue type</Label>
                  <Select
                    value={data.venue_type || '__none__'}
                    onValueChange={v => patch({ venue_type: v === '__none__' ? '' : v })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(VENUE_TYPE_LABELS) as VenueType[]).map(k => (
                        <SelectItem key={k} value={k}>
                          {VENUE_TYPE_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">City</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.city} onChange={e => patch({ city: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">State</Label>
                  <Select value={data.state_region || '__none__'} onValueChange={v => patch({ state_region: v === '__none__' ? '' : v })}>
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="State" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {US_STATE_OPTIONS.map(s => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Vibe / description</Label>
                  <Textarea className="min-h-[52px] border-neutral-800 bg-neutral-950/80" value={data.venue_vibe} onChange={e => patch({ venue_vibe: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Known events</Label>
                  <Textarea className="min-h-[52px] border-neutral-800 bg-neutral-950/80" value={data.known_events} onChange={e => patch({ known_events: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Instagram / social</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.social_handle} onChange={e => patch({ social_handle: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Website</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.website} onChange={e => patch({ website: e.target.value })} />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Who am I trying to reach?</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Contact name</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.target_name} onChange={e => patch({ target_name: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Role</Label>
                  <Select
                    value={data.target_role || '__none__'}
                    onValueChange={v => patch({ target_role: v === '__none__' ? '' : (v as ColdCallDataV1['target_role']) })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(COLD_CALL_TARGET_ROLE_LABELS) as (keyof typeof COLD_CALL_TARGET_ROLE_LABELS)[]).map(k => (
                        <SelectItem key={k} value={k}>
                          {COLD_CALL_TARGET_ROLE_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Phone *</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" type="tel" value={data.target_phone} onChange={e => patch({ target_phone: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Email</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" type="email" value={data.target_email} onChange={e => patch({ target_email: e.target.value })} />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">How I found them</Label>
                  <Select value={data.how_found || '__none__'} onValueChange={v => patch({ how_found: v === '__none__' ? '' : (v as ColdCallDataV1['how_found']) })}>
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(COLD_CALL_HOW_FOUND_LABELS) as (keyof typeof COLD_CALL_HOW_FOUND_LABELS)[]).map(k => (
                        <SelectItem key={k} value={k}>
                          {COLD_CALL_HOW_FOUND_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">My angle</h2>
              <div className="space-y-2">
                <Label className="text-neutral-400 text-xs">What am I pitching?</Label>
                <div className="flex flex-wrap gap-1.5">
                  {CALL_PURPOSE_TOGGLE.map(o => {
                    const on = data.call_purpose === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => patch({ call_purpose: on ? '' : o.id })}
                        className={cn(
                          'min-h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
                          on
                            ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                            : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                        )}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-neutral-400 text-xs">Why we’re a fit</Label>
                <Textarea className="min-h-[52px] border-neutral-800 bg-neutral-950/80" value={data.pitch_angle} onChange={e => patch({ pitch_angle: e.target.value })} />
              </div>
              {data.call_purpose === 'follow_up' ? (
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Previous cold call</Label>
                  <Select
                    value={data.previous_call_id ?? '__none__'}
                    onValueChange={v => patch({ previous_call_id: v === '__none__' ? null : v })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Link" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {prevCallsForVenue.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.title} · {c.updated_at?.slice(0, 10)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pipeline</h2>
              <p className="text-sm text-neutral-400">Lead source: Pipeline · Commission: New Doors</p>
              <div className="space-y-1.5 max-w-xs">
                <Label className="text-neutral-400 text-xs">Priority (1–5)</Label>
                <Input
                  className="h-11 border-neutral-800 bg-neutral-950/80"
                  type="number"
                  min={1}
                  max={5}
                  value={data.priority}
                  onChange={e => patch({ priority: Math.min(5, Math.max(1, Number(e.target.value) || 3)) })}
                />
              </div>
            </section>

            <div className="flex justify-center pt-4">
              <Button type="button" size="lg" className="min-h-[52px] px-8 bg-red-600 hover:bg-red-700 text-white" onClick={() => void handleBeginCall()}>
                Begin call
              </Button>
            </div>
          </div>
        </div>
      ) : data.session_mode === 'live_call' ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
          <aside className="w-full md:w-[248px] shrink-0 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col py-2 md:py-3 px-2 bg-neutral-950">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 mb-2">Cold call</p>
            <nav className="flex md:flex-col flex-row gap-0.5 overflow-x-auto pb-1 md:pb-0">
              {LIVE_WAYPOINTS.map((w, idx) => {
                const visited = idx < wIdx || (idx === wIdx && data.live_history.length > 0)
                return (
                  <div
                    key={w.id}
                    className={cn(
                      'shrink-0 md:w-full rounded-lg px-3 py-2 text-sm border',
                      idx === wIdx
                        ? 'bg-neutral-100 text-neutral-950 font-semibold border-neutral-200'
                        : 'text-neutral-500 border-transparent',
                      visited && idx !== wIdx ? cn('border', tempAccentClass(activeTemp)) : '',
                    )}
                  >
                    <span className="font-mono text-xs w-4 inline-block mr-2">{idx + 1}</span>
                    {w.label}
                  </div>
                )
              })}
            </nav>
            <div className="mt-3 px-2">
              <TemperatureMenu value={data.operator_temperature} onChange={v => patch({ operator_temperature: v })} />
            </div>
          </aside>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 pb-24 sm:p-6 items-start">
              <div
                key={data.live_card}
                className="w-full max-w-2xl shrink-0 rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 sm:p-5 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {liveCapture}
                {data.live_card !== 'p6' && data.live_card !== 'p6_vm' && data.live_card !== 'p6_na' ? (
                  <div className="pt-2 flex justify-end">
                    <Button type="button" onClick={() => handleLiveContinue()}>
                      Continue
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-24">
            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Outcome</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Final temperature</Label>
                  <TemperatureMenu
                    value={data.final_temperature}
                    onChange={v =>
                      patch({
                        final_temperature: v,
                        save_to_pipeline: v === 'dead' ? false : data.save_to_pipeline,
                      })
                    }
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Outcome</Label>
                  <Select value={data.outcome || '__none__'} onValueChange={v => patch({ outcome: v === '__none__' ? '' : (v as ColdCallDataV1['outcome']) })}>
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(COLD_CALL_OUTCOME_LABELS) as (keyof typeof COLD_CALL_OUTCOME_LABELS)[]).map(k => (
                        <SelectItem key={k} value={k}>
                          {COLD_CALL_OUTCOME_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <IntakeCompactDual
                    value={data.save_to_pipeline}
                    onChange={v => patch({ save_to_pipeline: v })}
                    a={{ id: 'no', label: 'History only' }}
                    b={{ id: 'yes', label: 'Save to pipeline' }}
                  />
                </div>
              </div>
            </section>

            {data.save_to_pipeline ? (
              <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Follow-up</h2>
                <IntakeCompactChipRow<ColdCallNextActionKey>
                  label="Next actions"
                  selected={data.next_actions}
                  ids={Object.keys(COLD_CALL_NEXT_ACTION_LABELS) as ColdCallNextActionKey[]}
                  labels={COLD_CALL_NEXT_ACTION_LABELS}
                  onChange={next => patch({ next_actions: next })}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Follow up by</Label>
                    <Input className="h-11 border-neutral-800 bg-neutral-950/80" type="date" value={data.follow_up_date} onChange={e => patch({ follow_up_date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-neutral-400 text-xs">Follow-up notes</Label>
                    <Textarea className="min-h-[52px] border-neutral-800 bg-neutral-950/80" value={data.follow_up_notes} onChange={e => patch({ follow_up_notes: e.target.value })} />
                  </div>
                </div>
              </section>
            ) : null}

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Notes</h2>
              <Textarea className="min-h-[100px] border-neutral-800 bg-neutral-950/80" value={data.call_notes} onChange={e => patch({ call_notes: e.target.value })} placeholder="Call notes" />
              {data.final_temperature === 'dead' ? (
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Rejection reason</Label>
                  <Select
                    value={data.rejection_reason || '__none__'}
                    onValueChange={v => patch({ rejection_reason: v === '__none__' ? '' : (v as ColdCallDataV1['rejection_reason']) })}
                  >
                    <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                      <SelectValue placeholder="Reason" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">—</SelectItem>
                      {(Object.keys(COLD_CALL_REJECTION_LABELS) as (keyof typeof COLD_CALL_REJECTION_LABELS)[]).map(k => (
                        <SelectItem key={k} value={k}>
                          {COLD_CALL_REJECTION_LABELS[k]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </section>

            {data.save_to_pipeline ? (
              <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-3">
                <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pipeline import</h2>
                <p className="text-sm text-neutral-400">
                  {data.venue_name} · {data.city}
                  {data.capacity_range ? ` · ${CAPACITY_OPTIONS.find(c => c.id === data.capacity_range)?.label}` : ''}
                </p>
                {importMsg ? <p className="text-sm text-sky-300">{importMsg}</p> : null}
                <Button type="button" disabled={importBusy} onClick={() => void handlePipelineImport()}>
                  {importBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Import to Outreach'}
                </Button>
              </section>
            ) : null}

            {data.final_temperature === 'converting' && !selectedRow.converted_to_intake_id ? (
              <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={convertBusy} onClick={() => void handleConvert()}>
                {convertBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : '💰 Convert to booking intake'}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <footer className="h-11 border-t border-neutral-800 flex items-center justify-between px-4 shrink-0 bg-neutral-950 text-[11px] text-neutral-500">
        <span>
          {data.session_mode === 'pre_call' ? 'Pre-call' : data.session_mode === 'live_call' ? `Live · ${liveCardStepTitle(data.live_card)}` : 'Post-call'}
        </span>
        <span>
          Phase {wIdx + 1} / {LIVE_WAYPOINTS.length}
        </span>
      </footer>
    </div>
  )
}
