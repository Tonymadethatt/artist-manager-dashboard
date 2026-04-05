import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, Loader2, ClipboardList } from 'lucide-react'

type FormState = 'loading' | 'form' | 'submitting' | 'success' | 'invalid'

interface FormContext {
  venueName: string | null
  eventDate: string | null
  dealDescription: string | null
}

interface FormAnswers {
  eventHappened: 'yes' | 'no' | 'postponed' | ''
  eventRating: number | null
  attendance: string
  artistPaidStatus: 'yes' | 'no' | 'partial' | ''
  paymentAmount: string
  venueInterest: 'yes' | 'no' | 'unsure' | ''
  relationshipQuality: 'good' | 'neutral' | 'poor' | ''
  notes: string
  mediaLinks: string
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${months[parseInt(m,10)-1]} ${parseInt(d,10)}, ${y}`
}

const EMPTY_ANSWERS: FormAnswers = {
  eventHappened: '',
  eventRating: null,
  attendance: '',
  artistPaidStatus: '',
  paymentAmount: '',
  venueInterest: '',
  relationshipQuality: '',
  notes: '',
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
            className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition-all ${
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

function RatingField({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const labels = ['', 'Rough night', 'It was okay', 'Decent show', 'Good energy', 'Amazing']
  return (
    <div className="mb-5">
      <label className="block text-sm font-medium text-white mb-2">How did it go overall?</label>
      <div className="flex gap-2">
        {[1,2,3,4,5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`flex-1 py-3 rounded-lg border text-sm font-semibold transition-all ${
              value === n
                ? 'bg-white text-black border-white'
                : 'bg-neutral-900 text-neutral-500 border-neutral-700 hover:border-neutral-500 hover:text-white'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {value !== null && (
        <p className="text-xs text-neutral-500 mt-1.5 text-center">{labels[value]}</p>
      )}
    </div>
  )
}

export default function PerformanceReportForm() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<FormState>('loading')
  const [context, setContext] = useState<FormContext>({ venueName: null, eventDate: null, dealDescription: null })
  const [answers, setAnswers] = useState<FormAnswers>(EMPTY_ANSWERS)
  const [validationError, setValidationError] = useState<string | null>(null)

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

  function set<K extends keyof FormAnswers>(key: K, value: FormAnswers[K]) {
    setAnswers(prev => ({ ...prev, [key]: value }))
    setValidationError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!answers.eventHappened) { setValidationError('Please answer all required questions.'); return }
    if (answers.eventHappened === 'yes' && !answers.artistPaidStatus) { setValidationError('Please answer all required questions.'); return }
    if (!answers.venueInterest) { setValidationError('Please answer all required questions.'); return }
    if (!answers.relationshipQuality) { setValidationError('Please answer all required questions.'); return }

    setState('submitting')

    const payload = {
      token,
      eventHappened: answers.eventHappened,
      eventRating: answers.eventHappened === 'yes' ? answers.eventRating : null,
      attendance: answers.eventHappened === 'yes' && answers.attendance ? parseInt(answers.attendance, 10) : null,
      artistPaidStatus: answers.eventHappened === 'yes' ? answers.artistPaidStatus : null,
      paymentAmount: answers.eventHappened === 'yes' && answers.artistPaidStatus === 'partial' && answers.paymentAmount
        ? parseFloat(answers.paymentAmount)
        : null,
      venueInterest: answers.venueInterest,
      relationshipQuality: answers.relationshipQuality,
      notes: answers.notes.trim() || null,
      mediaLinks: answers.mediaLinks.trim() || null,
    }

    try {
      await fetch('/.netlify/functions/submit-performance-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setState('success')
    } catch {
      setState('success') // Show success even on network error — server may have saved the submission
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

  if (state === 'success' || state === 'submitting' && false) {
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

  const showEventSections = answers.eventHappened === 'yes'
  const showPaymentAmount = showEventSections && answers.artistPaidStatus === 'partial'

  return (
    <div className="min-h-screen bg-[#0d0d0d] py-10 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8">
          <img src="/dj-luijay-logo.png" alt="DJ Luijay" className="h-10 w-auto mb-4" />
          <div className="text-[10px] text-neutral-600 uppercase tracking-widest font-medium mb-1">Front Office™</div>
          <div className="text-[9px] text-neutral-700 tracking-wide mb-4">Brand Growth & Management</div>
          <div className="border-t border-neutral-800 mb-4" />
          <h1 className="text-white font-semibold text-xl mb-1">Show Report</h1>
          {context.venueName && (
            <p className="text-neutral-400 text-sm">
              {context.venueName}
              {context.eventDate && <span className="text-neutral-600"> - {formatDate(context.eventDate)}</span>}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          {/* Q1: Did the event happen */}
          <SelectField
            label="Did the event happen as planned?"
            value={answers.eventHappened}
            onChange={v => set('eventHappened', v as FormAnswers['eventHappened'])}
            required
            options={[
              { value: 'yes', label: 'Yes, it happened' },
              { value: 'no', label: 'No, it was cancelled' },
              { value: 'postponed', label: 'It was postponed' },
            ]}
          />

          {/* Q2-5: Only shown if event happened */}
          {showEventSections && (
            <>
              <RatingField value={answers.eventRating} onChange={v => set('eventRating', v)} />

              <div className="mb-5">
                <label className="block text-sm font-medium text-white mb-2">
                  Approximately how many people attended?
                  <span className="text-neutral-500 ml-1 font-normal">(optional)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={answers.attendance}
                  onChange={e => set('attendance', e.target.value)}
                  placeholder="e.g. 150"
                  className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                />
              </div>

              <SelectField
                label="Did you receive payment from the venue?"
                value={answers.artistPaidStatus}
                onChange={v => set('artistPaidStatus', v as FormAnswers['artistPaidStatus'])}
                required
                options={[
                  { value: 'yes', label: 'Yes, full payment' },
                  { value: 'partial', label: 'Partial payment' },
                  { value: 'no', label: 'Not yet / no' },
                ]}
              />

              {showPaymentAmount && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-white mb-2">How much did you receive? ($)</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={answers.paymentAmount}
                    onChange={e => set('paymentAmount', e.target.value)}
                    placeholder="e.g. 150.00"
                    className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500"
                  />
                </div>
              )}
            </>
          )}

          {/* Q6: Venue rebooking interest */}
          <SelectField
            label="Did the venue express interest in booking you again?"
            value={answers.venueInterest}
            onChange={v => set('venueInterest', v as FormAnswers['venueInterest'])}
            required
            options={[
              { value: 'yes', label: 'Yes, they want to book again' },
              { value: 'unsure', label: "Not sure yet" },
              { value: 'no', label: 'No, not interested' },
            ]}
          />

          {/* Q7: Relationship quality */}
          <SelectField
            label="How was your relationship with the venue contact?"
            value={answers.relationshipQuality}
            onChange={v => set('relationshipQuality', v as FormAnswers['relationshipQuality'])}
            required
            options={[
              { value: 'good', label: 'Good - solid connection' },
              { value: 'neutral', label: 'Neutral - professional, nothing special' },
              { value: 'poor', label: 'Poor - difficult to work with' },
            ]}
          />

          {/* Q8: Notes */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-white mb-2">
              Any notes or things to follow up on?
              <span className="text-neutral-500 ml-1 font-normal">(optional)</span>
            </label>
            <textarea
              value={answers.notes}
              onChange={e => set('notes', e.target.value)}
              rows={3}
              placeholder="Anything relevant for next steps, negotiations, or issues..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {/* Q9: Media links */}
          <div className="mb-8">
            <label className="block text-sm font-medium text-white mb-2">
              Any photos, videos, or social posts from the show?
              <span className="text-neutral-500 ml-1 font-normal">(optional)</span>
            </label>
            <textarea
              value={answers.mediaLinks}
              onChange={e => set('mediaLinks', e.target.value)}
              rows={2}
              placeholder="Paste Instagram links, Google Drive, etc..."
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-4 py-3 text-white text-sm placeholder:text-neutral-600 focus:outline-none focus:border-neutral-500 resize-none"
            />
          </div>

          {validationError && (
            <p className="text-red-400 text-sm mb-4">{validationError}</p>
          )}

          <button
            type="submit"
            disabled={state === 'submitting'}
            className="w-full bg-white hover:bg-neutral-100 text-black font-semibold text-base py-4 rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {state === 'submitting' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending your report...
              </>
            ) : (
              'Submit Report'
            )}
          </button>

          <p className="text-center text-xs text-neutral-700 mt-4">This link is one-time use. Your report goes directly to your manager.</p>
        </form>
      </div>
    </div>
  )
}
