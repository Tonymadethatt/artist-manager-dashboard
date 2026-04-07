import type { Handler } from '@netlify/functions'
import { sanitizeEmailAttachmentPayload } from '../../src/lib/email/validateAttachmentUrl'
import { buildCustomEmailDocument } from '../../src/lib/email/renderCustomEmail'

interface ArtistProfile {
  artist_name: string
  company_name: string | null
  from_email: string
  reply_to_email: string | null
  website: string | null
  phone: string | null
  social_handle: string | null
  tagline: string | null
}

interface DealData {
  description: string
  gross_amount: number
  event_date: string | null
  payment_due_date: string | null
  agreement_url: string | null
  notes: string | null
}

interface VenueData {
  name: string
  city: string | null
  location: string | null
}

interface Recipient {
  name: string
  email: string
}

interface RequestBody {
  custom_artist_template: {
    subject_template: string
    blocks: unknown
  }
  attachment?: unknown
  profile: ArtistProfile
  recipient: Recipient
  deal?: DealData
  venue?: VenueData
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: RequestBody
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const { custom_artist_template, profile, recipient, deal, venue, attachment: rawAttachment } = body
  if (!custom_artist_template || !profile?.from_email || !recipient?.email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields' }) }
  }

  const siteUrl = process.env.URL || ''
  const supabaseUrl = process.env.SUPABASE_URL || ''
  const attachment = sanitizeEmailAttachmentPayload(rawAttachment, { supabaseUrl, siteUrl })
  const { html, subject } = buildCustomEmailDocument({
    audience: 'artist',
    subjectTemplate: custom_artist_template.subject_template,
    blocksRaw: custom_artist_template.blocks,
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
      statusCode: resendRes.status,
      body: JSON.stringify({ message: (err as { message?: string }).message ?? 'Resend API error' }),
    }
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Email sent successfully', subject }),
  }
}

export { handler }
