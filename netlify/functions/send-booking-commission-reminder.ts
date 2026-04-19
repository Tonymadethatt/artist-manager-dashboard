import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import {
  buildBookingCommissionReminderEmailHtml,
  PREVIEW_BOOKING_COMMISSION_LINE_ITEMS,
  type BookingCommissionLineItem,
} from '../../src/lib/email/bookingCommissionReminderEmailDocument'
import { dedupeCcAgainstTo, resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { parseResendMessageIdFromResendApiJson } from '../../src/lib/email/resendMessageId'
import { fetchEmailTestModeRowForSend, logResendOutboundSendForUsage } from './supabaseAdmin'

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
    lineItems?: BookingCommissionLineItem[]
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
    lineItems: rawItems,
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
  const lineItems =
    Array.isArray(rawItems) && rawItems.length > 0
      ? rawItems
      : testOnly
        ? PREVIEW_BOOKING_COMMISSION_LINE_ITEMS
        : []

  if (!testOnly && lineItems.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ message: 'lineItems required for live send' }) }
  }

  const html = buildBookingCommissionReminderEmailHtml({
    artistName: profile.artist_name,
    footer: {
      logoBaseUrl: siteUrl,
      managerName: profile.manager_name || 'Management',
      managerTitle: profile.manager_title ?? null,
      website: profile.website,
      social_handle: profile.social_handle,
      phone: profile.phone,
    },
    lineItems,
    customSubject: custom_subject ?? null,
    customIntro: custom_intro ?? null,
    layout: layoutRaw as EmailTemplateLayoutV1 | null,
  })

  const firstName = profile.artist_name.split(/\s+/)[0] || profile.artist_name
  const defaultSubjectBase = `Hey ${firstName}, quick booking commission note`
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
  cc = dedupeCcAgainstTo(resolved.to, resolved.cc)
  const subjectOut = resolved.subject
  const replyTo = profile.reply_to_email || profile.from_email

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
      reply_to: [replyTo],
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

  const resendPayload = await resendRes.json().catch(() => null)
  const resendMessageId = parseResendMessageIdFromResendApiJson(resendPayload)
  await logResendOutboundSendForUsage({ userId, resendMessageId, source: 'send_booking_commission_reminder' })

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Booking commission reminder sent successfully',
      ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
    }),
  }
}

export { handler }
