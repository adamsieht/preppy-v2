import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'

const Preppy        = React.lazy(() => import('./pages/Preppy'))
const PrintX        = React.lazy(() => import('./pages/PrintX'))
const WiFi          = React.lazy(() => import('./pages/WiFi'))
const Reports       = React.lazy(() => import('./pages/Reports'))
const Debug         = React.lazy(() => import('./pages/Debug'))
const PrinterSetup      = React.lazy(() => import('./pages/PrinterSetup'))
const LabelCalibration  = React.lazy(() => import('./pages/LabelCalibration'))
const DateTimeSettings  = React.lazy(() => import('./pages/DateTimeSettings'))
const PreppySettings    = React.lazy(() => import('./pages/PreppySettings'))

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="d-flex justify-content-center align-items-center vh-100">Loading…</div>}>
        <Routes>
          <Route path="/"        element={<Preppy />}  />
          <Route path="/printx"  element={<PrintX />}  />
          <Route path="/wifi"    element={<WiFi />}    />
          <Route path="/reports" element={<Reports />} />
          <Route path="/debug"          element={<Debug />}         />
          <Route path="/printer-setup"    element={<PrinterSetup />}     />
          <Route path="/label-calibration" element={<LabelCalibration />} />
          <Route path="/datetime-settings" element={<DateTimeSettings />} />
          <Route path="/preppy-settings"  element={<PreppySettings />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}
