import type { ArtistProfile } from '@/types'
import type { ColdCallDataV1, ColdCallLiveCardId } from '@/lib/coldCall/coldCallPayload'
import { COLD_CALL_PITCH_REASON_CHIPS } from '@/lib/coldCall/coldCallPayload'

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
    case 'p2_msg':
      return 'Message left'
    case 'p3':
      return 'The Pitch'
    case 'p3b':
      return 'The Pivot'
    case 'p3c':
      return 'Graceful parking'
    case 'p4a':
      return 'Their event nights'
    case 'p4b':
      return 'Music & crowd'
    case 'p4c':
      return 'How they book'
    case 'p4d':
      return 'The Price Pivot'
    case 'p4e':
      return 'Capacity & entity type'
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
    || (d.who_answered === 'gatekeeper' ? d.gatekeeper_name.trim() : '')
    || d.decision_maker_name.trim()
  return coldCallFirstName(raw)
}

function pitchBecauseClause(d: ColdCallDataV1): string {
  if (d.pitch_reason_custom.trim()) return d.pitch_reason_custom.trim()
  if (d.pitch_reason_chip && COLD_CALL_PITCH_REASON_CHIPS[d.pitch_reason_chip]) {
    return COLD_CALL_PITCH_REASON_CHIPS[d.pitch_reason_chip].clause({
      venue: d.venue_name.trim() || 'your spot',
      city: d.city.trim() || 'the area',
    })
  }
  return ''
}

export type ColdCallScriptBeat = { text: string; situational?: boolean }

/** Script lines for the live cold-call cards; `situational` beats are follow-ups after they answer the opening question. */
export function coldCallLiveScriptBeats(
  card: ColdCallLiveCardId,
  d: ColdCallDataV1,
  ctx: ColdCallScriptCtx,
): ColdCallScriptBeat[] {
  const vn = d.venue_name.trim() || 'your spot'
  const n = nameOrHey(d)
  const events = d.known_events.trim()
  const phone = ctx.managerPhone.trim() || 'the number I’m calling from'
  const because = pitchBecauseClause(d)
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
          { text: `Hey, this is ${managerFirst} — I’m calling about live DJ bookings for venues.` },
          {
            text: `Perfect — are you guys currently booking DJs for any upcoming events?`,
            situational: true,
          },
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
      return [
        {
          text: `Perfect, I appreciate you. I’ll reach out to them. Thanks again — enjoy the rest of your day.`,
        },
      ]
    case 'p2_msg':
      return [
        { text: `Could you let them know ${managerFirst} called about ${artistName}?` },
        { text: `My number is ${phone} if they want to reach back.` },
        { text: `I appreciate it.` },
      ]
    case 'p3': {
      const lines: ColdCallScriptBeat[] = [
        { text: `My name’s ${managerFirst} — I work with ${artistName}.` },
        {
          text: `He’s on the radio out here, Cali 93.9, and we’ve worked with brands like Jack Daniel’s and Golden Boy.`,
        },
      ]
      if (because) {
        lines.push({
          text: `I came across you guys and honestly — ${because}.`,
        })
      } else {
        lines.push({
          text: `Honestly, I came across you guys and I think he’d be a great fit for what you’re doing.`,
        })
      }
      if (events) {
        lines.push({
          text: `Acknowledge what they said — reflect why it’s valuable before you move on.`,
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
    case 'p4a':
      return [{ text: `Good to know.` }, { text: `What nights do you usually have events or bring DJs in?` }]
    case 'p4b':
      return [{ text: `What kind of music does your crowd go for?` }]
    case 'p4c':
      return [
        {
          text: `And how does booking usually work on your end — do you handle that, or is there someone else I should talk to?`,
        },
      ]
    case 'p4d':
      return [
        {
          text: `For a single set he’s at $1,500, but honestly it depends on the setup — if there’s a bigger opportunity here we can figure out something that works.`,
        },
        {
          text: `That makes sense. What if we did a trial night at a reduced rate — that way there’s less risk and you get to see what he does?`,
          situational: true,
        },
      ]
    case 'p4e':
      return [{ text: `And roughly how big is the space?` }]
    case 'p5': {
      return [
        {
          text: `I’d love to get him in front of you guys — even just one night so you can see what he does.`,
        },
        { text: `Would it be cool if we set up a trial night?` },
      ]
    }
    case 'p6': {
      const t = d.operator_temperature || d.final_temperature
      if (t === 'dead')
        return [{ text: `I appreciate your time — seriously. Enjoy the rest of your day.` }]
      if (t === 'cold') {
        return [
          {
            text: `I appreciate your time. I’ll keep you guys on my radar and circle back when the timing’s better. Enjoy the rest of your day.`,
          },
        ]
      }
      if (t === 'warm') {
        return [
          {
            text: `I’ll send everything your way. I’ll give you some time to look at it and check in soon. Thanks again, I appreciate you — enjoy the rest of your day.`,
          },
        ]
      }
      if (t === 'hot') {
        return [
          {
            text: `I’ll get everything together and send it over. I’ll check in in a few days to lock something in. Thanks again, I appreciate you — enjoy the rest of your day.`,
          },
        ]
      }
      if (t === 'converting')
        return [
          {
            text: `Perfect — I can actually get everything set up right now if you’ve got a couple more minutes.`,
          },
        ]
      return [{ text: `Thanks again, I appreciate you — enjoy the rest of your day.` }]
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
