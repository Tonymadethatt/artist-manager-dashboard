import { useEffect, useState } from 'react'
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
  PhoneForwarded,
  ListChecks,
  ChevronDown,
  FlaskConical,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useNavBadges } from '@/context/NavBadgesContext'
import { useArtistProfile } from '@/hooks/useArtistProfile'

type NavGroupId = 'workspace' | 'content' | 'forms' | 'email'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badgeKey: string | null
}

const NAV_GROUPS: Array<{ id: NavGroupId; label: string; items: NavItem[] }> = [
  {
    id: 'workspace',
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
    id: 'content',
    label: 'Content',
    items: [
      { to: '/templates', label: 'Documents', icon: FileText,   end: false, badgeKey: null },
      { to: '/files',     label: 'Files',     icon: FolderOpen, end: false, badgeKey: null },
    ],
  },
  {
    id: 'forms',
    label: 'Forms',
    items: [
      { to: '/forms/preview', label: 'Preview', icon: Eye, end: false, badgeKey: null },
      { to: '/forms/intakes', label: 'Intakes', icon: Mic2, end: false, badgeKey: null },
      { to: '/forms/cold-calls', label: 'Cold calls', icon: PhoneForwarded, end: false, badgeKey: null },
      { to: '/workspace/partnerships', label: 'Previous clients', icon: ListChecks, end: false, badgeKey: null },
    ],
  },
  {
    id: 'email',
    label: 'Email',
    items: [
      { to: '/reports',         label: 'Reports',         icon: FileBarChart2, end: false, badgeKey: null          },
      { to: '/email-queue',     label: 'Email Queue',     icon: Inbox,         end: false, badgeKey: 'email-queue' },
      { to: '/email-templates', label: 'Email Templates', icon: MailOpen,      end: false, badgeKey: null          },
    ],
  },
]

/** v2: default all groups expanded; state persists per device until the user changes it. */
const SIDEBAR_GROUPS_STORAGE_KEY = 'artist-manager-sidebar-groups-v2'

const DEFAULT_EXPANDED: Record<NavGroupId, boolean> = {
  workspace: true,
  content: true,
  forms: true,
  email: true,
}

function loadExpandedGroupsFromStorage(): Record<NavGroupId, boolean> {
  try {
    const raw = localStorage.getItem(SIDEBAR_GROUPS_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_EXPANDED }
    const parsed = JSON.parse(raw) as Partial<Record<NavGroupId, boolean>>
    const out = { ...DEFAULT_EXPANDED }
    for (const g of NAV_GROUPS) {
      if (typeof parsed[g.id] === 'boolean') out[g.id] = parsed[g.id] as boolean
    }
    return out
  } catch {
    return { ...DEFAULT_EXPANDED }
  }
}

/** Vibrant gradient text (bg-clip) + chevron + vertical active-indicator stops (gradient-to-b) */
const CATEGORY_TITLE_STYLE: Record<
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

interface SidebarProps {
  mobileOpen: boolean
  onClose: () => void
}

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  const { signOut } = useAuth()
  const location = useLocation()
  const onPipelinePath = location.pathname.startsWith('/pipeline')
  const { counts } = useNavBadges()
  const { profile, updateProfile } = useArtistProfile()
  const [testModeBusy, setTestModeBusy] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<NavGroupId, boolean>>(loadExpandedGroupsFromStorage)

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_GROUPS_STORAGE_KEY, JSON.stringify(expandedGroups))
    } catch {
      /* ignore quota / private mode */
    }
  }, [expandedGroups])

  const toggleEmailTestMode = async () => {
    if (!profile || testModeBusy) return
    const next = !profile.email_test_mode
    if (next) {
      const a = profile.email_test_artist_inbox?.trim() ?? ''
      const c = profile.email_test_client_inbox?.trim() ?? ''
      const artist = profile.artist_email?.trim().toLowerCase() ?? ''
      if (!a.includes('@') || !c.includes('@')) {
        return
      }
      if (a.toLowerCase() === c.toLowerCase()) {
        return
      }
      if (artist && a.toLowerCase() === artist) {
        return
      }
      if (artist && c.toLowerCase() === artist) {
        return
      }
    }
    setTestModeBusy(true)
    await updateProfile({ email_test_mode: next })
    setTestModeBusy(false)
  }

  const navContent = (
    <nav className="flex flex-col h-full">
      {/* Wordmark */}
      <div className="h-11 px-3 flex items-center border-b border-[hsl(var(--sidebar-border))] shrink-0">
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

      {/* Nav groups (scrolls); test mode is pinned below this strip */}
      <div
        className={cn(
          'flex-1 min-h-0 py-2 px-1.5 overflow-y-auto space-y-1.5',
          '[scrollbar-width:none] [-ms-overflow-style:none]',
          '[&::-webkit-scrollbar]:w-0 [&::-webkit-scrollbar]:h-0'
        )}
      >
        {NAV_GROUPS.map((group) => {
          const isOpen = expandedGroups[group.id]
          const sectionId = `nav-section-${group.id}`
          return (
            <div
              key={group.id}
              className={cn(
                'flex flex-col gap-0.5 rounded-lg border border-white/[0.07] bg-black/20 p-0.5',
                'shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'
              )}
            >
              <button
                type="button"
                id={`${sectionId}-label`}
                aria-expanded={isOpen}
                aria-controls={sectionId}
                onClick={() =>
                  setExpandedGroups((p) => ({
                    ...p,
                    [group.id]: !p[group.id],
                  }))
                }
                className={cn(
                  'flex w-full items-center gap-0.5 px-1 py-0.5 rounded-md text-left text-[9.5px] font-semibold uppercase tracking-[0.14em] select-none',
                  'hover:bg-white/[0.06] transition-colors'
                )}
              >
                <ChevronDown
                  className={cn(
                    CATEGORY_TITLE_STYLE[group.id].chevron,
                    'h-3 w-3 shrink-0 opacity-95 transition-transform duration-150',
                    !isOpen && '-rotate-90'
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'truncate min-w-0 bg-clip-text text-transparent',
                    CATEGORY_TITLE_STYLE[group.id].label
                  )}
                >
                  {group.label}
                </span>
              </button>
              <div id={sectionId} role="region" aria-labelledby={`${sectionId}-label`} hidden={!isOpen}>
                <div className="flex flex-col gap-px pb-px">
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
                              'relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded text-sm transition-all duration-150',
                              (isActive || (to === '/pipeline' && onPipelinePath))
                                ? 'bg-[hsl(var(--sidebar-active))] text-white'
                                : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200'
                            )
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {(isActive || (to === '/pipeline' && onPipelinePath)) && (
                                <span
                                  className={cn(
                                    'sidebar-active-indicator absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full bg-gradient-to-b',
                                    CATEGORY_TITLE_STYLE[group.id].indicator
                                  )}
                                  aria-hidden
                                />
                              )}
                              <Icon
                                className={cn(
                                  'h-[15px] w-[15px] shrink-0 transition-colors',
                                  (isActive || (to === '/pipeline' && onPipelinePath))
                                    ? 'text-white'
                                    : 'text-[hsl(var(--sidebar-muted))]'
                                )}
                              />
                              <span className="text-[12px] font-medium tracking-[0.01em] truncate flex-1 min-w-0">{label}</span>
                              {badgeCount > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold bg-red-600 text-white leading-none shrink-0">
                                  {badgeCount > 99 ? '99+' : badgeCount}
                                </span>
                              )}
                            </>
                          )}
                        </NavLink>

                        {to === '/pipeline' && onPipelinePath && (
                          <NavLink
                            to="/pipeline/templates"
                            end
                            onClick={onClose}
                            className={({ isActive }) =>
                              cn(
                                'relative flex items-center gap-1.5 pl-2 pr-1.5 py-0.5 rounded text-[12px] transition-colors',
                                isActive
                                  ? 'text-neutral-200'
                                  : 'text-[hsl(var(--sidebar-muted))] hover:text-neutral-300'
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                {isActive && (
                                  <span
                                    className={cn(
                                      'sidebar-active-indicator absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full bg-gradient-to-b',
                                      CATEGORY_TITLE_STYLE[group.id].indicator
                                    )}
                                    aria-hidden
                                  />
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
            </div>
          )
        })}
      </div>

      {/* Email test mode — pinned above settings (does not scroll with nav) */}
      <div className="shrink-0 px-1.5 pt-1.5 pb-2 border-t border-white/[0.06]">
        <div className="flex items-center gap-1 min-w-0">
          <FlaskConical
            className={cn(
              'h-3.5 w-3.5 shrink-0',
              profile?.email_test_mode ? 'text-orange-400' : 'text-[hsl(var(--sidebar-muted))]'
            )}
            aria-hidden
          />
          <span
            className={cn(
              'text-[8px] font-semibold uppercase tracking-wide shrink-0 w-[18px]',
              !profile?.email_test_mode ? 'text-neutral-200' : 'text-[hsl(var(--sidebar-muted))]'
            )}
          >
            Off
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={!!profile?.email_test_mode}
            aria-label="Email test mode"
            disabled={testModeBusy || !profile}
            onClick={() => void toggleEmailTestMode()}
            className={cn(
              'relative mx-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(var(--sidebar-bg))]',
              profile?.email_test_mode ? 'bg-orange-500' : 'bg-neutral-600',
              (testModeBusy || !profile) && 'opacity-45 cursor-not-allowed'
            )}
          >
            <span
              className={cn(
                'pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out',
                profile?.email_test_mode ? 'translate-x-4' : 'translate-x-0'
              )}
              aria-hidden
            />
          </button>
          <span
            className={cn(
              'text-[8px] font-semibold uppercase tracking-wide shrink-0 w-[18px] text-right',
              profile?.email_test_mode ? 'text-orange-300' : 'text-[hsl(var(--sidebar-muted))]'
            )}
          >
            On
          </span>
        </div>
      </div>

      {/* Bottom: settings + sign out */}
      <div className="px-1.5 pb-2 pt-1.5 border-t border-[hsl(var(--sidebar-border))] space-y-0 shrink-0">
        <NavLink
          to="/settings"
          onClick={onClose}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-1.5 pl-2 pr-1.5 py-1 rounded text-[12px] font-medium transition-all duration-150',
              isActive
                ? 'bg-[hsl(var(--sidebar-active))] text-white'
                : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200'
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && <span className="absolute left-0 top-0.5 bottom-0.5 w-[2px] bg-white/70 rounded-full" />}
              <Settings2 className={cn('h-[15px] w-[15px] shrink-0', isActive ? 'text-white' : 'text-[hsl(var(--sidebar-muted))]')} />
              Settings
            </>
          )}
        </NavLink>
        <button
          onClick={signOut}
          className="flex w-full items-center gap-1.5 pl-2 pr-1.5 py-1 rounded text-[12px] font-medium text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-neutral-200 transition-all duration-150"
        >
          <LogOut className="h-[15px] w-[15px] shrink-0" />
          Sign out
        </button>
      </div>
    </nav>
  )

  const asideFrameClass = cn(
    'flex flex-col w-36 bg-[hsl(var(--sidebar-bg))] border overflow-hidden',
    profile?.email_test_mode
      ? 'border-orange-500 sidebar-test-mode-outline'
      : 'border-white/[0.07]'
  )

  return (
    <>
      {/* Desktop sidebar — floating card */}
      <div className="hidden md:block py-3 pl-3 shrink-0">
        <aside className={cn(asideFrameClass, 'h-full rounded-2xl')}>
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
          <aside className={cn(asideFrameClass, 'absolute left-0 top-0 bottom-0 shadow-2xl rounded-r-2xl')}>
            {navContent}
          </aside>
        </div>
      )}
    </>
  )
}
