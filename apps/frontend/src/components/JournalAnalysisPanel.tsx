import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { ApiError, AuthenticatedApiClient } from '../apiClient'
import {
  listAiConnections,
  listAiProviders,
  type AiConnection,
  type ProviderMetadata,
} from '../aiConnectionApi'
import {
  analyzeJournalEntry,
  type JournalAnalysisStreamEvent,
} from '../journalAnalysisApi'
import { Alert, AlertDescription, AlertTitle } from './ui/alert'
import { Button } from './ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './ui/card'
import { Select } from './ui/select'
import { MarkdownViewer } from './MarkdownViewer'

type AnalysisRunState =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'stopped'
  | 'complete'
  | 'pre-stream-error'
  | 'mid-stream-error'

interface JournalAnalysisPanelProps {
  apiClient: AuthenticatedApiClient | null
  entryId: string | null
  hasUnsavedChanges: boolean
  onOpenAiSettings: () => void
}

const disclaimer =
  'AI-generated analysis can be incomplete, inaccurate, or misleading. Use it as a reflection aid, not as financial advice or a recommendation to buy, sell, or hold any security.'

function isReadyConnection(connection: AiConnection): boolean {
  return (
    connection.enabled &&
    connection.health === 'ready' &&
    connection.lastTestStatus === 'success'
  )
}

function getSafeErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'status' in error) {
    const apiError = error as ApiError
    if (apiError.status === 429) {
      return 'Analysis is temporarily rate limited. Wait a moment and try again.'
    }
    if (apiError.status === 401) {
      return 'Your session expired. Sign in again before starting analysis.'
    }
    if (apiError.message.trim().length > 0) {
      return apiError.message
    }
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return 'Generation stopped. Partial analysis is shown below.'
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return 'Analysis could not start. Review the message and try again.'
}

function getStatusMessage(input: {
  state: AnalysisRunState
  isLoadingConnections: boolean
  hasConnectionLoadError: boolean
  readyConnectionCount: number
}): string {
  if (input.isLoadingConnections) {
    return 'Loading ready AI connections...'
  }

  if (input.hasConnectionLoadError) {
    return 'Unable to load ready AI connections.'
  }

  if (input.readyConnectionCount === 0) {
    return 'Journal analysis needs a ready AI connection.'
  }

  switch (input.state) {
    case 'connecting':
      return 'Starting analysis...'
    case 'streaming':
      return 'Generating analysis...'
    case 'stopped':
      return 'Generation stopped. Partial analysis is shown below.'
    case 'complete':
      return 'Analysis complete. Results are not saved.'
    case 'pre-stream-error':
      return 'Analysis could not start. Review the message and try again.'
    case 'mid-stream-error':
      return 'The provider stopped responding before the analysis finished. Partial analysis is shown below.'
    case 'idle':
      return 'AI analysis panel ready.'
  }
}

function isRunning(state: AnalysisRunState): boolean {
  return state === 'connecting' || state === 'streaming'
}

export const JournalAnalysisPanel = forwardRef<
  HTMLHeadingElement,
  JournalAnalysisPanelProps
>(function JournalAnalysisPanel(
  {
    apiClient,
    entryId,
    hasUnsavedChanges,
    onOpenAiSettings,
  },
  headingRef,
) {
  const [connections, setConnections] = useState<readonly AiConnection[]>([])
  const [providers, setProviders] = useState<readonly ProviderMetadata[]>([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(false)
  const [connectionLoadError, setConnectionLoadError] = useState<string | null>(null)
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>('')
  const [analysisState, setAnalysisState] = useState<AnalysisRunState>('idle')
  const [output, setOutput] = useState('')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const outputLengthRef = useRef(0)

  useEffect(() => {
    if (!apiClient) {
      setConnections([])
      setProviders([])
      setIsLoadingConnections(false)
      return
    }

    let cancelled = false
    setIsLoadingConnections(true)
    setConnectionLoadError(null)

    Promise.all([listAiProviders(apiClient), listAiConnections(apiClient)])
      .then(([providerResponse, connectionResponse]) => {
        if (cancelled) {
          return
        }

        setProviders(providerResponse.providers)
        setConnections(connectionResponse.connections)
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setConnectionLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load ready AI connections.',
        )
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingConnections(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [apiClient, reloadToken])

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const providerNames = useMemo(() => {
    return new Map(providers.map((provider) => [provider.id, provider.displayName]))
  }, [providers])

  const readyConnections = useMemo(() => {
    return connections
      .filter(isReadyConnection)
      .toSorted((left, right) => {
        const labelComparison = left.label.localeCompare(right.label, undefined, {
          sensitivity: 'base',
        })

        if (labelComparison !== 0) {
          return labelComparison
        }

        const leftProvider = providerNames.get(left.providerId) ?? left.providerId
        const rightProvider = providerNames.get(right.providerId) ?? right.providerId
        return leftProvider.localeCompare(rightProvider, undefined, {
          sensitivity: 'base',
        })
      })
  }, [connections, providerNames])

  useEffect(() => {
    if (
      readyConnections.length > 0 &&
      !readyConnections.some((connection) => connection.id === selectedConnectionId)
    ) {
      setSelectedConnectionId(readyConnections[0]?.id ?? '')
    }
  }, [readyConnections, selectedConnectionId])

  const handleAnalysisEvent = (event: JournalAnalysisStreamEvent) => {
    if (event.type === 'chunk') {
      outputLengthRef.current += event.text.length
      setOutput((currentOutput) => currentOutput + event.text)
      setAnalysisState((currentState) =>
        currentState === 'connecting' ? 'streaming' : currentState,
      )
      return
    }

    if (event.type === 'done') {
      setAnalysisState('complete')
      return
    }

    setAnalysisError(event.message)
    setAnalysisState(outputLengthRef.current > 0 ? 'mid-stream-error' : 'pre-stream-error')
  }

  const startAnalysis = async () => {
    if (!apiClient || !entryId || !selectedConnectionId || isRunning(analysisState)) {
      return
    }

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    outputLengthRef.current = 0
    setOutput('')
    setAnalysisError(null)
    setAnalysisState('connecting')

    try {
      await analyzeJournalEntry(apiClient, entryId, selectedConnectionId, {
        signal: abortController.signal,
        onEvent: handleAnalysisEvent,
      })

      if (
        !abortController.signal.aborted &&
        outputLengthRef.current > 0
      ) {
        setAnalysisState((currentState) =>
          currentState === 'connecting' || currentState === 'streaming'
            ? 'complete'
            : currentState,
        )
      }
    } catch (error: unknown) {
      if (abortController.signal.aborted) {
        setAnalysisState('stopped')
        return
      }

      setAnalysisError(getSafeErrorMessage(error))
      setAnalysisState(outputLengthRef.current > 0 ? 'mid-stream-error' : 'pre-stream-error')
    } finally {
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null
      }
    }
  }

  const stopAnalysis = () => {
    abortControllerRef.current?.abort()
    setAnalysisState('stopped')
  }

  const statusMessage = getStatusMessage({
    state: analysisState,
    isLoadingConnections,
    hasConnectionLoadError: Boolean(connectionLoadError),
    readyConnectionCount: readyConnections.length,
  })
  const canStart =
    Boolean(apiClient) &&
    Boolean(entryId) &&
    selectedConnectionId.length > 0 &&
    !isLoadingConnections &&
    !connectionLoadError &&
    readyConnections.length > 0 &&
    !isRunning(analysisState)
  const showRetry =
    output.trim().length > 0 ||
    analysisState === 'stopped' ||
    analysisState === 'complete' ||
    analysisState === 'pre-stream-error' ||
    analysisState === 'mid-stream-error'
  const selectDescriptionId = hasUnsavedChanges
    ? 'journal-analysis-connection-helper journal-analysis-unsaved-helper'
    : 'journal-analysis-connection-helper'
  const selectedConnection = readyConnections.find(
    (connection) => connection.id === selectedConnectionId,
  )
  const unsavedHelperText = output.trim().length > 0
    ? 'This analysis is based on the saved entry content from when it was generated.'
    : 'Analysis uses the last saved version of this entry. Save first if you want the latest edits included.'

  return (
    <Card
      className="overflow-hidden"
      aria-labelledby="journal-analysis-title"
      aria-describedby="journal-analysis-description journal-analysis-disclaimer"
    >
      <CardHeader>
        <p className="text-xs font-semibold uppercase tracking-wide text-action-primary">
          AI analysis
        </p>
        <CardTitle
          id="journal-analysis-title"
          ref={headingRef}
          tabIndex={-1}
          className="text-xl"
        >
          Analyze this entry
        </CardTitle>
        <CardDescription id="journal-analysis-description">
          Generate a one-time Markdown analysis from the saved version of this Journal entry.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p
          id="journal-analysis-disclaimer"
          className="rounded-md border border-state-warning/50 bg-surface-muted p-3 text-sm text-text-primary"
        >
          {disclaimer}
        </p>

        {!entryId ? (
          <Alert variant="warning">
            <AlertTitle>Save this entry first</AlertTitle>
            <AlertDescription>
              Save this Journal entry before analyzing it.
            </AlertDescription>
          </Alert>
        ) : null}

        {hasUnsavedChanges ? (
          <p
            id="journal-analysis-unsaved-helper"
            className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-text-muted"
          >
            {unsavedHelperText}
          </p>
        ) : null}

        <div
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
          role="group"
          aria-label="AI analysis controls"
          aria-describedby={analysisError ? 'journal-analysis-error' : undefined}
        >
          <div className="min-w-0">
            <label
              htmlFor="journal-analysis-connection"
              className="mb-1 block text-sm font-medium text-text-strong"
            >
              AI connection
            </label>
            <Select
              id="journal-analysis-connection"
              value={selectedConnectionId}
              onChange={(event) => setSelectedConnectionId(event.target.value)}
              disabled={
                isRunning(analysisState) ||
                isLoadingConnections ||
                readyConnections.length === 0
              }
              aria-describedby={selectDescriptionId}
            >
              {readyConnections.map((connection) => (
                <option key={connection.id} value={connection.id}>
                  {connection.label} ({providerNames.get(connection.providerId) ?? connection.providerId})
                </option>
              ))}
            </Select>
            <p id="journal-analysis-connection-helper" className="mt-1 text-sm text-text-muted">
              Choose the AI connection to use for this one-time analysis. Only ready connections are shown.
            </p>
          </div>

          <div
            className="flex flex-wrap items-end gap-2 md:justify-end"
            role="group"
            aria-label="AI analysis actions"
          >
            <Button
              type="button"
              onClick={() => void startAnalysis()}
              disabled={!canStart}
            >
              {showRetry ? 'Retry analysis' : 'Start analysis'}
            </Button>
            {isRunning(analysisState) ? (
              <Button
                type="button"
                variant="secondary"
                onClick={stopAnalysis}
              >
                Stop generating
              </Button>
            ) : null}
          </div>
        </div>

        {connectionLoadError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load AI connections</AlertTitle>
            <AlertDescription>
              <p>{connectionLoadError}</p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => setReloadToken((currentToken) => currentToken + 1)}
              >
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {!connectionLoadError && !isLoadingConnections && readyConnections.length === 0 ? (
          <Alert variant="warning">
            <AlertTitle>No ready AI connection</AlertTitle>
            <AlertDescription>
              <p>
                Journal analysis needs a ready AI connection. Create or test a connection in Your AI settings, then return to this entry.
              </p>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={onOpenAiSettings}
              >
                Open Your AI settings
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        <p
          className="text-sm text-text-muted"
          role="status"
          aria-live="polite"
        >
          {statusMessage}
          {selectedConnection ? ` Selected connection: ${selectedConnection.label}.` : ''}
        </p>

        <section
          aria-labelledby="journal-analysis-result-title"
          className="space-y-2"
        >
          <h4 id="journal-analysis-result-title" className="text-sm font-semibold text-text-strong">
            Analysis result
          </h4>
          <MarkdownViewer
            value={output}
            label="Journal AI analysis result"
            labelledBy="journal-analysis-result-title"
            emptyMessage="Run AI analysis on the saved version of this Journal entry. Results appear here and are not saved."
          />
        </section>

        {analysisError ? (
          <Alert id="journal-analysis-error" variant="destructive">
            <AlertTitle>
              {analysisState === 'mid-stream-error'
                ? 'Analysis stopped early'
                : 'Analysis could not start'}
            </AlertTitle>
            <AlertDescription>{analysisError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
})
