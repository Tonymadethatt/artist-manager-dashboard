import { supabase } from '../supabase'
import type { ArtistEmailType } from '../../types'
import { ARTIST_EMAIL_TYPE_LABELS, VENUE_EMAIL_TYPE_LABELS } from '../../types'
import { CUSTOM_EMAIL_TYPE_PREFIX, parseCustomTemplateId } from './customTemplateId'

export { isQueuedBuiltinArtistEmailType } from './queuedBuiltinArtistEmail'

export type EmailTaskAudienceResolution =
  | { kind: 'client'; source: 'builtin_venue' | 'custom_venue' }
  | { kind: 'artist'; source: 'builtin_artist' | 'custom_artist'; builtinType?: ArtistEmailType }
  | { kind: 'lead'; source: 'custom_lead' }
  | { kind: 'special'; id: 'performance_report_request' }
  | { kind: 'unknown'; reason: 'invalid_custom_id' | 'template_not_found' | 'unsupported_email_type' }

const ARTIST_BUILTIN = new Set<string>(Object.keys(ARTIST_EMAIL_TYPE_LABELS))
const VENUE_BUILTIN = new Set<string>(Object.keys(VENUE_EMAIL_TYPE_LABELS))

/** Sync: classify from `email_type` string only (custom audience needs async). */
export function classifyTaskEmailTypeSync(emailType: string | null | undefined): EmailTaskAudienceResolution | null {
  if (!emailType?.trim()) return null

  if (parseCustomTemplateId(emailType)) {
    return null
  }

  if (emailType === 'performance_report_request') {
    return { kind: 'special', id: 'performance_report_request' }
  }

  if (VENUE_BUILTIN.has(emailType)) {
    return { kind: 'client', source: 'builtin_venue' }
  }

  if (ARTIST_BUILTIN.has(emailType) && emailType !== 'performance_report_request') {
    return { kind: 'artist', source: 'builtin_artist', builtinType: emailType as ArtistEmailType }
  }

  return { kind: 'unknown', reason: 'unsupported_email_type' }
}

/**
 * Full resolution including DB lookup for custom templates.
 */
export async function resolveTaskEmailAudience(
  emailType: string | null | undefined,
  userId: string,
): Promise<EmailTaskAudienceResolution> {
  if (!emailType?.trim()) {
    return { kind: 'unknown', reason: 'unsupported_email_type' }
  }

  if (emailType.startsWith(CUSTOM_EMAIL_TYPE_PREFIX)) {
    const cid = parseCustomTemplateId(emailType)
    if (!cid) return { kind: 'unknown', reason: 'invalid_custom_id' }

    const { data: row } = await supabase
      .from('custom_email_templates')
      .select('audience')
      .eq('id', cid)
      .eq('user_id', userId)
      .maybeSingle()

    if (!row) return { kind: 'unknown', reason: 'template_not_found' }
    if (row.audience === 'venue') return { kind: 'client', source: 'custom_venue' }
    if (row.audience === 'artist') return { kind: 'artist', source: 'custom_artist' }
    if (row.audience === 'lead') return { kind: 'lead', source: 'custom_lead' }
    return { kind: 'unknown', reason: 'unsupported_email_type' }
  }

  const sync = classifyTaskEmailTypeSync(emailType)
  if (sync) return sync
  return { kind: 'unknown', reason: 'unsupported_email_type' }
}

/** Artist-targeted mail (custom or builtin) — no venue/contact required. */
export function isArtistAudienceNoVenueRequired(r: EmailTaskAudienceResolution): boolean {
  return r.kind === 'artist'
}

export function isPerformanceReportSpecial(r: EmailTaskAudienceResolution): r is { kind: 'special'; id: 'performance_report_request' } {
  return r.kind === 'special' && r.id === 'performance_report_request'
}
