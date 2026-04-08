import type { Handler } from '@netlify/functions'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import {
  buildArtistTransactionalEmailHtml,
  type ArtistTransactionalKind,
} from '../../src/lib/email/artistTransactionalEmailDocument'

interface ArtistProfile {
  artist_name: string
  artist_email: string
  manager_name: string | null
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
  } = body

  if (kind !== 'performance_report_received' && kind !== 'gig_week_reminder') {
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
    },
    L,
    siteUrl,
  )

  const firstName = profile.artist_name.split(/\s+/)[0] || 'there'
  const defaultSubjects: Record<ArtistTransactionalKind, string> = {
    performance_report_received: `${firstName}, we received your show check-in`,
    gig_week_reminder: `${firstName}, gig week — ${venueName || 'upcoming show'}`,
  }
  const defaultSubjectBase = defaultSubjects[kind]
  const defaultSubject = testOnly ? `[TEST] ${defaultSubjectBase}` : defaultSubjectBase
  const subject = L.subject?.trim() || defaultSubject

  const to = testOnly ? [profile.manager_email!] : [profile.artist_email]
  const cc = testOnly ? [] : (profile.manager_email ? [profile.manager_email] : [])

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
      subject,
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
