import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  MapPin,
  FileText,
  Files,
  DollarSign,
  BarChart2,
  CheckSquare,
  SendHorizonal,
  Settings,
  LogOut,
  X,
  Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const NAV_GROUPS = [
  {
    items: [
      { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
      { to: '/outreach', label: 'Outreach', icon: MapPin, end: false },
      { to: '/earnings', label: 'Earnings', icon: DollarSign, end: false },
      { to: '/tasks', label: 'Tasks', icon: CheckSquare, end: false },
      { to: '/metrics', label: 'Metrics', icon: BarChart2, end: false },
    ],
  },
  {
    items: [
      { to: '/templates', label: 'Templates', icon: FileText, end: false },
      { to: '/files', label: 'Files', icon: Files, end: false },
      { to: '/reports', label: 'Reports', icon: SendHorizonal, end: false },
      { to: '/email-queue', label: 'Email Queue', icon: Mail, end: false },
    ],
  },
  {
    items: [
      { to: '/settings', label: 'Settings', icon: Settings, end: false },
    ],
  },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth()

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-between">
          <span className="text-[hsl(var(--sidebar-fg))] font-bold text-sm tracking-tight">Artist Manager</span>
          <button
            onClick={onClose}
            className="md:hidden text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 py-3 px-2 overflow-y-auto space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} className="space-y-0.5">
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={onClose}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors',
                    isActive
                      ? 'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg))]'
                      : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))]'
                  )
                }
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </NavLink>
            ))}
            {gi < NAV_GROUPS.length - 1 && (
              <div className="h-px bg-[hsl(var(--sidebar-border))] mx-1 mt-2" />
            )}
          </div>
        ))}
      </div>

      {/* Sign out */}
      <div className="px-2 pb-4 border-t border-[hsl(var(--sidebar-border))] pt-3">
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2 rounded text-sm text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))] transition-colors"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-52 shrink-0 bg-[hsl(var(--sidebar-bg))] h-screen sticky top-0">
        {navContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={onClose}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-52 bg-[hsl(var(--sidebar-bg))] flex flex-col">
            {navContent}
          </aside>
        </div>
      )}
    </>
  )
}
