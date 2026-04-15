import type { Handler } from '@netlify/functions'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import {
  artistTransactionalGreetingFirstName,
  buildArtistTransactionalEmailHtml,
  type ArtistTransactionalKind,
} from '../../src/lib/email/artistTransactionalEmailDocument'
import { resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { fetchEmailTestModeRowForSend } from './supabaseAdmin'

interface ArtistProfile {
  artist_name: string
  artist_email: string
  manager_name: string | null
  manager_title?: string | null
  manager_email: string | null
  from_email: string
  company_name: string | null
  website: string | null
  social_handle: string | null
  phone: string | null
  reply_to_email: string | null
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: {
    kind: ArtistTransactionalKind
    profile: ArtistProfile
    venueName: string
    eventDate?: string | null
    custom_subject?: string | null
    custom_intro?: string | null
    layout?: unknown | null
    testOnly?: boolean
    user_id?: string
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const {
    kind,
    profile,
    venueName,
    eventDate = null,
    custom_subject,
    custom_intro,
    layout: layoutRaw,
    testOnly = false,
    user_id: rawUserId,
  } = body

  const userId = typeof rawUserId === 'string' ? rawUserId.trim() || undefined : undefined
  const testModeFetch = await fetchEmailTestModeRowForSend(userId, testOnly)
  if (!testModeFetch.ok) {
    return { statusCode: testModeFetch.statusCode, body: JSON.stringify({ message: testModeFetch.message }) }
  }
  const testModeRow = testModeFetch.row

  if (kind !== 'performance_report_received') {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid kind' }) }
  }

  const L = artistLayoutForSend(layoutRaw, custom_subject, custom_intro)
  if (!profile?.from_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }
  if (testOnly) {
    if (!profile.manager_email) {
      return { statusCode: 400, body: JSON.stringify({ message: 'manager_email not set. Add it in Settings.' }) }
    }
  } else if (!profile?.artist_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }

  const siteUrl = process.env.URL || ''
  const managerName = profile.manager_name?.trim() || 'Management'
  const html = buildArtistTransactionalEmailHtml(
    kind,
    {
      artistName: profile.artist_name ?? '',
      venueName: venueName || 'venue',
      eventDate: eventDate ?? null,
      managerName,
      managerTitle: profile.manager_title ?? null,
      website: profile.website ?? null,
      social_handle: profile.social_handle ?? null,
      phone: profile.phone ?? null,
    },
    L,
    siteUrl,
  )

  const firstName = artistTransactionalGreetingFirstName(profile.artist_name ?? '') || 'there'
  const defaultSubjects: Record<ArtistTransactionalKind, string> = {
    performance_report_received: `${firstName}, we received your show check-in`,
  }
  const defaultSubjectBase = defaultSubjects[kind]
  const defaultSubject = testOnly ? `[TEST] ${defaultSubjectBase}` : defaultSubjectBase
  const subject = L.subject?.trim() || defaultSubject

  let to = testOnly ? [profile.manager_email!] : [profile.artist_email]
  let cc = testOnly ? [] : (profile.manager_email ? [profile.manager_email] : [])
  const resolved = resolveArtistFacingResend({
    row: testModeRow,
    testOnly,
    to,
    cc,
    subject,
  })
  if (!resolved.ok) {
    return { statusCode: 400, body: JSON.stringify({ message: resolved.message }) }
  }
  to = resolved.to
  cc = resolved.cc
  const subjectOut = resolved.subject

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: profile.from_email,
      to,
      ...(cc.length > 0 ? { cc } : {}),
      subject: subjectOut,
      html,
    }),
  })

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}))
    return {
      statusCode: resendRes.status,
      body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend API error' }),
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Artist transactional email sent successfully' }),
  }
}

export { handler }
