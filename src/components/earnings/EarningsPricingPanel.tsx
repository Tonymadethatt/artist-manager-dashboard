import { useEffect, useRef, useState, useCallback } from 'react'
import { Plus, Trash2, Loader2, Upload, Download, Copy, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { nanoid } from '@/lib/nanoid'
import type {
  PricingAddon,
  PricingCatalogDoc,
  PricingDiscount,
  PricingPackage,
  PricingService,
  PricingSurcharge,
} from '@/types'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PricingCatalogHook } from '@/hooks/usePricingCatalog'
import {
  parsePricingCatalogFromJsonText,
  serializePricingCatalogDoc,
} from '@/lib/pricing/coercePricingCatalogDoc'

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 border-b border-neutral-800 pb-1.5">
      {children}
    </h3>
  )
}

/** Static templates shipped in `public/reference/` (served from site root + Vite base). */
function publicReferenceUrl(pathFromReferenceFolder: string): string {
  const base = import.meta.env.BASE_URL
  const trimmedBase = base.endsWith('/') ? base.slice(0, -1) : base
  const path = pathFromReferenceFolder.startsWith('/') ? pathFromReferenceFolder : `/${pathFromReferenceFolder}`
  return `${trimmedBase}${path}`.replace(/([^:]\/)\/+/g, '$1')
}

async function fetchPublicReferenceAsDownload(pathFromReferenceFolder: string, downloadAs: string): Promise<void> {
  const res = await fetch(publicReferenceUrl(pathFromReferenceFolder))
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const blob = await res.blob()
  const a = document.createElement('a')
  const href = URL.createObjectURL(blob)
  a.href = href
  a.download = downloadAs
  a.click()
  URL.revokeObjectURL(href)
}

function catalogSummaryLines(doc: PricingCatalogDoc): string[] {
  const p = doc.policies
  return [
    `Policies: deposit ${p.defaultDepositPercent}% · tax ${p.salesTaxPercent}% · min billable ${p.minimumBillableHours}h`,
    `Packages: ${doc.packages.length} · Services: ${doc.services.length} · Add-ons: ${doc.addons.length}`,
    `Discounts: ${doc.discounts.length} · Surcharges: ${doc.surcharges.length}`,
  ]
}

export function EarningsPricingPanel({ catalog }: { catalog: PricingCatalogHook }) {
  const { doc, setDocAndAutosave, replaceAndSave, loading, saving, error, lastSavedAt } = catalog
  const toastRef = useRef<string | null>(null)

  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importPreview, setImportPreview] = useState<PricingCatalogDoc | null>(null)
  const [importParseError, setImportParseError] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [templateError, setTemplateError] = useState<string | null>(null)

  const resetImportDialog = useCallback(() => {
    setImportText('')
    setImportPreview(null)
    setImportParseError(null)
  }, [])

  const runImportPreview = useCallback(() => {
    const result = parsePricingCatalogFromJsonText(importText)
    if (!result.ok) {
      setImportPreview(null)
      setImportParseError(result.message)
      return
    }
    setImportParseError(null)
    setImportPreview(result.doc)
  }, [importText])

  const confirmImport = useCallback(async () => {
    if (!importPreview) return
    const { error: err } = await replaceAndSave(importPreview)
    if (!err) {
      setImportOpen(false)
      resetImportDialog()
    }
  }, [importPreview, replaceAndSave, resetImportDialog])

  const exportDownload = useCallback(() => {
    setExportError(null)
    const blob = new Blob([serializePricingCatalogDoc(doc)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pricing-catalog.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [doc])

  const exportCopy = useCallback(async () => {
    setExportError(null)
    const text = serializePricingCatalogDoc(doc).trimEnd()
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      setExportError('Could not copy to clipboard. Try Export file or copy from a downloaded JSON.')
    }
  }, [doc])

  const downloadAiSpec = useCallback(async () => {
    setTemplateError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/pricing-catalog-v1-import-spec.md',
        'pricing-catalog-v1-import-spec.md',
      )
    } catch {
      setTemplateError('Could not download the spec file. Check your connection or try again.')
    }
  }, [])

  const downloadExampleCatalog = useCallback(async () => {
    setTemplateError(null)
    try {
      await fetchPublicReferenceAsDownload(
        '/reference/pricing-catalog.v1.example.json',
        'pricing-catalog.v1.example.json',
      )
    } catch {
      setTemplateError('Could not download the example JSON. Check your connection or try again.')
    }
  }, [])

  useEffect(() => {
    if (!lastSavedAt || saving) return
    const key = lastSavedAt.toISOString()
    if (toastRef.current === key) return
    toastRef.current = key
    const t = window.setTimeout(() => {
      const el = document.getElementById('earnings-pricing-saved-toast')
      if (el) {
        el.classList.remove('opacity-0')
        window.setTimeout(() => el.classList.add('opacity-0'), 2000)
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [lastSavedAt, saving])

  const patchPolicies = (partial: Partial<PricingCatalogDoc['policies']>) => {
    setDocAndAutosave(d => ({
      ...d,
      policies: { ...d.policies, ...partial },
    }))
  }

  const updatePackage = (id: string, partial: Partial<PricingPackage>) => {
    setDocAndAutosave(d => ({
      ...d,
      packages: d.packages.map(p => (p.id === id ? { ...p, ...partial } : p)),
    }))
  }

  const addPackage = () => {
    setDocAndAutosave(d => ({
      ...d,
      packages: [
        ...d.packages,
        { id: nanoid(), name: 'New package', price: 0, hoursIncluded: 4, bullets: [] },
      ],
    }))
  }

  const removePackage = (id: string) => {
    setDocAndAutosave(d => ({ ...d, packages: d.packages.filter(p => p.id !== id) }))
  }

  const updateService = (id: string, partial: Partial<PricingService>) => {
    setDocAndAutosave(d => ({
      ...d,
      services: d.services.map(s => (s.id === id ? { ...s, ...partial } : s)),
    }))
  }

  const addService = () => {
    setDocAndAutosave(d => ({
      ...d,
      services: [
        ...d.services,
        {
          id: nanoid(),
          name: 'New rate',
          price: 0,
          priceType: 'per_hour',
          dayType: 'any',
        },
      ],
    }))
  }

  const removeService = (id: string) => {
    setDocAndAutosave(d => ({ ...d, services: d.services.filter(s => s.id !== id) }))
  }

  const updateAddon = (id: string, partial: Partial<PricingAddon>) => {
    setDocAndAutosave(d => ({
      ...d,
      addons: d.addons.map(a => (a.id === id ? { ...a, ...partial } : a)),
    }))
  }

  const addAddon = () => {
    setDocAndAutosave(d => ({
      ...d,
      addons: [
        ...d.addons,
        { id: nanoid(), name: 'New add-on', price: 0, priceType: 'flat_fee' },
      ],
    }))
  }

  const removeAddon = (id: string) => {
    setDocAndAutosave(d => ({ ...d, addons: d.addons.filter(a => a.id !== id) }))
  }

  const updateDiscount = (id: string, partial: Partial<PricingDiscount>) => {
    setDocAndAutosave(d => ({
      ...d,
      discounts: d.discounts.map(x => (x.id === id ? { ...x, ...partial } : x)),
    }))
  }

  const addDiscount = () => {
    setDocAndAutosave(d => ({
      ...d,
      discounts: [...d.discounts, { id: nanoid(), name: 'Discount', percent: 10 }],
    }))
  }

  const removeDiscount = (id: string) => {
    setDocAndAutosave(d => ({ ...d, discounts: d.discounts.filter(x => x.id !== id) }))
  }

  const updateSurcharge = (id: string, partial: Partial<PricingSurcharge>) => {
    setDocAndAutosave(d => ({
      ...d,
      surcharges: d.surcharges.map(x => (x.id === id ? { ...x, ...partial } : x)),
    }))
  }

  const addSurcharge = () => {
    setDocAndAutosave(d => ({
      ...d,
      surcharges: [...d.surcharges, { id: nanoid(), name: 'Surcharge', multiplier: 1.1 }],
    }))
  }

  const removeSurcharge = (id: string) => {
    setDocAndAutosave(d => ({ ...d, surcharges: d.surcharges.filter(x => x.id !== id) }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-500 gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading pricing catalog…
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div
        id="earnings-pricing-saved-toast"
        className="opacity-0 pointer-events-none fixed top-4 right-4 z-50 px-3 py-1.5 rounded border border-neutral-700 bg-neutral-900 text-xs text-neutral-300 transition-opacity duration-300"
        aria-live="polite"
      >
        Saved
      </div>
      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {saving && (
        <p className="text-[11px] text-neutral-500 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <SectionTitle>Import / export</SectionTitle>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          Export JSON to edit offline, then import to replace the entire catalog. Keep line-item{' '}
          <code className="text-neutral-400">id</code> values when possible so existing deal pricing snapshots stay aligned;
          new or changed ids may require reopening logged deals.
        </p>
        <p className="text-[11px] text-neutral-500 leading-relaxed">
          <span className="text-neutral-400 font-medium">For another AI:</span> download the Markdown spec (rules + limits)
          and the example JSON, then have it produce a catalog file you import here.
        </p>
        {exportError ? (
          <p className="text-xs text-red-400">{exportError}</p>
        ) : null}
        {templateError ? (
          <p className="text-xs text-red-400">{templateError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void exportCopy()}>
            <Copy className="h-3.5 w-3.5" /> Copy JSON
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportDownload}>
            <Download className="h-3.5 w-3.5" /> Download JSON
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => {
              resetImportDialog()
              setImportOpen(true)
            }}
          >
            <Upload className="h-3.5 w-3.5" /> Import…
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1 border-t border-neutral-800">
          <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void downloadAiSpec()}>
            <FileText className="h-3.5 w-3.5" /> AI import spec (.md)
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => void downloadExampleCatalog()}
          >
            <Download className="h-3.5 w-3.5" /> Example catalog (.json)
          </Button>
        </div>
      </div>

      <Dialog
        open={importOpen}
        onOpenChange={open => {
          setImportOpen(open)
          if (!open) resetImportDialog()
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle>Import pricing catalog</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0">
            <div className="rounded-md border border-neutral-800 bg-neutral-950/60 px-3 py-2 space-y-2">
              <p className="text-[11px] text-neutral-500">
                Need the full rules or a starter file for an AI? Download the spec and example (same as Import / export
                above).
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => void downloadAiSpec()}
                >
                  <FileText className="h-3.5 w-3.5" /> AI spec
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={() => void downloadExampleCatalog()}
                >
                  <Download className="h-3.5 w-3.5" /> Example JSON
                </Button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-neutral-400">Paste JSON</Label>
              <textarea
                className={cn(
                  'w-full min-h-[160px] rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm font-mono',
                )}
                value={importText}
                onChange={e => {
                  setImportText(e.target.value)
                  setImportPreview(null)
                  setImportParseError(null)
                }}
                placeholder='{ "v": 1, "policies": { ... }, ... }'
                spellCheck={false}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={runImportPreview}>
                Review import
              </Button>
              <label className="text-xs text-neutral-400 cursor-pointer border border-neutral-700 rounded-md px-2 py-1.5 hover:bg-neutral-800">
                Choose file
                <input
                  type="file"
                  accept="application/json,.json"
                  className="sr-only"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    const reader = new FileReader()
                    reader.onload = () => {
                      const t = typeof reader.result === 'string' ? reader.result : ''
                      setImportText(t)
                      setImportPreview(null)
                      setImportParseError(null)
                    }
                    reader.onerror = () => {
                      setImportParseError('Could not read file.')
                      setImportPreview(null)
                    }
                    reader.readAsText(file, 'UTF-8')
                  }}
                />
              </label>
            </div>
            {importParseError ? (
              <p className="rounded border border-red-900/50 bg-red-950/20 px-3 py-2 text-sm text-red-300 whitespace-pre-wrap break-words">
                {importParseError}
              </p>
            ) : null}
            {importPreview ? (
              <div className="rounded border border-neutral-700 bg-neutral-950/80 px-3 py-2 space-y-1.5">
                <p className="text-xs font-medium text-neutral-300">Ready to replace your catalog with:</p>
                <ul className="text-[11px] text-neutral-400 list-disc pl-4 space-y-0.5">
                  {catalogSummaryLines(importPreview).map(line => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <DialogFooter className="gap-2 sm:gap-0 flex-col sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!importPreview || saving}
              onClick={() => void confirmImport()}
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> Saving…
                </>
              ) : (
                'Confirm replace catalog'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 space-y-3">
        <SectionTitle>Policies</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1">
            <Label className="text-neutral-400">Default deposit %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={doc.policies.defaultDepositPercent}
              onChange={e => patchPolicies({ defaultDepositPercent: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-neutral-400">Sales tax % (quotes)</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={doc.policies.salesTaxPercent}
              onChange={e => patchPolicies({ salesTaxPercent: Number(e.target.value) || 0 })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-neutral-400">Minimum billable hours</Label>
            <Input
              type="number"
              min={0}
              value={doc.policies.minimumBillableHours}
              onChange={e => patchPolicies({ minimumBillableHours: Number(e.target.value) || 0 })}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Packages</SectionTitle>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addPackage}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-3">
          {doc.packages.length === 0 ? (
            <p className="text-xs text-neutral-500">No packages yet.</p>
          ) : (
            doc.packages.map(pkg => (
              <div key={pkg.id} className="rounded border border-neutral-800 p-3 space-y-2">
                <div className="flex justify-end">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removePackage(pkg.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    value={pkg.name}
                    onChange={e => updatePackage(pkg.id, { name: e.target.value })}
                    placeholder="Name"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={pkg.price}
                      onChange={e => updatePackage(pkg.id, { price: Number(e.target.value) || 0 })}
                      placeholder="Price $"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={pkg.hoursIncluded}
                      onChange={e => updatePackage(pkg.id, { hoursIncluded: Number(e.target.value) || 0 })}
                      placeholder="Hrs incl."
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-neutral-500">Inclusions (one per line)</Label>
                  <textarea
                    className={cn(
                      'w-full min-h-[72px] rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1.5 text-sm',
                    )}
                    value={(pkg.bullets ?? []).join('\n')}
                    onChange={e =>
                      updatePackage(pkg.id, {
                        bullets: e.target.value.split('\n').map(s => s.trim()).filter(Boolean),
                      })
                    }
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Hourly / flat services</SectionTitle>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addService}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        {doc.services.length === 0 ? (
          <p className="text-xs text-neutral-500">No services — add at least one to log deals.</p>
        ) : (
          <div className="space-y-2">
            {doc.services.map(s => (
              <div key={s.id} className="rounded border border-neutral-800 p-2 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-4 space-y-1">
                  <Input value={s.name} onChange={e => updateService(s.id, { name: e.target.value })} placeholder="Name" />
                </div>
                <div className="sm:col-span-2">
                  <Input
                    type="number"
                    min={0}
                    value={s.price}
                    onChange={e => updateService(s.id, { price: Number(e.target.value) || 0 })}
                    placeholder="$"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Select
                    value={s.priceType}
                    onValueChange={v => updateService(s.id, { priceType: v as PricingService['priceType'] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_hour">Per hour</SelectItem>
                      <SelectItem value="flat_rate">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <Select
                    value={s.dayType}
                    onValueChange={v => updateService(s.id, { dayType: v as PricingService['dayType'] })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekday">Weekday</SelectItem>
                      <SelectItem value="weekend">Weekend</SelectItem>
                      <SelectItem value="any">Any</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeService(s.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Add-ons</SectionTitle>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addAddon}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {doc.addons.map(a => (
            <div key={a.id} className="rounded border border-neutral-800 p-2 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-4">
                <Input value={a.name} onChange={e => updateAddon(a.id, { name: e.target.value })} placeholder="Name" />
              </div>
              <div className="sm:col-span-2">
                <Input
                  type="number"
                  min={0}
                  value={a.price}
                  onChange={e => updateAddon(a.id, { price: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="sm:col-span-4">
                <Select
                  value={a.priceType}
                  onValueChange={v => updateAddon(a.id, { priceType: v as PricingAddon['priceType'] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat_fee">Flat</SelectItem>
                    <SelectItem value="per_event">Per event</SelectItem>
                    <SelectItem value="per_artist">Per artist</SelectItem>
                    <SelectItem value="per_sq_ft">Per sq ft</SelectItem>
                    <SelectItem value="per_effect">Per effect</SelectItem>
                    <SelectItem value="per_setup">Per setup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-1 flex justify-end">
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeAddon(a.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-red-400" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Discounts (% off, stack at deal time)</SectionTitle>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addDiscount}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {doc.discounts.map(x => (
            <div key={x.id} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                value={x.name}
                onChange={e => updateDiscount(x.id, { name: e.target.value })}
              />
              <Input
                type="number"
                className="w-20"
                min={0}
                max={100}
                value={x.percent}
                onChange={e => updateDiscount(x.id, { percent: Number(e.target.value) || 0 })}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeDiscount(x.id)}>
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <SectionTitle>Surcharges (multiplier on subtotal after add-ons)</SectionTitle>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={addSurcharge}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <p className="text-[10px] text-neutral-600">e.g. 1.35 = +35%</p>
        <div className="space-y-2">
          {doc.surcharges.map(x => (
            <div key={x.id} className="flex gap-2 items-center">
              <Input
                className="flex-1"
                value={x.name}
                onChange={e => updateSurcharge(x.id, { name: e.target.value })}
              />
              <Input
                type="number"
                className="w-24"
                min={1}
                step={0.01}
                value={x.multiplier}
                onChange={e => updateSurcharge(x.id, { multiplier: Number(e.target.value) || 1 })}
              />
              <Button type="button" variant="ghost" size="icon" onClick={() => removeSurcharge(x.id)}>
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
