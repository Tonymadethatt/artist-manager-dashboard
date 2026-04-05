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

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

function rows(items: Array<[string, string]>): string {
  return items.map(([label, value], i, arr) => {
    const isLast = i === arr.length - 1
    const border = isLast ? '' : 'border-bottom:1px solid #f0f0f0;'
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;${border}"><span style="font-size:13px;color:#444444;line-height:1.4;">${label}</span><span style="font-size:13px;font-weight:600;color:#111;text-align:right;padding-left:16px;">${value}</span></div>`
  }).join('')
}

function sectionCard(title: string, content: string): string {
  return `<div style="border:1px solid #e8e8e8;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#f5f5f5;padding:9px 18px;border-bottom:1px solid #e8e8e8;"><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#333333;">${title}</span></div><div style="padding:2px 18px 4px;">${content}</div></div>`
}

function buildHtml(profile: ArtistProfile, report: ReportData, dateRange: { start: string; end: string }): string {
  const managerName = profile.manager_name || 'Management'
  const { outreach, deals, retainer, metrics, tasks } = report
  const outstandingTotal = deals.allOutstanding + retainer.feeOutstanding
  const startFmt = fmtDate(dateRange.start)
  const endFmt = fmtDate(dateRange.end)

  // Determine the hero win — show the most impactful positive metric
  let heroValue = ''
  let heroLabel = ''
  let heroSubtext = ''
  if (outreach.venuesBooked > 0) {
    heroValue = String(outreach.venuesBooked)
    heroLabel = outreach.venuesBooked === 1 ? 'Booking Confirmed' : 'Bookings Confirmed'
    heroSubtext = 'New venue secured this period'
  } else if (deals.totalGross > 0) {
    heroValue = money(deals.totalGross)
    heroLabel = 'In Artist Revenue'
    heroSubtext = `Across ${deals.count} deal${deals.count !== 1 ? 's' : ''} this period`
  } else if (outreach.inDiscussion > 0) {
    heroValue = String(outreach.inDiscussion)
    heroLabel = 'Active Conversations'
    heroSubtext = 'Venues currently in discussion'
  } else if (outreach.venuesContacted > 0) {
    heroValue = String(outreach.venuesContacted)
    heroLabel = 'New Venues Reached'
    heroSubtext = 'Added to the pipeline this period'
  } else if (tasks.completedTasks > 0) {
    heroValue = String(tasks.completedTasks)
    heroLabel = 'Tasks Completed'
    heroSubtext = 'Deliverables closed this period'
  }

  // Dynamic opener line based on best metric
  let summaryLine: string
  if (outreach.venuesBooked > 0) {
    summaryLine = `${outreach.venuesBooked === 1 ? 'A booking came through' : `${outreach.venuesBooked} bookings came through`} this period — the work is paying off.`
  } else if (deals.totalGross > 0) {
    summaryLine = `Revenue is moving and the pipeline is active.`
  } else if (outreach.inDiscussion > 0) {
    summaryLine = `${outreach.inDiscussion} conversation${outreach.inDiscussion !== 1 ? 's are' : ' is'} live right now — things are in motion.`
  } else if (outreach.venuesContacted > 0) {
    summaryLine = `Outreach is active and the pipeline is growing.`
  } else {
    summaryLine = `Here's a look at where things stand.`
  }

  // Outreach section
  const outreachSection = sectionCard('Outreach Activity', rows([
    ['New venues added', String(outreach.venuesContacted)],
    ['Venues engaged', String(outreach.venuesUpdated)],
    ['Active discussions', String(outreach.inDiscussion)],
    ['Bookings confirmed', String(outreach.venuesBooked)],
  ]))

  // Deals section
  const dealsSection = sectionCard('Deals & Revenue', rows([
    ['New deals logged', String(deals.count)],
    ['Total artist revenue', money(deals.totalGross)],
    ['Commission generated', money(deals.totalCommission)],
    ['Commission received', money(deals.commissionReceived)],
  ]))

  // Retainer section
  const retainerSection = sectionCard('Monthly Retainer', rows(
    retainer.feeOutstanding > 0
      ? [['Total invoiced', money(retainer.feeTotal)], ['Total received', money(retainer.feePaid)]]
      : [['Total invoiced', money(retainer.feeTotal)], ['Status', 'All settled ✓']]
  ))

  // Balance callout — neutral and matter-of-fact, placed after the wins sections
  const balanceCallout = outstandingTotal > 0 ? `
<div style="border:1px solid #dedede;border-radius:8px;padding:20px 22px;margin-bottom:14px;background:#f9f9f9;">
  <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#333333;margin-bottom:10px;">Still in motion</div>
  <div style="font-size:30px;font-weight:800;color:#111;letter-spacing:-1px;line-height:1;margin-bottom:8px;">${money(outstandingTotal)}</div>
  <div style="font-size:13px;color:#555555;line-height:1.65;">Outstanding management balance — commission and retainer combined. Just keeping us aligned; details are in the sections above.</div>
</div>` : ''

  // Brand impact section — only rendered if there's something to show
  const brandRows: Array<[string, string]> = []
  if (metrics.partnerships > 0) brandRows.push(['Brand partnerships secured', `${metrics.partnerships} · ${money(metrics.partnershipValue)} value`])
  if (metrics.attendance > 0) brandRows.push(['Events & attendance', `${metrics.attendance} event${metrics.attendance !== 1 ? 's' : ''} · ${metrics.totalAttendance.toLocaleString()} total`])
  if (metrics.press > 0) brandRows.push(['Press coverage', `${metrics.press} mention${metrics.press !== 1 ? 's' : ''} · ${metrics.totalReach.toLocaleString()} reach`])
  const brandSection = brandRows.length > 0 ? sectionCard('Brand Impact', rows(brandRows)) : ''

  // Tasks section
  const tasksSection = tasks.completedTasks > 0
    ? sectionCard('Work Completed', rows([['Tasks closed this period', String(tasks.completedTasks)]]))
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #ebebeb; color: #111; -webkit-font-smoothing: antialiased; }
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-header { padding: 24px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
    .hero-val { font-size: 36px !important; }
  }
</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #d8d8d8;">

  <!-- Header -->
  <div class="email-header" style="background:#0d0d0d;padding:28px 32px;">
    <div style="font-size:18px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;line-height:1.1;">Front Office&#8482;</div>
    <div style="font-size:10px;color:#999999;text-transform:uppercase;letter-spacing:2.5px;margin-top:5px;">Brand Growth &amp; Management</div>
    <div style="margin-top:20px;padding-top:18px;border-top:1px solid #1e1e1e;">
      <span style="font-size:12px;color:#cccccc;">${startFmt} &mdash; ${endFmt}</span>
    </div>
  </div>

  <!-- Body -->
  <div class="email-body" style="padding:28px 32px;">

    <!-- Greeting -->
    <p style="font-size:15px;color:#222;line-height:1.8;margin-bottom:26px;">Hey ${profile.artist_name},<br><br>${summaryLine} Here's your full management update covering <strong>${startFmt}</strong> through <strong>${endFmt}</strong>.</p>

    ${heroValue ? `<!-- Hero win -->
    <div style="text-align:center;background:#0d0d0d;border-radius:8px;padding:26px 20px;margin-bottom:22px;">
      <div class="hero-val" style="font-size:44px;font-weight:800;color:#ffffff;letter-spacing:-1.5px;line-height:1;">${heroValue}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#cccccc;margin-top:10px;">${heroLabel}</div>
      <div style="font-size:12px;color:#aaaaaa;margin-top:5px;">${heroSubtext}</div>
    </div>` : ''}

    ${outreachSection}
    ${dealsSection}
    ${retainerSection}
    ${balanceCallout}
    ${brandSection}
    ${tasksSection}

    <p style="font-size:13px;color:#666666;line-height:1.75;margin-top:10px;">That's the full picture. As always, reach out if you want to talk through anything.</p>

  </div>

  <!-- Footer -->
  <div class="email-footer" style="background:#f5f5f5;border-top:1px solid #e8e8e8;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#111;">${managerName}</div>
    <div style="font-size:11px;color:#666666;margin-top:3px;letter-spacing:0.3px;">Front Office&#8482; Brand Growth &amp; Management</div>
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
  const startFmt = fmtDate(dateRange.start)
  const endFmt = fmtDate(dateRange.end)
  const subject = testOnly
    ? `[TEST] Management Update · ${startFmt} – ${endFmt}`
    : `Management Update · ${startFmt} – ${endFmt}`

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
