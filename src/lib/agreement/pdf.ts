import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/** Margins: top, left, bottom, right (mm) — matches prior html2pdf configuration. */
const MARGIN_MM: [number, number, number, number] = [10, 10, 10, 10]

/** Ensure images are decoded before html2canvas runs. */
function waitForImages(root: HTMLElement, timeoutMs: number): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  if (imgs.length === 0) return Promise.resolve()

  const perImg = (img: HTMLImageElement) =>
    new Promise<void>(resolve => {
      const done = () => resolve()
      if (img.complete && img.naturalWidth > 0) {
        done()
        return
      }
      img.addEventListener('load', done, { once: true })
      img.addEventListener('error', done, { once: true })
      if (typeof img.decode === 'function') {
        img.decode().then(done).catch(done)
      }
    })

  return Promise.race([
    Promise.all(imgs.map(perImg)).then(() => undefined),
    new Promise<void>(resolve => {
      window.setTimeout(resolve, timeoutMs)
    }),
  ])
}

/**
 * Render full HTML document string to PDF via html2canvas + jsPDF.
 *
 * We intentionally do NOT use html2pdf.js's element pipeline: it deep-clones the
 * source node into `document.body` before capturing. That clone lives in the host
 * app's document, so it loses the iframe's `<style>` and inherits the dashboard's
 * dark theme — producing light-on-white, black canvas, or otherwise broken PDFs
 * while the preview iframe still looks correct.
 *
 * Instead: keep the document in a sandbox iframe and run html2canvas on
 * `iframe.contentDocument.body` so computed styles match the preview.
 */
export async function htmlDocumentToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'pdf-source')
  iframe.setAttribute('sandbox', 'allow-same-origin')
  iframe.style.cssText =
    'position:fixed;left:0;top:0;width:816px;height:1200px;border:0;' +
    'opacity:0;pointer-events:none;z-index:-1;'

  iframe.srcdoc = html
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const done = () => resolve()
      iframe.onload = done
      iframe.onerror = () => reject(new Error('iframe failed'))
      window.setTimeout(done, 500)
    })

    const doc = iframe.contentDocument
    const bodyEl = doc?.body
    if (!bodyEl) throw new Error('PDF iframe has no body')

    await doc.fonts?.ready?.catch(() => undefined)
    await waitForImages(bodyEl, 8000)

    await new Promise<void>(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })

    const canvas = await html2canvas(bodyEl, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: doc.documentElement.scrollWidth,
      windowHeight: Math.max(doc.documentElement.scrollHeight, bodyEl.scrollHeight),
      onclone: (_clonedDoc, el) => {
        const root = el.ownerDocument?.documentElement
        if (root) {
          root.style.setProperty('background', '#ffffff', 'important')
          root.style.setProperty('color', '#111111', 'important')
          root.style.setProperty('color-scheme', 'light', 'important')
        }
        el.style.setProperty('background', '#ffffff', 'important')
        el.style.setProperty('color', '#111111', 'important')
      },
    })

    const pdf = new jsPDF({
      unit: 'mm',
      format: 'letter',
      orientation: 'portrait',
    })

    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const [mt, ml, , mr] = MARGIN_MM
    const innerWidth = pageWidth - ml - mr
    const innerHeight = pageHeight - mt - MARGIN_MM[2]
    const ratio = innerHeight / innerWidth

    const pxFullHeight = canvas.height
    const pxPageHeight = Math.floor(canvas.width * ratio)
    const nPages = Math.max(1, Math.ceil(pxFullHeight / pxPageHeight))

    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = canvas.width
    pageCanvas.height = pxPageHeight
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) throw new Error('Could not get canvas context')

    const jpegQuality = 0.92

    for (let page = 0; page < nPages; page++) {
      let pdfPageHeightMm = innerHeight
      if (page === nPages - 1 && pxFullHeight % pxPageHeight !== 0) {
        const rem = pxFullHeight % pxPageHeight
        pageCanvas.height = rem
        pdfPageHeightMm = (rem * innerWidth) / canvas.width
      } else {
        pageCanvas.height = pxPageHeight
        pdfPageHeightMm = innerHeight
      }

      const w = pageCanvas.width
      const h = pageCanvas.height
      pageCtx.fillStyle = '#ffffff'
      pageCtx.fillRect(0, 0, w, h)
      pageCtx.drawImage(canvas, 0, page * pxPageHeight, w, h, 0, 0, w, h)

      const imgData = pageCanvas.toDataURL('image/jpeg', jpegQuality)
      if (page > 0) pdf.addPage()
      pdf.addImage(imgData, 'JPEG', ml, mt, innerWidth, pdfPageHeightMm)
    }

    const blob = pdf.output('blob')
    if (!(blob instanceof Blob)) throw new Error('PDF output was not a Blob')
    return blob
  } finally {
    iframe.remove()
  }
}
