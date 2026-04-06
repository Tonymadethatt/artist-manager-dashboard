import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { normalizeEmailTemplateLayout } from '../../src/lib/emailLayout'
import { buildVenueEmailDocument } from '../../src/lib/email/renderVenueEmail'

type VenueEmailType =
  | 'booking_confirmation'
  | 'payment_receipt'
  | 'payment_reminder'
  | 'agreement_ready'
  | 'booking_confirmed'
  | 'follow_up'
  | 'rebooking_inquiry'

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
  type: VenueEmailType
  profile: ArtistProfile
  recipient: Recipient
  deal?: DealData
  venue?: VenueData
  custom_subject?: string | null
  custom_intro?: string | null
  layout?: EmailTemplateLayoutV1 | null
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

  const { type, profile, recipient, deal, venue, custom_subject, custom_intro, layout: rawLayout } = body
  if (!type || !profile?.from_email || !recipient?.email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing required fields: type, profile.from_email, recipient.email' }) }
  }

  const layout = normalizeEmailTemplateLayout(rawLayout)
  const siteUrl = process.env.URL || ''
  const html = buildVenueEmailDocument({
    type,
    profile,
    recipient,
    deal,
    venue,
    custom_intro,
    custom_subject,
    layout,
    logoBaseUrl: siteUrl,
    responsiveClasses: true,
  })
  const artistNameUpper = profile.artist_name.toUpperCase()
  const replyTo = profile.reply_to_email || profile.from_email
  const venueName = venue?.name || deal?.description || 'your venue'

  const subjectMap: Record<VenueEmailType, string> = {
    booking_confirmation: `Booking Confirmation - ${artistNameUpper} at ${venueName}`,
    payment_receipt: `Payment Received - Thank You | ${artistNameUpper}`,
    payment_reminder: `Payment Reminder - ${artistNameUpper}`,
    agreement_ready: `Agreement Ready for Review - ${artistNameUpper}`,
    booking_confirmed: `Booking Confirmed - ${artistNameUpper} | ${venueName}`,
    follow_up: `Following Up - ${artistNameUpper}`,
    rebooking_inquiry: `Rebooking Inquiry - ${artistNameUpper} at ${venueName}`,
  }

  const subject = custom_subject?.trim() || layout?.subject?.trim() || subjectMap[type]

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
    body: JSON.stringify({ message: 'Email sent successfully' }),
  }
}

export { handler }
