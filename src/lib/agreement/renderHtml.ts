import type { TemplateSection } from '@/types'
import { escapeHtml } from './sanitize'
import { mergeSectionContent } from './merge'

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

export function getSiteOrigin(): string {
  const env = import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined
  if (env && /^https?:\/\//i.test(env.trim())) return env.trim().replace(/\/$/, '')
  if (typeof window !== 'undefined') return window.location.origin
  return ''
}

export function renderAgreementHtmlDocument(opts: {
  sections: TemplateSection[]
  vars: Record<string, string>
  companyLine: string
  taglineLine: string | null
  logoDataUrl: string | null
  generatedAtLabel: string
}): string {
  const { sections, vars, companyLine, taglineLine, logoDataUrl, generatedAtLabel } = opts

  const blocks = sections
    .map(s => {
      const { label, body } = mergeSectionContent(s, vars)
      const bodyHtml = escapeHtml(body).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
      return `<section class="sec"><h2>${escapeHtml(label)}</h2><div class="body">${bodyHtml}</div></section>`
    })
    .join('')

  const logoBlock = logoDataUrl
    ? `<img src="${logoDataUrl}" alt="" class="logo" width="100" />`
    : ''

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  @page { margin: 14mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 24px;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111111;
    font-size: 11pt;
    line-height: 1.5;
    background: #ffffff;
  }
  .doc { max-width: 720px; margin: 0 auto; }
  .header { border-bottom: 1px solid #e5e5e5; padding-bottom: 14px; margin-bottom: 22px; }
  .logo { display: block; max-width: 100px; height: auto; margin-bottom: 10px; }
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
</style></head><body><div class="doc">
<div class="header">${logoBlock}
<div class="company">${escapeHtml(companyLine)}</div>
${taglineLine ? `<div class="tag">${escapeHtml(taglineLine)}</div>` : ''}
</div>
${blocks}
<div class="footer">${escapeHtml(generatedAtLabel)}</div>
</div></body></html>`
}
