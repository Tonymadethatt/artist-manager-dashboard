import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { CustomEmailBlock } from '@/lib/email/customEmailBlocks'
import { cn } from '@/lib/utils'

const CARD = 'rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#1a1a1a]'
const CARD_HEADER =
  'bg-[#161616] px-[18px] py-2 border-b border-[#2a2a2a] flex items-center gap-2 min-w-0'
const CARD_BODY = 'px-[18px] py-3'

const EYEBROW = 'text-[10px] font-semibold uppercase tracking-wider text-neutral-500'

function BlockChrome(props: {
  label: string
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { label, index, total, onMove, onRemove } = props
  return (
    <div className="flex items-center justify-between gap-2 pb-1.5 min-w-0">
      <span className="text-[10px] text-neutral-500 uppercase tracking-wide truncate">{label}</span>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 disabled:opacity-30"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label="Move up"
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-neutral-800 text-neutral-500 disabled:opacity-30"
          onClick={() => onMove(1)}
          disabled={index >= total - 1}
          aria-label="Move down"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="p-1 rounded hover:bg-neutral-800 text-red-400/80"
          onClick={onRemove}
          aria-label="Remove block"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

function TitleHeaderStrip(props: {
  accentClass: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <div className={CARD_HEADER}>
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', props.accentClass)} />
      <Input
        value={props.value}
        onChange={e => props.onChange(e.target.value)}
        placeholder={props.placeholder ?? 'Section title (optional)'}
        className="h-7 min-w-0 flex-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400 placeholder:text-neutral-600 placeholder:normal-case placeholder:tracking-normal placeholder:font-medium bg-transparent border-0 shadow-none focus-visible:ring-0 px-0"
      />
    </div>
  )
}

function ProseEditor(props: {
  block: Extract<CustomEmailBlock, { kind: 'prose' }>
  index: number
  total: number
  onUpdate: (patch: Partial<CustomEmailBlock>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { block, index, total, onUpdate, onMove, onRemove } = props
  return (
    <div className="min-w-0">
      <BlockChrome label="Text" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      <div className={CARD}>
        <TitleHeaderStrip
          accentClass="bg-[#60a5fa]"
          value={block.title ?? ''}
          onChange={v => onUpdate({ title: v || null })}
        />
        <div className={CARD_BODY}>
          <textarea
            value={block.body}
            onChange={e => onUpdate({ body: e.target.value })}
            rows={10}
            className="w-full min-h-[160px] rounded-md border border-[#2a2a2a] bg-[#141414] px-3 py-2.5 text-[13px] text-[#d1d1d1] leading-relaxed placeholder:text-neutral-600 focus:outline-none focus:ring-1 focus:ring-neutral-500 resize-y"
            placeholder="Message body…"
          />
        </div>
      </div>
    </div>
  )
}

function BulletListEditor(props: {
  block: Extract<CustomEmailBlock, { kind: 'bullet_list' }>
  index: number
  total: number
  onUpdate: (patch: Partial<CustomEmailBlock>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { block, index, total, onUpdate, onMove, onRemove } = props
  return (
    <div className="min-w-0">
      <BlockChrome label="Bullet list" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      <div className={CARD}>
        <TitleHeaderStrip
          accentClass="bg-[#22c55e]"
          value={block.title ?? ''}
          onChange={v => onUpdate({ title: v || null })}
        />
        <div className={cn(CARD_BODY, 'space-y-0')}>
          <ul className="list-none m-0 p-0 space-y-2">
            {block.items.map((line, li) => (
              <li key={li} className="flex gap-2 items-start">
                <span className="text-[#22c55e] mt-2.5 text-[6px] leading-none select-none shrink-0" aria-hidden>
                  ●
                </span>
                <div className="flex-1 min-w-0 flex gap-1">
                  <Input
                    value={line}
                    onChange={e => {
                      const items = [...block.items]
                      items[li] = e.target.value
                      onUpdate({ items })
                    }}
                    className="h-9 text-[13px] text-[#d1d1d1] bg-[#141414] border-[#2a2a2a] flex-1"
                  />
                  <button
                    type="button"
                    className="shrink-0 px-2 rounded border border-neutral-800 text-neutral-500 hover:text-red-400 text-xs"
                    onClick={() => onUpdate({ items: block.items.filter((_, j) => j !== li) })}
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] mt-3 text-neutral-400 hover:text-white px-0"
            onClick={() => onUpdate({ items: [...block.items, ''] })}
          >
            + Item
          </Button>
        </div>
      </div>
    </div>
  )
}

function KeyValueEditor(props: {
  block: Extract<CustomEmailBlock, { kind: 'key_value' }>
  index: number
  total: number
  mergeKeyOptions: readonly string[]
  onUpdate: (patch: Partial<CustomEmailBlock>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { block, index, total, mergeKeyOptions, onUpdate, onMove, onRemove } = props
  return (
    <div className="min-w-0">
      <BlockChrome label="Key / value" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      <div className={CARD}>
        <TitleHeaderStrip
          accentClass="bg-[#60a5fa]"
          value={block.title ?? ''}
          onChange={v => onUpdate({ title: v || null })}
        />
        <div className={cn(CARD_BODY, 'py-2')}>
          <div className="divide-y divide-[#222222]">
            {block.rows.map((rowkv, ri) => (
              <div key={ri} className="flex flex-col sm:flex-row gap-2 sm:items-center py-2.5 first:pt-0 last:pb-0">
                <Input
                  value={rowkv.label}
                  onChange={e => {
                    const rows = block.rows.map((x, j) => (j === ri ? { ...x, label: e.target.value } : x))
                    onUpdate({ rows })
                  }}
                  placeholder="Label"
                  className="h-9 text-[13px] text-neutral-400 bg-[#141414] border-[#2a2a2a] sm:w-[42%] shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  <Select
                    value={rowkv.valueKey ?? '__static__'}
                    onValueChange={v => {
                      const rows = block.rows.map((x, j) =>
                        j === ri
                          ? v === '__static__'
                            ? { ...x, valueKey: null, value: x.value ?? '' }
                            : { ...x, valueKey: v, value: null }
                          : x,
                      )
                      onUpdate({ rows })
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs bg-[#141414] border-[#2a2a2a]">
                      <SelectValue placeholder="Value source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__static__" className="text-xs">
                        Static text
                      </SelectItem>
                      {mergeKeyOptions.map(k => (
                        <SelectItem key={k} value={k} className="text-xs">
                          {k}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!rowkv.valueKey && (
                    <Input
                      value={rowkv.value ?? ''}
                      onChange={e => {
                        const rows = block.rows.map((x, j) =>
                          j === ri ? { ...x, value: e.target.value } : x,
                        )
                        onUpdate({ rows })
                      }}
                      placeholder="Value (merge tokens ok)"
                      className="h-9 text-[13px] text-neutral-200 bg-[#141414] border-[#2a2a2a]"
                    />
                  )}
                </div>
                <button
                  type="button"
                  className="text-[11px] text-red-400/80 hover:text-red-400 shrink-0 self-start sm:self-center"
                  onClick={() => onUpdate({ rows: block.rows.filter((_, j) => j !== ri) })}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[11px] mt-2 text-neutral-400 hover:text-white px-0"
            onClick={() => onUpdate({ rows: [...block.rows, { label: 'New', value: '' }] })}
          >
            + Row
          </Button>
        </div>
      </div>
    </div>
  )
}

function TableEditor(props: {
  block: Extract<CustomEmailBlock, { kind: 'table' }>
  index: number
  total: number
  onUpdate: (patch: Partial<CustomEmailBlock>) => void
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { block, index, total, onUpdate, onMove, onRemove } = props

  const addColumn = () => {
    onUpdate({ headers: [...block.headers, ''] })
  }

  const removeLastColumn = () => {
    if (block.headers.length <= 1) return
    const newHeaders = block.headers.slice(0, -1)
    const newRows = block.rows.map(r => r.slice(0, -1))
    onUpdate({ headers: newHeaders, rows: newRows })
  }

  const addRow = () => {
    onUpdate({ rows: [...block.rows, block.headers.map(() => '')] })
  }

  const removeRow = (ri: number) => {
    onUpdate({ rows: block.rows.filter((_, j) => j !== ri) })
  }

  return (
    <div className="min-w-0">
      <BlockChrome label="Table" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      <div className={CARD}>
        <TitleHeaderStrip
          accentClass="bg-[#60a5fa]"
          value={block.title ?? ''}
          onChange={v => onUpdate({ title: v || null })}
        />
        <div className={CARD_BODY}>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={addColumn}>
              + Col
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[11px]"
              onClick={removeLastColumn}
              disabled={block.headers.length <= 1}
            >
              − Col
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-7 text-[11px]" onClick={addRow}>
              + Row
            </Button>
          </div>
          <div className="overflow-x-auto rounded border border-[#2a2a2a] bg-[#141414]">
            <table className="w-full border-collapse text-[13px] min-w-[280px]">
              <thead>
                <tr>
                  {block.headers.map((h, hi) => (
                    <th
                      key={hi}
                      className="text-left font-medium text-[11px] text-neutral-500 p-0 border-b border-[#2a2a2a] align-bottom"
                    >
                      <input
                        value={h}
                        onChange={e => {
                          const headers = [...block.headers]
                          headers[hi] = e.target.value
                          onUpdate({ headers })
                        }}
                        className="w-full min-w-[72px] bg-transparent text-neutral-400 placeholder:text-neutral-600 px-2.5 py-2 text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-inset focus:ring-neutral-600"
                        placeholder={`Col ${hi + 1}`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((cells, ri) => (
                  <tr key={ri} className="border-b border-[#222222] last:border-b-0">
                    {cells.map((c, ci) => (
                      <td key={ci} className="p-0 align-top">
                        <input
                          value={c}
                          onChange={e => {
                            const rows = block.rows.map((r, rj) =>
                              rj === ri
                                ? r.map((cell, ck) => (ck === ci ? e.target.value : cell))
                                : r,
                            )
                            onUpdate({ rows })
                          }}
                          className="w-full min-w-[72px] bg-transparent text-[#d1d1d1] px-2.5 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-neutral-600"
                        />
                      </td>
                    ))}
                    <td className="w-8 p-0 align-middle border-l border-[#2a2a2a] bg-[#161616]">
                      <button
                        type="button"
                        className="w-full py-2 text-red-400/70 hover:text-red-400 text-xs"
                        onClick={() => removeRow(ri)}
                        aria-label="Remove row"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function DividerEditor(props: {
  index: number
  total: number
  onMove: (dir: -1 | 1) => void
  onRemove: () => void
}) {
  const { index, total, onMove, onRemove } = props
  return (
    <div className="min-w-0">
      <BlockChrome label="Divider" index={index} total={total} onMove={onMove} onRemove={onRemove} />
      <div className="rounded-lg border border-[#2a2a2a] bg-[#141414]/50 px-[18px] py-4">
        <div className="border-t border-[#2a2a2a]" />
      </div>
    </div>
  )
}

export interface CustomTemplateBlocksEditorProps {
  blocks: CustomEmailBlock[]
  mergeKeyOptions: readonly string[]
  blockMenuOpen: boolean
  onBlockMenuOpenChange: (open: boolean) => void
  onAddBlock: (kind: CustomEmailBlock['kind']) => void
  onUpdateBlock: (index: number, patch: Partial<CustomEmailBlock>) => void
  onMoveBlock: (index: number, dir: -1 | 1) => void
  onRemoveBlock: (index: number) => void
}

export function CustomTemplateBlocksEditorSection(props: CustomTemplateBlocksEditorProps) {
  const {
    blocks,
    mergeKeyOptions,
    blockMenuOpen,
    onBlockMenuOpenChange,
    onAddBlock,
    onUpdateBlock,
    onMoveBlock,
    onRemoveBlock,
  } = props
  const total = blocks.length

  return (
    <div className="border border-neutral-800 rounded-lg p-3 bg-neutral-900/50">
      <div className="flex items-center justify-between gap-2">
        <p className={EYEBROW}>Blocks</p>
        <span className="text-xs text-neutral-500">{total} block{total === 1 ? '' : 's'}</span>
      </div>
      <div className="relative mt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs w-full"
          onClick={() => onBlockMenuOpenChange(!blockMenuOpen)}
        >
          + Add block
        </Button>
        {blockMenuOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 z-10 rounded-md border border-neutral-700 bg-neutral-950 shadow-lg py-1">
            {(['prose', 'bullet_list', 'key_value', 'table', 'divider'] as const).map(k => (
              <button
                key={k}
                type="button"
                className="w-full text-left px-3 py-2 text-xs hover:bg-neutral-800 capitalize"
                onClick={() => onAddBlock(k)}
              >
                {k.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="space-y-4 mt-4">
        {blocks.map((block, i) => {
          const move = (dir: -1 | 1) => onMoveBlock(i, dir)
          const remove = () => onRemoveBlock(i)
          const update = (patch: Partial<CustomEmailBlock>) => onUpdateBlock(i, patch)

          switch (block.kind) {
            case 'prose':
              return (
                <ProseEditor
                  key={i}
                  block={block}
                  index={i}
                  total={total}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                />
              )
            case 'bullet_list':
              return (
                <BulletListEditor
                  key={i}
                  block={block}
                  index={i}
                  total={total}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                />
              )
            case 'key_value':
              return (
                <KeyValueEditor
                  key={i}
                  block={block}
                  index={i}
                  total={total}
                  mergeKeyOptions={mergeKeyOptions}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                />
              )
            case 'table':
              return (
                <TableEditor
                  key={i}
                  block={block}
                  index={i}
                  total={total}
                  onUpdate={update}
                  onMove={move}
                  onRemove={remove}
                />
              )
            case 'divider':
              return (
                <DividerEditor key={i} index={i} total={total} onMove={move} onRemove={remove} />
              )
            default:
              return null
          }
        })}
      </div>
    </div>
  )
}
