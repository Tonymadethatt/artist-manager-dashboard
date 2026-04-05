import { supabase } from '@/lib/supabase'

const BUCKET = 'template-logos'
const MAX_SIZE_MB = 5
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function fileExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return map[mimeType] ?? 'png'
}

function uuid(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 18)
}

export type UploadLogoResult =
  | { url: string; path: string; error?: never }
  | { url?: never; path?: never; error: Error }

/**
 * Upload a logo image to the `template-logos` Storage bucket.
 * Returns the public URL for use as `header_logo_url` on a template section.
 * Path: `{userId}/{uuid}.{ext}` — matched by bucket RLS policies.
 */
export async function uploadTemplateLogo(file: File): Promise<UploadLogoResult> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { error: new Error('Unsupported file type. Use PNG, JPG, WebP, or GIF.') }
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { error: new Error(`File too large (max ${MAX_SIZE_MB} MB).`) }
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: new Error('Not authenticated') }

  const ext = fileExtension(file.type)
  const path = `${user.id}/${uuid()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false })

  if (upErr) return { error: upErr }

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: pub.publicUrl, path }
}

/**
 * Remove a previously uploaded logo by its storage path.
 * Silently succeeds if the object does not exist.
 */
export async function deleteTemplateLogo(path: string): Promise<void> {
  await supabase.storage.from(BUCKET).remove([path])
}
