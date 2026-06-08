import React, { Suspense, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { ACCENT_KEY, applyDowAccent } from './pages/Preppy/constants'

const Preppy        = React.lazy(() => import('./pages/Preppy'))
const PrintX        = React.lazy(() => import('./pages/PrintX'))
const Reports       = React.lazy(() => import('./pages/Reports'))
const Debug         = React.lazy(() => import('./pages/Debug'))
const Settings      = React.lazy(() => import('./pages/Settings'))

export default function App() {
  // Keep DOW accent colour in sync with the clock — checks every minute so the
  // colour switches within 60 s of midnight without requiring an app restart.
  useEffect(() => {
    const iv = setInterval(() => {
      if ((localStorage.getItem(ACCENT_KEY) ?? 'green') === 'dow') applyDowAccent()
    }, 60_000)
    return () => clearInterval(iv)
  }, [])

  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="d-flex justify-content-center align-items-center vh-100">Loading…</div>}>
        <Routes>
          <Route path="/"        element={<Preppy />}  />
          <Route path="/printx"  element={<PrintX />}  />
          <Route path="/reports" element={<Reports />} />
          <Route path="/debug"    element={<Debug />}    />
          <Route path="/settings" element={<Settings />} />

          {/* Back-compat redirects — the old standalone settings pages are now tabs */}
          <Route path="/wifi"              element={<Navigate to="/settings?tab=network"     replace />} />
          <Route path="/preppy-settings"   element={<Navigate to="/settings?tab=general"     replace />} />
          <Route path="/printer-setup"     element={<Navigate to="/settings?tab=printer"     replace />} />
          <Route path="/label-calibration" element={<Navigate to="/settings?tab=calibration" replace />} />
          <Route path="/datetime-settings" element={<Navigate to="/settings?tab=datetime"    replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
