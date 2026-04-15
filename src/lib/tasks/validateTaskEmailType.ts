import { supabase } from '@/lib/supabase'
import { parseCustomTemplateId } from '@/lib/email/customTemplateId'
import { ARTIST_EMAIL_TYPE_LABELS, VENUE_EMAIL_TYPE_LABELS } from '@/types'

export async function validateTaskEmailType(
  emailType: string | null | undefined,
  userId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (emailType == null || !String(emailType).trim()) return { ok: true }
  const t = String(emailType)
  if (t in VENUE_EMAIL_TYPE_LABELS || t in ARTIST_EMAIL_TYPE_LABELS) return { ok: true }
  const cid = parseCustomTemplateId(t)
  if (cid) {
    const { data, error } = await supabase
      .from('custom_email_templates')
      .select('id')
      .eq('id', cid)
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, message: 'Custom template was deleted or is inaccessible.' }
    }
    return { ok: true }
  }
  return { ok: false, message: 'Unknown email type.' }
}
