/**
 * Sidebar nav zones + shared route→zone resolution for header ambient, etc.
 */

export type NavGroupId = 'workspace' | 'content' | 'forms' | 'email'

/** Settings and similar: no saturated zone color */
export type NavZoneForAmbient = NavGroupId | 'neutral'

/** Vibrant gradient text (bg-clip) + chevron + vertical active-indicator stops (gradient-to-b) */
export const CATEGORY_TITLE_STYLE: Record<
  NavGroupId,
  { label: string; chevron: string; indicator: string }
> = {
  workspace: {
    label: 'bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500',
    chevron: 'text-cyan-300',
    indicator: 'from-cyan-400 via-sky-400 to-blue-500',
  },
  content: {
    label: 'bg-gradient-to-r from-fuchsia-400 via-purple-400 to-violet-500',
    chevron: 'text-fuchsia-300',
    indicator: 'from-fuchsia-400 via-purple-400 to-violet-500',
  },
  forms: {
    label: 'bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500',
    chevron: 'text-amber-300',
    indicator: 'from-amber-400 via-orange-400 to-rose-500',
  },
  email: {
    label: 'bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400',
    chevron: 'text-emerald-300',
    indicator: 'from-emerald-400 via-teal-400 to-cyan-400',
  },
}

/**
 * Longest-prefix match against dashboard shell routes (see App.tsx).
 * `/` → workspace; unknown paths default to workspace.
 */
export function resolveNavGroupFromPath(pathname: string): NavZoneForAmbient {
  const path = (pathname.split('?')[0] ?? '/').trim() || '/'
  if (path === '/') return 'workspace'

  const rules: { prefix: string; group: NavZoneForAmbient }[] = [
    { prefix: '/performance-reports', group: 'workspace' },
    { prefix: '/email-templates', group: 'email' },
    { prefix: '/email-queue', group: 'email' },
    { prefix: '/workspace', group: 'forms' },
    { prefix: '/templates', group: 'content' },
    { prefix: '/pipeline', group: 'workspace' },
    { prefix: '/calendar', group: 'workspace' },
    { prefix: '/outreach', group: 'workspace' },
    { prefix: '/earnings', group: 'workspace' },
    { prefix: '/settings', group: 'neutral' },
    { prefix: '/reports', group: 'email' },
    { prefix: '/metrics', group: 'workspace' },
    { prefix: '/forms', group: 'forms' },
    { prefix: '/files', group: 'content' },
  ]

  const sorted = [...rules].sort((a, b) => b.prefix.length - a.prefix.length)
  for (const { prefix, group } of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return group
  }
  return 'workspace'
}
