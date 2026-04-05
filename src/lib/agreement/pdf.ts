import html2pdf from 'html2pdf.js'

/**
 * Render full HTML document string to PDF blob via html2pdf (html2canvas + jsPDF).
 * Uses a hidden iframe so styles apply consistently.
 */
export async function htmlDocumentToPdfBlob(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('title', 'pdf-source')
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:816px;height:1200px;border:0;visibility:hidden;'
  iframe.srcdoc = html
  document.body.appendChild(iframe)

  try {
    await new Promise<void>((resolve, reject) => {
      const done = () => resolve()
      iframe.onload = done
      iframe.onerror = () => reject(new Error('iframe failed'))
      window.setTimeout(done, 250)
    })

    const doc = iframe.contentDocument
    const body = doc?.body
    if (!body) throw new Error('PDF iframe has no body')

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: 'agreement.pdf',
      image: { type: 'jpeg' as const, quality: 0.92 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm' as const, format: 'letter' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }

    const blob = (await html2pdf()
      .from(body)
      .set(opt)
      .outputPdf('blob')) as Blob

    if (!(blob instanceof Blob)) throw new Error('PDF output was not a Blob')
    return blob
  } finally {
    iframe.remove()
  }
}
