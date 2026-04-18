import type { FolderAccent } from '@/types'

/** Short labels for color picker / a11y. */
export const FOLDER_ACCENT_LABELS: Record<FolderAccent, string> = {
  default: 'Default',
  slate: 'Slate',
  amber: 'Amber',
  emerald: 'Emerald',
  sky: 'Sky',
  rose: 'Rose',
  violet: 'Violet',
  orange: 'Orange',
}

/** Folder card border + ring on drag-over. */
export const FOLDER_ACCENT_FOLDER_BORDER: Record<FolderAccent, string> = {
  default: 'border-neutral-800',
  slate: 'border-slate-600',
  amber: 'border-amber-600/80',
  emerald: 'border-emerald-600/80',
  sky: 'border-sky-600/80',
  rose: 'border-rose-600/80',
  violet: 'border-violet-600/80',
  orange: 'border-orange-600/80',
}

export const FOLDER_ACCENT_FOLDER_ICON: Record<FolderAccent, string> = {
  default: 'text-amber-500/90',
  slate: 'text-slate-400',
  amber: 'text-amber-400',
  emerald: 'text-emerald-400',
  sky: 'text-sky-400',
  rose: 'text-rose-400',
  violet: 'text-violet-400',
  orange: 'text-orange-400',
}

export const FOLDER_ACCENT_DROP_RING: Record<FolderAccent, string> = {
  default: 'ring-2 ring-neutral-500 ring-offset-2 ring-offset-neutral-950',
  slate: 'ring-2 ring-slate-500 ring-offset-2 ring-offset-neutral-950',
  amber: 'ring-2 ring-amber-500 ring-offset-2 ring-offset-neutral-950',
  emerald: 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-neutral-950',
  sky: 'ring-2 ring-sky-500 ring-offset-2 ring-offset-neutral-950',
  rose: 'ring-2 ring-rose-500 ring-offset-2 ring-offset-neutral-950',
  violet: 'ring-2 ring-violet-500 ring-offset-2 ring-offset-neutral-950',
  orange: 'ring-2 ring-orange-500 ring-offset-2 ring-offset-neutral-950',
}
