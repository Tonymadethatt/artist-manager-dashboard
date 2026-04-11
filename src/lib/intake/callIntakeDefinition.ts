export type ScriptBlock =
  | { type: 'heading'; text: string }
  | { type: 'subheading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'coach'; text: string }
  | { type: 'question'; id: string; text: string }

export type ScriptSection = { title: string; blocks: ScriptBlock[] }

/** Raw template copy (placeholders replaced in UI via artist profile). */
export const CALL_INTAKE_SECTIONS: ScriptSection[] = [
  {
    title: 'The opener',
    blocks: [
      {
        type: 'paragraph',
        text:
          '“Hey {{CLIENT_NAME}}, how’s it going? This is {{MANAGER_NAME}} — I work with {{ARTIST_NAME}} on the logistics and front-office side. {{ARTIST_NAME}} mentioned {{PRONOUN_CONNECTED}} connected with you and I just wanted to jump on a quick call to get all the details locked in so we can make this a smooth experience for everybody. I really appreciate you reaching out for this — sounds like a great event.”',
      },
      {
        type: 'coach',
        text:
          'Keep it warm and confident. You’re not asking for permission to be on the call — the artist already vouched for you. Act like this is routine, because for someone in your role, it is.',
      },
      {
        type: 'paragraph',
        text: '“Alright, so let’s start with the basics so I have everything on my end documented correctly.”',
      },
    ],
  },
  {
    title: 'Event details',
    blocks: [
      { type: 'question', id: 'q-date', text: 'What’s the exact date of the event?' },
      {
        type: 'question',
        id: 'q-city-venue',
        text: 'What city is this taking place in? Venue name and address?',
      },
      {
        type: 'question',
        id: 'q-times',
        text: 'What time is the artist on — actual start and when does the set wrap?',
      },
      { type: 'question', id: 'q-indoor', text: 'Is the event indoors or outdoors?' },
      { type: 'question', id: 'q-guests', text: 'Roughly how many guests are you expecting?' },
    ],
  },
  {
    title: 'Equipment & setup',
    blocks: [
      {
        type: 'question',
        id: 'q-dj-setup',
        text:
          'Will the venue have a full DJ setup already in place (CDJs, mixer, speakers), or is the artist expected to bring gear?',
      },
      {
        type: 'coach',
        text:
          'If the venue provides everything — great. If the artist needs to bring gear, note it — that affects the final price; flag it before confirming.',
      },
      {
        type: 'question',
        id: 'q-rider',
        text: 'Is there a stage plot or tech rider the venue requires? Who is the on-site technical contact?',
      },
    ],
  },
  {
    title: 'Travel & lodging',
    blocks: [
      {
        type: 'paragraph',
        text: 'Ask naturally — it’s a standard question for any out-of-area headliner booking.',
      },
      {
        type: 'question',
        id: 'q-travel-covered',
        text:
          '“Since travel may be involved, I want to make sure lodging and transport are sorted ahead of time. Is that something your team is covering, or something we need to factor into the overall package?”',
      },
      { type: 'subheading', text: 'If they’re covering it' },
      {
        type: 'question',
        id: 'q-booking-method',
        text: '“Will your team be booking travel directly, or reimbursing after the fact?”',
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
          '“What time is soundcheck? That tells us if it’s same-day or night-before — and how many nights we’re looking at.”',
      },
      { type: 'subheading', text: 'If it’s not covered' },
      {
        type: 'question',
        id: 'q-buyout-path',
        text:
          '“Got it — we’ll put together a travel buyout number and fold that into the overall figure before we finalize. I’ll work that out on our end and get back to you with the updated total. Does that work?”',
      },
      {
        type: 'coach',
        text:
          'Travel buyouts for out-of-area artists are normal — you’re flagging it upfront, not after the contract is signed.',
      },
      { type: 'subheading', text: 'If they ask what a buyout usually looks like' },
      {
        type: 'question',
        id: 'q-buyout-explain',
        text:
          '“It depends on logistics and nights needed, but we’ll share a fair number based on actual costs before anything is finalized.”',
      },
    ],
  },
  {
    title: 'Payment & invoice',
    blocks: [
      {
        type: 'question',
        id: 'q-rate-confirm',
        text: '“Confirming the performance rate we discussed — are we good to move forward on that number?”',
      },
      { type: 'coach', text: 'Wait for confirmation before moving on.' },
      {
        type: 'question',
        id: 'q-deposit-split',
        text:
          '“We typically split it — deposit upfront to hold the date, and the remaining balance due before the event. Does that work on your end?”',
      },
      {
        type: 'question',
        id: 'q-invoice-who',
        text: '“Who should the invoice go to — directly to you, or a promoter / event company?”',
      },
      { type: 'question', id: 'q-invoice-email', text: '“What’s the best email for that?”' },
      {
        type: 'question',
        id: 'q-payment-method',
        text: '“For payment, which method works best for you?”',
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
          '“What’s the best number and email to reach you? You’ll be my main point of contact on your end?”',
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
          '“{{CLIENT_NAME}}, I really appreciate you taking the time — this sounds like an amazing event and {{ARTIST_NAME}} is going to bring the energy. I’ll follow up with everything in writing. If anything comes up before then, reach out to me directly. Looking forward to making this happen.”',
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
      { type: 'question', id: 'cap-times', text: 'Captured: set start/end time (overtime, soundcheck)' },
      { type: 'question', id: 'cap-gear', text: 'Captured: equipment provided or not (affects final rate)' },
      { type: 'question', id: 'cap-lodging', text: 'Captured: lodging covered or buyout needed' },
      { type: 'question', id: 'cap-soundcheck', text: 'Captured: soundcheck time (nights / travel)' },
      { type: 'question', id: 'cap-invoice', text: 'Captured: invoice name & email' },
      { type: 'question', id: 'cap-pay', text: 'Captured: payment method (deposit speed)' },
    ],
  },
]

export function collectQuestionIds(sections: ScriptSection[]): string[] {
  const ids: string[] = []
  for (const s of sections) {
    for (const b of s.blocks) {
      if (b.type === 'question') ids.push(b.id)
    }
  }
  return ids
}

export const ALL_CALL_INTAKE_QUESTION_IDS = collectQuestionIds(CALL_INTAKE_SECTIONS)

/** Replace {{TOKENS}} in script template strings. */
export function personalizeScriptText(
  text: string,
  opts: {
    artistName: string
    managerName: string
    clientName: string
  },
): string {
  const artist = opts.artistName.trim() || 'the artist'
  const manager = opts.managerName.trim() || 'management'
  const client = opts.clientName.trim() || 'there'
  return text
    .replace(/\{\{ARTIST_NAME\}\}/g, artist)
    .replace(/\{\{MANAGER_NAME\}\}/g, manager)
    .replace(/\{\{CLIENT_NAME\}\}/g, client)
    .replace(/\{\{PRONOUN_CONNECTED\}\}/g, 'they')
}
