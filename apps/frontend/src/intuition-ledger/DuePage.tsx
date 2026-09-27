import { useContext, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import type { PredictionRecord } from '@portfolio-engineering/shared-types/intuitionLedger'
import { ApiClientContext } from '../apiClientContext'
import type { AuthenticatedApiClient } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import { Button } from '../components/ui/button'
import { formatPredictionDate } from './PredictionFormPage'
import { RecordResultDialog } from './RecordResultDialog'
import { useIntuitionLedgerDueCount } from './intuitionLedgerDueCount'

export function sortDuePredictions(predictions: readonly PredictionRecord[]): PredictionRecord[] {
  return [...predictions].sort((a, b) => a.deadline.localeCompare(b.deadline) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}

export async function loadDuePredictions(
  client: Pick<AuthenticatedApiClient, 'listPredictions'>,
  asOfLocalDate: string,
  signal?: AbortSignal,
): Promise<PredictionRecord[]> {
  const response = await client.listPredictions({ status: 'due', asOfLocalDate }, signal)
  return sortDuePredictions(response.predictions)
}

export function nextDueFocusId(predictions: readonly PredictionRecord[], resolvedId: string): string | null {
  const index = predictions.findIndex((prediction) => prediction.id === resolvedId)
  return predictions.filter((prediction) => prediction.id !== resolvedId)[Math.min(index, predictions.length - 2)]?.id ?? null
}

export function focusDueTarget(
  id: string | null,
  buttons: readonly { dataset: { dueResultId?: string }; focus(): void }[],
  heading: { focus(): void } | null,
): void {
  if (id === null) heading?.focus()
  else buttons.find((button) => button.dataset.dueResultId === id)?.focus()
}

export function DueEmptyState() {
  return <div className="rounded-lg border border-border-subtle bg-surface-default p-5"><p>Nothing is due. Predictions appear here after their deadline passes.</p><Link className="mt-3 inline-block text-primary underline focus-visible:ring-2 focus-visible:ring-ring" to="/workspace/intuition-ledger/predictions/new">New prediction</Link></div>
}

export function DuePage() {
  const client = useContext(ApiClientContext)
  const { refresh } = useIntuitionLedgerDueCount()
  const [predictions, setPredictions] = useState<PredictionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<PredictionRecord | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [reload, setReload] = useState(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusAfterSave = useRef<string | null | undefined>(undefined)
  const opener = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    if (!client) {
      setError('The Intuition Ledger service is unavailable.')
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    void loadDuePredictions(client, getTodayInTimezone(getEnvironmentTimezone()), controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return
        setPredictions(response)
        setLoading(false)
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return
        console.error('Unable to load due predictions', cause)
        setError('Unable to load due predictions. Try again.')
        setLoading(false)
      })
    return () => controller.abort()
  }, [client, reload])

  useEffect(() => {
    if (focusAfterSave.current === undefined) return
    const id = focusAfterSave.current
    focusAfterSave.current = undefined
    focusDueTarget(id, Array.from(document.querySelectorAll<HTMLButtonElement>('[data-due-result-id]')), heading.current)
  }, [predictions])

  function saved(updated: PredictionRecord) {
    const remaining = predictions.filter((prediction) => prediction.id !== updated.id)
    focusAfterSave.current = nextDueFocusId(predictions, updated.id)
    setPredictions(remaining)
    setActive(null)
    refresh()
    setAnnouncement(`${updated.symbolSnapshot ?? updated.topic ?? 'Prediction'} prediction recorded as ${updated.result ?? 'cleared'}. ${remaining.length} ${remaining.length === 1 ? 'prediction' : 'predictions'} still due.`)
  }

  return <section className="space-y-4" aria-labelledby="due-heading">
    <h2 id="due-heading" tabIndex={-1} ref={heading} className="text-xl font-semibold">Due for review</h2>
    {loading ? <p role="status">Loading due predictions…</p> : error ? <div role="alert" className="space-y-2"><p>{error}</p><Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>Try again</Button></div> : predictions.length === 0 ? (
      <DueEmptyState />
    ) : <ul className="grid gap-3">{predictions.map((prediction) => <li key={prediction.id} className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface-default p-4">
      <div className="grid gap-1"><strong>{prediction.claimText}</strong><span>Due since <time dateTime={prediction.deadline}>{formatPredictionDate(prediction.deadline)}</time> · {prediction.confidence}% confidence{prediction.priceAtPrediction !== null ? ` · Price at prediction ${prediction.priceAtPrediction}` : ''}</span></div>
      <div className="flex items-center gap-3"><Button type="button" variant="outline" data-due-result-id={prediction.id} onClick={(event) => { opener.current = event.currentTarget; setActive(prediction) }}>Record result</Button><Link className="text-primary underline focus-visible:ring-2 focus-visible:ring-ring" to={`/workspace/intuition-ledger/predictions/${encodeURIComponent(prediction.id)}?returnTo=${encodeURIComponent('/workspace/intuition-ledger/due')}`}>Open</Link></div>
    </li>)}</ul>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {active && <RecordResultDialog key={active.id} prediction={active} onClose={() => { setActive(null); requestAnimationFrame(() => opener.current?.focus()) }} onSaved={saved} />}
  </section>
}
