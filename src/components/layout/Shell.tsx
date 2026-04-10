import { useState, useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useAutoSendQueue } from '@/hooks/useAutoSendQueue'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { NavBadgesProvider } from '@/context/NavBadgesContext'

const PAGE_TITLES: Record<string, string> = {
  '/':                    'Dashboard',
  '/calendar':            'Calendar',
  '/outreach':            'Outreach',
  '/pipeline':            'Pipeline',
  '/pipeline/templates':  'Task Templates',
  '/earnings':            'Earnings',
  '/metrics':             'Metrics',
  '/performance-reports': 'Show Reports',
  '/performance-reports/manual': 'Manual Show Report',
  '/templates':           'Templates',
  '/files':               'Files',
  '/files/new':           'New File',
  '/reports':             'Reports',
  '/email-queue':         'Email Queue',
  '/email-templates':     'Email Templates',
  '/settings':            'Settings',
  '/forms/preview':       'Forms preview',
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
    return <Navigate to="/login" replace />
  }

  return (
    <NavBadgesProvider pathname={location.pathname}>
      <div className="flex h-screen overflow-hidden bg-neutral-950">
        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Header onMenuClick={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </NavBadgesProvider>
  )
}
