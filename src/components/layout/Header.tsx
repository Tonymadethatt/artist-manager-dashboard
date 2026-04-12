import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/calendar': 'Calendar',
  '/outreach': 'Outreach',
  '/earnings': 'Deals',
  '/pipeline/templates': 'Task Templates',
  '/pipeline': 'Tasks',
  '/metrics': 'Metrics',
  '/templates': 'Documents',
  '/files': 'Files',
  '/reports': 'Reports',
  '/settings': 'Settings',
  '/email-queue': 'Email Queue',
  '/email-templates': 'Email Templates',
  '/forms/preview': 'Forms preview',
  '/forms/intake': 'Call intake',
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
    <header className="h-12 border-b border-neutral-800 flex items-center px-4 gap-3 bg-neutral-950 sticky top-0 z-10">
      <button
        className="md:hidden p-1 rounded hover:bg-neutral-800 transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-neutral-400" />
      </button>
      <h1 className="text-sm font-semibold text-neutral-100">{title}</h1>
    </header>
  )
}
