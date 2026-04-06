import { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowLeft, Download, Save, FileText, Monitor, FileOutput } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useTemplates } from '@/hooks/useTemplates'
import { useVenues, useVenueDetail } from '@/hooks/useVenues'
import { useFiles } from '@/hooks/useFiles'
import { useArtistProfile } from '@/hooks/useArtistProfile'
import { useDeals } from '@/hooks/useDeals'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  extractVariableNames,
  buildAgreementPrefill,
  renderAgreementText,
  renderAgreementHtmlDocument,
  resolveAgreementLogo,
  getSiteOrigin,
  htmlDocumentToPdfBlob,
  sanitizeFilenameStem,
} from '@/lib/agreement'

export default function FileBuilder() {
  const navigate = useNavigate()
  const { templates, loading: tplLoading } = useTemplates()
  const { venues } = useVenues()
  const { profile } = useArtistProfile()
  const { deals } = useDeals()
  const { addTextFile, addPdfFile } = useFiles()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [selectedDealId, setSelectedDealId] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [savingText, setSavingText] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savedText, setSavedText] = useState(false)
  const [savedPdf, setSavedPdf] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** When multiple venue contacts: null = use primary (email-first) heuristic. */
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null)

  const { contacts } = useVenueDetail(selectedVenueId || null)
  const primaryContact = useMemo(
    () => contacts.find(c => c.email) ?? contacts[0] ?? null,
    [contacts]
  )

  const mergeContact = useMemo(() => {
    if (contacts.length === 0) return null
    if (contacts.length === 1) return contacts[0]
    const id = selectedContactId ?? primaryContact?.id ?? contacts[0]?.id
    if (!id) return contacts[0] ?? null
    return contacts.find(c => c.id === id) ?? contacts[0] ?? null
  }, [contacts, selectedContactId, primaryContact])

  useEffect(() => {
    setSelectedContactId(null)
  }, [selectedVenueId])

  const showToast = (msg: string, type: 'ok' | 'err') => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
    setToast({ msg, type })
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current)
  }, [])

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const variables = useMemo(
    () => (selectedTemplate ? extractVariableNames(selectedTemplate.sections) : []),
    [selectedTemplate]
  )

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id)
    setVars({})
    setSavedText(false)
    setSavedPdf(false)
    const tpl = templates.find(t => t.id === id)
    if (tpl && !fileName) setFileName(`${tpl.name} — `)
  }

  const setVar = (key: string, value: string) => {
    setVars(prev => ({ ...prev, [key]: value }))
    setSavedText(false)
    setSavedPdf(false)
  }

  useEffect(() => {
    if (!selectedTemplate || variables.length === 0) return
    const venue = selectedVenueId ? venues.find(v => v.id === selectedVenueId) ?? null : null
    const deal = selectedDealId ? deals.find(d => d.id === selectedDealId) ?? null : null
    const pre = buildAgreementPrefill(venue, profile, deal, mergeContact)
    setVars(prev => {
      const next = { ...prev }
      for (const key of variables) {
        if (pre[key] && !next[key]?.trim()) next[key] = pre[key]
      }
      return next
    })
  }, [
    selectedVenueId,
    selectedDealId,
    selectedTemplate,
    profile,
    venues,
    deals,
    mergeContact,
    variables,
  ])

  const rendered = selectedTemplate ? renderAgreementText(selectedTemplate.sections, vars) : ''

  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewHtml('')
      return
    }
    let cancelled = false
    setPreviewLoading(true)
    const run = async () => {
      const origin = getSiteOrigin()
      const logo = await resolveAgreementLogo(origin, selectedTemplate.sections)
      if (cancelled) return
      const companyLine = profile?.company_name?.trim() || profile?.artist_name || 'Agreement'
      const tagline = profile?.tagline?.trim() || null
      const generatedAtLabel = `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`
      const html = renderAgreementHtmlDocument({
        sections: selectedTemplate.sections,
        vars,
        companyLine,
        taglineLine: tagline,
        logoDataUrl: logo.logoDataUrl,
        logoSrcUrl: logo.logoSrcUrl,
        invertLogoForPrint: logo.invertForPrint,
        generatedAtLabel,
      })
      setPreviewHtml(html)
      setPreviewLoading(false)
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [selectedTemplate, vars, profile])

  const buildPdfHtml = async () => {
    if (!selectedTemplate) throw new Error('No template')
    const origin = getSiteOrigin()
    const logo = await resolveAgreementLogo(origin, selectedTemplate.sections)
    const companyLine = profile?.company_name?.trim() || profile?.artist_name || 'Agreement'
    const tagline = profile?.tagline?.trim() || null
    const generatedAtLabel = `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`
    return renderAgreementHtmlDocument({
      sections: selectedTemplate.sections,
      vars,
      companyLine,
      taglineLine: tagline,
      logoDataUrl: logo.logoDataUrl,
      logoSrcUrl: logo.logoSrcUrl,
      invertLogoForPrint: logo.invertForPrint,
      generatedAtLabel,
    })
  }

  const handleDownloadTxt = () => {
    if (!rendered) return
    const blob = new Blob([rendered], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${sanitizeFilenameStem(fileName || 'document')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadPdfOnly = async () => {
    if (!selectedTemplate || !rendered.trim()) return
    setSavingPdf(true)
    try {
      // Always rebuild HTML from current vars/template — previewHtml can be stale for one
      // render cycle after edits while previewLoading is still false.
      const html = await buildPdfHtml()
      const blob = await htmlDocumentToPdfBlob(html)
      const u = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = u
      a.download = `${sanitizeFilenameStem(fileName || 'document')}.pdf`
      a.click()
      URL.revokeObjectURL(u)
      showToast('PDF downloaded', 'ok')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PDF generation failed', 'err')
    } finally {
      setSavingPdf(false)
    }
  }

  const handleSaveText = async () => {
    if (!rendered || !fileName.trim()) return
    setSavingText(true)
    const { error } = await addTextFile({
      name: fileName.trim(),
      content: rendered,
      template_id: selectedTemplateId || null,
      venue_id: selectedVenueId || null,
      deal_id: selectedDealId || null,
    })
    setSavingText(false)
    if (error) {
      showToast(error.message || 'Save failed', 'err')
      return
    }
    setSavedText(true)
    showToast('Saved text file', 'ok')
  }

  const handleSavePdf = async () => {
    if (!selectedTemplate || !rendered.trim() || !fileName.trim()) return
    setSavingPdf(true)
    setSavedPdf(false)
    try {
      const html = await buildPdfHtml()
      const blob = await htmlDocumentToPdfBlob(html)
      const { error } = await addPdfFile({
        name: fileName.trim(),
        content: rendered,
        template_id: selectedTemplateId || null,
        venue_id: selectedVenueId || null,
        deal_id: selectedDealId || null,
        pdfBlob: blob,
      })
      if (error) {
        showToast(error.message || 'Could not save PDF', 'err')
        return
      }
      setSavedPdf(true)
      showToast('PDF saved to Files', 'ok')
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'PDF generation failed', 'err')
    } finally {
      setSavingPdf(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto relative px-4 sm:px-5 lg:px-6 pb-8">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg border ${
            toast.type === 'ok'
              ? 'bg-neutral-900 border-emerald-500/30 text-emerald-400'
              : 'bg-neutral-900 border-red-500/30 text-red-400'
          }`}
          role="status"
        >
          {toast.msg}
        </div>
      )}

      <button
        type="button"
        onClick={() => navigate('/files')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-5 sm:mb-6"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" />
        Back to files
      </button>

      <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-start">
        <div className="flex-1 min-w-0 space-y-6 w-full max-w-full">
          <section
            className={cn(
              'bg-neutral-900 border border-neutral-800 rounded-lg',
              'p-4 sm:p-5 space-y-5 sm:space-y-6'
            )}
            aria-labelledby="file-builder-config-heading"
          >
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                Configuration
              </p>
              <h2 id="file-builder-config-heading" className="text-base font-semibold text-neutral-100">
                Generate file
              </h2>
              <p className="text-xs text-neutral-500 leading-relaxed max-w-2xl">
                Choose a template and optional links. Save plain text or a branded PDF to Files (public link for agreement emails).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-x-5 md:gap-y-4">
              <div className="space-y-1.5 min-w-0">
                <Label className="text-neutral-300">Template *</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={tplLoading ? 'Loading…' : 'Select a template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 min-w-0">
                <Label className="text-neutral-300">Venue (optional)</Label>
                <Select
                  value={selectedVenueId || '__none__'}
                  onValueChange={v => setSelectedVenueId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Link to a venue" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No venue</SelectItem>
                    {venues.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedVenueId && contacts.length > 1 && (
              <div className="space-y-1.5 min-w-0">
                <Label className="text-neutral-300">Contact for merge fields</Label>
                <Select
                  value={selectedContactId ?? primaryContact?.id ?? contacts[0]?.id ?? ''}
                  onValueChange={id => setSelectedContactId(id)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select contact" />
                  </SelectTrigger>
                  <SelectContent>
                    {contacts.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                        {c.company ? ` · ${c.company}` : ''}
                        {c.role ? ` (${c.role})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-neutral-600 leading-snug">
                  Defaults to the first contact with an email. Choose another to fill contact tokens.
                </p>
              </div>
            )}

            <div className="space-y-1.5 min-w-0">
              <Label className="text-neutral-300">Deal (optional)</Label>
              <Select
                value={selectedDealId || '__none__'}
                onValueChange={v => setSelectedDealId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Link generated file to a deal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No deal</SelectItem>
                  {deals.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.description}{d.venue ? ` — ${d.venue.name}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-neutral-600 leading-snug pt-0.5">
                Stored on the file record. Use Files to copy the PDF URL into a deal when needed.
              </p>
            </div>

            <Separator className="bg-neutral-800" />

            <div className="space-y-1.5 min-w-0">
              <Label className="text-neutral-300">File name *</Label>
              <Input
                value={fileName}
                onChange={e => { setFileName(e.target.value); setSavedText(false); setSavedPdf(false) }}
                placeholder="e.g. Blue Room Agreement — March 2026"
                className="w-full"
              />
            </div>
          </section>

          {selectedTemplate && variables.length > 0 && (
            <section
              className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden"
              aria-labelledby="file-builder-vars-heading"
            >
              <div className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-neutral-800/90">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                  Merge fields
                </p>
                <h3 id="file-builder-vars-heading" className="text-sm font-semibold text-neutral-100">
                  Variables
                </h3>
                <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                  {variables.length} token{variables.length !== 1 ? 's' : ''} in this template. Venue, deal, and contact pre-fill empty fields.
                </p>
                {variables.includes('company_name') && !profile?.company_name?.trim() && (
                  <p className="text-[11px] text-amber-600/95 mt-2 leading-snug">
                    Set <span className="font-medium text-neutral-300">Company name</span> in Settings to pre-fill{' '}
                    <code className="text-neutral-400">{'{{company_name}}'}</code>.
                  </p>
                )}
              </div>
              <div className="p-4 sm:p-5 pt-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                  {variables.map(key => (
                    <div key={key} className="space-y-1.5 min-w-0">
                      <Label className="font-mono text-[11px] text-neutral-400 truncate block">
                        {'{{'}{key}{'}}'}
                      </Label>
                      <Input
                        value={vars[key] ?? ''}
                        onChange={e => setVar(key, e.target.value)}
                        placeholder={`Value for ${key}`}
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {selectedTemplate && variables.length === 0 && (
            <p className="text-xs text-neutral-500 px-0.5 leading-relaxed">
              This template has no variables — output is generated as-is.
            </p>
          )}

          {selectedTemplate && (
            <section
              className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col"
              aria-labelledby="file-builder-output-heading"
            >
              <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-neutral-800 bg-neutral-950/80">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
                  <div className="space-y-1 min-w-0 flex-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">
                      Merged output
                    </p>
                    <h3 id="file-builder-output-heading" className="text-sm font-semibold text-neutral-100 flex items-center gap-2">
                      <FileOutput className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
                      Plain text
                    </h3>
                    <p className="text-[11px] text-neutral-600 leading-relaxed max-w-md">
                      Same merge as PDF. Save to Files or download; PDF preview updates on the right.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 w-full lg:w-auto lg:min-w-[min(100%,280px)] lg:max-w-md shrink-0">
                    <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 w-full">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-center gap-1.5 h-9 text-xs"
                        onClick={handleSaveText}
                        disabled={!fileName.trim() || savingText || savedText}
                      >
                        <Save className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{savedText ? 'Saved' : savingText ? 'Saving…' : 'Save text'}</span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full justify-center gap-1.5 h-9 text-xs"
                        onClick={handleSavePdf}
                        disabled={!fileName.trim() || !rendered.trim() || savingPdf || savedPdf}
                      >
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{savedPdf ? 'PDF saved' : savingPdf ? 'PDF…' : 'Save PDF'}</span>
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 w-full">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-center gap-1.5 h-9 text-xs"
                        onClick={handleDownloadTxt}
                        disabled={!rendered}
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">.txt</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full justify-center gap-1.5 h-9 text-xs"
                        onClick={handleDownloadPdfOnly}
                        disabled={!rendered.trim() || savingPdf}
                      >
                        <Download className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">.pdf</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-3 sm:p-4 flex-1 min-h-0 flex flex-col">
                <pre
                  className={cn(
                    'flex-1 min-h-[min(280px,40vh)] max-h-[min(400px,50vh)] sm:max-h-[360px]',
                    'overflow-auto rounded-md border border-neutral-800/80 bg-neutral-950/70',
                    'p-3 sm:p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed'
                  )}
                >
                  {rendered || <span className="text-neutral-600">Select a template to see output…</span>}
                </pre>
              </div>
            </section>
          )}
        </div>

        {selectedTemplate && (
          <div className="w-full lg:w-[min(100%,400px)] lg:shrink-0 lg:max-w-[440px]">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col h-[min(580px,70vh)] min-h-[360px] lg:sticky lg:top-4">
              <div className="px-4 sm:px-5 py-3 border-b border-neutral-800 flex items-center gap-2 shrink-0 bg-neutral-950/50">
                <Monitor className="h-3.5 w-3.5 text-neutral-500" />
                <span className="text-xs font-medium text-neutral-400">PDF preview</span>
                {previewLoading && (
                  <span className="text-[10px] text-neutral-600 ml-auto">Updating…</span>
                )}
              </div>
              <div className="flex-1 min-h-0 bg-white">
                <iframe
                  srcDoc={previewHtml}
                  title="Agreement PDF preview"
                  className="w-full h-full min-h-[400px] border-0"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
