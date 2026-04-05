import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Outreach from '@/pages/Outreach'
import Templates from '@/pages/Templates'
import Files from '@/pages/Files'
import FileBuilder from '@/pages/FileBuilder'
import Expenses from '@/pages/Expenses'
import { supabaseConfigured } from '@/lib/supabase'

// #region agent log
fetch('http://127.0.0.1:7531/ingest/431e0d54-5baa-40c3-ab30-a7f4f3fcf67b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'b97826'},body:JSON.stringify({sessionId:'b97826',location:'App.tsx:12',message:'app init',data:{supabaseConfigured},timestamp:Date.now(),hypothesisId:'H2'})}).catch(()=>{});
// #endregion

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
          <Route path="/templates" element={<Templates />} />
          <Route path="/files" element={<Files />} />
          <Route path="/files/new" element={<FileBuilder />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
