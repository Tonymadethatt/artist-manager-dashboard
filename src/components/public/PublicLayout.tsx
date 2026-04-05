import type { ReactNode } from 'react'

interface PublicLayoutProps {
  children: ReactNode
  title: string
}

export function PublicLayout({ children, title }: PublicLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top bar */}
      <header className="border-b border-neutral-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-sm font-semibold text-white tracking-tight">DJ Luijay</span>
          <a
            href="mailto:management@djluijay.live"
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            management@djluijay.live
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl font-bold text-white mb-2">{title}</h1>
        <p className="text-xs text-neutral-600 mb-10 border-b border-neutral-800 pb-6">
          Last updated: April 2026
        </p>
        <div className="prose-content space-y-6 text-neutral-300 text-sm leading-relaxed">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-800 px-6 py-6 mt-16">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span className="text-xs text-neutral-600">DJ Luijay · All rights reserved</span>
          <div className="flex items-center gap-4 text-xs text-neutral-600">
            <a href="/terms" className="hover:text-neutral-400 transition-colors">Terms of Service</a>
            <a href="/privacy" className="hover:text-neutral-400 transition-colors">Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
