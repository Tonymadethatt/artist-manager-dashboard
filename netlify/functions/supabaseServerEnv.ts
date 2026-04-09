/**
 * Serverless env for Supabase. Netlify Functions run on Linux: env *names* are case-sensitive.
 * The UI may show friendly names, but `process.env` must match — or we try common variants below.
 *
 * URL: prefer explicit SUPABASE_URL, then VITE_SUPABASE_URL (Vite-focused docs), then lowercase/typo aliases.
 * Key: prefer SUPABASE_SERVICE_ROLE_KEY, then lowercase or SUPERBASE_* typos.
 */
const URL_ENV_KEYS = [
  'SUPABASE_URL',
  'VITE_SUPABASE_URL',
  'supabase_url',
  'vite_supabase_url',
  'SUPERBASE_URL',
  'superbase_url',
] as const

const SERVICE_ROLE_ENV_KEYS = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'supabase_service_role_key',
  'SUPERBASE_SERVICE_ROLE_KEY',
  'superbase_service_role_key',
] as const

function pickFirstEnv(keys: readonly string[]): { value: string | undefined; sourceKey: string | undefined } {
  for (const key of keys) {
    const v = process.env[key]?.trim()
    if (v) return { value: v, sourceKey: key }
  }
  return { value: undefined, sourceKey: undefined }
}

export function getSupabaseServerEnv(): {
  supabaseUrl: string | undefined
  serviceRoleKey: string | undefined
  urlSourceKey: string | undefined
  serviceRoleSourceKey: string | undefined
} {
  const { value: supabaseUrl, sourceKey: urlSourceKey } = pickFirstEnv(URL_ENV_KEYS)
  const { value: serviceRoleKey, sourceKey: serviceRoleSourceKey } = pickFirstEnv(SERVICE_ROLE_ENV_KEYS)
  return { supabaseUrl, serviceRoleKey, urlSourceKey, serviceRoleSourceKey }
}
