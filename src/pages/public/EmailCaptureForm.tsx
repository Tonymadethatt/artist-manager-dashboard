import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { EmailCaptureKind } from '@/lib/emailCapture/kinds'
import { isEmailCaptureKind, EMAIL_CAPTURE_KIND_FORM_TITLES } from '@/lib/emailCapture/kinds'
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

function MultiChoiceGrid({
  options,
  selected,
  onToggle,
  className,
}: {
  options: { value: string; label: string }[]
  selected: string[]
  onToggle: (value: string) => void
  className?: string
}) {
  return (
    <div className={cn('grid grid-cols-2 gap-2 mb-4', className)}>
      {options.map(o => {
        const on = selected.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onToggle(o.value)}
            className={`min-h-[44px] px-2 py-2.5 rounded-lg border text-xs sm:text-sm text-center transition-colors ${
              on
                ? 'border-white bg-neutral-800 text-white font-medium'
                : 'border-neutral-600 bg-neutral-950 text-neutral-100 hover:border-neutral-500'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
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
        title="Loading…"
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

const PRE_EVENT_CAPACITY_OPTIONS = [
  { value: 'under_100', label: 'Under 100' },
  { value: '100_300', label: '100–300' },
  { value: '300_500', label: '300–500' },
  { value: 'over_500', label: '500+' },
  { value: 'not_sure', label: 'Not sure' },
] as const

const PRE_EVENT_GENRE_OPTIONS = [
  { value: 'hip_hop_rnb', label: 'Hip-Hop / R&B' },
  { value: 'latin', label: 'Latin / Reggaeton' },
  { value: 'edm', label: 'EDM / Dance' },
  { value: 'top_40', label: 'Top 40 / Open Format' },
  { value: 'other_genre', label: 'Other' },
] as const

const PRE_EVENT_MEDIA_OPTIONS = [
  { value: 'venue_provides', label: 'Yes — venue is providing one' },
  { value: 'artist_brings', label: 'No — artist should bring their own' },
  { value: 'not_sure', label: 'Not sure yet' },
] as const

/** Stored as human-readable lines in deal/outreach notes (no extra server mapping). */
const PRE_EVENT_LOADIN_OPTIONS = [
  { value: 'afternoon', label: 'Afternoon load-in (typically before 5pm)' },
  { value: 'early_evening', label: 'Early evening (~5–7pm)' },
  { value: 'close_to_doors', label: 'Close to doors — shorter window' },
  { value: 'soundcheck_before_doors', label: 'Soundcheck shortly before doors' },
  { value: 'venue_coordinated', label: 'Venue / production will confirm timing' },
  { value: 'not_sure', label: 'Not sure yet' },
] as const

const PRE_EVENT_SETTLEMENT_OPTIONS = [
  { value: 'check_night', label: 'Check at end of night' },
  { value: 'wire_ach', label: 'Wire or ACH' },
  { value: 'cash_night', label: 'Cash night-of' },
  { value: 'card', label: 'Card / credit' },
  { value: 'deposit_balance', label: 'Deposit + balance (split schedule)' },
  { value: 'per_contract', label: 'Per our signed agreement' },
  { value: 'not_sure', label: 'Not sure yet' },
] as const

function PreEventForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [loadInOrSoundcheck, setLoadIn] = useState('')
  const [venueCapacity, setCap] = useState('')
  const [genrePreference, setGenre] = useState<string[]>([])
  const [settlementMethod, setSettle] = useState('')
  const [dayOfContactName, setName] = useState('')
  const [dayOfContactPhone, setPhone] = useState('')
  const [dayOfContactEmail, setEmail] = useState('')
  const [parkingNotes, setPark] = useState('')
  const [mediaOnSite, setMedia] = useState('')
  const [riderOrTechUrl, setRider] = useState('')

  useScrollTopOnStepChange(step)

  const nPreEvent = 10
  useCaptureQuestionProgress(step, nPreEvent)

  const canSubmit = Boolean(loadInOrSoundcheck.trim() && settlementMethod.trim())

  const toggleGenre = (v: string) => {
    setGenre(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  }

  return (
    <div className="pb-28">
      {step === 0 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">When is load-in or soundcheck?</p>
          <div className="flex flex-col gap-2 mb-2">
            {PRE_EVENT_LOADIN_OPTIONS.map(o => (
              <ChoiceRow
                key={o.value}
                label={o.label}
                selected={loadInOrSoundcheck === o.label}
                onSelect={() => {
                  setLoadIn(o.label)
                  setStep(1)
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      {step === 1 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">Roughly how many people does the space hold?</p>
          <div className="flex flex-col gap-2 mb-6">
            {PRE_EVENT_CAPACITY_OPTIONS.map(o => (
              <ChoiceRow key={o.value} label={o.label} selected={venueCapacity === o.value} onSelect={() => { setCap(o.value); setStep(2) }} />
            ))}
          </div>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">What kind of music or vibe is the crowd into? <span className="text-neutral-400 font-normal">(optional)</span></p>
          <MultiChoiceGrid options={[...PRE_EVENT_GENRE_OPTIONS]} selected={genrePreference} onToggle={toggleGenre} />
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">How is payment handled for this show?</p>
          <div className="flex flex-col gap-2 mb-2">
            {PRE_EVENT_SETTLEMENT_OPTIONS.map(o => (
              <ChoiceRow
                key={o.value}
                label={o.label}
                selected={settlementMethod === o.label}
                onSelect={() => {
                  setSettle(o.label)
                  setStep(4)
                }}
              />
            ))}
          </div>
        </>
      ) : null}
      {step === 4 ? (
        <>
          <Field label="Day-of contact name" value={dayOfContactName} onChange={setName} className="mb-6" />
          <ContinueBar onClick={() => setStep(5)} submitting={submitting} />
        </>
      ) : null}
      {step === 5 ? (
        <>
          <Field label="Day-of phone" value={dayOfContactPhone} onChange={setPhone} className="mb-6" />
          <ContinueBar onClick={() => setStep(6)} submitting={submitting} />
        </>
      ) : null}
      {step === 6 ? (
        <>
          <Field label="Day-of email" value={dayOfContactEmail} onChange={setEmail} className="mb-6" />
          <ContinueBar onClick={() => setStep(7)} submitting={submitting} />
        </>
      ) : null}
      {step === 7 ? (
        <>
          <Field label="Parking / load-in notes" value={parkingNotes} onChange={setPark} textarea className="mb-6" />
          <ContinueBar onClick={() => setStep(8)} submitting={submitting} />
        </>
      ) : null}
      {step === 8 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">Will there be a photographer or videographer at the event?</p>
          <div className="flex flex-col gap-2 mb-6">
            {PRE_EVENT_MEDIA_OPTIONS.map(o => (
              <ChoiceRow key={o.value} label={o.label} selected={mediaOnSite === o.value} onSelect={() => { setMedia(o.value); setStep(9) }} />
            ))}
          </div>
        </>
      ) : null}
      {step === 9 ? (
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
              venueCapacity: venueCapacity || undefined,
              genrePreference: genrePreference.length ? genrePreference : undefined,
              mediaOnSite: mediaOnSite || undefined,
            })
          }}
        >
          <Field label="Rider or tech info (link)" value={riderOrTechUrl} onChange={setRider} placeholder="https://…" className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!canSubmit} />
        </form>
      ) : null}
    </div>
  )
}

function FirstOutreachForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [intent, setIntent] = useState<'interested' | 'not_now' | 'wrong_person' | ''>('')
  const [preferredContactMethod, setPref] = useState('')
  const [note, setNote] = useState('')
  const [referralSource, setRefSrc] = useState('')
  const [alternateEmail, setAlt] = useState('')
  const [alternateContactName, setAltName] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 5)

  const pickIntent = (i: typeof intent) => {
    setIntent(i)
    setStep(1)
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Where should we take this?</p>
          <ChoiceRow label="Interested — let&apos;s explore a date" selected={intent === 'interested'} onSelect={() => pickIntent('interested')} />
          <ChoiceRow label="Not for us right now" selected={intent === 'not_now'} onSelect={() => pickIntent('not_now')} />
          <ChoiceRow label="Wrong contact — point me to the right person" selected={intent === 'wrong_person'} onSelect={() => pickIntent('wrong_person')} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">What&apos;s the best way to reach you going forward?</p>
          <ChoiceRow label="Email" selected={preferredContactMethod === 'email'} onSelect={() => { setPref('email'); setStep(2) }} />
          <ChoiceRow label="Phone / text" selected={preferredContactMethod === 'phone_text'} onSelect={() => { setPref('phone_text'); setStep(2) }} />
          <ChoiceRow label="Either works" selected={preferredContactMethod === 'either'} onSelect={() => { setPref('either'); setStep(2) }} />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} disabled={!intent || !preferredContactMethod} />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">How&apos;d you first hear about the artist? <span className="text-neutral-400 font-normal">(optional)</span></p>
          <ChoiceRow label="Instagram" selected={referralSource === 'instagram'} onSelect={() => { setRefSrc('instagram'); setStep(4) }} />
          <ChoiceRow label="Referral" selected={referralSource === 'referral'} onSelect={() => { setRefSrc('referral'); setStep(4) }} />
          <ChoiceRow label="Saw them perform" selected={referralSource === 'saw_perform'} onSelect={() => { setRefSrc('saw_perform'); setStep(4) }} />
          <ChoiceRow label="Radio" selected={referralSource === 'radio'} onSelect={() => { setRefSrc('radio'); setStep(4) }} />
          <ChoiceRow label="Other" selected={referralSource === 'other'} onSelect={() => { setRefSrc('other'); setStep(4) }} />
          <button type="button" onClick={() => { setRefSrc(''); setStep(4) }} className="text-sm text-neutral-400 hover:text-white mt-2">
            Skip
          </button>
        </>
      ) : null}
      {step === 4 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!intent) return
            onSubmit({
              intent,
              preferredContactMethod,
              note: note.trim(),
              referralSource: referralSource || undefined,
              alternateEmail: alternateEmail.trim(),
              alternateContactName: alternateContactName.trim(),
            })
          }}
        >
          <Field
            label="If there&apos;s a better person to reach, drop their email here"
            value={alternateEmail}
            onChange={setAlt}
            className="mb-4"
          />
          <Field label="Their name (optional)" value={alternateContactName} onChange={setAltName} placeholder="First and last" className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!intent} />
        </form>
      ) : null}
    </div>
  )
}

function FollowUpForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'interested' | 'need_info' | 'pass' | ''>('')
  const [infoNeeded, setInfoNeeded] = useState('')
  const [recontactPreference, setRecontact] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 3)

  const goAfterStatus = (s: typeof status) => {
    setStatus(s)
    if (s === 'need_info') setStep(1)
    else if (s === 'pass') setStep(1)
    else setStep(2)
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm text-neutral-200 mb-2">Quick check-in</p>
          <ChoiceRow label="Still interested" selected={status === 'interested'} onSelect={() => goAfterStatus('interested')} />
          <ChoiceRow label="Need more info" selected={status === 'need_info'} onSelect={() => goAfterStatus('need_info')} />
          <ChoiceRow label="Passing for now" selected={status === 'pass'} onSelect={() => goAfterStatus('pass')} />
        </>
      ) : null}
      {step === 1 && status === 'need_info' ? (
        <>
          <p className="text-sm font-medium text-white mb-2">What info would help you decide?</p>
          <ChoiceRow label="Pricing / rate card" selected={infoNeeded === 'pricing'} onSelect={() => { setInfoNeeded('pricing'); setStep(2) }} />
          <ChoiceRow label="Song list or demo" selected={infoNeeded === 'song_demo'} onSelect={() => { setInfoNeeded('song_demo'); setStep(2) }} />
          <ChoiceRow label="Availability for specific dates" selected={infoNeeded === 'availability_dates'} onSelect={() => { setInfoNeeded('availability_dates'); setStep(2) }} />
          <ChoiceRow label="References from other venues" selected={infoNeeded === 'references'} onSelect={() => { setInfoNeeded('references'); setStep(2) }} />
          <ChoiceRow label="Something else" selected={infoNeeded === 'something_else'} onSelect={() => { setInfoNeeded('something_else'); setStep(2) }} />
        </>
      ) : null}
      {step === 1 && status === 'pass' ? (
        <>
          <p className="text-sm font-medium text-white mb-2">Would it help if we checked back later?</p>
          <ChoiceRow label="Sure — try me in a few months" selected={recontactPreference === 'few_months'} onSelect={() => { setRecontact('few_months'); setStep(2) }} />
          <ChoiceRow label="Maybe next year" selected={recontactPreference === 'next_year'} onSelect={() => { setRecontact('next_year'); setStep(2) }} />
          <ChoiceRow label="Please don&apos;t follow up" selected={recontactPreference === 'no_follow_up'} onSelect={() => { setRecontact('no_follow_up'); setStep(2) }} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!status) return
            onSubmit({
              status,
              note: note.trim(),
              ...(status === 'need_info' ? { infoNeeded } : {}),
              ...(status === 'pass' ? { recontactPreference } : {}),
            })
          }}
        >
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar
            submitting={submitting}
            disabled={
              !status
              || (status === 'need_info' && !infoNeeded)
              || (status === 'pass' && !recontactPreference)
            }
          />
        </form>
      ) : null}
    </div>
  )
}

function CancelledForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [resolution, setRes] = useState<'new_date' | 'refund' | 'release' | 'other' | ''>('')
  const [newEventDate, setDate] = useState('')
  const [futureInterest, setFuture] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  const cancelledTotal = resolution === 'new_date' ? 4 : resolution ? 3 : 3
  const cancelledCompleted =
    step === 0 ? 0 : resolution === 'new_date' ? Math.min(step, 3) : Math.min(step, 2)
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
        <>
          <p className="text-sm font-medium text-white mb-2">Regardless of what happened — would you want to work together again down the line?</p>
          <ChoiceRow label="Definitely" selected={futureInterest === 'definitely'} onSelect={() => { setFuture('definitely'); setStep(3) }} />
          <ChoiceRow label="Maybe — depends on timing" selected={futureInterest === 'maybe'} onSelect={() => { setFuture('maybe'); setStep(3) }} />
          <ChoiceRow label="Probably not" selected={futureInterest === 'probably_not'} onSelect={() => { setFuture('probably_not'); setStep(3) }} />
        </>
      ) : null}
      {resolution && step === 3 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!resolution || !futureInterest) return
            onSubmit({
              resolution,
              newEventDate: newEventDate.trim(),
              futureInterest,
              note: note.trim(),
            })
          }}
        >
          <Field label="Notes" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!resolution || !futureInterest} />
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
  const [paymentStructure, setPay] = useState('')
  const [eventContext, setCtx] = useState('')
  const [corrections, setCorr] = useState('')

  useScrollTopOnStepChange(step)

  const payOpts = [
    { value: 'full_after_show', label: 'Full payment after the show' },
    { value: 'deposit_balance', label: 'Deposit up front, balance night-of' },
    { value: 'venue_advances', label: 'Venue pays in advance' },
    { value: 'separate', label: 'We will sort it out separately' },
  ] as const

  const totalQ = aligned === true ? 3 : aligned === false ? 3 : 3
  const completedQ =
    step === 0 ? 0 : step === 1 ? 1 : step === 2 ? 2 : 0
  useCaptureQuestionProgress(aligned === null ? 0 : completedQ, totalQ)

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
              setStep(1)
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
        <>
          <p className="text-sm font-medium text-white mb-2">Is there a deposit or payment schedule to note?</p>
          {payOpts.map(o => (
            <ChoiceRow
              key={o.value}
              label={o.label}
              selected={paymentStructure === o.value}
              onSelect={() => {
                setPay(o.value)
                setStep(2)
              }}
            />
          ))}
        </>
      ) : null}
      {step === 2 && aligned === true ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (aligned !== true || !paymentStructure) return
            onSubmit({ aligned: true, corrections: '', paymentStructure, eventContext: eventContext.trim() })
          }}
        >
          <Field
            label="Any details about the event or crowd that would help the artist prepare? (optional)"
            value={eventContext}
            onChange={setCtx}
            textarea
            placeholder="e.g. It&apos;s a corporate holiday party, 21+ Latin night, college crowd…"
            className="mb-6"
          />
          <SubmitBar submitting={submitting} disabled={!paymentStructure} />
        </form>
      ) : null}
      {step === 2 && aligned === false ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (aligned !== false || !paymentStructure || !corrections.trim()) return
            onSubmit({ aligned: false, corrections: corrections.trim(), paymentStructure, eventContext: eventContext.trim() })
          }}
        >
          <Field label="What should change?" value={corrections} onChange={setCorr} textarea className="mb-6" />
          <Field
            label="Any details about the event or crowd that would help the artist prepare? (optional)"
            value={eventContext}
            onChange={setCtx}
            textarea
            placeholder="e.g. It&apos;s a corporate holiday party, 21+ Latin night, college crowd…"
            className="mb-6"
          />
          <SubmitBar submitting={submitting} disabled={!corrections.trim() || !paymentStructure} />
        </form>
      ) : null}
    </div>
  )
}

function InvoiceForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [received, setRec] = useState<boolean | null>(null)
  const [expectedPaymentTimeline, setTimeline] = useState('')
  const [poReference, setPo] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 3)

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
              setStep(2)
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
      {step === 1 && received === false ? (
        <>
          <p className="text-sm font-medium text-white mb-2">When do you expect payment to go out?</p>
          <ChoiceRow label="Within a week" selected={expectedPaymentTimeline === 'within_week'} onSelect={() => { setTimeline('within_week'); setStep(2) }} />
          <ChoiceRow label="Net 15" selected={expectedPaymentTimeline === 'net_15'} onSelect={() => { setTimeline('net_15'); setStep(2) }} />
          <ChoiceRow label="Net 30" selected={expectedPaymentTimeline === 'net_30'} onSelect={() => { setTimeline('net_30'); setStep(2) }} />
          <ChoiceRow label="Not sure yet" selected={expectedPaymentTimeline === 'not_sure'} onSelect={() => { setTimeline('not_sure'); setStep(2) }} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (received === null) return
            onSubmit({
              receivedInAp: received,
              expectedPaymentTimeline: received ? undefined : expectedPaymentTimeline || undefined,
              poReference: poReference.trim(),
              note: note.trim(),
            })
          }}
        >
          <Field
            label="PO number, invoice reference, or AP ticket? (optional)"
            value={poReference}
            onChange={setPo}
            placeholder="Helps us match payment when it arrives"
            className="mb-4"
          />
          <Field label="Note (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar
            submitting={submitting}
            disabled={received === null || (received === false && !expectedPaymentTimeline)}
          />
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
  const [wouldRebook, setWouldRebook] = useState('')
  const [venueTurnoutAssessment, setTurnout] = useState('')
  const [comments, setComments] = useState('')
  const [nothing, setN] = useState<boolean | null>(null)
  const [detail, setD] = useState('')

  useScrollTopOnStepChange(step)
  const postShowTotal = 8
  const postShowCompleted = Math.min(step, postShowTotal - 1)
  useCaptureQuestionProgress(postShowCompleted, postShowTotal)

  const doSubmit = () => {
    if (
      rating === 0 ||
      !wouldRebook ||
      !venueTurnoutAssessment ||
      nothing === null
    ) {
      return
    }
    onSubmit({
      rating,
      wouldRebook,
      venueTurnoutAssessment,
      comments: comments.trim(),
      nothingPending: nothing,
      detail: detail.trim(),
    })
  }

  return (
    <div className="pb-28 space-y-4">
      {step === 0 ? (
        <>
          <p className="text-xs font-semibold text-neutral-100 mb-2">
            How was the show?{' '}
            <span className="text-red-500 font-semibold" aria-hidden="true">
              *
            </span>
            <span className="sr-only">(required)</span>
          </p>
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
          <p className="text-xs font-semibold text-neutral-100 mb-2">
            Would you book this artist again?{' '}
            <span className="text-red-500 font-semibold" aria-hidden="true">
              *
            </span>
          </p>
          <ChoiceRow
            label="Absolutely"
            selected={wouldRebook === 'absolutely'}
            onSelect={() => {
              setWouldRebook('absolutely')
              setStep(2)
            }}
          />
          <ChoiceRow
            label="Probably"
            selected={wouldRebook === 'probably'}
            onSelect={() => {
              setWouldRebook('probably')
              setStep(2)
            }}
          />
          <ChoiceRow
            label="Not likely"
            selected={wouldRebook === 'not_likely'}
            onSelect={() => {
              setWouldRebook('not_likely')
              setStep(2)
            }}
          />
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="text-xs font-semibold text-neutral-100 mb-2">
            How was the turnout?{' '}
            <span className="text-red-500 font-semibold" aria-hidden="true">
              *
            </span>
          </p>
          <ChoiceRow label="Packed" selected={venueTurnoutAssessment === 'packed'} onSelect={() => { setTurnout('packed'); setStep(3) }} />
          <ChoiceRow label="Solid" selected={venueTurnoutAssessment === 'solid'} onSelect={() => { setTurnout('solid'); setStep(3) }} />
          <ChoiceRow label="Light" selected={venueTurnoutAssessment === 'light'} onSelect={() => { setTurnout('light'); setStep(3) }} />
          <ChoiceRow
            label="Slow night"
            selected={venueTurnoutAssessment === 'slow'}
            onSelect={() => { setTurnout('slow'); setStep(3) }}
          />
        </>
      ) : null}
      {step === 3 ? (
        <>
          <Field
            label="Anything your team noticed — energy, crowd response, production? (optional)"
            value={comments}
            onChange={setComments}
            textarea
            placeholder="Good or bad — honest feedback helps us improve"
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(4)} submitting={submitting} />
        </>
      ) : null}
      {step === 4 ? (
        <>
          <p className="text-xs font-medium text-neutral-200 mb-2">Anything still open?</p>
          <ChoiceRow
            label="Nothing pending on our side"
            selected={nothing === true}
            onSelect={() => {
              setN(true)
              setStep(6)
            }}
          />
          <ChoiceRow
            label="Something is still open"
            selected={nothing === false}
            onSelect={() => {
              setN(false)
              setStep(5)
            }}
          />
        </>
      ) : null}
      {step === 5 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            doSubmit()
          }}
        >
          <Field label="What&apos;s open?" value={detail} onChange={setD} textarea className="mb-6" />
          <SubmitBar
            submitting={submitting}
            disabled={rating === 0 || !wouldRebook || !venueTurnoutAssessment || nothing !== false || !detail.trim()}
          />
        </form>
      ) : null}
      {step === 6 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            doSubmit()
          }}
        >
          <p className="text-sm text-neutral-200 mb-4">Thanks — send your feedback?</p>
          <SubmitBar
            submitting={submitting}
            disabled={rating === 0 || !wouldRebook || !venueTurnoutAssessment || nothing !== true}
          />
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

const REBOOKING_DAY_OPTIONS = [
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' },
  { value: 'weeknight', label: 'Weeknight' },
  { value: 'flexible', label: 'Flexible' },
] as const

function RebookingForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [preferredDays, setPreferredDays] = useState<string[]>([])
  const [availability, setA] = useState('')
  const [budgetRange, setBudgetRange] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, 3)

  const toggleDay = (v: string) => {
    setPreferredDays(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]))
  }

  return (
    <div className="pb-28 space-y-3">
      {step === 0 ? (
        <>
          <p className="text-sm font-medium text-neutral-200 mb-2">Any day of the week that works best?</p>
          <p className="text-xs text-neutral-500 mb-2">Tap any that apply — optional.</p>
          <MultiChoiceGrid options={[...REBOOKING_DAY_OPTIONS]} selected={preferredDays} onToggle={toggleDay} />
          <ContinueBar onClick={() => setStep(1)} submitting={submitting} />
        </>
      ) : null}
      {step === 1 ? (
        <>
          <Field
            label="Availability, preferred months, or holds"
            value={availability}
            onChange={setA}
            textarea
            placeholder="e.g. June 2026, or first open Saturday in Q3"
            className="mb-4"
          />
          <ContinueBar onClick={() => setStep(2)} submitting={submitting} disabled={!availability.trim()} />
        </>
      ) : null}
      {step === 2 ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit({
              preferredDays,
              availability: availability.trim(),
              budgetRange: budgetRange || undefined,
            })
          }}
        >
          <p className="text-sm font-medium text-neutral-200 mb-2">Roughly what budget range are you working with? (optional)</p>
          <ChoiceRow label="Under $500" selected={budgetRange === 'under_500'} onSelect={() => setBudgetRange('under_500')} />
          <ChoiceRow label="$500–$1,000" selected={budgetRange === '500_1000'} onSelect={() => setBudgetRange('500_1000')} />
          <ChoiceRow label="$1,000–$2,000" selected={budgetRange === '1000_2000'} onSelect={() => setBudgetRange('1000_2000')} />
          <ChoiceRow label="$2,000+" selected={budgetRange === 'over_2000'} onSelect={() => setBudgetRange('over_2000')} />
          <ChoiceRow label="Let&apos;s discuss" selected={budgetRange === 'discuss'} onSelect={() => setBudgetRange('discuss')} />
          <SubmitBar submitting={submitting} />
        </form>
      ) : null}
    </div>
  )
}

function PaymentAckForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [submitted, setS] = useState<boolean | null>(null)
  const [expectedSendDate, setExpectedSend] = useState('')
  const [reference, setR] = useState('')

  useScrollTopOnStepChange(step)
  useCaptureQuestionProgress(step, submitted === false ? 3 : 2)

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
      {step === 1 && submitted === false ? (
        <>
          <p className="text-sm font-medium text-white mb-2">Any idea when it&apos;ll go out?</p>
          <ChoiceRow label="This week" selected={expectedSendDate === 'this_week'} onSelect={() => { setExpectedSend('this_week'); setStep(2) }} />
          <ChoiceRow label="Next week" selected={expectedSendDate === 'next_week'} onSelect={() => { setExpectedSend('next_week'); setStep(2) }} />
          <ChoiceRow
            label="Waiting on approval"
            selected={expectedSendDate === 'waiting_approval'}
            onSelect={() => { setExpectedSend('waiting_approval'); setStep(2) }}
          />
          <ChoiceRow label="Not sure" selected={expectedSendDate === 'not_sure'} onSelect={() => { setExpectedSend('not_sure'); setStep(2) }} />
        </>
      ) : null}
      {step === 1 && submitted === true ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            onSubmit({ submittedPayment: true, reference: reference.trim() })
          }}
        >
          <Field label="Reference # (optional)" value={reference} onChange={setR} className="mb-6" />
          <SubmitBar submitting={submitting} />
        </form>
      ) : null}
      {step === 2 && submitted === false ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!expectedSendDate) return
            onSubmit({ submittedPayment: false, expectedSendDate, reference: reference.trim() })
          }}
        >
          <Field label="Reference # (optional)" value={reference} onChange={setR} className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!expectedSendDate} />
        </form>
      ) : null}
    </div>
  )
}

function PaymentReceiptForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [step, setStep] = useState(0)
  const [rebookInterest, setInterest] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [workingExperience, setWorking] = useState('')
  const [preferredDates, setDates] = useState('')
  const [budgetNote, setBudget] = useState('')
  const [referralWillingness, setReferral] = useState('')
  const [note, setNote] = useState('')

  useScrollTopOnStepChange(step)
  const receiptTotal = rebookInterest === 'no' ? 4 : 6
  const receiptCompleted = rebookInterest === '' ? 0 : Math.min(step + 1, receiptTotal)
  useCaptureQuestionProgress(receiptCompleted, receiptTotal)

  const pickInterest = (v: 'yes' | 'maybe' | 'no') => {
    setInterest(v)
    setStep(1)
  }

  const referralBlock = (
    <>
      <p className="text-sm font-medium text-white mb-2">Would you recommend us to anyone in your network? (optional)</p>
      <ChoiceRow label="Yes — happy to" selected={referralWillingness === 'yes_happy'} onSelect={() => setReferral('yes_happy')} />
      <ChoiceRow label="Maybe" selected={referralWillingness === 'maybe'} onSelect={() => setReferral('maybe')} />
      <ChoiceRow label="Rather not" selected={referralWillingness === 'rather_not'} onSelect={() => setReferral('rather_not')} />
      <button
        type="button"
        onClick={() => setReferral('')}
        className="mt-2 w-full min-h-[44px] text-sm text-neutral-400 hover:text-neutral-200 border border-neutral-800 rounded-lg"
      >
        Prefer not to answer
      </button>
    </>
  )

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
      {step === 1 ? (
        <>
          <p className="text-sm font-medium text-white mb-2">How was the overall experience working with our team?</p>
          <ChoiceRow
            label="Great — smooth all around"
            selected={workingExperience === 'great_smooth'}
            onSelect={() => {
              setWorking('great_smooth')
              setStep(2)
            }}
          />
          <ChoiceRow
            label="Good — minor hiccups"
            selected={workingExperience === 'good_hiccups'}
            onSelect={() => {
              setWorking('good_hiccups')
              setStep(2)
            }}
          />
          <ChoiceRow
            label="Rough — some issues came up"
            selected={workingExperience === 'rough'}
            onSelect={() => {
              setWorking('rough')
              setStep(2)
            }}
          />
        </>
      ) : null}
      {step === 2 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <>
          <Field
            label="Preferred dates or months (optional)"
            value={preferredDates}
            onChange={setDates}
            placeholder="e.g. June or July 2026"
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} />
        </>
      ) : null}
      {step === 2 && rebookInterest === 'no' ? (
        <>
          {referralBlock}
          <ContinueBar onClick={() => setStep(3)} submitting={submitting} />
        </>
      ) : null}
      {step === 3 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <>
          <Field
            label="Rough budget or fee range (optional)"
            value={budgetNote}
            onChange={setBudget}
            placeholder="e.g. same as last time, $500–$800"
            className="mb-6"
          />
          <ContinueBar onClick={() => setStep(4)} submitting={submitting} />
        </>
      ) : null}
      {step === 4 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <>
          {referralBlock}
          <ContinueBar onClick={() => setStep(5)} submitting={submitting} />
        </>
      ) : null}
      {step === 5 && (rebookInterest === 'yes' || rebookInterest === 'maybe') ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!rebookInterest || !workingExperience) return
            onSubmit({
              rebookInterest,
              workingExperience,
              referralWillingness: referralWillingness || undefined,
              preferredDates: preferredDates.trim(),
              budgetNote: budgetNote.trim(),
              note: note.trim(),
            })
          }}
        >
          <Field label="Anything else to add? (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!rebookInterest || !workingExperience} />
        </form>
      ) : null}
      {step === 3 && rebookInterest === 'no' ? (
        <form
          onSubmit={e => {
            e.preventDefault()
            if (!rebookInterest || !workingExperience) return
            onSubmit({
              rebookInterest,
              workingExperience,
              referralWillingness: referralWillingness || undefined,
              preferredDates: '',
              budgetNote: '',
              note: note.trim(),
            })
          }}
        >
          <Field label="Anything else to add? (optional)" value={note} onChange={setNote} textarea className="mb-6" />
          <SubmitBar submitting={submitting} disabled={!rebookInterest || !workingExperience} />
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
