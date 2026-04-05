import type { TemplateSection } from '@/types'
import { mergeSectionContent, partitionAgreementSections } from './merge'
import { escapeAttr, escapeHtml, isSafeImageUrl } from './sanitize'

/** Fetch logo from site root and return a data URL for reliable html2canvas rendering. */
export async function fetchLogoDataUrl(siteOrigin: string): Promise<string | null> {
  const base = siteOrigin.replace(/\/$/, '')
  try {
    const res = await fetch(`${base}/dj-luijay-logo.png`)
    if (!res.ok) return null
    const blob = await res.blob()
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result as string)
      r.onerror = () => reject(new Error('read failed'))
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(new Error('read failed'))
    r.readAsDataURL(blob)
  })
}

/**
 * Resolve header logo: first header section with header_logo_url tries fetch-as-data-URL;
 * falls back to raw URL for img src. Otherwise default site logo.
 */
export async function resolveAgreementLogo(
  siteOrigin: string,
  sections: TemplateSection[]
): Promise<{ logoDataUrl: string | null; logoSrcUrl: string | null; invertForPrint: boolean }> {
  const headers = sections.filter(s => (s.section_kind ?? 'body') === 'header')
  for (const h of headers) {
    const u = h.header_logo_url?.trim()
    if (u && isSafeImageUrl(u)) {
      try {
        const res = await fetch(u, { mode: 'cors' })
        if (res.ok) {
          const blob = await res.blob()
          const dataUrl = await blobToDataUrl(blob)
          return { logoDataUrl: dataUrl, logoSrcUrl: null, invertForPrint: false }
        }
      } catch {
        return { logoDataUrl: null, logoSrcUrl: u, invertForPrint: false }
      }
      return { logoDataUrl: null, logoSrcUrl: u, invertForPrint: false }
    }
  }
  const dataUrl = await fetchLogoDataUrl(siteOrigin)
  return { logoDataUrl: dataUrl, logoSrcUrl: null, invertForPrint: true }
}

export function getSiteOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  if (env && /^https?:\/\//i.test(env.trim())) return env.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

function buildLogoImg(
  logoDataUrl: string | null,
  logoSrcUrl: string | null,
  invertForPrint: boolean
): string {
  const src =
    logoDataUrl?.trim() ||
    (logoSrcUrl?.trim() && isSafeImageUrl(logoSrcUrl) ? logoSrcUrl.trim() : '')
  if (!src) return ''
  const cls = invertForPrint ? 'logo logo--print' : 'logo'
  return `<img src="${escapeAttr(src)}" alt="" class="${cls}" width="100" crossorigin="anonymous" />`
}

function sectionBlocksToHtml(sections: TemplateSection[], vars: Record<string, string>): string {
  return sections
    .map(s => {
      const { label, body } = mergeSectionContent(s, vars)
      const bodyHtml = escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
      return `<section class="sec"><h2>${escapeHtml(label)}</h2><div class="body">${bodyHtml}</div></section>`
    })
    .join('')
}

function inlineBlocksToHtml(sections: TemplateSection[], vars: Record<string, string>): string {
  return sections
    .map(s => {
      const { body } = mergeSectionContent(s, vars)
      const bodyHtml = escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
      return `<div class="header-block">${bodyHtml}</div>`
    })
    .join('')
}

export function renderAgreementHtmlDocument(opts: {
  sections: TemplateSection[]
  vars: Record<string, string>
  companyLine: string
  taglineLine: string | null
  logoDataUrl: string | null
  /** If fetch failed CORS, use direct URL for img (still print-styled). */
  logoSrcUrl?: string | null
  /** When true, default light logo is inverted for white paper. */
  invertLogoForPrint?: boolean
  generatedAtLabel: string
}): string {
  const {
    sections,
    vars,
    companyLine,
    taglineLine,
    logoDataUrl,
    logoSrcUrl,
    invertLogoForPrint = true,
    generatedAtLabel,
  } = opts

  const { headers, bodies, footers } = partitionAgreementSections(sections)
  const logoBlock = buildLogoImg(logoDataUrl, logoSrcUrl ?? null, invertLogoForPrint)

  const headerExtraHtml =
    headers.length > 0 ? inlineBlocksToHtml(headers, vars) : ''

  const bodyBlocks = sectionBlocksToHtml(bodies, vars)

  const footerExtraHtml =
    footers.length > 0 ? inlineBlocksToHtml(footers, vars) : ''

  const footerInner = `${footerExtraHtml}<div class="footer-meta">${escapeHtml(generatedAtLabel)}</div>`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="color-scheme" content="light"/>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  html {
    color-scheme: light;
    background: #ffffff !important;
    color: #111111 !important;
  }
  body {
    margin: 0;
    padding: 24px;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111111 !important;
    font-size: 11pt;
    line-height: 1.5;
    background: #ffffff !important;
  }
  .doc { max-width: 720px; margin: 0 auto; }
  .header { border-bottom: 1px solid #e5e5e5; padding-bottom: 14px; margin-bottom: 22px; }
  .logo { display: block; max-width: 100px; height: auto; margin-bottom: 10px; }
  .logo.logo--print { filter: invert(1) brightness(0); }
  .header-block { color: #262626; font-size: 10pt; margin-bottom: 10px; }
  .company { font-size: 14pt; font-weight: 700; letter-spacing: 0.04em; color: #0a0a0a; }
  .tag { font-size: 9pt; color: #525252; margin-top: 4px; font-weight: 500; }
  .sec { page-break-inside: avoid; margin-bottom: 16px; }
  h2 {
    font-size: 10pt;
    font-weight: 700;
    margin: 20px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #171717;
    border-bottom: 1px solid #f5f5f5;
    padding-bottom: 6px;
  }
  .body { color: #262626; }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #f5f5f5; font-size: 8pt; color: #737373; }
  .footer-meta { margin-top: 8px; }
</style></head><body><div class="doc">
<div class="header">${logoBlock}${headerExtraHtml}
<div class="company">${escapeHtml(companyLine)}</div>
${taglineLine ? `<div class="tag">${escapeHtml(taglineLine)}</div>` : ''}
</div>
${bodyBlocks}
<div class="footer">${footerInner}</div>
</div></body></html>`
}
