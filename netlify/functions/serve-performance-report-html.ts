import type { Handler, HandlerEvent } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseServerEnv } from './supabaseServerEnv'
import { loadPerformanceReportPublicForToken } from './performanceReportPublicLoad'
import {
  showReportSharePageTitle,
  showReportShareDescription,
  showReportGenericShareHead,
  showReportCanonicalPath,
} from '../../src/lib/showReportShareMeta'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isPerformanceReportTokenUuid(token: string): boolean {
  return UUID_RE.test(token.trim())
}

/** Origin only, no trailing slash — env fallback when `rawUrl` has no host. */
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
 * Prefer the URL the crawler (or user) actually requested so og:url / og:image match the shared link
 * (custom domain vs *.netlify.app). Critical for WhatsApp/Facebook rich previews.
 */
function originFromEvent(event: HandlerEvent): string | null {
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
  return originFromEvent(event) ?? resolveNetlifyPublicOrigin()
}

async function fetchPublishedIndexHtml(primaryOrigin: string): Promise<Response | null> {
  const fallbacks = [
    `${primaryOrigin}/index.html`,
    `${primaryOrigin}/`,
  ]
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

/** Escape text inside `<title>…</title>`. */
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

/** Normalize void-meta closing: `/>` or `>` with optional whitespace. */
const META_VOID_END = String.raw`\s*\/?>`

const OG_URL_PROP = /property\s*=\s*["']og:url["']/iu
const FB_APP_ID_PROP = /property\s*=\s*["']fb:app_id["']/iu

/** Facebook Sharing Debugger expects `og:url`; inject if regex patches missed. Optional `fb:app_id` when env is set. */
function injectRequiredFacebookHeadTags(
  html: string,
  opts: { canonicalUrl: string; fbAppId?: string | null },
): string {
  const lines: string[] = []
  if (!OG_URL_PROP.test(html)) {
    lines.push(`<meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`)
  }
  const app = opts.fbAppId?.trim()
  if (app && !FB_APP_ID_PROP.test(html)) {
    lines.push(`<meta property="fb:app_id" content="${escAttr(app)}" />`)
  }
  if (!lines.length) return html
  return html.replace(/<\/head>/iu, `    ${lines.join('\n    ')}\n</head>`)
}

/**
 * Facebook rejects relative `og:image`. Catch every `content="/social-card.png"` variant after structured
 * replaces so no crawler ever sees a path-only URL.
 */
function forceAbsoluteSocialCardPngEverywhere(html: string, origin: string): string {
  const root = origin.replace(/\/$/u, '')
  const abs = escAttr(`${root}/social-card.png`)
  return html
    .replace(/content="\/social-card\.png"/giu, `content="${abs}"`)
    .replace(/content='\/social-card\.png'/giu, `content='${abs}'`)
}

function patchIndexHtmlHead(
  html: string,
  opts: {
    title: string
    description: string
    canonicalUrl: string
    origin: string
    fbAppId?: string | null
  },
): string {
  const imageAbs = `${opts.origin}/social-card.png`
  const imageEsc = escAttr(imageAbs)

  let out = html.replace(/<title>[^<]*<\/title>/u, `<title>${escTitleText(opts.title)}</title>`)

  if (!/rel="canonical"/u.test(out)) {
    out = out.replace(
      /<link rel="icon"/u,
      `<link rel="canonical" href="${escAttr(opts.canonicalUrl)}" />\n    <link rel="icon"`,
    )
  }

  out = out.replace(
    new RegExp(`<meta name="description" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta name="description" content="${escAttr(opts.description)}" />`,
  )

  out = out.replace(
    new RegExp(`<meta property="og:title" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta property="og:title" content="${escAttr(opts.title)}" />`,
  )
  out = out.replace(
    new RegExp(`<meta property="og:description" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta property="og:description" content="${escAttr(opts.description)}" />`,
  )

  if (OG_URL_PROP.test(out)) {
    out = out.replace(
      new RegExp(`<meta property="og:url" content="[^"]*"${META_VOID_END}`, 'u'),
      `<meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`,
    )
  } else {
    out = out.replace(
      new RegExp(`<meta property="og:type" content="website"${META_VOID_END}`, 'u'),
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`,
    )
  }

  out = out.replace(
    new RegExp(`<meta property="og:image" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta property="og:image" content="${imageEsc}" />`,
  )
  if (opts.origin.startsWith('https://') && !/property="og:image:secure_url"/u.test(out)) {
    out = out.replace(
      new RegExp(`<meta property="og:image" content="([^"]*)"${META_VOID_END}`, 'u'),
      `<meta property="og:image" content="$1" />\n    <meta property="og:image:secure_url" content="$1" />`,
    )
  }

  out = out.replace(
    new RegExp(`<meta name="twitter:title" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta name="twitter:title" content="${escAttr(opts.title)}" />`,
  )
  out = out.replace(
    new RegExp(`<meta name="twitter:description" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta name="twitter:description" content="${escAttr(opts.description)}" />`,
  )
  out = out.replace(
    new RegExp(`<meta name="twitter:image" content="[^"]*"${META_VOID_END}`, 'u'),
    `<meta name="twitter:image" content="${imageEsc}" />`,
  )

  out = injectRequiredFacebookHeadTags(out, {
    canonicalUrl: opts.canonicalUrl,
    fbAppId: opts.fbAppId,
  })
  return forceAbsoluteSocialCardPngEverywhere(out, opts.origin)
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

  const body = patchIndexHtmlHead(htmlShell, {
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

  if (event.httpMethod === 'HEAD') {
    return { statusCode: 200, headers, body: '' }
  }

  return {
    statusCode: 200,
    headers,
    body,
  }
}

export { handler }
