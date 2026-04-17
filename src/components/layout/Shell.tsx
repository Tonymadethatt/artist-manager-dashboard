import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAutoSendQueue } from '@/hooks/useAutoSendQueue'
import { useNavBadges } from '@/context/NavBadgesContext'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { NavBadgesProvider } from '@/context/NavBadgesContext'

const PAGE_TITLES: Record<string, string> = {
  '/':                    'Dashboard',
  '/calendar':            'Calendar',
  '/outreach':            'Outreach',
  '/pipeline':            'Tasks',
  '/pipeline/templates':  'Templates',
  '/earnings':            'Deals',
  '/metrics':             'Metrics',
  '/performance-reports': 'Show Reports',
  '/performance-reports/manual': 'Manual Show Report',
  '/templates':           'Documents',
  '/files':               'Files',
  '/files/new':           'New File',
  '/reports':             'Reports',
  '/email-queue':         'Email Queue',
  '/email-templates':     'Email Templates',
  '/settings':            'Settings',
  '/forms/preview':       'Forms preview',
  '/forms/intakes':       'Call intakes',
  '/forms/intake':        'Call intake',
  '/forms/cold-calls':    'Cold calls',
  '/forms/cold-call':     'Cold call',
  '/workspace/partnerships': 'Previous Clients — Workspace',
}

/**
 * Clears “new since last visit” badges when the user is actually in that workspace
 * (including sub-routes like /pipeline/templates and /performance-reports/manual).
 */
function NavBadgeSectionSync({ pathname }: { pathname: string }) {
  const { markSeen } = useNavBadges()
  useEffect(() => {
    const marks: Promise<void>[] = []
    if (pathname.startsWith('/pipeline')) marks.push(markSeen('pipeline'))
    if (pathname.startsWith('/calendar')) marks.push(markSeen('calendar'))
    if (pathname.startsWith('/performance-reports')) marks.push(markSeen('show-reports'))
    if (marks.length) void Promise.all(marks)
  }, [pathname, markSeen])
  return null
}

export function Shell() {
  const { user, loading } = useAuth()
  useAutoSendQueue()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const label = PAGE_TITLES[location.pathname] ?? 'The Office'
    document.title = `The Office — ${label}`
  }, [location.pathname])

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="w-5 h-5 border-2 border-neutral-300 border-t-neutral-900 rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`)
    return <Navigate to={`/login?return=${returnTo}`} replace />
  }

  return (
    <NavBadgesProvider pathname={location.pathname}>
      <NavBadgeSectionSync pathname={location.pathname} />
      <div className="flex h-screen overflow-hidden bg-neutral-950">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <div className="mx-auto w-full min-w-0 max-w-[min(100%,100rem)]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </NavBadgesProvider>
  )
}
