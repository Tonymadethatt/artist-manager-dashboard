import { useMemo, useRef, useState } from 'react'
import { Plus, Trash2, GripVertical, ArrowLeft, Info, Upload, X } from 'lucide-react'
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
import type { Template, TemplateSection, TemplateSectionKind, TemplateType } from '@/types'
import { nanoid } from '@/lib/nanoid'
import { catalogKeysUnion, extractVariableNames } from '@/lib/agreement'
import { uploadTemplateLogo } from '@/lib/storage/uploadTemplateLogo'
import { VariableSlashTextarea } from './VariableSlashTextarea'
import { RichBodyEditor } from './RichBodyEditor'

const DEFAULT_SECTIONS = (): TemplateSection[] => [
  { id: nanoid(), label: '', content: '', section_kind: 'header', header_logo_url: null },
  { id: nanoid(), label: 'Introduction', content: '', section_kind: 'body' },
  { id: nanoid(), label: '', content: '', section_kind: 'footer' },
]

interface TemplateEditorProps {
  template: Template | null
  onSave: (
    data: Omit<Template, 'id' | 'user_id' | 'created_at' | 'updated_at'>
  ) => Promise<void | { error: string }>
  onCancel: () => void
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? '')
  const [type, setType] = useState<TemplateType>(template?.type ?? 'agreement')
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.sections?.length ? template.sections : DEFAULT_SECTIONS()
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [logoUploading, setLogoUploading] = useState<Record<string, boolean>>({})
  const [logoError, setLogoError] = useState<Record<string, string>>({})
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const slashKeys = useMemo(() => catalogKeysUnion(extractVariableNames(sections)), [sections])

  const addSection = () => {
    setSections(prev => [...prev, { id: nanoid(), label: '', content: '', section_kind: 'body' }])
  }

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id))
    setLogoError(prev => { const n = { ...prev }; delete n[id]; return n })
    setLogoUploading(prev => { const n = { ...prev }; delete n[id]; return n })
  }

  const updateSection = (id: string, patch: Partial<TemplateSection>) => {
    setSections(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const handleLogoUpload = async (sectionId: string, file: File) => {
    setLogoUploading(prev => ({ ...prev, [sectionId]: true }))
    setLogoError(prev => ({ ...prev, [sectionId]: '' }))
    const result = await uploadTemplateLogo(file)
    setLogoUploading(prev => ({ ...prev, [sectionId]: false }))
    if (result.error) {
      setLogoError(prev => ({ ...prev, [sectionId]: result.error.message }))
      return
    }
    updateSection(sectionId, { header_logo_url: result.url })
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required.'); return }
    if (sections.some(s => (s.section_kind ?? 'body') === 'body' && !s.label.trim())) {
      setError('Body sections need a label.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await onSave({ name: name.trim(), type, sections })
    setSaving(false)
    if (result && typeof result === 'object' && 'error' in result && result.error) {
      setError(result.error)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to documents
      </button>

      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="space-y-1">
          <Label htmlFor="tpl-name">Template name *</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Standard Performance Agreement"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label>Type</Label>
          <Select value={type} onValueChange={v => setType(v as TemplateType)}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="agreement">Agreement</SelectItem>
              <SelectItem value="invoice">Invoice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-start gap-2 bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-xs text-neutral-500">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-600" />
        <span>
          Use <code className="bg-neutral-800 px-1 rounded text-neutral-300">{'{{variable_name}}'}</code> or type{' '}
          <code className="bg-neutral-800 px-1 rounded text-neutral-300">/</code> for a variable menu.
          Header and footer regions control the top/bottom of the document — their labels are internal and do not appear on the final file. Body section labels appear as headings. Upload your logo on a header section to replace the default.
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium text-neutral-300">Sections</Label>
          <Button variant="outline" size="sm" onClick={addSection}>
            <Plus className="h-3.5 w-3.5" />
            Add section
          </Button>
        </div>

        {sections.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-neutral-700 rounded-lg text-xs text-neutral-500">
            No sections yet. Add a section to start building the template.
          </div>
        ) : (
          <div className="space-y-3">
            {sections.map((section, idx) => {
              const kind: TemplateSectionKind = section.section_kind ?? 'body'
              const isUploading = !!logoUploading[section.id]
              const logoErr = logoError[section.id] || ''
              return (
                <div key={section.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <GripVertical className="h-4 w-4 text-neutral-600 shrink-0" />
                    <div className="flex-1 min-w-[120px]">
                      <Input
                        value={section.label}
                        onChange={e => updateSection(section.id, { label: e.target.value })}
                        placeholder={
                          kind === 'body'
                            ? `Section ${idx + 1} label *`
                            : `${kind === 'header' ? 'Header' : 'Footer'} label (internal, not shown)`
                        }
                        className="font-medium"
                      />
                    </div>
                    <div className="w-[130px]">
                      <Select
                        value={kind}
                        onValueChange={v =>
                          updateSection(section.id, { section_kind: v as TemplateSectionKind })
                        }
                      >
                        <SelectTrigger className="h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="header">Header</SelectItem>
                          <SelectItem value="body">Body</SelectItem>
                          <SelectItem value="footer">Footer</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-400 hover:text-red-600 shrink-0"
                      onClick={() => removeSection(section.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {kind === 'header' && (
                    <div className="pl-0 sm:pl-6 space-y-2">
                      <Label className="text-xs text-neutral-500">Logo (optional — replaces default)</Label>
                      {section.header_logo_url ? (
                        <div className="flex items-center gap-3">
                          <div className="w-16 h-10 rounded border border-neutral-700 bg-white flex items-center justify-center overflow-hidden shrink-0">
                            <img
                              src={section.header_logo_url}
                              alt="Logo preview"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1.5 shrink-0"
                              disabled={isUploading}
                              onClick={() => fileInputRefs.current[section.id]?.click()}
                            >
                              <Upload className="h-3 w-3" />
                              Replace
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-red-400 hover:text-red-300 gap-1.5 shrink-0"
                              onClick={() => updateSection(section.id, { header_logo_url: null })}
                            >
                              <X className="h-3 w-3" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            disabled={isUploading}
                            onClick={() => fileInputRefs.current[section.id]?.click()}
                          >
                            {isUploading ? (
                              <>
                                <span className="h-3 w-3 rounded-full border border-neutral-500 border-t-neutral-200 animate-spin" />
                                Uploading…
                              </>
                            ) : (
                              <>
                                <Upload className="h-3 w-3" />
                                Upload logo
                              </>
                            )}
                          </Button>
                          <span className="text-[11px] text-neutral-600">PNG, JPG, WebP — max 5 MB</span>
                        </div>
                      )}
                      {logoErr && (
                        <p className="text-[11px] text-red-400">{logoErr}</p>
                      )}
                      <input
                        ref={el => { fileInputRefs.current[section.id] = el }}
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        className="hidden"
                        onChange={e => {
                          const file = e.target.files?.[0]
                          if (file) void handleLogoUpload(section.id, file)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  )}

                  {kind === 'body' ? (
                    <RichBodyEditor
                      value={section.content}
                      onChange={v => updateSection(section.id, { content: v })}
                      variableKeys={slashKeys}
                      placeholder="Section content…"
                    />
                  ) : (
                    <VariableSlashTextarea
                      value={section.content}
                      onChange={v => updateSection(section.id, { content: v })}
                      variableKeys={slashKeys}
                      placeholder="Section content… Type / to insert variables."
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2 pt-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : template ? 'Save changes' : 'Create template'}
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}
