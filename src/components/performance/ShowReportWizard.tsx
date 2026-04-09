import { useState, useEffect, useRef, useCallback } from 'react'
import { CheckCircle2, Loader2, ClipboardList } from 'lucide-react'
import {
  ATTENDANCE_BAND_TO_NUMBER,
  CANCELLATION_REASON_LABELS,
  PARTIAL_PAYMENT_PRESETS,
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
  attendanceBand: string
  crowdEnergy: 'electric' | 'warm' | 'flat' | 'hostile' | ''
  artistPaidStatus: 'yes' | 'no' | 'partial' | ''
  paymentPreset: string
  paymentAmount: string
  chasePaymentFollowup: 'no' | 'unsure' | 'yes' | ''
  paymentDispute: 'no' | 'yes' | ''
  supplementalIncome: 'none' | 'under_50' | '50_150' | 'over_150' | ''
  productionIssueLevel: 'none' | 'minor' | 'serious' | ''
  productionFrictionTags: string[]
  venueDelivered: 'yes_good' | 'mostly_off' | 'significant_gaps' | ''
  venueInterest: 'yes' | 'no' | 'unsure' | ''
  relationshipQuality: 'good' | 'neutral' | 'poor' | ''
  rebookingTimeline: 'this_month' | 'this_quarter' | 'later' | 'not_discussed' | ''
  wantsBookingCall: 'no' | 'yes' | ''
  wouldPlayAgain: 'yes' | 'maybe' | 'no' | ''
  wantsManagerVenueContact: 'no' | 'yes' | ''
  referralLead: 'no' | 'yes' | ''
  referralDetail: string
  noteChipIds: string[]
  notesExtra: string
  mediaChoice: 'unset' | 'none' | 'links'
  mediaLinks: string
}

const EMPTY: FormAnswers = {
  eventHappened: '',
  cancellationReason: '',
  eventRating: null,
  attendanceBand: '',
  crowdEnergy: '',
  artistPaidStatus: '',
  paymentPreset: '',
  paymentAmount: '',
  chasePaymentFollowup: '',
  paymentDispute: '',
  supplementalIncome: '',
  productionIssueLevel: '',
  productionFrictionTags: [],
  venueDelivered: '',
  venueInterest: '',
  relationshipQuality: '',
  rebookingTimeline: '',
  wantsBookingCall: '',
  wouldPlayAgain: '',
  wantsManagerVenueContact: '',
  referralLead: '',
  referralDetail: '',
  noteChipIds: [],
  notesExtra: '',
  mediaChoice: 'unset',
  mediaLinks: '',
}

const CROWD_ENERGY_OPTIONS: { value: FormAnswers['crowdEnergy']; label: string }[] = [
  { value: 'electric', label: 'Electric — they were into it' },
  { value: 'warm', label: 'Warm — decent energy' },
  { value: 'flat', label: 'Flat — tough crowd' },
  { value: 'hostile', label: 'Hostile — rough night' },
]

const SUPPLEMENTAL_INCOME_OPTIONS: { value: FormAnswers['supplementalIncome']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'under_50', label: 'Under $50' },
  { value: '50_150', label: '$50–$150' },
  { value: 'over_150', label: '$150+' },
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
  | 'partial'
  | 'chase'
  | 'dispute'
  | 'supplemental_income'
  | 'production'
  | 'venue_delivered'
  | 'friction'

type WizardVenuePhase =
  | 'venue_int'
  | 'rel'
  | 'timeline'
  | 'booking_call'
  | 'play'
  | 'mgr'
  | 'referral'
  | 'referral_detail'
  | 'notes'
  | 'media'
  | 'done'

function buildWizardPhase1Flow(a: FormAnswers): WizardPhase1[] {
  const flow: WizardPhase1[] = ['rating', 'attendance', 'crowd_energy', 'paid']
  if (!a.artistPaidStatus) {
    return [...flow, 'partial', 'chase', 'dispute', 'supplemental_income', 'production', 'venue_delivered', 'friction']
  }
  if (a.artistPaidStatus === 'partial') flow.push('partial', 'chase')
  else if (a.artistPaidStatus === 'no') flow.push('chase')
  flow.push('dispute', 'supplemental_income', 'production', 'venue_delivered')
  if (a.productionIssueLevel === 'minor' || a.productionIssueLevel === 'serious') flow.push('friction')
  else if (!a.productionIssueLevel) flow.push('friction')
  return flow
}

function buildWizardVenueFlow(a: FormAnswers): Exclude<WizardVenuePhase, 'done'>[] {
  const flow: Exclude<WizardVenuePhase, 'done'>[] = ['venue_int', 'rel']
  if (a.venueInterest === 'yes') flow.push('timeline', 'booking_call')
  else if (!a.venueInterest) flow.push('timeline', 'booking_call')
  flow.push('play', 'mgr', 'referral')
  if (a.referralLead === 'yes') flow.push('referral_detail')
  flow.push('notes', 'media')
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

const RATING_ROWS: { n: number; hint: string }[][] = [
  [
    { n: 1, hint: 'Rough' },
    { n: 2, hint: 'Okay' },
    { n: 3, hint: 'Decent' },
  ],
  [
    { n: 4, hint: 'Great' },
    { n: 5, hint: 'Amazing' },
  ],
]

function RatingField({
  value,
  onChange,
  onSkip,
}: {
  value: number | null
  onChange: (v: number) => void
  /** One-question flow: skip without choosing a score */
  onSkip?: () => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        How did it go overall? <span className="text-neutral-300 font-normal">(optional)</span>
      </label>
      <div className="flex flex-col gap-2">
        {RATING_ROWS.map((row, ri) => (
          <div key={ri} className="flex gap-2">
            {row.map(({ n, hint }) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`min-h-[48px] flex-1 flex flex-col items-center justify-center rounded-lg border text-sm transition-all ${
                  value === n
                    ? 'bg-white text-black border-white font-semibold'
                    : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{n}</span>
                <span className="text-[10px] mt-0.5 opacity-80">{hint}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      {onSkip ? (
        <button
          type="button"
          onClick={onSkip}
          className="mt-3 text-sm font-medium text-neutral-200 hover:text-white"
        >
          Skip for now
        </button>
      ) : null}
    </div>
  )
}

const ATTENDANCE_BANDS = [
  { value: 'under_50', label: 'Under 50' },
  { value: '50_150', label: '50 – 150' },
  { value: '150_300', label: '150 – 300' },
  { value: '300_500', label: '300 – 500' },
  { value: 'over_500', label: '500+' },
  { value: 'skip', label: 'Rather not say' },
] as const

function ChipGrid({
  label, value, onChange, options, optional, onPick,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  optional?: boolean
  onPick?: () => void
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        {label}
        {optional && <span className="text-neutral-300 ml-1 font-normal">(optional)</span>}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => {
              onChange(o.value)
              onPick?.()
            }}
            className={`min-h-[44px] px-3 py-2.5 rounded-lg border text-sm text-center transition-all ${
              value === o.value
                ? 'bg-white text-black border-white font-medium'
                : 'bg-neutral-950 text-neutral-100 border-neutral-600 hover:border-neutral-500'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
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
        setState('form')
      })
      .catch(() => { if (!cancelled) setState('invalid') })
    return () => { cancelled = true }
  }, [
    token,
    embeddedContext?.venueName ?? '',
    embeddedContext?.eventDate ?? '',
    embeddedContext?.dealDescription ?? '',
  ])

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
      if (!answers.crowdEnergy) {
        return { ok: false, field: 'crowd_energy', message: 'How was the crowd energy?' }
      }
      if (!answers.artistPaidStatus) return { ok: false, field: 'paid', message: 'Select your payment status from the venue.' }
      if (answers.artistPaidStatus === 'partial') {
        if (answers.paymentPreset === 'other' && !answers.paymentAmount.trim()) {
          return { ok: false, field: 'partial_amt', message: 'Enter the partial payment amount (or pick a preset above).' }
        }
        if (!answers.paymentPreset) {
          return { ok: false, field: 'partial_amt', message: 'Pick about how much you received (or Other).' }
        }
      }
      if (answers.artistPaidStatus !== 'yes' && !answers.chasePaymentFollowup) {
        return { ok: false, field: 'chase', message: 'Let your manager know if they should help chase payment.' }
      }
      if (!answers.paymentDispute) return { ok: false, field: 'dispute', message: 'Is the amount owed still correct?' }
      if (!answers.supplementalIncome) {
        return { ok: false, field: 'supplemental', message: 'Any tips or merch income from the night?' }
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
        if (!answers.wantsBookingCall) {
          return { ok: false, field: 'booking_call', message: 'Should your manager schedule the next booking conversation?' }
        }
      }
      if (!answers.wouldPlayAgain) return { ok: false, field: 'play_again', message: 'Would you play this venue again?' }
      if (!answers.wantsManagerVenueContact) {
        return { ok: false, field: 'mgr_contact', message: 'Should your manager reach out to the venue for you?' }
      }
      if (!answers.referralLead) return { ok: false, field: 'referral', message: 'Any other buyer or booker introduced?' }
      if (answers.mediaChoice === 'unset') {
        return { ok: false, field: 'media', message: 'Tap “No media” or add links below.' }
      }
      if (answers.mediaChoice === 'links' && !answers.mediaLinks.trim()) {
        return { ok: false, field: 'media', message: 'Paste at least one link, or choose “No media”.' }
      }
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

  function resolvePaymentAmount(): number | null {
    if (answers.artistPaidStatus !== 'partial') return null
    const preset = PARTIAL_PAYMENT_PRESETS.find(p => p.value === answers.paymentPreset)
    if (preset?.amount != null) return preset.amount
    const n = parseFloat(answers.paymentAmount)
    return Number.isFinite(n) ? n : null
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
    const attendanceNum =
      showEventSections && answers.attendanceBand && answers.attendanceBand !== 'skip'
        ? ATTENDANCE_BAND_TO_NUMBER[answers.attendanceBand] ?? null
        : null

    const payload = {
      token,
      eventHappened: answers.eventHappened,
      eventRating: showEventSections ? answers.eventRating : null,
      attendance: attendanceNum,
      artistPaidStatus: showEventSections ? answers.artistPaidStatus : null,
      paymentAmount: resolvePaymentAmount(),
      venueInterest: answers.venueInterest,
      relationshipQuality: answers.relationshipQuality,
      notes: buildNotes(),
      mediaLinks: answers.mediaChoice === 'none' ? null : answers.mediaLinks.trim() || null,
      chasePaymentFollowup: showEventSections
        ? (answers.artistPaidStatus === 'yes' ? 'no' : answers.chasePaymentFollowup)
        : null,
      paymentDispute: showEventSections ? answers.paymentDispute : null,
      productionIssueLevel: showEventSections ? answers.productionIssueLevel : null,
      productionFrictionTags: showEventSections && answers.productionIssueLevel !== 'none'
        ? answers.productionFrictionTags
        : [],
      rebookingTimeline: answers.venueInterest === 'yes' && answers.rebookingTimeline
        ? answers.rebookingTimeline
        : null,
      wantsBookingCall: answers.venueInterest === 'yes' ? answers.wantsBookingCall : null,
      wantsManagerVenueContact: answers.wantsManagerVenueContact,
      wouldPlayAgain: answers.wouldPlayAgain,
      cancellationReason:
        answers.eventHappened !== 'yes' && answers.cancellationReason
          ? answers.cancellationReason
          : null,
      referralLead: answers.referralLead,
      referralDetail: answers.referralLead === 'yes' ? answers.referralDetail.trim() || null : null,
      crowdEnergy: showEventSections ? answers.crowdEnergy : null,
      supplementalIncome: showEventSections ? answers.supplementalIncome : null,
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

  const showPaymentChip = showEventSections && answers.artistPaidStatus === 'partial'

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
                <RatingField
                  value={answers.eventRating}
                  onChange={v => {
                    set('eventRating', v)
                    setPhase1('attendance')
                  }}
                  onSkip={() => setPhase1('attendance')}
                />
              ) : null}

              {phase1 === 'attendance' ? (
                <ChipGrid
                  label="About how many people attended?"
                  value={answers.attendanceBand}
                  onChange={v => set('attendanceBand', v)}
                  options={[...ATTENDANCE_BANDS]}
                  optional
                  onPick={() => setPhase1('crowd_energy')}
                />
              ) : null}

              {phase1 === 'crowd_energy' ? (
                <div ref={registerRef('crowd_energy')}>
                  <SelectField
                    label="How was the crowd energy?"
                    value={answers.crowdEnergy}
                    onChange={v => set('crowdEnergy', v as FormAnswers['crowdEnergy'])}
                    onPick={() => setPhase1('paid')}
                    required
                    options={CROWD_ENERGY_OPTIONS}
                  />
                </div>
              ) : null}

              {phase1 === 'paid' ? (
                <div ref={registerRef('paid')}>
                  <SelectField
                    label="Did you receive payment from the venue?"
                    value={answers.artistPaidStatus}
                    onChange={v => {
                      set('artistPaidStatus', v as FormAnswers['artistPaidStatus'])
                      if (v !== 'partial') {
                        set('paymentPreset', '')
                        set('paymentAmount', '')
                      }
                      if (v === 'yes') setPhase1('dispute')
                      else if (v === 'partial') setPhase1('partial')
                      else setPhase1('chase')
                    }}
                    required
                    options={[
                      { value: 'yes', label: 'Yes, full payment' },
                      { value: 'partial', label: 'Partial payment' },
                      { value: 'no', label: 'Not yet / no' },
                    ]}
                  />
                </div>
              ) : null}

              {phase1 === 'partial' && showPaymentChip ? (
                <div ref={registerRef('partial_amt')}>
                  <label className="block text-sm font-medium text-white mb-2">About how much did you receive? ($)</label>
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {PARTIAL_PAYMENT_PRESETS.map(p => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => {
                          set('paymentPreset', p.value)
                          if (p.amount != null) set('paymentAmount', '')
                        }}
                        className={`min-h-[44px] px-2 py-2 rounded-lg border text-xs sm:text-sm transition-all ${
                          answers.paymentPreset === p.value
                            ? 'bg-white text-black border-white font-medium'
                            : 'bg-neutral-950 text-neutral-100 border-neutral-600'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {answers.paymentPreset === 'other' ? (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={answers.paymentAmount}
                      onChange={e => set('paymentAmount', e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-neutral-950 border border-neutral-600 rounded-lg px-4 py-3 text-white text-sm mb-4 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/25"
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (!answers.paymentPreset) {
                        setFieldError('Pick about how much you received (or Other).')
                        scrollToField('partial_amt')
                        return
                      }
                      if (answers.paymentPreset === 'other' && !answers.paymentAmount.trim()) {
                        setFieldError('Enter the partial payment amount.')
                        scrollToField('partial_amt')
                        return
                      }
                      setFieldError(null)
                      setPhase1('chase')
                    }}
                    className="w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phase1 === 'chase' &&
              showEventSections &&
              answers.artistPaidStatus &&
              answers.artistPaidStatus !== 'yes' ? (
                <div ref={registerRef('chase')}>
                  <SelectField
                    label="Should your manager help chase payment from the venue?"
                    value={answers.chasePaymentFollowup}
                    onChange={v => set('chasePaymentFollowup', v as FormAnswers['chasePaymentFollowup'])}
                    onPick={() => setPhase1('dispute')}
                    required
                    options={[
                      { value: 'no', label: 'No, I will handle it' },
                      { value: 'unsure', label: 'Not sure yet' },
                      { value: 'yes', label: 'Yes, please follow up' },
                    ]}
                  />
                </div>
              ) : null}

              {phase1 === 'dispute' ? (
                <div ref={registerRef('dispute')}>
                  <SelectField
                    label="Is the amount the venue owes still what you agreed to?"
                    value={answers.paymentDispute}
                    onChange={v => set('paymentDispute', v as FormAnswers['paymentDispute'])}
                    onPick={() => setPhase1('supplemental_income')}
                    required
                    options={[
                      { value: 'no', label: 'Yes — matches the deal' },
                      { value: 'yes', label: 'No — there is a disagreement' },
                    ]}
                  />
                </div>
              ) : null}

              {phase1 === 'supplemental_income' ? (
                <div ref={registerRef('supplemental')}>
                  <SelectField
                    label="Any tips or merch income from the night?"
                    value={answers.supplementalIncome}
                    onChange={v => set('supplementalIncome', v as FormAnswers['supplementalIncome'])}
                    onPick={() => setPhase1('production')}
                    required
                    options={SUPPLEMENTAL_INCOME_OPTIONS}
                  />
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
                        set('wantsBookingCall', '')
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
                      setPhaseVenue('booking_call')
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

              {phaseVenue === 'booking_call' && answers.venueInterest === 'yes' ? (
                <div ref={registerRef('booking_call')}>
                  <SelectField
                    label="Should your manager schedule the next booking conversation?"
                    value={answers.wantsBookingCall}
                    onChange={v => {
                      set('wantsBookingCall', v as FormAnswers['wantsBookingCall'])
                      setPhaseVenue('play')
                    }}
                    required
                    options={[
                      { value: 'yes', label: 'Yes — loop my manager in' },
                      { value: 'no', label: "No — I'll handle it" },
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
                      setPhaseVenue('mgr')
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

              {phaseVenue === 'mgr' ? (
                <div ref={registerRef('mgr_contact')}>
                  <SelectField
                    label="Should your manager contact the venue on your behalf?"
                    value={answers.wantsManagerVenueContact}
                    onChange={v => {
                      set('wantsManagerVenueContact', v as FormAnswers['wantsManagerVenueContact'])
                      setPhaseVenue('referral')
                    }}
                    required
                    options={[
                      { value: 'no', label: 'No' },
                      { value: 'yes', label: 'Yes' },
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
                      setPhaseVenue('media')
                    }}
                    className="mt-4 w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                  >
                    Continue
                  </button>
                </div>
              ) : null}

              {phaseVenue === 'media' ? (
                <div className="mb-6" ref={registerRef('media')}>
                  <label className="block text-sm font-medium text-white mb-2">
                    Photos, videos, or posts from the show?
                  </label>
                  <div className="flex flex-col gap-2 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        set('mediaChoice', 'none')
                        set('mediaLinks', '')
                        setFieldError(null)
                        setPhaseVenue('done')
                      }}
                      className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm ${
                        answers.mediaChoice === 'none'
                          ? 'bg-white text-black border-white'
                          : 'bg-neutral-950 text-neutral-100 border-neutral-600'
                      }`}
                    >
                      No media to share
                    </button>
                    <button
                      type="button"
                      onClick={() => set('mediaChoice', 'links')}
                      className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm ${
                        answers.mediaChoice === 'links'
                          ? 'bg-white text-black border-white'
                          : 'bg-neutral-950 text-neutral-100 border-neutral-600'
                      }`}
                    >
                      I will paste link(s) below
                    </button>
                  </div>
                  {answers.mediaChoice === 'links' ? (
                    <>
                      <textarea
                        value={answers.mediaLinks}
                        onChange={e => set('mediaLinks', e.target.value)}
                        rows={2}
                        placeholder="Instagram, Drive, etc."
                        className="w-full bg-neutral-950 border border-neutral-600 rounded-lg px-4 py-3 text-white text-sm resize-none mb-4 placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/25"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!answers.mediaLinks.trim()) {
                            setFieldError('Paste at least one link, or choose “No media”.')
                            return
                          }
                          setFieldError(null)
                          setPhaseVenue('done')
                        }}
                        className="w-full min-h-[48px] rounded-lg bg-white text-sm font-semibold text-black hover:bg-neutral-100"
                      >
                        Continue
                      </button>
                    </>
                  ) : null}
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
