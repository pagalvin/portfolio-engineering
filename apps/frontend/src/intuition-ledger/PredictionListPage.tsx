import { useContext, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import type {
  PredictionListItem,
  PredictionListResponse,
  PredictionTypeFilter,
} from '@portfolio-engineering/shared-types/intuitionLedger'
import { derivePredictionStatus } from '@portfolio-engineering/domain'
import { ApiClientContext } from '../apiClientContext'
import type { AuthenticatedApiClient, ApiError } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import { parsePredictionListQuery, type PredictionListUrlQuery } from '../intuitionLedgerApi'
import { formatPredictionDate } from './PredictionFormPage'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'

const LIST_PATH = '/workspace/intuition-ledger/predictions'

const statusFilterOptions: ReadonlyArray<{ value: NonNullable<PredictionListUrlQuery['status']>; label: string }> = [
  { value: 'active', label: 'All except void' },
  { value: 'open', label: 'Open' },
  { value: 'due', label: 'Due' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'void', label: 'Void' },
  { value: 'all', label: 'All' },
]

const typeFilterOptions: ReadonlyArray<{ value: PredictionTypeFilter; label: string }> = [
  { value: 'direction', label: 'Direction' },
  { value: 'percent_move', label: 'Percent move' },
  { value: 'target_price', label: 'Target price' },
  { value: 'event_reaction', label: 'Event reaction' },
  { value: 'freeform', label: 'Freeform' },
]

const resultFilterOptions: ReadonlyArray<{ value: 'correct' | 'incorrect'; label: string }> = [
  { value: 'correct', label: 'Correct' },
  { value: 'incorrect', label: 'Incorrect' },
]

const amendedFilterOptions: ReadonlyArray<{ value: 'only' | 'exclude'; label: string }> = [
  { value: 'only', label: 'Amended only' },
  { value: 'exclude', label: 'Exclude amended' },
]

/** Icon + text for the lifecycle status derived client-side (never color alone). */
const statusText: Record<'open' | 'due' | 'resolved' | 'void', string> = {
  open: '○ Open',
  due: '⏲ Due',
  resolved: 'Resolved',
  void: '⊘ Void',
}

/** Counts filters that differ from the visible "All except void" status default, for the mobile disclosure summary. */
export function countActiveFilters(query: PredictionListUrlQuery): number {
  return [
    Boolean(query.q),
    Boolean(query.status && query.status !== 'active'),
    Boolean(query.type),
    Boolean(query.symbol),
    Boolean(query.result),
    Boolean(query.tag),
    Boolean(query.amended),
  ].filter(Boolean).length
}

/** Subject column value: the symbol snapshot for security/Other subjects, else the Freeform topic. */
export function subjectLabel(prediction: PredictionListItem): string {
  return prediction.symbolSnapshot ?? prediction.topic ?? 'Not provided'
}

/** Status column text, derived from the same rules the server uses for the status filter. */
export function predictionStatusText(prediction: PredictionListItem, asOfLocalDate: string): string {
  return statusText[derivePredictionStatus({
    deadline: prediction.deadline,
    asOfLocalDate,
    hasResult: prediction.result !== null,
    isVoided: prediction.voidedAt !== null,
  })]
}

/** Result column text; never color alone (FR 45). */
export function predictionResultText(result: PredictionListItem['result']): string {
  if (result === 'CORRECT') return '✓ Correct'
  if (result === 'INCORRECT') return '✗ Incorrect'
  return 'Not recorded'
}

/** Flags column text, driven only by the server-provided Amended and resultChanged fields (never updatedAt). */
export function predictionFlagsText(prediction: PredictionListItem): string {
  const flags: string[] = []
  if (prediction.amended) flags.push('Amended')
  if (prediction.resultChanged) flags.push('Result changed')
  return flags.length > 0 ? flags.join(', ') : 'None'
}

export function listUrl(searchParams: URLSearchParams): string {
  const query = searchParams.toString()
  return `${LIST_PATH}${query ? `?${query}` : ''}`
}

function errorMessage(error: unknown, fallback: string): string {
  const apiError = error as Partial<ApiError>
  return typeof apiError.message === 'string' ? apiError.message : fallback
}

/** Loads the prediction list exactly as the server returns it (filteredCount/totalCount are never recomputed client-side). */
export async function loadPredictionList(
  client: Pick<AuthenticatedApiClient, 'listPredictions'>,
  urlQuery: PredictionListUrlQuery,
  asOfLocalDate: string,
  signal?: AbortSignal,
): Promise<PredictionListResponse> {
  return client.listPredictions({ ...urlQuery, asOfLocalDate }, signal)
}

function PredictionCountStatus({ shown, total }: { shown: number; total: number }) {
  return (
    <p className="mt-3 border-t border-border-subtle pt-3 text-sm text-text-muted" role="status">
      Showing {shown.toLocaleString()} of {total.toLocaleString()} {total === 1 ? 'prediction' : 'predictions'}
    </p>
  )
}

export function PredictionListPage() {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [predictions, setPredictions] = useState<PredictionListItem[]>([])
  const [filteredCount, setFilteredCount] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const parsedList = useMemo(() => parsePredictionListQuery(location.search), [location.search])

  useEffect(() => {
    if (!apiClient) {
      setError('The Intuition Ledger service is unavailable.')
      setLoading(false)
      return
    }
    if (parsedList.error) {
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    loadPredictionList(apiClient, parsedList.query, getTodayInTimezone(getEnvironmentTimezone()), controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setPredictions(response.predictions)
        setFilteredCount(response.filteredCount)
        setTotalCount(response.totalCount)
        setLoading(false)
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return
        setError(errorMessage(loadError, 'Unable to load predictions.'))
        setLoading(false)
      })
    return () => controller.abort()
  }, [apiClient, parsedList, loadAttempt])

  const updateFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  const clearFilters = () => navigate(LIST_PATH)
  const activeFilterCount = countActiveFilters(parsedList.query)
  const today = getTodayInTimezone(getEnvironmentTimezone())

  if (parsedList.error) {
    return (
      <section aria-labelledby="predictions-heading" className="space-y-4">
        <h2 id="predictions-heading" className="text-xl font-semibold">All predictions</h2>
        <div role="alert" className="space-y-3 rounded-lg border border-border-subtle bg-surface-default p-5">
          <h3 className="font-semibold">Invalid filters</h3>
          <p>{parsedList.error}</p>
          <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="predictions-heading" className="space-y-4">
      <h2 id="predictions-heading" className="text-xl font-semibold">All predictions</h2>
      <details className="rounded-lg border border-border-subtle bg-surface-default p-4 md:border-0 md:bg-transparent md:p-0">
        <summary className="cursor-pointer text-sm font-medium text-text-primary md:hidden">
          Filters ({activeFilterCount} active)
        </summary>
        <form
          className="mt-3 grid gap-4 sm:grid-cols-2 md:!grid md:mt-0 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_1fr]"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="grid gap-1 text-sm font-medium">
            Search
            <Input
              aria-label="Search by symbol, claim, or notes"
              placeholder="Symbol, claim, or notes"
              value={searchParams.get('q') ?? ''}
              onChange={(event) => updateFilter('q', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Status
            <Select
              aria-label="Status"
              value={parsedList.query.status ?? 'active'}
              onChange={(event) => updateFilter('status', event.target.value)}
            >
              {statusFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Type
            <Select
              aria-label="Type"
              value={searchParams.get('type') ?? ''}
              onChange={(event) => updateFilter('type', event.target.value)}
            >
              <option value="">All types</option>
              {typeFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Result
            <Select
              aria-label="Result"
              value={searchParams.get('result') ?? ''}
              onChange={(event) => updateFilter('result', event.target.value)}
            >
              <option value="">All results</option>
              {resultFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Symbol
            <Input
              aria-label="Symbol"
              placeholder="e.g. MSFT"
              value={searchParams.get('symbol') ?? ''}
              onChange={(event) => updateFilter('symbol', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Tag
            <Input
              aria-label="Tag"
              placeholder="e.g. earnings"
              value={searchParams.get('tag') ?? ''}
              onChange={(event) => updateFilter('tag', event.target.value)}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Amended
            <Select
              aria-label="Amended"
              value={searchParams.get('amended') ?? ''}
              onChange={(event) => updateFilter('amended', event.target.value)}
            >
              <option value="">Any</option>
              {amendedFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </label>
        </form>
      </details>

      {loading ? (
        <div role="status" className="rounded-lg border border-border-subtle bg-surface-default p-5">
          Loading predictions…
        </div>
      ) : error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-border-subtle bg-surface-default p-5">
          <h3 className="font-semibold">Unable to load predictions</h3>
          <p>{error}</p>
          <Button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</Button>
        </div>
      ) : predictions.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-surface-default p-5">
          {totalCount === 0 ? (
            <>
              <h3 className="font-semibold">No predictions yet</h3>
              <p className="mt-1 text-sm text-text-muted">Record a prediction to get started.</p>
              <Link
                className="mt-3 inline-block text-primary underline focus-visible:ring-2 focus-visible:ring-ring"
                to="/workspace/intuition-ledger/predictions/new"
              >
                New prediction
              </Link>
            </>
          ) : (
            <>
              <h3 className="font-semibold">No predictions match your filters</h3>
              <p className="mt-1 text-sm text-text-muted">Clear your filters or adjust your search.</p>
              <Button variant="outline" className="mt-3" onClick={clearFilters}>Clear filters</Button>
            </>
          )}
          <PredictionCountStatus shown={0} total={totalCount} />
        </div>
      ) : (
        <div className="rounded-lg border border-border-subtle bg-surface-default p-5">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <caption className="sr-only">Prediction list results</caption>
              <thead>
                <tr className="border-b border-border-subtle">
                  {['Subject', 'Claim', 'Deadline', 'Confidence', 'Status', 'Result', 'Flags', 'Action'].map((heading) => (
                    <th key={heading} className="p-3">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {predictions.map((prediction) => (
                  <tr key={prediction.id} className="border-b border-border-subtle transition-colors hover:bg-surface-muted">
                    <td className="p-3 font-semibold">{subjectLabel(prediction)}</td>
                    <td className="p-3">{prediction.claimText}</td>
                    <td className="p-3"><time dateTime={prediction.deadline}>{formatPredictionDate(prediction.deadline)}</time></td>
                    <td className="p-3">{prediction.confidence}%</td>
                    <td className="p-3">{predictionStatusText(prediction, today)}</td>
                    <td className="p-3">{predictionResultText(prediction.result)}</td>
                    <td className="p-3">{predictionFlagsText(prediction)}</td>
                    <td className="p-3">
                      <Link
                        className="text-primary underline focus-visible:ring-2 focus-visible:ring-ring"
                        to={`/workspace/intuition-ledger/predictions/${encodeURIComponent(prediction.id)}?returnTo=${encodeURIComponent(listUrl(searchParams))}`}
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PredictionCountStatus shown={filteredCount} total={totalCount} />
        </div>
      )}
    </section>
  )
}
