import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Banknote,
  Workflow,
  TrendingUp,
  FileText,
  FolderOpen,
  FileBarChart2,
  Inbox,
  MailOpen,
  Settings2,
  LogOut,
  X,
  LayoutTemplate,
  ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/',                    label: 'Overview',      icon: LayoutDashboard, end: true  },
      { to: '/outreach',            label: 'Outreach',      icon: Building2,       end: false },
      { to: '/pipeline',            label: 'Pipeline',      icon: Workflow,        end: false },
      { to: '/earnings',            label: 'Earnings',      icon: Banknote,        end: false },
      { to: '/metrics',             label: 'Metrics',       icon: TrendingUp,      end: false },
      { to: '/performance-reports', label: 'Show Reports',  icon: ClipboardList,   end: false },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/templates', label: 'Templates', icon: FileText,   end: false },
      { to: '/files',     label: 'Files',     icon: FolderOpen, end: false },
    ],
  },
  {
    label: 'Email',
    items: [
      { to: '/reports',         label: 'Reports',         icon: FileBarChart2, end: false },
      { to: '/email-queue',     label: 'Email Queue',     icon: Inbox,         end: false },
      { to: '/email-templates', label: 'Email Templates', icon: MailOpen,      end: false },
    ],
  },
]

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth()
  const location = useLocation()
  const onPipelinePath = location.pathname.startsWith('/pipeline')

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-12 px-4 flex items-center border-b border-[hsl(var(--sidebar-border))]">
        <div className="flex items-center justify-between w-full">
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
      <div className="flex-1 py-3 px-2 overflow-y-auto space-y-5">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-widest text-[hsl(var(--sidebar-muted))] opacity-50 select-none">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end }) => (
                <div key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
                        (isActive || (to === '/pipeline' && onPipelinePath))
                          ? 'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg))]'
                          : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))]'
                      )
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </NavLink>
                  {/* Pipeline sub-item: Task Templates */}
                  {to === '/pipeline' && onPipelinePath && (
                    <NavLink
                      to="/pipeline/templates"
                      end
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2.5 pl-9 pr-3 py-1.5 rounded text-xs transition-colors mt-0.5',
                          isActive
                            ? 'text-[hsl(var(--sidebar-fg))]'
                            : 'text-[hsl(var(--sidebar-muted))] hover:text-[hsl(var(--sidebar-fg))]'
                        )
                      }
                    >
                      <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
                      Task Templates
                    </NavLink>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Bottom: settings + sign out */}
      <div className="px-2 pb-4 border-t border-[hsl(var(--sidebar-border))] pt-3 space-y-0.5">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors',
              isActive
                ? 'bg-[hsl(var(--sidebar-active))] text-[hsl(var(--sidebar-fg))]'
                : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))]'
            )
          }
        >
          <Settings2 className="h-4 w-4 shrink-0" />
          Settings
        </NavLink>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 px-3 py-2 rounded text-sm text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))] transition-colors"
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
