import { escapeHtmlPlain } from './appendBlocksHtml'
import { defaultAccentForBlockKind, parseAccentColorHex } from './customEmailAccentPresets'
import type { CustomEmailBlocksDoc } from './customEmailBlocks'
import { parseCustomEmailBlocksDoc } from './customEmailBlocks'
import { applyMergeToText, resolveMergeKey, type CustomEmailMergeContext, type CustomMergeAudience } from './customEmailMerge'
import { mergedBodyLooksLikeHtml, sanitizeMergedEmailHtml } from './sanitizeEmailHtml'
import type { VenueRenderProfile, VenueRenderRecipient, VenueRenderDeal, VenueRenderVenue } from './renderVenueEmail'

export type { CustomEmailMergeContext }

function logoUrls(base: string) {
  const prefix = base.replace(/\/$/, '')
  return {
    logo: prefix ? `${prefix}/dj-luijay-logo.png` : '/dj-luijay-logo.png',
    ig: prefix ? `${prefix}/icons/icon-ig.png` : '/icons/icon-ig.png',
  }
}

function nlToBr(s: string): string {
  return escapeHtmlPlain(s).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
}

function card(title: string, content: string, accentColor: string): string {
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:16px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="display:inline-block;width:6px;height:6px;background:${accentColor};border-radius:50%;margin-right:8px;vertical-align:middle;"></span><span style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:#888888;vertical-align:middle;">${escapeHtmlPlain(title)}</span></div><div style="padding:2px 18px 6px;">${content}</div></div>`
}

function titledBlockAccent(b: { kind: string; accentColor?: string | null }): string {
  const hex = b.accentColor ? parseAccentColorHex(b.accentColor) : null
  if (hex) return hex
  if (b.kind === 'bullet_list' || b.kind === 'prose' || b.kind === 'key_value' || b.kind === 'table') {
    return defaultAccentForBlockKind(b.kind)
  }
  return defaultAccentForBlockKind('prose')
}

const PROSE_WRAPPER_STYLE = 'font-size:13px;color:#d1d1d1;line-height:1.7;margin:0;'

function rowKv(label: string, value: string, valueColor = '#ffffff'): string {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #222222;"><span style="font-size:13px;color:#888888;">${escapeHtmlPlain(label)}</span><span style="font-size:13px;font-weight:600;color:${valueColor};text-align:right;padding-left:16px;">${escapeHtmlPlain(value)}</span></div>`
}

function renderBlocks(
  doc: CustomEmailBlocksDoc,
  ctx: CustomEmailMergeContext,
  audience: CustomMergeAudience,
): string {
  const parts: string[] = []
  for (const b of doc.blocks) {
    switch (b.kind) {
      case 'prose': {
        const titleRaw = applyMergeToText(b.title?.trim() || 'Message', ctx, audience).toUpperCase()
        const merged = applyMergeToText(b.body, ctx, audience)
        const inner = mergedBodyLooksLikeHtml(merged)
          ? `<div style="${PROSE_WRAPPER_STYLE}">${sanitizeMergedEmailHtml(merged)}</div>`
          : `<p style="${PROSE_WRAPPER_STYLE}">${nlToBr(merged)}</p>`
        parts.push(card(titleRaw, inner, titledBlockAccent(b)))
        break
      }
      case 'bullet_list': {
        const titleRaw = applyMergeToText(b.title?.trim() || 'Details', ctx, audience).toUpperCase()
        const lis = b.items
          .map(t => applyMergeToText(t, ctx, audience))
          .filter(t => t.trim())
          .map(t => `<li style="margin-bottom:8px;">${nlToBr(t)}</li>`)
          .join('')
        const inner = `<ul style="font-size:13px;color:#d1d1d1;line-height:1.7;padding-left:16px;margin:0;">${lis}</ul>`
        parts.push(card(titleRaw, inner, titledBlockAccent(b)))
        break
      }
      case 'key_value': {
        const titleRaw = applyMergeToText(b.title?.trim() || 'Summary', ctx, audience).toUpperCase()
        const rows = b.rows
          .map(r => {
            const v = r.valueKey
              ? resolveMergeKey(r.valueKey, ctx, audience)
              : applyMergeToText(r.value ?? '', ctx, audience)
            const label = applyMergeToText(r.label, ctx, audience)
            return rowKv(label, v)
          })
          .join('')
        parts.push(card(titleRaw, rows, titledBlockAccent(b)))
        break
      }
      case 'table': {
        const titleRaw = applyMergeToText(b.title?.trim() || 'Table', ctx, audience).toUpperCase()
        const th = b.headers.map(h => `<th style="text-align:left;font-size:11px;color:#888888;padding:8px 10px;border-bottom:1px solid #2a2a2a;">${escapeHtmlPlain(applyMergeToText(h, ctx, audience))}</th>`).join('')
        const tr = b.rows
          .map(cells => `<tr>${cells.map(c => `<td style="font-size:13px;color:#d1d1d1;padding:10px;border-bottom:1px solid #222222;">${nlToBr(applyMergeToText(c, ctx, audience))}</td>`).join('')}</tr>`)
          .join('')
        const inner = `<table style="width:100%;border-collapse:collapse;">${b.headers.length ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>`
        parts.push(card(titleRaw, inner, titledBlockAccent(b)))
        break
      }
      case 'divider':
        parts.push('<div style="border-top:1px solid #2a2a2a;margin:16px 0;"></div>')
        break
    }
  }
  return parts.join('')
}

export interface BuildCustomEmailOptions {
  audience: CustomMergeAudience
  subjectTemplate: string
  blocksRaw: unknown
  profile: VenueRenderProfile
  recipient: VenueRenderRecipient
  deal?: VenueRenderDeal
  venue?: VenueRenderVenue
  logoBaseUrl: string
  responsiveClasses?: boolean
  /** Venue audience only */
  showReplyButton?: boolean
  replyButtonLabel?: string | null
}

function venueFooter(
  profile: VenueRenderProfile,
  subject: string,
  showReply: boolean,
  replyLabel: string,
  igUrl: string,
) {
  const replyTo = profile.reply_to_email || profile.from_email
  const companyName = profile.company_name || profile.artist_name
  const handle = profile.social_handle ? profile.social_handle.replace(/^@/, '') : ''
  const footerLinks = [
    profile.website ? `<a href="${escapeHtmlPlain(profile.website)}" style="color:#888888;text-decoration:none;font-size:11px;">${escapeHtmlPlain(profile.website.replace(/^https?:\/\//, ''))}</a>` : '',
    handle ? `<a href="https://instagram.com/${escapeHtmlPlain(handle)}" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;vertical-align:middle;"><img src="${igUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.6;" /><span style="font-size:11px;color:#888888;">@${escapeHtmlPlain(handle)}</span></a>` : '',
    profile.phone ? `<span style="font-size:11px;color:#888888;">${escapeHtmlPlain(profile.phone)}</span>` : '',
  ].filter(Boolean).join('<span style="color:#444444;margin:0 8px;">|</span>')

  const mailtoHref = `mailto:${escapeHtmlPlain(replyTo)}?subject=${encodeURIComponent('Re: ' + subject)}&body=${encodeURIComponent('Hi,\n\n')}`
  const replyBlock = showReply
    ? `<a href="${mailtoHref}" style="display:inline-block;background:#1e1e1e;color:#d1d1d1;font-size:12px;font-weight:600;padding:9px 18px;border-radius:6px;border:1px solid #333333;text-decoration:none;margin-top:12px;">${escapeHtmlPlain(replyLabel)}</a>`
    : ''
  return `
  <div class="email-footer" style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;margin-bottom:4px;">${escapeHtmlPlain(companyName.toUpperCase())}</div>
    ${footerLinks ? `<div style="margin-top:4px;">${footerLinks}</div>` : ''}
    ${replyBlock}
  </div>`
}

function artistStaticFooter(igIconUrl: string) {
  return `
  <div style="background:#0a0a0a;border-top:1px solid #1e1e1e;padding:20px 32px;">
    <div style="font-size:13px;font-weight:700;color:#ffffff;">Front Office</div>
    <div style="font-size:11px;color:#888888;margin-top:3px;letter-spacing:0.3px;">Front Office&#8482; Brand Growth &amp; Management</div>
    <div style="margin-top:10px;display:flex;align-items:center;flex-wrap:wrap;gap:0;">
      <a href="https://djluijay.com" style="color:#888888;text-decoration:none;font-size:11px;">djluijay.com</a>
      <span style="color:#444444;margin:0 8px;">|</span>
      <a href="https://instagram.com/djluijay" style="display:inline-flex;align-items:center;gap:4px;text-decoration:none;vertical-align:middle;">
        <img src="${igIconUrl}" alt="IG" width="13" height="13" style="display:inline-block;vertical-align:middle;opacity:0.6;" />
        <span style="font-size:11px;color:#888888;">@djluijay</span>
      </a>
    </div>
  </div>`
}

export function buildCustomEmailDocument(opts: BuildCustomEmailOptions): { html: string; subject: string } {
  const doc = parseCustomEmailBlocksDoc(opts.blocksRaw) ?? { version: 1 as const, blocks: [] }
  const ctx: CustomEmailMergeContext = {
    profile: opts.profile,
    recipient: opts.recipient,
    deal: opts.deal,
    venue: opts.venue,
  }
  const subject = applyMergeToText(opts.subjectTemplate.trim() || 'Message from {{profile.artist_name}}', ctx, opts.audience)
  const bodyInner = renderBlocks(doc, ctx, opts.audience)
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

  const header = `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoUrl}" alt="DJ LUIJAY" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;color:#888888;text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:8px;font-weight:500;color:#555555;letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`

  const firstName = opts.recipient.name.split(' ')[0]
  let mainBody: string
  let footerHtml: string

  if (opts.audience === 'venue') {
    const showReply = opts.showReplyButton !== false
    const replyLabel = opts.replyButtonLabel?.trim() || 'Reply to This Email'
    mainBody = `
    <div${bodyClass} style="padding:28px 32px;">
      <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">Hi ${escapeHtmlPlain(firstName)},</p>
      ${bodyInner}
    </div>`
    footerHtml = venueFooter(opts.profile, subject, showReply, replyLabel, igUrl)
  } else {
    mainBody = `
    <div${bodyClass} style="padding:28px 32px;">
      <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:6px;">Hey ${escapeHtmlPlain(firstName)},</p>
      ${bodyInner}
    </div>`
    footerHtml = artistStaticFooter(igUrl)
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
