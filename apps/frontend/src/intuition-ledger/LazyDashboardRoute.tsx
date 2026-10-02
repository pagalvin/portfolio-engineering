import { lazy, Suspense } from 'react'

const DashboardPage = lazy(() => import('./DashboardPage'))

export function LazyDashboardRoute() {
  return <Suspense fallback={<p role="status">Loading dashboard…</p>}><DashboardPage /></Suspense>
}