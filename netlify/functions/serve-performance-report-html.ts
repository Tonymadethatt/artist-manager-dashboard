import type { Handler } from '@netlify/functions'
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

/** Origin only, no trailing slash — for fetch base and absolute URLs. */
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

function absolutizeSocialCardMeta(html: string, origin: string): string {
  const abs = `${origin}/social-card.png`
  return html
    .replace(/content="\/social-card\.png"/gu, `content="${escAttr(abs)}"`)
    .replace(/content='\/social-card\.png'/gu, `content='${escAttr(abs)}'`)
}

function patchIndexHtmlHead(
  html: string,
  opts: { title: string; description: string; canonicalUrl: string; origin: string },
): string {
  let out = html.replace(/<title>[^<]*<\/title>/u, `<title>${escTitleText(opts.title)}</title>`)

  out = out.replace(
    /<meta name="description" content="[^"]*" \/>/u,
    `<meta name="description" content="${escAttr(opts.description)}" />`,
  )

  out = out.replace(
    /<meta property="og:title" content="[^"]*" \/>/u,
    `<meta property="og:title" content="${escAttr(opts.title)}" />`,
  )
  out = out.replace(
    /<meta property="og:description" content="[^"]*" \/>/u,
    `<meta property="og:description" content="${escAttr(opts.description)}" />`,
  )

  if (/property="og:url"/u.test(out)) {
    out = out.replace(
      /<meta property="og:url" content="[^"]*" \/>/u,
      `<meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`,
    )
  } else {
    out = out.replace(
      /<meta property="og:type" content="website" \/>/u,
      `<meta property="og:type" content="website" />\n    <meta property="og:url" content="${escAttr(opts.canonicalUrl)}" />`,
    )
  }

  out = out.replace(
    /<meta name="twitter:title" content="[^"]*" \/>/u,
    `<meta name="twitter:title" content="${escAttr(opts.title)}" />`,
  )
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*" \/>/u,
    `<meta name="twitter:description" content="${escAttr(opts.description)}" />`,
  )

  out = absolutizeSocialCardMeta(out, opts.origin)
  return out
}

const handler: Handler = async (event) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed' }
  }

  const tokenRaw = event.queryStringParameters?.token?.trim() ?? ''
  const origin = resolveNetlifyPublicOrigin()

  let indexRes: Response
  try {
    indexRes = await fetch(`${origin}/index.html`)
  } catch {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Bad gateway: could not load app shell.',
    }
  }

  if (!indexRes.ok || !indexRes.headers.get('content-type')?.includes('text/html')) {
    return {
      statusCode: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: 'Bad gateway: app shell unavailable.',
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

  const body = patchIndexHtmlHead(htmlShell, {
    title,
    description,
    canonicalUrl,
    origin,
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
    body,
  }
}

export { handler }
