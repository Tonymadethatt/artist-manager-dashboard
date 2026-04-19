import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  PhoneForwarded,
  Pin,
  Save,
  Undo2,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useColdCalls } from '@/hooks/useColdCalls'
import { useVenues } from '@/hooks/useVenues'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useBookingIntakes } from '@/hooks/useBookingIntakes'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { advanceFromLiveCard } from '@/lib/coldCall/coldCallLiveRouting'
import {
  bookmarkCard,
  coldCallPhaseSkipped,
  coldCallWaypointAnchor,
  displayCard,
  liveCardAdvanceBlockersAtBookmark,
  liveCardAllowsChipAutoAdvance,
  liveHistoryEdgeValid,
  pruneStaleLiveHistoryIfNeeded,
  waypointIndex,
} from '@/lib/coldCall/coldCallLivePath'
import { coldCallEnsureFollowUpTask, suggestColdCallFollowUpDate } from '@/lib/coldCall/coldCallFollowUp'
import { computeColdCallOutcomeAuto } from '@/lib/coldCall/coldCallOutcomeAuto'
import {
  coldCallLiveAutoTemperature,
  computeColdCallTemperatureScore,
} from '@/lib/coldCall/coldCallTemperatureScore'
import {
  buildGatekeeperSecondContact,
  buildIntakeBundleFromColdCall,
  resolveColdCallOutreachVenueId,
} from '@/lib/coldCall/mapColdCallToBookingIntake'
import {
  COLD_CALL_HOW_FOUND_LABELS,
  COLD_CALL_NEXT_ACTION_LABELS,
  COLD_CALL_OUTCOME_LABELS,
  COLD_CALL_PITCH_REASON_CHIPS,
  COLD_CALL_REJECTION_LABELS,
  COLD_CALL_TEMPERATURE_META,
  COLD_CALL_WEEKDAY_LABELS,
  defaultColdCallTitle,
  type ColdCallDataV1,
  type ColdCallNextActionKey,
  type ColdCallTemperature,
  type ColdCallVenueTypeConfirm,
} from '@/lib/coldCall/coldCallPayload'
import type { ContactTitleKey } from '@/lib/contacts/contactTitles'
import { CONTACT_TITLE_LABELS } from '@/lib/contacts/contactTitles'
import { ContactTitleSelect } from '@/components/contacts/ContactTitleSelect'
import { EntityTypeSelect } from '@/components/venue/EntityTypeSelect'
import { MUSIC_VIBE_PRESETS, US_STATE_OPTIONS } from '@/lib/intake/intakePayloadV3'
import type { Contact, Venue, VenueType } from '@/types'
import { VENUE_TYPE_ORDER } from '@/types'
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
import { coldCallLiveScriptBeats, coldCallScriptContext, liveCardStepTitle } from '@/pages/cold-call/liveCardCopy'
import {
  ASK_FOLLOWUP_WHEN_OPTIONS,
  ASK_RESPONSE_OPTIONS,
  ASK_SEND_CHANNEL_OPTIONS,
  BEST_TIME_OPTIONS,
  BOOKING_PROCESS_OPTIONS,
  BUDGET_RANGE_OPTIONS,
  CALL_PURPOSE_TOGGLE,
  CAPACITY_OPTIONS,
  DECISION_SAME_OPTIONS,
  DM_DIRECT_LINE_OPTIONS,
  DURATION_OPTIONS,
  ENDED_OPTIONS,
  GATEKEEPER_RESULT_OPTIONS,
  INITIAL_REACTION_OPTIONS,
  PARKING_OPTIONS,
  PIVOT_OPTIONS,
  RATE_REACTION_OPTIONS,
  SEND_TO_OPTIONS,
  WHO_ANSWERED_OPTIONS,
} from '@/pages/cold-call/liveFieldOptions'
import type { OutreachStatus } from '@/types'

const LIVE_WAYPOINTS = [
  { id: 'opener', label: 'Opener' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'redirect', label: 'Redirect' },
  { id: 'ask', label: 'The Ask' },
  { id: 'pivot', label: 'Pivot' },
  { id: 'close', label: 'Close' },
] as const

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

function LiveTemperatureBar({
  value,
  score,
  manualLock,
  onPick,
  onResetAuto,
}: {
  value: ColdCallTemperature
  score: number
  manualLock: boolean
  onPick: (v: ColdCallTemperature) => void
  onResetAuto: () => void
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
    <div className="relative flex items-center gap-2" ref={ref}>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn('h-9 gap-1 border-neutral-700', tempAccentClass(value))}
          onClick={() => setOpen(!open)}
        >
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-60 shrink-0" />
        </Button>
        <span
          className="text-[10px] text-neutral-500 tabular-nums leading-none whitespace-nowrap hidden sm:inline"
          title={`Auto score ${score}`}
        >
          <span className="text-neutral-600">Score</span> {score > 0 ? `+${score}` : score}
        </span>
      </div>
      {manualLock ? (
        <>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/50 text-amber-100/90 shrink-0">Manual</span>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-[11px] text-neutral-400 shrink-0" onClick={onResetAuto}>
            Reset auto
          </Button>
        </>
      ) : null}
      {open ? (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[11rem] rounded-lg border border-white/[0.12] bg-neutral-900 py-1 shadow-xl">
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-xs text-neutral-400 hover:bg-neutral-800"
            onClick={() => {
              onPick('')
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
                  onPick(k)
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
  const [convertInlineError, setConvertInlineError] = useState<string | null>(null)
  const [importBusy, setImportBusy] = useState(false)
  const [importMsg, setImportMsg] = useState<string | null>(null)
  const [liveFieldIssues, setLiveFieldIssues] = useState<Record<string, string>>({})
  const [precallFieldIssues, setPrecallFieldIssues] = useState<Record<string, string>>({})
  const [continueShake, setContinueShake] = useState(0)
  const chipAutoAdvancePending = useRef(false)
  const liveAutoAdvanceInFlight = useRef(false)

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
      cold.updateCallData(selectedId, d => {
        const next: ColdCallDataV1 = { ...d, ...p }
        const opExplicit = Object.prototype.hasOwnProperty.call(p, 'operator_temperature')
        if (next.session_mode === 'live_call' && !next.temperature_manual_lock && !opExplicit) {
          return {
            ...next,
            temperature_score: computeColdCallTemperatureScore(next),
            operator_temperature: coldCallLiveAutoTemperature(next),
          }
        }
        if (next.session_mode === 'live_call') {
          return { ...next, temperature_score: computeColdCallTemperatureScore(next) }
        }
        return next
      })
    },
    [selectedId, cold],
  )

  const patchAfterChip = useCallback(
    (p: Partial<ColdCallDataV1>) => {
      chipAutoAdvancePending.current = true
      patch(p)
    },
    [patch],
  )

  useEffect(() => {
    if (!selectedId || !data || data.session_mode !== 'post_call' || data.outcome_manual_lock) return
    const auto = computeColdCallOutcomeAuto(data)
    if (auto !== data.outcome) patch({ outcome: auto })
  }, [selectedId, data, patch])

  /** p4c: "This person decides" implies you're talking to the booker. */
  useEffect(() => {
    if (!selectedId || !data) return
    if (data.session_mode !== 'live_call' || displayCard(data) !== 'p4c') return
    if (data.booking_process === 'this_person' && data.decision_maker_same !== 'yes') {
      patch({ decision_maker_same: 'yes' })
    }
  }, [selectedId, data, patch])

  useEffect(() => {
    if (!selectedId || !data) return
    if (data.session_mode !== 'live_call' || displayCard(data) !== 'p4d') return
    if (data.budget_range === 'no_say' && data.rate_reaction !== 'skipped') {
      patch({ rate_reaction: 'skipped' })
    }
  }, [selectedId, data, patch])

  useEffect(() => {
    if (!selectedId || !data) return
    if (data.session_mode !== 'live_call' || displayCard(data) !== 'p4e') return
    const vt = data.venue_type.trim()
    if (!data.venue_type_confirm && vt && (VENUE_TYPE_ORDER as string[]).includes(vt)) {
      patch({ venue_type_confirm: vt as ColdCallVenueTypeConfirm })
    }
  }, [selectedId, data, patch])

  const applyVenuePick = useCallback(
    async (venue: Venue) => {
      if (!selectedId) return
      const { data: rows } = await supabase.from('contacts').select('*').eq('venue_id', venue.id).order('created_at')
      const list = (rows ?? []) as Contact[]
      const primary = list[0]
      cold.updateCallData(selectedId, d => {
        const pk = primary?.title_key?.trim()
        const nextTitle: ContactTitleKey | '' =
          pk && pk in CONTACT_TITLE_LABELS ? (pk as ContactTitleKey) : d.target_title_key
        return {
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
          target_title_key: nextTitle,
        }
      })
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
    const issues: Record<string, string> = {}
    if (!data.venue_name.trim()) issues.venue_name = 'Add venue name.'
    if (!data.target_phone.trim()) issues.target_phone = 'Add the number you’re dialing.'
    if (!data.call_purpose) issues.call_purpose = 'Pick why you’re calling.'
    if (Object.keys(issues).length > 0) {
      setPrecallFieldIssues(issues)
      setPrecallError('Fill the essentials above to start.')
      setContinueShake(s => s + 1)
      return
    }
    setPrecallFieldIssues({})
    setPrecallError(null)
    await cold.flushImmediate(selectedId)
    await cold.patchRow(selectedId, { call_date: new Date().toISOString() })
    const title = defaultColdCallTitle(data.venue_name.trim())
    cold.updateTitle(selectedId, title)
    patch({
      session_mode: 'live_call',
      live_card: 'p1',
      view_card: 'p1',
      last_active_card: 'p1',
      live_history: ['p1'],
    })
  }

  const handleLiveContinue = async () => {
    if (!data || !selectedId || !selectedRow) return

    const pruned = pruneStaleLiveHistoryIfNeeded(data)
    let d = pruned.data
    if (pruned.changed) {
      patch({
        live_history: d.live_history,
        last_active_card: d.last_active_card,
        view_card: d.view_card,
      })
    }

    const bm = bookmarkCard(d)
    const view = displayCard(d)
    if (view !== bm) {
      const i = d.live_history.indexOf(view)
      if (i < 0) {
        setLiveFieldIssues({ jump: 'This step wasn’t on your path — snapped back to your bookmark.' })
        patch({ view_card: bm })
        setContinueShake(s => s + 1)
        return
      }
      if (i < d.live_history.length - 1) {
        const nextHop = d.live_history[i + 1]!
        if (!liveHistoryEdgeValid(view, nextHop, d)) {
          const tailCut: ColdCallDataV1 = {
            ...d,
            live_history: d.live_history.slice(0, i + 1),
            last_active_card: view,
            view_card: view,
          }
          patch({
            live_history: tailCut.live_history,
            last_active_card: tailCut.last_active_card,
            view_card: tailCut.view_card,
          })
          d = tailCut
        } else {
          setLiveFieldIssues({})
          patch({ view_card: nextHop })
          return
        }
      }
    }

    const blockers = liveCardAdvanceBlockersAtBookmark(d)
    if (blockers.length > 0) {
      const rec: Record<string, string> = {}
      for (const b of blockers) rec[b.field] = b.message
      setLiveFieldIssues(rec)
      setContinueShake(s => s + 1)
      return
    }
    setLiveFieldIssues({})

    const next = advanceFromLiveCard(d)
    if (next === 'post') {
      const ft = d.final_temperature || d.operator_temperature
      const suggestedDate = suggestColdCallFollowUpDate(d)
      const autoOutcome = d.outcome_manual_lock ? d.outcome : computeColdCallOutcomeAuto(d)
      patch({
        session_mode: 'post_call',
        final_temperature: ft,
        outcome: autoOutcome,
        follow_up_date: d.follow_up_date.trim() || suggestedDate,
        save_to_pipeline: ft === 'dead' ? false : d.save_to_pipeline,
      })
      await cold.flushImmediate(selectedId)
      const taskRes = await coldCallEnsureFollowUpTask({
        coldCallId: selectedId,
        data: { ...d, session_mode: 'post_call', final_temperature: ft, outcome: autoOutcome },
        rowVenueId: selectedRow.venue_id,
        existingTaskId: selectedRow.follow_up_task_id,
        callDateIso: selectedRow.call_date,
      })
      if (taskRes.taskId && !selectedRow.follow_up_task_id) {
        await cold.patchRow(selectedId, { follow_up_task_id: taskRes.taskId })
      }
      return
    }
    if (Object.keys(next).length === 0) {
      setContinueShake(s => s + 1)
      return
    }
    patch(next)
  }

  const handleLiveContinueRef = useRef(handleLiveContinue)
  handleLiveContinueRef.current = handleLiveContinue

  useEffect(() => {
    if (!selectedId || !data) return
    if (data.session_mode !== 'live_call') {
      chipAutoAdvancePending.current = false
      return
    }
    if (!chipAutoAdvancePending.current) return
    if (liveAutoAdvanceInFlight.current) return
    const card = displayCard(data)
    if (card !== bookmarkCard(data)) {
      chipAutoAdvancePending.current = false
      return
    }
    if (!liveCardAllowsChipAutoAdvance(card, data)) {
      chipAutoAdvancePending.current = false
      return
    }
    if (liveCardAdvanceBlockersAtBookmark(data).length > 0) return

    chipAutoAdvancePending.current = false
    liveAutoAdvanceInFlight.current = true
    void handleLiveContinueRef.current().finally(() => {
      liveAutoAdvanceInFlight.current = false
    })
  }, [data, selectedId])

  const handleJumpWaypoint = (phaseIdx: number) => {
    if (!data) return
    const anchor = coldCallWaypointAnchor(phaseIdx, data)
    patch({ view_card: anchor })
  }

  const handleJumpReturn = () => {
    if (!data) return
    patch({ view_card: bookmarkCard(data) })
  }

  const handleLiveBack = () => {
    if (!data) return
    const view = displayCard(data)
    const i = data.live_history.indexOf(view)
    if (i > 0) patch({ view_card: data.live_history[i - 1]! })
    else patch({ view_card: view })
  }

  const handleEndCallLive = () => {
    void handleLiveContinue()
  }

  const handleConvert = async () => {
    if (!selectedId || !data || !selectedRow) return
    const venueOk = data.venue_name.trim()
    const nameOk =
      data.decision_maker_name.trim() || data.target_name.trim() || data.gatekeeper_name.trim()
    const phoneOk = data.target_phone.trim()
    if (!venueOk || !nameOk || !phoneOk) {
      setConvertInlineError(
        'We need at least a venue name, a contact name, and a phone number to create a booking. Fill these in first.',
      )
      return
    }
    setConvertInlineError(null)
    setConvertBusy(true)
    try {
      await cold.flushAllPending()
      const mergedNotes = [selectedRow.notes?.trim() || '', data.call_notes.trim()].filter(Boolean).join('\n\n')
      const linkedId = resolveColdCallOutreachVenueId(data, venues)
      const bundle = buildIntakeBundleFromColdCall(data, {
        conversionContext: data.session_mode === 'live_call' ? 'mid_call' : 'post_call',
        mergedCallNotes: mergedNotes,
        resolvedExistingVenueId: linkedId,
        callDateIso: selectedRow.call_date,
      })
      const row = await booking.createIntakeFromColdCall({
        coldCallId: selectedId,
        title: bundle.title,
        venueData: bundle.venue,
        showData: bundle.show,
        linkedVenueId: linkedId,
        gatekeeperContact: buildGatekeeperSecondContact(data),
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
          title_key: data.target_title_key.trim() || null,
          role: null,
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

  const scriptCtx = coldCallScriptContext(profile ?? null)

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

  const dc = displayCard(data)
  const bm = bookmarkCard(data)
  const wIdx = data.session_mode === 'post_call' ? -1 : waypointIndex(dc)
  const bookmarkIdx = data.session_mode === 'live_call' ? waypointIndex(bm) : -1
  const activeTemp = data.session_mode === 'post_call' ? data.final_temperature : data.operator_temperature
  const showJumpReturn = data.session_mode === 'live_call' && dc !== bm

  const liveSkipBanner = (() => {
    if (data.session_mode !== 'live_call') return null
    const card = dc
    const phase = waypointIndex(card)
    if (!coldCallPhaseSkipped(phase, data)) return null
    if (data.live_history.includes(card)) return null
    if (phase === 1 && data.who_answered === 'right_person') {
      return 'You skipped gatekeeper — open only if something changed.'
    }
    if (data.who_answered === 'voicemail' || data.who_answered === 'no_answer') {
      return 'This phase wasn’t on your voicemail/no-answer path — capture extra detail if needed.'
    }
    return 'This phase was skipped on your branch — you can still fill it in if the situation changed.'
  })()

  const liveCapture = (() => {
    const card = dc
    const beats = coldCallLiveScriptBeats(card, data, scriptCtx)
    const script = (
      <div className="space-y-0">
        {beats.map((b, i) => (
          <p
            key={i}
            className={
              b.situational
                ? 'mt-3 border-t border-white/[0.06] pt-3 text-sm italic text-yellow-100/75'
                : undefined
            }
          >
            {b.situational ? (
              <>
                <span className="block text-[10px] font-semibold uppercase tracking-wider text-neutral-500 not-italic">
                  After they answer — if it fits
                </span>
                <span className="mt-1 block font-medium not-italic leading-relaxed text-yellow-100/90">{b.text}</span>
              </>
            ) : (
              b.text
            )}
          </p>
        ))}
      </div>
    )
    switch (card) {
      case 'p1':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className={cn('space-y-1.5', liveFieldIssues.who_answered ? 'rounded-md ring-1 ring-red-500/60 p-2 -m-0.5' : '')}>
                  <Label className="text-neutral-400 text-xs">Who picked up?</Label>
                  <SelectChipRow
                    value={data.who_answered}
                    onChange={v => {
                      setLiveFieldIssues({})
                      patchAfterChip({
                        who_answered: v,
                        live_history: ['p1'],
                        last_active_card: 'p1',
                        view_card: 'p1',
                        transferred_note: false,
                        ...(v === 'gatekeeper'
                          ? {}
                          : {
                              gatekeeper_result: '',
                              gatekeeper_name: '',
                              gatekeeper_title_key: '',
                            }),
                      })
                    }}
                    options={WHO_ANSWERED_OPTIONS}
                  />
                  {liveFieldIssues.who_answered ? <p className="text-[11px] text-red-400">{liveFieldIssues.who_answered}</p> : null}
                </div>
                {data.who_answered === 'right_person' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Name</Label>
                      <Input
                        className="h-10 border-neutral-800 bg-neutral-950/80"
                        value={data.target_name}
                        onChange={e => patch({ target_name: e.target.value })}
                        placeholder="Type their name if they gave it"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Title</Label>
                      <ContactTitleSelect
                        allowEmpty
                        value={data.target_title_key}
                        onValueChange={key => patch({ target_title_key: key })}
                        placeholder="Select title"
                        triggerClassName="h-10 w-full min-w-0 border-neutral-800 bg-neutral-950/80 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
                {data.who_answered === 'gatekeeper' ? (
                  <div className="space-y-3 border-t border-white/[0.06] pt-3">
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Gatekeeper name</Label>
                      <Input
                        className="h-10 border-neutral-800 bg-neutral-950/80"
                        value={data.gatekeeper_name}
                        onChange={e => patch({ gatekeeper_name: e.target.value })}
                        placeholder="Their name if they gave it"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Gatekeeper title</Label>
                      <ContactTitleSelect
                        allowEmpty
                        value={data.gatekeeper_title_key}
                        onValueChange={key => patch({ gatekeeper_title_key: key })}
                        placeholder="Select title"
                        triggerClassName="h-10 w-full min-w-0 border-neutral-800 bg-neutral-950/80 text-sm"
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            }
          />
        )
      case 'p2a':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <Label className="text-neutral-400 text-xs">What happened?</Label>
                <SelectChipRow
                  value={data.gatekeeper_result}
                  onChange={v => patchAfterChip({ gatekeeper_result: v })}
                  options={GATEKEEPER_RESULT_OPTIONS}
                />
              </div>
            }
          />
        )
      case 'p2a_detail':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
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
                  <Label className="text-neutral-400 text-xs">Their title</Label>
                  <ContactTitleSelect
                    allowEmpty
                    value={data.decision_maker_title_key}
                    onValueChange={key => patch({ decision_maker_title_key: key })}
                    placeholder="Select title"
                    triggerClassName="h-10 w-full min-w-0 border-neutral-800 bg-neutral-950/80 text-sm"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Best time</Label>
                  <SelectChipRow
                    value={data.best_time}
                    onChange={v => patch({ best_time: v, best_time_specific: v !== 'specific' ? '' : data.best_time_specific })}
                    options={BEST_TIME_OPTIONS}
                  />
                  {data.best_time === 'specific' ? (
                    <Input
                      className="h-10 border-neutral-800 bg-neutral-950/80"
                      placeholder="e.g., Tuesday after 2pm"
                      value={data.best_time_specific}
                      onChange={e => patch({ best_time_specific: e.target.value })}
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">Direct line / email</Label>
                  <SelectChipRow
                    value={data.dm_direct_line}
                    onChange={v =>
                      patch({
                        dm_direct_line: v,
                        decision_maker_direct_phone: v === 'email' || v === 'no' ? '' : data.decision_maker_direct_phone,
                        decision_maker_direct_email: v === 'phone' || v === 'no' ? '' : data.decision_maker_direct_email,
                      })
                    }
                    options={DM_DIRECT_LINE_OPTIONS}
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    {data.dm_direct_line === 'phone' || data.dm_direct_line === 'both' ? (
                      <Input
                        className="h-10 min-w-[12rem] flex-1 border-neutral-800 bg-neutral-950/80"
                        type="tel"
                        placeholder="Phone"
                        value={data.decision_maker_direct_phone}
                        onChange={e => patch({ decision_maker_direct_phone: e.target.value })}
                      />
                    ) : null}
                    {data.dm_direct_line === 'email' || data.dm_direct_line === 'both' ? (
                      <Input
                        className="h-10 min-w-[12rem] flex-1 border-neutral-800 bg-neutral-950/80"
                        type="email"
                        placeholder="Email"
                        value={data.decision_maker_direct_email}
                        onChange={e => patch({ decision_maker_direct_email: e.target.value })}
                      />
                    ) : null}
                  </div>
                </div>
              </div>
            }
          />
        )
      case 'p2_msg':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Who took the message?</Label>
                  <Input
                    className="h-10 border-neutral-800 bg-neutral-950/80"
                    placeholder="Name if they gave it"
                    value={data.message_taker_name}
                    onChange={e => patch({ message_taker_name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Callback expected?</Label>
                  <SelectChipRow
                    value={data.callback_expected}
                    onChange={v => patch({ callback_expected: v })}
                    options={[
                      { id: 'yes', label: 'Yes — they’ll call back' },
                      { id: 'no_retry', label: 'No — I’ll try again' },
                    ]}
                  />
                </div>
              </div>
            }
          />
        )
      case 'p3':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-1.5">
                <Label className="text-neutral-400 text-xs">How did they respond?</Label>
                <SelectChipRow
                  value={data.initial_reaction}
                  onChange={v => patchAfterChip({ initial_reaction: v })}
                  options={INITIAL_REACTION_OPTIONS}
                />
              </div>
            }
          />
        )
      case 'p3b':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <SelectChipRow value={data.pivot_response} onChange={v => patchAfterChip({ pivot_response: v })} options={PIVOT_OPTIONS} />
            }
          />
        )
      case 'p3c':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow value={data.parking_result} onChange={v => patchAfterChip({ parking_result: v })} options={PARKING_OPTIONS} />
                <SelectChipRow value={data.send_to} onChange={v => patchAfterChip({ send_to: v })} options={SEND_TO_OPTIONS} />
              </div>
            }
          />
        )
      case 'p4a': {
        const dayLabels = Object.fromEntries([...COLD_CALL_WEEKDAY_LABELS].map(d => [d, d])) as Record<string, string>
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <IntakeCompactChipRow
                  label="What nights?"
                  selected={data.event_nights}
                  ids={COLD_CALL_WEEKDAY_LABELS as unknown as string[]}
                  labels={dayLabels}
                  onChange={next => patchAfterChip({ event_nights: next })}
                />
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Quick note (optional)</Label>
                  <Input
                    className="h-10 border-neutral-800 bg-neutral-950/80"
                    placeholder="e.g., Latin Thursdays, hip-hop Saturdays"
                    value={data.night_details_note}
                    onChange={e => patch({ night_details_note: e.target.value })}
                  />
                </div>
              </div>
            }
          />
        )
      }
      case 'p4b': {
        const ids = MUSIC_VIBE_PRESETS.map(p => p.id)
        const labels = Object.fromEntries(MUSIC_VIBE_PRESETS.map(p => [p.id, p.label])) as Record<string, string>
        const talkingPoints = profile?.tagline?.trim()
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-2">
                <IntakeCompactChipRow label="Vibe" selected={data.venue_vibes} ids={ids} labels={labels} onChange={v => patchAfterChip({ venue_vibes: v })} />
                {talkingPoints ? (
                  <details className="rounded-lg border border-white/[0.08] bg-neutral-950/40 px-3 py-2 text-xs text-neutral-400">
                    <summary className="cursor-pointer select-none text-[11px] font-medium text-neutral-300">
                      If they ask who he is
                    </summary>
                    <p className="mt-2 leading-relaxed text-neutral-400">{talkingPoints}</p>
                  </details>
                ) : null}
              </div>
            }
          />
        )
      }
      case 'p4c':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Who handles booking?</Label>
                  <SelectChipRow
                    value={data.booking_process}
                    onChange={v => {
                      if (v === 'this_person') {
                        patchAfterChip({
                          booking_process: v,
                          decision_maker_same: 'yes',
                          other_dm_name: '',
                          other_dm_title_key: '',
                          other_dm_line: '',
                          other_dm_phone: '',
                          other_dm_email: '',
                        })
                      } else if (v === 'someone_else' || v === 'committee') {
                        patchAfterChip({ booking_process: v, decision_maker_same: '' })
                      } else {
                        patchAfterChip({
                          booking_process: v,
                          decision_maker_same: '',
                          other_dm_name: '',
                          other_dm_title_key: '',
                          other_dm_line: '',
                          other_dm_phone: '',
                          other_dm_email: '',
                        })
                      }
                    }}
                    options={BOOKING_PROCESS_OPTIONS}
                  />
                </div>
                {data.booking_process === 'unsaid' ? (
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Talking to the decision-maker?</Label>
                    <SelectChipRow
                      value={data.decision_maker_same}
                      onChange={v => patchAfterChip({ decision_maker_same: v })}
                      options={DECISION_SAME_OPTIONS}
                    />
                  </div>
                ) : null}
                {data.booking_process === 'someone_else' || data.booking_process === 'committee' ? (
                  <div className="space-y-3 border-t border-white/[0.06] pt-3">
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Who should I talk to?</Label>
                      <Input
                        className="h-10 border-neutral-800 bg-neutral-950/80"
                        placeholder="Name if they gave it"
                        value={data.other_dm_name}
                        onChange={e => patch({ other_dm_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Their title</Label>
                      <ContactTitleSelect
                        allowEmpty
                        value={data.other_dm_title_key}
                        onValueChange={key => patch({ other_dm_title_key: key })}
                        placeholder="Select title"
                        triggerClassName="h-10 w-full min-w-0 border-neutral-800 bg-neutral-950/80 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-neutral-400 text-xs">Contact info?</Label>
                      <SelectChipRow
                        value={data.other_dm_line}
                        onChange={v =>
                          patch({
                            other_dm_line: v,
                            other_dm_phone: v === 'email' || v === 'no' ? '' : data.other_dm_phone,
                            other_dm_email: v === 'phone' || v === 'no' ? '' : data.other_dm_email,
                          })
                        }
                        options={DM_DIRECT_LINE_OPTIONS}
                      />
                      <div className="flex flex-wrap gap-2 items-center">
                        {data.other_dm_line === 'phone' || data.other_dm_line === 'both' ? (
                          <Input
                            className="h-10 min-w-[12rem] flex-1 border-neutral-800 bg-neutral-950/80"
                            type="tel"
                            placeholder="Phone"
                            value={data.other_dm_phone}
                            onChange={e => patch({ other_dm_phone: e.target.value })}
                          />
                        ) : null}
                        {data.other_dm_line === 'email' || data.other_dm_line === 'both' ? (
                          <Input
                            className="h-10 min-w-[12rem] flex-1 border-neutral-800 bg-neutral-950/80"
                            type="email"
                            placeholder="Email"
                            value={data.other_dm_email}
                            onChange={e => patch({ other_dm_email: e.target.value })}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            }
          />
        )
      case 'p4d':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Budget range</Label>
                  <SelectChipRow
                    value={data.budget_range}
                    onChange={v =>
                      patchAfterChip({ budget_range: v, rate_reaction: v === 'no_say' ? 'skipped' : data.rate_reaction })
                    }
                    options={BUDGET_RANGE_OPTIONS}
                  />
                </div>
                {data.budget_range !== 'no_say' ? (
                  <SelectChipRow
                    value={data.rate_reaction}
                    onChange={v => patchAfterChip({ rate_reaction: v })}
                    options={RATE_REACTION_OPTIONS}
                  />
                ) : null}
              </div>
            }
          />
        )
      case 'p4e':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="grid gap-3 sm:grid-cols-2">
                {data.venue_type.trim() || data.capacity_range ? (
                  <p className="text-[11px] text-neutral-500 sm:col-span-2">
                    From your research when set — update if the call changed your read.
                  </p>
                ) : null}
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Capacity</Label>
                  <SelectChipRow value={data.capacity_range} onChange={v => patch({ capacity_range: v })} options={CAPACITY_OPTIONS} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Entity type</Label>
                  <EntityTypeSelect
                    value={data.venue_type_confirm}
                    onValueChange={v =>
                      patch({
                        venue_type_confirm:
                          v && v !== 'all' ? (v as ColdCallVenueTypeConfirm) : ('' as ColdCallVenueTypeConfirm),
                      })
                    }
                    allowEmpty
                    placeholder="Confirm entity type"
                    triggerClassName="min-h-9"
                  />
                </div>
              </div>
            }
          />
        )
      case 'p5':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow
                  value={data.ask_response}
                  onChange={v =>
                    patchAfterChip({
                      ask_response: v,
                      ask_send_channel: '',
                      ask_followup_when: '',
                    })
                  }
                  options={ASK_RESPONSE_OPTIONS}
                />
                {data.ask_response === 'send_info_first' ? (
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Send via</Label>
                    <SelectChipRow
                      value={data.ask_send_channel}
                      onChange={v => patchAfterChip({ ask_send_channel: v })}
                      options={ASK_SEND_CHANNEL_OPTIONS}
                    />
                  </div>
                ) : null}
                {data.ask_response === 'check_back' ? (
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">When should I follow up?</Label>
                    <SelectChipRow
                      value={data.ask_followup_when}
                      onChange={v => patchAfterChip({ ask_followup_when: v })}
                      options={ASK_FOLLOWUP_WHEN_OPTIONS}
                    />
                  </div>
                ) : null}
              </div>
            }
          />
        )
      case 'p6':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <SelectChipRow
                  value={data.call_ended_naturally}
                  onChange={v => patchAfterChip({ call_ended_naturally: v })}
                  options={ENDED_OPTIONS}
                />
                <SelectChipRow
                  value={data.call_duration_feel}
                  onChange={v => patchAfterChip({ call_duration_feel: v })}
                  options={DURATION_OPTIONS}
                />
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
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Voicemail</Label>
                  <SelectChipRow
                    value={data.voicemail_left}
                    onChange={v => patchAfterChip({ voicemail_left: v })}
                    options={[
                      { id: 'left', label: 'Left voicemail' },
                      { id: 'skipped', label: 'Skipped' },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">When to follow up</Label>
                  <SelectChipRow
                    value={data.voicemail_followup_timing}
                    onChange={v => patchAfterChip({ voicemail_followup_timing: v })}
                    options={[
                      { id: 'tomorrow', label: 'Tomorrow' },
                      { id: 'few_days', label: 'In a few days' },
                      { id: 'next_week', label: 'Next week' },
                      { id: 'dont_retry', label: 'Don’t retry' },
                    ]}
                  />
                </div>
                <Button type="button" className="w-full" onClick={() => void handleLiveContinue()}>
                  Continue to post-call
                </Button>
              </div>
            }
          />
        )
      case 'p6_na':
        return (
          <IntakeLiveScriptCaptureStack
            scriptSize="compact"
            stepTitle={liveCardStepTitle(card)}
            script={script}
            capture={
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-neutral-400 text-xs">Try again</Label>
                  <SelectChipRow
                    value={data.no_answer_retry_timing}
                    onChange={v => patchAfterChip({ no_answer_retry_timing: v })}
                    options={[
                      { id: 'later_today', label: 'Later today' },
                      { id: 'tomorrow', label: 'Tomorrow' },
                      { id: 'next_week', label: 'Next week' },
                      { id: 'remove', label: 'Drop this lead' },
                    ]}
                  />
                </div>
                <Button type="button" className="w-full" onClick={() => void handleLiveContinue()}>
                  Continue to post-call
                </Button>
              </div>
            }
          />
        )
      default:
        return null
    }
  })()

  return (
    <div className="h-screen flex flex-col bg-neutral-950 text-neutral-100 overflow-hidden">
      <header className="min-h-12 h-12 sm:h-14 border-b border-neutral-800 flex items-center gap-2 sm:gap-3 px-2 sm:px-4 shrink-0 bg-neutral-950 z-20">
        <Button variant="ghost" size="sm" className="gap-1 text-neutral-400 shrink-0 h-9 w-9 p-0" asChild>
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
            <SelectTrigger
              className="h-9 w-[9.5rem] sm:w-[11rem] shrink-0 border-neutral-800 bg-neutral-900/80 text-sm [&>span]:truncate [&>span]:text-left"
              title={selectedRow.title || 'Switch cold call'}
            >
              <SelectValue placeholder="Calls" />
            </SelectTrigger>
            <SelectContent>
              {cold.calls.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title || 'Untitled'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 shrink-0 border-neutral-700 px-2.5 sm:px-3"
            onClick={() => void handleNew()}
          >
            New
          </Button>
          <Input
            className="h-9 min-w-0 flex-1 border-neutral-800 bg-neutral-900/80 text-sm"
            value={selectedRow.title}
            onChange={e => cold.updateTitle(selectedId!, e.target.value)}
            placeholder="Call title"
            aria-label="Call title"
          />
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {data.session_mode === 'live_call' ? (
            <LiveTemperatureBar
              value={data.operator_temperature}
              score={computeColdCallTemperatureScore(data)}
              manualLock={data.temperature_manual_lock}
              onPick={v => patch({ operator_temperature: v, temperature_manual_lock: true })}
              onResetAuto={() => patch({ temperature_manual_lock: false })}
            />
          ) : data.session_mode === 'post_call' ? (
            <div className="flex items-center gap-1.5">
              <TemperatureMenu
                value={data.final_temperature}
                onChange={v =>
                  patch({
                    final_temperature: v,
                    save_to_pipeline: v === 'dead' ? false : data.save_to_pipeline,
                  })
                }
              />
              <span
                className="text-[10px] text-neutral-500 tabular-nums leading-none whitespace-nowrap hidden sm:inline"
                title={`Auto score ${computeColdCallTemperatureScore(data)}`}
              >
                <span className="text-neutral-600">Score</span>{' '}
                {(() => {
                  const s = computeColdCallTemperatureScore(data)
                  return s > 0 ? `+${s}` : `${s}`
                })()}
              </span>
            </div>
          ) : null}
          {cold.error ? (
            <span className="text-[11px] text-amber-400 max-w-[4.5rem] sm:max-w-[7rem] truncate" title={cold.error}>
              Save issue
            </span>
          ) : null}
          <span className="text-[10px] sm:text-[11px] text-neutral-500 hidden md:inline whitespace-nowrap">
            Auto-saved
          </span>
          <Button type="button" variant="secondary" size="sm" className="h-9 gap-1.5 px-2.5 sm:px-3" disabled={savingUi} onClick={() => void handleSave()}>
            {savingUi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Save</span>
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2.5 sm:px-3 text-neutral-400" onClick={() => void handleExit()}>
            Exit
          </Button>
        </div>
      </header>

      {convertInlineError ? (
        <div className="shrink-0 border-b border-red-900/50 bg-red-950/35 px-4 py-2 text-xs text-red-100">
          {convertInlineError}
        </div>
      ) : null}

      {selectedRow.converted_to_intake_id ? (
        <div className="shrink-0 border-b border-emerald-900/40 bg-emerald-950/30 px-4 py-2.5">
          <p className="text-xs font-semibold text-emerald-100">Converted</p>
          <p className="text-[11px] text-emerald-200/85 mt-0.5">This call has a booking intake linked.</p>
          <Link
            to={`/forms/intake?intakeId=${encodeURIComponent(selectedRow.converted_to_intake_id)}`}
            className="text-[11px] font-medium text-emerald-200 underline underline-offset-2 hover:text-emerald-50 mt-1 inline-block"
          >
            View booking intake →
          </Link>
        </div>
      ) : null}

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
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Essentials</h2>
              <p className="text-xs text-neutral-500">Minimum to dial — add research or a contact below if you have it.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className={cn('space-y-1.5 sm:col-span-2', precallFieldIssues.venue_name && 'rounded-md ring-1 ring-red-500/50 p-2 -m-0.5')}>
                  <Label className="text-neutral-400 text-xs">Venue name *</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    value={data.venue_name}
                    onChange={e => {
                      setPrecallFieldIssues({})
                      patch({ venue_name: e.target.value })
                    }}
                  />
                  {precallFieldIssues.venue_name ? <p className="text-[11px] text-red-400">{precallFieldIssues.venue_name}</p> : null}
                </div>
                <div className={cn('space-y-1.5 sm:col-span-2', precallFieldIssues.target_phone && 'rounded-md ring-1 ring-red-500/50 p-2 -m-0.5')}>
                  <Label className="text-neutral-400 text-xs">Phone number to dial *</Label>
                  <Input
                    className="h-11 border-neutral-800 bg-neutral-950/80"
                    type="tel"
                    value={data.target_phone}
                    onChange={e => {
                      setPrecallFieldIssues({})
                      patch({ target_phone: e.target.value })
                    }}
                  />
                  {precallFieldIssues.target_phone ? <p className="text-[11px] text-red-400">{precallFieldIssues.target_phone}</p> : null}
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-neutral-400 text-xs">City</Label>
                  <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.city} onChange={e => patch({ city: e.target.value })} />
                </div>
                <div className={cn('space-y-1.5 sm:col-span-2', precallFieldIssues.call_purpose && 'rounded-md ring-1 ring-red-500/50 p-2 -m-0.5')}>
                  <Label className="text-neutral-400 text-xs">Why am I calling? *</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {CALL_PURPOSE_TOGGLE.map(o => {
                      const on = data.call_purpose === o.id
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => {
                            setPrecallFieldIssues({})
                            patch({ call_purpose: on ? '' : o.id })
                          }}
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
                  {precallFieldIssues.call_purpose ? <p className="text-[11px] text-red-400">{precallFieldIssues.call_purpose}</p> : null}
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-neutral-200 py-1"
                onClick={() => patch({ pre_call_research_open: !data.pre_call_research_open })}
              >
                <span>Add research (helps personalize the script)</span>
                <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', data.pre_call_research_open ? 'rotate-90' : '')} />
              </button>
              {data.pre_call_research_open ? (
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/[0.06]">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-neutral-400 text-xs">Entity type</Label>
                    <EntityTypeSelect
                      value={
                        data.venue_type.trim() && (VENUE_TYPE_ORDER as string[]).includes(data.venue_type.trim())
                          ? (data.venue_type.trim() as VenueType)
                          : ''
                      }
                      onValueChange={v =>
                        patch({
                          venue_type:
                            v && v !== 'all' ? (v as VenueType) : ('' as ColdCallDataV1['venue_type']),
                        })
                      }
                      allowEmpty
                      placeholder="Search or pick type of client / space"
                      triggerClassName="min-h-11 border-neutral-800 bg-neutral-950/80"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
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
                    <Label className="text-neutral-400 text-xs">Size</Label>
                    <SelectChipRow value={data.capacity_range} onChange={v => patch({ capacity_range: v })} options={CAPACITY_OPTIONS} />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-neutral-400 text-xs">What nights / events?</Label>
                    <Input
                      className="h-11 border-neutral-800 bg-neutral-950/80"
                      placeholder="e.g. Latin Thursdays, hip-hop Saturdays"
                      value={data.known_events}
                      onChange={e => patch({ known_events: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Instagram</Label>
                    <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.social_handle} onChange={e => patch({ social_handle: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Website</Label>
                    <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.website} onChange={e => patch({ website: e.target.value })} />
                  </div>
                </div>
              ) : null}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-3">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 text-left text-sm font-medium text-neutral-200 py-1"
                onClick={() => patch({ pre_call_contact_open: !data.pre_call_contact_open })}
              >
                <span>I have a name or contact</span>
                <ChevronRight className={cn('h-4 w-4 shrink-0 transition-transform', data.pre_call_contact_open ? 'rotate-90' : '')} />
              </button>
              {data.pre_call_contact_open ? (
                <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/[0.06]">
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Contact name</Label>
                    <Input className="h-11 border-neutral-800 bg-neutral-950/80" value={data.target_name} onChange={e => patch({ target_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-neutral-400 text-xs">Title</Label>
                    <ContactTitleSelect
                      allowEmpty
                      value={data.target_title_key}
                      onValueChange={key => patch({ target_title_key: key })}
                      placeholder="Select title"
                      triggerClassName="h-11 w-full min-w-0 border-neutral-800 bg-neutral-950/80 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
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
              ) : null}
            </section>

            <section className="rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 space-y-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Pitch angle</h2>
              <p className="text-sm text-neutral-400 leading-relaxed border border-white/[0.06] rounded-lg px-3 py-2 bg-neutral-950/40">
                I think <span className="text-neutral-100 font-medium">{profile?.artist_name?.trim() || 'your artist'}</span> would be a great fit for{' '}
                <span className="text-neutral-100 font-medium">{data.venue_name.trim() || 'this venue'}</span> because{' '}
                <span className="text-yellow-100/85">(tap a chip or write your own — optional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(COLD_CALL_PITCH_REASON_CHIPS) as string[]).map(id => {
                  const on = data.pitch_reason_chip === id
                  return (
                    <button
                      key={String(id)}
                      type="button"
                      onClick={() =>
                        patch({
                          pitch_reason_chip: on ? '' : id,
                          pitch_reason_custom: '',
                        })
                      }
                      className={cn(
                        'min-h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
                        on
                          ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                          : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                      )}
                    >
                      {COLD_CALL_PITCH_REASON_CHIPS[id]!.label}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={() => patch({ pitch_reason_chip: data.pitch_reason_chip === 'custom' ? '' : 'custom' })}
                  className={cn(
                    'min-h-[32px] px-2.5 py-1.5 text-xs font-medium rounded-md border transition-colors',
                    data.pitch_reason_chip === 'custom'
                      ? 'border-neutral-200 bg-neutral-100 text-neutral-950'
                      : 'border-white/[0.08] bg-neutral-900/50 text-neutral-400 hover:text-neutral-200',
                  )}
                >
                  Custom
                </button>
              </div>
              {data.pitch_reason_chip === 'custom' ? (
                <Input
                  className="h-11 border-neutral-800 bg-neutral-950/80"
                  placeholder="Your reason (one line)"
                  value={data.pitch_reason_custom}
                  onChange={e => patch({ pitch_reason_custom: e.target.value })}
                />
              ) : null}
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
                <Select
                  value={String(Math.min(5, Math.max(1, data.priority || 3)))}
                  onValueChange={v => patch({ priority: Number(v) })}
                >
                  <SelectTrigger className="h-11 border-neutral-800 bg-neutral-950/80">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>
                        {n} star{n !== 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <div className="flex justify-center pt-4">
              <Button
                key={`begin-${continueShake}`}
                type="button"
                size="lg"
                className={cn('min-h-[52px] px-8 bg-red-600 hover:bg-red-700 text-white', continueShake ? 'continue-btn-shake' : undefined)}
                onClick={() => void handleBeginCall()}
              >
                Begin call
              </Button>
            </div>
          </div>
        </div>
      ) : data.session_mode === 'live_call' ? (
        <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
          <aside className="w-full md:w-[248px] shrink-0 border-b md:border-b-0 md:border-r border-neutral-800 flex flex-col py-2 md:py-3 px-2 bg-neutral-950">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500 px-2 mb-1.5 md:mb-2 shrink-0">
              Cold call
            </p>
            <nav className="flex md:flex-col flex-row gap-0.5 md:space-y-0.5 overflow-x-auto md:overflow-y-auto md:overflow-x-visible pb-1 md:pb-0 flex-1 md:min-h-0 -mx-0.5 px-0.5 md:mx-0 md:px-0">
              {LIVE_WAYPOINTS.map((w, idx) => {
                const skipped = coldCallPhaseSkipped(idx, data)
                const onPath = idx <= bookmarkIdx
                const activeView = idx === wIdx
                return (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleJumpWaypoint(idx)}
                    className={cn(
                      'shrink-0 md:w-full rounded-lg px-3 py-2 text-sm border text-left transition-colors flex items-center gap-2',
                      activeView
                        ? 'bg-neutral-100 text-neutral-950 font-semibold border-neutral-200'
                        : 'text-neutral-500 border-transparent hover:border-white/[0.08] hover:bg-neutral-900/50',
                      onPath && !activeView ? cn('border', tempAccentClass(activeTemp)) : '',
                      skipped ? 'opacity-60' : '',
                    )}
                  >
                    <span className="font-mono text-xs w-4 shrink-0">{idx + 1}</span>
                    <span className="flex-1 min-w-0">{w.label}</span>
                    {idx === bookmarkIdx && showJumpReturn ? (
                      <span className="shrink-0 inline-flex" title="Your place in the flow">
                        <Pin className="h-3.5 w-3.5 text-amber-500" aria-hidden />
                      </span>
                    ) : null}
                    {skipped ? <span className="shrink-0 text-neutral-600">⊘</span> : null}
                  </button>
                )
              })}
            </nav>
            {showJumpReturn ? (
              <div className="shrink-0 mt-2 pt-2 border-t border-white/[0.08] px-1">
                <button
                  type="button"
                  onClick={() => handleJumpReturn()}
                  title={`Return to ${liveCardStepTitle(bm)}`}
                  aria-label={`Return to ${liveCardStepTitle(bm)}`}
                  className={cn(
                    'flex h-10 w-full items-center justify-center rounded-lg border-2 border-orange-500',
                    'bg-black text-orange-500 hover:border-orange-400 hover:text-orange-400',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950',
                  )}
                >
                  <Undo2 className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                </button>
              </div>
            ) : null}
          </aside>
          <div className="flex-1 flex flex-col min-w-0 min-h-0 relative">
            <div className="flex min-h-0 flex-1 justify-center overflow-y-auto p-4 pb-24 sm:p-6 items-start">
              <div
                key={`${dc}-${bm}`}
                className="w-full max-w-2xl shrink-0 rounded-xl border border-white/[0.08] bg-neutral-900/40 p-4 sm:p-5 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              >
                {liveSkipBanner ? (
                  <p className="text-[11px] text-amber-200/90 border border-amber-900/50 rounded-lg px-3 py-2 bg-amber-950/30">{liveSkipBanner}</p>
                ) : null}
                {liveFieldIssues.jump ? <p className="text-[11px] text-red-400">{liveFieldIssues.jump}</p> : null}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 border-neutral-700 text-xs" onClick={() => handleLiveBack()}>
                    ← Back
                  </Button>
                </div>
                {liveCapture}
                {dc !== 'p6' && dc !== 'p6_vm' && dc !== 'p6_na' ? (
                  <div className="pt-2 flex flex-col items-end gap-2">
                    {Object.keys(liveFieldIssues).filter(k => k !== 'jump').length ? (
                      <p className="text-[11px] text-red-400 text-right w-full">{Object.values(liveFieldIssues).find(Boolean)}</p>
                    ) : null}
                    <Button
                      key={`cont-${continueShake}`}
                      type="button"
                      className={cn(continueShake ? 'continue-btn-shake' : undefined)}
                      onClick={() => void handleLiveContinue()}
                    >
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
                  <div className="inline-flex rounded-lg border border-white/[0.08] p-0.5 bg-neutral-900/50 gap-0.5 mb-2">
                    <button
                      type="button"
                      onClick={() => patch({ outcome_manual_lock: false, outcome: computeColdCallOutcomeAuto(data) })}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                        !data.outcome_manual_lock ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
                      )}
                    >
                      Auto
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ outcome_manual_lock: true })}
                      className={cn(
                        'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
                        data.outcome_manual_lock ? 'bg-neutral-100 text-neutral-950' : 'text-neutral-400 hover:text-neutral-200',
                      )}
                    >
                      Manual
                    </button>
                  </div>
                  {!data.outcome_manual_lock ? (
                    <div className="rounded-lg border border-white/[0.08] bg-neutral-950/50 px-3 py-2 space-y-1">
                      <p className="text-sm text-neutral-100">
                        {COLD_CALL_OUTCOME_LABELS[computeColdCallOutcomeAuto(data) as Exclude<ColdCallDataV1['outcome'], ''>]}
                      </p>
                      <p className="text-[11px] text-neutral-500">Detected from your answers — switch to Manual if you disagree.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <span className="text-[10px] text-amber-200/90">Manual override</span>
                      <Select
                        value={data.outcome || '__none__'}
                        onValueChange={v => patch({ outcome: v === '__none__' ? '' : (v as ColdCallDataV1['outcome']) })}
                      >
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
                  )}
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
    </div>
  )
}
