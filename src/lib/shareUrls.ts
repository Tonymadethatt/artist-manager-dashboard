/** Canonical path for the artist-facing previous-clients list (share this URL). */
export const PREVIOUS_CLIENTS_FORM_PATH = '/forms/previous-clients'

/**
 * Absolute URL for the public previous-clients page.
 * Prefer `VITE_PUBLIC_SITE_URL` (e.g. production Netlify URL) so links copied from localhost still point at the live form.
 */
export function previousClientsFormUrl(): string {
  const env = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  if (env) {
    return `${env.replace(/\/$/, '')}${PREVIOUS_CLIENTS_FORM_PATH}`
  }
  if (typeof window === 'undefined') return PREVIOUS_CLIENTS_FORM_PATH
  return `${window.location.origin}${PREVIOUS_CLIENTS_FORM_PATH}`
}

/** Copy share URL with Clipboard API fallback (non-HTTPS / permission denied). */
export async function copyPreviousClientsFormUrlToClipboard(): Promise<{ ok: boolean; url: string }> {
  const url = previousClientsFormUrl()
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url)
      return { ok: true, url }
    }
  } catch {
    /* secure context / denied */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = url
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.left = '-9999px'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return { ok, url }
  } catch {
    return { ok: false, url }
  }
}
