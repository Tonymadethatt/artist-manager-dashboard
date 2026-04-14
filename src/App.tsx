import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PREVIOUS_CLIENTS_FORM_PATH } from '@/lib/shareUrls'
import { Shell } from '@/components/layout/Shell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import GigCalendarPage from '@/pages/GigCalendarPage'
import Outreach from '@/pages/Outreach'
import Templates from '@/pages/Templates'
import Files from '@/pages/Files'
import FileBuilder from '@/pages/FileBuilder'
import Earnings from '@/pages/Earnings'
import Metrics from '@/pages/Metrics'
import Pipeline from '@/pages/Pipeline'
import PipelineTemplates from '@/pages/PipelineTemplates'
import Reports from '@/pages/Reports'
import Settings from '@/pages/Settings'
import EmailQueue from '@/pages/EmailQueue'
import EmailTemplates from '@/pages/EmailTemplates'
import TermsPage from '@/pages/public/TermsPage'
import PrivacyPage from '@/pages/public/PrivacyPage'
import PerformanceReportForm from '@/pages/public/PerformanceReportForm'
import VenueEmailAckBridge from '@/pages/public/VenueEmailAckBridge'
import PerformanceReports from '@/pages/PerformanceReports'
import ManualShowReport from '@/pages/ManualShowReport'
import FormPreviews from '@/pages/FormPreviews'
import BookingIntakePage from '@/pages/BookingIntakePage'
import BookingIntakesHubPage from '@/pages/BookingIntakesHubPage'
import PartnershipRollAdminPage from '@/pages/PartnershipRollAdminPage'
import PublicPreviousClientsPage from '@/pages/public/PublicPreviousClientsPage'
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
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/performance-report/:token" element={<PerformanceReportForm />} />
        <Route path="/venue-email-ack/:token" element={<VenueEmailAckBridge />} />
        <Route path="/forms/intakes" element={<BookingIntakesHubPage />} />
        <Route path="/forms/intake" element={<BookingIntakePage />} />
        <Route path={PREVIOUS_CLIENTS_FORM_PATH} element={<PublicPreviousClientsPage />} />
        <Route path="/forms/partnerships" element={<Navigate to={PREVIOUS_CLIENTS_FORM_PATH} replace />} />

        <Route element={<Shell />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/calendar" element={<GigCalendarPage />} />
          <Route path="/outreach" element={<Outreach />} />
          <Route path="/earnings" element={<Earnings />} />
          <Route path="/tasks" element={<Navigate to="/pipeline" replace />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/pipeline/templates" element={<PipelineTemplates />} />
          <Route path="/metrics" element={<Metrics />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/files" element={<Files />} />
          <Route path="/files/new" element={<FileBuilder />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/email-queue" element={<EmailQueue />} />
          <Route path="/email-templates" element={<EmailTemplates />} />
          <Route path="/performance-reports" element={<PerformanceReports />} />
          <Route path="/performance-reports/manual" element={<ManualShowReport />} />
          <Route path="/forms/preview" element={<FormPreviews />} />
          <Route path="/workspace/partnerships" element={<PartnershipRollAdminPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
