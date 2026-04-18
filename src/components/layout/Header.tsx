import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

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
  '/forms/cold-call': 'Cold call',
  '/workspace/partnerships': 'Previous Clients — Workspace',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()

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
        'flex min-h-11 items-center gap-3 rounded-xl border border-neutral-800/90',
        'bg-neutral-900/55 px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:px-4 sm:py-3',
      )}
    >
      <button
        type="button"
        className="shrink-0 rounded-lg p-2 text-neutral-400 transition-colors hover:bg-neutral-800/80 hover:text-neutral-100 md:hidden"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </button>
      <h1 className="min-w-0 truncate text-sm font-semibold tracking-tight text-neutral-100 sm:text-[15px]">
        {title}
      </h1>
    </header>
  )
}
