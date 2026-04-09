import { useState, useEffect, useMemo, useCallback, useRef, type ReactNode } from 'react'
import { Check, CheckCircle2, ClipboardList, Loader2, X } from 'lucide-react'
import { ChooseCalendarDateField } from '@/components/performance/ChooseCalendarDateField'
import { PublicFormLayout } from '@/components/public/PublicFormLayout'
import {
  DEFAULT_PUBLIC_FORM_BRANDING,
  mergePublicFormBranding,
  type PublicFormBranding,
} from '@/lib/publicFormBranding'
import { cn } from '@/lib/utils'
import {
  nightMoodsForWizardGrid,
  TOP_THREE_MOOD,
  SUCCESS_MESSAGE,
  defaultDealPromiseLines,
  resolvePromiseLineDisplayLabel,
  type DealPromiseLine,
  type ShowReportNightMood,
} from '@/lib/showReportCatalog'
import {
  PRODUCTION_FRICTION_OPTIONS,
  type ProductionIssueLevel,
  type RebookingTimeline,
} from '@/lib/performanceReportV1'

export interface ShowReportFormContext {
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
  dealGrossAmount?: number | null
}

type LoadedOk = {
  valid: true
  submitted: boolean
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
  dealGrossAmount: number | null
  promiseLines: DealPromiseLine[]
  branding: PublicFormBranding
}

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'invalid'

type StepKey =
  | 'event'
  | 'short_path'
  | 'promises'
  | 'mood'
  | 'crowd'
  | 'money'
  | 'merch'
  | 'production'
  | 'rebooking'
  | 'relationship'
  | 'referral'
  | 'extras'

/** When venue wants them back — four choices only. */
const REBOOK_OPTIONS: { v: RebookingTimeline; label: string }[] = [
  { v: 'this_week', label: 'This week' },
  { v: 'next_week', label: 'Next week' },
  { v: 'custom_date', label: 'Pick a date' },
  { v: 'not_discussed', label: 'Not discussed' },
]

/** Left → right: negative → positive. Maps to `would_play_again` when the follow-up question is skipped. */
const RELATIONSHIP_ON_SITE_OPTIONS = [
  { quality: 'poor' as const, label: 'Poor', emoji: '😞', playAgain: 'no' as const },
  { quality: 'neutral' as const, label: 'Neutral', emoji: '😐', playAgain: 'yes' as const },
  { quality: 'good' as const, label: 'Good', emoji: '😊', playAgain: 'yes' as const },
]

const CROWD_SLIDER_MIN = 0
const CROWD_SLIDER_MAX = 1500
const CROWD_SLIDER_STEP = 50
const CROWD_SLIDER_DEFAULT = 200

/** Primary step question — centered, large, heavy type for quick scanning. */
const STEP_QUESTION_CLASS =
  'mb-4 text-center text-lg font-bold leading-snug tracking-tight text-white sm:text-xl max-w-md mx-auto px-1'

function fmtMoney(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
}

type PayoutChoice = 'full' | 'none' | 'partial'

/** Strictly between 0 and fee (for partial payment validation). */
function parsePartialReceivedInput(raw: string, feeTotal: number): number | null {
  const cleaned = raw.trim().replace(/^\$/u, '').replace(/,/gu, '')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  const rounded = Math.round(n * 100) / 100
  if (rounded >= feeTotal - 0.005) return null
  return rounded
}

function parseMerchSalesInput(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\$/u, '').replace(/,/gu, '')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

function Chip({
  active,
  children,
  onClick,
  className,
}: {
  active?: boolean
  children: ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors text-left',
        active
          ? 'border-white bg-white text-black'
          : 'border-neutral-700 bg-neutral-900 text-neutral-200 hover:border-neutral-500',
        className,
      )}
    >
      {children}
    </button>
  )
}

function PromiseDeliveredToggle({
  lineId,
  met,
  onToggle,
}: {
  lineId: string
  met: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      id={`promise-toggle-${lineId}`}
      role="switch"
      aria-checked={met}
      aria-label={met ? 'Venue delivered: yes' : 'Venue delivered: no'}
      onClick={onToggle}
      className={cn(
        'relative h-7 w-14 shrink-0 rounded-full p-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        met ? 'bg-emerald-600' : 'bg-rose-900/85',
      )}
    >
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-full bg-white text-neutral-900 shadow transition-transform duration-200 ease-out will-change-transform',
          met ? 'translate-x-6' : 'translate-x-0',
        )}
        aria-hidden
      >
        {met ? (
          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2.5} />
        ) : (
          <X className="h-3.5 w-3.5 text-rose-600" strokeWidth={2.5} />
        )}
      </span>
    </button>
  )
}

function needsProductionStepFromMood(mood: ShowReportNightMood | null): boolean {
  return mood === 'meh' || mood === 'rough' || mood === 'disaster'
}

function buildSteps(params: {
  eventHappened: 'yes' | 'no' | 'postponed' | null
  nightMood: ShowReportNightMood | null
  /**
   * While still on the promises screen (`stepIndex === 1` on the played path), toggles must not
   * reshape the step list (inserting `production` shifts indices and feels like auto-advance).
   */
  onPromisesStep: boolean
  /** Set when leaving promises (Next): any deal line marked “not delivered”. */
  productionNeededFromPromises: boolean
}): StepKey[] {
  const { eventHappened, nightMood, onPromisesStep, productionNeededFromPromises } = params
  if (!eventHappened) return ['event']
  if (eventHappened !== 'yes') return ['event', 'short_path']
  const anyNoForRoute = onPromisesStep ? false : productionNeededFromPromises
  const includeProduction = anyNoForRoute || needsProductionStepFromMood(nightMood)
  const s: StepKey[] = ['event', 'promises', 'mood', 'crowd', 'money', 'merch']
  if (includeProduction) s.push('production')
  s.push('rebooking', 'relationship')
  if (nightMood && TOP_THREE_MOOD.has(nightMood)) s.push('referral')
  s.push('extras')
  return s
}

export interface ShowReportWizardProps {
  token: string
  /** @deprecated Only used when `preview` is true as mock venue/deal labels. */
  embeddedContext?: ShowReportFormContext | null
  previewContext?: ShowReportFormContext | null
  submittedBy: 'artist_link' | 'manager_dashboard'
  footerMode: 'viewport' | 'embedded'
  preview?: boolean
  branding?: PublicFormBranding | null
  onSuccess?: () => void
  onCancel?: () => void
}

export function ShowReportWizard({
  token,
  embeddedContext,
  previewContext,
  submittedBy,
  footerMode,
  preview = false,
  branding: propsBranding,
  onSuccess,
  onCancel,
}: ShowReportWizardProps) {
  const mockContext = previewContext ?? embeddedContext ?? null

  const [ui, setUi] = useState<FormState>(() => (preview ? 'form' : 'loading'))
  const [brandingIn, setBrandingIn] = useState<PublicFormBranding>(() =>
    propsBranding ? mergePublicFormBranding(propsBranding) : DEFAULT_PUBLIC_FORM_BRANDING,
  )
  const [loaded, setLoaded] = useState<LoadedOk | null>(() =>
    preview
      ? {
          valid: true,
          submitted: false,
          venueName: mockContext?.venueName ?? 'Venue',
          eventDate: mockContext?.eventDate ?? null,
          dealDescription: mockContext?.dealDescription ?? null,
          dealGrossAmount:
            mockContext?.dealGrossAmount != null && Number.isFinite(Number(mockContext.dealGrossAmount))
              ? Number(mockContext.dealGrossAmount)
              : null,
          promiseLines: defaultDealPromiseLines(),
          branding: propsBranding ? mergePublicFormBranding(propsBranding) : DEFAULT_PUBLIC_FORM_BRANDING,
        }
      : null,
  )
  const [submitErr, setSubmitErr] = useState<string | null>(null)
  const [stepIndex, setStepIndex] = useState(0)

  const [eventHappened, setEventHappened] = useState<'yes' | 'no' | 'postponed' | null>(null)
  const [cancellationFreeform, setCancellationFreeform] = useState('')
  const [rescheduledToDate, setRescheduledToDate] = useState('')
  const [notPlayedVenuePaidAnything, setNotPlayedVenuePaidAnything] = useState<'no' | 'yes' | null>(null)
  const [notPlayedPaymentSummary, setNotPlayedPaymentSummary] = useState('')

  const [promiseResults, setPromiseResults] = useState<Record<string, boolean>>({})
  /** Locked when leaving promises (Next); ignored while still on promises so toggles don’t reshape `steps`. */
  const [productionNeededFromPromises, setProductionNeededFromPromises] = useState(false)
  const [nightMood, setNightMood] = useState<ShowReportNightMood | null>(null)
  const [crowdHeadcount, setCrowdHeadcount] = useState<number>(CROWD_SLIDER_DEFAULT)
  /** Only when `dealGrossAmount` is missing; preset chip selection sets fee for API. */
  const [feeFallback, setFeeFallback] = useState<number | null>(null)
  const [payoutChoice, setPayoutChoice] = useState<PayoutChoice | null>(null)
  const [partialAmountInput, setPartialAmountInput] = useState('')
  const [merchIncome, setMerchIncome] = useState<'yes' | 'no' | null>(null)
  const [merchSalesInput, setMerchSalesInput] = useState('')
  const [productionIssueLevel, setProductionIssueLevel] = useState<ProductionIssueLevel>('none')
  const [productionFrictionTags, setProductionFrictionTags] = useState<string[]>([])
  const [venueInterest, setVenueInterest] = useState<'yes' | 'no' | 'unsure' | null>(null)
  const [rebookingTimeline, setRebookingTimeline] = useState<RebookingTimeline | null>(null)
  const [rebookingSpecificDate, setRebookingSpecificDate] = useState('')
  const [relationshipQuality, setRelationshipQuality] = useState<'good' | 'neutral' | 'poor' | null>(
    null,
  )
  const [wouldPlayAgain, setWouldPlayAgain] = useState<'yes' | 'maybe' | 'no' | null>(null)
  /** Shown when rating is poor or neutral; merged into submitted notes. */
  const [relationshipExperienceExplain, setRelationshipExperienceExplain] = useState('')
  const [referralLead, setReferralLead] = useState<'no' | 'yes' | null>(null)
  const [referralDetail, setReferralDetail] = useState('')
  const [notes, setNotes] = useState('')

  const [successProgressPct, setSuccessProgressPct] = useState(0)
  const [successFlash, setSuccessFlash] = useState(false)

  useEffect(() => {
    if (propsBranding) setBrandingIn(mergePublicFormBranding(propsBranding))
  }, [propsBranding])

  useEffect(() => {
    if (preview) {
      if (propsBranding) setBrandingIn(mergePublicFormBranding(propsBranding))
      setUi('form')
      return
    }
    if (!token) {
      setUi('invalid')
      return
    }
    let cancelled = false
    fetch(`/.netlify/functions/get-performance-report?token=${encodeURIComponent(token)}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (data.branding) setBrandingIn(mergePublicFormBranding(data.branding))
        if (!data.valid) {
          setUi('invalid')
          return
        }
        if (data.submitted) {
          setUi('success')
          return
        }
        const lines: DealPromiseLine[] = Array.isArray(data.promiseLines) ? data.promiseLines : []
        setLoaded({
          valid: true,
          submitted: false,
          venueName: data.venueName ?? null,
          eventDate: data.eventDate ?? null,
          dealDescription: data.dealDescription ?? null,
          dealGrossAmount:
            data.dealGrossAmount != null && Number.isFinite(Number(data.dealGrossAmount))
              ? Number(data.dealGrossAmount)
              : null,
          promiseLines: lines.length ? lines : defaultDealPromiseLines(),
          branding: data.branding ? mergePublicFormBranding(data.branding) : DEFAULT_PUBLIC_FORM_BRANDING,
        })
        setUi('form')
      })
      .catch(() => {
        if (!cancelled) setUi('invalid')
      })
    return () => {
      cancelled = true
    }
  }, [token, preview, propsBranding])

  useEffect(() => {
    if (ui !== 'success') return
    setSuccessProgressPct(100)
    setSuccessFlash(true)
    const t = window.setTimeout(() => {
      setSuccessFlash(false)
      setSuccessProgressPct(0)
    }, 550)
    return () => window.clearTimeout(t)
  }, [ui])

  const promiseLines = loaded?.promiseLines ?? defaultDealPromiseLines()

  const onPromisesStep = eventHappened === 'yes' && stepIndex === 1

  const steps = useMemo(
    () =>
      buildSteps({
        eventHappened,
        nightMood,
        onPromisesStep,
        productionNeededFromPromises,
      }),
    [eventHappened, nightMood, onPromisesStep, productionNeededFromPromises],
  )

  const stepsRef = useRef(steps)
  stepsRef.current = steps
  const promiseResultsRef = useRef(promiseResults)
  promiseResultsRef.current = promiseResults

  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] ?? 'event'
  const progressPct =
    steps.length > 1 ? Math.round((Math.min(stepIndex, steps.length - 1) / (steps.length - 1)) * 100) : 0

  useEffect(() => {
    if (stepIndex >= steps.length) setStepIndex(Math.max(0, steps.length - 1))
  }, [stepIndex, steps.length])

  const feeTotal = useMemo(() => {
    const booked = loaded?.dealGrossAmount
    if (booked != null && Number.isFinite(Number(booked))) {
      return Math.round(Number(booked) * 100) / 100
    }
    return Math.max(0, feeFallback ?? 0)
  }, [loaded?.dealGrossAmount, feeFallback])

  const guaranteedFeeLine = useMemo(
    () =>
      promiseLines.find(l => l.presetKey === 'guaranteed_fee' || l.id === 'preset:guaranteed_fee') ?? null,
    [promiseLines],
  )
  const guaranteedFeeDelivered =
    guaranteedFeeLine != null ? promiseResults[guaranteedFeeLine.id] !== false : true
  const moneyStepQuestion =
    guaranteedFeeLine && !guaranteedFeeDelivered
      ? 'Did you get paid for this show?'
      : 'Did you get paid in full?'

  const setPromiseMet = useCallback((id: string, met: boolean) => {
    setPromiseResults(prev => ({ ...prev, [id]: met }))
  }, [])

  useEffect(() => {
    if (!promiseLines.length) return
    setPromiseResults(prev => {
      const next = { ...prev }
      let changed = false
      for (const l of promiseLines) {
        if (next[l.id] === undefined) {
          next[l.id] = true
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [promiseLines])

  const goNext = useCallback(() => {
    setSubmitErr(null)
    setStepIndex(i => {
      const cur = stepsRef.current[i]
      if (cur === 'promises') {
        setProductionNeededFromPromises(
          promiseLines.some(l => promiseResultsRef.current[l.id] === false),
        )
      }
      return i + 1
    })
  }, [promiseLines])

  /** After selection-only controls: advance after React applies state (avoids stale `steps.length`). */
  const selectAndAdvance = useCallback(() => {
    queueMicrotask(goNext)
  }, [goNext])

  const goBack = useCallback(() => {
    setSubmitErr(null)
    setStepIndex(i => {
      const nextIdx = Math.max(0, i - 1)
      if (eventHappened === 'yes' && nextIdx === 1) {
        setProductionNeededFromPromises(false)
      }
      return nextIdx
    })
  }, [eventHappened])

  const canAdvance = useMemo(() => {
    switch (currentStep) {
      case 'event':
        return eventHappened != null
      case 'short_path': {
        if (!cancellationFreeform.trim()) return false
        if (eventHappened === 'postponed' && !rescheduledToDate.trim()) return false
        if (notPlayedVenuePaidAnything === 'yes' && !notPlayedPaymentSummary.trim()) return false
        return notPlayedVenuePaidAnything != null
      }
      case 'promises':
        return promiseLines.every(l => promiseResults[l.id] === true || promiseResults[l.id] === false)
      case 'mood':
        return nightMood != null
      case 'crowd':
        return (
          crowdHeadcount >= CROWD_SLIDER_MIN &&
          crowdHeadcount <= CROWD_SLIDER_MAX &&
          crowdHeadcount % CROWD_SLIDER_STEP === 0
        )
      case 'money':
        if (feeTotal <= 0 || payoutChoice == null) return false
        if (payoutChoice === 'partial')
          return parsePartialReceivedInput(partialAmountInput, feeTotal) != null
        return true
      case 'merch':
        if (merchIncome == null) return false
        if (merchIncome === 'yes') return parseMerchSalesInput(merchSalesInput) != null
        return true
      case 'production':
        return true
      case 'rebooking':
        if (venueInterest == null) return false
        if (venueInterest === 'yes') {
          if (!rebookingTimeline) return false
          if (rebookingTimeline === 'custom_date' && !rebookingSpecificDate.trim()) return false
        }
        return true
      case 'relationship':
        if (relationshipQuality == null || wouldPlayAgain == null) return false
        if (relationshipQuality === 'good') return true
        return relationshipExperienceExplain.trim().length > 0
      case 'referral':
        if (referralLead === 'yes' && !referralDetail.trim()) return false
        return referralLead != null
      case 'extras':
        return true
      default:
        return false
    }
  }, [
    currentStep,
    eventHappened,
    cancellationFreeform,
    rescheduledToDate,
    notPlayedVenuePaidAnything,
    notPlayedPaymentSummary,
    promiseLines,
    promiseResults,
    nightMood,
    crowdHeadcount,
    feeTotal,
    payoutChoice,
    partialAmountInput,
    merchIncome,
    merchSalesInput,
    venueInterest,
    rebookingTimeline,
    rebookingSpecificDate,
    relationshipQuality,
    wouldPlayAgain,
    relationshipExperienceExplain,
    referralLead,
    referralDetail,
  ])

  const artistPaidStatus = useMemo((): 'yes' | 'no' | 'partial' | null => {
    if (payoutChoice === 'none') return 'no'
    if (payoutChoice === 'full') return 'yes'
    if (payoutChoice === 'partial') {
      return parsePartialReceivedInput(partialAmountInput, feeTotal) != null ? 'partial' : null
    }
    return null
  }, [payoutChoice, partialAmountInput, feeTotal])

  const amountReceived = useMemo(() => {
    if (payoutChoice === 'none') return 0
    if (payoutChoice === 'full') return feeTotal
    if (payoutChoice === 'partial') {
      return parsePartialReceivedInput(partialAmountInput, feeTotal) ?? 0
    }
    return 0
  }, [payoutChoice, partialAmountInput, feeTotal])

  const buildSubmitBody = useCallback(() => {
    const played = eventHappened === 'yes'
    const attendance = played ? crowdHeadcount : null
    const merchIncomeAmount =
      played && merchIncome === 'yes' ? parseMerchSalesInput(merchSalesInput) : null

    const promiseResultsArr = promiseLines.map(l => ({
      id: l.id,
      met: promiseResults[l.id] !== false,
    }))

    const referralEffective =
      played && nightMood && TOP_THREE_MOOD.has(nightMood) ? referralLead ?? 'no' : 'no'

    const relationshipExplainLine =
      played &&
      relationshipQuality != null &&
      (relationshipQuality === 'poor' || relationshipQuality === 'neutral') &&
      relationshipExperienceExplain.trim()
        ? `Company experience (${relationshipQuality}): ${relationshipExperienceExplain.trim()}`
        : null
    const notesCombined = [notes.trim() || null, relationshipExplainLine].filter(Boolean).join('\n\n') || null

    return {
      token,
      eventHappened: eventHappened!,
      submittedBy,
      attendance,
      artistPaidStatus: played ? artistPaidStatus! : null,
      feeTotal: played ? feeTotal : undefined,
      amountReceived: played ? amountReceived : undefined,
      paymentDispute: played ? 'no' : null,
      paymentDisputeClaimedAmount: null,
      chasePaymentFollowup: null,
      productionIssueLevel: played ? productionIssueLevel : null,
      productionFrictionTags: played ? productionFrictionTags : null,
      venueInterest: played ? venueInterest : null,
      relationshipQuality: played ? relationshipQuality : null,
      wouldPlayAgain: played ? wouldPlayAgain : null,
      rebookingTimeline: played ? rebookingTimeline : null,
      wantsBookingCall: null,
      wantsManagerVenueContact: null,
      referralLead: played ? referralEffective : null,
      referralDetail: played && referralEffective === 'yes' ? referralDetail : null,
      merchIncome: played ? merchIncome : null,
      merchIncomeAmount,
      notes: notesCombined,
      mediaLinks: null,
      nightMood: played && nightMood ? nightMood : null,
      promiseResults: played ? promiseResultsArr : null,
      rescheduledToDate:
        !played && eventHappened === 'postponed' ? rescheduledToDate.trim() || null : null,
      rebookingSpecificDate:
        played && venueInterest === 'yes' && rebookingTimeline === 'custom_date'
          ? rebookingSpecificDate.trim() || null
          : null,
      cancellationFreeform: !played ? cancellationFreeform.trim() : null,
      notPlayedVenuePaidAnything: !played ? notPlayedVenuePaidAnything : null,
      notPlayedPaymentSummary:
        !played && notPlayedVenuePaidAnything === 'yes' ? notPlayedPaymentSummary.trim() || null : null,
    }
  }, [
    token,
    eventHappened,
    submittedBy,
    crowdHeadcount,
    merchIncome,
    merchSalesInput,
    promiseLines,
    promiseResults,
    artistPaidStatus,
    feeTotal,
    amountReceived,
    productionIssueLevel,
    productionFrictionTags,
    venueInterest,
    relationshipQuality,
    wouldPlayAgain,
    relationshipExperienceExplain,
    rebookingTimeline,
    referralLead,
    referralDetail,
    notes,
    nightMood,
    rescheduledToDate,
    rebookingSpecificDate,
    cancellationFreeform,
    notPlayedVenuePaidAnything,
    notPlayedPaymentSummary,
  ])

  const handleSubmit = async () => {
    if (preview) {
      setUi('success')
      return
    }
    setSubmitErr(null)
    setUi('submitting')
    try {
      const res = await fetch('/.netlify/functions/submit-performance-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSubmitBody()),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setUi('form')
        setSubmitErr(typeof data.message === 'string' ? data.message : 'Could not save. Try again.')
        return
      }
      setUi('success')
    } catch {
      setUi('form')
      setSubmitErr('Network error. Try again.')
    }
  }

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

  if (ui === 'loading') {
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

  if (ui === 'invalid') {
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

  if (ui === 'success') {
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
        <div className="w-full max-w-sm text-center px-4">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" strokeWidth={2} />
          </div>
          <p className="text-sm leading-relaxed text-neutral-200">
            {preview ? 'Preview only — nothing saved.' : SUCCESS_MESSAGE}
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

  const headlineLocation = loaded?.venueName?.trim() || 'Check-in'
  const dateLine = loaded?.eventDate
    ? new Date(loaded.eventDate + 'T12:00:00').toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const formHeaderAriaLabel = [headlineLocation, dateLine].filter(Boolean).join(' · ')

  const footerShowSubmit = currentStep === 'extras' || currentStep === 'short_path'
  const footerShowNext =
    !footerShowSubmit &&
    currentStep !== 'event' &&
    !(currentStep === 'money' && payoutChoice !== 'partial')
  const footerShowBar = stepIndex > 0 || footerShowSubmit || footerShowNext

  return (
    <PublicFormLayout
      branding={brandingIn}
      title={formHeaderAriaLabel}
      headerText={
        <div className="text-right leading-none">
          <h1 className="text-[14px] font-semibold leading-tight tracking-tight text-white sm:text-[15px]">
            {headlineLocation}
          </h1>
          {dateLine ? (
            <p className="mt-px text-[10px] font-medium tabular-nums leading-tight text-neutral-400 sm:text-[11px]">
              {dateLine}
            </p>
          ) : null}
        </div>
      }
      progress={progressPct}
      progressSuccessFlash={false}
      rootClassName={layoutRootDraft}
      mainClassName={cn(
        'min-h-0 flex flex-1 flex-col pt-[clamp(2rem,8vh,5rem)]',
        footerMode === 'viewport' ? 'pb-2' : 'pb-6',
      )}
    >
      <>
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col px-1">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain [scrollbar-gutter:stable]">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="mb-4 text-sm font-medium text-neutral-200 hover:text-white"
          >
            ← Cancel
          </button>
        ) : null}

        {submitErr ? (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {submitErr}
          </div>
        ) : null}

        {currentStep === 'event' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>Did the show happen as planned?</p>
            <div className="mx-auto grid w-full max-w-[min(100%,calc(8.05rem*2+0.75rem))] grid-cols-2 gap-x-3 gap-y-[calc(0.5rem*1.35)]">
              <button
                type="button"
                onClick={() => {
                  if (eventHappened === 'no') return
                  setEventHappened('no')
                  selectAndAdvance()
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-red-600/60 bg-red-950/50 hover:border-red-500 hover:bg-red-950/70',
                  eventHappened === 'no' &&
                    'border-red-400 bg-red-600/25 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]',
                )}
                aria-pressed={eventHappened === 'no'}
                aria-label="No, cancelled or did not happen"
              >
                <X
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    eventHappened === 'no' ? 'text-red-300' : 'text-red-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-red-200/90',
                    eventHappened === 'no' && 'text-red-100',
                  )}
                >
                  No
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (eventHappened === 'yes') return
                  setEventHappened('yes')
                  selectAndAdvance()
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-emerald-600/60 bg-emerald-950/50 hover:border-emerald-500 hover:bg-emerald-950/70',
                  eventHappened === 'yes' &&
                    'border-emerald-400 bg-emerald-600/25 shadow-[0_0_0_2px_rgba(52,211,153,0.35)]',
                )}
                aria-pressed={eventHappened === 'yes'}
                aria-label="Yes, we played"
              >
                <Check
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    eventHappened === 'yes' ? 'text-emerald-300' : 'text-emerald-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-emerald-200/90',
                    eventHappened === 'yes' && 'text-emerald-100',
                  )}
                >
                  Yes
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (eventHappened === 'postponed') return
                  setEventHappened('postponed')
                  selectAndAdvance()
                }}
                className={cn(
                  'col-span-2 w-full rounded-full border px-4 py-2 text-center text-[11px] font-medium leading-tight transition-colors',
                  'border-neutral-700 bg-neutral-950 text-neutral-400',
                  eventHappened === 'postponed'
                    ? 'border-neutral-500 bg-neutral-900 text-neutral-100'
                    : 'hover:border-neutral-600 hover:bg-neutral-900 hover:text-neutral-200',
                )}
                aria-pressed={eventHappened === 'postponed'}
              >
                Postponed or moved to another date
              </button>
            </div>
          </div>
        ) : null}

        {currentStep === 'short_path' ? (
          <div className="space-y-4">
            <div className="block">
              <p className={STEP_QUESTION_CLASS}>What happened?</p>
              <textarea
                value={cancellationFreeform}
                onChange={e => setCancellationFreeform(e.target.value)}
                rows={4}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
                placeholder="Short version is fine."
                aria-label="What happened?"
              />
            </div>
            {eventHappened === 'postponed' ? (
              <div className="block">
                <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                  New date
                </span>
                <ChooseCalendarDateField
                  className="mt-1.5"
                  value={rescheduledToDate}
                  onChange={setRescheduledToDate}
                  buttonAriaLabel="Choose new event date from calendar"
                />
              </div>
            ) : null}
            <div>
              <p className={STEP_QUESTION_CLASS}>Any payment from the venue for this?</p>
              <div className="grid grid-cols-2 gap-2">
                <Chip active={notPlayedVenuePaidAnything === 'no'} onClick={() => setNotPlayedVenuePaidAnything('no')}>
                  No
                </Chip>
                <Chip active={notPlayedVenuePaidAnything === 'yes'} onClick={() => setNotPlayedVenuePaidAnything('yes')}>
                  Yes
                </Chip>
              </div>
            </div>
            {notPlayedVenuePaidAnything === 'yes' ? (
              <label className="block">
                <span className="text-xs text-neutral-500">What did they cover?</span>
                <textarea
                  value={notPlayedPaymentSummary}
                  onChange={e => setNotPlayedPaymentSummary(e.target.value)}
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
                  placeholder="e.g. Kill fee wired, partial guarantee…"
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'promises' ? (
          <div className="space-y-2">
            <p className={STEP_QUESTION_CLASS}>Did the venue deliver on their promise?</p>
            <ul className="divide-y divide-neutral-800/90 rounded-lg border border-neutral-800 bg-neutral-950/50">
              {promiseLines.map(line => {
                const met = promiseResults[line.id] !== false
                return (
                  <li key={line.id} className="flex items-center gap-3 px-3 py-2">
                    <span className="min-w-0 flex-1 text-sm leading-snug text-neutral-100">
                      {resolvePromiseLineDisplayLabel(line, loaded?.dealGrossAmount)}
                    </span>
                    <PromiseDeliveredToggle
                      lineId={line.id}
                      met={met}
                      onToggle={() => setPromiseMet(line.id, !met)}
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {currentStep === 'mood' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>How did tonight feel?</p>
            <div className="grid grid-cols-2 gap-2">
            {nightMoodsForWizardGrid().map(m => (
              <Chip
                key={m.key}
                active={nightMood === m.key}
                onClick={() => {
                  if (nightMood === m.key) return
                  setNightMood(m.key)
                  selectAndAdvance()
                }}
              >
                <span className="mr-1.5">{m.emoji}</span>
                {m.word}
              </Chip>
            ))}
            </div>
          </div>
        ) : null}

        {currentStep === 'crowd' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>About how many people were there?</p>
            <div className="mx-auto w-full max-w-md px-1">
              <p className="mb-3 text-center text-base font-medium tabular-nums text-neutral-100">
                {crowdHeadcount.toLocaleString()} people
              </p>
              <label className="block">
                <span className="sr-only">Estimated headcount (steps of {CROWD_SLIDER_STEP})</span>
                <input
                  type="range"
                  min={CROWD_SLIDER_MIN}
                  max={CROWD_SLIDER_MAX}
                  step={CROWD_SLIDER_STEP}
                  value={crowdHeadcount}
                  onChange={e => setCrowdHeadcount(Number(e.target.value))}
                  className="h-9 w-full cursor-pointer accent-white"
                />
              </label>
              <div className="mt-1 flex justify-between tabular-nums text-[11px] text-neutral-500">
                <span>0</span>
                <span>1,500</span>
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 'money' ? (
          <div className="space-y-5">
            {loaded?.dealGrossAmount == null || !Number.isFinite(Number(loaded.dealGrossAmount)) ? (
              <div className="space-y-2">
                <p className="text-center text-xs text-neutral-500">Fee for this show</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[500, 750, 1000, 1500, 2500].map(n => (
                    <Chip
                      key={n}
                      active={feeFallback === n}
                      onClick={() => {
                        setFeeFallback(n)
                        setPayoutChoice(null)
                        setPartialAmountInput('')
                      }}
                    >
                      {fmtMoney(n)}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : null}

            <div className={cn(feeTotal <= 0 && 'pointer-events-none opacity-40')}>
              <p className={STEP_QUESTION_CLASS}>{moneyStepQuestion}</p>
              <div className="mx-auto w-full max-w-[min(100%,calc(8.05rem*2+0.75rem))]">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (feeTotal <= 0) return
                      if (payoutChoice === 'none') {
                        selectAndAdvance()
                        return
                      }
                      setPayoutChoice('none')
                      setPartialAmountInput('')
                      selectAndAdvance()
                    }}
                    className={cn(
                      'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                      'border-red-600/60 bg-red-950/50 hover:border-red-500 hover:bg-red-950/70',
                      payoutChoice === 'none' &&
                        'border-red-400 bg-red-600/25 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]',
                    )}
                    aria-pressed={payoutChoice === 'none'}
                    aria-label="No, did not get paid"
                  >
                    <X
                      className={cn(
                        'h-12 w-12 stroke-[2.5] shrink-0',
                        payoutChoice === 'none' ? 'text-red-300' : 'text-red-400/75',
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-base font-semibold text-red-200/90',
                        payoutChoice === 'none' && 'text-red-100',
                      )}
                    >
                      No
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (feeTotal <= 0) return
                      if (payoutChoice === 'full') {
                        selectAndAdvance()
                        return
                      }
                      setPayoutChoice('full')
                      setPartialAmountInput('')
                      selectAndAdvance()
                    }}
                    className={cn(
                      'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                      'border-emerald-600/60 bg-emerald-950/50 hover:border-emerald-500 hover:bg-emerald-950/70',
                      payoutChoice === 'full' &&
                        'border-emerald-400 bg-emerald-600/25 shadow-[0_0_0_2px_rgba(52,211,153,0.35)]',
                    )}
                    aria-pressed={payoutChoice === 'full'}
                    aria-label="Yes, paid in full"
                  >
                    <Check
                      className={cn(
                        'h-12 w-12 stroke-[2.5] shrink-0',
                        payoutChoice === 'full' ? 'text-emerald-300' : 'text-emerald-400/75',
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-base font-semibold text-emerald-200/90',
                        payoutChoice === 'full' && 'text-emerald-100',
                      )}
                    >
                      Yes
                    </span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (feeTotal <= 0) return
                    if (payoutChoice === 'partial') return
                    setPayoutChoice('partial')
                    setPartialAmountInput('')
                  }}
                  className={cn(
                    'mt-3 w-full rounded-full border px-4 py-2 text-center text-[11px] font-medium leading-tight transition-colors',
                    'border-neutral-700 bg-neutral-950 text-neutral-400',
                    payoutChoice === 'partial'
                      ? 'border-neutral-500 bg-neutral-900 text-neutral-100'
                      : 'hover:border-neutral-600 hover:bg-neutral-900 hover:text-neutral-200',
                  )}
                  aria-pressed={payoutChoice === 'partial'}
                  aria-label="Partial payment"
                >
                  Partial payment
                </button>
              </div>
            </div>

            {payoutChoice === 'partial' && feeTotal > 0 ? (
              <label className="mx-auto block max-w-xs">
                <span className="mb-1 block text-center text-xs text-neutral-500">Amount you received</span>
                <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-950 pl-3">
                  <span className="text-sm text-neutral-500" aria-hidden>
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={partialAmountInput}
                    onChange={e => setPartialAmountInput(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent px-2 py-3 text-sm text-white placeholder:text-neutral-600"
                    aria-label="Amount you received"
                  />
                </div>
              </label>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'merch' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>Merch sales tonight?</p>
            <div className="mx-auto grid w-full max-w-[min(100%,calc(8.05rem*2+0.75rem))] grid-cols-2 gap-x-3 gap-y-[calc(0.5rem*1.35)]">
              <button
                type="button"
                onClick={() => {
                  if (merchIncome === 'no') return
                  setMerchIncome('no')
                  setMerchSalesInput('')
                  selectAndAdvance()
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-red-600/60 bg-red-950/50 hover:border-red-500 hover:bg-red-950/70',
                  merchIncome === 'no' &&
                    'border-red-400 bg-red-600/25 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]',
                )}
                aria-pressed={merchIncome === 'no'}
                aria-label="No, no merch sales"
              >
                <X
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    merchIncome === 'no' ? 'text-red-300' : 'text-red-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-red-200/90',
                    merchIncome === 'no' && 'text-red-100',
                  )}
                >
                  No
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (merchIncome === 'yes') return
                  setMerchIncome('yes')
                  setMerchSalesInput('')
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-emerald-600/60 bg-emerald-950/50 hover:border-emerald-500 hover:bg-emerald-950/70',
                  merchIncome === 'yes' &&
                    'border-emerald-400 bg-emerald-600/25 shadow-[0_0_0_2px_rgba(52,211,153,0.35)]',
                )}
                aria-pressed={merchIncome === 'yes'}
                aria-label="Yes, had merch sales"
              >
                <Check
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    merchIncome === 'yes' ? 'text-emerald-300' : 'text-emerald-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-emerald-200/90',
                    merchIncome === 'yes' && 'text-emerald-100',
                  )}
                >
                  Yes
                </span>
              </button>
            </div>
            {merchIncome === 'yes' ? (
              <label className="mx-auto block max-w-xs pt-1">
                <span className="mb-1 block text-center text-xs text-neutral-500">How much in sales?</span>
                <div className="flex items-center rounded-lg border border-neutral-700 bg-neutral-950 pl-3">
                  <span className="text-sm text-neutral-500" aria-hidden>
                    $
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={merchSalesInput}
                    onChange={e => setMerchSalesInput(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent px-2 py-3 text-sm text-white placeholder:text-neutral-600"
                    aria-label="Merch sales amount"
                  />
                </div>
              </label>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'production' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>Any production or safety issues?</p>
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Friction areas <span className="font-normal normal-case text-neutral-500">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {PRODUCTION_FRICTION_OPTIONS.map(o => {
                  const on = productionFrictionTags.includes(o.id)
                  return (
                    <Chip
                      key={o.id}
                      active={on}
                      onClick={() =>
                        setProductionFrictionTags(prev =>
                          on ? prev.filter(x => x !== o.id) : [...prev, o.id],
                        )
                      }
                    >
                      {o.label}
                    </Chip>
                  )
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-neutral-400">
                Severity
              </p>
              <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                {(['serious', 'minor', 'none'] as const).map(lvl => (
                  <Chip
                    key={lvl}
                    active={productionIssueLevel === lvl}
                    onClick={() => {
                      if (productionIssueLevel === lvl) return
                      setProductionIssueLevel(lvl)
                      selectAndAdvance()
                    }}
                    className="capitalize"
                  >
                    {lvl}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {currentStep === 'rebooking' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>
              {venueInterest === 'yes'
                ? 'Did they specify when?'
                : 'Is the venue interested in having you back?'}
            </p>
            {venueInterest !== 'yes' ? (
              <div className="mx-auto w-full max-w-[min(100%,calc(8.05rem*2+0.75rem))]">
                <div className="grid grid-cols-2 gap-x-3 gap-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (venueInterest === 'no') return
                      setVenueInterest('no')
                      setRebookingTimeline(null)
                      setRebookingSpecificDate('')
                      selectAndAdvance()
                    }}
                    className={cn(
                      'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                      'border-red-600/60 bg-red-950/50 hover:border-red-500 hover:bg-red-950/70',
                      venueInterest === 'no' &&
                        'border-red-400 bg-red-600/25 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]',
                    )}
                    aria-pressed={venueInterest === 'no'}
                    aria-label="No, venue not interested in having you back"
                  >
                    <X
                      className={cn(
                        'h-12 w-12 stroke-[2.5] shrink-0',
                        venueInterest === 'no' ? 'text-red-300' : 'text-red-400/75',
                      )}
                      aria-hidden
                    />
                    <span
                      className={cn(
                        'text-base font-semibold text-red-200/90',
                        venueInterest === 'no' && 'text-red-100',
                      )}
                    >
                      No
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setVenueInterest('yes')}
                    className={cn(
                      'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                      'border-emerald-600/60 bg-emerald-950/50 hover:border-emerald-500 hover:bg-emerald-950/70',
                    )}
                    aria-pressed={false}
                    aria-label="Yes, venue interested in having you back"
                  >
                    <Check
                      className="h-12 w-12 stroke-[2.5] shrink-0 text-emerald-400/75"
                      aria-hidden
                    />
                    <span className="text-base font-semibold text-emerald-200/90">Yes</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (venueInterest === 'unsure') {
                      selectAndAdvance()
                      return
                    }
                    setVenueInterest('unsure')
                    setRebookingTimeline(null)
                    setRebookingSpecificDate('')
                    selectAndAdvance()
                  }}
                  className={cn(
                    'mt-3 w-full rounded-full border px-4 py-2 text-center text-[11px] font-medium leading-tight transition-colors',
                    'border-neutral-700 bg-neutral-950 text-neutral-400',
                    venueInterest === 'unsure'
                      ? 'border-neutral-500 bg-neutral-900 text-neutral-100'
                      : 'hover:border-neutral-600 hover:bg-neutral-900 hover:text-neutral-200',
                  )}
                  aria-pressed={venueInterest === 'unsure'}
                  aria-label="Unsure if venue wants you back"
                >
                  Unsure
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {REBOOK_OPTIONS.map(o => (
                    <Chip
                      key={o.v}
                      active={rebookingTimeline === o.v}
                      onClick={() => {
                        if (rebookingTimeline === o.v) return
                        setRebookingTimeline(o.v)
                        if (o.v !== 'custom_date') queueMicrotask(selectAndAdvance)
                      }}
                    >
                            {o.label}
                    </Chip>
                  ))}
                </div>
                {rebookingTimeline === 'custom_date' ? (
                  <ChooseCalendarDateField
                    value={rebookingSpecificDate}
                    onChange={v => {
                      const wasEmpty = !rebookingSpecificDate.trim()
                      setRebookingSpecificDate(v)
                      if (wasEmpty && v.trim()) queueMicrotask(selectAndAdvance)
                    }}
                    buttonAriaLabel="Choose rebooking date from calendar"
                  />
                ) : null}
              </div>
            )}
          </div>
        ) : null}

        {currentStep === 'relationship' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>Rate your experience with their company.</p>
            <div className="flex gap-2 sm:gap-3">
              {RELATIONSHIP_ON_SITE_OPTIONS.map(o => {
                const active = relationshipQuality === o.quality
                return (
                  <button
                    key={o.quality}
                    type="button"
                    onClick={() => {
                      if (relationshipQuality === o.quality) {
                        if (
                          o.quality === 'good' ||
                          relationshipExperienceExplain.trim().length > 0
                        ) {
                          selectAndAdvance()
                        }
                        return
                      }
                      setRelationshipQuality(o.quality)
                      setWouldPlayAgain(o.playAgain)
                      if (o.quality === 'good') {
                        setRelationshipExperienceExplain('')
                        selectAndAdvance()
                      }
                    }}
                    className={cn(
                      'flex min-w-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 px-2 py-4 transition-colors',
                      'border-neutral-700 bg-neutral-950/80 hover:border-neutral-500',
                      active &&
                        'border-neutral-300 bg-neutral-900 shadow-[0_0_0_2px_rgba(255,255,255,0.12)]',
                    )}
                    aria-pressed={active}
                    aria-label={`${o.label} on-site relationship`}
                  >
                    <span className="text-[1.75rem] leading-none sm:text-[2rem]" aria-hidden>
                      {o.emoji}
                    </span>
                    <span className="text-center text-xs font-semibold text-neutral-100 sm:text-sm">
                      {o.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {relationshipQuality === 'poor' || relationshipQuality === 'neutral' ? (
              <label className="mx-auto block max-w-md">
                <span className="mb-1.5 block text-center text-xs text-neutral-500">
                  What stood out?
                </span>
                <textarea
                  value={relationshipExperienceExplain}
                  onChange={e => setRelationshipExperienceExplain(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
                  placeholder="A sentence or two is plenty."
                  aria-label="Explain your experience with their company"
                />
              </label>
            ) : null}
          </div>
        ) : null}

        {currentStep === 'referral' ? (
          <div className="space-y-4">
            <p className={STEP_QUESTION_CLASS}>
              Did you receive any New referrals or leads from this Event?
            </p>
            <div className="mx-auto grid w-full max-w-[min(100%,calc(8.05rem*2+0.75rem))] grid-cols-2 gap-x-3 gap-y-[calc(0.5rem*1.35)]">
              <button
                type="button"
                onClick={() => {
                  if (referralLead === 'no') return
                  setReferralLead('no')
                  setReferralDetail('')
                  selectAndAdvance()
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-red-600/60 bg-red-950/50 hover:border-red-500 hover:bg-red-950/70',
                  referralLead === 'no' &&
                    'border-red-400 bg-red-600/25 shadow-[0_0_0_2px_rgba(248,113,113,0.35)]',
                )}
                aria-pressed={referralLead === 'no'}
                aria-label="No new referrals or leads from this Event"
              >
                <X
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    referralLead === 'no' ? 'text-red-300' : 'text-red-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-red-200/90',
                    referralLead === 'no' && 'text-red-100',
                  )}
                >
                  No
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (referralLead === 'yes') return
                  setReferralLead('yes')
                }}
                className={cn(
                  'flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 transition-colors',
                  'border-emerald-600/60 bg-emerald-950/50 hover:border-emerald-500 hover:bg-emerald-950/70',
                  referralLead === 'yes' &&
                    'border-emerald-400 bg-emerald-600/25 shadow-[0_0_0_2px_rgba(52,211,153,0.35)]',
                )}
                aria-pressed={referralLead === 'yes'}
                aria-label="Yes, received new referrals or leads from this Event"
              >
                <Check
                  className={cn(
                    'h-12 w-12 stroke-[2.5] shrink-0',
                    referralLead === 'yes' ? 'text-emerald-300' : 'text-emerald-400/75',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-base font-semibold text-emerald-200/90',
                    referralLead === 'yes' && 'text-emerald-100',
                  )}
                >
                  Yes
                </span>
              </button>
            </div>
            {referralLead === 'yes' ? (
              <textarea
                value={referralDetail}
                onChange={e => setReferralDetail(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-600"
                placeholder="Who / context"
              />
            ) : null}
          </div>
        ) : null}

        {currentStep === 'extras' ? (
          <div className="space-y-3">
            <p className={STEP_QUESTION_CLASS}>Anything else to add?</p>
            <label className="block">
              <span className="text-xs text-neutral-500">Notes</span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm"
              />
            </label>
          </div>
        ) : null}
          </div>

        {footerShowBar ? (
          <div
            className={cn(
              'flex shrink-0 gap-2 border-t border-neutral-800 bg-black pt-3',
              footerMode === 'viewport'
                ? 'pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]'
                : 'pb-1',
            )}
          >
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={goBack}
                className="min-h-[48px] flex-1 rounded-lg border border-neutral-600 text-sm font-medium text-neutral-200 hover:bg-neutral-900"
              >
                Back
              </button>
            ) : null}
            {footerShowSubmit ? (
              <button
                type="button"
                disabled={!canAdvance || ui === 'submitting'}
                onClick={() => void handleSubmit()}
                className={cn(
                  'min-h-[48px] flex-[2] rounded-lg text-sm font-semibold text-black bg-white hover:bg-neutral-100',
                  (!canAdvance || ui === 'submitting') && 'opacity-40 cursor-not-allowed hover:bg-white',
                )}
              >
                {ui === 'submitting' ? 'Sending…' : 'Submit report'}
              </button>
            ) : footerShowNext ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={goNext}
                className={cn(
                  'min-h-[48px] flex-[2] rounded-lg text-sm font-semibold text-black bg-white hover:bg-neutral-100',
                  !canAdvance && 'opacity-40 cursor-not-allowed',
                )}
              >
                Next
              </button>
            ) : null}
          </div>
        ) : null}
        </div>

      {!preview ? (
        <p className="mx-auto mt-3 w-full max-w-md shrink-0 pb-4 pt-1 text-center text-xs font-medium text-neutral-400">
          {submittedBy === 'manager_dashboard' ? 'Submits like the artist link.' : 'One-time link.'}
        </p>
      ) : null}
      </>
    </PublicFormLayout>
  )
}
