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
      {/* Wordmark */}
      <div className="h-12 px-4 flex items-center border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="flex items-center justify-between w-full">
          <div className="flex flex-col leading-none">
            <span className="text-white font-bold text-[13px] tracking-[0.12em] uppercase">
              The Office
            </span>
            <span className="text-[hsl(var(--sidebar-muted))] text-[9px] tracking-[0.08em] uppercase mt-0.5 font-medium">
              Artist Management
            </span>
          </div>
          <button
            onClick={onClose}
            className="md:hidden text-[hsl(var(--sidebar-muted))] hover:text-white transition-colors p-1 -mr-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 py-4 px-2 overflow-y-auto space-y-6">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            <p className="px-3 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--sidebar-muted))] opacity-40 select-none">
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
                        'relative flex items-center gap-2.5 pl-3 pr-3 py-[7px] rounded text-sm transition-all duration-150',
                        (isActive || (to === '/pipeline' && onPipelinePath))
                          ? 'bg-[hsl(var(--sidebar-active))] text-white'
                          : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200'
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active left accent */}
                        {(isActive || (to === '/pipeline' && onPipelinePath)) && (
                          <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-white/70 rounded-full" />
                        )}
                        <Icon className={cn(
                          'h-[15px] w-[15px] shrink-0 transition-colors',
                          (isActive || (to === '/pipeline' && onPipelinePath)) ? 'text-white' : 'text-[hsl(var(--sidebar-muted))]'
                        )} />
                        <span className="text-[13px] font-medium tracking-[0.01em]">{label}</span>
                      </>
                    )}
                  </NavLink>

                  {/* Pipeline sub-item: Task Templates */}
                  {to === '/pipeline' && onPipelinePath && (
                    <NavLink
                      to="/pipeline/templates"
                      end
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 pl-[38px] pr-3 py-1.5 rounded text-[12px] transition-colors mt-0.5',
                          isActive
                            ? 'text-neutral-200'
                            : 'text-[hsl(var(--sidebar-muted))] hover:text-neutral-300'
                        )
                      }
                    >
                      <LayoutTemplate className="h-3 w-3 shrink-0 opacity-70" />
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
      <div className="px-2 pb-4 pt-3 border-t border-[hsl(var(--sidebar-border))] space-y-0.5 shrink-0">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-2.5 pl-3 pr-3 py-[7px] rounded text-[13px] font-medium transition-all duration-150',
              isActive
                ? 'bg-[hsl(var(--sidebar-active))] text-white'
                : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-white/70 rounded-full" />}
              <Settings2 className={cn('h-[15px] w-[15px] shrink-0', isActive ? 'text-white' : 'text-[hsl(var(--sidebar-muted))]')} />
              Settings
            </>
          )}
        </NavLink>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-2.5 pl-3 pr-3 py-[7px] rounded text-[13px] font-medium text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200 transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
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
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-52 bg-[hsl(var(--sidebar-bg))] flex flex-col shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  )
}
