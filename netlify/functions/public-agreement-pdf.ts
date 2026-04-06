import type { Handler } from '@netlify/functions'
import { createClient } from '@supabase/supabase-js'

/**
 * GET /.netlify/functions/public-agreement-pdf?slug=...
 * Proxied from /agreements/:slug so share links stay on the site domain.
 */
const handler: Handler = async event => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method not allowed', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  const raw = event.queryStringParameters?.slug
  if (!raw) {
    return { statusCode: 400, body: 'Missing slug', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  let slug = ''
  try {
    slug = decodeURIComponent(raw).trim().toLowerCase()
  } catch {
    return { statusCode: 400, body: 'Invalid slug', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  if (slug.length > 220 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { statusCode: 400, body: 'Invalid slug', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return { statusCode: 500, body: 'Server misconfigured', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey)

  const selectCols = 'pdf_storage_path, output_format, name'

  let row: { pdf_storage_path: string | null; output_format: string; name: string } | null = null

  const primary = await supabase
    .from('generated_files')
    .select(selectCols)
    .eq('pdf_share_slug', slug)
    .eq('output_format', 'pdf')
    .maybeSingle()

  if (!primary.error && primary.data?.pdf_storage_path) {
    row = primary.data as typeof row
  } else {
    const pathPattern = `%/${slug}.pdf`
    const fallback = await supabase
      .from('generated_files')
      .select(selectCols)
      .eq('output_format', 'pdf')
      .ilike('pdf_storage_path', pathPattern)
      .limit(1)
      .maybeSingle()
    if (!fallback.error && fallback.data?.pdf_storage_path) {
      row = fallback.data as typeof row
    }
  }

  if (!row?.pdf_storage_path) {
    return { statusCode: 404, body: 'Not found', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  const { data: blob, error: dlErr } = await supabase.storage
    .from('agreement-pdfs')
    .download(row.pdf_storage_path)

  if (dlErr || !blob) {
    return { statusCode: 404, body: 'Not found', headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
  }

  const buf = Buffer.from(await blob.arrayBuffer())

  const stem =
    (row.name || '')
      .replace(/[^a-zA-Z0-9\s\-_]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .slice(0, 120) || 'agreement'
  const asciiFilename = /^[a-zA-Z0-9._-]+$/.test(stem) ? `${stem}.pdf` : `${slug.slice(0, 80)}.pdf`
  const contentDisposition = `inline; filename="${asciiFilename}"`

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'public, max-age=300',
    },
    body: buf.toString('base64'),
    isBase64Encoded: true,
  }
}

export { handler }
