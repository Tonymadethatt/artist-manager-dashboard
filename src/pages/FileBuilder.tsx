import { useState, useMemo } from 'react'
import { ArrowLeft, Download, Save, Eye, Code2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTemplates } from '@/hooks/useTemplates'
import { useVenues } from '@/hooks/useVenues'
import { useFiles } from '@/hooks/useFiles'
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
import type { Template } from '@/types'

function extractVariables(sections: Template['sections']): string[] {
  const combined = sections.map(s => s.content).join('\n')
  const matches = combined.matchAll(/\{\{(\w+)\}\}/g)
  return [...new Set([...matches].map(m => m[1]))]
}

function renderTemplate(sections: Template['sections'], vars: Record<string, string>): string {
  return sections.map(s => {
    let content = s.content
    for (const [key, val] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, val || `[${key}]`)
    }
    return `=== ${s.label.toUpperCase()} ===\n\n${content}`
  }).join('\n\n\n')
}

export default function FileBuilder() {
  const navigate = useNavigate()
  const { templates, loading: tplLoading } = useTemplates()
  const { venues } = useVenues()
  const { addFile } = useFiles()

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')
  const [selectedVenueId, setSelectedVenueId] = useState<string>('')
  const [fileName, setFileName] = useState('')
  const [vars, setVars] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<'editor' | 'preview'>('editor')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)
  const variables = useMemo(() => selectedTemplate ? extractVariables(selectedTemplate.sections) : [], [selectedTemplate])

  const handleTemplateChange = (id: string) => {
    setSelectedTemplateId(id)
    setVars({})
    setSaved(false)
    const tpl = templates.find(t => t.id === id)
    if (tpl && !fileName) setFileName(`${tpl.name} — `)
  }

  const setVar = (key: string, value: string) => {
    setVars(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const rendered = selectedTemplate ? renderTemplate(selectedTemplate.sections, vars) : ''

  const handleDownload = () => {
    if (!rendered) return
    const blob = new Blob([rendered], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(fileName || 'document').replace(/[^a-zA-Z0-9\s-_]/g, '').trim()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSave = async () => {
    if (!rendered || !fileName.trim()) return
    setSaving(true)
    await addFile({
      name: fileName.trim(),
      content: rendered,
      template_id: selectedTemplateId || null,
      venue_id: selectedVenueId || null,
    })
    setSaving(false)
    setSaved(true)
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <button
        onClick={() => navigate('/files')}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to files
      </button>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Generate file</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          {/* Template picker */}
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

          {/* Venue picker (optional) */}
          <div className="space-y-1">
            <Label>Venue (optional)</Label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Link to a venue" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No venue</SelectItem>
                {venues.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* File name */}
        <div className="space-y-1">
          <Label>File name *</Label>
          <Input
            value={fileName}
            onChange={e => { setFileName(e.target.value); setSaved(false) }}
            placeholder="e.g. Blue Room Agreement — March 2026"
          />
        </div>
      </div>

      {/* Variables */}
      {selectedTemplate && variables.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">Fill in variables</p>
            <p className="text-xs text-neutral-400 mt-0.5">
              {variables.length} variable{variables.length !== 1 ? 's' : ''} found in this template.
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
        <p className="text-xs text-neutral-400">This template has no variables — it will be generated as-is.</p>
      )}

      {/* Preview / Output */}
      {selectedTemplate && (
        <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 bg-neutral-50">
            <div className="flex gap-1">
              <button
                onClick={() => setPreview('editor')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${preview === 'editor' ? 'bg-white border border-neutral-200 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}
              >
                <Code2 className="h-3.5 w-3.5" />
                Output
              </button>
              <button
                onClick={() => setPreview('preview')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${preview === 'preview' ? 'bg-white border border-neutral-200 text-neutral-900' : 'text-neutral-400 hover:text-neutral-700'}`}
              >
                <Eye className="h-3.5 w-3.5" />
                Preview
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSave}
                disabled={!fileName.trim() || saving || saved}
              >
                <Save className="h-3.5 w-3.5" />
                {saved ? 'Saved' : saving ? 'Saving…' : 'Save to files'}
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={!rendered}>
                <Download className="h-3.5 w-3.5" />
                Download .txt
              </Button>
            </div>
          </div>

          {preview === 'editor' ? (
            <pre className="p-4 text-xs font-mono text-neutral-700 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {rendered || <span className="text-neutral-300">Fill in the variables above to see output…</span>}
            </pre>
          ) : (
            <div className="p-4 text-sm text-neutral-800 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
              {rendered.split('\n').map((line, i) => {
                if (line.startsWith('===') && line.endsWith('===')) {
                  return <p key={i} className="font-bold text-neutral-900 mt-4 first:mt-0 border-b border-neutral-200 pb-1 mb-2">{line.replace(/===/g, '').trim()}</p>
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
