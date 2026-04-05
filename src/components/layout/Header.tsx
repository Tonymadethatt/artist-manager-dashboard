import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview',
  '/outreach': 'Outreach',
  '/templates': 'Templates',
  '/files': 'Files',
  '/expenses': 'Expenses',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation()

  const title = Object.entries(PAGE_TITLES)
    .reverse()
    .find(([path]) => location.pathname.startsWith(path))?.[1] ?? 'Artist Manager'

  return (
    <header className="h-12 border-b border-neutral-200 flex items-center px-4 gap-3 bg-white sticky top-0 z-10">
      <button
        className="md:hidden p-1 rounded hover:bg-neutral-100 transition-colors"
        onClick={onMenuClick}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5 text-neutral-600" />
      </button>
      <h1 className="text-sm font-semibold text-neutral-900">{title}</h1>
    </header>
  )
}
