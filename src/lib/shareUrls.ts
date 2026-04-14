/** Canonical path for the artist-facing previous-clients list (share this URL). */
export const PREVIOUS_CLIENTS_FORM_PATH = '/forms/previous-clients'

export function previousClientsFormUrl(): string {
  if (typeof window === 'undefined') return PREVIOUS_CLIENTS_FORM_PATH
  return `${window.location.origin}${PREVIOUS_CLIENTS_FORM_PATH}`
}
