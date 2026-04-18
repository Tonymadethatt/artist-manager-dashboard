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
      return 'Capacity & venue type'
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
    || (d.confirmed_name === 'different' ? d.different_name_note : '')
    || d.decision_maker_name.trim()
  return coldCallFirstName(raw)
}

function pitchBecauseClause(d: ColdCallDataV1): string {
  if (d.pitch_reason_custom.trim()) return d.pitch_reason_custom.trim()
  if (d.pitch_reason_chip && COLD_CALL_PITCH_REASON_CHIPS[d.pitch_reason_chip]) {
    return COLD_CALL_PITCH_REASON_CHIPS[d.pitch_reason_chip].clause({
      venue: d.venue_name.trim() || 'your venue',
      city: d.city.trim() || 'the area',
    })
  }
  if (d.pitch_angle.trim()) return d.pitch_angle.trim()
  return ''
}

/** Short, skimmable lines (spec Problem 7). */
export function scriptBeatsForCard(card: ColdCallLiveCardId, d: ColdCallDataV1, ctx: ColdCallScriptCtx): string[] {
  const vn = d.venue_name.trim() || 'your venue'
  const city = d.city.trim() || 'the area'
  const n = nameOrHey(d)
  const events = d.known_events.trim()
  const phone = ctx.managerPhone.trim() || 'the number I’m calling from'
  const because = pitchBecauseClause(d)
  const { artistName, managerFirst, credentialsLine } = ctx

  switch (card) {
    case 'p1': {
      if (d.call_purpose === 'follow_up' && n) {
        return [
          `Hey${n ? `, ${n}` : ''}?`,
          `This is ${managerFirst} — I called a little while back about ${artistName}.`,
          `You told me to follow up around this time.`,
        ]
      }
      if (n) {
        return [`Hey — I’m looking for ${n}.`, `Is this them?`]
      }
      return [
        `Hey — I’m trying to reach whoever handles entertainment or DJ bookings at ${vn}.`,
        `Who would that be?`,
      ]
    }
    case 'p2a':
      return [
        `No worries — I’m ${managerFirst}, I manage ${artistName}.`,
        `We work with a lot of spots in the ${city} area.`,
        `I wanted to connect with whoever handles your entertainment or DJ bookings.`,
        `Could you point me in the right direction?`,
      ]
    case 'p2a_detail':
      return [`Perfect — I appreciate that.`, `I’ll reach out to them directly.`, `Thanks for your help.`]
    case 'p2_msg':
      return [
        `Could you let them know ${managerFirst} from ${artistName}’s team called?`,
        `If they want to reach back, my number is ${phone}.`,
        `Appreciate it.`,
      ]
    case 'p3': {
      const lines: string[] = []
      if (n) lines.push(`${n}, I appreciate you taking the call.`)
      else lines.push(`I appreciate you taking the call.`)
      lines.push(`I’m ${managerFirst} — I manage ${artistName}.`)
      lines.push(credentialsLine.endsWith('.') ? credentialsLine : `${credentialsLine}.`)
      if (because) {
        lines.push(`I came across ${vn} — I think ${artistName} would be a great fit because ${because}.`)
      } else {
        lines.push(`I came across ${vn} — I think ${artistName} would be a great fit for what you’re doing.`)
      }
      lines.push(`Do you ever bring in guest DJs or try someone new on a night?`)
      if (events) lines.push(`I saw you run ${events} — that lines up with what he does.`)
      return lines
    }
    case 'p3b':
      return [
        `Totally makes sense — most venues have a core rotation.`,
        `Do you ever bring in a guest DJ for special nights or when someone can’t make it?`,
        `That’s usually where someone like ${artistName} fits — elevates the room without stepping on toes.`,
      ]
    case 'p3c': {
      const closeName = n ? `${n}, ` : ''
      return [
        `No worries at all — ${closeName}I’d love to stay on your radar for when timing’s right.`,
        `Cool if I send ${artistName}’s info so you have it on file?`,
      ]
    }
    case 'p4a':
      return [`That’s great to hear.`, `What nights do you typically run events or bring in DJs?`]
    case 'p4b':
      return [`What kind of music does the crowd lean toward on those nights?`, `What’s the vibe?`]
    case 'p4c':
      return [
        `How does booking usually work here?`,
        `Do you handle that directly, or is there someone else I should talk to?`,
      ]
    case 'p4d':
      return [
        `Just so I can put something sensible together —`,
        `what do you typically budget for a DJ on those nights?`,
      ]
    case 'p4e':
      return [`Roughly how big is the room — capacity-wise?`]
    case 'p5': {
      const night = d.event_nights[0] ?? 'your event nights'
      if (d.call_purpose === 'upcoming_event') {
        return [
          `I think ${artistName} would be strong for an event you’ve got coming up.`,
          `What does it look like to get him on the lineup?`,
        ]
      }
      if (d.call_purpose === 'one_time') {
        return [`I think ${artistName} would crush it for a night you’ve got coming up.`, `What does getting him on the lineup look like?`]
      }
      if (d.call_purpose === 'residency') {
        return [
          `Here’s what I’m thinking${n ? `, ${n}` : ''} — ${artistName} would be a strong fit for your ${night} nights.`,
          `What would a trial night look like so you can see what he brings?`,
        ]
      }
      return [
        `Would you be open to ${artistName} coming through for a night — even as a trial?`,
        `No long-term lock-in — just one night to prove value.`,
      ]
    }
    case 'p6': {
      const t = d.operator_temperature || d.final_temperature
      if (t === 'dead') return [`I appreciate your time.`, `If anything changes, feel free to reach out.`, `Have a good one.`]
      if (t === 'cold')
        return [`No worries at all.`, `I’ll follow up down the road if timing gets better.`, `Thanks for your time${n ? `, ${n}` : ''}.`]
      if (t === 'warm')
        return [
          `I’ll send ${artistName}’s info now so you’ve got it.`,
          `I’ll follow up soon to see where things stand.`,
          `Appreciate your time${n ? `, ${n}` : ''}.`,
        ]
      if (t === 'hot')
        return [
          `I’ll put something together this week — dates, rates, the works.`,
          `I’ll follow up to lock it in.`,
          `Appreciate you${n ? `, ${n}` : ''}.`,
        ]
      if (t === 'converting')
        return [
          `Let’s do it.`,
          `If you’ve got a few minutes, I can walk you through details and get the date locked.`,
        ]
      return [`Thanks again for the time — I’ll follow up with next steps.`]
    }
    case 'p6_vm': {
      if (n) {
        return [
          `Hey ${n} — this is ${managerFirst}, I manage ${artistName}.`,
          `${credentialsLine.endsWith('.') ? credentialsLine.slice(0, -1) : credentialsLine}, and I came across ${vn}.`,
          `I think he’d be a great fit for what you’re doing.`,
          `Would love to connect quick — my number is ${phone}.`,
          `Again, ${managerFirst} with ${artistName} — talk soon.`,
        ]
      }
      return [
        `Hey — this is ${managerFirst}, I manage ${artistName}.`,
        `${credentialsLine.endsWith('.') ? credentialsLine.slice(0, -1) : credentialsLine}.`,
        `I’m reaching out to ${vn} because I think he’d be a strong addition to your lineup.`,
        `If whoever handles entertainment could call me at ${phone}, I’d appreciate it.`,
        `${managerFirst} with ${artistName}. Thanks.`,
      ]
    }
    case 'p6_na':
      return [`No answer.`, `Try again later or follow up another way when it makes sense.`]
    default:
      return []
  }
}

/** Backwards-compatible single string. */
export function scriptForCard(card: ColdCallLiveCardId, d: ColdCallDataV1, managerPhone: string): string {
  const ctx = coldCallScriptContext(null)
  return scriptBeatsForCard(card, d, { ...ctx, managerPhone: managerPhone.trim() || ctx.managerPhone }).join(' ')
}
