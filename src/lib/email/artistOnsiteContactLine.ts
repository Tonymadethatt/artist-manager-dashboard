import type { Contact } from '../../types'
import { contactRoleForDisplay } from '../contacts/contactTitles'

/** Single line for artist gig email / calendar (calendar may omit phone). */
export function formatArtistOnsiteContactLine(
  c: Pick<Contact, 'name' | 'phone' | 'title_key' | 'role'>,
  options?: { includePhone?: boolean },
): string {
  const name = c.name?.trim() || 'On-site contact'
  const role = contactRoleForDisplay(c)
  const phone = c.phone?.trim()
  const head = role ? `${name} — ${role}` : name
  if (options?.includePhone === false || !phone) return head
  return `${head} · ${phone}`
}
