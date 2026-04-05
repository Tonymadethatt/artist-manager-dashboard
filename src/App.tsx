import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Shell } from '@/components/layout/Shell'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import Outreach from '@/pages/Outreach'
import Templates from '@/pages/Templates'
import Files from '@/pages/Files'
import FileBuilder from '@/pages/FileBuilder'
import Expenses from '@/pages/Expenses'

export default function App() {
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
