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
  Eye,
  Calendar,
  Mic2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useNavBadges } from '@/context/NavBadgesContext'

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { to: '/',                    label: 'Overview',      icon: LayoutDashboard, end: true,  badgeKey: null              },
      { to: '/calendar',            label: 'Calendar',      icon: Calendar,        end: false, badgeKey: 'calendar'        },
      { to: '/outreach',            label: 'Outreach',      icon: Building2,       end: false, badgeKey: null              },
      { to: '/pipeline',            label: 'Tasks',         icon: Workflow,        end: false, badgeKey: 'pipeline'        },
      { to: '/earnings',            label: 'Deals',         icon: Banknote,        end: false, badgeKey: null              },
      { to: '/metrics',             label: 'Metrics',       icon: TrendingUp,      end: false, badgeKey: null              },
      { to: '/performance-reports', label: 'Show Reports',  icon: ClipboardList,   end: false, badgeKey: 'show-reports'    },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/templates', label: 'Documents', icon: FileText,   end: false, badgeKey: null },
      { to: '/files',     label: 'Files',     icon: FolderOpen, end: false, badgeKey: null },
    ],
  },
  {
    label: 'Forms',
    items: [
      { to: '/forms/preview', label: 'Preview', icon: Eye, end: false, badgeKey: null },
      { to: '/forms/intake', label: 'Intake', icon: Mic2, end: false, badgeKey: null },
    ],
  },
  {
    label: 'Email',
    items: [
      { to: '/reports',         label: 'Reports',         icon: FileBarChart2, end: false, badgeKey: null          },
      { to: '/email-queue',     label: 'Email Queue',     icon: Inbox,         end: false, badgeKey: 'email-queue' },
      { to: '/email-templates', label: 'Email Templates', icon: MailOpen,      end: false, badgeKey: null          },
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
  const { counts } = useNavBadges()

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Wordmark */}
      <div className="h-12 px-3 flex items-center border-b border-[hsl(var(--sidebar-border))] shrink-0">
        <div className="flex items-center justify-between w-full min-w-0">
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-white font-bold text-[13px] tracking-[0.12em] uppercase truncate">
              The Office
            </span>
            <span className="text-[hsl(var(--sidebar-muted))] text-[9px] tracking-[0.06em] uppercase mt-0.5 font-medium truncate">
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
            <p className="px-2 mb-1.5 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-[hsl(var(--sidebar-muted))] opacity-40 select-none">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end, badgeKey }) => {
                const badgeCount = badgeKey ? (counts[badgeKey as keyof typeof counts] ?? 0) : 0
                return (
                <div key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      cn(
                        'relative flex items-center gap-2 pl-2.5 pr-2.5 py-[7px] rounded text-sm transition-all duration-150',
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
                        <span className="text-[12px] font-medium tracking-[0.01em] truncate flex-1 min-w-0">{label}</span>
                        {badgeCount > 0 && (
                          <span className="ml-auto inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold bg-red-600 text-white leading-none shrink-0">
                            {badgeCount > 99 ? '99+' : badgeCount}
                          </span>
                        )}
                      </>
                    )}
                  </NavLink>

                  {/* Tasks sub-item: Templates (same horizontal rhythm as parent row, no deep indent) */}
                  {to === '/pipeline' && onPipelinePath && (
                    <NavLink
                      to="/pipeline/templates"
                      end
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'relative flex items-center gap-2 pl-2.5 pr-2.5 py-1.5 rounded text-[12px] transition-colors mt-0.5',
                          isActive
                            ? 'text-neutral-200'
                            : 'text-[hsl(var(--sidebar-muted))] hover:text-neutral-300'
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span className="absolute left-0 top-1 bottom-1 w-[2px] bg-white/40 rounded-full" />
                          )}
                          <span className="flex h-[15px] w-[15px] shrink-0 items-center justify-center" aria-hidden>
                            <LayoutTemplate className="h-3 w-3 opacity-70" />
                          </span>
                          <span className="font-medium tracking-[0.01em] truncate flex-1 min-w-0">Templates</span>
                        </>
                      )}
                    </NavLink>
                  )}
                </div>
                )
              })}
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
              'relative flex items-center gap-2 pl-2.5 pr-2.5 py-[7px] rounded text-[12px] font-medium transition-all duration-150',
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
          className="flex w-full items-center gap-2 pl-2.5 pr-2.5 py-[7px] rounded text-[12px] font-medium text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200 transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  )

  return (
    <>
      {/* Desktop sidebar — floating card */}
      <div className="hidden md:block py-3 pl-3 shrink-0">
        <aside className="flex flex-col w-36 h-full bg-[hsl(var(--sidebar-bg))] rounded-2xl overflow-hidden border border-white/[0.07]">
          {navContent}
        </aside>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <aside className="absolute left-0 top-0 bottom-0 w-36 bg-[hsl(var(--sidebar-bg))] flex flex-col shadow-2xl">
            {navContent}
          </aside>
        </div>
      )}
    </>
  )
}
