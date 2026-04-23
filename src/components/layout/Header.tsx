import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { HeaderAmbient } from './HeaderAmbient'
import { resolveNavGroupFromPath } from './navCategory'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/calendar': 'Calendar',
  '/outreach': 'Contacts',
  '/earnings': 'Deals',
  '/pipeline/templates': 'Templates',
  '/pipeline': 'Tasks',
  '/metrics': 'Metrics',
  '/performance-reports': 'Show Reports',
  '/performance-reports/manual': 'Manual Show Report',
  '/templates': 'Templates',
  '/files': 'Documents',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/email-queue': 'Email Queue',
  '/email-templates': 'Email Templates',
  '/forms/preview': 'General Forms',
  '/forms/intakes': 'Booking',
  '/forms/intake': 'Booking intake',
  '/forms/cold-calls': 'Cold calls',
  '/forms/lead-intake': 'Lead Intake',
  '/forms/cold-call': 'Cold call',
  '/workspace/partnerships': 'Previous Clients — Workspace',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()
  const zone = resolveNavGroupFromPath(location.pathname)

  const title =
    Object.entries(PAGE_TITLES)
      .sort((a, b) => b[0].length - a[0].length)
      .find(([path]) =>
        path === '/'
          ? location.pathname === '/'
          : location.pathname === path || location.pathname.startsWith(`${path}/`),
      )?.[1] ?? 'Artist Manager'

  return (
    <header
      className={cn(
        'relative flex min-h-11 items-center gap-3 overflow-hidden rounded-xl border border-neutral-600/90',
        'bg-neutral-950/92 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12)] sm:px-4 sm:py-3',
      )}
    >
      <HeaderAmbient zone={zone} />
      <button
        type="button"
        className="relative z-10 shrink-0 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800/80 hover:text-neutral-100 md:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <h1 className="relative z-10 min-w-0 truncate text-sm font-semibold tracking-tight text-neutral-100 drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)] sm:text-[15px]">
        {title}
      </h1>
    </header>
  )
}
