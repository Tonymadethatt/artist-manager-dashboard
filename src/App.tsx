import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Outreach from '@/pages/Outreach'
import Templates from '@/pages/Templates'
import Files from '@/pages/Files'
import FileBuilder from '@/pages/FileBuilder'
import Earnings from '@/pages/Earnings'
import Metrics from '@/pages/Metrics'
import Tasks from '@/pages/Tasks'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import EmailQueue from '@/pages/EmailQueue'
import { supabaseConfigured } from '@/lib/supabase'

function EnvErrorScreen() {
  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full">
        <div className="text-white font-bold text-lg mb-2">Artist Manager</div>
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-sm text-red-200 space-y-2">
          <p className="font-semibold text-red-100">Supabase not configured</p>
          <p>Set these environment variables in your Netlify site settings:</p>
          <ul className="list-disc list-inside space-y-1 font-mono text-xs text-red-300">
            <li>VITE_SUPABASE_URL</li>
            <li>VITE_SUPABASE_ANON_KEY</li>
          </ul>
          <p className="text-xs text-red-400 pt-1">Then redeploy. Get these values from your Supabase project → Settings → API.</p>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  if (!supabaseConfigured) return <EnvErrorScreen />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/files" element={<Files />} />
          <Route path="/files/new" element={<FileBuilder />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/email-queue" element={<EmailQueue />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
