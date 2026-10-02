import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { PredictionDashboardStatsResponse, PredictionRecord } from '@portfolio-engineering/shared-types/intuitionLedger'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiClientContext } from '../apiClientContext'
import { Button } from '../components/ui/button'
import { Switch } from '../components/ui/switch'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import { parsePredictionDashboardQuery, type PredictionDashboardUrlQuery } from '../intuitionLedgerApi'
import { dashboardUrl, loadDashboardData, type DashboardData } from './dashboardApi'
import { RecordResultDialog } from './RecordResultDialog'
import { formatPredictionDate } from './PredictionFormPage'
import { useIntuitionLedgerDueCount } from './intuitionLedgerDueCount'
import { CalibrationChart } from './charts/CalibrationChart'
import { HitRateChart } from './charts/HitRateChart'
import { PredictedVsActualChart } from './charts/PredictedVsActualChart'
import { ResultsBySymbolChart } from './charts/ResultsBySymbolChart'
import { ResultsByTypeChart } from './charts/ResultsByTypeChart'
import { formatHitRate } from './charts/chartUtils'

const DASHBOARD_PATH = '/workspace/intuition-ledger'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') {
    return error.message
  }
  return 'Unable to load dashboard data. Try again.'
}

interface DashboardContentProps {
  stats: PredictionDashboardStatsResponse
  duePredictions: readonly PredictionRecord[]
  query: PredictionDashboardUrlQuery
  onPeriodChange: (period: 'week' | 'month') => void
  onAmendedChange: (amended: 'include' | 'exclude') => void
  onRecordResult: (prediction: PredictionRecord, opener: HTMLButtonElement) => void
}

export function DashboardContent({
  stats,
  duePredictions,
  query,
  onPeriodChange,
  onAmendedChange,
  onRecordResult,
}: DashboardContentProps) {
  const preview = duePredictions.slice(0, 5)
  const hitRate = stats.hitRate.value === null
    ? 'Not available yet'
    : `${formatHitRate(stats.hitRate.value)} (${stats.hitRate.numerator} of ${stats.hitRate.denominator} resolved)`

  return (
    <section className="space-y-5" aria-labelledby="dashboard-heading">
      <h2 id="dashboard-heading" tabIndex={-1} className="text-xl font-semibold">Overview</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5" aria-label="Prediction summary">
        <li className="min-w-0 rounded-lg border border-border-subtle bg-surface-default p-3 sm:p-4">
          <h3 className="text-sm font-medium text-text-muted">Open</h3>
          <p className="mt-1 break-words text-2xl font-semibold" data-testid="summary-open">{stats.summary.open}</p>
        </li>
        <li className="min-w-0 rounded-lg border border-border-subtle bg-surface-default p-3 sm:p-4">
          <h3 className="text-sm font-medium text-text-muted">Due</h3>
          <Link to={`${DASHBOARD_PATH}/due`} className="mt-1 inline-block break-words text-2xl font-semibold text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" data-testid="summary-due">{stats.summary.due}</Link>
        </li>
        <li className="min-w-0 rounded-lg border border-border-subtle bg-surface-default p-3 sm:p-4">
          <h3 className="text-sm font-medium text-text-muted">Resolved</h3>
          <p className="mt-1 break-words text-2xl font-semibold" data-testid="summary-resolved">{stats.summary.resolved}</p>
        </li>
        <li className="min-w-0 rounded-lg border border-border-subtle bg-surface-default p-3 sm:p-4">
          <h3 className="text-sm font-medium text-text-muted">Voided</h3>
          <p className="mt-1 break-words text-2xl font-semibold" data-testid="summary-voided">{stats.summary.voided}</p>
        </li>
        <li className="col-span-2 min-w-0 rounded-lg border border-border-subtle bg-surface-default p-3 sm:col-span-1 sm:p-4">
          <h3 className="text-sm font-medium text-text-muted">Hit rate</h3>
          <p className="mt-1 break-words text-lg font-semibold" data-testid="summary-hit-rate">{hitRate}</p>
        </li>
      </ul>

      {preview.length > 0 && (
        <section aria-labelledby="dashboard-due-heading" className="rounded-lg border border-border-subtle bg-surface-default p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 id="dashboard-due-heading" className="font-semibold">Due for review</h3>
            <Link to={`${DASHBOARD_PATH}/due`} className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">View all due</Link>
          </div>
          <ul className="mt-3 divide-y divide-border-subtle">
            {preview.map((prediction) => (
              <li key={prediction.id} className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="break-words font-medium">{prediction.claimText}</p>
                  <p className="text-sm text-text-muted">Due since <time dateTime={prediction.deadline}>{formatPredictionDate(prediction.deadline)}</time> · {prediction.confidence}% confidence</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Button type="button" variant="outline" size="sm" onClick={(event) => onRecordResult(prediction, event.currentTarget)}>Record result</Button>
                  <Link to={`${DASHBOARD_PATH}/predictions/${encodeURIComponent(prediction.id)}?returnTo=${encodeURIComponent(DASHBOARD_PATH)}`} className="text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Open</Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Dashboard chart controls" className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-border-subtle bg-surface-default p-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Period</legend>
          <div role="group" aria-label="Period" className="inline-flex rounded-md border border-border-subtle p-1">
            <Button type="button" size="sm" variant={query.period === 'week' ? 'secondary' : 'ghost'} aria-pressed={query.period === 'week'} onClick={() => onPeriodChange('week')}>Week</Button>
            <Button type="button" size="sm" variant={query.period === 'month' ? 'secondary' : 'ghost'} aria-pressed={query.period === 'month'} onClick={() => onPeriodChange('month')}>Month</Button>
          </div>
        </fieldset>
        <div className="flex items-center gap-3 pt-5">
          <Switch id="dashboard-amended" checked={query.amended !== 'exclude'} onCheckedChange={(checked) => onAmendedChange(checked ? 'include' : 'exclude')} />
          <label htmlFor="dashboard-amended" className="cursor-pointer text-sm font-medium">Include Amended predictions</label>
        </div>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
        <HitRateChart stats={stats} period={query.period} />
        <CalibrationChart stats={stats} />
        <ResultsByTypeChart stats={stats} />
        <ResultsBySymbolChart stats={stats} />
        <PredictedVsActualChart stats={stats} />
      </div>
    </section>
  )
}

export default function DashboardPage() {
  const client = useContext(ApiClientContext)
  const location = useLocation()
  const navigate = useNavigate()
  const { refresh } = useIntuitionLedgerDueCount()
  const parsed = useMemo(() => parsePredictionDashboardQuery(location.search), [location.search])
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePrediction, setActivePrediction] = useState<PredictionRecord | null>(null)
  const resultOpener = useRef<HTMLButtonElement | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (parsed.error) {
      setLoading(false)
      return
    }
    if (!client) {
      setError('The Intuition Ledger service is unavailable.')
      setLoading(false)
      return
    }

    const controller = new AbortController()
    setLoading(true)
    setDashboardData(null)
    setError(null)
    void loadDashboardData(
      client,
      parsed.query,
      getTodayInTimezone(getEnvironmentTimezone()),
      controller.signal,
    ).then((response) => {
      if (controller.signal.aborted) return
      setDashboardData(response)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      console.error('Unable to load Intuition Ledger dashboard', cause)
      setError(getErrorMessage(cause))
      setLoading(false)
    })
    return () => controller.abort()
  }, [client, parsed, reload])

  function updateQuery(next: PredictionDashboardUrlQuery) {
    navigate(dashboardUrl(next), { replace: true })
  }

  if (parsed.error) {
    return (
      <section aria-labelledby="dashboard-heading" className="space-y-3">
        <h2 id="dashboard-heading" tabIndex={-1} className="text-xl font-semibold">Overview</h2>
        <div role="alert" className="rounded-lg border border-state-error bg-surface-default p-4">
          <p>Invalid dashboard filters: {parsed.error}</p>
          <Link to={DASHBOARD_PATH} className="mt-2 inline-block text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Clear dashboard filters</Link>
        </div>
      </section>
    )
  }

  if (loading && !dashboardData) {
    return <section aria-labelledby="dashboard-heading"><h2 id="dashboard-heading" tabIndex={-1} className="text-xl font-semibold">Overview</h2><p className="mt-3" role="status">Loading dashboard…</p></section>
  }

  if (error || !dashboardData) {
    return (
      <section aria-labelledby="dashboard-heading" className="space-y-3">
        <h2 id="dashboard-heading" tabIndex={-1} className="text-xl font-semibold">Overview</h2>
        <div role="alert" className="rounded-lg border border-state-error bg-surface-default p-4">
          <p>{error ?? 'Unable to load dashboard data. Try again.'}</p>
          <Button type="button" variant="outline" className="mt-3" onClick={() => setReload((value) => value + 1)}>Try again</Button>
        </div>
      </section>
    )
  }

  return (
    <>
      <DashboardContent
        stats={dashboardData.stats}
        duePredictions={dashboardData.duePredictions}
        query={parsed.query}
        onPeriodChange={(period) => updateQuery({ ...parsed.query, period })}
        onAmendedChange={(amended) => updateQuery({ ...parsed.query, amended })}
        onRecordResult={(prediction, opener) => { resultOpener.current = opener; setActivePrediction(prediction) }}
      />
      {activePrediction && (
        <RecordResultDialog
          key={activePrediction.id}
          prediction={activePrediction}
          onClose={() => { setActivePrediction(null); requestAnimationFrame(() => resultOpener.current?.focus()) }}
          onSaved={(updated) => {
            setDashboardData((current) => current ? { ...current, duePredictions: current.duePredictions.filter((prediction) => prediction.id !== updated.id) } : current)
            setActivePrediction(null)
            setReload((value) => value + 1)
            refresh()
            requestAnimationFrame(() => document.getElementById('dashboard-heading')?.focus())
          }}
        />
      )}
    </>
  )
}
