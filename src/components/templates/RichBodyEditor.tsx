import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import { List, ListOrdered, Table as TableIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Convert legacy plain-text content to HTML paragraphs for TipTap. */
function initContent(content: string): string {
  if (!content.trim()) return ''
  if (/^\s*</.test(content)) return content
  const paras = content.split(/\n{2,}/)
  return paras
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
}

interface RichBodyEditorProps {
  value: string
  onChange: (html: string) => void
  variableKeys: string[]
  placeholder?: string
}

export function RichBodyEditor({ value, onChange, variableKeys, placeholder }: RichBodyEditorProps) {
  const [varMenuOpen, setVarMenuOpen] = useState(false)
  const varMenuRef = useRef<HTMLDivElement>(null)
  const prevValue = useRef(value)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? 'Section content… Type to start.' }),
    ],
    content: initContent(value),
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      prevValue.current = html
      onChange(html)
    },
  })

  // Sync when the section id changes (value reset from outside)
  useEffect(() => {
    if (!editor) return
    if (prevValue.current === value) return
    const incoming = initContent(value)
      editor.commands.setContent(incoming, { emitUpdate: false })
    prevValue.current = value
  }, [value, editor])

  // Close var menu on outside click
  useEffect(() => {
    if (!varMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (varMenuRef.current && !varMenuRef.current.contains(e.target as Node)) {
        setVarMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [varMenuOpen])

  const insertVariable = (key: string) => {
    editor?.chain().focus().insertContent(`{{${key}}}`).run()
    setVarMenuOpen(false)
  }

  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div className="rounded-md border border-neutral-800 bg-neutral-950/70 overflow-visible">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-800 bg-neutral-900/80 flex-wrap">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBold().run() }}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded text-xs font-bold transition-colors',
            editor?.isActive('bold')
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          )}
          title="Bold"
        >B</button>

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleItalic().run() }}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded text-xs italic transition-colors',
            editor?.isActive('italic')
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          )}
          title="Italic"
        >I</button>

        <div className="w-px h-4 bg-neutral-800 mx-0.5" />

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleHeading({ level: 3 }).run() }}
          className={cn(
            'h-7 px-1.5 flex items-center justify-center rounded text-[11px] font-semibold transition-colors',
            editor?.isActive('heading', { level: 3 })
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          )}
          title="Subheading"
        >H3</button>

        <div className="w-px h-4 bg-neutral-800 mx-0.5" />

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleBulletList().run() }}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded transition-colors',
            editor?.isActive('bulletList')
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          )}
          title="Bullet list"
        >
          <List className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); editor?.chain().focus().toggleOrderedList().run() }}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded transition-colors',
            editor?.isActive('orderedList')
              ? 'bg-neutral-700 text-white'
              : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
          )}
          title="Numbered list"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </button>

        <div className="w-px h-4 bg-neutral-800 mx-0.5" />

        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); insertTable() }}
          className="h-7 w-7 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          title="Insert table"
        >
          <TableIcon className="h-3.5 w-3.5" />
        </button>

        {variableKeys.length > 0 && (
          <>
            <div className="w-px h-4 bg-neutral-800 mx-0.5" />
            <div className="relative" ref={varMenuRef}>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); setVarMenuOpen(prev => !prev) }}
                className="h-7 px-2 flex items-center gap-1 rounded text-[11px] text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors font-mono"
                title="Insert variable"
              >
                {'{{…}}'}
                <ChevronDown className="h-3 w-3" />
              </button>
              {varMenuOpen && (
                <div className="absolute top-full left-0 mt-0.5 z-50 bg-neutral-900 border border-neutral-700 rounded-md shadow-lg min-w-[160px] max-h-56 overflow-y-auto">
                  {variableKeys.map(key => (
                    <button
                      key={key}
                      type="button"
                      onMouseDown={e => { e.preventDefault(); insertVariable(key) }}
                      className="w-full text-left px-3 py-1.5 text-xs font-mono text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100 transition-colors"
                    >
                      {`{{${key}}}`}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <EditorContent
        editor={editor}
        className="rich-body-editor min-h-[120px] px-3 py-2.5 text-sm text-neutral-200"
      />
    </div>
  )
}
