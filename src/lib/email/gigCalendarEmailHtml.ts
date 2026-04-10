import type { EmailTemplateLayoutV1 } from '../emailLayout'
import {
  scheduleWhenStackFromDeal,
  whenLineCompactFromDeal,
  type ScheduleWhenStack,
} from '@/lib/calendar/pacificWallTime'
import { escapeHtmlPlain } from './appendBlocksHtml'
import { buildArtistBrandedEmailHtml } from './artistBrandedEmailShell'
import { artistTransactionalGreetingFirstName } from './artistTransactionalEmailDocument'
import { stackedScheduleWhenCellHtml } from './emailTableDateStack'
import { EMAIL_BODY_SECONDARY, EMAIL_LABEL } from './emailDarkSurfacePalette'

export type GigCalendarBrandedKind =
  | 'gig_calendar_digest_weekly'
  | 'gig_reminder_24h'
  | 'gig_booked_ics'
  | 'gig_day_summary_manual'

export type GigCalendarScheduleRow = {
  /** Legacy single-line when (used only if `whenStack` is absent). */
  when: string
  whenStack?: ScheduleWhenStack
  title: string
  venue: string
}

/** Shared by queue worker, previews, and tests — prefers stacked “when” when instants or date exist. */
export function buildGigCalendarTableRow(
  deal: {
    event_start_at?: string | null
    event_end_at?: string | null
    event_date?: string | null
  },
  title: string,
  venue: string,
): GigCalendarScheduleRow {
  const stack = scheduleWhenStackFromDeal(deal)
  if (stack) {
    return { when: '', whenStack: stack, title, venue }
  }
  return {
    when: whenLineCompactFromDeal(deal) || deal.event_date?.trim() || '',
    title,
    venue,
  }
}

function roleBannerRgba(
  bg: string,
  border: string,
  dot: string,
  label: string,
): string {
  return `<div style="background:${bg};border:1px solid ${border};border-radius:8px;padding:11px 16px;margin-bottom:20px;">`
    + `<span style="display:inline-block;width:6px;height:6px;background:${dot};border-radius:50%;margin-right:10px;vertical-align:middle;"></span>`
    + `<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${EMAIL_LABEL};vertical-align:middle;">${label}</span>`
    + `</div>`
}

/** Divider lines — digest uses lighter grays so rows read clearly on #111/#141. */
const TABLE_ROW_RULE_COMPACT = '#2e2e2e'
const TABLE_ROW_RULE_DIGEST = '#4a4a4a'
const TABLE_FRAME_DIGEST = '#5a5a5a'
const TABLE_HEAD_BG = '#1f1f1f'
/** Slightly darker header tint for the middle column only (digest). */
const TABLE_MIDDLE_HEAD_DIGEST = '#1a1a1a'
const TABLE_SURFACE_DIGEST = '#141414'
/** Middle column body: darker strip vs outer columns so When / Show / Venue scan as three bands. */
const TABLE_MIDDLE_COL_DIGEST = '#0f0f0f'
/** Day-summary table sits on #111 — middle column a touch darker than the card. */
const TABLE_MIDDLE_COL_COMPACT = '#0e0e0e'

type ScheduleTableMode = 'compact' | 'digest'

/**
 * 3-col schedule: `compact` = dense day-summary; `digest` = framed, header row, high-contrast rules.
 */
function scheduleWhenCellHtml(r: GigCalendarScheduleRow, isDigest: boolean): string {
  if (r.whenStack) {
    return stackedScheduleWhenCellHtml(r.whenStack, '#ffffff', isDigest ? 'digest' : 'compact')
  }
  return escapeHtmlPlain(r.when)
}

function scheduleTableHtml(rows: GigCalendarScheduleRow[], emptyMsg: string, mode: ScheduleTableMode = 'compact'): string {
  const isDigest = mode === 'digest'
  const rule = isDigest ? TABLE_ROW_RULE_DIGEST : TABLE_ROW_RULE_COMPACT
  const fs = isDigest ? '13px' : '12px'
  const padV = isDigest ? '9px' : '5px'
  const padH = isDigest ? '12px' : '8px'
  const cell = (extra: string) =>
    `padding:${padV} ${padH};border-bottom:1px solid ${rule};vertical-align:top;font-size:${fs};line-height:1.4;${extra}`

  const midBodyBg = isDigest ? TABLE_MIDDLE_COL_DIGEST : TABLE_MIDDLE_COL_COMPACT

  const bodyRows = rows.length
    ? rows.map(r => `<tr>
        <td style="${cell('color:#ffffff;width:1%;vertical-align:top')}">${scheduleWhenCellHtml(r, isDigest)}</td>
        <td style="${cell(`color:#ffffff;background:${midBodyBg}`)}">${escapeHtmlPlain(r.title)}</td>
        <td style="${cell(`color:${EMAIL_BODY_SECONDARY}`)}">${escapeHtmlPlain(r.venue)}</td>
      </tr>`).join('')
    : `<tr><td colspan="3" style="padding:14px ${padH};font-size:${fs};color:${EMAIL_BODY_SECONDARY};border-bottom:1px solid ${rule}">${emptyMsg}</td></tr>`

  const thStyle = (middleCol: boolean) =>
    `padding:10px ${padH};text-align:left;font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${EMAIL_LABEL};background:${middleCol ? TABLE_MIDDLE_HEAD_DIGEST : TABLE_HEAD_BG};border-bottom:2px solid ${rule};vertical-align:bottom;`

  const head = isDigest
    ? `<thead><tr>
        <th style="${thStyle(false)}width:1%;">When</th>
        <th style="${thStyle(true)}">Show</th>
        <th style="${thStyle(false)}">Venue</th>
      </tr></thead>`
    : ''

  const table = `<table role="presentation" style="width:100%;border-collapse:collapse;margin:0;font-size:${fs};">${head}<tbody>${bodyRows}</tbody></table>`

  if (!isDigest) {
    return `<div style="margin:0 0 8px">${table}</div>`
  }

  return `<div style="margin:0 0 14px;border:1px solid ${TABLE_FRAME_DIGEST};border-radius:10px;overflow:hidden;background:${TABLE_SURFACE_DIGEST};box-shadow:0 1px 0 rgba(255,255,255,0.04)">${table}</div>`
}

export type BuildBrandedGigCalendarEmailArgs = {
  kind: GigCalendarBrandedKind
  L: EmailTemplateLayoutV1
  logoBaseUrl: string
  artistName: string
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
  digest?: { rows: GigCalendarScheduleRow[] }
  daySummary?: { rows: GigCalendarScheduleRow[]; dayLabel: string }
  reminder?: { venueName: string; dealDescription: string; whenLine: string }
  icsBody?: { dealDescription: string; venueLine: string }
}

/** Artist gig calendar sends: same branded shell as transactional emails + per-kind body. */
export function buildBrandedGigCalendarEmail(args: BuildBrandedGigCalendarEmailArgs): string {
  const {
    kind,
    L,
    logoBaseUrl,
    artistName,
    managerName,
    managerTitle,
    website,
    social_handle: socialHandle,
    phone,
  } = args
  const firstName = artistTransactionalGreetingFirstName(artistName)

  const defaultGreeting = `Hi ${escapeHtmlPlain(firstName)},`
  let roleBanner: string
  let defaultIntro: string
  let defaultClosing: string
  let middleHtml: string

  switch (kind) {
    case 'gig_calendar_digest_weekly': {
      roleBanner = roleBannerRgba(
        'rgba(251,191,36,0.08)',
        'rgba(251,191,36,0.25)',
        '#fbbf24',
        'Two-week schedule',
      )
      middleHtml =
        `<p style="font-size:16px;font-weight:600;color:#ffffff;margin:0 0 14px">Upcoming gigs</p>`
        + scheduleTableHtml(args.digest?.rows ?? [], 'No booked shows in this window.', 'digest')
      defaultIntro =
        'Here are your <strong>confirmed</strong> gigs for the <strong>next two weeks</strong>.'
      defaultClosing = 'If a date or time looks wrong, reply to this email and we’ll fix it.'
      break
    }
    case 'gig_reminder_24h': {
      roleBanner = roleBannerRgba(
        'rgba(249,115,22,0.08)',
        'rgba(249,115,22,0.25)',
        '#f97316',
        '24-hour reminder',
      )
      const r = args.reminder!
      middleHtml =
        `<p style="font-size:17px;font-weight:600;color:#ffffff;margin:0 0 6px">${escapeHtmlPlain(r.dealDescription)}</p>`
        + `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};margin:0 0 4px">${escapeHtmlPlain(r.venueName)}</p>`
        + `<p style="font-size:14px;font-weight:600;color:#ffffff;margin:0 0 8px">${escapeHtmlPlain(r.whenLine)}</p>`
      defaultIntro = 'Quick heads-up — your show is coming up in about <strong>24 hours</strong>.'
      defaultClosing = 'Break a leg. Reply if you need anything from the team.'
      break
    }
    case 'gig_booked_ics': {
      roleBanner = roleBannerRgba(
        'rgba(34,197,94,0.07)',
        'rgba(34,197,94,0.22)',
        '#22c55e',
        'Booked',
      )
      const b = args.icsBody!
      middleHtml =
        `<p style="font-size:17px;font-weight:600;color:#ffffff;margin:0 0 6px">${escapeHtmlPlain(b.dealDescription)}</p>`
        + `<p style="font-size:14px;color:${EMAIL_BODY_SECONDARY};margin:0 0 14px">${escapeHtmlPlain(b.venueLine)}</p>`
        + `<p style="font-size:14px;color:#ffffff;margin:0">A calendar invite (<strong>.ics</strong>) is attached — open it to add this gig to your calendar.</p>`
      defaultIntro = 'You’re officially on the books for this one.'
      defaultClosing = 'We’ll keep the calendar updated as details firm up.'
      break
    }
    case 'gig_day_summary_manual': {
      roleBanner = roleBannerRgba(
        'rgba(96,165,250,0.07)',
        'rgba(96,165,250,0.22)',
        '#60a5fa',
        'Day schedule',
      )
      const d = args.daySummary!
      middleHtml =
        `<p style="font-size:16px;font-weight:600;color:#ffffff;margin:0 0 12px">Your gigs — ${escapeHtmlPlain(d.dayLabel)}</p>`
        + scheduleTableHtml(d.rows, 'No booked shows on this day.')
      defaultIntro = `Here’s everything on your calendar for <strong>${escapeHtmlPlain(d.dayLabel)}</strong>.`
      defaultClosing = 'Reply if you want changes or a different snapshot.'
      break
    }
  }

  const greeting = L.greeting?.trim()
    ? escapeHtmlPlain(L.greeting.trim().replace(/\{firstName\}/gi, firstName)).replace(/\n/g, '<br/>')
    : defaultGreeting
  const introRaw = L.intro?.trim()
  const intro = introRaw
    ? escapeHtmlPlain(introRaw).replace(/\n/g, '<br/>')
    : defaultIntro
  const closingRaw = L.closing?.trim()
  const closing = closingRaw
    ? escapeHtmlPlain(closingRaw).replace(/\n/g, '<br/>')
    : defaultClosing

  return buildArtistBrandedEmailHtml({
    logoBaseUrl,
    roleBannerHtml: roleBanner,
    greetingInnerHtml: greeting,
    introInnerHtml: intro,
    middleHtml,
    layout: L,
    closingInnerHtml: closing,
    managerName,
    managerTitle,
    website,
    social_handle: socialHandle,
    phone,
  })
}
