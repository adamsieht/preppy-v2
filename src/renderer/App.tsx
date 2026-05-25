import React, { Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import DebugButton from './components/DebugButton'

const Home = React.lazy(() => import('./pages/Home'))
const Preppy = React.lazy(() => import('./pages/Preppy'))
const PrintX = React.lazy(() => import('./pages/PrintX'))
const Tempy = React.lazy(() => import('./pages/Tempy'))
const Tally = React.lazy(() => import('./pages/Tally'))
const WiFi = React.lazy(() => import('./pages/WiFi'))
const Reports = React.lazy(() => import('./pages/Reports'))
const Debug = React.lazy(() => import('./pages/Debug'))

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="d-flex justify-content-center align-items-center vh-100">Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/preppy" element={<Preppy />} />
          <Route path="/printx" element={<PrintX />} />
          <Route path="/tempy" element={<Tempy />} />
          <Route path="/tally" element={<Tally />} />
          <Route path="/wifi" element={<WiFi />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/debug" element={<Debug />} />
        </Routes>
        <DebugButton />
      </Suspense>
    </ErrorBoundary>
  )
}
