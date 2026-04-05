import { useState } from 'react'
import { Plus, Trash2, GripVertical, ArrowLeft, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Template, TemplateSection, TemplateType } from '@/types'
import { nanoid } from '@/lib/nanoid'

interface TemplateEditorProps {
  template: Template | null
  onSave: (data: Omit<Template, 'id' | 'user_id' | 'created_at' | 'updated_at'>) => Promise<void>
  onCancel: () => void
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? '')
  const [type, setType] = useState<TemplateType>(template?.type ?? 'agreement')
  const [sections, setSections] = useState<TemplateSection[]>(
    template?.sections ?? [{ id: nanoid(), label: 'Introduction', content: '' }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addSection = () => {
    setSections(prev => [...prev, { id: nanoid(), label: '', content: '' }])
  }

  const removeSection = (id: string) => {
    setSections(prev => prev.filter(s => s.id !== id))
  }

  const updateSection = (id: string, key: keyof TemplateSection, value: string) => {
    setSections(prev => prev.map(s => s.id === id ? { ...s, [key]: value } : s))
  }

  const handleSave = async () => {
    if (!name.trim()) { setError('Template name is required.'); return }
    if (sections.some(s => !s.label.trim())) { setError('All sections need a label.'); return }
    setSaving(true)
    await onSave({ name: name.trim(), type, sections })
    setSaving(false)
  }

  return (
    <div className="max-w-2xl space-y-5">
      {/* Back button */}
      <button
        onClick={onCancel}
        className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to templates
      </button>

      {/* Name + type */}
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

      {/* Variable hint */}
      <div className="flex items-start gap-2 bg-neutral-900 border border-neutral-800 rounded px-3 py-2.5 text-xs text-neutral-500">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-neutral-600" />
        <span>
          Use <code className="bg-neutral-800 px-1 rounded text-neutral-300">{'{{variable_name}}'}</code> for dynamic fields.
          Example: <code className="bg-neutral-800 px-1 rounded text-neutral-300">{'{{venue_name}}'}</code>,{' '}
          <code className="bg-neutral-800 px-1 rounded text-neutral-300">{'{{event_date}}'}</code>,{' '}
          <code className="bg-neutral-800 px-1 rounded text-neutral-300">{'{{artist_pay}}'}</code>.
          These will be filled in when generating a file.
        </span>
      </div>

      {/* Sections */}
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
            {sections.map((section, idx) => (
              <div key={section.id} className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-neutral-600 shrink-0" />
                  <div className="flex-1">
                    <Input
                      value={section.label}
                      onChange={e => updateSection(section.id, 'label', e.target.value)}
                      placeholder={`Section ${idx + 1} label (e.g. Payment Terms)`}
                      className="font-medium"
                    />
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
                <Textarea
                  value={section.content}
                  onChange={e => updateSection(section.id, 'content', e.target.value)}
                  placeholder="Section content… Use {{variable}} placeholders for dynamic values."
                  className="min-h-[120px] text-sm leading-relaxed font-mono"
                />
              </div>
            ))}
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
