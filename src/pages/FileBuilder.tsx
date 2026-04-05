import { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowLeft, Download, Save, FileText, Monitor } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
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

  const { contacts } = useVenueDetail(selectedVenueId || null)
  const primaryContact = useMemo(
    () => contacts.find(c => c.email) ?? contacts[0] ?? null,
    [contacts]
  )

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
    const pre = buildAgreementPrefill(venue, profile, deal, primaryContact)
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
    primaryContact,
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
    <div className="max-w-7xl mx-auto relative px-1">
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
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to files
      </button>

      <div className="flex flex-col lg:flex-row gap-5 lg:gap-6 lg:items-start">
        <div className="flex-1 min-w-0 space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-semibold text-neutral-100">Generate file</h2>
            <p className="text-xs text-neutral-500">
              Save a text copy for prompts, or generate a branded PDF stored in Files (public link for deal agreement emails).
            </p>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Template *</Label>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder={tplLoading ? 'Loading…' : 'Select a template'} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Venue (optional)</Label>
                <Select
                  value={selectedVenueId || '__none__'}
                  onValueChange={v => setSelectedVenueId(v === '__none__' ? '' : v)}
                >
                  <SelectTrigger>
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

            <div className="space-y-1">
              <Label>Deal (optional)</Label>
              <Select
                value={selectedDealId || '__none__'}
                onValueChange={v => setSelectedDealId(v === '__none__' ? '' : v)}
              >
                <SelectTrigger>
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
              <p className="text-[10px] text-neutral-600">Stored on the file record for reference; use Files to paste PDF URL into a deal.</p>
            </div>

            <div className="space-y-1">
              <Label>File name *</Label>
              <Input
                value={fileName}
                onChange={e => { setFileName(e.target.value); setSavedText(false); setSavedPdf(false) }}
                placeholder="e.g. Blue Room Agreement — March 2026"
              />
            </div>
          </div>

          {selectedTemplate && variables.length > 0 && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-neutral-100">Fill in variables</p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {variables.length} variable{variables.length !== 1 ? 's' : ''} in this template. Venue, deal, and contact fields pre-fill when empty.
                </p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {variables.map(key => (
                  <div key={key} className="space-y-1">
                    <Label className="font-mono text-xs">{'{{'}{key}{'}}'}</Label>
                    <Input
                      value={vars[key] ?? ''}
                      onChange={e => setVar(key, e.target.value)}
                      placeholder={`Value for ${key}`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedTemplate && variables.length === 0 && (
            <p className="text-xs text-neutral-500">This template has no variables — it will be generated as-is.</p>
          )}

          {selectedTemplate && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-950">
                <span className="text-xs font-medium text-neutral-400">Plain text output</span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveText}
                    disabled={!fileName.trim() || savingText || savedText}
                  >
                    <Save className="h-3.5 w-3.5" />
                    {savedText ? 'Saved' : savingText ? 'Saving…' : 'Save text to files'}
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSavePdf}
                    disabled={!fileName.trim() || !rendered.trim() || savingPdf || savedPdf}
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {savedPdf ? 'PDF saved' : savingPdf ? 'PDF…' : 'Save PDF to files'}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleDownloadTxt} disabled={!rendered}>
                    <Download className="h-3.5 w-3.5" />
                    Download .txt
                  </Button>
                  <Button size="sm" variant="secondary" onClick={handleDownloadPdfOnly} disabled={!rendered.trim() || savingPdf}>
                    <Download className="h-3.5 w-3.5" />
                    Download .pdf
                  </Button>
                </div>
              </div>
              <pre className="p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[280px] overflow-y-auto border-t border-neutral-800/80">
                {rendered || <span className="text-neutral-600">Select a template to see output…</span>}
              </pre>
            </div>
          )}
        </div>

        {selectedTemplate && (
          <div className="w-full lg:w-[min(440px,42vw)] shrink-0 lg:max-w-[480px]">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden flex flex-col h-[min(640px,70vh)] lg:sticky lg:top-4">
              <div className="px-4 py-2.5 border-b border-neutral-800 flex items-center gap-2 shrink-0">
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
