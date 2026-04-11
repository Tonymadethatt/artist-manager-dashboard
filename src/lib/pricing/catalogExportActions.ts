import type { PricingCatalogDoc } from '@/types'
import { serializePricingCatalogDoc } from '@/lib/pricing/coercePricingCatalogDoc'

export function triggerDownloadCatalogJson(doc: PricingCatalogDoc, filename = 'pricing-catalog.json'): void {
  const blob = new Blob([serializePricingCatalogDoc(doc)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyCatalogJsonToClipboard(doc: PricingCatalogDoc): Promise<void> {
  await navigator.clipboard.writeText(serializePricingCatalogDoc(doc).trimEnd())
}
