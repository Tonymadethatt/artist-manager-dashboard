import { renderAppendBlocksHtml } from '@/lib/email/appendBlocksHtml'
import { buildArtistBrandedEmailFooterHtml } from '@/lib/email/artistBrandedEmailFooterHtml'
import {
  EMAIL_BODY_SECONDARY,
  EMAIL_FOOTER_MUTED,
  EMAIL_LABEL,
} from '@/lib/email/emailDarkSurfacePalette'
import type { EmailTemplateLayoutV1 } from '@/lib/emailLayout'
import { artistLayoutForSend } from '@/lib/emailLayout'
import type { BrandOutreachDigestPayload } from './brandOutreachDigestData'
import { decorateProgrammaticSectionCardTitle } from '@/lib/email/emailSectionCardEmoji'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Match `buildArtistEmailHtml` greeting helper. */
function artistEmailGreetingFirstName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && /^DJ\.?$/i.test(parts[0] ?? '')) {
    return parts.slice(1).join(' ') || fullName.trim()
  }
  return parts[0] ?? fullName.trim()
}

function sectionCard(title: string, content: string): string {
  const safeTitle = escapeHtml(decorateProgrammaticSectionCardTitle(title))
  return `<div style="background:#1a1a1a;border:1px solid #2a2a2a;border-radius:8px;margin-bottom:14px;overflow:hidden;"><div style="background:#161616;padding:9px 18px;border-bottom:1px solid #2a2a2a;"><span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.4px;color:${EMAIL_LABEL};vertical-align:middle;">${safeTitle}</span></div><div style="padding:2px 18px 4px;">${content}</div></div>`
}

export function buildBrandOutreachDigestBodyInnerHtml(
  L: ReturnType<typeof artistLayoutForSend>,
  data: BrandOutreachDigestPayload,
  artistName: string,
  siteUrl: string,
): { html: string; defaultSubject: string } {
  const first = artistEmailGreetingFirstName(artistName)
  const defaultSubject = `${first}, your brand outreach snapshot`
  const intro = L.intro?.trim()
  const opener = intro
    ? escapeHtml(intro).replace(/\n/g, '<br/>')
    : `Here is a quick look at brands and venues you have put your name in front of. The list below shows the most recent; the number at the end keeps building as you stay in touch.`
  const closer = L.closing?.trim()
    ? escapeHtml(L.closing).replace(/\n/g, '<br/>')
    : 'Keep the momentum. Reply if you want to talk through anything.'

  const nameRows = (data.brandNames.length
    ? data.brandNames
    : ['(No names yet)']
  )
    .map(
      n =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #222222;font-size:14px;color:${EMAIL_BODY_SECONDARY};line-height:1.5;">${escapeHtml(
          n,
        )}</td></tr>`,
    )
    .join('')

  const listBlock = `
<table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">
  ${nameRows}
</table>`

  const summaryLines: string[] = []
  const n = data.uniqueTotal
  const brandWord = n === 1 ? 'brand' : 'brands'
  summaryLines.push(
    `You&rsquo;ve already made an impression on <strong style="color:#ffffff;">${n}</strong> ${brandWord} &mdash; and we&rsquo;re just getting started.`,
  )
  if (data.notShownCount > 0) {
    summaryLines.push(
      `This message lists your <strong style="color:#ffffff;">50</strong> most recent. <strong style="color:#ffffff;">${
        data.notShownCount
      }</strong> ${
        data.notShownCount === 1 ? 'is' : 'are'
      } not shown here, and the number at the top keeps growing as you reach more people.`,
    )
  }

  const footNote = summaryLines
    .map(
      t =>
        `<p style="font-size:13px;color:${EMAIL_FOOTER_MUTED};line-height:1.7;margin:0 0 10px 0;">${t}</p>`,
    )
    .join('')

  const logoPath = siteUrl ? `${siteUrl}/dj-luijay-logo-email.png` : '/dj-luijay-logo-email.png'
  const sharedHeader = `
  <div style="padding:28px 32px 0 32px;">
    <img src="${logoPath}" alt="" style="display:block;max-width:100px;width:100px;height:auto;" />
    <div style="margin-top:10px;">
      <div style="font-size:11px;font-weight:700;color:${EMAIL_LABEL};text-transform:uppercase;letter-spacing:2.5px;">Front Office&#8482;</div>
      <div style="font-size:11px;font-weight:500;color:#737373;letter-spacing:0.5px;margin-top:2px;">Brand Growth &amp; Management</div>
    </div>
    <div style="border-top:1px solid #2a2a2a;margin-top:20px;"></div>
  </div>`

  const listSection = sectionCard('Recent brand outreach', listBlock)
  const summarySection = /* only if we have notShown or we want always show - plan: always show first summary line for total */
  footNote

  const bodyHtml = `${sharedHeader}
  <div class="email-body" style="padding:28px 32px;">
    <p style="font-size:15px;color:#ffffff;line-height:1.8;margin-bottom:20px;">Hey ${escapeHtml(first)},<br/><br/>${opener}</p>
    ${listSection}
    ${summarySection}
    ${renderAppendBlocksHtml(L.appendBlocks)}
    <p style="font-size:13px;color:${EMAIL_FOOTER_MUTED};line-height:1.75;margin-top:18px;">${closer}</p>
  </div>`

  return { html: bodyHtml, defaultSubject }
}

type DigestFooter = Parameters<typeof buildArtistBrandedEmailFooterHtml>[0]

export function buildBrandOutreachDigestDocumentHtml(
  L: ReturnType<typeof artistLayoutForSend>,
  data: BrandOutreachDigestPayload,
  artistName: string,
  siteUrl: string,
  sharedStyles: string,
  footer: DigestFooter,
  /** When `data` is empty, preview can still show placeholder list */
  isPreview: boolean,
): { html: string; defaultSubject: string } {
  if (isPreview) {
    const ph: BrandOutreachDigestPayload = {
      brandNames:
        data.brandNames.length > 0
          ? data.brandNames
          : [
              'Skyline Bar (example)',
              'Riverside Social (example)',
              'Downtown Supper Club (example)',
            ],
      uniqueTotal: data.uniqueTotal > 0 ? data.uniqueTotal : 3,
      notShownCount: data.notShownCount > 0 ? data.notShownCount : 0,
      hasData: true,
    }
    const { html: bodyInner, defaultSubject } = buildBrandOutreachDigestBodyInnerHtml(L, ph, artistName, siteUrl)
    return {
      html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brand outreach snapshot (preview)</title>
<style>${sharedStyles}</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">${bodyInner}
  <p style="font-size:11px;color:#737373;padding:0 32px 18px 32px;margin:0;line-height:1.5;">Sample names in preview; the real email uses your live history. Test send needs at least one real send from a completed task first.</p>
  ${buildArtistBrandedEmailFooterHtml(footer)}
</div>
</body>
</html>`,
      defaultSubject,
    }
  }
  const { html: bodyInner, defaultSubject } = buildBrandOutreachDigestBodyInnerHtml(L, data, artistName, siteUrl)
  return {
    html: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Brand outreach</title>
<style>${sharedStyles}</style>
</head>
<body>
<div class="wrapper" style="max-width:600px;margin:24px auto;background:#111111;border-radius:10px;overflow:hidden;border:1px solid #2a2a2a;">${bodyInner}
  ${buildArtistBrandedEmailFooterHtml(footer)}
</div>
</body>
</html>`,
    defaultSubject,
  }
}

export function makeLayoutForBrandDigest(
  raw: EmailTemplateLayoutV1 | null | undefined,
  customSubject?: string | null,
  customIntro?: string | null,
) {
  return artistLayoutForSend(raw, customSubject, customIntro)
}
