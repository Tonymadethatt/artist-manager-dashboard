import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { DependencyList } from 'react'
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

function useEmailCaptureProgressEstimate(calc: () => number, deps: DependencyList) {
  const ctx = useContext(EmailCaptureProgressContext)
  useEffect(() => {
    if (!ctx) return
    ctx.setProgressPct(Math.max(0, Math.min(100, Math.round(calc()))))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mirror field completion only
  }, deps)
}

export function formatEmailCaptureEventDate(iso: string | null): string | null {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

type EmailCaptureFooterVariant = 'viewport' | 'embedded'
const EmailCaptureFooterContext = createContext<EmailCaptureFooterVariant>('viewport')

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
      className={`min-h-[44px] w-full text-left px-4 py-3 rounded-lg border text-sm transition-colors ${
        selected
          ? 'border-white bg-neutral-800 text-white'
          : 'border-neutral-700 bg-neutral-900 text-neutral-300 hover:border-neutral-600'
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
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500 text-sm px-4">
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
        <Loader2 className="h-8 w-8 text-neutral-500 animate-spin" aria-hidden />
      </PublicFormLayout>
    )
  }

  if (!preflight.valid) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-400 text-sm px-6 text-center max-w-md mx-auto">
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
        <p className="text-sm text-neutral-400 max-w-sm">
          Your response was received{preflight.venueName ? ` for ${preflight.venueName}` : ''}. You can close this page.
        </p>
      </PublicFormLayout>
    )
  }

  const ctx = preflight

  const venueContext = (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Quick response</p>
      {(ctx.venueName || ctx.dealDescription) ? (
        <p className="text-sm text-neutral-400">
          {ctx.venueName ? <span className="text-neutral-300">{ctx.venueName}</span> : null}
          {ctx.eventDate ? (
            <span className="text-neutral-500"> · {formatEmailCaptureEventDate(ctx.eventDate)}</span>
          ) : null}
          {ctx.dealDescription && !ctx.venueName ? (
            <span className="text-neutral-300">{ctx.dealDescription}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )

  return (
    <PublicFormLayout
      branding={ctx.branding}
      title={EMAIL_CAPTURE_KIND_FORM_TITLES[ctx.kind]}
      descriptor={EMAIL_CAPTURE_KIND_FORM_DESCRIPTORS[ctx.kind]}
      progress={progressPct}
      progressSuccessFlash={progressSuccessFlash}
      venueContext={venueContext}
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
      return <p className="text-sm text-neutral-500">Unsupported form type.</p>
  }
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  textarea,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  textarea?: boolean
}) {
  const cls =
    'w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500'
  return (
    <label className="block mb-4">
      <span className="block text-xs font-medium text-neutral-400 mb-1.5">{label}</span>
      {textarea ? (
        <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3} className={cls} />
      ) : (
        <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  )
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
  if (footerVariant === 'embedded') {
    return (
      <div className="sticky bottom-0 z-10 mt-6 -mx-4 px-4 pt-4 pb-3 bg-neutral-950/95 border-t border-neutral-800 backdrop-blur-sm">
        {bar}
      </div>
    )
  }
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-neutral-950/95 border-t border-neutral-800">
      {bar}
    </div>
  )
}

function PreEventForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [loadInOrSoundcheck, setLoadIn] = useState('')
  const [settlementMethod, setSettle] = useState('')
  const [dayOfContactName, setName] = useState('')
  const [dayOfContactPhone, setPhone] = useState('')
  const [dayOfContactEmail, setEmail] = useState('')
  const [parkingNotes, setPark] = useState('')
  const [riderOrTechUrl, setRider] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = 10
    if (loadInOrSoundcheck.trim()) p += 18
    if (settlementMethod.trim()) p += 18
    const contacts = [dayOfContactName, dayOfContactPhone, dayOfContactEmail].filter(s => s.trim()).length
    if (contacts > 0) p += Math.min(28, contacts * 9)
    if (parkingNotes.trim()) p += 10
    if (riderOrTechUrl.trim()) p += 10
    return Math.min(96, p)
  }, [loadInOrSoundcheck, settlementMethod, dayOfContactName, dayOfContactPhone, dayOfContactEmail, parkingNotes, riderOrTechUrl])

  return (
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
      className="pb-28"
    >
      <p className="text-sm text-neutral-400 mb-4">Share load-in, settlement, and day-of contact details.</p>
      <Field label="Load-in / soundcheck window" value={loadInOrSoundcheck} onChange={setLoadIn} placeholder="e.g. 5pm load-in, 8pm soundcheck" />
      <Field label="Settlement method" value={settlementMethod} onChange={setSettle} placeholder="Check, wire, night-of cash…" />
      <Field label="Day-of contact name" value={dayOfContactName} onChange={setName} />
      <Field label="Day-of phone" value={dayOfContactPhone} onChange={setPhone} />
      <Field label="Day-of email" value={dayOfContactEmail} onChange={setEmail} />
      <Field label="Parking / load-in notes" value={parkingNotes} onChange={setPark} textarea />
      <Field label="Rider or tech info (link)" value={riderOrTechUrl} onChange={setRider} placeholder="https://…" />
      <SubmitBar
        submitting={submitting}
        disabled={!loadInOrSoundcheck.trim() && !settlementMethod.trim()}
      />
    </form>
  )
}

function FirstOutreachForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [intent, setIntent] = useState<'interested' | 'not_now' | 'wrong_person' | ''>('')
  const [note, setNote] = useState('')
  const [alternateEmail, setAlt] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = intent ? 52 : 14
    if (note.trim()) p += 18
    if (alternateEmail.trim()) p += 18
    return Math.min(96, p)
  }, [intent, note, alternateEmail])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!intent) return
        onSubmit({ intent, note: note.trim(), alternateEmail: alternateEmail.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Interested — let&apos;s explore a date" selected={intent === 'interested'} onSelect={() => setIntent('interested')} />
      <ChoiceRow label="Not for us right now" selected={intent === 'not_now'} onSelect={() => setIntent('not_now')} />
      <ChoiceRow label="Wrong contact — point me to the right person" selected={intent === 'wrong_person'} onSelect={() => setIntent('wrong_person')} />
      <Field label="Note (optional)" value={note} onChange={setNote} textarea />
      <Field label="Alternate email (optional)" value={alternateEmail} onChange={setAlt} />
      <SubmitBar submitting={submitting} disabled={!intent} />
    </form>
  )
}

function FollowUpForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [status, setStatus] = useState<'interested' | 'need_info' | 'pass' | ''>('')
  const [note, setNote] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = status ? 58 : 14
    if (note.trim()) p += 28
    return Math.min(96, p)
  }, [status, note])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!status) return
        onSubmit({ status, note: note.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Still interested" selected={status === 'interested'} onSelect={() => setStatus('interested')} />
      <ChoiceRow label="Need more info" selected={status === 'need_info'} onSelect={() => setStatus('need_info')} />
      <ChoiceRow label="Passing for now" selected={status === 'pass'} onSelect={() => setStatus('pass')} />
      <Field label="Note (optional)" value={note} onChange={setNote} textarea />
      <SubmitBar submitting={submitting} disabled={!status} />
    </form>
  )
}

function CancelledForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [resolution, setRes] = useState<'new_date' | 'refund' | 'release' | 'other' | ''>('')
  const [newEventDate, setDate] = useState('')
  const [note, setNote] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = resolution ? 48 : 14
    if (resolution === 'new_date' && newEventDate.trim()) p += 24
    if (note.trim()) p += 20
    return Math.min(96, p)
  }, [resolution, newEventDate, note])

  return (
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
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="New date" selected={resolution === 'new_date'} onSelect={() => setRes('new_date')} />
      <ChoiceRow label="Refund path" selected={resolution === 'refund'} onSelect={() => setRes('refund')} />
      <ChoiceRow label="Mutual release" selected={resolution === 'release'} onSelect={() => setRes('release')} />
      <ChoiceRow label="Other" selected={resolution === 'other'} onSelect={() => setRes('other')} />
      {resolution === 'new_date' && (
        <Field label="New event date" value={newEventDate} onChange={setDate} placeholder="YYYY-MM-DD" />
      )}
      <Field label="Notes" value={note} onChange={setNote} textarea />
      <SubmitBar submitting={submitting} disabled={!resolution} />
    </form>
  )
}

function AgreementFollowupForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [status, setSt] = useState<'signed' | 'in_review' | 'needs_changes' | ''>('')
  const [note, setNote] = useState('')
  const [documentUrl, setUrl] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = status ? 55 : 14
    if (note.trim()) p += 18
    if (documentUrl.trim()) p += 18
    return Math.min(96, p)
  }, [status, note, documentUrl])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (!status) return
        onSubmit({ status, note: note.trim(), documentUrl: documentUrl.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Signed" selected={status === 'signed'} onSelect={() => setSt('signed')} />
      <ChoiceRow label="In review" selected={status === 'in_review'} onSelect={() => setSt('in_review')} />
      <ChoiceRow label="Needs changes" selected={status === 'needs_changes'} onSelect={() => setSt('needs_changes')} />
      <Field label="Note (optional)" value={note} onChange={setNote} textarea />
      <Field label="Document link (optional)" value={documentUrl} onChange={setUrl} />
      <SubmitBar submitting={submitting} disabled={!status} />
    </form>
  )
}

function AgreementReadyForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [ack, setAck] = useState(false)
  const [note, setNote] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = ack ? 72 : 18
    if (note.trim()) p += 18
    return Math.min(96, p)
  }, [ack, note])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({ acknowledged: ack, note: note.trim() })
      }}
      className="pb-28 space-y-4"
    >
      <label className="flex items-start gap-3 cursor-pointer">
        <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} className="mt-1 rounded border-neutral-600" />
        <span className="text-sm text-neutral-300">I have reviewed the agreement (or the link shared by email).</span>
      </label>
      <Field label="Questions or comments (optional)" value={note} onChange={setNote} textarea />
      <SubmitBar submitting={submitting} disabled={!ack} />
    </form>
  )
}

function BookingConfirmForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [aligned, setAligned] = useState<boolean | null>(null)
  const [corrections, setCorr] = useState('')

  useEmailCaptureProgressEstimate(() => {
    if (aligned === null) return 14
    if (aligned === true) return 88
    return corrections.trim() ? 92 : 58
  }, [aligned, corrections])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (aligned === null) return
        onSubmit({ aligned, corrections: corrections.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Details look correct" selected={aligned === true} onSelect={() => setAligned(true)} />
      <ChoiceRow label="Something needs a correction" selected={aligned === false} onSelect={() => setAligned(false)} />
      {aligned === false && <Field label="What should change?" value={corrections} onChange={setCorr} textarea />}
      <SubmitBar submitting={submitting} disabled={aligned === null || (aligned === false && !corrections.trim())} />
    </form>
  )
}

function InvoiceForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [received, setRec] = useState<boolean | null>(null)
  const [note, setNote] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = received === null ? 14 : 72
    if (note.trim()) p += 18
    return Math.min(96, p)
  }, [received, note])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (received === null) return
        onSubmit({ receivedInAp: received, note: note.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Received in AP / accounting" selected={received === true} onSelect={() => setRec(true)} />
      <ChoiceRow label="Not yet / issue" selected={received === false} onSelect={() => setRec(false)} />
      <Field label="Note (optional)" value={note} onChange={setNote} textarea />
      <SubmitBar submitting={submitting} disabled={received === null} />
    </form>
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
          className={`text-3xl leading-none transition-colors ${star <= value ? 'text-yellow-400' : 'text-neutral-700 hover:text-neutral-500'}`}
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          &#9733;
        </button>
      ))}
    </div>
  )
}

function PostShowForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [rating, setRating] = useState(0)
  const [nothing, setN] = useState<boolean | null>(null)
  const [detail, setD] = useState('')
  const [comments, setComments] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = rating > 0 ? 32 : 10
    if (nothing !== null) p += 34
    if (nothing === false && detail.trim()) p += 18
    if (comments.trim()) p += 12
    return Math.min(96, p)
  }, [rating, nothing, detail, comments])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (rating === 0 || nothing === null) return
        onSubmit({ rating, nothingPending: nothing, detail: detail.trim(), comments: comments.trim() })
      }}
      className="pb-28 space-y-4"
    >
      <div>
        <p className="text-xs font-medium text-neutral-400 mb-2">How was the show? (required)</p>
        <StarRating value={rating} onChange={setRating} />
        {rating > 0 && (
          <p className="text-xs text-neutral-500 mt-1">
            {rating === 5 ? 'Excellent' : rating === 4 ? 'Great' : rating === 3 ? 'Good' : rating === 2 ? 'Fair' : 'Poor'}
          </p>
        )}
      </div>
      <Field label="Comments (optional)" value={comments} onChange={setComments} textarea placeholder="Anything you'd like us to know about the night..." />
      <div className="space-y-3">
        <p className="text-xs font-medium text-neutral-400">Anything still open?</p>
        <ChoiceRow label="Nothing pending on our side" selected={nothing === true} onSelect={() => setN(true)} />
        <ChoiceRow label="Something is still open" selected={nothing === false} onSelect={() => setN(false)} />
        {nothing === false && <Field label="What&apos;s open?" value={detail} onChange={setD} textarea />}
      </div>
      <SubmitBar submitting={submitting} disabled={rating === 0 || nothing === null || (nothing === false && !detail.trim())} />
    </form>
  )
}

function PassAckForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  useEmailCaptureProgressEstimate(() => 90, [])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        onSubmit({})
      }}
      className="pb-28"
    >
      <p className="text-sm text-neutral-400 mb-6">Tap submit to acknowledge — no other fields needed.</p>
      <SubmitBar submitting={submitting} />
    </form>
  )
}

function RebookingForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [availability, setA] = useState('')

  useEmailCaptureProgressEstimate(() => (availability.trim() ? 88 : 22), [availability])

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
  const [submitted, setS] = useState<boolean | null>(null)
  const [reference, setR] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = submitted === null ? 14 : 70
    if (reference.trim()) p += 16
    return Math.min(96, p)
  }, [submitted, reference])

  return (
    <form
      onSubmit={e => {
        e.preventDefault()
        if (submitted === null) return
        onSubmit({ submittedPayment: submitted, reference: reference.trim() })
      }}
      className="pb-28 space-y-3"
    >
      <ChoiceRow label="Payment has been sent" selected={submitted === true} onSelect={() => setS(true)} />
      <ChoiceRow label="Not sent yet" selected={submitted === false} onSelect={() => setS(false)} />
      <Field label="Reference # (optional)" value={reference} onChange={setR} />
      <SubmitBar submitting={submitting} disabled={submitted === null} />
    </form>
  )
}

function PaymentReceiptForm({ submitting, onSubmit }: { submitting: boolean; onSubmit: (p: Record<string, unknown>) => void }) {
  const [rebookInterest, setInterest] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [preferredDates, setDates] = useState('')
  const [budgetNote, setBudget] = useState('')
  const [note, setNote] = useState('')

  useEmailCaptureProgressEstimate(() => {
    let p = rebookInterest ? 46 : 14
    if (rebookInterest === 'yes' || rebookInterest === 'maybe') {
      if (preferredDates.trim()) p += 16
      if (budgetNote.trim()) p += 16
    }
    if (note.trim()) p += 12
    return Math.min(96, p)
  }, [rebookInterest, preferredDates, budgetNote, note])

  return (
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
      className="pb-28 space-y-3"
    >
      <p className="text-sm text-neutral-400 mb-4">Are you interested in booking again?</p>
      <ChoiceRow label="Yes — let&apos;s plan the next one" selected={rebookInterest === 'yes'} onSelect={() => setInterest('yes')} />
      <ChoiceRow label="Maybe — open to it" selected={rebookInterest === 'maybe'} onSelect={() => setInterest('maybe')} />
      <ChoiceRow label="Not right now" selected={rebookInterest === 'no'} onSelect={() => setInterest('no')} />
      {(rebookInterest === 'yes' || rebookInterest === 'maybe') && (
        <>
          <Field label="Preferred dates or months (optional)" value={preferredDates} onChange={setDates} placeholder="e.g. June or July 2026" />
          <Field label="Rough budget or fee range (optional)" value={budgetNote} onChange={setBudget} placeholder="e.g. same as last time, $500–$800" />
        </>
      )}
      <Field label="Anything else to add? (optional)" value={note} onChange={setNote} textarea />
      <SubmitBar submitting={submitting} disabled={!rebookInterest} />
    </form>
  )
}

export interface EmailCaptureFormPreviewBodyProps {
  kind: EmailCaptureKind
  venueName: string | null
  dealDescription: string | null
  eventDate: string | null
  branding?: PublicFormBranding
}

/** Dashboard: exercise capture UI without token or Netlify calls. */
export function EmailCaptureFormPreviewBody({
  kind,
  venueName,
  dealDescription,
  eventDate,
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

  const venueContext = (
    <div className="space-y-1">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Quick response · preview</p>
      {(venueName || dealDescription) ? (
        <p className="text-sm text-neutral-400">
          {venueName ? <span className="text-neutral-300">{venueName}</span> : null}
          {eventDate ? (
            <span className="text-neutral-500"> · {formatEmailCaptureEventDate(eventDate)}</span>
          ) : null}
          {dealDescription && !venueName ? (
            <span className="text-neutral-300">{dealDescription}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  )

  if (done) {
    return (
      <PublicFormLayout
        branding={branding}
        title="Preview complete"
        descriptor="Nothing was saved"
        progress={0}
        rootClassName="bg-neutral-950 text-neutral-100 min-h-0 flex-1 flex flex-col"
        mainClassName="flex flex-1 flex-col items-center justify-center px-4 py-12 text-center"
      >
        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3 shrink-0" aria-hidden />
        <p className="text-sm text-neutral-400 max-w-sm">
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
      venueContext={venueContext}
      rootClassName="bg-neutral-950 text-neutral-100 min-h-0 flex-1 flex flex-col"
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
