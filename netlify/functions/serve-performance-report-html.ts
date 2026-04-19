import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { loadPerformanceReportPublicForToken } from './performanceReportPublicLoad'
import {
  showReportSharePageTitle,
  showReportShareDescription,
  showReportGenericShareHead,
  showReportCanonicalPath,
  SHOW_REPORT_SOCIAL_IMAGE_PATH,
  SHOW_REPORT_SOCIAL_IMAGE_ALT,
} from '../../src/lib/showReportShareMeta'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPerformanceReportTokenUuid(token: string): boolean {
  return UUID_RE.test(token.trim())
}

function headerGet(
  headers: Record<string, string | undefined> | null | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined
  const want = name.toLowerCase()
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === want && typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

/** Origin only, no trailing slash — env fallback. */
function resolveNetlifyPublicOrigin(): string {
  const raw =
    process.env.URL?.trim() ||
    process.env.DEPLOY_PRIME_URL?.trim() ||
    process.env.DEPLOY_URL?.trim() ||
    process.env.VITE_PUBLIC_SITE_URL?.trim() ||
    ''
  if (raw) return raw.replace(/\/$/u, '')
  return 'https://localhost:8888'
}

/**
 * Public hostname for og:url / og:image. Netlify often sets `rawUrl` to the *function* URL; the browser
 * Host / X-Forwarded-Host is the domain the user shared (custom domain, www, etc.).
 */
function originFromForwardedHeaders(event: HandlerEvent): string | null {
  const hostRaw =
    headerGet(event.headers, 'x-forwarded-host') ?? headerGet(event.headers, 'host')
  if (!hostRaw) return null
  const host = hostRaw.split(',')[0].trim().split(':')[0]
  if (!host) return null
  let proto = (
    headerGet(event.headers, 'x-forwarded-proto') ?? 'https'
  )
    .split(',')[0]
    .trim()
    .toLowerCase()
  if (proto !== 'http' && proto !== 'https') proto = 'https'
  return `${proto}://${host}`
}

function originFromRawUrl(event: HandlerEvent): string | null {
  const raw = event.rawUrl?.trim()
  if (!raw) return null
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return u.origin
  } catch {
    return null
  }
}

function resolveShellOrigin(event: HandlerEvent): string {
  return (
    originFromForwardedHeaders(event) ??
    originFromRawUrl(event) ??
    resolveNetlifyPublicOrigin()
  )
}

async function fetchPublishedIndexHtml(primaryOrigin: string): Promise<Response | null> {
  const fallbacks = [`${primaryOrigin}/index.html`, `${primaryOrigin}/`]
  const envFallback = resolveNetlifyPublicOrigin()
  if (envFallback !== primaryOrigin) {
    fallbacks.push(`${envFallback}/index.html`, `${envFallback}/`)
  }
  const tried = new Set<string>()
  for (const url of fallbacks) {
    if (tried.has(url)) continue
    tried.add(url)
    try {
      const res = await fetch(url, { redirect: 'follow' })
      const ct = res.headers.get('content-type') ?? ''
      if (res.ok && ct.includes('text/html')) return res
    } catch {
      /* try next */
    }
  }
  return null
}

function escTitleText(s: string): string {
  return s.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}

function escAttr(s: string): string {
  return s
    .replace(/&/gu, '&amp;')
    .replace(/"/gu, '&quot;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
}

function extractOgSiteName(html: string): string | null {
  const m1 = html.match(
    /<meta\s[^>]*\bproperty\s*=\s*["']og:site_name["'][^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*>/iu,
  )
  if (m1?.[1]) return m1[1]
  const m2 = html.match(
    /<meta\s[^>]*\bcontent\s*=\s*["']([^"']*)["'][^>]*\bproperty\s*=\s*["']og:site_name["'][^>]*>/iu,
  )
  return m2?.[1] ?? null
}

/** Remove default SPA social + description + canonical so we inject one authoritative block (Facebook-safe). */
function stripConflictingHeadTags(html: string): string {
  let out = html
  const stripPatterns = [
    /\s*<meta\s[^>]*\bproperty\s*=\s*["']og:[^"']+["'][^>]*>\s*/giu,
    /\s*<meta\s[^>]*\bname\s*=\s*["']twitter:[^"']+["'][^>]*>\s*/giu,
    /\s*<meta\s[^>]*\bname\s*=\s*["']description["'][^>]*>\s*/giu,
    /\s*<link\s[^>]*\brel\s*=\s*["']canonical["'][^>]*>\s*/giu,
  ]
  for (const p of stripPatterns) {
    out = out.replace(p, '\n')
  }
  return out
}

function injectPerformanceReportSocialBlock(
  html: string,
  opts: {
    title: string
    description: string
    canonicalUrl: string
    origin: string
    siteName: string
    fbAppId: string | null
  },
): string {
  const imageAbs = `${opts.origin.replace(/\/$/u, '')}${SHOW_REPORT_SOCIAL_IMAGE_PATH}`
  const lines: string[] = [
    `<link rel="canonical" href="${escAttr(opts.canonicalUrl)}" />`,
    `<meta name="description" content="${escAttr(opts.description)}" />`,
    `<meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${escAttr(opts.siteName)}" />`,
    `<meta property="og:title" content="${escAttr(opts.title)}" />`,
    `<meta property="og:description" content="${escAttr(opts.description)}" />`,
    `<meta property="og:image" content="${escAttr(imageAbs)}" />`,
    `<meta property="og:image:alt" content="${escAttr(SHOW_REPORT_SOCIAL_IMAGE_ALT)}" />`,
  ]
  if (imageAbs.startsWith('https://')) {
    lines.push(`<meta property="og:image:secure_url" content="${escAttr(imageAbs)}" />`)
  }
  const fb = opts.fbAppId?.trim()
  if (fb) {
    lines.push(`<meta property="fb:app_id" content="${escAttr(fb)}" />`)
  }
  lines.push(
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escAttr(opts.title)}" />`,
    `<meta name="twitter:description" content="${escAttr(opts.description)}" />`,
    `<meta name="twitter:image" content="${escAttr(imageAbs)}" />`,
    `<meta name="twitter:image:alt" content="${escAttr(SHOW_REPORT_SOCIAL_IMAGE_ALT)}" />`,
  )
  const block = `    ${lines.join('\n    ')}\n`
  if (!/<\/head>/iu.test(html)) return html + block
  return html.replace(/<\/head>/iu, `${block}</head>`)
}

function patchPerformanceReportHtml(
  html: string,
  opts: {
    title: string
    description: string
    canonicalUrl: string
    origin: string
    fbAppId: string | null
  },
): string {
  const siteName = extractOgSiteName(html) ?? 'The Office — Artist Management'
  let out = stripConflictingHeadTags(html)
  out = out.replace(/<title>[^<]*<\/title>/iu, `<title>${escTitleText(opts.title)}</title>`)
  return injectPerformanceReportSocialBlock(out, { ...opts, siteName })
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const tokenRaw = event.queryStringParameters?.token?.trim() ?? ''
  const origin = resolveShellOrigin(event)

  const indexRes = await fetchPublishedIndexHtml(origin)
  if (!indexRes) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Bad gateway: could not load app shell.',
    }
  }

  const htmlShell = await indexRes.text()
  if (!htmlShell.trim()) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Bad gateway: empty app shell.',
    }
  }

  const generic = showReportGenericShareHead()
  let title = generic.title
  let description = generic.description
  let canonicalUrl = `${origin}/performance-report`
  if (tokenRaw) {
    canonicalUrl = `${origin}/performance-report/${tokenRaw}`
  }

  if (tokenRaw && isPerformanceReportTokenUuid(tokenRaw)) {
    canonicalUrl = `${origin}${showReportCanonicalPath(tokenRaw)}`
    const { supabaseUrl, serviceRoleKey } = getSupabaseServerEnv()
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey)
      const loaded = await loadPerformanceReportPublicForToken(supabase, tokenRaw)
      if (loaded) {
        const fields = {
          dealDescription: loaded.dealDescription,
          venueName: loaded.venueName,
          eventDate: loaded.eventDate,
          submitted: loaded.submitted,
        }
        title = showReportSharePageTitle(fields)
        description = showReportShareDescription(fields)
      }
    }
  }

  const fbAppId =
    process.env.FACEBOOK_APP_ID?.trim() ||
    process.env.VITE_FACEBOOK_APP_ID?.trim() ||
    null

  const body = patchPerformanceReportHtml(htmlShell, {
    title,
    description,
    canonicalUrl,
    origin,
    fbAppId,
  })

  const headers: Record<string, string> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'public, max-age=300',
  }

  /** Some crawlers issue HEAD; return the same HTML as GET so Open Graph is never "empty". */
  return {
    statusCode: 200,
    headers,
    body,
  }
}

export { handler }
