import type { Handler } from '@netlify/functions'
import { sanitizeEmailAttachmentPayload } from '../../src/lib/email/validateAttachmentUrl'
import { buildCustomEmailDocument } from '../../src/lib/email/renderCustomEmail'
import type { VenueRenderDeal, VenueRenderProfile, VenueRenderRecipient, VenueRenderVenue } from '../../src/lib/email/renderVenueEmail'

function normalizeProfile(raw: unknown): VenueRenderProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const p = raw as Record<string, unknown>
  const from = typeof p.from_email === 'string' ? p.from_email.trim() : ''
  if (!from) return null
  return {
    artist_name: typeof p.artist_name === 'string' ? p.artist_name : String(p.artist_name ?? ''),
    company_name: typeof p.company_name === 'string' ? p.company_name : p.company_name == null ? null : String(p.company_name),
    from_email: from,
    reply_to_email:
      typeof p.reply_to_email === 'string'
        ? p.reply_to_email
        : p.reply_to_email == null
          ? null
          : String(p.reply_to_email),
    website: typeof p.website === 'string' ? p.website : p.website == null ? null : String(p.website),
    phone: typeof p.phone === 'string' ? p.phone : p.phone == null ? null : String(p.phone),
    social_handle:
      typeof p.social_handle === 'string' ? p.social_handle : p.social_handle == null ? null : String(p.social_handle),
    tagline: typeof p.tagline === 'string' ? p.tagline : p.tagline == null ? null : String(p.tagline),
  }
}

function normalizeRecipient(raw: unknown): VenueRenderRecipient | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const email = typeof r.email === 'string' ? r.email.trim() : ''
  if (!email) return null
  const nameRaw = typeof r.name === 'string' ? r.name : r.name == null ? '' : String(r.name)
  const name = nameRaw.trim() || email.split('@')[0] || 'Artist'
  return { name, email }
}

function normalizeDeal(raw: unknown): VenueRenderDeal | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const d = raw as Record<string, unknown>
  const gross =
    typeof d.gross_amount === 'number' && Number.isFinite(d.gross_amount)
      ? d.gross_amount
      : Number(d.gross_amount)
  return {
    description: typeof d.description === 'string' ? d.description : String(d.description ?? ''),
    gross_amount: Number.isFinite(gross) ? gross : 0,
    event_date: typeof d.event_date === 'string' ? d.event_date : d.event_date == null ? null : String(d.event_date),
    payment_due_date:
      typeof d.payment_due_date === 'string'
        ? d.payment_due_date
        : d.payment_due_date == null
          ? null
          : String(d.payment_due_date),
    agreement_url:
      typeof d.agreement_url === 'string' ? d.agreement_url : d.agreement_url == null ? null : String(d.agreement_url),
    notes: typeof d.notes === 'string' ? d.notes : d.notes == null ? null : String(d.notes),
  }
}

function normalizeVenue(raw: unknown): VenueRenderVenue | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const v = raw as Record<string, unknown>
  return {
    name: typeof v.name === 'string' ? v.name : String(v.name ?? ''),
    city: typeof v.city === 'string' ? v.city : v.city == null ? null : String(v.city),
    location: typeof v.location === 'string' ? v.location : v.location == null ? null : String(v.location),
  }
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: Record<string, unknown>
  try {
    body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const rawTemplate = body.custom_artist_template
  if (!rawTemplate || typeof rawTemplate !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing custom_artist_template' }) }
  }
  const tpl = rawTemplate as Record<string, unknown>
  const subjectTemplate = typeof tpl.subject_template === 'string' ? tpl.subject_template : String(tpl.subject_template ?? '')

  const profile = normalizeProfile(body.profile)
  const recipient = normalizeRecipient(body.recipient)
  if (!profile || !recipient) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) }
  }

  const siteUrl = process.env.URL || ''
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const attachment = sanitizeEmailAttachmentPayload(body.attachment, { supabaseUrl, siteUrl })
  const deal = normalizeDeal(body.deal)
  const venue = normalizeVenue(body.venue)

  try {
    const { html, subject } = buildCustomEmailDocument({
      audience: 'artist',
      subjectTemplate,
      blocksRaw: tpl.blocks,
      profile,
      recipient,
      deal,
      venue,
      logoBaseUrl: siteUrl,
      responsiveClasses: true,
      ...(attachment ? { attachment } : {}),
    })

    const replyTo = profile.reply_to_email || profile.from_email

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: profile.from_email,
        to: [recipient.email],
        reply_to: [replyTo],
        subject,
        html,
      }),
    })

    if (!resendRes.ok) {
      const err = await resendRes.json().catch(() => ({}))
      return {
        statusCode: resendRes.status >= 400 && resendRes.status < 600 ? resendRes.status : 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend API error' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Email sent successfully', subject }),
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Email render or send failed'
    console.error('[send-custom-artist-email]', e)
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    }
  }
}

export { handler }
