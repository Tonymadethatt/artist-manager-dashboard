import { useCallback, useMemo, useState } from 'react'
import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ScriptBlock =
  | { type: 'heading'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'coach'; text: string }
  | { type: 'question'; id: string; text: string }

const SECTIONS: { title: string; blocks: ScriptBlock[] }[] = [
  {
    title: 'The opener',
    blocks: [
      {
        type: 'paragraph',
        text:
          '“Hey Rafael, how’s it going? This is [your name] — I work with DJ Luijay on the logistics and front-office side. He mentioned he connected with you and I just wanted to jump on a quick call to get all the details locked in so we can make this a smooth experience for everybody. I really appreciate you reaching out to him for this — sounds like a great event.”',
      },
      {
        type: 'coach',
        text:
          'Keep it warm and confident. You’re not asking for permission to be on the call — DJ Luijay already vouched for you. Act like this is routine, because for someone in your role, it is.',
      },
      {
        type: 'paragraph',
        text:
          '“Alright, so let’s start with the basics so I have everything on my end documented correctly.”',
      },
    ],
  },
  {
    title: 'Event details',
    blocks: [
      {
        type: 'question',
        id: 'q-date',
        text: 'What’s the exact date of the after-party?',
      },
      {
        type: 'question',
        id: 'q-city-venue',
        text:
          'What city in Texas is this taking place? Do you have the venue name and address handy?',
      },
      {
        type: 'question',
        id: 'q-times',
        text:
          'What time would you need DJ Luijay on — what’s his actual start time and what time does the hour wrap?',
      },
      {
        type: 'question',
        id: 'q-indoor',
        text: 'Is the event indoors or outdoors?',
      },
      {
        type: 'question',
        id: 'q-guests',
        text: 'Roughly how many guests are you expecting?',
      },
    ],
  },
  {
    title: 'Equipment & setup',
    blocks: [
      {
        type: 'question',
        id: 'q-dj-setup',
        text:
          'Will the venue have a full DJ setup already in place, like CDJs, a mixer, and speakers? Or is DJ Luijay expected to bring his own equipment?',
      },
      {
        type: 'coach',
        text:
          'If they say the venue provides everything — great, that keeps the cost at the $1,000 rate already discussed. If he needs to bring gear, note it — that affects the final price and flag it to DJ Luijay before confirming.',
      },
      {
        type: 'question',
        id: 'q-rider',
        text:
          'Is there a stage plot or tech rider the venue requires? Who’s the on-site technical contact the night of the show?',
      },
    ],
  },
  {
    title: 'Travel & lodging',
    blocks: [
      {
        type: 'paragraph',
        text:
          'Ask naturally — it’s a standard question for any out-of-state headliner booking.',
      },
      {
        type: 'question',
        id: 'q-travel-covered',
        text:
          '“Since DJ Luijay will be coming in from Los Angeles, I want to make sure travel and lodging are sorted ahead of time. Is that something your team is covering, or something we need to factor into the overall package?”',
      },
      {
        type: 'subheading',
        text: 'If Rafael says yes — they’re covering it',
      },
      {
        type: 'question',
        id: 'q-booking-method',
        text:
          '“Perfect. Will your team be booking the flight and hotel directly, or reimbursing after the fact?”',
      },
      {
        type: 'question',
        id: 'q-hotel-budget',
        text: '“What’s the approved hotel budget per night you’re working with?”',
      },
      {
        type: 'question',
        id: 'q-soundcheck-time',
        text:
          '“What time is he expected for soundcheck? That tells us if he’s flying same-day or the night before — and how many nights we’re looking at.”',
      },
      {
        type: 'subheading',
        text: 'If Rafael says no — it’s not covered',
      },
      {
        type: 'question',
        id: 'q-buyout-path',
        text:
          '“Got it — I wanted to confirm so we’re on the same page. We’ll put together a travel buyout number and fold that into the overall figure before we finalize. I’ll work that out on our end and get back to you with the updated total. Does that work?”',
      },
      {
        type: 'coach',
        text:
          'Don’t panic if he pushes back. Travel buyouts for out-of-state artists are normal — you’re flagging it upfront, not after the contract is signed.',
      },
      {
        type: 'subheading',
        text: 'If Rafael asks what a travel buyout usually looks like',
      },
      {
        type: 'question',
        id: 'q-buyout-explain',
        text:
          '“It really depends on flight costs and how many nights are needed, but we’ll put together a fair number based on actual logistics and share it before anything is finalized. Nothing gets locked until you’ve seen the full breakdown and we’re both good with it.”',
      },
    ],
  },
  {
    title: 'Payment & invoice',
    blocks: [
      {
        type: 'question',
        id: 'q-rate-confirm',
        text:
          '“The rate for the one-hour set is the $1,000 you already saw — are we good to move forward on that?”',
      },
      {
        type: 'coach',
        text: 'Wait for confirmation before moving on.',
      },
      {
        type: 'question',
        id: 'q-deposit-split',
        text:
          '“Perfect. We typically split it — 50% deposit upfront to hold the date, and the remaining balance due before the event. Does that work on your end?”',
      },
      {
        type: 'question',
        id: 'q-invoice-who',
        text:
          '“Who should the invoice go to — directly to you, or a promoter / event company?”',
      },
      {
        type: 'question',
        id: 'q-invoice-email',
        text: '“What’s the best email for that?”',
      },
      {
        type: 'question',
        id: 'q-payment-method',
        text:
          '“For payment, we accept PayPal, Cash App, or check — which works best for you?”',
      },
    ],
  },
  {
    title: 'Point of contact & contract',
    blocks: [
      {
        type: 'question',
        id: 'q-contact-info',
        text:
          '“Last thing — what’s the best number and email to reach you throughout this process? You’ll be my main point of contact on your end?”',
      },
      {
        type: 'question',
        id: 'q-next-steps',
        text:
          '“Great. I’ll get the contract drafted and sent shortly. Once we have the signed agreement and the deposit in, the date is officially locked.”',
      },
    ],
  },
  {
    title: 'The closer',
    blocks: [
      {
        type: 'paragraph',
        text:
          '“Rafael, I really appreciate you taking the time — this sounds like an amazing event and DJ Luijay is going to bring the energy, no question. I’ll follow up with everything in writing so you have it all in one place. If anything comes up before then, don’t hesitate to reach out to me directly. Looking forward to making this happen.”',
      },
      {
        type: 'coach',
        text:
          'End the call first if you can. It signals you have everything you need and keeps the energy clean. Don’t linger.',
      },
    ],
  },
  {
    title: 'Quick reference — capture on the call',
    blocks: [
      {
        type: 'question',
        id: 'cap-date-venue',
        text: 'Captured: exact date & venue address (contract + travel)',
      },
      {
        type: 'question',
        id: 'cap-times',
        text: 'Captured: set start/end time (overtime, soundcheck)',
      },
      {
        type: 'question',
        id: 'cap-gear',
        text: 'Captured: equipment provided or not (affects final rate)',
      },
      {
        type: 'question',
        id: 'cap-lodging',
        text: 'Captured: lodging covered or buyout needed',
      },
      {
        type: 'question',
        id: 'cap-soundcheck',
        text: 'Captured: soundcheck time (1 vs 2 hotel nights)',
      },
      {
        type: 'question',
        id: 'cap-invoice',
        text: 'Captured: invoice name & email',
      },
      {
        type: 'question',
        id: 'cap-pay',
        text: 'Captured: payment method (deposit speed)',
      },
    ],
  },
]

function collectQuestionIds(): string[] {
  const ids: string[] = []
  for (const s of SECTIONS) {
    for (const b of s.blocks) {
      if (b.type === 'question') ids.push(b.id)
    }
  }
  return ids
}

const ALL_QUESTION_IDS = collectQuestionIds()

export default function RafaelLamasCallScript() {
  const [done, setDone] = useState<Set<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const clearAll = useCallback(() => setDone(new Set()), [])

  const progress = useMemo(() => {
    const n = ALL_QUESTION_IDS.filter(id => done.has(id)).length
    return { n, total: ALL_QUESTION_IDS.length }
  }, [done])

  return (
    <div className="max-w-3xl mx-auto pb-12">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-1">
            Internal · Front Office
          </p>
          <h1 className="text-lg font-semibold text-white tracking-tight">
            Client call script — Rafael Lamas
          </h1>
          <p className="text-sm text-neutral-400 mt-0.5">
            Coachella after-party · Texas
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-neutral-500 tabular-nums">
            {progress.n}/{progress.total} checked
          </span>
          <button
            type="button"
            onClick={clearAll}
            className="text-xs font-medium text-neutral-400 hover:text-white border border-white/10 rounded-lg px-2.5 py-1.5 transition-colors"
          >
            Reset checklist
          </button>
        </div>
      </div>

      <p className="text-xs text-neutral-500 mb-8 border-l-2 border-white/10 pl-3">
        Nothing is saved — use this as a live checklist while you’re on the call. Tap a line to mark it done.
      </p>

      <div className="space-y-8">
        {SECTIONS.map(section => (
          <section
            key={section.title}
            className="rounded-xl border border-white/[0.07] bg-neutral-900/40 overflow-hidden"
          >
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500 px-4 py-2.5 border-b border-white/[0.06] bg-neutral-900/60">
              {section.title}
            </h2>
            <div className="p-4 space-y-3">
              {section.blocks.map((block, i) => {
                if (block.type === 'heading') {
                  return (
                    <h3 key={i} className="text-sm font-semibold text-white pt-1">
                      {block.text}
                    </h3>
                  )
                }
                if (block.type === 'subheading') {
                  return (
                    <p
                      key={i}
                      className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500 pt-2"
                    >
                      {block.text}
                    </p>
                  )
                }
                if (block.type === 'paragraph') {
                  return (
                    <p
                      key={i}
                      className="text-sm text-neutral-200 leading-relaxed whitespace-pre-wrap"
                    >
                      {block.text}
                    </p>
                  )
                }
                if (block.type === 'coach') {
                  return (
                    <p
                      key={i}
                      className="text-xs text-neutral-500 leading-relaxed italic border-l-2 border-amber-500/40 pl-3"
                    >
                      {block.text}
                    </p>
                  )
                }
                const isChecked = done.has(block.id)
                return (
                  <button
                    key={block.id}
                    type="button"
                    onClick={() => toggle(block.id)}
                    className={cn(
                      'w-full text-left flex gap-3 rounded-lg border px-3 py-2.5 transition-all duration-150',
                      isChecked
                        ? 'border-white/[0.06] bg-neutral-950/80 opacity-55'
                        : 'border-white/[0.1] bg-neutral-950/40 hover:border-white/[0.14] hover:bg-neutral-950/60',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors',
                        isChecked
                          ? 'border-emerald-600/80 bg-emerald-600/20 text-emerald-400'
                          : 'border-neutral-600 text-neutral-600',
                      )}
                    >
                      {isChecked ? (
                        <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                      ) : (
                        <Circle className="w-3 h-3 opacity-40" />
                      )}
                    </span>
                    <span
                      className={cn(
                        'text-sm leading-relaxed flex-1 min-w-0',
                        isChecked
                          ? 'text-neutral-500 line-through decoration-neutral-600'
                          : 'text-neutral-100',
                      )}
                    >
                      {block.text}
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[10px] text-neutral-600 text-center">
        Prepared for internal use only · DJ Luijay
      </p>
    </div>
  )
}
