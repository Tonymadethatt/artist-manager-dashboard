const SITE_DEFAULT_OG_TITLE = 'The Office — Artist Management'
const SITE_DEFAULT_DESCRIPTION =
  'Artist management workspace for bookings, outreach, and operations.'

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
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:type', 'website')
  setMeta('name', 'twitter:card', 'summary')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'description', description)

  return () => {
    setMeta('property', 'og:title', SITE_DEFAULT_OG_TITLE)
    setMeta('property', 'og:description', SITE_DEFAULT_DESCRIPTION)
    setMeta('name', 'twitter:title', SITE_DEFAULT_OG_TITLE)
    setMeta('name', 'twitter:description', SITE_DEFAULT_DESCRIPTION)
    setMeta('name', 'description', SITE_DEFAULT_DESCRIPTION)
  }
}
