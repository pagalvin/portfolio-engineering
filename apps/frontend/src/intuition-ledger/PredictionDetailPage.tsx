import { useCallback, useContext, useEffect, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import type {
  PredictionAmendmentRecord,
  PredictionClaimField,
  PredictionDetailResponse,
  PredictionListItem,
  PredictionRecord,
  PredictionResult,
} from '@portfolio-engineering/shared-types/intuitionLedger'
import { derivePercentChange, derivePredictionStatus, getResultRecordingBlockReason, suggestPredictionResult } from '@portfolio-engineering/domain'
import { ApiClientContext } from '../apiClientContext'
import type { ApiError, AuthenticatedApiClient, VoidPredictionRequest } from '../apiClient'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import { MarkdownViewer } from '../components/MarkdownViewer'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import { getSafeIntuitionLedgerReturnTo, isSafeIntuitionLedgerReturnTo } from '../intuitionLedgerApi'
import { claimFieldLabels, formatPredictionDate, predictionTypeOptions } from './PredictionFormPage'
import { RecordResultDialog } from './RecordResultDialog'
import { useIntuitionLedgerDueCount } from './intuitionLedgerDueCount'

const LIST_PATH = '/workspace/intuition-ledger/predictions'

type DetailReader = Pick<AuthenticatedApiClient, 'getPrediction'>
type RestoreClient = Pick<AuthenticatedApiClient, 'getPrediction' | 'restorePrediction'>

export function predictionStatusLabel(prediction: PredictionListItem, asOfLocalDate: string): string {
  const status = derivePredictionStatus({
    deadline: prediction.deadline,
    asOfLocalDate,
    hasResult: prediction.result !== null,
    isVoided: prediction.voidedAt !== null,
  })
  if (status === 'open') return '○ Open'
  if (status === 'due') return '⏲ Due'
  if (status === 'resolved') return 'Resolved'
  return '⊘ Void'
}

export function formatHistoryDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date(value))
}

export function formatHistoryTimestamp(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
}

function resultLabel(result: PredictionResult | null): string {
  if (result === 'CORRECT') return '✓ Correct'
  if (result === 'INCORRECT') return '✗ Incorrect'
  return 'Not recorded'
}

function typeLabel(type: PredictionRecord['type']): string {
  return predictionTypeOptions.find((option) => option.value === type)?.label ?? type
}

function directionLabel(direction: PredictionRecord['direction']): string {
  if (direction === 'RISES') return '▲ Rises'
  if (direction === 'FALLS') return '▼ Falls'
  return 'Not applicable'
}

function showValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  return String(value)
}

function timestampValue(value: string | null): string {
  return value ? formatHistoryTimestamp(value) : 'Not recorded'
}

function claimFieldValue(
  record: Pick<PredictionRecord, 'securityId' | 'otherSymbol' | 'topic' | 'symbolSnapshot' | 'symbolNormalizedSnapshot' | 'type' | 'direction' | 'claimText' | 'eventLabel' | 'deadline' | 'confidence' | 'priceAtPrediction' | 'priceCapturedAt' | 'predictedPrice' | 'predictedPercent'>,
  field: PredictionClaimField,
): string {
  const values: Record<PredictionClaimField, string | number | null> = {
    securityId: record.securityId,
    otherSymbol: record.otherSymbol,
    topic: record.topic,
    symbolSnapshot: record.symbolSnapshot,
    symbolNormalizedSnapshot: record.symbolNormalizedSnapshot,
    type: typeLabel(record.type),
    direction: record.direction ? directionLabel(record.direction) : null,
    claimText: record.claimText,
    eventLabel: record.eventLabel,
    deadline: formatPredictionDate(record.deadline),
    confidence: `${record.confidence}%`,
    priceAtPrediction: record.priceAtPrediction,
    priceCapturedAt: record.priceCapturedAt ? formatHistoryTimestamp(record.priceCapturedAt) : null,
    predictedPrice: record.predictedPrice,
    predictedPercent: record.predictedPercent === null ? null : `${record.predictedPercent}%`,
  }
  return showValue(values[field])
}

const previousFieldKeys: Record<PredictionClaimField, keyof PredictionAmendmentRecord> = {
  securityId: 'previousSecurityId',
  otherSymbol: 'previousOtherSymbol',
  topic: 'previousTopic',
  symbolSnapshot: 'previousSymbolSnapshot',
  symbolNormalizedSnapshot: 'previousSymbolNormalizedSnapshot',
  type: 'previousType',
  direction: 'previousDirection',
  claimText: 'previousClaimText',
  eventLabel: 'previousEventLabel',
  deadline: 'previousDeadline',
  confidence: 'previousConfidence',
  priceAtPrediction: 'previousPriceAtPrediction',
  priceCapturedAt: 'previousPriceCapturedAt',
  predictedPrice: 'previousPredictedPrice',
  predictedPercent: 'previousPredictedPercent',
}

function previousClaimFieldValue(history: PredictionAmendmentRecord, field: PredictionClaimField): string {
  const value = history[previousFieldKeys[field]]
  if (field === 'type') return typeLabel(value as PredictionRecord['type'])
  if (field === 'direction') return value ? directionLabel(value as PredictionRecord['direction']) : 'Not applicable'
  if (field === 'deadline') return formatPredictionDate(String(value))
  if (field === 'confidence') return `${String(value)}%`
  if (field === 'priceCapturedAt') return value ? formatHistoryTimestamp(String(value)) : 'Not recorded'
  if (field === 'predictedPercent') return value === null ? 'Not provided' : `${String(value)}%`
  return showValue(value as string | number | null)
}

export function buildVoidPredictionRequest(reason: string): VoidPredictionRequest {
  return { voidReason: reason.trim() || null }
}

export async function loadPredictionDetail(
  client: DetailReader,
  predictionId: string,
  signal?: AbortSignal,
): Promise<PredictionDetailResponse> {
  return client.getPrediction(predictionId, signal)
}

export async function restorePredictionDetail(
  client: RestoreClient,
  predictionId: string,
  signal?: AbortSignal,
): Promise<PredictionDetailResponse> {
  await client.restorePrediction(predictionId)
  return client.getPrediction(predictionId, signal)
}

export function detailLoadErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError>
  if (apiError.status === 404) return 'Prediction not found.'
  return apiError.message || 'Unable to load prediction. Try again.'
}

export function deletePredictionErrorMessage(error: unknown): string {
  const apiError = error as Partial<ApiError>
  if (apiError.code === 'not_voided') return 'Void this prediction before deleting it.'
  if (apiError.status === 404) return 'Prediction not found.'
  return apiError.message || 'Unable to delete this prediction. Try again.'
}
export function detailReturnTo(value: string | null): string {
  return value && isSafeIntuitionLedgerReturnTo(value)
    ? getSafeIntuitionLedgerReturnTo(value)
    : LIST_PATH
}

function claimRows(prediction: PredictionListItem): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Security', prediction.symbolSnapshot ?? prediction.otherSymbol ?? 'Not provided'],
    ['Type', typeLabel(prediction.type)],
  ]
  if (prediction.topic) rows.push(['Topic', prediction.topic])
  if (prediction.eventLabel) rows.push(['Event', prediction.eventLabel])
  if (prediction.direction) rows.push(['Direction', directionLabel(prediction.direction)])
  if (prediction.priceAtPrediction !== null) {
    rows.push(['Price at prediction', prediction.priceAtPrediction])
    rows.push(['Price captured at', timestampValue(prediction.priceCapturedAt)])
  }
  if (prediction.predictedPrice !== null) rows.push([prediction.type === 'TARGET_PRICE' ? 'Target price' : 'Predicted price', prediction.predictedPrice])
  if (prediction.predictedPercent !== null) rows.push(['Predicted move', `${prediction.predictedPercent}%`])
  rows.push(['Deadline', formatPredictionDate(prediction.deadline)])
  rows.push(['Confidence', `${prediction.confidence}%`])
  return rows
}

function outcomeRows(prediction: PredictionListItem): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Result', resultLabel(prediction.result)],
    ['Resolution date', prediction.resolutionDate ? formatPredictionDate(prediction.resolutionDate) : 'Not recorded'],
    ['Actual price', showValue(prediction.actualPrice)],
  ]
  if (prediction.actualPrice !== null && prediction.priceAtPrediction !== null) {
    const percent = derivePercentChange(Number(prediction.priceAtPrediction), Number(prediction.actualPrice))
    rows.push(['Actual move', `${percent > 0 ? '+' : ''}${percent.toFixed(2)}%`])
  }
  if (prediction.actualPrice !== null && prediction.priceAtPrediction !== null && prediction.predictedPrice !== null) {
    const suggestion = suggestPredictionResult({
      type: prediction.type,
      direction: prediction.direction,
      priceAtPrediction: Number(prediction.priceAtPrediction),
      predictedPrice: Number(prediction.predictedPrice),
      actualPrice: Number(prediction.actualPrice),
    })
    if (suggestion) rows.push(['Suggested result', resultLabel(suggestion)])
  }
  return rows
}

function DefinitionRows({ rows }: { rows: Array<[string, string]> }) {
  return <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(9rem,auto)_1fr]">{rows.map(([label, value]) => <div key={label} className="contents"><dt className="font-medium text-text-muted">{label}</dt><dd className="min-w-0 break-words">{value}</dd></div>)}</dl>
}

function HistoryDisclosure({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <details className="rounded-lg border border-border-subtle bg-surface-default p-4">
    <summary className="cursor-pointer font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{title}</summary>
    <p className="mt-2 text-sm text-text-muted">{summary}</p>
    <div className="mt-3 grid gap-4">{children}</div>
  </details>
}

export interface PredictionDetailContentProps {
  detail: PredictionDetailResponse
  asOfLocalDate: string
  returnTo: string
  onRecordResult: () => void
  onVoid: () => void
  onRestore: () => void
  onDelete: () => void
  busy: boolean
}

export function PredictionDetailContent({
  detail,
  asOfLocalDate,
  returnTo,
  onRecordResult,
  onVoid,
  onRestore,
  onDelete,
  busy,
}: PredictionDetailContentProps) {
  const { prediction } = detail
  const latestReasoningEdit = detail.reasoningHistory.at(-1)
  const latestResultChange = detail.resultHistory.at(-1)
  const isVoided = prediction.voidedAt !== null
  const canRecord = !isVoided && getResultRecordingBlockReason({ type: prediction.type, result: 'CORRECT', deadline: prediction.deadline, asOfLocalDate }) === null
  const recordButtonLabel = prediction.result ? 'Change result' : 'Record result'
  const amendedLink = `/workspace/intuition-ledger/predictions/${encodeURIComponent(prediction.id)}/edit?returnTo=${encodeURIComponent(returnTo)}`

  return <section aria-labelledby="prediction-detail-heading" className="space-y-4">
    <Link to={returnTo} className="inline-flex text-sm text-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Back</Link>
    <header className="space-y-3">
      <h2 id="prediction-detail-heading" className="break-words text-xl font-semibold">{prediction.claimText}</h2>
      <div className="flex flex-wrap gap-2" aria-label="Prediction status and flags">
        <span className="rounded-full border border-border-subtle px-2 py-1 text-sm">{predictionStatusLabel(prediction, asOfLocalDate)}</span>
        {prediction.result && <span className="rounded-full border border-border-subtle px-2 py-1 text-sm">{resultLabel(prediction.result)}</span>}
        {prediction.amended && <span className="rounded-full border border-border-subtle px-2 py-1 text-sm">Amended</span>}
        {prediction.resultChanged && <span className="rounded-full border border-border-subtle px-2 py-1 text-sm">Result changed</span>}
      </div>
      {isVoided && prediction.voidReason && <p className="text-sm text-text-muted">Void reason: {prediction.voidReason}</p>}
      <div className="flex flex-wrap gap-2">
        {canRecord && <Button type="button" onClick={onRecordResult} disabled={busy}>{recordButtonLabel}</Button>}
        {!canRecord && !isVoided && <p className="self-center text-sm text-text-muted">You can record a result after {formatPredictionDate(prediction.deadline)}.</p>}
        <Button asChild type="button" variant="outline" disabled={busy}><Link to={amendedLink}>Edit</Link></Button>
        {isVoided ? <>
          <Button type="button" variant="outline" onClick={onRestore} disabled={busy}>Restore</Button>
          <Button type="button" variant="destructive" onClick={onDelete} disabled={busy}>Delete permanently</Button>
        </> : <Button type="button" variant="outline" onClick={onVoid} disabled={busy}>Void</Button>}
      </div>
    </header>

    <section aria-labelledby="claim-heading" className="rounded-lg border border-border-subtle bg-surface-default p-4">
      <h3 id="claim-heading" className="mb-3 text-base font-semibold">Prediction</h3>
      <DefinitionRows rows={claimRows(prediction)} />
      {prediction.tags.length > 0 && <p className="mt-3 text-sm"><span className="font-medium">Tags: </span>{prediction.tags.join(', ')}</p>}
    </section>

    <section aria-labelledby="reasoning-heading" className="space-y-2">
      <h3 id="reasoning-heading" className="text-base font-semibold">Why I predicted this</h3>
      <MarkdownViewer value={prediction.reasoning ?? ''} label="Prediction reasoning" emptyMessage="No reasoning recorded." />
      {latestReasoningEdit && <p className="text-sm text-text-muted">Reasoning edited on <time dateTime={latestReasoningEdit.changedAt}>{formatHistoryDate(latestReasoningEdit.changedAt)}</time></p>}
    </section>

    <section aria-labelledby="outcome-heading" className="space-y-3 rounded-lg border border-border-subtle bg-surface-default p-4">
      <h3 id="outcome-heading" className="text-base font-semibold">Outcome</h3>
      <DefinitionRows rows={outcomeRows(prediction)} />
      <div className="space-y-2">
        <h4 className="font-medium">Outcome notes</h4>
        <MarkdownViewer value={prediction.outcomeNotes ?? ''} label="Outcome notes" emptyMessage="No outcome notes recorded." />
      </div>
    </section>

    <div className="grid gap-3">
      <HistoryDisclosure title={`Amendment history (${detail.amendmentHistory.length})`} summary={detail.amendmentHistory.length ? 'Original claim and each amended claim.' : 'No amendments recorded.'}>
        {detail.amendmentHistory.length === 0 ? <p>No amendment history.</p> : <>
          <div className="rounded border border-border-subtle p-3"><p className="text-sm font-medium">Original claim</p><p className="mt-1">{detail.amendmentHistory[0].previousClaimText}</p></div>
          {detail.amendmentHistory.map((history, index) => {
            const nextVersion = detail.amendmentHistory[index + 1]
            return <article key={history.id} className="border-l-2 border-border-subtle pl-3">
              <p className="text-sm text-text-muted"><time dateTime={history.changedAt}>{formatHistoryTimestamp(history.changedAt)}</time></p>
              <p className="mt-1">{history.previousClaimText} → {nextVersion?.previousClaimText ?? prediction.claimText}</p>
              <ul className="mt-2 grid gap-1 text-sm">{history.changedFields.map((field) => <li key={field}><span className="font-medium">{claimFieldLabels[field]}:</span> {previousClaimFieldValue(history, field)} → {nextVersion ? previousClaimFieldValue(nextVersion, field) : claimFieldValue(prediction, field)}</li>)}</ul>
            </article>
          })}
        </>}
      </HistoryDisclosure>

      <HistoryDisclosure title={`Result history (${detail.resultHistory.length})`} summary={latestResultChange ? `Result changed on ${formatHistoryDate(latestResultChange.changedAt)}.` : 'No result changes recorded.'}>
        {detail.resultHistory.length === 0 ? <p>No result history.</p> : detail.resultHistory.map((history) => <article key={history.id} className="border-l-2 border-border-subtle pl-3">
          <p className="text-sm text-text-muted"><time dateTime={history.changedAt}>{formatHistoryTimestamp(history.changedAt)}</time></p>
          <p className="mt-1">{resultLabel(history.previousResult)} → {resultLabel(history.newResult)}</p>
          <p className="text-sm">Resolution date: {history.previousResolutionDate ? formatPredictionDate(history.previousResolutionDate) : 'Not recorded'} → {history.newResolutionDate ? formatPredictionDate(history.newResolutionDate) : 'Not recorded'}</p>
          <p className="text-sm">Actual price: {showValue(history.previousActualPrice)} → {showValue(history.newActualPrice)}</p>
          <div className="mt-2 grid gap-2"><MarkdownViewer value={history.previousOutcomeNotes ?? ''} label="Previous outcome notes" emptyMessage="No outcome notes in this version." /><MarkdownViewer value={history.newOutcomeNotes ?? ''} label="Updated outcome notes" emptyMessage="No outcome notes in this version." /></div>
        </article>)}
      </HistoryDisclosure>

      <HistoryDisclosure title={`Reasoning history (${detail.reasoningHistory.length})`} summary={latestReasoningEdit ? `Reasoning edited on ${formatHistoryDate(latestReasoningEdit.changedAt)}.` : 'No reasoning changes recorded.'}>
        {detail.reasoningHistory.length === 0 ? <p>No reasoning history.</p> : <>
          <article className="grid gap-2"><p className="text-sm text-text-muted">Original reasoning</p><MarkdownViewer value={detail.reasoningHistory[0].previousReasoning ?? ''} label="Original reasoning" emptyMessage="No reasoning recorded." /></article>
          {detail.reasoningHistory.map((history) => <article key={history.id} className="grid gap-2 border-t border-border-subtle pt-3">
            <p className="text-sm text-text-muted"><time dateTime={history.changedAt}>{formatHistoryTimestamp(history.changedAt)}</time>: reasoning edited.</p>
            <div className="grid gap-2 sm:grid-cols-2"><div><p className="mb-1 text-sm font-medium">Earlier version</p><MarkdownViewer value={history.previousReasoning ?? ''} label={`Earlier reasoning from ${formatHistoryDate(history.changedAt)}`} emptyMessage="No reasoning recorded." /></div><div><p className="mb-1 text-sm font-medium">Updated version</p><MarkdownViewer value={history.newReasoning ?? ''} label={`Updated reasoning from ${formatHistoryDate(history.changedAt)}`} emptyMessage="No reasoning recorded." /></div></div>
          </article>)}
        </>}
      </HistoryDisclosure>
    </div>
    <p className="text-sm text-text-muted">Created <time dateTime={prediction.createdAt}>{formatHistoryTimestamp(prediction.createdAt)}</time> · Updated <time dateTime={prediction.updatedAt}>{formatHistoryTimestamp(prediction.updatedAt)}</time></p>
  </section>
}

export function PredictionDetailPage() {
  const client = useContext(ApiClientContext)
  const { refresh: refreshDueCount } = useIntuitionLedgerDueCount()
  const navigate = useNavigate()
  const { predictionId } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = detailReturnTo(searchParams.get('returnTo'))
  const [detail, setDetail] = useState<PredictionDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const [reload, setReload] = useState(0)
  const [recordDialogOpen, setRecordDialogOpen] = useState(false)
  const [voidDialogOpen, setVoidDialogOpen] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [working, setWorking] = useState(false)

  const refreshDetail = useCallback(async (signal?: AbortSignal) => {
    if (!client || !predictionId) throw new Error('The Intuition Ledger service is unavailable.')
    return loadPredictionDetail(client, predictionId, signal)
  }, [client, predictionId])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setLoadError(null)
    if (!client || !predictionId) {
      setLoading(false)
      setLoadError('The Intuition Ledger service is unavailable.')
      return () => controller.abort()
    }
    void refreshDetail(controller.signal).then((response) => {
      if (controller.signal.aborted) return
      setDetail(response)
      setLoading(false)
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return
      const error = cause as Partial<ApiError>
      if (error.status !== 404) console.error('Unable to load prediction detail', cause)
      setLoadError(detailLoadErrorMessage(cause))
      setLoading(false)
    })
    return () => controller.abort()
  }, [client, predictionId, refreshDetail, reload])

  async function updateAfterAction(action: () => Promise<PredictionDetailResponse | void>, message: string) {
    if (working) return
    setWorking(true)
    setActionError(null)
    try {
      const result = await action()
      const updated = result ?? await refreshDetail()
      setDetail(updated)
      setAnnouncement(message)
      refreshDueCount()
      setVoidDialogOpen(false)
      setDeleteDialogOpen(false)
      setActionError(null)
      return message
    } catch (cause) {
      const error = cause as Partial<ApiError>
      if (error.status !== 404) console.error('Unable to update prediction lifecycle', cause)
      setActionError(error.message || 'Unable to update this prediction. Try again.')
      return null
    } finally {
      setWorking(false)
    }
  }
  async function submitVoid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!client || !predictionId) {
      setActionError('The Intuition Ledger service is unavailable.')
      return
    }
    const request = buildVoidPredictionRequest(voidReason)
    const saved = await updateAfterAction(async () => { await client.voidPrediction(predictionId, request) }, 'Prediction voided.')
    if (saved) setVoidReason('')
  }

  async function restore() {
    if (!client || !predictionId) {
      setActionError('The Intuition Ledger service is unavailable.')
      return
    }
    await updateAfterAction(() => restorePredictionDetail(client, predictionId), 'Prediction restored.')
  }

  async function remove() {
    if (!client || !predictionId) {
      setActionError('The Intuition Ledger service is unavailable.')
      return
    }
    if (working) return
    setWorking(true)
    setActionError(null)
    try {
      await client.deletePrediction(predictionId)
      refreshDueCount()
      navigate(returnTo, { replace: true })
    } catch (cause) {
      const error = cause as Partial<ApiError>
      if (error.code === 'not_voided') {
        setActionError(deletePredictionErrorMessage(cause))
        try {
          setDetail(await refreshDetail())
        } catch (refreshCause) {
          console.error('Unable to refresh prediction after a lifecycle conflict', refreshCause)
        }
      } else {
        if (error.status !== 404) console.error('Unable to delete prediction', cause)
        setActionError(deletePredictionErrorMessage(cause))
      }
    } finally {
      setWorking(false)
    }
  }

  async function reloadAfterResult(_prediction: PredictionRecord) {
    setAnnouncement("Prediction result saved.")
    setRecordDialogOpen(false)
    refreshDueCount()
    setReload((value) => value + 1)
  }

  if (loading) return <section aria-labelledby="prediction-detail-heading"><h2 id="prediction-detail-heading" className="sr-only">Prediction details</h2><p role="status">Loading prediction…</p></section>
  if (loadError) return <section aria-labelledby="prediction-detail-heading" className="space-y-3"><h2 id="prediction-detail-heading" className="text-xl font-semibold">Prediction details</h2><p role="alert">{loadError}</p><Button type="button" variant="outline" onClick={() => setReload((value) => value + 1)}>Try again</Button><Link to={returnTo} className="ml-3 text-primary underline">Back</Link></section>
  if (!detail) return null

  return <>
    <PredictionDetailContent
      detail={detail}
      asOfLocalDate={getTodayInTimezone(getEnvironmentTimezone())}
      returnTo={returnTo}
      onRecordResult={() => { setActionError(null); setRecordDialogOpen(true) }}
      onVoid={() => { setActionError(null); setVoidDialogOpen(true) }}
      onRestore={() => void restore()}
      onDelete={() => { setActionError(null); setDeleteDialogOpen(true) }}
      busy={working}
    />
    {actionError && <p role="alert" className="mt-3 text-state-error">{actionError}</p>}
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {recordDialogOpen && <RecordResultDialog key={detail.prediction.id} prediction={detail.prediction} onClose={() => setRecordDialogOpen(false)} onSaved={(updated) => void reloadAfterResult(updated)} />}
    <Dialog open={voidDialogOpen} onOpenChange={(open) => { if (!working) setVoidDialogOpen(open) }}>
      <DialogContent>
        <form onSubmit={(event) => void submitVoid(event)} className="grid gap-4">
          <DialogHeader><DialogTitle>Void prediction?</DialogTitle><DialogDescription>Voided predictions stay in your ledger but are excluded from your stats. You can restore this prediction later.</DialogDescription></DialogHeader>
          <div className="grid gap-1"><label htmlFor="void-reason" className="font-medium">Reason (optional)</label><Textarea id="void-reason" rows={3} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} disabled={working} /></div>
          {actionError && <p role="alert" className="text-state-error">{actionError}</p>}
          <DialogFooter><Button type="button" variant="outline" onClick={() => setVoidDialogOpen(false)} disabled={working}>Cancel</Button><Button type="submit" variant="destructive" disabled={working}>{working ? 'Voiding…' : 'Void prediction'}</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => { if (!working) setDeleteDialogOpen(open) }}>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Delete prediction permanently?</AlertDialogTitle><AlertDialogDescription>This permanently deletes “{detail.prediction.claimText}” and its history. This can’t be undone. Its Security Master record will not be deleted.</AlertDialogDescription></AlertDialogHeader>
        {actionError && <p role="alert" className="text-state-error">{actionError}</p>}
        <AlertDialogFooter><AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel><AlertDialogAction disabled={working} onClick={(event) => { event.preventDefault(); void remove() }}>{working ? 'Deleting…' : 'Delete prediction'}</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
}