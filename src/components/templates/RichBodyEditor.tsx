import { useEffect, useMemo, useRef, useState } from 'react'
import type { Editor } from '@tiptap/core'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import Placeholder from '@tiptap/extension-placeholder'
import { List, ListOrdered, Table as TableIcon, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseSlashMenu } from '@/lib/templates/parseSlashMenu'

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
  className?: string
}

export function RichBodyEditor({ value, onChange, variableKeys, placeholder, className }: RichBodyEditorProps) {
  const [varMenuOpen, setVarMenuOpen] = useState(false)
  const [slashMenu, setSlashMenu] = useState<{ anchor: number; filter: string } | null>(null)
  const varMenuRef = useRef<HTMLDivElement>(null)
  const slashMenuRef = useRef<HTMLDivElement>(null)
  const prevValue = useRef(value)
  const variableKeysRef = useRef(variableKeys)
  const editorRef = useRef<Editor | null>(null)
  useEffect(() => {
    variableKeysRef.current = variableKeys
  }, [variableKeys])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({
        placeholder: placeholder ?? 'Section content… Type / to insert a variable.',
      }),
    ],
    content: initContent(value),
    editorProps: {
      handleKeyDown: (_view, event) => {
        const keys = variableKeysRef.current
        if (event.key === 'Escape') {
          setSlashMenu(null)
          return false
        }
        if (event.key !== 'Enter' || keys.length === 0) return false
        const ed = editorRef.current
        if (!ed) return false
        const { from } = ed.state.selection
        if (!ed.state.selection.empty) return false
        const before = ed.state.doc.textBetween(0, from, '\n')
        const m = parseSlashMenu(before, before.length)
        if (!m) return false
        const f = m.filter.toLowerCase()
        const filtered = keys.filter(k => f === '' || k.toLowerCase().includes(f))
        if (filtered.length === 0) return false
        event.preventDefault()
        const anchor = from - (before.length - m.start)
        ed.chain().focus().deleteRange({ from: anchor, to: from }).insertContent(`{{${filtered[0]}}}`).run()
        setSlashMenu(null)
        return true
      },
    },
    onUpdate: ({ editor: ed }) => {
      const html = ed.getHTML()
      prevValue.current = html
      onChange(html)
    },
  })

  useEffect(() => {
    editorRef.current = editor
  }, [editor])

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

  useEffect(() => {
    if (!editor) return
    const syncSlash = () => {
      const keys = variableKeysRef.current
      if (keys.length === 0) {
        setSlashMenu(null)
        return
      }
      const { from } = editor.state.selection
      if (!editor.state.selection.empty) {
        setSlashMenu(null)
        return
      }
      const before = editor.state.doc.textBetween(0, from, '\n')
      const m = parseSlashMenu(before, before.length)
      if (!m) {
        setSlashMenu(null)
        return
      }
      const anchor = from - (before.length - m.start)
      setSlashMenu({ anchor, filter: m.filter })
    }
    editor.on('selectionUpdate', syncSlash)
    editor.on('transaction', syncSlash)
    return () => {
      editor.off('selectionUpdate', syncSlash)
      editor.off('transaction', syncSlash)
    }
  }, [editor])

  useEffect(() => {
    if (!slashMenu) return
    const handler = (e: MouseEvent) => {
      if (slashMenuRef.current && !slashMenuRef.current.contains(e.target as Node)) {
        setSlashMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [slashMenu])

  const slashFiltered = useMemo(() => {
    const f = slashMenu?.filter.toLowerCase() ?? ''
    return variableKeys.filter(k => f === '' || k.toLowerCase().includes(f))
  }, [slashMenu, variableKeys])

  const insertSlashPick = (key: string) => {
    const ed = editorRef.current
    if (!ed || !slashMenu) return
    const { from } = ed.state.selection
    ed.chain()
      .focus()
      .deleteRange({ from: slashMenu.anchor, to: from })
      .insertContent(`{{${key}}}`)
      .run()
    setSlashMenu(null)
  }

  const insertVariable = (key: string) => {
    editor?.chain().focus().insertContent(`{{${key}}}`).run()
    setVarMenuOpen(false)
  }

  const insertTable = () => {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  return (
    <div
      ref={slashMenuRef}
      className={cn('rounded-md border border-neutral-800 bg-neutral-950/70 overflow-visible', className)}
    >
      {/* Toolbar */}
      <div className="relative flex items-center gap-0.5 px-2 py-1.5 border-b border-neutral-800 bg-neutral-900/80 flex-wrap">
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

        {slashMenu && slashFiltered.length > 0 && (
          <div
            className="absolute top-full left-2 right-2 mt-0.5 z-50 max-h-40 overflow-y-auto rounded-md border border-neutral-700 bg-neutral-900 shadow-lg py-1 text-left"
            role="listbox"
          >
            {slashFiltered.slice(0, 60).map(k => (
              <button
                key={k}
                type="button"
                role="option"
                className="w-full px-2 py-1.5 text-left text-xs font-mono text-neutral-200 hover:bg-neutral-800"
                onMouseDown={e => e.preventDefault()}
                onClick={() => insertSlashPick(k)}
              >
                {`{{${k}}}`}
              </button>
            ))}
          </div>
        )}
      </div>

      <EditorContent
        editor={editor}
        className="rich-body-editor min-h-[120px] px-3 py-2.5 text-sm text-neutral-200"
      />
    </div>
  )
}
