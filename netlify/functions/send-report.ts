import type { Handler } from '@netlify/functions'
import type { EmailTemplateLayoutV1 } from '../../src/lib/emailLayout'
import { artistLayoutForSend } from '../../src/lib/emailLayout'
import { renderAppendBlocksHtml } from '../../src/lib/email/appendBlocksHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_FOOTER_MUTED,
  EMAIL_LABEL,
  EMAIL_META_TAGLINE,
  EMAIL_ROW_LABEL,
  EMAIL_TEXT_PRIMARY,
} from '../../src/lib/email/emailDarkSurfacePalette'
import { buildArtistBrandedEmailFooterHtml } from '../../src/lib/email/artistBrandedEmailFooterHtml'
import type { ManagementReportEmailData } from '../../src/lib/reports/buildManagementReportData'
import { dedupeCcAgainstTo, resolveArtistFacingResend } from '../../src/lib/email/emailTestModeServer'
import { parseResendMessageIdFromResendApiJson } from '../../src/lib/email/resendMessageId'
import { fetchEmailTestModeRowForSend, logResendOutboundSendForUsage } from './supabaseAdmin'
import { formatUsdDisplayCeil } from '../../src/lib/format/displayCurrency'
import { formatPacificWeekdayMdYyFromYmd } from '../../src/lib/calendar/pacificWallTime'

function escapeHtmlEnt(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

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

function money(n: number) {
  return formatUsdDisplayCeil(n)
}

// third tuple element = value color, defaults to white
function rows(items: Array<[string, string, string?]>): string {
  return items.map(([label, value, valueColor = EMAIL_TEXT_PRIMARY], i, arr) => {
    const isLast = i === arr.length - 1
    const border = isLast ? '' : 'border-bottom:1px solid #222222;'
    return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:11px 0;font-size:13px;color:${EMAIL_ROW_LABEL};line-height:1.4;${border}vertical-align:middle;">${label}</td><td style="padding:11px 0;font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;${border}vertical-align:middle;">${value}</td></tr></table>`
  }).join('')
}

// accentColor drives the colored dot before the section title
function sectionCard(title: string, content: string, accentColor: string = '#60a5fa'): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${title}</span></div><div style="padding:2px 18px 4px;">${content}</div></div>`
}

function buildHtml(profile: ArtistProfile, report: ManagementReportEmailData, dateRange: { start: string; end: string }, L: EmailTemplateLayoutV1): string {
  const managerName = profile.manager_name || 'Management'
  const siteUrl = process.env.URL || ''
  const logoUrl = `${siteUrl}/dj-luijay-logo-email.png`
  const { outreach, artistEarnings, deals, retainer, metrics, tasks, performance } = report
  const leadsReached = outreach.leadsReached ?? 0
  const leadEmailsSent = outreach.leadEmailsSent ?? 0
  const outstandingTotal = deals.allOutstanding + retainer.feeOutstanding
  const startFmt = formatPacificWeekdayMdYyFromYmd(dateRange.start)
  const endFmt = formatPacificWeekdayMdYyFromYmd(dateRange.end)

  // Determine the hero win — show the most impactful positive metric
  let heroValue = ''
  let heroLabel = ''
  let heroSubtext = ''
  if (outreach.venuesBooked > 0) {
    heroValue = String(outreach.venuesBooked)
    heroLabel = outreach.venuesBooked === 1 ? 'Booking Confirmed' : 'Bookings Confirmed'
    heroSubtext = 'New venue secured this period'
  } else if (artistEarnings.grossBookedInPeriod > 0) {
    heroValue = money(artistEarnings.grossBookedInPeriod)
    heroLabel = 'Artist Booking Gross'
    heroSubtext = `${artistEarnings.dealsBookedInPeriod} deal${artistEarnings.dealsBookedInPeriod !== 1 ? 's' : ''} logged this period`
  } else if (outreach.inDiscussion > 0) {
    heroValue = String(outreach.inDiscussion)
    heroLabel = 'Active Conversations'
    heroSubtext = 'Venues currently in discussion'
  } else if (leadsReached > 0) {
    heroValue = String(leadsReached)
    heroLabel = leadsReached === 1 ? 'Lead Reached' : 'Leads Reached'
    heroSubtext = 'Lead Intake email outreach this period'
  } else if (outreach.venuesContacted > 0) {
    heroValue = String(outreach.venuesContacted)
    heroLabel = 'New Venues Reached'
    heroSubtext = 'Added to the pipeline this period'
  } else if (tasks.completedTasks > 0) {
    heroValue = String(tasks.completedTasks)
    heroLabel = 'Tasks Completed'
    heroSubtext = 'Deliverables closed this period'
  }

  // Dynamic opener line based on best metric (no em dashes)
  let summaryLine: string
  if (outreach.venuesBooked > 0) {
    summaryLine = `${outreach.venuesBooked === 1 ? 'A booking came through' : `${outreach.venuesBooked} bookings came through`} this period, the work is paying off.`
  } else if (artistEarnings.grossBookedInPeriod > 0) {
    summaryLine = `Show money is on the books and activity is showing up in the numbers.`
  } else if (outreach.inDiscussion > 0) {
    summaryLine = `${outreach.inDiscussion} conversation${outreach.inDiscussion !== 1 ? 's are' : ' is'} live right now, things are in motion.`
  } else if (leadsReached > 0) {
    summaryLine = `Lead Intake is moving: ${leadEmailsSent} outbound email${leadEmailsSent !== 1 ? 's' : ''} to ${leadsReached} lead${leadsReached !== 1 ? 's' : ''} this period.`
  } else if (outreach.venuesContacted > 0) {
    summaryLine = `Outreach is active and the pipeline is growing.`
  } else {
    summaryLine = `Here's a look at where things stand.`
  }

  // Outreach section — blue accent
  const outreachSection = sectionCard('Outreach Activity', rows([
    ['New venues added (total)', String(outreach.venuesContacted), '#60a5fa'],
    ['Pipeline venues added', String(outreach.pipelineAdded), '#60a5fa'],
    ['Community venues added', String(outreach.communityAdded), '#60a5fa'],
    ['Leads reached (Lead Intake)', String(leadsReached), '#60a5fa'],
    ['Lead emails sent (total)', String(leadEmailsSent), '#60a5fa'],
    ['Venues engaged', String(outreach.venuesUpdated), '#60a5fa'],
    ['Active discussions', String(outreach.inDiscussion), '#60a5fa'],
    ['Bookings confirmed (total)', String(outreach.venuesBooked), outreach.venuesBooked > 0 ? '#22c55e' : '#60a5fa'],
    ['Pipeline bookings', String(outreach.pipelineBooked), outreach.pipelineBooked > 0 ? '#22c55e' : '#60a5fa'],
    ['Community bookings', String(outreach.communityBooked), outreach.communityBooked > 0 ? '#22c55e' : '#60a5fa'],
  ]), '#60a5fa')

  const artistRows: Array<[string, string, string]> = [
    ['New deals logged', String(artistEarnings.dealsBookedInPeriod), '#60a5fa'],
    ['Booking gross logged (show money)', money(artistEarnings.grossBookedInPeriod), '#ffffff'],
    ['Marked artist-paid (deals)', String(artistEarnings.dealsArtistPaidInPeriod), '#60a5fa'],
    ['Gross on paid rows', money(artistEarnings.grossArtistPaidInPeriod), '#ffffff'],
    ['Pipeline venues (gross)', money(artistEarnings.grossPipelineBooked), '#ffffff'],
    ['Community venues (gross)', money(artistEarnings.grossCommunityBooked), '#ffffff'],
  ]
  if (artistEarnings.grossUnlinkedBooked > 0) {
    artistRows.push(['No venue linked (gross)', money(artistEarnings.grossUnlinkedBooked), EMAIL_ROW_LABEL])
  }
  const artistEarningsSection = sectionCard('Artist Earnings', rows(artistRows), '#22c55e')

  const commissionSection = sectionCard('Management Commission', rows([
    ['New deals logged', String(deals.count), '#60a5fa'],
    ['Commission on those deals', money(deals.totalCommission), '#ffffff'],
    ['Commission earned (artist paid)', money(deals.commissionEarned), '#ffffff'],
    ['Commission received by management', money(deals.commissionReceived), '#22c55e'],
  ]), '#22c55e')

  // Retainer section — green if fully paid, red if outstanding
  const retainerAccent = retainer.feeOutstanding > 0 ? '#ef4444' : '#22c55e'
  const retainerSection = sectionCard('Monthly Retainer', rows(
    retainer.feeOutstanding > 0
      ? [
          ['Total invoiced', money(retainer.feeTotal), '#60a5fa'],
          ['Received so far', money(retainer.feePaid), retainer.feePaid > 0 ? '#22c55e' : EMAIL_ROW_LABEL],
        ]
      : [
          ['Total invoiced', money(retainer.feeTotal), '#60a5fa'],
          ['Status', '&#10003; Fully paid', '#22c55e'],
        ]
  ), retainerAccent)

  // Balance callout — red tint, shown only when something is owed
  const balanceCallout = outstandingTotal > 0 ? `
<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px;padding:20px 22px;margin-bottom:14px;">
  <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};margin-bottom:10px;">Outstanding Balance</div>
  <div style="font-size:30px;font-weight:800;color:#ef4444;letter-spacing:-1px;line-height:1;margin-bottom:8px;">${money(outstandingTotal)}</div>
  <div style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.65;">Outstanding management balance: your commission and retainer only (not artist booking gross). See Management Commission and Monthly Retainer above.</div>
</div>` : ''

  // Brand impact section — only rendered if there is data
  const brandRows: Array<[string, string, string]> = []
  if (metrics.partnerships > 0) brandRows.push(['Brand partnerships secured', `${metrics.partnerships} - ${money(metrics.partnershipValue)} value`, '#ffffff'])
  if (metrics.attendance > 0) brandRows.push(['Events and attendance', `${metrics.attendance} event${metrics.attendance !== 1 ? 's' : ''} - ${metrics.totalAttendance.toLocaleString()} total`, '#ffffff'])
  if (metrics.press > 0) brandRows.push(['Press coverage', `${metrics.press} mention${metrics.press !== 1 ? 's' : ''} - ${metrics.totalReach.toLocaleString()} reach`, '#60a5fa'])
  const brandSection = brandRows.length > 0 ? sectionCard('Brand Impact', rows(brandRows), '#60a5fa') : ''

  // Tasks section — green accent
  const tasksSection = tasks.completedTasks > 0
    ? sectionCard('Work Completed', rows([['Tasks closed this period', String(tasks.completedTasks), '#22c55e']]), '#22c55e')
    : ''

  // Post-show activity section — only rendered when there are submitted performance reports in range
  let perfSection = ''
  if (performance && performance.showsPerformed > 0) {
    const perfRows: Array<[string, string, string]> = [
      ['Shows performed', String(performance.showsPerformed), '#22c55e'],
    ]
    if (performance.avgRating !== null) {
      perfRows.push(['Avg. rating from artist', `${performance.avgRating}/5`, '#ffffff'])
    }
    if (performance.totalAttendance > 0) {
      perfRows.push(['Total reported attendance', performance.totalAttendance.toLocaleString(), '#ffffff'])
    }
    if (performance.rebookingLeads > 0) {
      perfRows.push(['Venues interested in rebooking', String(performance.rebookingLeads), '#22c55e'])
    }
    perfSection = sectionCard('Post-Show Activity', rows(perfRows), '#22c55e')
  }

  const introRawG = L.intro?.trim()
  const greetingInner = introRawG
    ? escapeHtmlEnt(introRawG).replace(/\n/g, '<br/>')
    : `${summaryLine} Here is your full management update covering <strong>${startFmt}</strong> through <strong>${endFmt}</strong>.`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Management Report</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
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
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">

  <!-- Header -->
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:${EMAIL_META_TAGLINE};letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>

  <!-- Body -->
  <div class="email-body" style="padding:28px 32px;">

    <!-- Greeting -->
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:26px;">Hey ${profile.artist_name},<br><br>${greetingInner}</p>

    ${heroValue ? `<!-- Hero win -->
    <div style="text-align:center;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.2);border-radius:8px;padding:26px 20px;margin-bottom:22px;">
      <div class="hero-val" style="font-size:44px;font-weight:800;color:#22c55e;letter-spacing:-1.5px;line-height:1;">${heroValue}</div>
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:${EMAIL_LABEL};margin-top:10px;">${heroLabel}</div>
      <div style="font-size:12px;color:${EMAIL_BODY_SECONDARY};margin-top:5px;">${heroSubtext}</div>
    </div>` : ''}

    ${perfSection}
    ${outreachSection}
    ${artistEarningsSection}
    ${commissionSection}
    ${retainerSection}
    ${balanceCallout}
    ${brandSection}
    ${tasksSection}

    ${renderAppendBlocksHtml(L.appendBlocks)}

    <p style="font-size:13px;color:${EMAIL_FOOTER_MUTED};line-height:1.75;margin-top:10px;">${L.closing?.trim()
    ? escapeHtmlEnt(L.closing).replace(/\n/g, '<br/>')
    : 'That is the full picture. Reach out if you want to talk through anything.'}</p>

  </div>

  ${buildArtistBrandedEmailFooterHtml({
    logoBaseUrl: siteUrl,
    managerName,
    managerTitle: profile.manager_title,
    website: profile.website,
    social_handle: profile.social_handle,
    phone: profile.phone,
  })}

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
    report: ManagementReportEmailData
    dateRange: { start: string; end: string }
    cc?: string[]
    testOnly?: boolean
    custom_subject?: string | null
    custom_intro?: string | null
    layout?: unknown | null
    user_id?: string
  }
  try {
    body = JSON.parse(event.body ?? '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ message: 'Invalid JSON body' }) }
  }

  const { profile, report, dateRange, cc = [], testOnly = false, custom_subject, custom_intro, layout: layoutRaw, user_id: rawUserId } = body
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
  if (testOnly && !profile.manager_email) {
    return { statusCode: 400, body: JSON.stringify({ message: 'manager_email not set. Add it in Settings.' }) }
  }

  const html = buildHtml(profile, report, dateRange, L)
  const startFmt = formatPacificWeekdayMdYyFromYmd(dateRange.start)
  const endFmt = formatPacificWeekdayMdYyFromYmd(dateRange.end)
  const defaultSubject = testOnly
    ? `[TEST] Management Update - ${startFmt} to ${endFmt}`
    : `Management Update - ${startFmt} to ${endFmt}`
  const subject = L.subject?.trim() || defaultSubject

  let to = testOnly ? [profile.manager_email!] : [profile.artist_email]
  let ccOut = testOnly ? [] : [...cc]
  const resolved = resolveArtistFacingResend({
    row: testModeRow,
    testOnly,
    to,
    cc: ccOut,
    subject,
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
      'Authorization': `Bearer ${apiKey}`,
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
  await logResendOutboundSendForUsage({ userId, resendMessageId, source: 'send_report' })

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: 'Report sent successfully',
      ...(resendMessageId ? { resend_message_id: resendMessageId } : {}),
    }),
  }
}

export { handler }
