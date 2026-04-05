import type { Handler } from '@netlify/functions'

interface ArtistProfile {
  artist_name: string
  artist_email: string
  manager_name: string | null
  manager_email: string | null
  from_email: string
}

interface UnpaidFee {
  month: string
  owed: number
  paid: number
  balance: number
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function buildReminderHtml(profile: ArtistProfile, unpaidFees: UnpaidFee[], totalOutstanding: number): string {
  const managerName = profile.manager_name || 'Management'
  const monthCount = unpaidFees.length
  const hasPartials = unpaidFees.some(f => f.paid > 0)

  // Value recap opener — qualitative, relationship-first, no specific numbers
  const recapLine = monthCount === 1
    ? `We've been heads down on the management side — outreach is active, conversations are moving, and I'm continuing to push the brand forward.`
    : `We've been heads down on the management side across the last ${monthCount} months — outreach is active, we've got live conversations with venues, and I'm continuing to push the brand forward.`

  const feeRows = unpaidFees.map(f => {
    const isPartial = f.paid > 0
    return `<tr>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#222;font-weight:500;">${f.month}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#777;text-align:right;">${money(f.owed)}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:${isPartial ? '#16a34a' : '#bbb'};text-align:right;">${isPartial ? money(f.paid) : '—'}</td>
      <td style="padding:12px 0;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:700;color:#111;text-align:right;">${money(f.balance)}</td>
    </tr>`
  }).join('')

  const partialNote = hasPartials
    ? `<p style="font-size:13px;color:#aaa;margin-top:10px;line-height:1.6;">Partial payments already received are reflected above — thank you for those.</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Note</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #ebebeb; color: #111; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-header { padding: 24px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .fee-table { font-size: 12px !important; }
    .hide-mobile { display: none !important; }
  }
</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d8d8d8;">

  <!-- Header -->
  <div class="email-header" style="background:#0d0d0d;padding:28px 32px;">
    <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Front Office&#8482;</div>
    <div style="font-size:10px;color:#555;text-transform:uppercase;letter-spacing:2.5px;margin-top:5px;">Brand Growth &amp; Management</div>
  </div>

  <!-- Body -->
  <div class="email-body" style="padding:28px 32px;">

    <!-- Greeting + value recap -->
    <p style="font-size:15px;color:#222;line-height:1.8;margin-bottom:20px;">Hey ${profile.artist_name},</p>
    <p style="font-size:14px;color:#555;line-height:1.8;margin-bottom:20px;">${recapLine}</p>
    <p style="font-size:14px;color:#555;line-height:1.8;margin-bottom:28px;">Wanted to do a quick check-in on the management retainer — there's a balance that hasn't cleared yet. Here's where things stand:</p>

    <!-- Fee breakdown table -->
    <div style="border:1px solid #e8e8e8;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="background:#f5f5f5;padding:10px 18px;border-bottom:1px solid #e8e8e8;">
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#999;">Retainer Balance</span>
      </div>
      <div style="padding:0 18px;">
        <table class="fee-table" style="width:100%;border-collapse:collapse;">
          <thead>
            <tr>
              <th style="text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#bbb;padding:10px 0 6px;border-bottom:1px solid #eee;">Month</th>
              <th class="hide-mobile" style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#bbb;padding:10px 0 6px;border-bottom:1px solid #eee;">Invoiced</th>
              <th class="hide-mobile" style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#bbb;padding:10px 0 6px;border-bottom:1px solid #eee;">Paid</th>
              <th style="text-align:right;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#bbb;padding:10px 0 6px;border-bottom:1px solid #eee;">Balance</th>
            </tr>
          </thead>
          <tbody>${feeRows}</tbody>
        </table>
      </div>
    </div>

    ${partialNote}

    <!-- Total callout — neutral, not alarming -->
    <div style="display:flex;justify-content:space-between;align-items:center;border:1px solid #e0e0e0;border-radius:8px;padding:18px 22px;margin:${hasPartials ? '16px' : '4px'} 0 24px;background:#f9f9f9;">
      <div style="font-size:13px;color:#888;">Total outstanding</div>
      <div style="font-size:22px;font-weight:800;color:#111;letter-spacing:-0.5px;">${money(totalOutstanding)}</div>
    </div>

    <!-- Closing — warm, no pressure -->
    <p style="font-size:14px;color:#555;line-height:1.8;margin-bottom:12px;">Whenever you're able to send something over, even a partial, just shoot it through and let me know. Happy to work with whatever works for you right now.</p>
    <p style="font-size:14px;color:#555;line-height:1.8;">Appreciate you — let's keep this momentum going. Big things ahead.</p>

  </div>

  <!-- Footer -->
  <div class="email-footer" style="background:#f5f5f5;border-top:1px solid #e8e8e8;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#111;">${managerName}</div>
    <div style="font-size:11px;color:#aaa;margin-top:3px;letter-spacing:0.3px;">Front Office&#8482; Brand Growth &amp; Management</div>
  </div>

</div>
</body>
</html>`
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ message: 'Method not allowed' }) }
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ message: 'RESEND_API_KEY not configured' }) }
  }

  let body: { profile: ArtistProfile; unpaidFees: UnpaidFee[]; totalOutstanding: number }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const { profile, unpaidFees, totalOutstanding } = body
  if (!profile?.artist_email || !profile?.from_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }

  const html = buildReminderHtml(profile, unpaidFees, totalOutstanding)

  // Subject is casual — doesn't scream "you owe money"
  const firstName = profile.artist_name.split(' ')[0]
  const subject = `Hey ${firstName} — quick note from management`

  const to = [profile.artist_email]
  const cc = profile.manager_email ? [profile.manager_email] : []

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
    body: JSON.stringify({ message: 'Reminder sent successfully' }),
  }
}

export { handler }
