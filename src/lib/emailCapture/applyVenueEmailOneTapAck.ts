import type { SupabaseClient } from '@supabase/supabase-js'
import type { EmailCaptureKind } from './kinds'
import { isVenueEmailOneTapAckKind } from './kinds'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isEmailCaptureTokenUuid(s: string): boolean {
  return UUID_RE.test(s.trim())
}

export type VenueEmailOneTapAckPage =
  | { kind: 'error'; message: string }
  | { kind: 'thanks'; captureKind: EmailCaptureKind; alreadyReceived: boolean }

/** Plain-text lines for minimal HTML thank-you pages (no user accounts). */
export function oneTapAckThanksCopy(
  captureKind: EmailCaptureKind,
  alreadyReceived: boolean,
): { heading: string; lines: string[] } {
  if (alreadyReceived) {
    return {
      heading: 'Thanks',
      lines: ['We already have your confirmation on file.', 'You can close this window.'],
    }
  }
  if (captureKind === 'payment_reminder_ack') {
    return {
      heading: 'Thank you',
      lines: [
        "We've noted that payment may be on the way.",
        "Our team will confirm receipt on our end-you don't need to do anything else here.",
        'You can close this window.',
      ],
    }
  }
  if (captureKind === 'invoice_sent') {
    return {
      heading: 'Thank you',
      lines: [
        "We've recorded that you reviewed the invoice.",
        'You can close this window.',
      ],
    }
  }
  return {
    heading: 'Thank you',
    lines: [
      "We've received your confirmation.",
      'You can close this window.',
    ],
  }
}

/**
 * Public one-tap acknowledgment: consume token (idempotent), create follow-up task (+ optional note).
 * Call only from server (service-role Supabase).
 */
export async function runVenueEmailOneTapAck(
  supabase: SupabaseClient,
  rawToken: string,
): Promise<VenueEmailOneTapAckPage> {
  const token = rawToken.trim()
  if (!isEmailCaptureTokenUuid(token)) {
    return { kind: 'error', message: 'This link is invalid.' }
  }

  const { data: row, error: selErr } = await supabase
    .from('email_capture_tokens')
    .select(
      'id, user_id, kind, venue_id, deal_id, expires_at, consumed_at',
    )
    .eq('token', token)
    .maybeSingle()

  if (selErr || !row) {
    return { kind: 'error', message: 'This link is invalid or no longer active.' }
  }

  const kind = row.kind as string
  if (!isVenueEmailOneTapAckKind(kind)) {
    return { kind: 'error', message: 'This link is not valid for a quick confirmation.' }
  }

  const captureKind = kind as EmailCaptureKind
  const exp = row.expires_at ? new Date(row.expires_at as string).getTime() : 0
  if (!exp || exp < Date.now()) {
    return { kind: 'error', message: 'This link has expired. Please reply to the email instead.' }
  }

  if (row.consumed_at) {
    return { kind: 'thanks', captureKind, alreadyReceived: true }
  }

  const now = new Date().toISOString()
  const response = { source: 'one_tap_ack' as const, acknowledged_at: now }

  const { data: updated, error: updErr } = await supabase
    .from('email_capture_tokens')
    .update({ consumed_at: now, response })
    .eq('token', token)
    .is('consumed_at', null)
    .select('id, user_id, kind, venue_id, deal_id')
    .maybeSingle()

  if (updErr) {
    console.error('[runVenueEmailOneTapAck] update:', updErr.message)
    return { kind: 'error', message: 'Something went wrong. Please try again or reply to the email.' }
  }

  if (!updated) {
    return { kind: 'thanks', captureKind, alreadyReceived: true }
  }

  try {
    await applyOneTapSideEffects(supabase, {
      user_id: updated.user_id as string,
      kind: updated.kind as EmailCaptureKind,
      venue_id: (updated.venue_id as string | null) ?? null,
      deal_id: (updated.deal_id as string | null) ?? null,
      token_id: updated.id as string,
    })
  } catch (e) {
    console.error('[runVenueEmailOneTapAck] side effects:', e)
  }

  return { kind: 'thanks', captureKind, alreadyReceived: false }
}

async function applyOneTapSideEffects(
  supabase: SupabaseClient,
  row: {
    user_id: string
    kind: EmailCaptureKind
    venue_id: string | null
    deal_id: string | null
    token_id: string
  },
) {
  let venueName = 'Venue'
  if (row.venue_id) {
    const { data: v } = await supabase.from('venues').select('name').eq('id', row.venue_id).maybeSingle()
    if (v?.name && String(v.name).trim()) venueName = String(v.name).trim()
  }

  const today = new Date().toISOString().slice(0, 10)
  const { title, notes, priority } = taskForAckKind(row.kind, venueName, row)

  await supabase.from('tasks').insert({
    user_id: row.user_id,
    title,
    notes,
    venue_id: row.venue_id,
    deal_id: row.deal_id,
    priority,
    due_date: today,
    recurrence: 'none',
    completed: false,
  })

  if (row.venue_id) {
    const noteText = outreachNoteForAck(row.kind, venueName)
    await supabase.from('outreach_notes').insert({
      user_id: row.user_id,
      venue_id: row.venue_id,
      note: noteText,
    })
  }
}

function taskForAckKind(
  kind: EmailCaptureKind,
  venueName: string,
  row: { deal_id: string | null; token_id: string },
): { title: string; notes: string; priority: 'low' | 'medium' | 'high' } {
  const dealLine = row.deal_id ? `deal_id: ${row.deal_id}` : 'deal_id: (none)'
  const baseNotes = `Created from venue email one-tap acknowledgment.\nemail_capture_token_id: ${row.token_id}\n${dealLine}\nVerify on your end — venue self-service only.`

  if (kind === 'payment_reminder_ack') {
    return {
      title: `Verify payment — ${venueName}`,
      notes: `${baseNotes}\n\nVenue indicated they may have sent payment — confirm receipt outside this system.`,
      priority: 'high',
    }
  }
  if (kind === 'invoice_sent') {
    return {
      title: `Verify invoice acknowledgment — ${venueName}`,
      notes: `${baseNotes}\n\nVenue confirmed they reviewed the invoice.`,
      priority: 'medium',
    }
  }
  return {
    title: `Verify booking confirmation — ${venueName}`,
    notes: `${baseNotes}\n\nVenue confirmed details via email link.`,
    priority: 'medium',
  }
}

function outreachNoteForAck(kind: EmailCaptureKind, venueName: string): string {
  if (kind === 'payment_reminder_ack') {
    return `[Email] ${venueName} tapped "Payment sent" - verify funds.`
  }
  if (kind === 'invoice_sent') {
    return `[Email] ${venueName} confirmed invoice reviewed.`
  }
  return `[Email] ${venueName} confirmed booking details via link.`
}
