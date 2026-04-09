import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Loader2, ClipboardList } from 'lucide-react'
import {
  CANCELLATION_REASON_LABELS,
  PRODUCTION_FRICTION_OPTIONS,
  type CancellationReason,
} from '@/lib/performanceReportV1'
import { PublicFormLayout } from '@/components/public/PublicFormLayout'
import {
  DEFAULT_PUBLIC_FORM_BRANDING,
  mergePublicFormBranding,
  type PublicFormBranding,
} from '@/lib/publicFormBranding'
import { cn } from '@/lib/utils'

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'invalid'

export interface ShowReportFormContext {
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
  /** Deal `gross_amount` on file — prefill gig fee in the wizard when present. */
  dealGrossAmount?: number | null
}

export interface ShowReportWizardProps {
  token: string
  /** Dashboard: skip public GET — context comes from authenticated row. */
  embeddedContext: ShowReportFormContext | null
  submittedBy: 'artist_link' | 'manager_dashboard'
  /** `viewport`: mobile public full-page fixed footer; `embedded`: sticky inside dashboard scroll. */
  footerMode: 'viewport' | 'embedded'
  /** Dashboard form preview: no API calls; success UI only. Requires `embeddedContext`. */
  preview?: boolean
  /** Manual dashboard / preview: not loaded from `get-performance-report`. */
  branding?: PublicFormBranding | null
  onSuccess?: () => void
  onCancel?: () => void
}

const NOTE_CHIP_PRESETS: { id: string; line: string; label: string }[] = [
  { id: 'payment', line: 'Follow up on payment.', label: 'Follow up payment' },
  { id: 'production', line: 'Production or technical notes for the manager.', label: 'Production / tech' },
  { id: 'contract', line: 'Contract or paperwork follow-up.', label: 'Contract / paperwork' },
  { id: 'great', line: 'Great night — want more shows like this.', label: 'Great night' },
]

interface FormAnswers {
  eventHappened: 'yes' | 'no' | 'postponed' | ''
  cancellationReason: CancellationReason | ''
  eventRating: number | null
  /** Exact headcount; null = not entered yet. */
  attendanceCount: number | null
  gigFeeTotal: string
  amountReceived: string
  /** Optional when payment dispute = yes */
  paymentDisputeClaimedAmount: string
  crowdEnergy: 'electric' | 'warm' | 'flat' | 'hostile' | ''
  artistPaidStatus: 'yes' | 'no' | 'partial' | ''
  paymentDispute: 'no' | 'yes' | ''
  /** Merch sales only (not tips / personal cash). */
  merchIncome: 'yes' | 'no' | ''
  merchIncomeAmount: string
  productionIssueLevel: 'none' | 'minor' | 'serious' | ''
  productionFrictionTags: string[]
  venueDelivered: 'yes_good' | 'mostly_off' | 'significant_gaps' | ''
  venueInterest: 'yes' | 'no' | 'unsure' | ''
  relationshipQuality: 'good' | 'neutral' | 'poor' | ''
  rebookingTimeline: 'this_month' | 'this_quarter' | 'later' | 'not_discussed' | ''
  wouldPlayAgain: 'yes' | 'maybe' | 'no' | ''
  referralLead: 'no' | 'yes' | ''
  referralDetail: string
  noteChipIds: string[]
  notesExtra: string
}

const EMPTY: FormAnswers = {
  eventHappened: '',
  cancellationReason: '',
  eventRating: null,
  attendanceCount: null,
  crowdEnergy: '',
  artistPaidStatus: '',
  gigFeeTotal: '',
  amountReceived: '',
  paymentDisputeClaimedAmount: '',
  paymentDispute: '',
  merchIncome: '',
  merchIncomeAmount: '',
  productionIssueLevel: '',
  productionFrictionTags: [],
  venueDelivered: '',
  venueInterest: '',
  relationshipQuality: '',
  rebookingTimeline: '',
  wouldPlayAgain: '',
  referralLead: '',
  referralDetail: '',
  noteChipIds: [],
  notesExtra: '',
}

/** Left (negative) → right (positive); payload `id` values unchanged. */
const CROWD_ENERGY_STEPS: {
  id: Exclude<FormAnswers['crowdEnergy'], ''>
  emoji: string
  label: string
}[] = [
  { id: 'hostile', emoji: '😠', label: 'Hostile' },
  { id: 'flat', emoji: '😑', label: 'Flat' },
  { id: 'warm', emoji: '🙂', label: 'Warm' },
  { id: 'electric', emoji: '⚡', label: 'Electric' },
]

const VENUE_DELIVERED_OPTIONS: { value: FormAnswers['venueDelivered']; label: string }[] = [
  { value: 'yes_good', label: 'Yes — everything was good' },
  { value: 'mostly_off', label: 'Mostly — a few things were off' },
  { value: 'significant_gaps', label: 'No — significant gaps' },
]

type WizardPhase1 =
  | 'rating'
  | 'attendance'
  | 'crowd_energy'
  | 'paid'
  | 'economics'
  | 'dispute'
  | 'supplemental_income'
  | 'production'
  | 'venue_delivered'
  | 'friction'

type WizardVenuePhase =
  | 'venue_int'
  | 'rel'
  | 'timeline'
  | 'play'
  | 'referral'
  | 'referral_detail'
  | 'notes'
  | 'done'

function buildWizardPhase1Flow(a: FormAnswers): WizardPhase1[] {
  const flow: WizardPhase1[] = ['rating', 'attendance', 'crowd_energy', 'paid']
  if (!a.artistPaidStatus) {
    return [...flow, 'economics', 'dispute', 'supplemental_income', 'production', 'venue_delivered', 'friction']
  }
  flow.push('economics', 'dispute', 'supplemental_income', 'production', 'venue_delivered')
  if (a.productionIssueLevel === 'minor' || a.productionIssueLevel === 'serious') flow.push('friction')
  else if (!a.productionIssueLevel) flow.push('friction')
  return flow
}

function buildWizardVenueFlow(a: FormAnswers): Exclude<WizardVenuePhase, 'done'>[] {
  const flow: Exclude<WizardVenuePhase, 'done'>[] = ['venue_int', 'rel']
  if (a.venueInterest === 'yes') flow.push('timeline')
  flow.push('play', 'referral')
  if (a.referralLead === 'yes') flow.push('referral_detail')
  flow.push('notes')
  return flow
}

function wizardStep0Segment(
  step: number,
  a: FormAnswers,
  showEventSections: boolean,
): { completed: number; segmentTotal: number } {
  if (step > 0) {
    return showEventSections ? { completed: 1, segmentTotal: 1 } : { completed: 2, segmentTotal: 2 }
  }
  if (!a.eventHappened) return { completed: 0, segmentTotal: 2 }
  if (a.eventHappened === 'yes') return { completed: 1, segmentTotal: 1 }
  return { completed: a.cancellationReason ? 2 : 1, segmentTotal: 2 }
}

/** Each guided question counts toward progress (not coarse step indices). */
function computeWizardQuestionProgress(
  step: number,
  phase1: WizardPhase1,
  phaseVenue: WizardVenuePhase,
  a: FormAnswers,
  showEventSections: boolean,
): number {
  const s0 = wizardStep0Segment(step, a, showEventSections)
  const phase1Flow = buildWizardPhase1Flow(a)
  const venueFlow = buildWizardVenueFlow(a)
  const phase1Len = showEventSections ? phase1Flow.length : 0
  let phase1Completed = 0
  if (showEventSections && step >= 2) phase1Completed = phase1Flow.length
  else if (showEventSections && step === 1) phase1Completed = Math.max(0, phase1Flow.indexOf(phase1))

  const inVenue = (!showEventSections && step === 1) || (showEventSections && step === 2)
  let venueCompleted = 0
  if (inVenue) {
    if (phaseVenue === 'done') venueCompleted = venueFlow.length
    else {
      const ix = venueFlow.indexOf(phaseVenue as Exclude<WizardVenuePhase, 'done'>)
      venueCompleted = ix < 0 ? 0 : ix
    }
  }

  const total = s0.segmentTotal + phase1Len + venueFlow.length
  const completed = s0.completed + phase1Completed + venueCompleted
  if (total <= 0) return 0
  return Math.min(100, Math.round((completed / total) * 100))
}

function SelectField({
  label, value, onChange, options, required, onPick,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
  /** Guided flow: after a choice is committed */
  onPick?: () => void
}) {
  return (
    <div className="mb-5" role="group" aria-required={required ? true : undefined}>
      <label className="block text-sm font-medium text-white mb-2">
        {label}
        {required ? (
          <>
            <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </>
        ) : null}
      </label>
      <div className="flex flex-col gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onChange(o.value)
              onPick?.()
            }}
            className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
              value === o.value
                ? 'bg-white text-black border-white font-medium'
                : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const RATING_STEPS: { n: number; emoji: string; label: string }[] = [
  { n: 1, emoji: '😟', label: 'Rough' },
  { n: 2, emoji: '😐', label: 'Okay' },
  { n: 3, emoji: '🙂', label: 'Decent' },
  { n: 4, emoji: '😊', label: 'Great' },
  { n: 5, emoji: '🤩', label: 'Amazing' },
]

function CrowdEnergyField({
  value,
  onChange,
}: {
  value: FormAnswers['crowdEnergy']
  onChange: (v: Exclude<FormAnswers['crowdEnergy'], ''>) => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-3">How was the crowd energy?</label>
      <div
        className="relative rounded-xl border border-neutral-700 bg-neutral-950/80 p-1.5 sm:p-2"
        role="radiogroup"
        aria-label="Crowd energy"
      >
        <div
          className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-neutral-700 pointer-events-none hidden sm:block"
          aria-hidden
        />
        <div className="relative flex gap-1 sm:gap-1.5 w-full">
          {CROWD_ENERGY_STEPS.map(({ id, emoji, label }) => (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value === id}
              onClick={() => onChange(id)}
              className={`min-h-[56px] flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg border px-0.5 py-2 transition-all ${
                value === id
                  ? 'bg-white text-black border-white shadow-sm z-[1]'
                  : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:bg-neutral-900'
              }`}
            >
              <span className="text-2xl sm:text-[1.65rem] leading-none select-none" aria-hidden>
                {emoji}
              </span>
              <span className="text-[10px] sm:text-xs mt-1 font-medium leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function RatingField({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-3">How did it go overall?</label>
      <div
        className="relative rounded-xl border border-neutral-700 bg-neutral-950/80 p-1.5 sm:p-2"
        role="radiogroup"
        aria-label="Overall show rating"
      >
        <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-neutral-700 pointer-events-none hidden sm:block" aria-hidden />
        <div className="relative flex gap-1 sm:gap-1.5 w-full">
          {RATING_STEPS.map(({ n, emoji, label }) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              onClick={() => onChange(n)}
              className={`min-h-[56px] flex-1 min-w-0 flex flex-col items-center justify-center rounded-lg border px-0.5 py-2 transition-all ${
                value === n
                  ? 'bg-white text-black border-white shadow-sm z-[1]'
                  : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:bg-neutral-900'
              }`}
            >
              <span className="text-2xl sm:text-[1.65rem] leading-none select-none" aria-hidden>
                {emoji}
              </span>
              <span className="text-[10px] sm:text-xs mt-1 font-medium leading-tight text-center">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const ATTENDANCE_MAX = 999_999

function parseUsd(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, '').trim())
  if (!Number.isFinite(n)) return null
  return Math.round(n * 100) / 100
}

function AttendanceNumberField({
  value,
  onChange,
}: {
  value: number | null
  onChange: (n: number | null) => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2" htmlFor="show-report-attendance-count">
        How many people attended?{' '}
        <span className="text-red-500 font-semibold" aria-hidden="true">*</span>
      </label>
      <p className="text-xs text-neutral-400 mb-2">Exact headcount (0 if empty room).</p>
      <input
        id="show-report-attendance-count"
        type="number"
        min={0}
        max={ATTENDANCE_MAX}
        step={1}
        inputMode="numeric"
        value={value === null ? '' : value}
        onChange={e => {
          const t = e.target.value.trim()
          if (t === '') {
            onChange(null)
            return
          }
          const n = parseInt(t, 10)
          if (!Number.isFinite(n) || n < 0 || n > ATTENDANCE_MAX) return
          onChange(n)
        }}
        placeholder="0"
        className="w-full bg-neutral-950 border border-neutral-600 rounded-lg px-4 py-3 text-white text-sm placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/25"
      />
    </div>
  )
}

function MultiFrictionField({
  tags, onChange, issueLevel,
}: {
  tags: string[]
  onChange: (t: string[]) => void
  issueLevel: string
}) {
  if (!issueLevel || issueLevel === 'none') return null
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        What was a friction point? <span className="text-neutral-300 font-normal">(tap any that apply)</span>
      </label>
      <div className="flex flex-col gap-2">
        {PRODUCTION_FRICTION_OPTIONS.map(o => {
          const on = tags.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onChange(on ? tags.filter(x => x !== o.id) : [...tags, o.id])}
              className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                on ? 'bg-white text-black border-white font-medium' : 'bg-neutral-950 text-neutral-100 border-neutral-600'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function parseMerchDollars(raw: string): number | null {
  const n = parseFloat(raw.replace(/,/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

export function ShowReportWizard({
  token,
  embeddedContext,
  submittedBy,
  footerMode,
  preview = false,
  branding: propsBranding,
  onSuccess,
  onCancel,
}: ShowReportWizardProps) {
  const [state, setState] = useState<FormState>(() => (embeddedContext ? 'form' : 'loading'))
  const [answers, setAnswers] = useState<FormAnswers>(EMPTY)
  const [step, setStep] = useState(0)
  /** Step 0: event vs cancellation question (one screen each). */
  const [phase0, setPhase0] = useState<'event' | 'cancellation'>('event')
  /** Step 1 (event happened): single-question phases. */
  const [phase1, setPhase1] = useState<WizardPhase1>('rating')
  /** Final step (venue / notes / media) — step 2 if event happened, else step 1. */
  const [phaseVenue, setPhaseVenue] = useState<WizardVenuePhase>('venue_int')
  const [fieldError, setFieldError] = useState<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
  const [brandingIn, setBrandingIn] = useState<PublicFormBranding>(() =>
    propsBranding ? mergePublicFormBranding(propsBranding) : DEFAULT_PUBLIC_FORM_BRANDING,
  )
  const [successProgressPct, setSuccessProgressPct] = useState(0)
  const [successFlash, setSuccessFlash] = useState(false)

  const registerRef = useCallback((key: string) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el
  }, [])

  useEffect(() => {
    if (propsBranding) setBrandingIn(mergePublicFormBranding(propsBranding))
  }, [propsBranding])

  useEffect(() => {
    if (state !== 'success') return
    setSuccessProgressPct(100)
    setSuccessFlash(true)
    const t = window.setTimeout(() => {
      setSuccessFlash(false)
      setSuccessProgressPct(0)
    }, 550)
    return () => window.clearTimeout(t)
  }, [state])

  useEffect(() => {
    if (embeddedContext) {
      setState('form')
      if (propsBranding) setBrandingIn(mergePublicFormBranding(propsBranding))
      return
    }
    if (!token) { setState('invalid'); return }
    let cancelled = false
    fetch(`/.netlify/functions/get-performance-report?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setBrandingIn(mergePublicFormBranding(data.branding))
        if (!data.valid) { setState('invalid'); return }
        if (data.submitted) { setState('success'); return }
        if (data.dealGrossAmount != null && Number.isFinite(Number(data.dealGrossAmount))) {
          setAnswers(prev =>
            prev.gigFeeTotal === ''
              ? { ...prev, gigFeeTotal: String(data.dealGrossAmount) }
              : prev,
          )
        }
        setState('form')
      })
      .catch(() => { if (!cancelled) setState('invalid') })
    return () => { cancelled = true }
  }, [
    token,
    embeddedContext?.venueName ?? '',
    embeddedContext?.eventDate ?? '',
    embeddedContext?.dealDescription ?? '',
    embeddedContext?.dealGrossAmount ?? '',
  ])

  useEffect(() => {
    const g = embeddedContext?.dealGrossAmount
    if (g == null || !Number.isFinite(Number(g))) return
    setAnswers(prev => (prev.gigFeeTotal === '' ? { ...prev, gigFeeTotal: String(g) } : prev))
  }, [embeddedContext?.dealGrossAmount])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [phase0, phase1, phaseVenue])

  const showEventSections = answers.eventHappened === 'yes'

  useEffect(() => {
    if (step === 0) setPhase0('event')
    if (step === 1 && showEventSections) setPhase1('rating')
    if (step === 1 && !showEventSections) setPhaseVenue('venue_int')
    if (step === 2) setPhaseVenue('venue_int')
  }, [step, showEventSections])
  const totalSteps = showEventSections ? 3 : 2

  useEffect(() => {
    setStep(s => Math.min(s, totalSteps - 1))
  }, [totalSteps])
  const lastStepIndex = totalSteps - 1
  const isLastStep = step === lastStepIndex

  function set<K extends keyof FormAnswers>(key: K, value: FormAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setFieldError(null)
  }

  function scrollToField(key: string) {
    const el = fieldRefs.current[key]
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function validateStep(s: number): { ok: boolean; field?: string; message?: string } {
    if (s === 0) {
      if (!answers.eventHappened) return { ok: false, field: 'event', message: 'Choose whether the event happened.' }
      if (answers.eventHappened !== 'yes' && !answers.cancellationReason) {
        return { ok: false, field: 'cancellation', message: 'Pick what best describes why the show did not happen as planned.' }
      }
      return { ok: true }
    }

    if (showEventSections && s === 1) {
      const r = answers.eventRating
      if (r == null || !Number.isInteger(r) || r < 1 || r > 5) {
        return { ok: false, field: 'rating', message: 'How did it go overall?' }
      }
      if (
        answers.attendanceCount === null ||
        !Number.isInteger(answers.attendanceCount) ||
        answers.attendanceCount < 0 ||
        answers.attendanceCount > ATTENDANCE_MAX
      ) {
        return { ok: false, field: 'attendance', message: 'Enter how many people attended (exact count).' }
      }
      if (!answers.crowdEnergy) {
        return { ok: false, field: 'crowd_energy', message: 'How was the crowd energy?' }
      }
      if (!answers.artistPaidStatus) return { ok: false, field: 'paid', message: 'Select your payment status from the venue.' }
      const fee = parseUsd(answers.gigFeeTotal)
      const recv = parseUsd(answers.amountReceived)
      if (fee == null || fee <= 0) {
        return { ok: false, field: 'economics', message: 'Enter the total gig fee in USD (exact amount).' }
      }
      if (recv == null || recv < 0) {
        return { ok: false, field: 'economics', message: 'Enter the amount you received in USD.' }
      }
      if (answers.artistPaidStatus === 'no') {
        if (Math.abs(recv) > 0.005) {
          return { ok: false, field: 'economics', message: 'If you were not paid yet, amount received should be $0.' }
        }
      }
      if (answers.artistPaidStatus === 'yes') {
        if (Math.abs(recv - fee) > 0.02) {
          return {
            ok: false,
            field: 'economics',
            message: 'For full payment, amount received should match the total gig fee.',
          }
        }
      }
      if (answers.artistPaidStatus === 'partial') {
        if (recv <= 0.005 || recv >= fee - 0.005) {
          return {
            ok: false,
            field: 'economics',
            message: 'For partial payment, received must be more than $0 and less than the total fee.',
          }
        }
      }
      if (!answers.paymentDispute) {
        return { ok: false, field: 'dispute', message: 'Is the amount the venue owes still what you agreed to?' }
      }
      if (answers.paymentDisputeClaimedAmount.trim()) {
        const c = parseUsd(answers.paymentDisputeClaimedAmount)
        if (c == null || c <= 0) {
          return { ok: false, field: 'dispute', message: 'Disputed “owed” amount must be greater than zero, or leave blank.' }
        }
      }
      if (!answers.merchIncome || (answers.merchIncome !== 'yes' && answers.merchIncome !== 'no')) {
        return { ok: false, field: 'supplemental', message: 'Any merch sales income from the night?' }
      }
      if (answers.merchIncome === 'yes' && parseMerchDollars(answers.merchIncomeAmount) == null) {
        return { ok: false, field: 'supplemental', message: 'Enter how much you made from merch (USD).' }
      }
      if (!answers.productionIssueLevel) return { ok: false, field: 'production', message: 'How were production and safety overall?' }
      if (!answers.venueDelivered) {
        return { ok: false, field: 'venue_delivered', message: 'Did the venue deliver on what they promised?' }
      }
      return { ok: true }
    }

    if ((!showEventSections && s === 1) || (showEventSections && s === 2)) {
      if (!answers.venueInterest) return { ok: false, field: 'venue_int', message: 'Select future booking interest.' }
      if (!answers.relationshipQuality) return { ok: false, field: 'rel', message: 'How was the relationship with the contact?' }
      if (answers.venueInterest === 'yes') {
        if (!answers.rebookingTimeline) {
          return { ok: false, field: 'timeline', message: 'When did the venue hint at booking again?' }
        }
      }
      if (!answers.wouldPlayAgain) return { ok: false, field: 'play_again', message: 'Would you play this venue again?' }
      if (!answers.referralLead) return { ok: false, field: 'referral', message: 'Any other buyer or booker introduced?' }
      return { ok: true }
    }

    return { ok: true }
  }

  function finishEventStep1ToVenue() {
    const v = validateStep(1)
    if (!v.ok) {
      setFieldError(v.message ?? 'Finish this section first.')
      if (v.field) scrollToField(v.field)
      return
    }
    setFieldError(null)
    setStep(2)
  }

  function handleBack() {
    setFieldError(null)
    if (step > 0) setStep(step - 1)
  }

  function buildNotes(): string | null {
    const lines = answers.noteChipIds
      .map(id => NOTE_CHIP_PRESETS.find(p => p.id === id)?.line)
      .filter(Boolean) as string[]
    const extra = answers.notesExtra.trim()
    if (extra) lines.push(extra)
    if (!lines.length) return null
    return lines.join('\n\n')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const v = validateStep(step)
    if (!v.ok) {
      setFieldError(v.message ?? 'Please finish required fields.')
      if (v.field) scrollToField(v.field)
      return
    }
    for (let s = 0; s <= lastStepIndex; s++) {
      const check = validateStep(s)
      if (!check.ok) {
        setStep(s)
        setFieldError(check.message ?? 'Missing answers on an earlier step.')
        if (check.field) scrollToField(check.field)
        return
      }
    }

    if (preview) {
      setState('success')
      return
    }

    setState('submitting')
    const attendanceNum = showEventSections ? answers.attendanceCount : null
    const feeTotalNum = showEventSections ? parseUsd(answers.gigFeeTotal) : null
    const receivedNum = showEventSections ? parseUsd(answers.amountReceived) : null
    const disputeClaimNum =
      showEventSections &&
      answers.paymentDispute === 'yes' &&
      answers.paymentDisputeClaimedAmount.trim()
        ? parseUsd(answers.paymentDisputeClaimedAmount)
        : null

    const payload = {
      token,
      eventHappened: answers.eventHappened,
      eventRating: showEventSections ? answers.eventRating : null,
      attendance: attendanceNum,
      artistPaidStatus: showEventSections ? answers.artistPaidStatus : null,
      feeTotal: feeTotalNum,
      amountReceived: receivedNum,
      paymentDisputeClaimedAmount: disputeClaimNum,
      /** Backward compat: amount received (partial balance tasks, outreach copy). */
      paymentAmount: receivedNum,
      venueInterest: answers.venueInterest,
      relationshipQuality: answers.relationshipQuality,
      notes: buildNotes(),
      mediaLinks: null,
      chasePaymentFollowup: null,
      paymentDispute: showEventSections ? answers.paymentDispute : null,
      productionIssueLevel: showEventSections ? answers.productionIssueLevel : null,
      productionFrictionTags: showEventSections && answers.productionIssueLevel !== 'none'
        ? answers.productionFrictionTags
        : [],
      rebookingTimeline: answers.venueInterest === 'yes' && answers.rebookingTimeline
        ? answers.rebookingTimeline
        : null,
      wantsBookingCall: null,
      wantsManagerVenueContact: null,
      wouldPlayAgain: answers.wouldPlayAgain,
      cancellationReason:
        answers.eventHappened !== 'yes' && answers.cancellationReason
          ? answers.cancellationReason
          : null,
      referralLead: answers.referralLead,
      referralDetail: answers.referralLead === 'yes' ? answers.referralDetail.trim() || null : null,
      crowdEnergy: showEventSections ? answers.crowdEnergy : null,
      merchIncome:
        showEventSections && (answers.merchIncome === 'yes' || answers.merchIncome === 'no')
          ? answers.merchIncome
          : null,
      merchIncomeAmount:
        showEventSections && answers.merchIncome === 'yes'
          ? parseMerchDollars(answers.merchIncomeAmount)
          : null,
      venueDelivered: showEventSections ? answers.venueDelivered : null,
      submittedBy,
    }

    try {
      await fetch('/.netlify/functions/submit-performance-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setState('success')
    } catch {
      setState('success')
    }
  }

  const formProgressPct =
    state === 'form' || state === 'submitting'
      ? computeWizardQuestionProgress(step, phase1, phaseVenue, answers, showEventSections)
      : 0

  const layoutTitle =
    submittedBy === 'manager_dashboard' ? 'Manual show report' : 'Show report'

  const successLayoutTitle = preview
    ? 'Preview complete'
    : submittedBy === 'manager_dashboard'
      ? 'Report saved'
      : 'Thank you'

  const layoutRootDraft = preview
    ? 'min-h-0 flex-1 bg-black text-neutral-50 antialiased'
    : footerMode === 'viewport'
      ? 'min-h-screen bg-black text-neutral-50 antialiased'
      : 'min-h-0 bg-black text-neutral-50 antialiased'

  if (state === 'loading') {
    return (
      <PublicFormLayout
        branding={brandingIn}
        title="Loading"
        progress={0}
        showProgress={false}
        rootClassName={layoutRootDraft}
        mainClassName="flex flex-1 items-center justify-center py-16"
      >
        <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
      </PublicFormLayout>
    )
  }

  if (state === 'invalid') {
    return (
      <div
        className={cn(
          preview ? 'min-h-0 flex-1' : 'min-h-screen',
          'flex items-center justify-center bg-black px-4 text-neutral-50 antialiased',
        )}
      >
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-neutral-700 bg-neutral-800">
            <ClipboardList className="h-5 w-5 text-neutral-300" />
          </div>
          <h1 className="mb-2 text-lg font-semibold text-white">Link no longer valid</h1>
          <p className="text-sm leading-relaxed text-neutral-300">
            This link has expired or is no longer active. Ask your manager to send you an updated one.
          </p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    const isDashboard = submittedBy === 'manager_dashboard'
    return (
      <PublicFormLayout
        branding={brandingIn}
        title={successLayoutTitle}
        progress={successProgressPct}
        progressSuccessFlash={successFlash}
        rootClassName={layoutRootDraft}
        mainClassName="flex flex-1 flex-col items-center justify-center px-0 py-10"
      >
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/25 bg-emerald-500/15">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <p className="text-sm leading-relaxed text-neutral-200">
            {preview
              ? 'Nothing was saved. Pick another form in the dashboard to keep testing.'
              : isDashboard
                ? 'Submitted with the same automations as the artist link (tasks, venue status, notes).'
                : 'Your show report has been received.'}
          </p>
          {!preview && isDashboard && onSuccess ? (
            <button
              type="button"
              onClick={onSuccess}
              className="mt-6 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
            >
              Back to Show Reports
            </button>
          ) : null}
        </div>
      </PublicFormLayout>
    )
  }

  const isVenueStep = (!showEventSections && step === 1) || (showEventSections && step === 2)
  const isEventPaymentStep = Boolean(showEventSections && step === 1)
  const showFooterBar = step > 0 && !isEventPaymentStep && (!isVenueStep || phaseVenue === 'done')
  const venueInterestLabel = showEventSections
    ? 'Did the venue express interest in booking you again?'
    : 'Does this venue still seem interested in working with you in the future?'
  const relationshipLabel = showEventSections
    ? 'How was your relationship with the venue contact?'
    : 'Overall, how was your relationship with the venue contact (before the change of plans)?'

  const footerClass =
    footerMode === 'viewport'
      ? 'fixed bottom-0 left-0 right-0 z-10 border-t border-neutral-700 bg-black/95 p-4 backdrop-blur-sm'
      : 'sticky bottom-0 z-10 mt-8 -mx-4 border-t border-neutral-700 bg-black px-4 py-4'

  return (
    <PublicFormLayout
      branding={brandingIn}
      title={layoutTitle}
      progress={formProgressPct}
      progressSuccessFlash={false}
      rootClassName={layoutRootDraft}
      mainClassName={cn('pt-2', footerMode === 'viewport' ? 'pb-32' : 'pb-24')}
    >
      <div ref={registerRef('header')} className="max-w-md mx-auto w-full">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-4 text-sm font-medium text-neutral-200 hover:text-white"
          >
            ← Cancel
          </button>
        ) : null}
      </div>

        <form className="max-w-md mx-auto w-full" onSubmit={handleSubmit}>
          {step === 0 && phase0 === 'event' ? (
            <div ref={registerRef('event')}>
              <SelectField
                label="Did the event happen as planned?"
                value={answers.eventHappened}
                onChange={v => {
                  set('eventHappened', v as FormAnswers['eventHappened'])
                  if (v === 'yes') {
                    set('cancellationReason', '')
                    setStep(1)
                  } else {
                    setPhase0('cancellation')
                  }
                }}
                required
                options={[
                  { value: 'yes', label: 'Yes, it happened' },
                  { value: 'no', label: 'No, it was cancelled' },
                  { value: 'postponed', label: 'It was postponed' },
                ]}
              />
            </div>
          ) : null}

          {step === 0 && phase0 === 'cancellation' ? (
            <div ref={registerRef('cancellation')}>
              <SelectField
                label="What best describes the situation?"
                value={answers.cancellationReason}
                onChange={v => {
                  set('cancellationReason', v as CancellationReason)
                  setStep(1)
                }}
                required
                options={Object.entries(CANCELLATION_REASON_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </div>
          ) : null}

          {showEventSections && step === 1 ? (
            <>
              {phase1 === 'rating' ? (
                <div ref={registerRef('rating')}>
                  <RatingField
                    value={answers.eventRating}
                    onChange={v => {
                      set('eventRating', v)
                      setPhase1('attendance')
                    }}
                  />
                </div>
              ) : null}

              {phase1 === 'attendance' ? (
                <div ref={registerRef('attendance')}>
                  <AttendanceNumberField
                    value={answers.attendanceCount}
                    onChange={v => set('attendanceCount', v)}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFieldError(null)
                      setPhase1('crowd_energy')
                    }}
                    disabled={state === 'submitting'}
                    className="mt-2 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phase1 === 'crowd_energy' ? (
                <div ref={registerRef('crowd_energy')}>
                  <CrowdEnergyField
                    value={answers.crowdEnergy}
                    onChange={v => {
                      set('crowdEnergy', v)
                      setPhase1('paid')
                    }}
                  />
                </div>
              ) : null}

              {phase1 === 'paid' ? (
                <div ref={registerRef('paid')}>
                  <SelectField
                    label="Did you receive payment from the venue?"
                    value={answers.artistPaidStatus}
                    onChange={v => {
                      const nv = v as FormAnswers['artistPaidStatus']
                      set('artistPaidStatus', nv)
                      if (nv === 'no') {
                        set('amountReceived', '0')
                      } else if (nv === 'yes') {
                        const fee = parseUsd(answers.gigFeeTotal)
                        set('amountReceived', fee != null ? String(fee) : '')
                      } else {
                        set('amountReceived', '')
                      }
                      setPhase1('economics')
                    }}
                    required
                    options={[
                      { value: 'yes', label: 'Yes — paid in full' },
                      { value: 'partial', label: 'Partial payment' },
                      { value: 'no', label: 'Not yet' },
                    ]}
                  />
                </div>
              ) : null}

              {phase1 === 'economics' ? (
                <div ref={registerRef('economics')}>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2" htmlFor="show-report-gig-fee">
                      Total gig fee (USD){' '}
                      <span className="text-neutral-400 font-normal text-xs">— exact amount for this show</span>
                      <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">*</span>
                    </label>
                    {embeddedContext?.dealGrossAmount != null || preview ? (
                      <p className="text-xs text-neutral-400 mb-2">
                        Pre-filled from your booking when available — change if the deal was updated.
                      </p>
                    ) : null}
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 focus-within:ring-2 focus-within:ring-white/25">
                      <span className="text-neutral-400 text-sm shrink-0" aria-hidden="true">
                        $
                      </span>
                      <input
                        id="show-report-gig-fee"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={answers.gigFeeTotal}
                        onChange={e => {
                          const v = e.target.value
                          setAnswers(prev => {
                            const next: FormAnswers = { ...prev, gigFeeTotal: v }
                            if (prev.artistPaidStatus === 'yes') {
                              const f = parseUsd(v)
                              next.amountReceived = f != null ? String(f) : v
                            }
                            return next
                          })
                          setFieldError(null)
                        }}
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-white text-sm outline-none placeholder:text-neutral-500"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-white mb-2" htmlFor="show-report-received">
                      Amount you received from the venue (USD){' '}
                      <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">*</span>
                    </label>
                    <p className="text-xs text-neutral-400 mb-2">
                      {answers.artistPaidStatus === 'yes'
                        ? 'Should match total fee when you were paid in full.'
                        : answers.artistPaidStatus === 'no'
                          ? 'Leave at $0 if nothing has been paid yet.'
                          : 'Enter exactly what the venue paid you so far (partial).'}
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 focus-within:ring-2 focus-within:ring-white/25">
                      <span className="text-neutral-400 text-sm shrink-0" aria-hidden="true">
                        $
                      </span>
                      <input
                        id="show-report-received"
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        readOnly={answers.artistPaidStatus === 'no'}
                        value={answers.amountReceived}
                        onChange={e => set('amountReceived', e.target.value)}
                        placeholder="0.00"
                        className="min-w-0 flex-1 bg-transparent text-white text-sm outline-none placeholder:text-neutral-500 disabled:opacity-70 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const fee = parseUsd(answers.gigFeeTotal)
                      const recv = parseUsd(answers.amountReceived)
                      if (fee == null || fee <= 0) {
                        setFieldError('Enter the total gig fee (greater than zero).')
                        scrollToField('economics')
                        return
                      }
                      if (recv == null || recv < 0) {
                        setFieldError('Enter the amount received (0 or more).')
                        scrollToField('economics')
                        return
                      }
                      if (answers.artistPaidStatus === 'no' && Math.abs(recv) > 0.005) {
                        setFieldError('Amount received should be $0 when you were not paid yet.')
                        scrollToField('economics')
                        return
                      }
                      if (answers.artistPaidStatus === 'yes' && Math.abs(recv - fee) > 0.02) {
                        setFieldError('For full payment, amount received must match total fee.')
                        scrollToField('economics')
                        return
                      }
                      if (
                        answers.artistPaidStatus === 'partial' &&
                        (recv <= 0.005 || recv >= fee - 0.005)
                      ) {
                        setFieldError('For partial payment, received must be between $0 and the total fee.')
                        scrollToField('economics')
                        return
                      }
                      setFieldError(null)
                      setPhase1('dispute')
                    }}
                    className="w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phase1 === 'dispute' ? (
                <div ref={registerRef('dispute')}>
                  <div className="mb-5" role="group" aria-required>
                    <label className="block text-sm font-medium text-white mb-2">
                      Is the amount the venue owes still what you agreed to?
                      <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">*</span>
                    </label>
                    <p className="text-xs text-neutral-400 mb-3">
                      This is about the contract number, not tips or personal cash.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          set('paymentDispute', 'no')
                          set('paymentDisputeClaimedAmount', '')
                          setPhase1('supplemental_income')
                        }}
                        className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                          answers.paymentDispute === 'no'
                            ? 'bg-white text-black border-white font-medium'
                            : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white'
                        }`}
                      >
                        Yes — matches the deal
                      </button>
                      <button
                        type="button"
                        onClick={() => set('paymentDispute', 'yes')}
                        className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
                          answers.paymentDispute === 'yes'
                            ? 'bg-white text-black border-white font-medium'
                            : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white'
                        }`}
                      >
                        No — there is a disagreement
                      </button>
                    </div>
                  </div>
                  {answers.paymentDispute === 'yes' ? (
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-white mb-2" htmlFor="show-report-dispute-claim">
                        What total fee do you believe you are owed? (USD){' '}
                        <span className="text-neutral-400 font-normal text-xs">(optional)</span>
                      </label>
                      <div className="flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 focus-within:ring-2 focus-within:ring-white/25">
                        <span className="text-neutral-400 text-sm shrink-0" aria-hidden="true">
                          $
                        </span>
                        <input
                          id="show-report-dispute-claim"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          value={answers.paymentDisputeClaimedAmount}
                          onChange={e => set('paymentDisputeClaimedAmount', e.target.value)}
                          placeholder="If different from the total above"
                          className="min-w-0 flex-1 bg-transparent text-white text-sm outline-none placeholder:text-neutral-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (answers.paymentDisputeClaimedAmount.trim()) {
                            const c = parseUsd(answers.paymentDisputeClaimedAmount)
                            if (c == null || c <= 0) {
                              setFieldError('Enter a positive dollar amount, or clear the field.')
                              scrollToField('dispute')
                              return
                            }
                          }
                          setFieldError(null)
                          setPhase1('supplemental_income')
                        }}
                        className="mt-4 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                      >
                        Continue
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {phase1 === 'supplemental_income' ? (
                <div ref={registerRef('supplemental')}>
                  {answers.merchIncome !== 'yes' ? (
                    <div className="mb-5" role="group" aria-required>
                      <label className="block text-sm font-medium text-white mb-2">
                        Any merch sales income from the night?
                        <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">
                          *
                        </span>
                        <span className="sr-only">(required)</span>
                      </label>
                      <p className="text-xs text-neutral-400 mb-3">
                        Tips or personal DJ cash — skip that. We only track merch here.
                      </p>
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            set('merchIncome', 'no')
                            set('merchIncomeAmount', '')
                            setPhase1('production')
                          }}
                          className="min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white"
                        >
                          No
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            set('merchIncome', 'yes')
                          }}
                          className="min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white"
                        >
                          Yes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-5">
                      <label
                        htmlFor="show-report-merch-amount"
                        className="block text-sm font-medium text-white mb-2"
                      >
                        How much did you make from merch (USD)?
                        <span className="text-red-500 ml-0.5 font-semibold" aria-hidden="true">
                          *
                        </span>
                        <span className="sr-only">(required)</span>
                      </label>
                      <div className="flex items-center gap-2 rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 focus-within:ring-2 focus-within:ring-white/25">
                        <span className="text-neutral-400 text-sm shrink-0" aria-hidden="true">
                          $
                        </span>
                        <input
                          id="show-report-merch-amount"
                          type="text"
                          inputMode="decimal"
                          autoComplete="off"
                          placeholder="0"
                          value={answers.merchIncomeAmount}
                          onChange={e => set('merchIncomeAmount', e.target.value)}
                          className="min-w-0 flex-1 bg-transparent text-white text-sm outline-none placeholder:text-neutral-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (parseMerchDollars(answers.merchIncomeAmount) == null) {
                            setFieldError('Enter how much you made from merch (greater than zero).')
                            scrollToField('supplemental')
                            return
                          }
                          setFieldError(null)
                          setPhase1('production')
                        }}
                        className="mt-4 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                      >
                        Continue
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFieldError(null)
                          set('merchIncome', '')
                          set('merchIncomeAmount', '')
                        }}
                        className="mt-3 text-sm text-neutral-400 hover:text-neutral-200"
                      >
                        Back to yes / no
                      </button>
                    </div>
                  )}
                </div>
              ) : null}

              {phase1 === 'production' ? (
                <div ref={registerRef('production')}>
                  <SelectField
                    label="Production, sound, and safety overall"
                    value={answers.productionIssueLevel}
                    onChange={v => {
                      const level = v as FormAnswers['productionIssueLevel']
                      set('productionIssueLevel', level)
                      if (level === 'none') {
                        set('productionFrictionTags', [])
                      }
                      setPhase1('venue_delivered')
                    }}
                    required
                    options={[
                      { value: 'none', label: 'Smooth — no real issues' },
                      { value: 'minor', label: 'Minor annoyances only' },
                      { value: 'serious', label: 'Serious problem — manager should know' },
                    ]}
                  />
                </div>
              ) : null}

              {phase1 === 'venue_delivered' ? (
                <div ref={registerRef('venue_delivered')}>
                  <SelectField
                    label="Did the venue deliver on what they promised? (sound, green room, parking, etc.)"
                    value={answers.venueDelivered}
                    onChange={v => set('venueDelivered', v as FormAnswers['venueDelivered'])}
                    onPick={() => {
                      if (answers.productionIssueLevel === 'minor' || answers.productionIssueLevel === 'serious') {
                        setPhase1('friction')
                      } else {
                        finishEventStep1ToVenue()
                      }
                    }}
                    required
                    options={VENUE_DELIVERED_OPTIONS}
                  />
                </div>
              ) : null}

              {phase1 === 'friction' ? (
                <div className="mb-5">
                  <MultiFrictionField
                    tags={answers.productionFrictionTags}
                    onChange={t => set('productionFrictionTags', t)}
                    issueLevel={answers.productionIssueLevel}
                  />
                  <button
                    type="button"
                    onClick={() => finishEventStep1ToVenue()}
                    className="mt-4 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {((!showEventSections && step === 1) || (showEventSections && step === 2)) ? (
            <>
              {phaseVenue === 'venue_int' ? (
                <div ref={registerRef('venue_int')}>
                  <SelectField
                    label={venueInterestLabel}
                    value={answers.venueInterest}
                    onChange={v => {
                      const nv = v as FormAnswers['venueInterest']
                      set('venueInterest', nv)
                      if (nv !== 'yes') {
                        set('rebookingTimeline', '')
                      }
                      setPhaseVenue('rel')
                    }}
                    required
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'unsure', label: 'Not sure yet' },
                      { value: 'no', label: 'No / not interested' },
                    ]}
                  />
                </div>
              ) : null}

              {phaseVenue === 'rel' ? (
                <div ref={registerRef('rel')}>
                  <SelectField
                    label={relationshipLabel}
                    value={answers.relationshipQuality}
                    onChange={v => {
                      set('relationshipQuality', v as FormAnswers['relationshipQuality'])
                      setPhaseVenue(answers.venueInterest === 'yes' ? 'timeline' : 'play')
                    }}
                    required
                    options={[
                      { value: 'good', label: 'Good — solid connection' },
                      { value: 'neutral', label: 'Neutral — professional' },
                      { value: 'poor', label: 'Poor — difficult' },
                    ]}
                  />
                </div>
              ) : null}

              {phaseVenue === 'timeline' && answers.venueInterest === 'yes' ? (
                <div ref={registerRef('timeline')}>
                  <SelectField
                    label="When did they hint at booking you again?"
                    value={answers.rebookingTimeline}
                    onChange={v => {
                      set('rebookingTimeline', v as FormAnswers['rebookingTimeline'])
                      setPhaseVenue('play')
                    }}
                    required
                    options={[
                      { value: 'this_month', label: 'Soon — this month' },
                      { value: 'this_quarter', label: 'This season / few months' },
                      { value: 'later', label: 'Later / no rush' },
                      { value: 'not_discussed', label: 'We did not really discuss timing' },
                    ]}
                  />
                </div>
              ) : null}

              {phaseVenue === 'play' ? (
                <div ref={registerRef('play_again')}>
                  <SelectField
                    label="Would you play this venue again?"
                    value={answers.wouldPlayAgain}
                    onChange={v => {
                      set('wouldPlayAgain', v as FormAnswers['wouldPlayAgain'])
                      setPhaseVenue('referral')
                    }}
                    required
                    options={[
                      { value: 'yes', label: 'Yes' },
                      { value: 'maybe', label: 'Maybe' },
                      { value: 'no', label: 'No' },
                    ]}
                  />
                </div>
              ) : null}

              {phaseVenue === 'referral' ? (
                <div ref={registerRef('referral')}>
                  <SelectField
                    label="Did anyone else at the show express interest in booking you?"
                    value={answers.referralLead}
                    onChange={v => {
                      const nv = v as FormAnswers['referralLead']
                      set('referralLead', nv)
                      if (nv === 'yes') {
                        setPhaseVenue('referral_detail')
                      } else {
                        set('referralDetail', '')
                        setPhaseVenue('notes')
                      }
                    }}
                    required
                    options={[
                      { value: 'no', label: 'No' },
                      { value: 'yes', label: 'Yes — possible referral' },
                    ]}
                  />
                </div>
              ) : null}

              {phaseVenue === 'referral_detail' ? (
                <div ref={registerRef('referral_detail')}>
                  <label className="block text-sm font-medium text-white mb-2">
                    Who showed interest? Drop whatever you remember.{' '}
                    <span className="text-neutral-300 font-normal">(optional)</span>
                  </label>
                  <textarea
                    value={answers.referralDetail}
                    onChange={e => set('referralDetail', e.target.value)}
                    rows={3}
                    placeholder="Name, venue, phone, IG — anything helps"
                    className="w-full bg-neutral-950 border border-neutral-600 rounded-lg px-4 py-3 text-white text-sm resize-none placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/25 mb-4"
                  />
                  <button
                    type="button"
                    onClick={() => setPhaseVenue('notes')}
                    className="w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phaseVenue === 'notes' ? (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-white mb-2">
                    Quick notes for your manager <span className="text-neutral-300 font-normal">(optional)</span>
                  </label>
                  <p className="text-xs font-medium text-neutral-400 mb-2">Tap shortcuts or add a line below — no need to type unless you want.</p>
                  <div className="flex flex-col gap-2 mb-3">
                    {NOTE_CHIP_PRESETS.map(p => {
                      const on = answers.noteChipIds.includes(p.id)
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            set(
                              'noteChipIds',
                              on ? answers.noteChipIds.filter(x => x !== p.id) : [...answers.noteChipIds, p.id],
                            )
                          }}
                          className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm ${
                            on ? 'bg-white text-black border-white' : 'bg-neutral-950 text-neutral-100 border-neutral-600'
                          }`}
                        >
                          {p.label}
                        </button>
                      )
                    })}
                  </div>
                  <textarea
                    value={answers.notesExtra}
                    onChange={e => set('notesExtra', e.target.value)}
                    rows={2}
                    placeholder="Anything else (optional)..."
                    className="w-full bg-neutral-950 border border-neutral-600 rounded-lg px-4 py-3 text-white text-sm resize-none placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/25"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFieldError(null)
                      setPhaseVenue('done')
                    }}
                    className="mt-4 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phaseVenue === 'done' ? (
                <p className="text-sm text-neutral-200 mb-4">
                  You&apos;re all set — submit your report below.
                </p>
              ) : null}
            </>
          ) : null}

          {fieldError && (
            <p className="text-red-400 text-sm mb-4" role="alert">{fieldError}</p>
          )}

          {showFooterBar ? (
            <div className={footerClass}>
              <div className="max-w-md mx-auto flex gap-3">
                {step > 0 ? (
                  <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 min-h-[48px] rounded-lg border border-neutral-600 text-neutral-200 text-sm font-medium hover:bg-neutral-900"
                  >
                    Back
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={state === 'submitting' || (isLastStep && isVenueStep && phaseVenue !== 'done')}
                  className="flex-[2] min-h-[48px] bg-white hover:bg-neutral-100 text-black font-semibold text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {state === 'submitting' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    'Submit report'
                  )}
                </button>
              </div>
            </div>
          ) : null}
        </form>

        {!preview ? (
          <p className="mx-auto mt-4 w-full max-w-md pb-4 text-center text-xs font-medium text-neutral-400">
            {submittedBy === 'manager_dashboard'
              ? 'Same automations apply as when the artist submits the public link.'
              : 'One-time link. Your answers go to your manager only.'}
          </p>
        ) : null}
    </PublicFormLayout>
  )
}
