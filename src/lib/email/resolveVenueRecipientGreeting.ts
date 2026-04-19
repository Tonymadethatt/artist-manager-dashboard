/**
 * Venue client emails must never use the recipient's email address as their display / salutation name.
 */

function looksLikeBareEmail(s: string): boolean {
  const t = s.trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)
}

/** First word for "Hi {x}," — uses "there" when no safe personal name is available. */
export function resolveVenueRecipientSalutationFirstName(input: {
  name?: string | null
  email: string
}): string {
  const em = input.email.trim()
  const raw = (input.name ?? '').trim()
  if (!raw) return 'there'
  if (em && raw.toLowerCase() === em.toLowerCase()) return 'there'
  if (looksLikeBareEmail(raw)) return 'there'
  const first = raw.split(/\s+/)[0] ?? ''
  return first || 'there'
}

/**
 * Value for `recipient.name` in send payloads: real name only, or empty string (never the email).
 * Rendering uses {@link resolveVenueRecipientSalutationFirstName} for greetings.
 */
export function resolveVenueRecipientDisplayNameForPayload(input: {
  name?: string | null
  email: string
}): string {
  const em = input.email.trim()
  const raw = (input.name ?? '').trim()
  if (!raw) return ''
  if (em && raw.toLowerCase() === em.toLowerCase()) return ''
  if (looksLikeBareEmail(raw)) return ''
  return raw
}

/** For queue / history UI: show "Name · email" only when we have a non-email display name. */
export function venueContactDisplayNameForList(
  contact: { name?: string | null } | null | undefined,
  recipientEmail: string,
): string | null {
  const n = resolveVenueRecipientDisplayNameForPayload({
    name: contact?.name ?? null,
    email: recipientEmail,
  })
  return n || null
}
