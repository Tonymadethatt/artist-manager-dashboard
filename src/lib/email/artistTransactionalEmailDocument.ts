import type { EmailTemplateLayoutV1 } from '../emailLayout'
import { escapeHtmlPlain } from './appendBlocksHtml'
import { EMAIL_LABEL } from './emailDarkSurfacePalette'
import { buildArtistBrandedEmailHtml } from './artistBrandedEmailShell'

export type ArtistTransactionalKind = 'performance_report_received'

export type ArtistTransactionalEmailInput = {
  artistName: string
  venueName: string
  eventDate: string | null
  managerName: string
  managerTitle?: string | null
  website?: string | null
  social_handle?: string | null
  phone?: string | null
}

/** Prefer a real first name when the artist bills as "DJ …". */
export function artistTransactionalGreetingFirstName(artistName: string): string {
  const parts = artistName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2 && /^DJ\.?$/i.test(parts[0] ?? '')) {
    return parts.slice(1).join(' ') || artistName.trim()
  }
  return parts[0] ?? artistName.trim()
}

export function buildArtistTransactionalEmailHtml(
  _kind: ArtistTransactionalKind,
  input: ArtistTransactionalEmailInput,
  L: EmailTemplateLayoutV1,
  logoBaseUrl: string,
): string {
  void _kind
  const {
    artistName,
    venueName,
    managerName,
    managerTitle,
    website,
    social_handle: socialHandle,
    phone,
  } = input
  const firstName = artistTransactionalGreetingFirstName(artistName)

  const defaultGreeting = `Hi ${escapeHtmlPlain(firstName)},`
  const defaultIntro =
    `Thanks for submitting the post-show check-in for <strong>${escapeHtmlPlain(venueName)}</strong>. `
    + `What you shared goes to <strong>${escapeHtmlPlain(managerName)}</strong> and the management team — it helps us support you behind the scenes and is <strong>not</strong> sent to the venue automatically.`
  const defaultClosing = 'If anything else comes to mind, just reply to this email.'

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

  const roleBanner =
    `<div style="background:rgba(34,197,94,0.07);border:1px solid rgba(34,197,94,0.22);border-radius:8px;padding:11px 16px;margin-bottom:20px;">`
    + `<span style="display:inline-block;width:6px;height:6px;background:#22c55e;border-radius:50%;margin-right:10px;vertical-align:middle;"></span>`
    + `<span style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:${EMAIL_LABEL};vertical-align:middle;">Post-show check-in</span></div>`

  return buildArtistBrandedEmailHtml({
    logoBaseUrl,
    roleBannerHtml: roleBanner,
    greetingInnerHtml: greeting,
    introInnerHtml: intro,
    middleHtml: '',
    layout: L,
    closingInnerHtml: closing,
    managerName,
    managerTitle,
    website,
    social_handle: socialHandle,
    phone,
  })
}
