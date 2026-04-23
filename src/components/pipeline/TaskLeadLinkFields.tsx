import { Link } from 'react-router-dom'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { LeadFolderRow } from '@/hooks/useLeadFolders'
import type { LeadWithMeta } from '@/hooks/useLeads'

export type TaskLeadLinkMode = 'none' | 'single' | 'folder' | 'all'

export interface TaskLeadLinkValue {
  mode: TaskLeadLinkMode
  lead_id: string
  lead_folder_id: string
}

type Props = {
  disabled: boolean
  value: TaskLeadLinkValue
  onChange: (next: TaskLeadLinkValue) => void
  folders: LeadFolderRow[]
  leads: LeadWithMeta[]
  /** When the parent links a venue or deal, lead fields are inert. */
  hasVenueOrDeal: boolean
}

const MODE_NONE = '__none__'

export function TaskLeadLinkFields({
  disabled,
  value,
  onChange,
  folders,
  leads,
  hasVenueOrDeal,
}: Props) {
  const block = disabled || hasVenueOrDeal
  const modeSelect = hasVenueOrDeal ? MODE_NONE : (value.mode === 'none' ? MODE_NONE : value.mode)
  const leadsSorted = [...leads].sort((a, b) =>
    (a.venue_name ?? '').localeCompare(b.venue_name ?? '', undefined, { sensitivity: 'base' }),
  )

  return (
    <div className={cn('space-y-2 rounded-md border border-neutral-800/80 p-2.5 bg-neutral-950/40', block && 'opacity-50')}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Link to lead</p>
        <Link
          to="/forms/lead-intake"
          className="text-[10px] text-neutral-500 hover:text-neutral-300 underline-offset-2 hover:underline shrink-0"
        >
          Lead Intake
        </Link>
      </div>
      {hasVenueOrDeal ? (
        <p className="text-[10px] text-neutral-500 leading-snug">
          Clear venue and deal links above to use lead outreach tasks.
        </p>
      ) : null}
      <div className="space-y-1">
        <Label className="text-xs text-neutral-400">Target</Label>
        <Select
          value={modeSelect}
          onValueChange={v => {
            if (v === MODE_NONE) {
              onChange({ mode: 'none', lead_id: '', lead_folder_id: '' })
              return
            }
            if (v === 'single') {
              const first = leadsSorted[0]?.id ?? ''
              onChange({ mode: 'single', lead_id: first, lead_folder_id: '' })
              return
            }
            if (v === 'folder') {
              const firstF = folders[0]?.id ?? ''
              onChange({ mode: 'folder', lead_id: '', lead_folder_id: firstF })
              return
            }
            onChange({ mode: 'all', lead_id: '', lead_folder_id: '' })
          }}
          disabled={block}
        >
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="No lead link" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MODE_NONE}>No lead link</SelectItem>
            <SelectItem value="single">One lead</SelectItem>
            <SelectItem value="folder" disabled={folders.length === 0}>
              All leads in a folder{folders.length === 0 ? ' (add folders in Lead Intake)' : ''}
            </SelectItem>
            <SelectItem value="all">All my leads (bulk — use with caution)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.mode === 'single' && !block ? (
        <div className="space-y-1">
          <Label className="text-xs text-neutral-400">Lead</Label>
          <Select
            value={value.lead_id || (leadsSorted[0]?.id ?? '')}
            onValueChange={v => onChange({ ...value, lead_id: v })}
            disabled={block || leadsSorted.length === 0}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder={leadsSorted.length ? 'Select lead' : 'No leads yet'} />
            </SelectTrigger>
            <SelectContent>
              {leadsSorted.map(l => (
                <SelectItem key={l.id} value={l.id}>
                  {l.venue_name?.trim() || '—'}
                  {l.city ? ` — ${l.city}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
      {value.mode === 'folder' && !block ? (
        <div className="space-y-1">
          <Label className="text-xs text-neutral-400">Folder</Label>
          <Select
            value={value.lead_folder_id || (folders[0]?.id ?? '')}
            onValueChange={v => onChange({ ...value, lead_folder_id: v })}
            disabled={block || folders.length === 0}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Select folder" />
            </SelectTrigger>
            <SelectContent>
              {folders.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  )
}

export function buildLeadTaskColumns(
  hasVenueContext: boolean,
  lead: TaskLeadLinkValue,
): { lead_id: string | null; lead_folder_id: string | null; lead_send_all: boolean } {
  if (hasVenueContext) {
    return { lead_id: null, lead_folder_id: null, lead_send_all: false }
  }
  if (lead.mode === 'all') {
    return { lead_id: null, lead_folder_id: null, lead_send_all: true }
  }
  if (lead.mode === 'folder') {
    return { lead_id: null, lead_folder_id: lead.lead_folder_id || null, lead_send_all: false }
  }
  if (lead.mode === 'single') {
    return { lead_id: lead.lead_id || null, lead_folder_id: null, lead_send_all: false }
  }
  return { lead_id: null, lead_folder_id: null, lead_send_all: false }
}

export function leadTaskColumnsToFormValue(
  t: { lead_id: string | null; lead_folder_id: string | null; lead_send_all: boolean | null | undefined },
): TaskLeadLinkValue {
  if (t.lead_send_all) {
    return { mode: 'all', lead_id: '', lead_folder_id: '' }
  }
  if (t.lead_folder_id) {
    return { mode: 'folder', lead_id: '', lead_folder_id: t.lead_folder_id }
  }
  if (t.lead_id) {
    return { mode: 'single', lead_id: t.lead_id, lead_folder_id: '' }
  }
  return { mode: 'none', lead_id: '', lead_folder_id: '' }
}
