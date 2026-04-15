/**
 * Email test mode — shared by Netlify send functions.
 * When `email_test_mode` is true, Resend `to` / `cc` are replaced using Settings inboxes.
 */

export type EmailTestModeRow = {
  email_test_mode: boolean
  email_test_artist_inbox: string | null
  email_test_client_inbox: string | null
}

export function normalizeTestInbox(s: string | null | undefined): string | null {
  const t = (s ?? '').trim()
  if (!t.includes('@')) return null
  return t
}

const TEST_SUBJ_PREFIX = '[TEST] '

export function applyTestSubjectPrefix(subject: string): string {
  const s = subject.trim()
  if (s.startsWith(TEST_SUBJ_PREFIX) || s.startsWith('[TEST]')) return subject
  return `${TEST_SUBJ_PREFIX}${subject}`
}

export type ResolvedResend =
  | { ok: true; to: string[]; cc: string[]; subject: string }
  | { ok: false; message: string }

/** Artist-facing: reports, reminders, retainers, transactional, gig calendar, performance form */
export function resolveArtistFacingResend(args: {
  row: EmailTestModeRow | null | undefined
  testOnly: boolean | undefined
  to: string[]
  cc: string[]
  subject: string
}): ResolvedResend {
  const { row, testOnly } = args
  const { to, cc, subject } = args
  if (testOnly) return { ok: true, to: [...to], cc: [...cc], subject }
  if (!row?.email_test_mode) return { ok: true, to: [...to], cc: [...cc], subject }
  const inbox = normalizeTestInbox(row.email_test_artist_inbox)
  if (!inbox) {
    return {
      ok: false,
      message: 'Email test mode is on but the artist test inbox is empty. Add it in Settings.',
    }
  }
  return {
    ok: true,
    to: [inbox],
    cc: [],
    subject: applyTestSubjectPrefix(subject),
  }
}

/** Venue / contact-facing: standard venue emails */
export function resolveVenueFacingResend(args: {
  row: EmailTestModeRow | null | undefined
  to: string[]
  cc: string[]
  subject: string
}): ResolvedResend {
  const { row } = args
  const { to, cc, subject } = args
  if (!row?.email_test_mode) return { ok: true, to: [...to], cc: [...cc], subject }
  const inbox = normalizeTestInbox(row.email_test_client_inbox)
  if (!inbox) {
    return {
      ok: false,
      message: 'Email test mode is on but the client test inbox is empty. Add it in Settings.',
    }
  }
  return {
    ok: true,
    to: [inbox],
    cc: [],
    subject: applyTestSubjectPrefix(subject),
  }
}
