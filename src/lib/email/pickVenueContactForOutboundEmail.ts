/**
 * Pick a single venue contact for outbound email. Callers must pass rows ordered by product rules
 * (e.g. `order('created_at', { ascending: true })`); first row with a non-empty email wins.
 */
export function pickVenueContactForOutboundEmail<T extends { email: string | null }>(
  contacts: T[],
): T | null {
  for (const c of contacts) {
    const e = c.email?.trim()
    if (e) return c
  }
  return null
}
