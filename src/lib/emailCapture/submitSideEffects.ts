import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailCaptureKind } from './kinds'

export type EmailCaptureTokenRow = {
  id: string
  user_id: string
  kind: EmailCaptureKind
  venue_id: string | null
  deal_id: string | null
  contact_id: string | null
}

function todayIsoDate(): string {
  return new Date().toISOString().split('T')[0]
}

function addDaysFromToday(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function venueNameOf(supabase: SupabaseClient, venueId: string | null): Promise<string> {
  if (!venueId) return 'venue'
  const { data } = await supabase.from('venues').select('name').eq('id', venueId).maybeSingle()
  return (data as { name?: string } | null)?.name?.trim() || 'venue'
}

async function mergeVenueDealTerms(
  supabase: SupabaseClient,
  venueId: string,
  userId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const { data: v } = await supabase.from('venues').select('deal_terms').eq('id', venueId).eq('user_id', userId).maybeSingle()
  const prev =
    v?.deal_terms && typeof v.deal_terms === 'object' && !Array.isArray(v.deal_terms)
      ? { ...(v.deal_terms as Record<string, unknown>) }
      : {}
  const next = { ...prev, ...patch }
  await supabase
    .from('venues')
    .update({ deal_terms: next, updated_at: new Date().toISOString() })
    .eq('id', venueId)
    .eq('user_id', userId)
}

function appendDealNote(supabase: SupabaseClient, dealId: string, block: string): Promise<void> {
  return (async () => {
    const { data: deal } = await supabase.from('deals').select('notes').eq('id', dealId).single()
    const prev = deal?.notes?.trim() ?? ''
    const next = prev ? `${prev}\n\n${block}` : block
    await supabase.from('deals').update({ notes: next, updated_at: new Date().toISOString() }).eq('id', dealId)
  })()
}

function contactMethodLabel(v: string): string {
  if (v === 'email') return 'Email'
  if (v === 'phone_text') return 'Phone / text'
  if (v === 'either') return 'Either works'
  return v
}

function referralSourceLabel(v: string): string {
  const m: Record<string, string> = {
    instagram: 'Instagram',
    referral: 'Referral',
    saw_perform: 'Saw them perform',
    radio: 'Radio',
    other: 'Other',
  }
  return m[v] ?? v
}

function infoNeededLabel(v: string): string {
  const m: Record<string, string> = {
    pricing: 'Pricing / rate card',
    song_demo: 'Song list or demo',
    availability_dates: 'Availability for specific dates',
    references: 'References from other venues',
    something_else: 'Something else',
  }
  return m[v] ?? v
}

function paymentStructureLabel(v: string): string {
  const m: Record<string, string> = {
    full_after_show: 'Full payment after the show',
    deposit_balance: 'Deposit up front, balance night-of',
    venue_advances: 'Venue pays in advance',
    separate: 'We will sort it out separately',
  }
  return m[v] ?? v
}

function budgetRangeLabel(v: string): string {
  const m: Record<string, string> = {
    under_500: 'Under $500',
    '500_1000': '$500–$1,000',
    '1000_2000': '$1,000–$2,000',
    over_2000: '$2,000+',
    discuss: 'Let us discuss',
  }
  return m[v] ?? v
}

/** Run after successful submit (idempotent safe if called once). */
export async function applyEmailCaptureSideEffects(
  supabase: SupabaseClient,
  row: EmailCaptureTokenRow,
  payload: Record<string, unknown>,
): Promise<void> {
  const { kind, user_id: userId, venue_id: venueId, deal_id: dealId } = row
  const today = todayIsoDate()
  const vName = await venueNameOf(supabase, venueId)

  switch (kind) {
    case 'pre_event_checkin': {
      const loadIn = String(payload.loadInOrSoundcheck ?? '').trim()
      const settlement = String(payload.settlementMethod ?? '').trim()
      const name = String(payload.dayOfContactName ?? '').trim()
      const phone = String(payload.dayOfContactPhone ?? '').trim()
      const email = String(payload.dayOfContactEmail ?? '').trim()
      const parking = String(payload.parkingNotes ?? '').trim()
      const riderUrl = String(payload.riderOrTechUrl ?? '').trim()
      const venueCapacity = String(payload.venueCapacity ?? '').trim()
      const genrePreference = Array.isArray(payload.genrePreference) ? payload.genrePreference.map(String) : []
      const mediaOnSite = String(payload.mediaOnSite ?? '').trim()
      const capLabel =
        venueCapacity === 'under_100'
          ? 'Under 100'
          : venueCapacity === '100_300'
            ? '100–300'
            : venueCapacity === '300_500'
              ? '300–500'
              : venueCapacity === 'over_500'
                ? '500+'
                : venueCapacity === 'not_sure'
                  ? 'Not sure'
                  : ''
      const genreLabels: Record<string, string> = {
        hip_hop_rnb: 'Hip-Hop / R&B',
        latin: 'Latin / Reggaeton',
        edm: 'EDM / Dance',
        top_40: 'Top 40 / Open Format',
        other_genre: 'Other',
      }
      const genreLine =
        genrePreference.length > 0
          ? genrePreference.map(g => genreLabels[g] ?? g).join(', ')
          : ''
      const mediaLabel =
        mediaOnSite === 'venue_provides'
          ? 'Yes — venue is providing one'
          : mediaOnSite === 'artist_brings'
            ? 'No — artist should bring their own'
            : mediaOnSite === 'not_sure'
              ? 'Not sure yet'
              : ''
      const block = [
        `[Venue logistics ${today}]`,
        loadIn && `Load-in / soundcheck: ${loadIn}`,
        capLabel && `Estimated capacity: ${capLabel}`,
        genreLine && `Crowd vibe / genre: ${genreLine}`,
        settlement && `Settlement: ${settlement}`,
        (name || phone || email) && `Day-of contact: ${[name, phone, email].filter(Boolean).join(' · ')}`,
        parking && `Parking: ${parking}`,
        mediaLabel && `Photographer/videographer: ${mediaLabel}`,
        riderUrl && `Rider / tech link: ${riderUrl}`,
      ].filter(Boolean).join('\n')
      if (dealId && block) await appendDealNote(supabase, dealId, block)
      else if (venueId && block) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      if (venueId) {
        const dtPatch: Record<string, unknown> = {}
        if (venueCapacity) dtPatch.capacity = venueCapacity
        if (genrePreference.length) dtPatch.genre = genrePreference
        if (Object.keys(dtPatch).length) await mergeVenueDealTerms(supabase, venueId, userId, dtPatch)
      }
      if (mediaOnSite === 'artist_brings' && userId) {
        let eventDateStr = ''
        if (dealId) {
          const { data: d } = await supabase.from('deals').select('event_date').eq('id', dealId).maybeSingle()
          eventDateStr = (d as { event_date?: string | null } | null)?.event_date ?? ''
        }
        const dateBit = eventDateStr ? ` on ${eventDateStr}` : ''
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Arrange content capture for ${vName}${dateBit}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    case 'first_outreach': {
      const intent = String(payload.intent ?? '')
      const note = String(payload.note ?? '').trim()
      const alt = String(payload.alternateEmail ?? '').trim()
      const altName = String(payload.alternateContactName ?? '').trim()
      const preferredContactMethod = String(payload.preferredContactMethod ?? '').trim()
      const referralSource = String(payload.referralSource ?? '').trim()
      if (!venueId) break
      let status: string | null = null
      if (intent === 'interested') status = 'in_discussion'
      else if (intent === 'not_now') status = 'archived'
      else if (intent === 'wrong_person') status = 'reached_out'
      const detail = [
        `[First outreach reply ${today}]`,
        `Intent: ${intent}`,
        preferredContactMethod && `Preferred contact: ${contactMethodLabel(preferredContactMethod)}`,
        referralSource && `Source: ${referralSourceLabel(referralSource)}`,
        note && `Note: ${note}`,
        alt && `Alternate contact: ${alt}${altName ? ` (${altName})` : ''}`,
      ].filter(Boolean).join('\n')
      if (status) {
        await supabase
          .from('venues')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', venueId)
          .eq('user_id', userId)
      }
      await supabase.from('outreach_notes').insert({
        user_id: userId,
        venue_id: venueId,
        note: detail,
        category: 'email_capture',
      })
      if (alt && altName) {
        await supabase.from('contacts').insert({
          user_id: userId,
          venue_id: venueId,
          name: altName,
          email: alt,
        })
      }
      break
    }
    case 'follow_up': {
      const status = String(payload.status ?? '')
      const note = String(payload.note ?? '').trim()
      const infoNeeded = String(payload.infoNeeded ?? '').trim()
      const recontactPreference = String(payload.recontactPreference ?? '').trim()
      if (!venueId) break
      let vStatus: string | null = null
      let followPatch: { follow_up_date: string | null; status?: string } | null = null

      if (status === 'interested' || status === 'need_info') {
        vStatus = 'in_discussion'
      } else if (status === 'pass') {
        const rc = recontactPreference || 'no_follow_up'
        if (rc === 'few_months') {
          vStatus = 'post_follow_up'
          followPatch = { follow_up_date: addDaysFromToday(90), status: 'post_follow_up' }
        } else if (rc === 'next_year') {
          vStatus = 'post_follow_up'
          followPatch = { follow_up_date: addDaysFromToday(365), status: 'post_follow_up' }
        } else {
          vStatus = 'archived'
          followPatch = { follow_up_date: null, status: 'archived' }
        }
      }

      const detail = [
        `[Follow-up reply ${today}]`,
        `Status: ${status}`,
        infoNeeded && `Info requested: ${infoNeededLabel(infoNeeded)}`,
        recontactPreference && `Recontact preference: ${recontactPreference}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join('\n')

      if (followPatch) {
        await supabase
          .from('venues')
          .update({
            status: followPatch.status ?? vStatus!,
            follow_up_date: followPatch.follow_up_date,
            updated_at: new Date().toISOString(),
          })
          .eq('id', venueId)
          .eq('user_id', userId)
      } else if (vStatus) {
        await supabase
          .from('venues')
          .update({ status: vStatus, updated_at: new Date().toISOString() })
          .eq('id', venueId)
          .eq('user_id', userId)
      }

      await supabase.from('outreach_notes').insert({
        user_id: userId,
        venue_id: venueId,
        note: detail,
        category: 'email_capture',
      })

      if (status === 'need_info' && infoNeeded === 'pricing' && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Send rate card to ${vName}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    case 'show_cancelled_or_postponed': {
      const resolution = String(payload.resolution ?? '')
      const newDate = String(payload.newEventDate ?? '').trim()
      const note = String(payload.note ?? '').trim()
      const futureInterest = String(payload.futureInterest ?? '').trim()
      const block = [
        `[Show schedule update ${today}]`,
        `Resolution: ${resolution}`,
        newDate && `New date: ${newDate}`,
        futureInterest && `Future interest: ${futureInterest}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join('\n')
      if (dealId && block) {
        await appendDealNote(supabase, dealId, block)
        if (resolution === 'new_date' && newDate) {
          await supabase
            .from('deals')
            .update({ event_date: newDate, updated_at: new Date().toISOString() })
            .eq('id', dealId)
        }
      } else if (venueId) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      if (venueId) {
        let st: string | null = null
        if (futureInterest === 'definitely') st = 'post_follow_up'
        else if (futureInterest === 'probably_not') st = 'archived'
        if (st) {
          await supabase
            .from('venues')
            .update({ status: st, updated_at: new Date().toISOString() })
            .eq('id', venueId)
            .eq('user_id', userId)
        }
      }
      break
    }
    case 'agreement_followup':
    case 'agreement_ready': {
      const stRaw = payload.status != null
        ? String(payload.status)
        : (payload.acknowledged === true ? 'acknowledged' : '')
      const st = stRaw.trim()
      const note = String(payload.note ?? '').trim()
      const docUrl = String(payload.documentUrl ?? '').trim()
      const block = [
        `[${kind === 'agreement_ready' ? 'Agreement ready' : 'Agreement follow-up'} ${today}]`,
        st && `Status: ${st}`,
        docUrl && `Link: ${docUrl}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join('\n')
      if (dealId && block) await appendDealNote(supabase, dealId, block)
      else if (venueId && block) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      break
    }
    case 'booking_confirmation':
    case 'booking_confirmed': {
      const aligned = payload.aligned === true
      const corrections = String(payload.corrections ?? '').trim()
      const paymentStructure = String(payload.paymentStructure ?? '').trim()
      const eventContext = String(payload.eventContext ?? '').trim()
      const block = [
        `[Booking confirmation ${today}]`,
        `Aligned: ${aligned ? 'yes' : 'no'}`,
        paymentStructure && `Payment structure: ${paymentStructureLabel(paymentStructure)}`,
        eventContext && `Event context: ${eventContext}`,
        corrections && `Corrections: ${corrections}`,
      ].filter(Boolean).join('\n')
      if (dealId) {
        await appendDealNote(supabase, dealId, block)
        if (eventContext && venueId) {
          await mergeVenueDealTerms(supabase, venueId, userId, { typical_event_type: eventContext })
        }
      }
      break
    }
    case 'invoice_sent': {
      const received = payload.receivedInAp === true
      const note = String(payload.note ?? '').trim()
      const poRef = String(payload.poReference ?? '').trim()
      const expectedTimeline = String(payload.expectedPaymentTimeline ?? '').trim()
      let due: string | null = null
      if (expectedTimeline === 'within_week') due = addDaysFromToday(7)
      else if (expectedTimeline === 'net_15') due = addDaysFromToday(15)
      else if (expectedTimeline === 'net_30') due = addDaysFromToday(30)
      const block = [
        `[Invoice ${today}]`,
        `Received in AP: ${received ? 'yes' : 'no'}`,
        expectedTimeline && `Expected payment: ${expectedTimeline}`,
        poRef && `PO / reference: ${poRef}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join('\n')
      if (dealId) {
        await appendDealNote(supabase, dealId, block)
        if (due) {
          await supabase
            .from('deals')
            .update({ payment_due_date: due, updated_at: new Date().toISOString() })
            .eq('id', dealId)
        }
      }
      break
    }
    case 'post_show_thanks': {
      const rating = Number(payload.rating)
      const nothing = payload.nothingPending === true
      const detail = String(payload.detail ?? '').trim()
      const comments = String(payload.comments ?? '').trim()
      const wouldRebook = String(payload.wouldRebook ?? '').trim()
      const venueTurnoutAssessment = String(payload.venueTurnoutAssessment ?? '').trim()
      const turnoutLabel: Record<string, string> = {
        packed: 'Packed',
        solid: 'Solid',
        light: 'Light',
        slow: 'Slow night',
      }
      const rebookLabel: Record<string, string> = {
        absolutely: 'Absolutely',
        probably: 'Probably',
        not_likely: 'Not likely',
      }
      const stars = Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`
        : ''
      const block = [
        `[Post-show ${today}]`,
        stars && `Rating: ${stars}`,
        wouldRebook && `Would book again: ${rebookLabel[wouldRebook] ?? wouldRebook}`,
        venueTurnoutAssessment && `Turnout: ${turnoutLabel[venueTurnoutAssessment] ?? venueTurnoutAssessment}`,
        comments && `Team notes: ${comments}`,
        `Nothing pending: ${nothing ? 'yes' : 'no'}`,
        detail && `Open items: ${detail}`,
      ].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
      if (!nothing && detail && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Venue follow-up: ${detail.slice(0, 80)}${detail.length > 80 ? '…' : ''}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      if (wouldRebook === 'absolutely' && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Fast-track rebooking — ${vName}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      if (wouldRebook === 'not_likely' && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Review relationship — venue unlikely to rebook (${vName})`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'high',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    case 'pass_for_now': {
      if (!venueId) break
      await supabase
        .from('venues')
        .update({ status: 'archived', updated_at: new Date().toISOString() })
        .eq('id', venueId)
        .eq('user_id', userId)
      await supabase.from('outreach_notes').insert({
        user_id: userId,
        venue_id: venueId,
        note: `[Pass acknowledged ${today}]`,
        category: 'email_capture',
      })
      break
    }
    case 'rebooking_inquiry': {
      const availability = String(payload.availability ?? '').trim()
      const preferredDays = Array.isArray(payload.preferredDays) ? payload.preferredDays.map(String) : []
      const budgetRange = String(payload.budgetRange ?? '').trim()
      const dayLabel: Record<string, string> = {
        fri: 'Friday',
        sat: 'Saturday',
        sun: 'Sunday',
        weeknight: 'Weeknight',
        flexible: 'Flexible',
      }
      const daysLine =
        preferredDays.length > 0 ? preferredDays.map(d => dayLabel[d] ?? d).join(', ') : ''
      const budgetLine = budgetRange ? budgetRangeLabel(budgetRange) : ''
      const block = [
        `[Rebooking availability ${today}]`,
        daysLine && `Preferred days: ${daysLine}`,
        budgetLine && `Budget range: ${budgetLine}`,
        availability,
      ].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
      else if (venueId) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      if (availability) {
        await supabase.from('booking_requests').insert({
          user_id: userId,
          venue_id: venueId,
          deal_id: dealId,
          capture_token_id: row.id,
          source_kind: 'rebooking_inquiry',
          note: availability,
          budget_note: budgetLine || null,
          raw_payload: payload,
        })
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Rebook follow-up — venue responded`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    case 'payment_reminder_ack': {
      const submitted = payload.submittedPayment === true
      const reference = String(payload.reference ?? '').trim()
      const expectedSendDate = String(payload.expectedSendDate ?? '').trim()
      let payDue: string | null = null
      if (!submitted) {
        if (expectedSendDate === 'this_week') payDue = addDaysFromToday(7)
        else if (expectedSendDate === 'next_week') payDue = addDaysFromToday(14)
      }
      const block = [
        `[Payment reminder reply ${today}]`,
        `Reports payment sent: ${submitted ? 'yes' : 'no'}`,
        !submitted && expectedSendDate && `Expected send: ${expectedSendDate}`,
        reference && `Reference: ${reference}`,
      ].filter(Boolean).join('\n')
      if (dealId) {
        await appendDealNote(supabase, dealId, block)
        if (payDue) {
          await supabase
            .from('deals')
            .update({ payment_due_date: payDue, updated_at: new Date().toISOString() })
            .eq('id', dealId)
        }
      }
      if (submitted && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: reference ? `Verify payment (${reference})` : 'Verify venue payment reported',
          venue_id: venueId,
          deal_id: dealId,
          priority: 'high',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    case 'payment_receipt': {
      const interest = String(payload.rebookInterest ?? '').trim()
      const dates = String(payload.preferredDates ?? '').trim()
      const budget = String(payload.budgetNote ?? '').trim()
      const note = String(payload.note ?? '').trim()
      const workingExperience = String(payload.workingExperience ?? '').trim()
      const referralWillingness = String(payload.referralWillingness ?? '').trim()
      const workLabel: Record<string, string> = {
        great_smooth: 'Great — smooth all around',
        good_hiccups: 'Good — minor hiccups',
        rough: 'Rough — some issues came up',
      }
      const refLabel: Record<string, string> = {
        yes_happy: 'Yes — happy to',
        maybe: 'Maybe',
        rather_not: 'Rather not',
      }
      const block = [
        `[Payment receipt — rebook interest ${today}]`,
        `Interest: ${interest}`,
        workingExperience && `Working experience: ${workLabel[workingExperience] ?? workingExperience}`,
        referralWillingness && `Referral willingness: ${refLabel[referralWillingness] ?? referralWillingness}`,
        dates && `Preferred dates: ${dates}`,
        budget && `Budget note: ${budget}`,
        note && `Note: ${note}`,
      ].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
      else if (venueId && block) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      if (workingExperience === 'rough' && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Review relationship — venue reported issues at ${vName}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'high',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      if (referralWillingness === 'yes_happy' && userId) {
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Follow up on referral willingness — ${vName}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: addDaysFromToday(5),
          recurrence: 'none',
          completed: false,
        })
      }
      if (interest === 'yes' || interest === 'maybe') {
        await supabase.from('booking_requests').insert({
          user_id: userId,
          venue_id: venueId,
          deal_id: dealId,
          capture_token_id: row.id,
          source_kind: 'payment_receipt',
          rebook_interest: interest,
          preferred_dates: dates || null,
          budget_note: budget || null,
          note: note || null,
          raw_payload: payload,
        })
        await supabase.from('tasks').insert({
          user_id: userId,
          title: `Rebook follow-up${dates ? ` — ${dates}` : ''}`,
          venue_id: venueId,
          deal_id: dealId,
          priority: 'medium',
          due_date: today,
          recurrence: 'none',
          completed: false,
        })
      }
      break
    }
    default:
      break
  }
}
