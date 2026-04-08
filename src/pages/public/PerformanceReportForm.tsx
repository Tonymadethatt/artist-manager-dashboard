import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, ClipboardList } from 'lucide-react'
import {
  ATTENDANCE_BAND_TO_NUMBER,
  CANCELLATION_REASON_LABELS,
  PARTIAL_PAYMENT_PRESETS,
  PRODUCTION_FRICTION_OPTIONS,
  type CancellationReason,
} from '@/lib/performanceReportV1'

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'invalid'

interface FormContext {
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
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
  artistPaidStatus: 'yes' | 'no' | 'partial' | ''
  paymentPreset: string
  paymentAmount: string
  chasePaymentFollowup: 'no' | 'unsure' | 'yes' | ''
  paymentDispute: 'no' | 'yes' | ''
  productionIssueLevel: 'none' | 'minor' | 'serious' | ''
  productionFrictionTags: string[]
  venueInterest: 'yes' | 'no' | 'unsure' | ''
  relationshipQuality: 'good' | 'neutral' | 'poor' | ''
  rebookingTimeline: 'this_month' | 'this_quarter' | 'later' | 'not_discussed' | ''
  wantsBookingCall: 'no' | 'yes' | ''
  wouldPlayAgain: 'yes' | 'maybe' | 'no' | ''
  wantsManagerVenueContact: 'no' | 'yes' | ''
  referralLead: 'no' | 'yes' | ''
  noteChipIds: string[]
  notesExtra: string
  mediaChoice: 'unset' | 'none' | 'links'
  mediaLinks: string
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`
}

const EMPTY: FormAnswers = {
  eventHappened: '',
  cancellationReason: '',
  eventRating: null,
  attendanceBand: '',
  artistPaidStatus: '',
  paymentPreset: '',
  paymentAmount: '',
  chasePaymentFollowup: '',
  paymentDispute: '',
  productionIssueLevel: '',
  productionFrictionTags: [],
  venueInterest: '',
  relationshipQuality: '',
  rebookingTimeline: '',
  wantsBookingCall: '',
  wouldPlayAgain: '',
  wantsManagerVenueContact: '',
  referralLead: '',
  noteChipIds: [],
  notesExtra: '',
  mediaChoice: 'unset',
  mediaLinks: '',
}

function SelectField({
  label, value, onChange, options, required,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        {label}{required && <span className="text-neutral-500 ml-1 font-normal">(required)</span>}
      </label>
      <div className="flex flex-col gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
              value === o.value
                ? 'bg-white text-black border-white font-medium'
                : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500 hover:text-white'
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

function RatingField({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        How did it go overall? <span className="text-neutral-500 font-normal">(optional)</span>
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
                    : 'bg-neutral-900 text-neutral-400 border-neutral-700 hover:border-neutral-500 hover:text-white'
                }`}
              >
                <span className="text-base leading-none">{n}</span>
                <span className="text-[10px] mt-0.5 opacity-80">{hint}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
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
  label, value, onChange, options, optional,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  optional?: boolean
}) {
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">
        {label}
        {optional && <span className="text-neutral-500 ml-1 font-normal">(optional)</span>}
      </label>
      <div className="grid grid-cols-2 gap-2">
        {options.map(o => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] px-3 py-2.5 rounded-lg border text-sm text-center transition-all ${
              value === o.value
                ? 'bg-white text-black border-white font-medium'
                : 'bg-neutral-900 text-neutral-300 border-neutral-700 hover:border-neutral-500'
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
        What was a friction point? <span className="text-neutral-500 font-normal">(tap any that apply)</span>
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
                on ? 'bg-white text-black border-white font-medium' : 'bg-neutral-900 text-neutral-300 border-neutral-700'
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

export default function PerformanceReportForm() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<FormState>('loading')
  const [context, setContext] = useState<FormContext>({ venueName: null, eventDate: null, dealDescription: null })
  const [answers, setAnswers] = useState<FormAnswers>(EMPTY)
  const [step, setStep] = useState(0)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({})

  const registerRef = useCallback((key: string) => (el: HTMLElement | null) => {
    fieldRefs.current[key] = el
  }, [])

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    fetch(`/.netlify/functions/get-performance-report?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (!data.valid) { setState('invalid'); return }
        if (data.submitted) { setState('success'); return }
        setContext({ venueName: data.venueName, eventDate: data.eventDate, dealDescription: data.dealDescription })
        setState('form')
      })
      .catch(() => setState('invalid'))
  }, [token])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const showEventSections = answers.eventHappened === 'yes'
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
      if (!answers.productionIssueLevel) return { ok: false, field: 'production', message: 'How were production and safety overall?' }
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

  function handleNext() {
    const v = validateStep(step)
    if (!v.ok) {
      setFieldError(v.message ?? 'Check highlighted step.')
      if (v.field) scrollToField(v.field)
      return
    }
    setFieldError(null)
    if (step < lastStepIndex) setStep(step + 1)
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

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-neutral-600 animate-spin" />
      </div>
    )
  }

  if (state === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center mx-auto mb-4">
            <ClipboardList className="h-5 w-5 text-neutral-500" />
          </div>
          <h1 className="text-white font-semibold text-lg mb-2">Link no longer valid</h1>
          <p className="text-neutral-500 text-sm leading-relaxed">This link has expired or is no longer active. Ask your manager to send you an updated one.</p>
        </div>
      </div>
    )
  }

  if (state === 'success') {
    return (
      <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center px-4">
        <div className="max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          </div>
          <h1 className="text-white font-semibold text-lg mb-2">Got it, thanks</h1>
          <p className="text-neutral-400 text-sm leading-relaxed">Your show report has been received. Your manager will follow up shortly.</p>
          {context.venueName && (
            <p className="text-neutral-600 text-xs mt-3">{context.venueName}{context.eventDate ? ` - ${formatDate(context.eventDate)}` : ''}</p>
          )}
        </div>
      </div>
    )
  }

  const showPaymentChip = showEventSections && answers.artistPaidStatus === 'partial'
  const venueInterestLabel = showEventSections
    ? 'Did the venue express interest in booking you again?'
    : 'Does this venue still seem interested in working with you in the future?'
  const relationshipLabel = showEventSections
    ? 'How was your relationship with the venue contact?'
    : 'Overall, how was your relationship with the venue contact (before the change of plans)?'

  return (
    <div className="min-h-screen bg-[#0d0d0d] py-6 px-4 pb-28">
      <div className="max-w-md mx-auto">
        <header ref={registerRef('header')} className="mb-5">
          <div className="flex items-start gap-3 mb-3">
            <img src="/dj-luijay-logo.png" alt="" className="h-8 w-auto shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[10px] text-neutral-600 uppercase tracking-widest font-medium leading-tight">Show report · Front Office</p>
              <h1 className="text-white font-semibold text-lg leading-snug">Tell your manager how it went</h1>
            </div>
          </div>
          {context.venueName && (
            <p className="text-neutral-400 text-sm border-t border-neutral-800 pt-3 mt-1">
              {context.venueName}
              {context.eventDate && <span className="text-neutral-600"> · {formatDate(context.eventDate)}</span>}
            </p>
          )}
        </header>

        <div className="flex items-center gap-2 mb-6" aria-hidden>
          {Array.from({ length: totalSteps }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-white' : 'bg-neutral-800'}`}
            />
          ))}
          <span className="text-[10px] text-neutral-600 shrink-0 tabular-nums ml-1">{step + 1}/{totalSteps}</span>
        </div>

        <form onSubmit={isLastStep ? handleSubmit : (e) => { e.preventDefault(); handleNext() }}>
          {step === 0 && (
            <div ref={registerRef('event')}>
              <SelectField
                label="Did the event happen as planned?"
                value={answers.eventHappened}
                onChange={v => {
                  set('eventHappened', v as FormAnswers['eventHappened'])
                  if (v === 'yes') set('cancellationReason', '')
                }}
                required
                options={[
                  { value: 'yes', label: 'Yes, it happened' },
                  { value: 'no', label: 'No, it was cancelled' },
                  { value: 'postponed', label: 'It was postponed' },
                ]}
              />
              {answers.eventHappened !== 'yes' && answers.eventHappened !== '' && (
                <div ref={registerRef('cancellation')}>
                  <SelectField
                    label="What best describes the situation?"
                    value={answers.cancellationReason}
                    onChange={v => set('cancellationReason', v as CancellationReason)}
                    required
                    options={Object.entries(CANCELLATION_REASON_LABELS).map(([value, label]) => ({
                      value,
                      label,
                    }))}
                  />
                </div>
              )}
            </div>
          )}

          {showEventSections && step === 1 && (
            <>
              <RatingField value={answers.eventRating} onChange={v => set('eventRating', v)} />
              <ChipGrid
                label="About how many people attended?"
                value={answers.attendanceBand}
                onChange={v => set('attendanceBand', v)}
                options={[...ATTENDANCE_BANDS]}
                optional
              />
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
                  }}
                  required
                  options={[
                    { value: 'yes', label: 'Yes, full payment' },
                    { value: 'partial', label: 'Partial payment' },
                    { value: 'no', label: 'Not yet / no' },
                  ]}
                />
              </div>
              {showPaymentChip && (
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
                            : 'bg-neutral-900 text-neutral-300 border-neutral-700'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {answers.paymentPreset === 'other' && (
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      value={answers.paymentAmount}
                      onChange={e => set('paymentAmount', e.target.value)}
                      placeholder="Enter amount"
                      className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm mb-5"
                    />
                  )}
                </div>
              )}
              {showEventSections && answers.artistPaidStatus && answers.artistPaidStatus !== 'yes' && (
                <div ref={registerRef('chase')}>
                  <SelectField
                    label="Should your manager help chase payment from the venue?"
                    value={answers.chasePaymentFollowup}
                    onChange={v => set('chasePaymentFollowup', v as FormAnswers['chasePaymentFollowup'])}
                    required
                    options={[
                      { value: 'no', label: 'No, I will handle it' },
                      { value: 'unsure', label: 'Not sure yet' },
                      { value: 'yes', label: 'Yes, please follow up' },
                    ]}
                  />
                </div>
              )}
              <div ref={registerRef('dispute')}>
                <SelectField
                  label="Is the amount the venue owes still what you agreed to?"
                  value={answers.paymentDispute}
                  onChange={v => set('paymentDispute', v as FormAnswers['paymentDispute'])}
                  required
                  options={[
                    { value: 'no', label: 'Yes — matches the deal' },
                    { value: 'yes', label: 'No — there is a disagreement' },
                  ]}
                />
              </div>
              <div ref={registerRef('production')}>
                <SelectField
                  label="Production, sound, and safety overall"
                  value={answers.productionIssueLevel}
                  onChange={v => {
                    set('productionIssueLevel', v as FormAnswers['productionIssueLevel'])
                    if (v === 'none') set('productionFrictionTags', [])
                  }}
                  required
                  options={[
                    { value: 'none', label: 'Smooth — no real issues' },
                    { value: 'minor', label: 'Minor annoyances only' },
                    { value: 'serious', label: 'Serious problem — manager should know' },
                  ]}
                />
              </div>
              <MultiFrictionField
                tags={answers.productionFrictionTags}
                onChange={t => set('productionFrictionTags', t)}
                issueLevel={answers.productionIssueLevel}
              />
            </>
          )}

          {((!showEventSections && step === 1) || (showEventSections && step === 2)) && (
            <>
              <div ref={registerRef('venue_int')}>
                <SelectField
                  label={venueInterestLabel}
                  value={answers.venueInterest}
                  onChange={v => {
                    set('venueInterest', v as FormAnswers['venueInterest'])
                    if (v !== 'yes') {
                      set('rebookingTimeline', '')
                      set('wantsBookingCall', '')
                    }
                  }}
                  required
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'unsure', label: 'Not sure yet' },
                    { value: 'no', label: 'No / not interested' },
                  ]}
                />
              </div>
              <div ref={registerRef('rel')}>
                <SelectField
                  label={relationshipLabel}
                  value={answers.relationshipQuality}
                  onChange={v => set('relationshipQuality', v as FormAnswers['relationshipQuality'])}
                  required
                  options={[
                    { value: 'good', label: 'Good — solid connection' },
                    { value: 'neutral', label: 'Neutral — professional' },
                    { value: 'poor', label: 'Poor — difficult' },
                  ]}
                />
              </div>
              {answers.venueInterest === 'yes' && (
                <>
                  <div ref={registerRef('timeline')}>
                    <SelectField
                      label="When did they hint at booking you again?"
                      value={answers.rebookingTimeline}
                      onChange={v => set('rebookingTimeline', v as FormAnswers['rebookingTimeline'])}
                      required
                      options={[
                        { value: 'this_month', label: 'Soon — this month' },
                        { value: 'this_quarter', label: 'This season / few months' },
                        { value: 'later', label: 'Later / no rush' },
                        { value: 'not_discussed', label: 'We did not really discuss timing' },
                      ]}
                    />
                  </div>
                  <div ref={registerRef('booking_call')}>
                    <SelectField
                      label="Should your manager schedule the next booking conversation?"
                      value={answers.wantsBookingCall}
                      onChange={v => set('wantsBookingCall', v as FormAnswers['wantsBookingCall'])}
                      required
                      options={[
                        { value: 'yes', label: 'Yes — loop my manager in' },
                        { value: 'no', label: "No — I'll handle it" },
                      ]}
                    />
                  </div>
                </>
              )}
              <div ref={registerRef('play_again')}>
                <SelectField
                  label="Would you play this venue again?"
                  value={answers.wouldPlayAgain}
                  onChange={v => set('wouldPlayAgain', v as FormAnswers['wouldPlayAgain'])}
                  required
                  options={[
                    { value: 'yes', label: 'Yes' },
                    { value: 'maybe', label: 'Maybe' },
                    { value: 'no', label: 'No' },
                  ]}
                />
              </div>
              <div ref={registerRef('mgr_contact')}>
                <SelectField
                  label="Should your manager contact the venue on your behalf?"
                  value={answers.wantsManagerVenueContact}
                  onChange={v => set('wantsManagerVenueContact', v as FormAnswers['wantsManagerVenueContact'])}
                  required
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes' },
                  ]}
                />
              </div>
              <div ref={registerRef('referral')}>
                <SelectField
                  label="Did anyone else at the show express interest in booking you?"
                  value={answers.referralLead}
                  onChange={v => set('referralLead', v as FormAnswers['referralLead'])}
                  required
                  options={[
                    { value: 'no', label: 'No' },
                    { value: 'yes', label: 'Yes — possible referral' },
                  ]}
                />
              </div>

              <div className="mb-5">
                <label className="block text-sm font-medium text-white mb-2">
                  Quick notes for your manager <span className="text-neutral-500 font-normal">(optional)</span>
                </label>
                <p className="text-xs text-neutral-600 mb-2">Tap shortcuts or add a line below — no need to type unless you want.</p>
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
                            on ? answers.noteChipIds.filter(x => x !== p.id) : [...answers.noteChipIds, p.id]
                          )
                        }}
                        className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm ${
                          on ? 'bg-white text-black border-white' : 'bg-neutral-900 text-neutral-300 border-neutral-700'
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
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm resize-none"
                />
              </div>

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
                    }}
                    className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm ${
                      answers.mediaChoice === 'none'
                        ? 'bg-white text-black border-white'
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700'
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
                        : 'bg-neutral-900 text-neutral-300 border-neutral-700'
                    }`}
                  >
                    I will paste link(s) below
                  </button>
                </div>
                {answers.mediaChoice === 'links' && (
                  <textarea
                    value={answers.mediaLinks}
                    onChange={e => set('mediaLinks', e.target.value)}
                    rows={2}
                    placeholder="Instagram, Drive, etc."
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm resize-none"
                  />
                )}
              </div>
            </>
          )}

          {fieldError && (
            <p className="text-red-400 text-sm mb-4" role="alert">{fieldError}</p>
          )}

          <div className="fixed bottom-0 left-0 right-0 p-4 bg-[#0d0d0d]/95 border-t border-neutral-800 backdrop-blur-sm z-10">
            <div className="max-w-md mx-auto flex gap-3">
              {step > 0 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 min-h-[48px] rounded-lg border border-neutral-600 text-neutral-200 text-sm font-medium hover:bg-neutral-900"
                >
                  Back
                </button>
              )}
              <button
                type="submit"
                disabled={state === 'submitting'}
                className="flex-[2] min-h-[48px] bg-white hover:bg-neutral-100 text-black font-semibold text-sm rounded-lg disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {state === 'submitting' ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : isLastStep ? (
                  'Submit report'
                ) : (
                  'Continue'
                )}
              </button>
            </div>
          </div>
        </form>

        <p className="text-center text-xs text-neutral-700 mt-4 pb-20">One-time link. Your answers go to your manager only.</p>
      </div>
    </div>
  )
}
