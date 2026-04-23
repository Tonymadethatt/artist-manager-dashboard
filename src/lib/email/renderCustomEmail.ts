import { escapeHtmlPlain } from './appendBlocksHtml'
import {
  decorateMergedArtistCustomSectionTitle,
  decorateMergedVenueCustomSectionTitle,
} from './emailSectionCardEmoji'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_HINT,
  EMAIL_LABEL,
  EMAIL_ROW_LABEL,
  EMAIL_TEXT_PRIMARY,
} from './emailDarkSurfacePalette'
import {
  emailFooterArtistPersonaSublineHtml,
  emailFooterVenueSenderAttributionHtml,
} from './emailFooterPersonaLines'
import { buildProfileFooterLinksHtml, buildProfileFooterLinksRowHtml } from './profileFooterLinksHtml'
import type { CustomEmailBlocksDoc } from './customEmailBlocks'
import { parseCustomEmailBlocksDoc } from './customEmailBlocks'
import {
  applyMergeToText,
  leadMergeKeyHasContent,
  resolveMergeKey,
  type CustomEmailMergeContext,
  type CustomMergeAudience,
  type LeadMergeFields,
} from './customEmailMerge'
import { mergedBodyLooksLikeHtml, sanitizeMergedEmailHtml } from './sanitizeEmailHtml'
import { DEFAULT_LEAD_CTA_PILL_HREFS } from './firstOutreachLeadTemplate'
import type { VenueRenderProfile, VenueRenderRecipient, VenueRenderDeal, VenueRenderVenue } from './renderVenueEmail'
import { resolveVenueRecipientSalutationFirstName } from './resolveVenueRecipientGreeting'
import { VENUE_EMAIL_CAPTURE_BUTTON_STYLE } from './venueEmailCtaStyles'
import {
  buildVenueClientEmailHeaderBrandInnerHtml,
  venueClientEmailLogoAlt,
} from './venueClientEmailHeaderBrandHtml'

export type { CustomEmailMergeContext }

function logoUrls(base: string) {
  const prefix = base.replace(/\/$/, '')
  return {
    logo: prefix ? `${prefix}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png',
    ig: prefix ? `${prefix}/icons/icon-ig.png` : '/icons/icon-ig.png',
  }
}

/** Absolute public paths for lead CTA pill icons; same base resolution as `logoUrls`. */
function leadCtaIconPaths(base: string) {
  const prefix = base.replace(/\/$/, '')
  const path = (name: string) => (prefix ? `${prefix}/icons/${name}` : `/icons/${name}`)
  return {
    globe: path('lead-email-cta-globe.svg'),
    document: path('lead-email-cta-doc.svg'),
    instagram: path('lead-email-cta-ig.svg'),
    reply: path('lead-email-cta-reply.svg'),
  }
}

/** Rounded-rect lead link row (not pill-shaped) — matches website / press / Instagram. */
const LEAD_CTA_LINK_RADIUS = '8px'

/** Prefilled `mailto` body for the reply CTA; merge keys supported. */
const LEAD_REPLY_MAILTO_BODY_TEMPLATE = `Hi {{recipient.firstName}},

I'd like to continue our conversation.

Thanks,`

function nlToBr(s: string): string {
  return escapeHtmlPlain(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
}

/** Card shell; omit header row when section title is empty so recipients are not shown placeholder labels. */
function titledContentCard(
  sectionTitle: string,
  content: string,
  audience: CustomMergeAudience,
): string {
  const showHeader = sectionTitle.trim().length > 0
  const label =
    showHeader && audience === 'artist'
      ? decorateMergedArtistCustomSectionTitle(sectionTitle.trim())
      : showHeader && (audience === 'venue' || audience === 'lead')
        ? decorateMergedVenueCustomSectionTitle(sectionTitle.trim())
        : sectionTitle.trim()
  const header = showHeader
    ? `<div style="background:#161616;padding:10px 18px;border-bottom:1px solid #2a2a2a;"><span style="font-size:11px;font-weight:600;letter-spacing:0.04em;color:${EMAIL_LABEL};vertical-align:middle;">${escapeHtmlPlain(label)}</span></div>`
    : ''
  const bodyPad = showHeader ? 'padding:6px 18px 14px;' : 'padding:14px 18px;'
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:16px;overflow:hidden;">${header}<div style="${bodyPad}">${content}</div></div>`
}

function mergedSectionTitle(
  raw: string | null | undefined,
  ctx: CustomEmailMergeContext,
  audience: CustomMergeAudience,
): string {
  return applyMergeToText((raw ?? '').trim(), ctx, audience).trim()
}

/** Injected once in email &lt;style&gt; — TipTap prose relies on this because *{margin:0;padding:0} strips list/table defaults. */
const EMAIL_PROSE_SCOPED_CSS = `
  .email-prose { font-size: 13px; color: ${EMAIL_BODY_SECONDARY}; line-height: 1.65; }
  .email-prose p { margin: 0 0 10px; }
  .email-prose p:last-child { margin-bottom: 0; }
  .email-prose h1, .email-prose h2, .email-prose h3 {
    font-size: 14px; font-weight: 600; color: ${EMAIL_TEXT_PRIMARY}; margin: 14px 0 6px; line-height: 1.35;
  }
  .email-prose h1:first-child, .email-prose h2:first-child, .email-prose h3:first-child { margin-top: 0; }
  .email-prose ul, .email-prose ol {
    margin: 10px 0;
    padding-left: 28px;
    list-style-position: outside;
  }
  .email-prose ul { list-style-type: disc; }
  .email-prose ol { list-style-type: decimal; }
  .email-prose li {
    margin: 6px 0;
    padding-left: 2px;
    display: list-item;
  }
  .email-prose table {
    width: 100% !important;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 13px;
    border: 1px solid #333333;
  }
  .email-prose th, .email-prose td {
    border: 1px solid #383838;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  .email-prose th {
    background: #1e1e1e;
    font-size: 11px;
    font-weight: 600;
    color: ${EMAIL_LABEL};
  }
`

function rowKv(label: string, value: string, valueColor = EMAIL_TEXT_PRIMARY): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;font-size:13px;color:${EMAIL_ROW_LABEL};border-bottom:1px solid #222222;vertical-align:middle;">${escapeHtmlPlain(label)}</td><td style="padding:10px 0;font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;border-bottom:1px solid #222222;vertical-align:middle;">${escapeHtmlPlain(value)}</td></tr></table>`
}

const OPENING_LINE_P_STYLE = 'font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;'

const OPENING_LEAD_P_STYLE = 'font-size:15px;color:#1a1a1a;line-height:1.65;margin:0 0 16px;'

function renderCustomOpeningLine(
  audience: CustomMergeAudience,
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  recipient: VenueRenderRecipient,
): string {
  const custom = doc.greeting?.trim()
  if (custom) {
    const merged = applyMergeToText(custom, ctx, audience).trim()
    if (!merged) return ''
    return `<p style="${OPENING_LINE_P_STYLE}">${escapeHtmlPlain(merged)}</p>`
  }
  if (audience === 'artist') {
    const merged = applyMergeToText('Hey {{profile.artist_name}},', ctx, audience).trim()
    if (!merged) return ''
    return `<p style="${OPENING_LINE_P_STYLE}">${escapeHtmlPlain(merged)}</p>`
  }
  // venue + lead: greeting to recipient (booker / contact)
  const firstName = resolveVenueRecipientSalutationFirstName({
    name: recipient.name,
    email: recipient.email,
  })
  const line = `Hi ${firstName},`
  return `<p style="${OPENING_LINE_P_STYLE}">${escapeHtmlPlain(line)}</p>`
}

/** Lead-only opening: plain paragraph, dark text on white (no dark-theme opening styles). */
function renderLeadOpeningLine(
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  recipient: VenueRenderRecipient,
): string {
  const custom = doc.greeting?.trim()
  if (custom) {
    const merged = applyMergeToText(custom, ctx, 'lead').trim()
    if (!merged) return ''
    return `<p style="${OPENING_LEAD_P_STYLE}">${escapeHtmlPlain(merged)}</p>`
  }
  const firstName = resolveVenueRecipientSalutationFirstName({
    name: recipient.name,
    email: recipient.email,
  })
  const line = `Hi ${firstName},`
  return `<p style="${OPENING_LEAD_P_STYLE}">${escapeHtmlPlain(line)}</p>`
}

function normalizeExternalHref(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  return `https://${t}`
}

/** Lead CTA row: artist site, press kit, and IG — not lead/venue `lead.*` fields. */
function leadCtaPillHrefs(ctx: CustomEmailMergeContext): { website: string; pressKit: string; instagram: string } {
  const d = DEFAULT_LEAD_CTA_PILL_HREFS
  const website = normalizeExternalHref((ctx.profile.website ?? '').trim()) || d.website
  const pressKit = normalizeExternalHref((ctx.profile.press_kit_url ?? '').trim()) || d.pressKit
  const h = (ctx.profile.social_handle ?? '').trim().replace(/^@+/, '')
  const instagram = h
    ? `https://www.instagram.com/${encodeURIComponent(h)}/`
    : d.instagram
  return { website, pressKit, instagram }
}

/** Lead: show when `showIfKey` is set and that merge value is non-empty, or when `showIfKeyEmpty` is set and that value is empty. */
function leadBlockPassesVisibility(
  b: { showIfKey?: string | null; showIfKeyEmpty?: string | null },
  ctx: CustomEmailMergeContext,
): boolean {
  const sk = b.showIfKey?.trim()
  if (sk) {
    return leadMergeKeyHasContent(ctx, sk)
  }
  const se = b.showIfKeyEmpty?.trim()
  if (se) {
    return !leadMergeKeyHasContent(ctx, se)
  }
  return true
}

function renderBlocks(
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  audience: CustomMergeAudience,
): string {
  const parts: string[] = []
  for (const b of doc.blocks) {
    if (audience === 'lead' && !leadBlockPassesVisibility(b, ctx)) {
      continue
    }
    switch (b.kind) {
      case 'prose': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, audience)
        const merged = applyMergeToText(b.body, ctx, audience)
        const inner = mergedBodyLooksLikeHtml(merged)
          ? `<div class="email-prose">${sanitizeMergedEmailHtml(merged)}</div>`
          : `<div class="email-prose"><p style="margin:0;">${nlToBr(merged)}</p></div>`
        parts.push(titledContentCard(sectionTitle, inner, audience))
        break
      }
      case 'bullet_list': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, audience)
        const lis = b.items
          .map(t => applyMergeToText(t, ctx, audience))
          .filter(t => t.trim())
          .map(
            t =>
              `<li style="margin:0 0 10px 0;display:list-item;list-style-position:outside;padding-left:4px;">${nlToBr(t)}</li>`,
          )
          .join('')
        const inner = `<ul style="font-size:13px;color:${EMAIL_BODY_SECONDARY};line-height:1.65;margin:6px 0;padding-left:28px;list-style-type:disc;list-style-position:outside;">${lis}</ul>`
        parts.push(titledContentCard(sectionTitle, inner, audience))
        break
      }
      case 'key_value': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, audience)
        const rows = b.rows
          .map(r => {
            const v = r.valueKey
              ? resolveMergeKey(r.valueKey, ctx, audience)
              : applyMergeToText(r.value ?? '', ctx, audience)
            const label = applyMergeToText(r.label, ctx, audience)
            return rowKv(label, v)
          })
          .join('')
        parts.push(titledContentCard(sectionTitle, rows, audience))
        break
      }
      case 'table': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, audience)
        const th = b.headers
          .map(
            h =>
              `<th style="text-align:left;font-size:11px;font-weight:600;color:${EMAIL_LABEL};padding:9px 10px;border:1px solid #383838;background:#1e1e1e;">${escapeHtmlPlain(applyMergeToText(h, ctx, audience))}</th>`,
          )
          .join('')
        const tr = b.rows
          .map(
            cells =>
              `<tr>${cells
                .map(
                  c =>
                    `<td style="font-size:13px;color:${EMAIL_BODY_SECONDARY};padding:9px 10px;border:1px solid #383838;vertical-align:top;">${nlToBr(applyMergeToText(c, ctx, audience))}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')
        const inner = `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #333333;margin:4px 0;">${b.headers.length ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>`
        parts.push(titledContentCard(sectionTitle, inner, audience))
        break
      }
      case 'divider':
        parts.push('<div style="border-top:1px solid #2a2a2a;margin:16px 0;"></div>')
        break
      case 'lead_cta_pills': {
        const { website: leadW, pressKit: pressW, instagram: igHref } = leadCtaPillHrefs(ctx)
        const pillBase =
          `display:inline-block;margin:4px 8px 4px 0;padding:9px 18px;border-radius:${LEAD_CTA_LINK_RADIUS};font-size:12px;font-weight:600;text-decoration:none;`
        const pillBlack = `${pillBase}border:1px solid #262626;background:#000000;color:#ffffff;`
        const pills: string[] = []
        if (leadW) {
          pills.push(
            `<a href="${escapeHtmlPlain(leadW)}" style="${pillBlack}">Website</a>`,
          )
        }
        if (pressW) {
          pills.push(
            `<a href="${escapeHtmlPlain(pressW)}" style="${pillBlack}">Press kit</a>`,
          )
        }
        if (igHref) {
          pills.push(
            `<a href="${escapeHtmlPlain(igHref)}" style="${pillBlack}">Instagram</a>`,
          )
        }
        if (pills.length === 0) break
        parts.push(
          `<div style="margin:12px 0 8px;">${pills.join('')}</div>`,
        )
        break
      }
    }
  }
  return parts.join('')
}

function customAttachmentDownloadHtml(url: string, fileName: string): string {
  const safeUrl = escapeHtmlPlain(url)
  const safeTitle = escapeHtmlPlain(fileName)
  return `<div style="margin-top:16px;"><a href="${safeUrl}" title="${safeTitle}" style="display:inline-block;background:#ffffff;color:#000000;font-weight:600;font-size:13px;padding:10px 20px;border-radius:6px;text-decoration:none;">Download</a></div>`
}

function leadPlainAttachmentLink(url: string, fileName: string): string {
  const safeUrl = escapeHtmlPlain(url)
  const safeTitle = escapeHtmlPlain(fileName)
  return `<p style="margin-top:16px;font-size:14px;line-height:1.5;"><a href="${safeUrl}" style="color:#1a1a1a;text-decoration:underline;">${safeTitle}</a></p>`
}

/** Injected in lead &lt;style&gt; for TipTap / merged HTML on a white background. */
const EMAIL_PROSE_LEAD_SCOPED_CSS = `
  .email-prose-lead { font-size: 14px; color: #2a2a2a; line-height: 1.65; }
  .email-prose-lead p { margin: 0 0 10px; color: #1a1a1a; }
  .email-prose-lead p:last-child { margin-bottom: 0; }
  .email-prose-lead h1, .email-prose-lead h2, .email-prose-lead h3 {
    font-size: 15px; font-weight: 600; color: #111111; margin: 14px 0 6px; line-height: 1.35;
  }
  .email-prose-lead h1:first-child, .email-prose-lead h2:first-child, .email-prose-lead h3:first-child { margin-top: 0; }
  .email-prose-lead ul, .email-prose-lead ol {
    margin: 10px 0;
    padding-left: 28px;
    list-style-position: outside;
  }
  .email-prose-lead ul { list-style-type: disc; }
  .email-prose-lead ol { list-style-type: decimal; }
  .email-prose-lead li {
    margin: 6px 0;
    padding-left: 2px;
    display: list-item;
  }
  .email-prose-lead table {
    width: 100% !important;
    border-collapse: collapse;
    margin: 14px 0;
    font-size: 14px;
    border: 1px solid #d4d4d4;
  }
  .email-prose-lead th, .email-prose-lead td {
    border: 1px solid #d4d4d4;
    padding: 8px 10px;
    text-align: left;
    vertical-align: top;
  }
  .email-prose-lead th {
    background: #f5f5f5;
    font-size: 11px;
    font-weight: 600;
    color: #404040;
  }
`

function leadRowKv(label: string, value: string): string {
  return `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;"><tr><td style="padding:10px 0;font-size:14px;color:#525252;border-bottom:1px solid #e5e5e5;vertical-align:middle;">${escapeHtmlPlain(label)}</td><td style="padding:10px 0;font-size:14px;font-weight:600;color:#111111;text-align:right;padding-left:16px;border-bottom:1px solid #e5e5e5;vertical-align:middle;">${escapeHtmlPlain(value)}</td></tr></table>`
}

function leadTitledBlock(sectionTitle: string, content: string): string {
  if (!sectionTitle.trim()) {
    return `<div style="margin-bottom:20px;">${content}</div>`
  }
  const label = decorateMergedVenueCustomSectionTitle(sectionTitle.trim())
  return `<div style="margin-bottom:20px;">
    <div style="font-size:11px;font-weight:600;letter-spacing:0.04em;color:#666666;margin-bottom:8px;">${escapeHtmlPlain(label)}</div>
    <div>${content}</div>
  </div>`
}

function renderLeadBlocks(
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  iconUrls: ReturnType<typeof leadCtaIconPaths>,
): string {
  const parts: string[] = []
  for (const b of doc.blocks) {
    if (!leadBlockPassesVisibility(b, ctx)) {
      continue
    }
    switch (b.kind) {
      case 'prose': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, 'lead')
        const merged = applyMergeToText(b.body, ctx, 'lead')
        const inner = mergedBodyLooksLikeHtml(merged)
          ? `<div class="email-prose-lead">${sanitizeMergedEmailHtml(merged)}</div>`
          : `<div class="email-prose-lead"><p style="margin:0;">${nlToBr(merged)}</p></div>`
        parts.push(leadTitledBlock(sectionTitle, inner))
        break
      }
      case 'bullet_list': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, 'lead')
        const lis = b.items
          .map(t => applyMergeToText(t, ctx, 'lead'))
          .filter(t => t.trim())
          .map(
            t =>
              `<li style="margin:0 0 8px 0;display:list-item;list-style-position:outside;padding-left:4px;color:#1a1a1a;">${nlToBr(t)}</li>`,
          )
          .join('')
        const inner = `<ul style="font-size:14px;color:#1a1a1a;line-height:1.65;margin:0;padding-left:24px;list-style-type:disc;list-style-position:outside;">${lis}</ul>`
        parts.push(leadTitledBlock(sectionTitle, inner))
        break
      }
      case 'key_value': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, 'lead')
        const rows = b.rows
          .map(r => {
            const v = r.valueKey
              ? resolveMergeKey(r.valueKey, ctx, 'lead')
              : applyMergeToText(r.value ?? '', ctx, 'lead')
            const label = applyMergeToText(r.label, ctx, 'lead')
            return leadRowKv(label, v)
          })
          .join('')
        parts.push(leadTitledBlock(sectionTitle, rows))
        break
      }
      case 'table': {
        const sectionTitle = mergedSectionTitle(b.title, ctx, 'lead')
        const th = b.headers
          .map(
            h =>
              `<th style="text-align:left;font-size:11px;font-weight:600;color:#404040;padding:9px 10px;border:1px solid #d4d4d4;background:#f5f5f5;">${escapeHtmlPlain(applyMergeToText(h, ctx, 'lead'))}</th>`,
          )
          .join('')
        const tr = b.rows
          .map(
            cells =>
              `<tr>${cells
                .map(
                  c =>
                    `<td style="font-size:14px;color:#1a1a1a;padding:9px 10px;border:1px solid #d4d4d4;vertical-align:top;">${nlToBr(applyMergeToText(c, ctx, 'lead'))}</td>`,
                )
                .join('')}</tr>`,
          )
          .join('')
        const inner = `<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #d4d4d4;margin:4px 0;">${b.headers.length ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>`
        parts.push(leadTitledBlock(sectionTitle, inner))
        break
      }
      case 'divider':
        parts.push('<div style="border-top:1px solid #e5e5e5;margin:18px 0;"></div>')
        break
      case 'lead_cta_pills': {
        const { website: leadW, pressKit: pressW, instagram: igHref } = leadCtaPillHrefs(ctx)
        const globe = iconUrls.globe
        const docIcon = iconUrls.document
        const igIcon = iconUrls.instagram
        const baseFlex =
          `display:inline-flex;align-items:center;gap:8px;padding:10px 16px;border-radius:${LEAD_CTA_LINK_RADIUS};font-size:13px;font-weight:600;text-decoration:none;`
        const pillBlackFlex = `${baseFlex}background:#000000;color:#ffffff;border:1px solid #262626;`
        const pills: string[] = []
        if (leadW) {
          pills.push(
            `<a href="${escapeHtmlPlain(leadW)}" style="${pillBlackFlex}"><img src="${escapeHtmlPlain(globe)}" width="16" height="16" alt="" style="display:block;border:0;" /><span>Website</span></a>`,
          )
        }
        if (pressW) {
          pills.push(
            `<a href="${escapeHtmlPlain(pressW)}" style="${pillBlackFlex}"><img src="${escapeHtmlPlain(docIcon)}" width="16" height="16" alt="" style="display:block;border:0;" /><span>Press kit</span></a>`,
          )
        }
        if (igHref) {
          pills.push(
            `<a href="${escapeHtmlPlain(igHref)}" style="${pillBlackFlex}"><img src="${escapeHtmlPlain(igIcon)}" width="16" height="16" alt="" style="display:block;border:0;" /><span>Instagram</span></a>`,
          )
        }
        if (pills.length === 0) break
        parts.push(
          `<div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:12px 0 8px;">${pills.join('')}</div>`,
        )
        break
      }
    }
  }
  return parts.join('')
}

function buildLeadReplyMailtoBlock(
  profile: VenueRenderProfile,
  ctx: CustomEmailMergeContext,
  subject: string,
  logoBaseUrl: string,
): string {
  const replyTo = (profile.reply_to_email || profile.from_email || '').trim()
  if (!replyTo) return ''
  const body = applyMergeToText(LEAD_REPLY_MAILTO_BODY_TEMPLATE, ctx, 'lead')
  const href = `mailto:${replyTo}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const replyIcon = leadCtaIconPaths(logoBaseUrl).reply
  const btn = `display:inline-flex;align-items:center;gap:8px;padding:12px 18px;border-radius:${LEAD_CTA_LINK_RADIUS};font-size:13px;font-weight:600;text-decoration:none;background:#2563eb;color:#ffffff;border:1px solid #1e40af;`
  return `<div style="padding:20px 32px 12px 32px;border-top:1px solid #e5e5e5;">
    <a href="${escapeHtmlPlain(href)}" style="${btn}"><img src="${escapeHtmlPlain(replyIcon)}" width="16" height="16" alt="" style="display:block;border:0;" /><span>Reply by email</span></a>
  </div>`
}

function buildLeadEmailFooterHtml(
  profile: VenueRenderProfile,
  logoUrl: string,
  logoAlt: string,
  replyMailto: { ctx: CustomEmailMergeContext; subject: string; logoBaseUrl: string } | null,
): string {
  const replyBlock = replyMailto ? buildLeadReplyMailtoBlock(profile, replyMailto.ctx, replyMailto.subject, replyMailto.logoBaseUrl) : ''
  const footerTopBorder = replyBlock ? '' : 'border-top:1px solid #e5e5e5;'
  const name = profile.manager_name?.trim() || ''
  const title = profile.manager_title?.trim() || ''
  const email = (profile.reply_to_email || profile.from_email || '').trim()
  const nameLine = name
    ? `<div style="font-size:14px;font-weight:600;color:#1a1a1a;margin-top:12px;line-height:1.4;">${escapeHtmlPlain(name)}</div>`
    : ''
  const titleLine = title
    ? `<div style="font-size:13px;color:#333333;margin-top:4px;line-height:1.4;">${escapeHtmlPlain(title)}</div>`
    : ''
  const emailLine = email
    ? `<div style="font-size:13px;color:#1a1a1a;margin-top:6px;line-height:1.4;">${escapeHtmlPlain(email)}</div>`
    : ''
  return `${replyBlock}
  <div class="email-footer-lead" style="padding:24px 32px 32px 32px;${footerTopBorder}">
    <img src="${logoUrl}" alt="${escapeHtmlPlain(logoAlt)}" width="100" style="display:block;max-width:100px;height:auto;" />
    ${nameLine}
    ${titleLine}
    ${emailLine}
  </div>`
}

function buildLeadCustomEmailDocument(
  opts: BuildCustomEmailOptions,
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  subject: string,
): { html: string; subject: string } {
  const { logo: logoUrl } = logoUrls(opts.logoBaseUrl)
  const ctaIconUrls = leadCtaIconPaths(opts.logoBaseUrl)
  const openingHtml = renderLeadOpeningLine(doc, ctx, opts.recipient)
  const bodyInner = renderLeadBlocks(doc, ctx, ctaIconUrls)
  const attachmentBlock = opts.attachment
    ? leadPlainAttachmentLink(opts.attachment.url, opts.attachment.fileName)
    : ''
  const logoAlt = venueClientEmailLogoAlt(opts.profile)
  const footerHtml = buildLeadEmailFooterHtml(opts.profile, logoUrl, logoAlt, {
    ctx,
    subject,
    logoBaseUrl: opts.logoBaseUrl,
  })
  const responsiveClasses = opts.responsiveClasses ?? false
  const mobileStyles = responsiveClasses
    ? `
  @media only screen and (max-width: 600px) {
    .email-body-lead { padding: 22px 18px !important; }
    .email-footer-lead { padding: 20px 18px 24px 18px !important; }
  }`
    : ''
  const bodyClass = responsiveClasses ? ' class="email-body-lead"' : ''
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlPlain(subject)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #ffffff; color: #1a1a1a; -webkit-font-smoothing: antialiased; }
${EMAIL_PROSE_LEAD_SCOPED_CSS}
${mobileStyles}
</style>
</head>
<body>
<div style="max-width:600px;margin:0 auto;background:#ffffff;">
  <div${bodyClass} style="padding:28px 32px;">
    ${openingHtml}
    ${bodyInner}
    ${attachmentBlock}
  </div>
  ${footerHtml}
</div>
</body>
</html>`

  return { html, subject }
}

export interface BuildCustomEmailOptions {
  audience: CustomMergeAudience
  subjectTemplate: string
  blocksRaw: unknown
  profile: VenueRenderProfile
  recipient: VenueRenderRecipient
  deal?: VenueRenderDeal
  venue?: VenueRenderVenue
  /** When `audience` is `lead` — e.g. Lead Intake row mapped to merge fields. */
  lead?: LeadMergeFields | null
  logoBaseUrl: string
  responsiveClasses?: boolean
  /** Venue audience only */
  showReplyButton?: boolean
  replyButtonLabel?: string | null
  /** Optional download CTA appended after blocks (URLs must be validated server-side before send). */
  attachment?: { url: string; fileName: string }
  /** Public one-tap confirmation URL (GET → server thank-you page); venue emails only. */
  captureUrl?: string | null
  /** Button label for the capture CTA; defaults to a generic prompt. */
  captureCTALabel?: string | null
}

function venueFooter(
  profile: VenueRenderProfile,
  subject: string,
  showReply: boolean,
  replyLabel: string,
  igUrl: string,
) {
  const replyTo = profile.reply_to_email || profile.from_email
  const footerLinks = buildProfileFooterLinksHtml(igUrl, profile.website, profile.social_handle, profile.phone)
  const senderAttribution = emailFooterVenueSenderAttributionHtml(
    profile.manager_name,
    profile.manager_title,
  )

  const mailtoHref = `mailto:${escapeHtmlPlain(replyTo)}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent('Hi,\n\n')}`
  const replyBlock = showReply
    ? `<a href="${mailtoHref}" style="display:inline-block;background:#1e1e1e;color:${EMAIL_BODY_SECONDARY};font-size:12px;font-weight:500;padding:9px 18px;border-radius:6px;border:1px solid #333333;text-decoration:none;margin-top:12px;">${escapeHtmlPlain(replyLabel)}</a>`
    : ''
  return `
  <div class="email-footer" style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    ${senderAttribution}
    ${footerLinks ? `<div style="margin-top:8px;">${footerLinks}</div>` : ''}
    ${replyBlock}
  </div>`
}

function artistAudienceFooter(profile: VenueRenderProfile, igIconUrl: string) {
  const line =
    profile.manager_name?.trim()
    || profile.company_name?.trim()
    || profile.artist_name
    || 'Front Office'
  const links = buildProfileFooterLinksRowHtml(igIconUrl, profile.website, profile.social_handle, profile.phone)
  const subline = emailFooterArtistPersonaSublineHtml(profile.manager_title)
  return `
  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;">${escapeHtmlPlain(line)}</div>
    ${subline}
    ${links}
  </div>`
}

export function buildCustomEmailDocument(opts: BuildCustomEmailOptions): { html: string; subject: string } {
  const doc = parseCustomEmailBlocksDoc(opts.blocksRaw) ?? { version: 1 as const, blocks: [] }
  const ctx: CustomEmailMergeContext = {
    profile: opts.profile,
    recipient: opts.recipient,
    deal: opts.deal,
    venue: opts.venue,
    lead: opts.audience === 'lead' ? (opts.lead ?? null) : undefined,
  }
  const baseSubjectTpl = String(opts.subjectTemplate ?? '').trim() || 'Message from {{profile.artist_name}}'
  let subject = applyMergeToText(baseSubjectTpl, ctx, opts.audience)
  if (opts.audience === 'lead' && doc.leadSubjectIfEventName?.trim()) {
    const eventEv = (ctx.lead?.event_name ?? '').trim()
    if (eventEv) {
      subject = applyMergeToText(doc.leadSubjectIfEventName.trim(), ctx, 'lead')
    }
  }
  if (opts.audience === 'lead') {
    return buildLeadCustomEmailDocument(opts, doc, ctx, subject)
  }
  const bodyInner = renderBlocks(doc, ctx, opts.audience)
  const attachmentBlock = opts.attachment
    ? customAttachmentDownloadHtml(opts.attachment.url, opts.attachment.fileName)
    : ''
  const { logo: logoUrl, ig: igUrl } = logoUrls(opts.logoBaseUrl)
  const responsiveClasses = opts.responsiveClasses ?? false
  const mobileStyles = responsiveClasses ? `
  @media only screen and (max-width: 600px) {
    .wrapper { margin: 0 !important; border-radius: 0 !important; border-left: none !important; border-right: none !important; }
    .email-body { padding: 22px 18px !important; }
    .email-footer { padding: 16px 18px !important; }
  }` : ''
  const wrapperClass = responsiveClasses ? ' class="wrapper"' : ''
  const bodyClass = responsiveClasses ? ' class="email-body"' : ''
  const headerBrandInner = buildVenueClientEmailHeaderBrandInnerHtml(opts.profile)
  const logoAlt = venueClientEmailLogoAlt(opts.profile)

  const header = `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="${escapeHtmlPlain(logoAlt)}" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      ${headerBrandInner}
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`

  const captureTrim =
    opts.audience === 'venue' ? (opts.captureUrl?.trim() || '') : ''
  const captureCtaLabel = opts.captureCTALabel?.trim() || 'Respond'
  const captureCtaHtml = captureTrim
    ? `<div style="text-align:center;margin-bottom:24px;margin-top:4px;">
        <a href="${escapeHtmlPlain(captureTrim)}" style="${VENUE_EMAIL_CAPTURE_BUTTON_STYLE}">${escapeHtmlPlain(captureCtaLabel)}</a>
        <p style="font-size:11px;color:${EMAIL_HINT};margin-top:10px;">Secure one-time link &mdash; takes less than a minute</p>
      </div>`
    : ''

  const openingHtml = renderCustomOpeningLine(opts.audience, doc, ctx, opts.recipient)
  const mainBody = `
    <div${bodyClass} style="padding:28px 32px;">
      ${openingHtml}
      ${bodyInner}
      ${captureCtaHtml}
      ${attachmentBlock}
    </div>`

  let footerHtml: string
  if (opts.audience === 'venue') {
    const hasCaptureCta = Boolean(captureTrim)
    const showReply = opts.showReplyButton !== false && !hasCaptureCta
    const replyLabel = opts.replyButtonLabel?.trim() || 'Reply'
    footerHtml = venueFooter(opts.profile, subject, showReply, replyLabel, igUrl)
  } else {
    footerHtml = artistAudienceFooter(opts.profile, igUrl)
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtmlPlain(subject)}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #0d0d0d; color: #ffffff; -webkit-font-smoothing: antialiased; }
${EMAIL_PROSE_SCOPED_CSS}
${mobileStyles}
</style>
</head>
<body>
<div${wrapperClass} style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">
  ${header}
  ${mainBody}
  ${footerHtml}
</div>
</body>
</html>`

  return { html, subject }
}
