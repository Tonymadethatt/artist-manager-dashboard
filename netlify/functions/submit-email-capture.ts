import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { isEmailCaptureKind, type EmailCaptureKind } from '../../src/lib/emailCapture/kinds'
import { applyEmailCaptureSideEffects } from '../../src/lib/emailCapture/submitSideEffects'

type Body = { token?: string; payload?: Record<string, unknown> }

function bad(msg: string, code = 400) {
  return {
    statusCode: code,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: false, message: msg }),
  }
}

function validatePayload(kind: EmailCaptureKind, payload: Record<string, unknown>): string | null {
  switch (kind) {
    case 'pre_event_checkin': {
      if (!String(payload.loadInOrSoundcheck ?? '').trim() && !String(payload.settlementMethod ?? '').trim()) {
        return 'Add load-in or settlement details'
      }
      return null
    }
    case 'first_outreach': {
      const i = String(payload.intent ?? '')
      if (!['interested', 'not_now', 'wrong_person'].includes(i)) return 'Choose a response'
      const pcm = String(payload.preferredContactMethod ?? '')
      if (!['email', 'phone_text', 'either'].includes(pcm)) return 'Choose how to best reach you'
      return null
    }
    case 'follow_up': {
      const s = String(payload.status ?? '')
      if (!['interested', 'need_info', 'pass'].includes(s)) return 'Choose a status'
      if (s === 'need_info') {
        const inf = String(payload.infoNeeded ?? '')
        if (!['pricing', 'song_demo', 'availability_dates', 'references', 'something_else'].includes(inf)) {
          return 'Select what info would help'
        }
      }
      if (s === 'pass') {
        const rc = String(payload.recontactPreference ?? '')
        if (!['few_months', 'next_year', 'no_follow_up'].includes(rc)) return 'Choose whether to check back later'
      }
      return null
    }
    case 'show_cancelled_or_postponed': {
      const r = String(payload.resolution ?? '')
      if (!['new_date', 'refund', 'release', 'other'].includes(r)) return 'Choose a resolution'
      const fi = String(payload.futureInterest ?? '')
      if (!['definitely', 'maybe', 'probably_not'].includes(fi)) return 'Select whether you might work together again'
      return null
    }
    case 'agreement_followup': {
      const s = String(payload.status ?? '')
      if (!['signed', 'in_review', 'needs_changes'].includes(s)) return 'Choose agreement status'
      return null
    }
    case 'agreement_ready': {
      if (payload.acknowledged !== true) return 'Confirm you have reviewed'
      return null
    }
    case 'booking_confirmation':
    case 'booking_confirmed': {
      if (payload.aligned !== true && payload.aligned !== false) return 'Confirm whether details are correct'
      const ps = String(payload.paymentStructure ?? '')
      if (!['full_after_show', 'deposit_balance', 'venue_advances', 'separate'].includes(ps)) {
        return 'Select how payment is structured'
      }
      return null
    }
    case 'invoice_sent': {
      if (payload.receivedInAp !== true && payload.receivedInAp !== false) return 'Select AP status'
      if (payload.receivedInAp === false) {
        const t = String(payload.expectedPaymentTimeline ?? '')
        if (!['within_week', 'net_15', 'net_30', 'not_sure'].includes(t)) {
          return 'Select when you expect payment to go out'
        }
      }
      return null
    }
    case 'post_show_thanks': {
      const r = Number(payload.rating)
      if (!Number.isInteger(r) || r < 1 || r > 5) return 'Select a star rating'
      const wr = String(payload.wouldRebook ?? '')
      if (!['absolutely', 'probably', 'not_likely'].includes(wr)) return 'Select whether you would book this artist again'
      const tu = String(payload.venueTurnoutAssessment ?? '')
      if (!['packed', 'solid', 'light', 'slow'].includes(tu)) return 'Select how turnout was'
      if (payload.nothingPending !== true && payload.nothingPending !== false) return 'Select whether anything is pending'
      if (payload.nothingPending === false && !String(payload.detail ?? '').trim()) return 'Describe what is pending'
      return null
    }
    case 'rebooking_inquiry': {
      if (!String(payload.availability ?? '').trim()) return 'Add availability notes'
      return null
    }
    case 'payment_reminder_ack': {
      if (payload.submittedPayment !== true && payload.submittedPayment !== false) return 'Select payment status'
      if (payload.submittedPayment === false) {
        const e = String(payload.expectedSendDate ?? '')
        if (!['this_week', 'next_week', 'waiting_approval', 'not_sure'].includes(e)) {
          return 'Select when payment is expected to go out'
        }
      }
      return null
    }
    case 'payment_receipt': {
      const i = String(payload.rebookInterest ?? '')
      if (!['yes', 'maybe', 'no'].includes(i)) return 'Select rebooking interest'
      const we = String(payload.workingExperience ?? '')
      if (!['great_smooth', 'good_hiccups', 'rough'].includes(we)) {
        return 'Select how the overall experience was'
      }
      return null
    }
    case 'pass_for_now':
      return null
    default:
      return 'Unsupported'
  }
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return bad('Method not allowed', 405)
  }

  const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return bad('Server configuration error', 500)
  }

  let body: Body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return bad('Invalid JSON')
  }

  const token = typeof body.token === 'string' ? body.token.trim() : ''
  if (!token) return bad('Missing token')

  const payload = body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload)
    ? body.payload
    : {}

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const { data: row, error: lookupError } = await supabase
    .from('email_capture_tokens')
    .select('id, user_id, kind, venue_id, deal_id, contact_id, consumed_at, expires_at')
    .eq('token', token)
    .single()

  if (lookupError || !row || !isEmailCaptureKind(row.kind as string)) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    }
  }

  if (row.consumed_at) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true, alreadySubmitted: true }),
    }
  }

  const exp = new Date(row.expires_at as string).getTime()
  if (Number.isFinite(exp) && exp < Date.now()) {
    return bad('Link expired', 410)
  }

  const kind = row.kind as EmailCaptureKind
  const err = validatePayload(kind, payload)
  if (err) return bad(err)

  const { error: updateError } = await supabase
    .from('email_capture_tokens')
    .update({
      consumed_at: new Date().toISOString(),
      response: payload,
    })
    .eq('id', row.id)
    .is('consumed_at', null)

  if (updateError) {
    return bad('Could not save response', 500)
  }

  try {
    await applyEmailCaptureSideEffects(supabase, {
      id: row.id as string,
      user_id: row.user_id as string,
      kind,
      venue_id: (row.venue_id as string | null) ?? null,
      deal_id: (row.deal_id as string | null) ?? null,
      contact_id: (row.contact_id as string | null) ?? null,
    }, payload)
  } catch (e) {
    console.error('[submit-email-capture] side effects:', e)
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true }),
  }
}

export { handler }
