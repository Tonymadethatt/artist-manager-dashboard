import type { ColdCallDataV1, ColdCallLiveCardId } from '@/lib/coldCall/coldCallPayload'

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
      return 'Budget (hot call only)'
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

function nameOrHey(d: ColdCallDataV1): string {
  const raw =
    d.target_name.trim() ||
    (d.confirmed_name === 'different' ? d.different_name_note : '') ||
    d.decision_maker_name.trim()
  const first = coldCallFirstName(raw)
  return first
}

export function scriptForCard(card: ColdCallLiveCardId, d: ColdCallDataV1, managerPhone: string): string {
  const vn = d.venue_name.trim() || 'your venue'
  const city = d.city.trim() || 'the area'
  const pitchBit = (d.pitch_angle.trim() || d.venue_vibe.trim() || 'what you’re doing').trim()
  const n = nameOrHey(d)
  const events = d.known_events.trim()
  const phone = managerPhone.trim() || 'the number I’m calling from'

  switch (card) {
    case 'p1':
      if (d.call_purpose === 'follow_up' && n) {
        return `Hey, ${n}? This is Tony — I called a little while back about DJ Luijay. You told me to follow up around this time.`
      }
      if (n) return `Hey, I’m looking for ${n} — is this them?`
      return `Hey, I’m trying to reach whoever handles the entertainment or DJ bookings at ${vn} — who would that be?`
    case 'p2a':
      return `No worries — I’m Tony, I’m the manager for DJ Luijay. We work with a lot of venues in the ${city} area and I wanted to connect with whoever handles your entertainment or DJ bookings. Could you point me in the right direction?`
    case 'p2a_detail':
      return `Perfect, I appreciate that. I’ll reach out to them directly. Thanks for your help.`
    case 'p2_msg':
      return `Could you let them know Tony from DJ Luijay’s team called? If they want to reach back, my number is ${phone}. Appreciate it.`
    case 'p3': {
      let s = ''
      if (n) {
        s = `${n}, I appreciate you taking the call. I’m Tony — I manage and partner with DJ Luijay. He’s an LA-based DJ, does a lot of work on the radio with Cali 93.9, and has worked with brands like Jack Daniel’s and Golden Boy. I came across ${vn} and honestly thought it’d be a great fit for what he does — ${pitchBit}. Do you guys ever bring in guest DJs or have any nights where you’re open to trying someone new?`
      } else {
        s = `I appreciate you taking the call. I’m Tony — I manage and partner with DJ Luijay. He’s an LA-based DJ, does a lot of work on the radio with Cali 93.9, and has worked with brands like Jack Daniel’s and Golden Boy. I came across ${vn} and honestly thought it’d be a great fit for what he does — ${pitchBit}. Do you guys ever bring in guest DJs or have any nights where you’re open to trying someone new?`
      }
      if (events) s += ` I saw you guys do ${events} — that’s right in Luijay’s wheelhouse.`
      return s
    }
    case 'p3b':
      return `Totally makes sense — most good venues have their core rotation. Do you ever bring in a guest DJ for special nights, themed events, or when one of your regulars can’t make it? That’s usually where someone like Luijay fits — he comes in, brings his crowd, and elevates the night without stepping on anyone’s toes.`
    case 'p3c': {
      const closeName = n ? `${n}, ` : ''
      return `No worries at all, ${closeName}I’d love to just stay on your radar for when the timing’s right. Would it be cool if I sent over Luijay’s info so you have it? That way if something comes up, you’ve already got everything you need.`
    }
    case 'p4a':
      return `That’s great to hear. So what nights do you guys typically have events or bring in DJs?`
    case 'p4b':
      return `And what kind of music does your crowd lean towards? What’s the vibe on those nights?`
    case 'p4c':
      return `How does your booking process usually work — do you handle that directly, or is there someone else I should be talking to?`
    case 'p4d':
      return `Just so I can put together something that makes sense for you — what do you typically budget for a DJ on those nights?`
    case 'p4e':
      return `And roughly how big is the space — like what’s the capacity?`
    case 'p5': {
      const night = d.event_nights[0] ?? 'your event nights'
      if (d.call_purpose === 'one_time') {
        return `I think Luijay would crush it for a night you’ve got coming up. What does it look like to get him on the lineup?`
      }
      if (d.call_purpose === 'residency') {
        return `Here’s what I’m thinking${n ? `, ${n}` : ''} — Luijay would be a strong fit for your ${night} nights. What would it take to get him on for a trial night so you can see what he brings?`
      }
      return `Would you be open to having Luijay come through for a night — even as a trial — so you can see what he does? No long-term commitment, just one night to prove the value.`
    }
    case 'p6': {
      const t = d.operator_temperature || d.final_temperature
      const nm = n
      if (t === 'dead') return `I appreciate your time. If anything ever changes, don’t hesitate to reach out. Have a good one.`
      if (t === 'cold')
        return `No worries at all. I’ll follow up down the road in case the timing works out better. Thanks for your time${nm ? `, ${nm}` : ''}.`
      if (t === 'warm')
        return `I’ll send over Luijay’s info right now so you’ve got it. I’ll follow up soon to see where things stand. Really appreciate your time${nm ? `, ${nm}` : ''}.`
      if (t === 'hot')
        return `I’ll put something together for you this week — dates, rates, everything you need. I’ll follow up to lock it in${nm ? `. ${nm}, this could be a great fit` : ''} — I appreciate you.`
      if (t === 'converting')
        return `Let’s do it. I can get everything set up right now if you’ve got a few more minutes — I’ll walk you through the details and we’ll get the date locked in.`
      return `Thanks again for the time — I’ll follow up with next steps.`
    }
    case 'p6_vm':
      return `Leave a short, confident voicemail: who you are, why Luijay fits ${vn}, and the best callback number.`
    case 'p6_na':
      return `No answer — try again later or follow up on another channel when it makes sense.`
    default:
      return ''
  }
}
