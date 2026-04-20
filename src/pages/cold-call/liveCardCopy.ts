import type { ArtistProfile } from '@/types'
import { COLD_CALL_PITCH_REASON_CHIPS } from '@/lib/coldCall/coldCallPayload'
import type { ColdCallDataV1, ColdCallLiveCardId } from '@/lib/coldCall/coldCallPayload'

export function coldCallFirstName(full: string): string {
  const t = full.trim()
  if (!t) return ''
  return t.split(/\s+/)[0] ?? ''
}

export function liveCardStepTitle(card: ColdCallLiveCardId): string {
  switch (card) {
    case 'p1':
      return 'The Opener'
    case 'p2a':
      return 'The Redirect'
    case 'p2a_detail':
      return 'Decision-maker details'
    case 'p3':
      return 'The Pitch'
    case 'p3b':
      return 'The Pivot'
    case 'p3c':
      return 'Graceful parking'
    case 'p4d':
      return 'The Price Pivot'
    case 'p5':
      return 'The Ask'
    case 'p6':
      return 'The Close'
    case 'p6_vm':
      return 'Voicemail'
    case 'p6_na':
      return 'No answer'
    default:
      return 'Cold call'
  }
}

export type ColdCallScriptCtx = {
  artistName: string
  managerFirst: string
  managerPhone: string
  /** Tagline / bio-style line — not spoken in scripts; optional operator reference elsewhere. */
  credentialsLine: string
}

export function coldCallScriptContext(profile: ArtistProfile | null): ColdCallScriptCtx {
  const artistName = profile?.artist_name?.trim() || 'the artist'
  const managerFull = profile?.manager_name?.trim() || profile?.company_name?.trim() || ''
  const managerFirst = coldCallFirstName(managerFull) || 'I'
  const managerPhone = profile?.manager_phone?.trim() || ''
  const credentialsLine = profile?.tagline?.trim() || 'an experienced club & event DJ with strong radio and brand work.'
  return { artistName, managerFirst, credentialsLine, managerPhone }
}

function nameOrHey(d: ColdCallDataV1): string {
  const raw =
    d.target_name.trim()
    || (d.who_answered === 'wrong_person' ? d.gatekeeper_name.trim() : '')
    || d.decision_maker_name.trim()
  return coldCallFirstName(raw)
}

function pitchBecauseClause(d: ColdCallDataV1): string {
  const chip = d.pitch_reason_chip
  if (chip && COLD_CALL_PITCH_REASON_CHIPS[chip]) {
    return COLD_CALL_PITCH_REASON_CHIPS[chip].clause({ venue: d.venue_name, city: d.city })
  }
  const custom = d.pitch_reason_custom.trim()
  if (custom) return custom
  return `I think there’s a good fit here`
}

function hasContactName(d: ColdCallDataV1): boolean {
  return !!(d.target_name.trim() || d.decision_maker_name.trim() || d.gatekeeper_name.trim())
}

export type ColdCallScriptBeat = {
  text: string
  situational?: boolean
  /** Second+ line under the same “After they answer” block (no repeated label). */
  situationalChain?: boolean
}

const PITCH_INLINE_BIO_LINES = [
  '📋 Quick bio:',
  'He’s been in the game 20+ years. Currently on air at Cali 93.9.',
  'Worked with J.Lo, Pitbull, Kendrick, Nas. Brands like Jack Daniel’s and Golden Boy.',
  'He’s not just a DJ — he’s an entertainer. He grabs the mic, hypes the crowd, brings energy.',
  '147K on Instagram. He brings his own audience.',
]

/** Script lines for the live cold-call cards; `situational` beats are follow-ups after they answer the opening question. */
export function coldCallLiveScriptBeats(
  card: ColdCallLiveCardId,
  d: ColdCallDataV1,
  ctx: ColdCallScriptCtx,
): ColdCallScriptBeat[] {
  const vn = d.venue_name.trim() || 'your spot'
  const n = nameOrHey(d)
  const phone = ctx.managerPhone.trim() || 'the number I’m calling from'
  const { artistName, managerFirst } = ctx

  switch (card) {
    case 'p1': {
      if (d.call_purpose === 'follow_up' && n) {
        return [
          { text: `Hey ${n}, it’s ${managerFirst} — we spoke a little while back about ${artistName}.` },
          { text: `You mentioned to follow up around now, so I wanted to check in.` },
        ]
      }
      const venueLine = d.venue_name.trim()
      if (!venueLine) {
        return [
          { text: `Hey, how’s it going — I’m trying to reach the right person about DJ bookings. Who am I speaking with?` },
        ]
      }
      return [
        { text: `Hey, is this ${venueLine}?` },
        {
          text: `Perfect — are you guys currently booking DJs for any upcoming events?`,
          situational: true,
        },
      ]
    }
    case 'p2a':
      return [
        {
          text: `No worries — who would be the right person to talk to about this, and what’s the best way to reach them?`,
        },
      ]
    case 'p2a_detail':
      return [{ text: `Perfect — I appreciate you.` }]
    case 'p3': {
      const because = pitchBecauseClause(d)
      const hasReason = !!(d.pitch_reason_chip || d.pitch_reason_custom.trim())
      const lines: ColdCallScriptBeat[] = [
        { text: `My name’s ${managerFirst} — I work with ${artistName}.` },
        {
          text: `We’ve done work with brands like Jack Daniel’s, Golden Boy, and he’s currently on air at Cali 93.9.`,
        },
        {
          text: hasReason
            ? `I came across you guys and honestly — ${because}.`
            : `I came across you guys and honestly — I think there’s a good fit here.`,
        },
        {
          text: `Let me ask you this — what does a typical DJ night look like for you guys right now?`,
        },
      ]
      if (d.initial_reaction === 'tell_me_more' && d.pitch_bio_expanded) {
        lines.push({
          text: PITCH_INLINE_BIO_LINES.join('\n'),
          situational: true,
        })
      }
      return lines
    }
    case 'p3b':
      return [
        { text: `That makes sense — a good rotation is hard to build.` },
        {
          text: `Here’s the thing — what I’ve seen work is bringing him in as a guest for one night. No commitment, no replacing anyone — just a night to see what he adds to the room.`,
        },
      ]
    case 'p3c': {
      if (n) {
        return [
          { text: `No worries at all, ${n}.` },
          { text: `I’d love to just stay on your radar for when the timing works out.` },
          { text: `Cool if I send over ${artistName}’s info so you have it?` },
        ]
      }
      return [
        { text: `No worries at all.` },
        { text: `I’d love to stay on your radar for when the timing works out.` },
        { text: `Cool if I send over ${artistName}’s info?` },
      ]
    }
    case 'p4d': {
      const beats: ColdCallScriptBeat[] = [
        {
          text: `For a single set he’s at $1,500, but honestly it depends on the setup — if there’s a bigger opportunity here we can figure out something that works.`,
        },
      ]
      if (d.price_primary_reaction === 'too_much') {
        beats.push({
          text: `That makes sense. What if we did a trial night at a reduced rate — that way there’s less risk and you get to see what he does?`,
          situational: true,
        })
      }
      return beats
    }
    case 'p5': {
      const fromPrice = d.live_history.includes('p4d')
      if (fromPrice) {
        return [
          {
            text: `Excellent — and that’s exactly why I think a trial night makes sense. Would it be cool if we set one up?`,
          },
        ]
      }
      return [
        {
          text: `I’d love to get him in front of you guys — even just one night so you can see what he does.`,
        },
        { text: `Would it be cool if we set up a trial night?` },
      ]
    }
    case 'p6': {
      const t = d.operator_temperature || d.final_temperature
      const named = hasContactName(d)
      if (t === 'dead')
        return [{ text: `I appreciate your time — seriously. Enjoy the rest of your day.` }]
      if (t === 'cold') {
        const out: ColdCallScriptBeat[] = [
          {
            text: `I appreciate your time. I’ll keep you guys on my radar and circle back when the timing’s better. Enjoy the rest of your day.`,
          },
        ]
        if (!named) {
          out.push({ text: `I didn’t catch your name — what was it again?`, situational: true })
        }
        return out
      }
      if (t === 'warm') {
        const out: ColdCallScriptBeat[] = [
          {
            text: `I’ll send everything your way. I’ll give you some time to look at it and check in soon. Thanks again, I appreciate you — enjoy the rest of your day.`,
          },
        ]
        if (!named) {
          out.push({ text: `Who am I sending this to?`, situational: true })
          out.push({
            text: `I appreciate you — I didn’t catch your name?`,
            situational: true,
            situationalChain: true,
          })
        }
        return out
      }
      if (t === 'hot') {
        const out: ColdCallScriptBeat[] = [
          {
            text: `I’ll get everything together and send it over. I’ll check in in a few days to lock something in. Thanks again, I appreciate you — enjoy the rest of your day.`,
          },
        ]
        if (!named) {
          out.push({ text: `Who am I sending this to?`, situational: true })
        }
        return out
      }
      if (t === 'converting') {
        if (d.p6_convert_mode === 'theyll_do_later') {
          return [
            {
              text: `No worries — I’ll get everything together and send it your way. I’ll check in tomorrow to lock it in. I appreciate you.`,
            },
          ]
        }
        const conv: ColdCallScriptBeat[] = [
          {
            text: `Perfect — I can actually get everything set up right now if you’ve got a couple more minutes.`,
          },
        ]
        if (!named) {
          conv.push({ text: `Who am I setting this up for?`, situational: true })
        }
        return conv
      }
      const out: ColdCallScriptBeat[] = [
        { text: `Thanks again, I appreciate you — enjoy the rest of your day.` },
      ]
      if (!named) {
        out.push({ text: `I didn’t catch your name?`, situational: true })
      }
      return out
    }
    case 'p6_vm': {
      if (n) {
        return [
          { text: `Hey ${n}, it’s ${managerFirst} — I work with a DJ named ${artistName}.` },
          { text: `I came across ${vn} and honestly think he’d be a great fit for what you guys are doing.` },
          { text: `Would love to connect real quick when you get a chance — my number is ${phone}.` },
          { text: `Again, it’s ${managerFirst} — talk soon.` },
        ]
      }
      return [
        { text: `Hey, this is ${managerFirst} — I work with a DJ named ${artistName}.` },
        {
          text: `I’m reaching out to ${vn} because I think he’d bring a lot to what you guys have going on.`,
        },
        {
          text: `If whoever handles entertainment can give me a call at ${phone}, I’d appreciate it.`,
        },
        { text: `${managerFirst} with ${artistName}. Thanks.` },
      ]
    }
    case 'p6_na':
      return [{ text: `No answer.` }]
    default:
      return []
  }
}

/** @deprecated Prefer `coldCallLiveScriptBeats` when you need situational styling. */
export function scriptBeatsForCard(card: ColdCallLiveCardId, d: ColdCallDataV1, ctx: ColdCallScriptCtx): string[] {
  return coldCallLiveScriptBeats(card, d, ctx).map(b => b.text)
}

/** Backwards-compatible single string. */
export function scriptForCard(card: ColdCallLiveCardId, d: ColdCallDataV1, managerPhone: string): string {
  const ctx = coldCallScriptContext(null)
  return coldCallLiveScriptBeats(card, d, { ...ctx, managerPhone: managerPhone.trim() || ctx.managerPhone })
    .map(b => b.text)
    .join(' ')
}
