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
      return 'Who picked up?'
    case 'p2a':
      return 'Gatekeeper'
    case 'p2a_detail':
      return 'Decision-maker details'
    case 'p2_msg':
      return 'Message left'
    case 'p3':
      return 'The pitch'
    case 'p3b':
      return 'Pivot — guest DJs'
    case 'p3c':
      return 'Graceful parking'
    case 'p4a':
      return 'Their event nights'
    case 'p4b':
      return 'Music & crowd'
    case 'p4c':
      return 'How they book'
    case 'p4d':
      return 'Budget (strong signal only)'
    case 'p4e':
      return 'Capacity & entity type'
    case 'p5':
      return 'The ask'
    case 'p6':
      return 'Close'
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
  if (d.pitch_angle.trim()) return d.pitch_angle.trim()
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
  const cityRaw = d.city.trim()
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
      if (n) {
        return [{ text: `Hey, is this ${n}?` }]
      }
      const placeForIntro = (() => {
        const v = d.venue_name.trim()
        if (v && cityRaw) return `${v} in ${cityRaw}`
        if (v) return v
        if (cityRaw) return `your venue in ${cityRaw}`
        return ''
      })()
      if (!placeForIntro) {
        return [
          { text: `Hey, this is ${managerFirst} — I’m calling about live DJ bookings for venues.` },
          { text: `Who am I speaking with?` },
        ]
      }
      return [
        { text: `Hey, this is ${managerFirst} — I wanted to confirm I’ve reached ${placeForIntro}.` },
        { text: `Who am I speaking with?` },
      ]
    }
    case 'p2a':
      return [
        { text: `No worries — I’m ${managerFirst}, I work with ${artistName}.` },
        {
          text: `We work with a few spots${cityRaw ? ` out in ${cityRaw}` : ''} and I wanted to reach whoever handles your DJ bookings or entertainment.`,
        },
        { text: `Any chance you could point me to the right person?` },
      ]
    case 'p2a_detail':
      return [
        { text: `Perfect, that’s super helpful.` },
        { text: `I’ll reach out to them.` },
        { text: `Thanks for your time.` },
      ]
    case 'p2_msg':
      return [
        { text: `Could you let them know ${managerFirst} called about ${artistName}?` },
        { text: `My number is ${phone} if they want to reach back.` },
        { text: `I appreciate it.` },
      ]
    case 'p3': {
      const lines: ColdCallScriptBeat[] = []
      if (n) lines.push({ text: `${n}, thanks for taking the call.` })
      else lines.push({ text: `Thanks for taking the call.` })
      lines.push({ text: `I’m ${managerFirst} — I work with a DJ out here named ${artistName}.` })
      if (because) {
        lines.push({
          text: `I came across ${vn} and honestly thought it’d be a solid match — ${because}.`,
        })
      } else {
        lines.push({
          text: `I came across ${vn} and thought there might be a fit with what you guys are doing.`,
        })
      }
      lines.push({ text: `Do you ever bring in outside DJs?` })
      if (events) {
        lines.push({
          text: `I noticed you run ${events} — that’s right up his alley.`,
          situational: true,
        })
      }
      return lines
    }
    case 'p3b':
      return [
        { text: `That makes total sense — most spots have their regulars.` },
        {
          text: `Do you ever bring someone in for a special night, or if one of your guys can’t make it?`,
        },
        {
          text: `That’s usually where someone like ${artistName} fits in — he comes in, brings energy, doesn’t step on anyone’s toes.`,
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
          text: `Just so I can put something together that makes sense for you — what do you usually budget for a DJ?`,
        },
      ]
    case 'p4e':
      return [{ text: `And roughly how big is the space?` }]
    case 'p5': {
      const night = d.event_nights[0] ?? 'your event nights'
      if (d.call_purpose === 'residency') {
        if (n) {
          return [
            {
              text: `Here’s what I’m thinking, ${n} — ${artistName} would be a solid fit for your ${night} nights.`,
            },
            { text: `What would it take to get him on for a trial night?` },
          ]
        }
        return [
          { text: `I think ${artistName} would be a solid fit for your ${night} nights.` },
          { text: `What would it take to get him on for a trial night?` },
        ]
      }
      if (d.call_purpose === 'upcoming_event' || d.call_purpose === 'one_time') {
        return [
          { text: `I think ${artistName} would be strong for a night you’ve got coming up.` },
          { text: `What does it look like to get him on?` },
        ]
      }
      return [
        {
          text: `Would you be open to ${artistName} coming through for a night — just a trial, no commitment?`,
        },
        { text: `One night to see what he brings.` },
      ]
    }
    case 'p6': {
      const t = d.operator_temperature || d.final_temperature
      if (t === 'dead')
        return [
          { text: `I appreciate your time.` },
          { text: `If anything changes down the road, feel free to reach out.` },
        ]
      if (t === 'cold') {
        if (n) {
          return [
            { text: `No worries at all.` },
            { text: `I’ll check back in down the road, ${n}.` },
            { text: `Thanks for your time.` },
          ]
        }
        return [
          { text: `No worries at all.` },
          { text: `I’ll check back in down the road.` },
          { text: `Thanks for your time.` },
        ]
      }
      if (t === 'warm') {
        if (n) {
          return [
            { text: `I’ll send ${artistName}’s info over right now so you’ve got it.` },
            { text: `I’ll follow up soon to see where things land.` },
            { text: `${n}, I appreciate the time.` },
          ]
        }
        return [
          { text: `I’ll send ${artistName}’s info over right now so you’ve got it.` },
          { text: `I’ll follow up soon to see where things land.` },
          { text: `Thanks for the time.` },
        ]
      }
      if (t === 'hot') {
        if (n) {
          return [
            { text: `I’ll put something together for you this week — dates, rates, everything.` },
            { text: `I’ll follow up in a couple days to get it locked in.` },
            { text: `${n}, this is gonna be solid — I appreciate you.` },
          ]
        }
        return [
          { text: `I’ll put something together this week — dates, rates, everything.` },
          { text: `I’ll follow up in a couple days to get it locked.` },
          { text: `Appreciate you.` },
        ]
      }
      if (t === 'converting')
        return [
          { text: `Let’s make it happen.` },
          {
            text: `I can actually get everything set up right now if you’ve got a few more minutes.`,
          },
        ]
      return [{ text: `Thanks for the time — I’ll follow up with next steps.` }]
    }
    case 'p6_vm': {
      if (n) {
        return [
          { text: `Hey ${n}, it’s ${managerFirst} — I work with a DJ named ${artistName}.` },
          { text: `I came across ${vn} and think he’d be a great fit for what you guys are doing.` },
          { text: `Would love to connect real quick when you get a chance.` },
          { text: `My number is ${phone}.` },
          { text: `Again, it’s ${managerFirst} — talk soon.` },
        ]
      }
      return [
        { text: `Hey, this is ${managerFirst} — I work with a DJ named ${artistName}.` },
        { text: `I’m reaching out to ${vn} because I think he’d be a solid addition to your lineup.` },
        { text: `If whoever handles entertainment can give me a call at ${phone}, I’d appreciate it.` },
        { text: `That’s ${managerFirst} with ${artistName}. Thanks.` },
      ]
    }
    case 'p6_na':
      return [{ text: `No answer — try again when it makes sense.` }]
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
