import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { sharedStyles } from '../../src/lib/email/artistEmailSharedStyles'
import {
  buildBrandOutreachDigestDocumentHtml,
  makeLayoutForBrandDigest,
} from '../../src/lib/email/brandOutreachDigestEmailDocument'
import {
  fetchFirstOutreachLeadTemplateIds,
  loadBrandOutreachDigestData,
} from '../../src/lib/email/brandOutreachDigestData'
import { dedupeCcAgainstTo, resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { parseResendMessageIdFromResendApiJson } from '../../src/lib/email/resendMessageId'
import { fetchEmailTestModeRowForSend, getServiceSupabase, logResendOutboundSendForUsage } from './supabaseAdmin'

interface SendBodyProfile {
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

function profileFromRow(p: Record<string, unknown>): SendBodyProfile {
  return {
    artist_name: String(p.artist_name ?? ''),
    artist_email: String(p.artist_email ?? ''),
    manager_name: (p.manager_name as string | null) ?? null,
    manager_title: (p.manager_title as string | null) ?? null,
    manager_email: (p.manager_email as string | null) ?? null,
    from_email: String(p.from_email ?? ''),
    company_name: (p.company_name as string | null) ?? null,
    website: (p.website as string | null) ?? null,
    social_handle: (p.social_handle as string | null) ?? null,
    phone: (p.phone as string | null) ?? null,
    reply_to_email: (p.reply_to_email as string | null) ?? null,
  }
}

const handler: Handler = async event => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: {
    user_id?: string
    testOnly?: boolean
    custom_subject?: string | null
    custom_intro?: string | null
    layout?: unknown | null
    profile?: SendBodyProfile
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing user_id' }) }
  }

  const testModeFetch = await fetchEmailTestModeRowForSend(userId, body.testOnly === true)
  if (!testModeFetch.ok) {
    return { statusCode: testModeFetch.statusCode, body: JSON.stringify({ message: testModeFetch.message }) }
  }
  const testModeRow = testModeFetch.row

  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      statusCode: 503,
      body: JSON.stringify({ message: 'Email send is unavailable: database not configured on server.' }),
    }
  }

  let profile = body.profile
  if (!profile?.from_email?.trim()) {
    const { data: row, error: pErr } = await supabase.from('artist_profile').select('*').eq('user_id', userId).maybeSingle()
    if (pErr || !row) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Could not load artist profile.' }) }
    }
    profile = profileFromRow(row as unknown as Record<string, unknown>)
  }
  if (!profile.from_email?.trim()) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing from_email on profile' }) }
  }
  if (body.testOnly === true) {
    if (!profile.manager_email?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ message: 'manager_email not set. Add it in Settings.' }) }
    }
  } else {
    if (!profile.artist_email?.trim()) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Missing artist_email on profile' }) }
    }
  }

  const templateIds = await fetchFirstOutreachLeadTemplateIds(supabase, userId)
  const data = await loadBrandOutreachDigestData(supabase, userId, templateIds)
  if (!data.hasData) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message:
          'No First Outreach history yet. Send the First Outreach lead template at least once, then try again. (Sends that only go through the Email Queue are not in this list until they are logged — see product note.)',
      }),
    }
  }

  const { data: brandTmpl } = await supabase
    .from('email_templates')
    .select('layout, custom_subject, custom_intro')
    .eq('user_id', userId)
    .eq('email_type', 'brand_outreach_digest')
    .maybeSingle()

  const layoutFromBody = body.layout as EmailTemplateLayoutV1 | null | undefined
  const layoutRaw =
    (layoutFromBody !== undefined && layoutFromBody !== null
      ? layoutFromBody
      : (brandTmpl?.layout as EmailTemplateLayoutV1 | null)) ?? null
  const customSubject =
    body.custom_subject !== undefined ? body.custom_subject : brandTmpl?.custom_subject ?? null
  const customIntro = body.custom_intro !== undefined ? body.custom_intro : brandTmpl?.custom_intro ?? null
  const L = makeLayoutForBrandDigest(layoutRaw, customSubject, customIntro)
  const siteUrl = process.env.URL || ''
  const footer = {
    logoBaseUrl: siteUrl,
    managerName: profile.manager_name?.trim() || 'Management',
    managerTitle: profile.manager_title ?? null,
    website: profile.website ?? null,
    social_handle: profile.social_handle ?? null,
    phone: profile.phone ?? null,
  }

  const { html, defaultSubject } = buildBrandOutreachDigestDocumentHtml(
    L,
    data,
    profile.artist_name,
    siteUrl,
    sharedStyles,
    footer,
    false,
  )
  const subject = L.subject?.trim() || defaultSubject
  const testOnly = body.testOnly === true
  const defaultTestSubject = subject.startsWith('[TEST]') ? subject : `[TEST] ${subject}`

  let to: string[] = testOnly ? [profile.manager_email!] : [profile.artist_email]
  let ccOut: string[] = testOnly ? [] : []
  const resolved = resolveArtistFacingResend({
    row: testModeRow,
    testOnly,
    to,
    cc: ccOut,
    subject: testOnly ? defaultTestSubject : subject,
  })
  if (!resolved.ok) {
    return { statusCode: 400, body: JSON.stringify({ message: resolved.message }) }
  }
  to = resolved.to
  ccOut = dedupeCcAgainstTo(resolved.to, resolved.cc)
  const subjectOut = resolved.subject

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: profile.from_email,
      to,
      ...(ccOut.length > 0 ? { cc: ccOut } : {}),
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
  await logResendOutboundSendForUsage({ userId, resendMessageId, source: 'send_brand_outreach_digest' })
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'OK', ...(resendMessageId ? { resend_message_id: resendMessageId } : {}) }),
  }
}

export { handler }
