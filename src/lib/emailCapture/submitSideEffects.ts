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

function appendDealNote(supabase: SupabaseClient, dealId: string, block: string): Promise<void> {
  return (async () => {
    const { data: deal } = await supabase.from('deals').select('notes').eq('id', dealId).single()
    const prev = deal?.notes?.trim() ?? ''
    const next = prev ? `${prev}\n\n${block}` : block
    await supabase.from('deals').update({ notes: next, updated_at: new Date().toISOString() }).eq('id', dealId)
  })()
}

/** Run after successful submit (idempotent safe if called once). */
export async function applyEmailCaptureSideEffects(
  supabase: SupabaseClient,
  row: EmailCaptureTokenRow,
  payload: Record<string, unknown>,
): Promise<void> {
  const { kind, user_id: userId, venue_id: venueId, deal_id: dealId } = row
  const today = todayIsoDate()

  switch (kind) {
    case 'pre_event_checkin': {
      const loadIn = String(payload.loadInOrSoundcheck ?? '').trim()
      const settlement = String(payload.settlementMethod ?? '').trim()
      const name = String(payload.dayOfContactName ?? '').trim()
      const phone = String(payload.dayOfContactPhone ?? '').trim()
      const email = String(payload.dayOfContactEmail ?? '').trim()
      const parking = String(payload.parkingNotes ?? '').trim()
      const riderUrl = String(payload.riderOrTechUrl ?? '').trim()
      const block = [
        `[Venue logistics ${today}]`,
        loadIn && `Load-in / soundcheck: ${loadIn}`,
        settlement && `Settlement: ${settlement}`,
        (name || phone || email) && `Day-of contact: ${[name, phone, email].filter(Boolean).join(' · ')}`,
        parking && `Parking: ${parking}`,
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
      break
    }
    case 'first_outreach': {
      const intent = String(payload.intent ?? '')
      const note = String(payload.note ?? '').trim()
      const alt = String(payload.alternateEmail ?? '').trim()
      if (!venueId) break
      let status: string | null = null
      if (intent === 'interested') status = 'in_discussion'
      else if (intent === 'not_now') status = 'archived'
      else if (intent === 'wrong_person') status = 'reached_out'
      const detail = [
        `[First outreach reply ${today}]`,
        `Intent: ${intent}`,
        note && `Note: ${note}`,
        alt && `Alternate contact: ${alt}`,
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
      break
    }
    case 'follow_up': {
      const status = String(payload.status ?? '')
      const note = String(payload.note ?? '').trim()
      if (!venueId) break
      let vStatus: string | null = null
      if (status === 'interested' || status === 'need_info') vStatus = 'in_discussion'
      else if (status === 'pass') vStatus = 'closed_lost'
      const detail = [`[Follow-up reply ${today}]`, `Status: ${status}`, note && `Note: ${note}`].filter(Boolean).join('\n')
      if (vStatus) {
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
      break
    }
    case 'show_cancelled_or_postponed': {
      const resolution = String(payload.resolution ?? '')
      const newDate = String(payload.newEventDate ?? '').trim()
      const note = String(payload.note ?? '').trim()
      const block = [
        `[Show schedule update ${today}]`,
        `Resolution: ${resolution}`,
        newDate && `New date: ${newDate}`,
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
      const block = [
        `[Booking confirmation ${today}]`,
        `Aligned: ${aligned ? 'yes' : 'no'}`,
        corrections && `Corrections: ${corrections}`,
      ].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
      break
    }
    case 'invoice_sent': {
      const received = payload.receivedInAp === true
      const note = String(payload.note ?? '').trim()
      const block = [`[Invoice ${today}]`, `Received in AP: ${received ? 'yes' : 'no'}`, note && `Note: ${note}`].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
      break
    }
    case 'post_show_thanks': {
      const rating = Number(payload.rating)
      const nothing = payload.nothingPending === true
      const detail = String(payload.detail ?? '').trim()
      const comments = String(payload.comments ?? '').trim()
      const stars = Number.isInteger(rating) && rating >= 1 && rating <= 5
        ? `${'★'.repeat(rating)}${'☆'.repeat(5 - rating)} (${rating}/5)`
        : ''
      const block = [
        `[Post-show ${today}]`,
        stars && `Rating: ${stars}`,
        comments && `Comments: ${comments}`,
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
      const block = `[Rebooking availability ${today}]\n${availability}`
      if (dealId) await appendDealNote(supabase, dealId, block)
      else if (venueId) {
        await supabase.from('outreach_notes').insert({
          user_id: userId,
          venue_id: venueId,
          note: block,
          category: 'email_capture',
        })
      }
      // Create booking request record
      if (availability) {
        await supabase.from('booking_requests').insert({
          user_id: userId,
          venue_id: venueId,
          deal_id: dealId,
          capture_token_id: row.id,
          source_kind: 'rebooking_inquiry',
          note: availability,
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
      const block = [`[Payment reminder reply ${today}]`, `Reports payment sent: ${submitted ? 'yes' : 'no'}`, reference && `Reference: ${reference}`].filter(Boolean).join('\n')
      if (dealId) await appendDealNote(supabase, dealId, block)
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
      const block = [
        `[Payment receipt — rebook interest ${today}]`,
        `Interest: ${interest}`,
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
      // Create booking request record for rebook interest
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
        // Auto-task: follow up on rebook
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
