const SITE_DEFAULT_OG_TITLE = 'The Office — Artist Management'
const SITE_DEFAULT_DESCRIPTION =
  'Artist management workspace for bookings, outreach, and operations.'

/** Served from /public; build may rewrite to absolute URL via Vite (see vite.config). */
export const SOCIAL_CARD_PATH = '/social-card.png'
export const SOCIAL_CARD_ALT = 'Tony C — Creative Director, Mentor · The Office'

function siteDefaultOgImageUrl(): string {
  const env = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)?.trim()
  if (env) return `${env.replace(/\/$/, '')}${SOCIAL_CARD_PATH}`
  if (typeof window !== 'undefined') return `${window.location.origin}${SOCIAL_CARD_PATH}`
  return SOCIAL_CARD_PATH
}

function setMeta(selectorAttr: 'property' | 'name', key: string, content: string) {
  let el = document.querySelector(`meta[${selectorAttr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(selectorAttr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Sets Open Graph / Twitter description tags to match the active page.
 * Uses the current document.title (from Shell) for og:title. Cleanup on unmount.
 */
export function applySocialPreviewMeta(description: string): () => void {
  const title = document.title
  const imageUrl = siteDefaultOgImageUrl()
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:image', imageUrl)
  setMeta('property', 'og:image:alt', SOCIAL_CARD_ALT)
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', imageUrl)
  setMeta('name', 'twitter:image:alt', SOCIAL_CARD_ALT)
  setMeta('name', 'description', description)

  return () => {
    const defImg = siteDefaultOgImageUrl()
    setMeta('property', 'og:title', SITE_DEFAULT_OG_TITLE)
    setMeta('property', 'og:description', SITE_DEFAULT_DESCRIPTION)
    setMeta('property', 'og:image', defImg)
    setMeta('property', 'og:image:alt', SOCIAL_CARD_ALT)
    setMeta('name', 'twitter:card', 'summary_large_image')
    setMeta('name', 'twitter:title', SITE_DEFAULT_OG_TITLE)
    setMeta('name', 'twitter:description', SITE_DEFAULT_DESCRIPTION)
    setMeta('name', 'twitter:image', defImg)
    setMeta('name', 'twitter:image:alt', SOCIAL_CARD_ALT)
    setMeta('name', 'description', SITE_DEFAULT_DESCRIPTION)
  }
}
