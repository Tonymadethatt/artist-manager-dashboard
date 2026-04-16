import type { EmailTemplateLayoutV1 } from '../emailLayout'
import {
  scheduleWhenStackFromDeal,
  whenLineCompactFromDeal,
  type ScheduleWhenStack,
} from '../calendar/pacificWallTime'
import { emailSectionCardHtml, escapeHtmlPlain } from './appendBlocksHtml'
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
    performance_start_at?: string | null
    performance_end_at?: string | null
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

const EVENT_LABEL_HTML =
  `<div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_LABEL};margin:0 0 4px;">Event</div>`

/** One gig card body — matches 24h reminder hierarchy (title, venue, Event + timing). */
function showDetailsBodyFromScheduleRow(r: GigCalendarScheduleRow): string {
  const titleBlock =
    `<p style="font-size:15px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">${escapeHtmlPlain(r.title)}</p>`
  const venueBlock =
    `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.6;">${escapeHtmlPlain(r.venue)}</p>`
  let timingBlock = ''
  if (r.whenStack) {
    timingBlock = EVENT_LABEL_HTML + stackedScheduleWhenCellHtml(r.whenStack, '#ffffff', 'digest')
  } else if (r.when.trim()) {
    timingBlock = EVENT_LABEL_HTML
      + `<p style="font-size:13px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">${escapeHtmlPlain(r.when.trim())}</p>`
  }
  return titleBlock + venueBlock + timingBlock
}

function showDetailsBodyFromReminder(args: {
  dealDescription: string
  venueName: string
  whenLine: string
  setLine?: string | null
}): string {
  const setBlock = args.setLine?.trim()
    ? `<div style="margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.12);">`
      + `<div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${EMAIL_LABEL};margin:0 0 4px;">Your set</div>`
      + `<p style="font-size:13px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">${escapeHtmlPlain(args.setLine.trim())}</p>`
      + `</div>`
    : ''
  const whenTrim = args.whenLine.trim()
  const whenBlock = whenTrim
    ? EVENT_LABEL_HTML
      + `<p style="font-size:13px;font-weight:600;color:#ffffff;margin:0;line-height:1.5;">${escapeHtmlPlain(whenTrim)}</p>`
    : ''
  return `<p style="font-size:15px;font-weight:600;color:#ffffff;margin:0 0 8px;line-height:1.35;">${escapeHtmlPlain(args.dealDescription)}</p>`
    + `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0 0 6px;line-height:1.6;">${escapeHtmlPlain(args.venueName)}</p>`
    + whenBlock
    + setBlock
}

function scheduleCardsFromRows(
  rows: GigCalendarScheduleRow[],
  emptyMsg: string,
  accent: string,
): string {
  if (rows.length === 0) {
    return `<p style="font-size:13px;color:${EMAIL_BODY_SECONDARY};margin:0;line-height:1.6;">${escapeHtmlPlain(emptyMsg)}</p>`
  }
  return rows
    .map((r, i) =>
      emailSectionCardHtml(`Gig ${i + 1}`, showDetailsBodyFromScheduleRow(r), accent),
    )
    .join('')
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
  reminder?: { venueName: string; dealDescription: string; whenLine: string; setLine?: string | null }
  /** Pre-built HTML fragment from `buildGigBookedEmailMiddleHtml` (stacked section cards). */
  icsBody?: { middleSectionsHtml: string }
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
      middleHtml = scheduleCardsFromRows(
        args.digest?.rows ?? [],
        'No booked shows in this window.',
        '#fbbf24',
      )
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
      middleHtml = emailSectionCardHtml(
        'Show details',
        showDetailsBodyFromReminder({
          dealDescription: r.dealDescription,
          venueName: r.venueName,
          whenLine: r.whenLine,
          setLine: r.setLine,
        }),
        '#f97316',
      )
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
      middleHtml = args.icsBody!.middleSectionsHtml
      defaultIntro = 'You’ve got a new booking — details below.'
      defaultClosing =
        'Your shared calendar shows a short summary; keep this message for the full breakdown. Reply if anything looks off.'
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
      middleHtml = scheduleCardsFromRows(d.rows, 'No booked shows on this day.', '#60a5fa')
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
