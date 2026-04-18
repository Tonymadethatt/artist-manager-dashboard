/**
 * Resend POST https://api.resend.com/emails returns `{ id: string }` on success.
 * Netlify send functions forward that as `resend_message_id` for clients and the queue worker.
 */

export function parseResendMessageIdFromResendApiJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const id = (json as { id?: unknown }).id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}

export function parseResendMessageIdFromSendFunctionJson(json: unknown): string | null {
  if (!json || typeof json !== 'object') return null
  const id = (json as { resend_message_id?: unknown }).resend_message_id
  return typeof id === 'string' && id.trim().length > 0 ? id.trim() : null
}

export async function parseResendMessageIdFromSendFunctionResponse(res: Response): Promise<string | null> {
  try {
    const json = await res.json()
    return parseResendMessageIdFromSendFunctionJson(json)
  } catch {
    return null
  }
}
