import { useState } from 'react'
import { Plus, FileText, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useTemplates } from '@/hooks/useTemplates'
import { TemplateEditor } from '@/components/templates/TemplateEditor'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Template } from '@/types'

export default function Templates() {
  const { templates, loading, addTemplate, updateTemplate, deleteTemplate } = useTemplates()
  const [editing, setEditing] = useState<Template | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Template | null>(null)

  if (editing !== null) {
    return (
      <TemplateEditor
        template={editing === 'new' ? null : editing}
        onSave={async (data) => {
          if (editing === 'new') {
            await addTemplate(data)
          } else {
            await updateTemplate(editing.id, data)
          }
          setEditing(null)
        }}
        onCancel={() => setEditing(null)}
      />
    )
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        <Button onClick={() => setEditing('new')}>
          <Plus className="h-3.5 w-3.5" />
          New template
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-5 h-5 border-2 border-neutral-700 border-t-neutral-300 rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-neutral-700 rounded-lg">
          <FileText className="h-8 w-8 text-neutral-600 mx-auto mb-3" />
          <p className="font-medium text-neutral-400 text-sm mb-1">No templates yet</p>
          <p className="text-xs text-neutral-500 mb-4">Create your first template to start generating documents.</p>
          <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
            Create template
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div
              key={t.id}
              className="flex items-center justify-between bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 hover:border-neutral-600 transition-colors group"
            >
              <button
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => setEditing(t)}
              >
                <FileText className="h-4 w-4 text-neutral-500 shrink-0" />
                <div className="min-w-0">
                  <div className="font-medium text-sm text-neutral-100">{t.name}</div>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {t.sections.length} section{t.sections.length !== 1 ? 's' : ''} · Updated {new Date(t.updated_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge variant={t.type === 'agreement' ? 'blue' : 'warning'} className="ml-2 shrink-0">
                  {t.type}
                </Badge>
              </button>

              <div className="flex items-center gap-1 ml-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setEditing(t)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-red-500 hover:text-red-400"
                  onClick={() => setConfirmDelete(t)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <ChevronRight className="h-4 w-4 text-neutral-600 group-hover:text-neutral-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-neutral-900 rounded-lg border border-neutral-700 p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-semibold text-neutral-100 mb-2">Delete template?</h3>
            <p className="text-sm text-neutral-400 mb-4">
              <strong className="text-neutral-200">{confirmDelete.name}</strong> will be permanently deleted. Generated files using this template will remain.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  await deleteTemplate(confirmDelete.id)
                  setConfirmDelete(null)
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
