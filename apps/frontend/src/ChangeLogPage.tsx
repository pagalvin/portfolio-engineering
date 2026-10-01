import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ChangelogResponse } from '@portfolio-engineering/shared-types'
import { ApiClientContext } from './apiClientContext'
import { HelpContentStatus } from './components/HelpContentStatus'
import { MarkdownViewer } from './components/MarkdownViewer'
import {
  acknowledgeRenderedChangelog,
  isChangelogResponse,
} from './changeLogHelpers'

export const CHANGELOG_ROUTE = '/change-log'
export const CHANGELOG_ACKNOWLEDGMENT_FAILURE =
  "Your view couldn't be recorded. New items may still be marked."

interface ChangelogPageState {
  data: ChangelogResponse | null
  loading: boolean
  error: boolean
}

interface ChangeLogPageProps {
  onAcknowledged?: () => void
  onContentLoaded?: (response: ChangelogResponse) => void
}

export function ChangeLogPage({ onAcknowledged, onContentLoaded }: ChangeLogPageProps) {
  const client = useContext(ApiClientContext)
  const [page, setPage] = useState<ChangelogPageState>({
    data: null,
    loading: true,
    error: false,
  })
  const [retryKey, setRetryKey] = useState(0)
  const [acknowledgmentPending, setAcknowledgmentPending] = useState(false)
  const [acknowledgmentFailed, setAcknowledgmentFailed] = useState(false)
  const attemptedSnapshot = useRef<string | null>(null)

  const retry = useCallback(() => {
    setRetryKey((previous) => previous + 1)
  }, [])

  useEffect(() => {
    if (!client) {
      setPage({ data: null, loading: false, error: true })
      return
    }

    let active = true
    setPage({ data: null, loading: true, error: false })
    client.getChangelog().then(
      (response: unknown) => {
        if (!active) return
        if (!isChangelogResponse(response)) {
          setPage({ data: null, loading: false, error: true })
          return
        }
        onContentLoaded?.(response)
        setPage({ data: response, loading: false, error: false })
      },
      () => {
        if (active) setPage({ data: null, loading: false, error: true })
      },
    )

    return () => {
      active = false
    }
  }, [client, onContentLoaded, retryKey])

  useEffect(() => {
    const response = page.data
    if (!client || !response || response.sectionIdentities.length === 0) return

    const snapshotKey = `${response.contentVersion}:${response.sectionIdentities.join('\n')}`
    if (attemptedSnapshot.current === snapshotKey) return
    attemptedSnapshot.current = snapshotKey

    let active = true
    let pendingTimer: ReturnType<typeof setTimeout> | undefined
    setAcknowledgmentFailed(false)
    setAcknowledgmentPending(false)
    pendingTimer = setTimeout(() => {
      if (active) setAcknowledgmentPending(true)
    }, 500)

    acknowledgeRenderedChangelog(client, response, onAcknowledged).then(
      () => {
        if (!active) return
        if (pendingTimer) clearTimeout(pendingTimer)
        setAcknowledgmentPending(false)
      },
      () => {
        if (!active) return
        if (pendingTimer) clearTimeout(pendingTimer)
        setAcknowledgmentPending(false)
        setAcknowledgmentFailed(true)
      },
    )

    return () => {
      active = false
      if (pendingTimer) clearTimeout(pendingTimer)
    }
  }, [client, onAcknowledged, page.data])

  return (
    <ChangeLogPageContent
      page={page}
      acknowledgmentPending={acknowledgmentPending}
      acknowledgmentFailed={acknowledgmentFailed}
      onRetry={retry}
    />
  )
}

interface ChangeLogPageContentProps {
  page: ChangelogPageState
  acknowledgmentPending?: boolean
  acknowledgmentFailed?: boolean
  onRetry?: () => void
}

export function ChangeLogPageContent({
  page,
  acknowledgmentPending = false,
  acknowledgmentFailed = false,
  onRetry,
}: ChangeLogPageContentProps) {
  const response = page.data

  return (
    <article className="workspace-content" aria-labelledby="change-log-heading">
      <header className="status-panel">
        <p className="eyebrow">Release notes</p>
        <h1 id="change-log-heading">Change Log</h1>
        <p>See what's changed in Portfolio OS.</p>
      </header>

      {page.loading ? (
        <p role="status" aria-live="polite" className="text-sm text-text-muted">
          Loading the change log.
        </p>
      ) : null}

      {page.error ? (
        <div className="status-panel error-panel" role="alert">
          <p>The change log couldn't be loaded.</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded border border-border-subtle px-3 py-2 text-sm text-action-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {response ? (
        <>
          <HelpContentStatus metadata={response.metadata} contentName="Change log" />
          {response.sectionIdentities.length === 0 ? (
            <p role="status" className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-text-muted">
              No change log entries are available yet.
            </p>
          ) : (
            <MarkdownViewer
              value={response.markdown}
              label="Change Log content"
            />
          )}
          {acknowledgmentPending ? (
            <p role="status" aria-live="polite" className="text-sm text-text-muted">
              Recording your view.
            </p>
          ) : null}
          {acknowledgmentFailed ? (
            <p role="status" aria-live="polite" className="text-sm text-text-muted">
              {CHANGELOG_ACKNOWLEDGMENT_FAILURE}
            </p>
          ) : null}
        </>
      ) : null}
    </article>
  )
}
