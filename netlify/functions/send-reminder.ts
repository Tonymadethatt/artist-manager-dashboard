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
  const managerName = profile.manager_name || 'Your manager'

  const feeRows = unpaidFees.map(f => `
    <tr>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333;">${f.month}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#555;text-align:right;">${money(f.owed)}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;color:#16a34a;text-align:right;">${f.paid > 0 ? money(f.paid) : '—'}</td>
      <td style="padding:8px 0;border-bottom:1px solid #f0f0f0;font-size:13px;font-weight:600;color:#c2410c;text-align:right;">${money(f.balance)}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Payment Reminder</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;background:#f5f5f5;color:#111;">
<div style="max-width:560px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5;">

  <div style="background:#111;color:#fff;padding:24px 28px;">
    <div style="font-size:18px;font-weight:700;">Payment Reminder</div>
    <div style="font-size:13px;color:#aaa;margin-top:3px;">Front Office™ Monthly Retainer</div>
  </div>

  <div style="padding:28px;">
    <p style="font-size:15px;color:#333;line-height:1.7;margin:0 0 20px;">
      Hey ${profile.artist_name},
    </p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
      Just a quick heads-up — there's an outstanding balance on your monthly management retainer. Here's where things stand:
    </p>

    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <thead>
        <tr>
          <th style="text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;padding:0 0 8px;border-bottom:2px solid #eee;">Month</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;padding:0 0 8px;border-bottom:2px solid #eee;">Invoiced</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;padding:0 0 8px;border-bottom:2px solid #eee;">Paid</th>
          <th style="text-align:right;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#999;padding:0 0 8px;border-bottom:2px solid #eee;">Balance</th>
        </tr>
      </thead>
      <tbody>${feeRows}</tbody>
    </table>

    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
      <div style="font-size:12px;color:#9a3412;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.5px;font-weight:700;">Total outstanding</div>
      <div style="font-size:26px;font-weight:700;color:#c2410c;">${money(totalOutstanding)}</div>
    </div>

    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 8px;">
      Whenever you get a chance, please send that over. You can split it up however works for you — just let me know once you've sent something so I can update the records.
    </p>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0;">
      Thanks for everything, as always. Let's keep the momentum going.
    </p>
  </div>

  <div style="background:#fafafa;border-top:1px solid #eee;padding:18px 28px;">
    <p style="font-size:12px;color:#999;margin:0;line-height:1.6;">
      <strong style="color:#555;">${managerName}</strong><br>
      Front Office™ Artist Management<br>
      ${profile.from_email}
    </p>
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
  const subject = `Quick note on your management retainer — ${money(totalOutstanding)} outstanding`

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
