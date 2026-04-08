import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { EmailCaptureKind } from '@/lib/emailCapture/kinds'
import {
  isEmailCaptureKind,
  EMAIL_CAPTURE_KIND_FORM_DESCRIPTORS,
  EMAIL_CAPTURE_KIND_FORM_TITLES,
} from '@/lib/emailCapture/kinds'
import { PublicFormLayout } from '@/components/public/PublicFormLayout'
import {
  DEFAULT_PUBLIC_FORM_BRANDING,
  mergePublicFormBranding,
  type PublicFormBranding,
} from '@/lib/publicFormBranding'
import { cn } from '@/lib/utils'

type PreflightOk =
  | { valid: false }
  | { valid: true; submitted: true; kind: EmailCaptureKind; venueName: string | null; branding: PublicFormBranding }
  | {
      valid: true
      submitted: false
      kind: EmailCaptureKind
      venueName: string | null
      dealDescription: string | null
      eventDate: string | null
      branding: PublicFormBranding
    }

type CaptureProgressCtx = { setProgressPct: (n: number) => void }
const EmailCaptureProgressContext = createContext<CaptureProgressCtx | null>(null)

/** Progress by questions completed vs total (each screen / choice counts as one question). */
function useCaptureQuestionProgress(completed: number, total: number) {
  const ctx = useContext(EmailCaptureProgressContext)
  useEffect(() => {
    if (!ctx) return
    const t = Math.max(1, total)
    ctx.setProgressPct(Math.min(100, Math.round((Math.max(0, completed) / t) * 100)))
  }, [ctx, completed, total])
}

type EmailCaptureFooterVariant = 'viewport' | 'embedded'
const EmailCaptureFooterContext = createContext<EmailCaptureFooterVariant>('viewport')

function useScrollTopOnStepChange(step: number) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])
}

function ChoiceRow({
  label,
  selected,
  onSelect,
}: {
  label: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors ${
        selected
          ? 'border-white bg-neutral-800 text-white'
          : 'border-neutral-600 bg-neutral-950 text-neutral-100 hover:border-neutral-500 hover:bg-neutral-900'
      }`}
    >
      {label}
    </button>
  )
}

export default function EmailCaptureForm() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [preflight, setPreflight] = useState<PreflightOk>({ valid: false })
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [progressPct, setProgressPct] = useState(0)
  const [progressSuccessFlash, setProgressSuccessFlash] = useState(false)

  const load = useCallback(async () => {
    if (!token) {
      setPreflight({ valid: false })
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/.netlify/functions/get-email-capture?token=${encodeURIComponent(token)}`)
      const data = await res.json()
      if (data?.valid && isEmailCaptureKind(String(data.kind))) {
        const branding = mergePublicFormBranding(data.branding)
        if (data.submitted) {
          setPreflight({
            valid: true,
            submitted: true,
            kind: data.kind,
            venueName: data.venueName ?? null,
            branding,
          })
        } else {
          setPreflight({
            valid: true,
            submitted: false,
            kind: data.kind,
            venueName: data.venueName ?? null,
            dealDescription: data.dealDescription ?? null,
            eventDate: data.eventDate ?? null,
            branding,
          })
          setProgressPct(0)
          setProgressSuccessFlash(false)
        }
      } else {
        setPreflight({ valid: false })
      }
    } catch {
      setPreflight({ valid: false })
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  const submit = async (payload: Record<string, unknown>) => {
    if (!token) return
    setSubmitting(true)
    setErr(null)
    try {
      const res = await fetch('/.netlify/functions/submit-email-capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(typeof data.message === 'string' ? data.message : 'Could not save. Try again.')
        return
      }
      setProgressPct(100)
      setProgressSuccessFlash(true)
      await new Promise<void>(resolve => {
        window.setTimeout(resolve, 520)
      })
      setProgressSuccessFlash(false)
      setProgressPct(0)
      await load()
    } catch {
      setErr('Network error. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-200 text-sm px-4">
        Invalid link
      </div>
    )
  }

  if (loading) {
    return (
      <PublicFormLayout
        branding={DEFAULT_PUBLIC_FORM_BRANDING}
        title="Quick response"
        descriptor="Loading…"
        progress={0}
        showProgress={false}
        mainClassName="flex flex-1 flex-col items-center justify-center py-24"
      >
        <Loader2 className="h-8 w-8 text-neutral-300 animate-spin" aria-hidden />
      </PublicFormLayout>
    )
  }

  if (!preflight.valid) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-neutral-200 text-sm px-6 text-center max-w-md mx-auto">
        This link is invalid or has expired. If you need help, reply to the email you received.
      </div>
    )
  }

  if (preflight.submitted) {
    return (
      <PublicFormLayout
        branding={preflight.branding}
        title="Thank you"
        descriptor="Response received"
        progress={0}
        mainClassName="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center"
      >
        <CheckCircle2 className="h-12 w-12 text-green-500 mb-4 shrink-0" aria-hidden />
        <p className="text-sm text-neutral-200 max-w-sm">
          Your response was received{preflight.venueName ? ` for ${preflight.venueName}` : ''}. You can close this page.
        </p>
      </PublicFormLayout>
    )
  }

  const ctx = preflight

  return (
    <PublicFormLayout
      branding={ctx.branding}
      title={EMAIL_CAPTURE_KIND_FORM_TITLES[ctx.kind]}
      descriptor={EMAIL_CAPTURE_KIND_FORM_DESCRIPTORS[ctx.kind]}
      progress={progressPct}
      progressSuccessFlash={progressSuccessFlash}
      mainClassName="pb-44 pt-6"
    >
      {err ? (
        <div className="mb-4 text-sm text-red-400 bg-red-950/40 border border-red-900 rounded-lg px-3 py-2">
          {err}
        </div>
      ) : null}

      <EmailCaptureProgressContext.Provider value={{ setProgressPct }}>
        <EmailCaptureKindForm kind={ctx.kind} submitting={submitting} onSubmit={submit} />
      </EmailCaptureProgressContext.Provider>
    </PublicFormLayout>
  )
}

export function EmailCaptureKindForm({
  kind,
  submitting,
  onSubmit,
  footerVariant = 'viewport',
}: {
  kind: EmailCaptureKind
  submitting: boolean
  onSubmit: (p: Record<string, unknown>) => void
  /** `embedded`: sticky footer inside scroll container (dashboard preview). */
  footerVariant?: EmailCaptureFooterVariant
}) {
  return (
    <EmailCaptureFooterContext.Provider value={footerVariant}>
      <EmailCaptureKindFormInner kind={kind} submitting={submitting} onSubmit={onSubmit} />
    </EmailCaptureFooterContext.Provider>
  )
}

function EmailCaptureKindFormInner({
  kind,
  submitting,
  onSubmit,
}: {
  kind: EmailCaptureKind
  submitting: boolean
  onSubmit: (p: Record<string, unknown>) => void
}) {
  switch (kind) {
    case 'pre_event_checkin':
      return <PreEventForm submitting={submitting} onSubmit={onSubmit} />
    case 'first_outreach':
      return <FirstOutreachForm submitting={submitting} onSubmit={onSubmit} />
    case 'follow_up':
      return <FollowUpForm submitting={submitting} onSubmit={onSubmit} />
    case 'show_cancelled_or_postponed':
      return <CancelledForm submitting={submitting} onSubmit={onSubmit} />
    case 'agreement_followup':
      return <AgreementFollowupForm submitting={submitting} onSubmit={onSubmit} />
    case 'agreement_ready':
      return <AgreementReadyForm submitting={submitting} onSubmit={onSubmit} />
    case 'booking_confirmation':
    case 'booking_confirmed':
      return <BookingConfirmForm submitting={submitting} onSubmit={onSubmit} />
    case 'invoice_sent':
      return <InvoiceForm submitting={submitting} onSubmit={onSubmit} />
    case 'post_show_thanks':
      return <PostShowForm submitting={submitting} onSubmit={onSubmit} />
    case 'pass_for_now':
      return <PassAckForm submitting={submitting} onSubmit={onSubmit} />
    case 'rebooking_inquiry':
      return <RebookingForm submitting={submitting} onSubmit={onSubmit} />
    case 'payment_reminder_ack':
      return <PaymentAckForm submitting={submitting} onSubmit={onSubmit} />
    case 'payment_receipt':
      return <PaymentReceiptForm submitting={submitting} onSubmit={onSubmit} />
    default:
      return <p className="text-sm text-neutral-300">Unsupported form type.</p>
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
  className,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
  className?: string
}) {
  const cls =
    'w-full rounded-lg border border-neutral-600 bg-neutral-950 px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-neutral-500'
  return (
    <label className={cn('block mb-4', className)}>
      <span className="block text-xs font-semibold tracking-wide text-neutral-100 mb-1.5">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  )
}

function captureFooterWrap(footerVariant: EmailCaptureFooterVariant, children: ReactNode) {
  if (footerVariant === 'embedded') {
    return (
      <div className="sticky bottom-0 z-10 mt-8 -mx-4 px-4 pt-4 pb-3 bg-black/95 border-t border-neutral-700 backdrop-blur-sm">
        {children}
      </div>
    )
  }
  return <div className="fixed bottom-0 left-0 right-0 p-4 bg-black/95 border-t border-neutral-700">{children}</div>
}

function SubmitBar({ submitting, disabled }: { submitting: boolean; disabled?: boolean }) {
  const footerVariant = useContext(EmailCaptureFooterContext)
  const bar = (
    <div className="max-w-lg mx-auto">
      <button
        type="submit"
        disabled={submitting || disabled}
        className="w-full min-h-[48px] rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Submit
      </button>
    </div>
  )
  return captureFooterWrap(footerVariant, bar)
}

function ContinueBar({ onClick, disabled, submitting = false }: { onClick: () => void; disabled?: boolean; submitting?: boolean }) {
  const footerVariant = useContext(EmailCaptureFooterContext)
  const bar = (
    <div className="max-w-lg mx-auto">
      <button
        type="button"
        onClick={onClick}
        disabled={submitting || disabled}
        className="w-full min-h-[48px] rounded-lg bg-white text-black text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2"
      >
        Continue
      </button>
    </div>
  )
  return captureFooterWrap(footerVariant, bar)
}

const PRE_EVENT_STEP_LABELS = [
  'Load-in / soundcheck window',
  'Settlement method',
  'Day-of contact name',
  'Day-of phone',
  'Day-of email',
  'Parking / load-in notes',
  'Rider or tech info (link)',
] as const

function PreEventForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [loadInOrSoundcheck, setLoadIn] = useState('')
  const [settlementMethod, setSettle] = useState('')
  const [dayOfContactName, setName] = useState('')
  const [dayOfContactPhone, setPhone] = useState('')
  const [dayOfContactEmail, setEmail] = useState('')
  const [parkingNotes, setPark] = useState('')
  const [riderOrTechUrl, setRider] = useState('')

  useScrollTopOnStepChange(step)

  const nPreEvent = PRE_EVENT_STEP_LABELS.length
  useCaptureQuestionProgress(step, nPreEvent)

  const canSubmit = loadInOrSoundcheck.trim() || settlementMethod.trim()

  return (
    <div className="pb-28">
      <p className="text-sm text-neutral-200 mb-6">
        Share load-in, settlement, and day-of contact details — one question at a time.
      </p>
      {step === 0 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[0]} value={loadInOrSoundcheck} onChange={setLoadIn} placeholder="e.g. 5pm load-in, 8pm soundcheck" className="mb-6" />
          <ContinueBar onClick={() => setStep(1)} submitting={submitting} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[1]} value={settlementMethod} onChange={setSettle} placeholder="Check, wire, night-of cash…" className="mb-6" />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[2]} value={dayOfContactName} onChange={setName} className="mb-6" />
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[3]} value={dayOfContactPhone} onChange={setPhone} className="mb-6" />
          <ContinueBar onClick={() => setStep(4)} submitting={submitting} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[4]} value={dayOfContactEmail} onChange={setEmail} className="mb-6" />
          <ContinueBar onClick={() => setStep(5)} submitting={submitting} />
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Field label={PRE_EVENT_STEP_LABELS[5]} value={parkingNotes} onChange={setPark} textarea className="mb-6" />
          <ContinueBar onClick={() => setStep(6)} submitting={submitting} />
        </>
      ) : null}
      {step === 6 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit({
              loadInOrSoundcheck: loadInOrSoundcheck.trim(),
              settlementMethod: settlementMethod.trim(),
              dayOfContactName: dayOfContactName.trim(),
              dayOfContactPhone: dayOfContactPhone.trim(),
              dayOfContactEmail: dayOfContactEmail.trim(),
              parkingNotes: parkingNotes.trim(),
              riderOrTechUrl: riderOrTechUrl.trim(),
            })
          }}
        >
          <Field label={PRE_EVENT_STEP_LABELS[6]} value={riderOrTechUrl} onChange={setRider} placeholder="https://…" className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!canSubmit} />
        </form>
      ) : null}
    </div>
  )
}

function FirstOutreachForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [intent, setIntent] = useState<'interested' | 'not_now' | 'wrong_person' | ''>('')
  const [note, setNote] = useState('')
  const [alternateEmail, setAlt] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 3)

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Where should we take this?</p>
          <ChoiceRow
            label="Interested — let&apos;s explore a date"
            selected={intent === 'interested'}
            onSelect={() => {
              setIntent('interested')
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Not for us right now"
            selected={intent === 'not_now'}
            onSelect={() => {
              setIntent('not_now')
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Wrong contact — point me to the right person"
            selected={intent === 'wrong_person'}
            onSelect={() => {
              setIntent('wrong_person')
              setStep(1)
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} disabled={!intent} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!intent) return
            onSubmit({ intent, note: note.trim(), alternateEmail: alternateEmail.trim() })
          }}
        >
          <Field label="Alternate email (optional)" value={alternateEmail} onChange={setAlt} className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!intent} />
        </form>
      ) : null}
    </div>
  )
}

function FollowUpForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'interested' | 'need_info' | 'pass' | ''>('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 2)

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Quick check-in</p>
          <ChoiceRow
            label="Still interested"
            selected={status === 'interested'}
            onSelect={() => {
              setStatus('interested')
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Need more info"
            selected={status === 'need_info'}
            onSelect={() => {
              setStatus('need_info')
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Passing for now"
            selected={status === 'pass'}
            onSelect={() => {
              setStatus('pass')
              setStep(1)
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!status) return
            onSubmit({ status, note: note.trim() })
          }}
        >
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!status} />
        </form>
      ) : null}
    </div>
  )
}

function CancelledForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [resolution, setRes] = useState<'new_date' | 'refund' | 'release' | 'other' | ''>('')
  const [newEventDate, setDate] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  const cancelledTotal = resolution === 'new_date' ? 3 : resolution ? 2 : 3
  const cancelledCompleted =
    step === 0 ? 0 : resolution === 'new_date' ? Math.min(step, 2) : 1
  useCaptureQuestionProgress(cancelledCompleted, cancelledTotal)

  const pickResolution = (r: typeof resolution) => {
    setRes(r)
    if (r === 'new_date') setStep(1)
    else setStep(2)
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">What should we know?</p>
          <ChoiceRow label="New date" selected={resolution === 'new_date'} onSelect={() => pickResolution('new_date')} />
          <ChoiceRow label="Refund path" selected={resolution === 'refund'} onSelect={() => pickResolution('refund')} />
          <ChoiceRow label="Mutual release" selected={resolution === 'release'} onSelect={() => pickResolution('release')} />
          <ChoiceRow label="Other" selected={resolution === 'other'} onSelect={() => pickResolution('other')} />
        </>
      ) : null}
      {step === 1 && resolution === 'new_date' ? (
        <>
          <Field label="New event date" value={newEventDate} onChange={setDate} placeholder="YYYY-MM-DD" className="mb-6" />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} disabled={!resolution} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!resolution) return
            onSubmit({
              resolution,
              newEventDate: newEventDate.trim(),
              note: note.trim(),
            })
          }}
        >
          <Field label="Notes" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!resolution} />
        </form>
      ) : null}
    </div>
  )
}

function AgreementFollowupForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [status, setSt] = useState<'signed' | 'in_review' | 'needs_changes' | ''>('')
  const [note, setNote] = useState('')
  const [documentUrl, setUrl] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 3)

  const pick = (s: typeof status) => {
    setSt(s)
    setStep(1)
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Agreement status</p>
          <ChoiceRow label="Signed" selected={status === 'signed'} onSelect={() => pick('signed')} />
          <ChoiceRow label="In review" selected={status === 'in_review'} onSelect={() => pick('in_review')} />
          <ChoiceRow label="Needs changes" selected={status === 'needs_changes'} onSelect={() => pick('needs_changes')} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} disabled={!status} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!status) return
            onSubmit({ status, note: note.trim(), documentUrl: documentUrl.trim() })
          }}
        >
          <Field label="Document link (optional)" value={documentUrl} onChange={setUrl} className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!status} />
        </form>
      ) : null}
    </div>
  )
}

function AgreementReadyForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [ack, setAck] = useState(false)
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 2)

  return (
    <div className="pb-28 space-y-4">
      {step === 0 ? (
        <>
          <button
            type="button"
            onClick={() => {
              setAck(true)
              setStep(1)
            }}
            className="min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm font-medium transition-colors border-neutral-600 bg-neutral-950 text-neutral-100 hover:border-neutral-500 hover:bg-neutral-900"
          >
            <span className="font-semibold text-white block mb-1">I have reviewed the agreement</span>
            <span className="text-neutral-300 text-xs">Including the link shared by email</span>
          </button>
        </>
      ) : null}
      {step === 1 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit({ acknowledged: ack, note: note.trim() })
          }}
        >
          <Field label="Questions or comments (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!ack} />
        </form>
      ) : null}
    </div>
  )
}

function BookingConfirmForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [aligned, setAligned] = useState<boolean | null>(null)
  const [corrections, setCorr] = useState('')

  useScrollTopOnStepChange(step)
  const bookingProgress =
    aligned === true ? { c: 1, t: 1 } : aligned === false ? { c: step, t: 2 } : { c: 0, t: 2 }
  useCaptureQuestionProgress(bookingProgress.c, bookingProgress.t)

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Do the details match?</p>
          <ChoiceRow
            label="Details look correct"
            selected={aligned === true}
            onSelect={() => {
              setAligned(true)
              onSubmit({ aligned: true, corrections: '' })
            }}
          />
          <ChoiceRow
            label="Something needs a correction"
            selected={aligned === false}
            onSelect={() => {
              setAligned(false)
              setStep(1)
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (aligned !== false) return
            onSubmit({ aligned: false, corrections: corrections.trim() })
          }}
        >
          <Field label="What should change?" value={corrections} onChange={setCorr} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={aligned !== false || !corrections.trim()} />
        </form>
      ) : null}
    </div>
  )
}

function InvoiceForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [received, setRec] = useState<boolean | null>(null)
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 2)

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Invoice status</p>
          <ChoiceRow
            label="Received in AP / accounting"
            selected={received === true}
            onSelect={() => {
              setRec(true)
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Not yet / issue"
            selected={received === false}
            onSelect={() => {
              setRec(false)
              setStep(1)
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (received === null) return
            onSubmit({ receivedInAp: received, note: note.trim() })
          }}
        >
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={received === null} />
        </form>
      ) : null}
    </div>
  )
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2 mb-1">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-3xl leading-none transition-colors ${star <= value ? 'text-yellow-400' : 'text-neutral-500 hover:text-neutral-300'}`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          &#9733;
        </button>
      ))}
    </div>
  )
}

function PostShowForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [rating, setRating] = useState(0)
  const [nothing, setN] = useState<boolean | null>(null)
  const [detail, setD] = useState('')
  const [comments, setComments] = useState('')

  useScrollTopOnStepChange(step)
  const postShowTotal = nothing === false ? 5 : nothing === true ? 4 : 5
  const postShowCompleted =
    step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : step === 3 || step === 4 ? 3 : 0
  useCaptureQuestionProgress(postShowCompleted, postShowTotal)

  const doSubmit = () => {
    if (rating === 0 || nothing === null) return
    onSubmit({ rating, nothingPending: nothing, detail: detail.trim(), comments: comments.trim() })
  }

  return (
    <div className="pb-28 space-y-4">
      {step === 0 ? (
        <>
          <p className="text-xs font-medium text-neutral-200 mb-2">How was the show? (required)</p>
          <StarRating
            value={rating}
            onChange={v => {
              setRating(v)
              setStep(1)
            }}
          />
          {rating > 0 ? (
            <p className="text-xs text-neutral-300 mt-1">
              {rating === 5 ? 'Excellent' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
            </p>
          ) : null}
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field
            label="Comments (optional)"
            value={comments}
            onChange={setComments}
            textarea
            placeholder="Anything you'd like us to know about the night..."
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} disabled={rating === 0} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="text-xs font-medium text-neutral-200 mb-2">Anything still open?</p>
          <ChoiceRow
            label="Nothing pending on our side"
            selected={nothing === true}
            onSelect={() => {
              setN(true)
              setStep(4)
            }}
          />
          <ChoiceRow
            label="Something is still open"
            selected={nothing === false}
            onSelect={() => {
              setN(false)
              setStep(3)
            }}
          />
        </>
      ) : null}
      {step === 3 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            doSubmit()
          }}
        >
          <Field label="What&apos;s open?" value={detail} onChange={setD} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={rating === 0 || nothing !== false || !detail.trim()} />
        </form>
      ) : null}
      {step === 4 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            doSubmit()
          }}
        >
          <p className="text-sm text-neutral-200 mb-4">Thanks — send your feedback?</p>
          <SubmitBar submitting={submitting} disabled={rating === 0 || nothing !== true} />
        </form>
      ) : null}
    </div>
  )
}

function PassAckForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  useCaptureQuestionProgress(0, 1)

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({})
      }}
      className="pb-28"
    >
      <p className="text-sm text-neutral-200 mb-6">One tap to acknowledge — nothing else required.</p>
      <SubmitBar submitting={submitting} />
    </form>
  )
}

function RebookingForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [availability, setA] = useState('')

  useCaptureQuestionProgress(availability.trim() ? 1 : 0, 1)

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({ availability: availability.trim() })
      }}
      className="pb-28"
    >
      <Field label="Availability, preferred months, or holds" value={availability} onChange={setA} textarea />
      <SubmitBar submitting={submitting} disabled={!availability.trim()} />
    </form>
  )
}

function PaymentAckForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [submitted, setS] = useState<boolean | null>(null)
  const [reference, setR] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 2)

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Payment status</p>
          <ChoiceRow
            label="Payment has been sent"
            selected={submitted === true}
            onSelect={() => {
              setS(true)
              setStep(1)
            }}
          />
          <ChoiceRow
            label="Not sent yet"
            selected={submitted === false}
            onSelect={() => {
              setS(false)
              setStep(1)
            }}
          />
        </>
      ) : null}
      {step === 1 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (submitted === null) return
            onSubmit({ submittedPayment: submitted, reference: reference.trim() })
          }}
        >
          <Field label="Reference # (optional)" value={reference} onChange={setR} className="mb-6" />
          <SubmitBar submitting={submitting} disabled={submitted === null} />
        </form>
      ) : null}
    </div>
  )
}

function PaymentReceiptForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [rebookInterest, setInterest] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [preferredDates, setDates] = useState('')
  const [budgetNote, setBudget] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  const receiptTotal = rebookInterest === 'no' ? 2 : rebookInterest ? 4 : 4
  const receiptCompleted =
    rebookInterest === 'no' ? (step === 0 ? 0 : 1) : rebookInterest ? step : 0
  useCaptureQuestionProgress(receiptCompleted, receiptTotal)

  const pickInterest = (v: 'yes' | 'maybe' | 'no') => {
    setInterest(v)
    if (v === 'no') setStep(3)
    else setStep(1)
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-4">Are you interested in booking again?</p>
          <ChoiceRow label="Yes — let&apos;s plan the next one" selected={rebookInterest === 'yes'} onSelect={() => pickInterest('yes')} />
          <ChoiceRow label="Maybe — open to it" selected={rebookInterest === 'maybe'} onSelect={() => pickInterest('maybe')} />
          <ChoiceRow label="Not right now" selected={rebookInterest === 'no'} onSelect={() => pickInterest('no')} />
        </>
      ) : null}
      {step === 1 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <>
          <Field
            label="Preferred dates or months (optional)"
            value={preferredDates}
            onChange={setDates}
            placeholder="e.g. June or July 2026"
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} />
        </>
      ) : null}
      {step === 2 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <>
          <Field
            label="Rough budget or fee range (optional)"
            value={budgetNote}
            onChange={setBudget}
            placeholder="e.g. same as last time, $500–$800"
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} />
        </>
      ) : null}
      {step === 3 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!rebookInterest) return
            onSubmit({
              rebookInterest,
              preferredDates: preferredDates.trim(),
              budgetNote: budgetNote.trim(),
              note: note.trim(),
            })
          }}
        >
          <Field label="Anything else to add? (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!rebookInterest} />
        </form>
      ) : null}
    </div>
  )
}

export interface EmailCaptureFormPreviewBodyProps {
  kind: EmailCaptureKind
  branding?: PublicFormBranding
}

/** Dashboard: exercise capture UI without token or Netlify calls. */
export function EmailCaptureFormPreviewBody({
  kind,
  branding: brandingProp,
}: EmailCaptureFormPreviewBodyProps) {
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [progressPct, setProgressPct] = useState(0)
  const [progressFlash, setProgressFlash] = useState(false)
  const branding = mergePublicFormBranding(brandingProp)

  const handleSubmit = (_payload: Record<string, unknown>) => {
    setSubmitting(true)
    setProgressPct(100)
    setProgressFlash(true)
    window.setTimeout(() => {
      setProgressFlash(false)
      setProgressPct(0)
      setSubmitting(false)
      setDone(true)
    }, 520)
  }

  if (done) {
    return (
      <PublicFormLayout
        branding={branding}
        title="Preview complete"
        descriptor="Nothing was saved"
        progress={0}
        rootClassName="bg-black text-neutral-50 min-h-0 flex-1 flex flex-col antialiased"
        mainClassName="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 shrink-0" aria-hidden />
        <p className="text-sm text-neutral-200 max-w-sm">
          Choose another form in the sidebar to keep testing.
        </p>
      </PublicFormLayout>
    )
  }

  return (
    <PublicFormLayout
      branding={branding}
      title={EMAIL_CAPTURE_KIND_FORM_TITLES[kind]}
      descriptor={EMAIL_CAPTURE_KIND_FORM_DESCRIPTORS[kind]}
      progress={progressPct}
      progressSuccessFlash={progressFlash}
      rootClassName="bg-black text-neutral-50 min-h-0 flex-1 flex flex-col antialiased"
      mainClassName="pb-36 pt-4"
    >
      <EmailCaptureProgressContext.Provider value={{ setProgressPct }}>
        <EmailCaptureKindForm
          kind={kind}
          submitting={submitting}
          onSubmit={handleSubmit}
          footerVariant="embedded"
        />
      </EmailCaptureProgressContext.Provider>
    </PublicFormLayout>
  )
}
