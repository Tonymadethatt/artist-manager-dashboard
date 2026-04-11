/**
 * Repair legacy agreement PDF rows: canonical pdf_share_slug, storage path, pdf_public_url,
 * then sync deals.agreement_url for matching agreement_generated_file_id.
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: SITE_ORIGIN or URL (default https://artist-manager-dashboard.netlify.app)
 *
 * Usage:
 *   node scripts/backfill-agreement-pdf-slugs.mjs --dry-run
 *   node scripts/backfill-agreement-pdf-slugs.mjs --apply
 *
 * Idempotent: safe to re-run. Storage: copy to new path before delete; never delete before upload succeeds.
 */

import { createClient } from '@supabase/supabase-js'

const MAX_SLUG_LEN = 220
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isUuidOnlyStem(stem) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(stem || ''))
}

function isValidSlug(s) {
  const t = String(s || '').trim().toLowerCase()
  return t.length > 0 && t.length <= MAX_SLUG_LEN && SLUG_RE.test(t)
}

/** Canonical path stem: hyphen slug only, not UUID-only keys (matches app inference rules). */
function isCanonicalPathStem(stem) {
  return Boolean(stem && isValidSlug(stem) && !isUuidOnlyStem(stem))
}

function makeAgreementPdfSlug(fileName, fileId) {
  const stem =
    String(fileName || 'agreement')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'agreement'
  const idPart = fileId.replace(/-/g, '').slice(0, 12)
  return `${stem}-${idPart}`
}

function stemFromPath(storagePath) {
  if (!storagePath) return null
  const part = storagePath.split('/').pop()?.replace(/\.pdf$/i, '') ?? ''
  return part || null
}

function uniqueSlug(name, id, taken) {
  let candidate = makeAgreementPdfSlug(name, id)
  let n = 0
  while (taken.has(candidate)) {
    n += 1
    candidate = makeAgreementPdfSlug(`${name}-${n}`, id)
  }
  taken.add(candidate)
  return candidate
}

const dryRun = process.argv.includes('--dry-run')
const apply = process.argv.includes('--apply')

const supabaseUrl = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteOrigin = (
  process.env.SITE_ORIGIN ||
  process.env.URL ||
  'https://artist-manager-dashboard.netlify.app'
).replace(/\/$/, '')

if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

if (!dryRun && !apply) {
  console.error('Pass --dry-run or --apply')
  process.exit(1)
}

if (dryRun && apply) {
  console.error('Use only one of --dry-run or --apply')
  process.exit(1)
}

const sb = createClient(supabaseUrl, serviceKey)
const BUCKET = 'agreement-pdfs'

async function main() {
  const { data: rows, error: qErr } = await sb
    .from('generated_files')
    .select('id,user_id,name,pdf_storage_path,pdf_share_slug,pdf_public_url,output_format')
    .eq('output_format', 'pdf')

  if (qErr) throw qErr

  const taken = new Set(
    (rows || []).map(r => r.pdf_share_slug?.trim().toLowerCase()).filter(s => s && isValidSlug(s)),
  )

  for (const row of rows || []) {
    const userId = row.user_id
    const path = row.pdf_storage_path
    const stem = stemFromPath(path || '')
    const slugCol = row.pdf_share_slug?.trim().toLowerCase() || ''

    if (!userId || !path) {
      if (slugCol && !isValidSlug(slugCol)) {
        console.log(`[skip] ${row.id} invalid pdf_share_slug and no pdf_storage_path`)
      }
      continue
    }

    const stemValid = isCanonicalPathStem(stem)
    const canonicalPath = stemValid ? `${userId}/${stem.toLowerCase()}.pdf` : null

    // Case A: object key already canonical; fix column + public URL only
    if (stemValid && canonicalPath && path === canonicalPath) {
      if (!slugCol || !isValidSlug(slugCol) || slugCol !== stem.toLowerCase()) {
        const newSlug = stem.toLowerCase()
        const shareUrl = `${siteOrigin}/agreements/${newSlug}`
        console.log(`[Case A] ${row.id} pdf_share_slug -> ${newSlug}`)
        if (apply) {
          const { error: uErr } = await sb
            .from('generated_files')
            .update({ pdf_share_slug: newSlug, pdf_public_url: shareUrl })
            .eq('id', row.id)
          if (uErr) console.error('  update failed', uErr)
        }
      }
      continue
    }

    // Case B: non-canonical storage path or invalid stem — copy to new key
    const newSlug = uniqueSlug(row.name || 'agreement', row.id, taken)
    const newPath = `${userId}/${newSlug}.pdf`
    const shareUrl = `${siteOrigin}/agreements/${newSlug}`

    if (path === newPath && slugCol === newSlug) {
      continue
    }

    console.log(`[Case B] ${row.id} ${path} -> ${newPath} (${newSlug})`)

    if (!apply) continue

    const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(path)
    if (dlErr || !blob) {
      console.error('  download failed', dlErr?.message || dlErr)
      continue
    }

    const buf = Buffer.from(await blob.arrayBuffer())
    const { error: upErr } = await sb.storage.from(BUCKET).upload(newPath, buf, {
      contentType: 'application/pdf',
      upsert: false,
    })
    if (upErr) {
      console.error('  upload failed', upErr.message)
      continue
    }

    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(newPath)

    const { error: uErr } = await sb
      .from('generated_files')
      .update({
        pdf_storage_path: newPath,
        pdf_share_slug: newSlug,
        pdf_public_url: shareUrl || pub?.publicUrl,
      })
      .eq('id', row.id)

    if (uErr) {
      console.error('  DB update failed', uErr)
      await sb.storage.from(BUCKET).remove([newPath])
      continue
    }

    if (path !== newPath) {
      const { error: rmErr } = await sb.storage.from(BUCKET).remove([path])
      if (rmErr) console.error('  old path remove failed (orphan)', path, rmErr.message)
    }
  }

  const { data: files } = await sb
    .from('generated_files')
    .select('id,pdf_share_slug')
    .eq('output_format', 'pdf')

  for (const f of files || []) {
    const s = f.pdf_share_slug?.trim().toLowerCase()
    if (!s || !isValidSlug(s)) continue
    const url = `${siteOrigin}/agreements/${s}`

    if (!apply) {
      const { count, error: cErr } = await sb
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('agreement_generated_file_id', f.id)
      if (cErr) console.error('count', cErr)
      else if (count) console.log(`[deals] would update ${count} row(s) for file ${f.id} -> ${url}`)
      continue
    }

    const { error: dErr } = await sb
      .from('deals')
      .update({ agreement_url: url })
      .eq('agreement_generated_file_id', f.id)
    if (dErr) console.error('deals sync failed', f.id, dErr)
  }

  console.log(apply ? 'Done (applied).' : 'Dry run complete.')
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
