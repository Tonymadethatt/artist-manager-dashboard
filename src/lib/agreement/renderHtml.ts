import DOMPurify, { type Config as DomPurifyConfig } from 'dompurify'
import type { TemplateSection } from '@/types'
import { mergeBracketTokens, mergeSectionContent, partitionAgreementSections } from './merge'
import { escapeAttr, escapeHtml, isHtmlContent, isSafeImageUrl } from './sanitize'

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

/**
 * Invert the RGB channels of a raster image data URL via an offscreen canvas.
 * Used to convert a white/light logo to a dark/black version for print without
 * using CSS `filter`, which html2canvas mis-composites and causes black canvases.
 */
function invertImageToDataUrl(dataUrl: string): Promise<string | null> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const d = imageData.data
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i]         // R
        d[i + 1] = 255 - d[i + 1] // G
        d[i + 2] = 255 - d[i + 2] // B
        // alpha unchanged — preserves transparency
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
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
  const rawDataUrl = await fetchLogoDataUrl(siteOrigin)
  if (!rawDataUrl) return { logoDataUrl: null, logoSrcUrl: null, invertForPrint: false }
  // Pre-invert pixels via canvas so no CSS `filter` is needed in the captured HTML.
  // html2canvas 1.4.x mishandles `filter` and causes black canvas output.
  const inverted = await invertImageToDataUrl(rawDataUrl)
  return { logoDataUrl: inverted ?? rawDataUrl, logoSrcUrl: null, invertForPrint: false }
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
  _invertForPrint: boolean
): string {
  const src =
    logoDataUrl?.trim() ||
    (logoSrcUrl?.trim() && isSafeImageUrl(logoSrcUrl) ? logoSrcUrl.trim() : '')
  if (!src) return ''
  return `<img src="${escapeAttr(src)}" alt="" class="logo" width="100" crossorigin="anonymous" />`
}

const PURIFY_CONFIG: DomPurifyConfig = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'div', 'span',
    'strong', 'b', 'em', 'i', 'u', 's',
    'h3', 'h4',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'blockquote', 'pre', 'code',
  ],
  ALLOWED_ATTR: ['colspan', 'rowspan'],
}

/**
 * Merge `{{token}}` placeholders in HTML body content with HTML-escaped values.
 * Prevents variable values from injecting markup.
 */
function mergeHtmlVars(content: string, vars: Record<string, string>): string {
  let out = content
  for (const [key, val] of Object.entries(vars)) {
    const safe = escapeHtml(val || `[${key}]`)
    out = out.replaceAll(`{{${key}}}`, safe)
  }
  const bracketVars: Record<string, string> = {}
  for (const [key, val] of Object.entries(vars)) {
    bracketVars[key] = escapeHtml(val ?? '')
  }
  return mergeBracketTokens(out, bracketVars)
}

function sectionBlocksToHtml(
  sections: TemplateSection[],
  vars: Record<string, string>,
  extraSectionClass?: string
): string {
  return sections
    .map(s => {
      const label = s.label
      const merged = mergeHtmlVars(s.content, vars)
      let bodyHtml: string
      if (isHtmlContent(merged)) {
        bodyHtml = DOMPurify.sanitize(merged, PURIFY_CONFIG) as unknown as string
      } else {
        // Legacy plain text — safe-escape and convert newlines
        bodyHtml = escapeHtml(merged).replace(/\r\n/g, '\n').replace(/\n/g, '<br/>')
      }
      const secClass = extraSectionClass ? `sec ${extraSectionClass}` : 'sec'
      return `<section class="${secClass}"><h2>${escapeHtml(label)}</h2><div class="body">${bodyHtml}</div></section>`
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

  const { headers, bodies, signatures, footers } = partitionAgreementSections(sections)
  const logoBlock = buildLogoImg(logoDataUrl, logoSrcUrl ?? null, invertLogoForPrint)

  const headerExtraHtml =
    headers.length > 0 ? inlineBlocksToHtml(headers, vars) : ''

  const bodyBlocks = sectionBlocksToHtml(bodies, vars)
  const signatureBlocks =
    signatures.length > 0 ? sectionBlocksToHtml(signatures, vars, 'signatures-sec') : ''

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
  .header-block { color: #262626; font-size: 10pt; margin-bottom: 10px; }
  .company { font-size: 14pt; font-weight: 700; letter-spacing: 0.04em; color: #0a0a0a; }
  .tag { font-size: 9pt; color: #525252; margin-top: 4px; font-weight: 500; }
  .sec { page-break-inside: auto; margin-bottom: 16px; }
  h2 {
    font-size: 11pt;
    font-weight: 800;
    margin: 22px 0 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #111111;
    border-bottom: 2px solid #e5e5e5;
    padding-bottom: 5px;
  }
  h3 {
    font-size: 10pt;
    font-weight: 700;
    margin: 14px 0 5px;
    color: #1a1a1a;
  }
  .body { color: #262626; }
  .body p { margin: 0 0 6px; }
  .body ul, .body ol { margin: 6px 0 6px 20px; padding: 0; }
  .body li { margin: 3px 0; }
  .body table {
    border-collapse: collapse;
    width: 100%;
    margin: 8px 0;
    font-size: 10pt;
  }
  .body th, .body td {
    border: 1px solid #d4d4d4;
    padding: 5px 8px;
    text-align: left;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .body th {
    background: #f5f5f5;
    font-weight: 700;
  }
  .body blockquote {
    border-left: 3px solid #d4d4d4;
    padding-left: 10px;
    color: #525252;
    margin: 6px 0;
  }
  .signatures-sec {
    page-break-inside: avoid;
    margin-top: 28px;
    padding-top: 18px;
    border-top: 2px solid #e5e5e5;
  }
  .signatures-sec h2 {
    font-size: 10pt;
    font-weight: 700;
    margin: 0 0 12px;
    text-transform: none;
    letter-spacing: 0.06em;
    color: #0a0a0a;
    border-bottom: 1px solid #e5e5e5;
    padding-bottom: 6px;
  }
  .signatures-sec .body { font-size: 10pt; color: #262626; }
  .signatures-sec .body table {
    border-collapse: collapse;
    width: 100%;
    margin: 10px 0 0;
    border: none;
  }
  .signatures-sec .body td {
    border: none;
    vertical-align: top;
    width: 50%;
    padding: 6px 20px 6px 0;
    font-size: 10pt;
  }
  .signatures-sec .body td:last-child { padding-left: 20px; padding-right: 0; }
  .signatures-sec .body td p { margin: 0 0 6px; }
  .signatures-sec .body td p:first-of-type {
    font-family: ui-monospace, "Cascadia Code", monospace;
    letter-spacing: 0.02em;
    color: #171717;
    margin-bottom: 10px;
  }
  .footer { margin-top: 28px; padding-top: 12px; border-top: 1px solid #f5f5f5; font-size: 8pt; color: #737373; }
  .footer-meta { margin-top: 8px; }
</style></head><body><div class="doc">
<div class="header">${logoBlock}${headerExtraHtml}
<div class="company">${escapeHtml(companyLine)}</div>
${taglineLine ? `<div class="tag">${escapeHtml(taglineLine)}</div>` : ''}
</div>
${bodyBlocks}
${signatureBlocks}
<div class="footer">${footerInner}</div>
</div></body></html>`
}
