import type { Handler } from '@netlify/functions'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import { buildRetainerReceivedEmailHtml } from '../../src/lib/email/retainerReceivedEmailDocument'
import type { RetainerReceivedSettledRow } from '../../src/lib/email/retainerReceivedEmailDocument'
import { resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { fetchEmailTestModeRow } from './supabaseAdmin'

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
    profile: ArtistProfile
    settledFees: RetainerReceivedSettledRow[]
    totalAcknowledged: number
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
    profile,
    settledFees,
    totalAcknowledged,
    custom_subject,
    custom_intro,
    layout: layoutRaw,
    testOnly = false,
    user_id: rawUserId,
  } = body
  const userId = typeof rawUserId === 'string' ? rawUserId.trim() || undefined : undefined
  const testModeRow = await fetchEmailTestModeRow(userId)
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

  const fees = Array.isArray(settledFees) ? settledFees : []
  const total = typeof totalAcknowledged === 'number' && Number.isFinite(totalAcknowledged)
    ? totalAcknowledged
    : fees.reduce((s, f) => s + (typeof f.paid === 'number' ? f.paid : 0), 0)

  const siteUrl = process.env.URL || ''
  const docProfile = {
    artist_name: profile.artist_name,
    manager_name: profile.manager_name,
    manager_title: profile.manager_title ?? null,
    social_handle: profile.social_handle,
    website: profile.website,
    phone: profile.phone,
  }

  const demoRow: RetainerReceivedSettledRow = { month: 'January 2026 (sample)', invoiced: 350, paid: 350 }
  const feesForHtml = testOnly && fees.length === 0 ? [demoRow] : fees
  const totalForHtml = testOnly && fees.length === 0 ? demoRow.paid : total

  const html = buildRetainerReceivedEmailHtml(docProfile, feesForHtml, totalForHtml, L, siteUrl)

  const firstName = profile.artist_name.split(/\s+/)[0] || 'there'
  const defaultSubjectBase = `${firstName}, retainer received — thank you`
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
    body: JSON.stringify({ message: 'Retainer received email sent successfully' }),
  }
}

export { handler }
