import type { Handler } from '@netlify/functions'

interface ArtistProfile {
  artist_name: string
  artist_email: string
  manager_name: string | null
  manager_email: string | null
  from_email: string
}

interface ReportData {
  outreach: {
    venuesContacted: number
    venuesUpdated: number
    inDiscussion: number
    venuesBooked: number
  }
  deals: {
    count: number
    totalGross: number
    totalCommission: number
    commissionEarned: number
    commissionReceived: number
    allOutstanding: number
  }
  retainer: {
    feeTotal: number
    feePaid: number
    feeOutstanding: number
    unpaidMonths: number
  }
  metrics: {
    partnerships: number
    partnershipValue: number
    attendance: number
    totalAttendance: number
    press: number
    totalReach: number
  }
  tasks: {
    completedTasks: number
  }
}

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function buildHtml(profile: ArtistProfile, report: ReportData, dateRange: { start: string; end: string }): string {
  const managerName = profile.manager_name || 'Your manager'
  const { outreach, deals, retainer, metrics, tasks } = report

  const outstandingTotal = deals.allOutstanding + retainer.feeOutstanding

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Report — ${dateRange.start} to ${dateRange.end}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #f5f5f5; color: #111; }
  .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e5e5; }
  .header { background: #111; color: #fff; padding: 28px 32px; }
  .header h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.3px; }
  .header p { font-size: 13px; color: #aaa; margin-top: 4px; }
  .body { padding: 28px 32px; }
  .greeting { font-size: 15px; color: #333; margin-bottom: 24px; line-height: 1.6; }
  .section { margin-bottom: 24px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #888; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid #eee; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; padding: 7px 0; border-bottom: 1px solid #f0f0f0; }
  .stat-row:last-child { border-bottom: none; }
  .stat-label { font-size: 13px; color: #555; }
  .stat-value { font-size: 13px; font-weight: 600; color: #111; }
  .stat-value.highlight { color: #c2410c; }
  .outstanding-box { background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; }
  .outstanding-box p { font-size: 13px; color: #9a3412; line-height: 1.6; }
  .outstanding-box .amount { font-size: 22px; font-weight: 700; color: #c2410c; margin-bottom: 4px; }
  .zero-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 16px 20px; margin-bottom: 24px; }
  .zero-box p { font-size: 13px; color: #166534; }
  .footer { background: #fafafa; border-top: 1px solid #eee; padding: 20px 32px; }
  .footer p { font-size: 12px; color: #999; line-height: 1.6; }
  .footer strong { color: #555; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="header">
    <h1>Management Report</h1>
    <p>${dateRange.start} &mdash; ${dateRange.end}</p>
  </div>

  <div class="body">
    <p class="greeting">Hey ${profile.artist_name},<br><br>Here's a quick rundown of what's been happening on the management side. Everything below covers the period from <strong>${dateRange.start}</strong> to <strong>${dateRange.end}</strong>.</p>

    ${outstandingTotal > 0 ? `
    <div class="outstanding-box">
      <div class="amount">${money(outstandingTotal)}</div>
      <p>Total outstanding balance owed to management (commission + retainer). Details are broken down below.</p>
    </div>
    ` : `
    <div class="zero-box">
      <p>All commission and retainer balances are fully settled. Thank you!</p>
    </div>
    `}

    <div class="section">
      <div class="section-title">Outreach activity</div>
      <div class="stat-row"><span class="stat-label">New venues added</span><span class="stat-value">${outreach.venuesContacted}</span></div>
      <div class="stat-row"><span class="stat-label">Venues engaged</span><span class="stat-value">${outreach.venuesUpdated}</span></div>
      <div class="stat-row"><span class="stat-label">Active discussions</span><span class="stat-value">${outreach.inDiscussion}</span></div>
      <div class="stat-row"><span class="stat-label">Bookings confirmed</span><span class="stat-value">${outreach.venuesBooked}</span></div>
    </div>

    <div class="section">
      <div class="section-title">Deals & revenue</div>
      <div class="stat-row"><span class="stat-label">New deals logged</span><span class="stat-value">${deals.count}</span></div>
      <div class="stat-row"><span class="stat-label">Total artist revenue</span><span class="stat-value">${money(deals.totalGross)}</span></div>
      <div class="stat-row"><span class="stat-label">Commission generated</span><span class="stat-value">${money(deals.totalCommission)}</span></div>
      <div class="stat-row"><span class="stat-label">Commission earned (you've been paid)</span><span class="stat-value">${money(deals.commissionEarned)}</span></div>
      ${deals.allOutstanding > 0 ? `<div class="stat-row"><span class="stat-label">Outstanding commission</span><span class="stat-value highlight">${money(deals.allOutstanding)}</span></div>` : ''}
    </div>

    <div class="section">
      <div class="section-title">Monthly retainer ($350/mo)</div>
      <div class="stat-row"><span class="stat-label">Total invoiced</span><span class="stat-value">${money(retainer.feeTotal)}</span></div>
      <div class="stat-row"><span class="stat-label">Total received</span><span class="stat-value">${money(retainer.feePaid)}</span></div>
      ${retainer.feeOutstanding > 0 ? `<div class="stat-row"><span class="stat-label">Retainer balance owed</span><span class="stat-value highlight">${money(retainer.feeOutstanding)} (${retainer.unpaidMonths} month${retainer.unpaidMonths !== 1 ? 's' : ''} unpaid)</span></div>` : '<div class="stat-row"><span class="stat-label">Retainer status</span><span class="stat-value">All paid ✓</span></div>'}
    </div>

    ${(metrics.partnerships > 0 || metrics.attendance > 0 || metrics.press > 0) ? `
    <div class="section">
      <div class="section-title">Brand impact</div>
      ${metrics.partnerships > 0 ? `<div class="stat-row"><span class="stat-label">Brand partnerships secured</span><span class="stat-value">${metrics.partnerships} (${money(metrics.partnershipValue)} value)</span></div>` : ''}
      ${metrics.attendance > 0 ? `<div class="stat-row"><span class="stat-label">Events &amp; attendance</span><span class="stat-value">${metrics.attendance} event${metrics.attendance !== 1 ? 's' : ''} · ${metrics.totalAttendance.toLocaleString()} total</span></div>` : ''}
      ${metrics.press > 0 ? `<div class="stat-row"><span class="stat-label">Press mentions</span><span class="stat-value">${metrics.press} (${metrics.totalReach.toLocaleString()} reach)</span></div>` : ''}
    </div>
    ` : ''}

    ${tasks.completedTasks > 0 ? `
    <div class="section">
      <div class="section-title">Work completed</div>
      <div class="stat-row"><span class="stat-label">Tasks completed</span><span class="stat-value">${tasks.completedTasks}</span></div>
    </div>
    ` : ''}
  </div>

  <div class="footer">
    <p><strong>${managerName}</strong><br>Front Office™ Artist Management<br>${profile.from_email}</p>
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

  let body: {
    profile: ArtistProfile
    report: ReportData
    dateRange: { start: string; end: string }
    cc?: string[]
    testOnly?: boolean
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const { profile, report, dateRange, cc = [], testOnly = false } = body
  if (!profile?.from_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Missing profile fields' }) }
  }
  if (testOnly && !profile.manager_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'manager_email not set — add it in Settings.' }) }
  }

  const html = buildHtml(profile, report, dateRange)
  const subject = testOnly
    ? `[TEST] Management Report · ${dateRange.start} to ${dateRange.end}`
    : `Management Report · ${dateRange.start} to ${dateRange.end}`

  const to = testOnly ? [profile.manager_email!] : [profile.artist_email]

  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: profile.from_email,
      to,
      ...(cc.length > 0 && !testOnly ? { cc } : {}),
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
    body: JSON.stringify({ message: 'Report sent successfully' }),
  }
}

export { handler }
