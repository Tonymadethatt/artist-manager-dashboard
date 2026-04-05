import { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowLeft, Download, Save, Eye, Code2, FileText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTemplates } from '@/hooks/useTemplates'
import { useVenues } from '@/hooks/useVenues'
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
  buildVenueProfilePrefill,
  renderAgreementText,
  renderAgreementHtmlDocument,
  fetchLogoDataUrl,
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
  const [preview, setPreview] = useState<'editor' | 'preview'>('editor')
  const [savingText, setSavingText] = useState(false)
  const [savingPdf, setSavingPdf] = useState(false)
  const [savedText, setSavedText] = useState(false)
  const [savedPdf, setSavedPdf] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  /** Prefill template variables from venue + profile when venue changes (does not overwrite user-entered values). */
  useEffect(() => {
    if (!selectedTemplate || variables.length === 0) return
    const venue = selectedVenueId ? venues.find(v => v.id === selectedVenueId) ?? null : null
    const pre = buildVenueProfilePrefill(venue, profile)
    setVars(prev => {
      const next = { ...prev }
      for (const key of variables) {
        if (pre[key] && !next[key]?.trim()) next[key] = pre[key]
      }
      return next
    })
  }, [selectedVenueId, selectedTemplate, profile, venues, variables])

  const rendered = selectedTemplate ? renderAgreementText(selectedTemplate.sections, vars) : ''

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
      const origin = getSiteOrigin()
      const logo = await fetchLogoDataUrl(origin)
      const companyLine = profile?.company_name?.trim() || profile?.artist_name || 'Agreement'
      const tagline = profile?.tagline?.trim() || null
      const html = renderAgreementHtmlDocument({
        sections: selectedTemplate.sections,
        vars,
        companyLine,
        taglineLine: tagline,
        logoDataUrl: logo,
        generatedAtLabel: `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
      })
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
      const origin = getSiteOrigin()
      const logo = await fetchLogoDataUrl(origin)
      const companyLine = profile?.company_name?.trim() || profile?.artist_name || 'Agreement'
      const tagline = profile?.tagline?.trim() || null
      const html = renderAgreementHtmlDocument({
        sections: selectedTemplate.sections,
        vars,
        companyLine,
        taglineLine: tagline,
        logoDataUrl: logo,
        generatedAtLabel: `Generated ${new Date().toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}`,
      })
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
    <div className="space-y-5 max-w-3xl relative">
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
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to files
      </button>

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
              {variables.length} variable{variables.length !== 1 ? 's' : ''} found. Venue selection pre-fills matching tokens when empty.
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
            <div className="flex gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setPreview('editor')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  preview === 'editor'
                    ? 'bg-neutral-800 border border-neutral-700 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Output
              </button>
              <button
                type="button"
                onClick={() => setPreview('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                  preview === 'preview'
                    ? 'bg-neutral-800 border border-neutral-700 text-neutral-100'
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
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

          {preview === 'editor' ? (
            <pre className="p-4 text-xs font-mono text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {rendered || <span className="text-neutral-600">Fill in the variables above to see output…</span>}
            </pre>
          ) : (
            <div className="p-4 text-sm text-neutral-200 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {rendered.split('\n').map((line, i) => {
                if (line.startsWith('===') && line.endsWith('===')) {
                  return <p key={i} className="font-bold text-neutral-100 mt-4 first:mt-0 border-b border-neutral-800 pb-1 mb-2">{line.replace(/===/g, '').trim()}</p>
                }
                return <span key={i}>{line}<br /></span>
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
