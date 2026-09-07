import { useContext, useEffect, useState } from 'react'
import { ApiClientContext } from './apiClientContext'
import { fetchHelpStatus } from './helpApi'
import type { HelpStatusResponse } from './helpTypes'
import { Alert, AlertDescription } from './components/ui/alert'
import { Button } from './components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card'
import { formatAttemptDate, refreshAnnouncement } from './helpRefreshFormatting'

const GITHUB_ISSUES_URL = 'https://github.com/pagalvin/portfolio-engineering/issues'
const POS_SUBREDDIT_URL = 'https://www.reddit.com/r/PortfolioOS/'

type RefreshState = 'idle' | 'refreshing' | 'success' | 'failure'

export function HelpRefreshControl() {
  const client = useContext(ApiClientContext)
  const [status, setStatus] = useState<HelpStatusResponse | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [refreshState, setRefreshState] = useState<RefreshState>('idle')
  const [announcement, setAnnouncement] = useState('')

  useEffect(() => {
    if (!client) return
    let active = true
    fetchHelpStatus(client).then(
      (value) => active && setStatus(value),
      () => active && setLoadError(true),
    )
    return () => {
      active = false
    }
  }, [client])

  const lastAttempt = status?.lastDownloadAttemptAt ?? null

  async function handleRefresh() {
    if (!client || refreshState === 'refreshing') return
    setRefreshState('refreshing')
    setAnnouncement(refreshAnnouncement('refreshing'))
    try {
      const result = await client.refreshHelp()
      setStatus((previous) => ({
        freshness: result.freshness,
        refreshStatus: result.refreshStatus,
        fetchedAt: result.fetchedAt,
        lastDownloadAttemptAt: result.lastDownloadAttemptAt,
        source: previous?.source ?? 'bundled',
      }))
      if (result.refreshStatus === 'succeeded') {
        setRefreshState('success')
        setAnnouncement(refreshAnnouncement('success'))
      } else {
        setRefreshState('failure')
        setAnnouncement(refreshAnnouncement('failure'))
      }
    } catch {
      try {
        const latestStatus = await fetchHelpStatus(client)
        setStatus(latestStatus)
      } catch {
        // Keep the last known timestamp and help content when status recovery also fails.
      }
      setRefreshState('failure')
      setAnnouncement(refreshAnnouncement('failure'))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Help content</CardTitle>
        <CardDescription>
          Refresh official help content without interrupting the help currently available.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-text-muted" aria-live="polite">
          {formatAttemptDate(lastAttempt)}
        </p>
        {loadError ? (
          <p className="text-sm text-text-muted">
            The last help refresh attempt could not be loaded.
          </p>
        ) : null}
        <Button type="button" onClick={handleRefresh} disabled={!client || refreshState === 'refreshing'}>
          {refreshState === 'refreshing' ? 'Refreshing help content…' : 'Refresh help content'}
        </Button>
        <p className="sr-only" aria-live="polite" aria-atomic="true">
          {announcement}
        </p>
        {refreshState === 'failure' ? (
          <Alert variant="warning">
            <AlertDescription>
              Help content could not be refreshed. Existing help remains available. If something
              looks wrong,{' '}
              <a className="text-action-primary underline" href={GITHUB_ISSUES_URL} target="_blank" rel="noopener noreferrer">
                create a GitHub issue
              </a>{' '}
              or{' '}
              <a className="text-action-primary underline" href={POS_SUBREDDIT_URL} target="_blank" rel="noopener noreferrer">
                report it on the P/OS subreddit
              </a>
              .
            </AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  )
}
