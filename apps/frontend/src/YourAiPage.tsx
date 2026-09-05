import { useContext, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router'
import {
  deleteAiConnection,
  listAiConnections,
  listAiProviders,
  testAiConnection,
  updateAiConnection,
  type AiConnection,
  type AiTestResult,
  type ProviderMetadata,
} from './aiConnectionApi'
import { ApiClientContext } from './App'
import type { ApiError } from './apiClient'
import { AiConnectionForm } from './components/AiConnectionForm'
import { AiConnectionList } from './components/AiConnectionList'
import { AiProviderCatalog } from './components/AiProviderCatalog'
import { Button } from './components/ui/button'

interface AiData {
  providers: readonly ProviderMetadata[]
  connections: readonly AiConnection[]
  loadError: string | null
}

function useAiData(): AiData {
  const apiClient = useContext(ApiClientContext)
  const [providers, setProviders] = useState<readonly ProviderMetadata[]>([])
  const [connections, setConnections] = useState<readonly AiConnection[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiClient) return
    Promise.all([listAiProviders(apiClient), listAiConnections(apiClient)])
      .then(([providerResponse, connectionResponse]) => {
        setProviders(providerResponse.providers)
        setConnections(connectionResponse.connections)
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load AI connections.')
      })
  }, [apiClient])

  return { providers, connections, loadError }
}

export function YourAiPage() {
  return (
    <section className="settings-section your-ai-page">
      <header className="settings-section-heading">
        <p className="eyebrow">Your AI</p>
        <h2>Bring Your Own AI</h2>
        <p>Connect organization-owned provider accounts for future portfolio workflows.</p>
      </header>
      <nav className="settings-subnav" aria-label="Your AI sections">
        <NavLink to="/workspace/settings/your-ai/overview" className="nav-link">
          Overview
        </NavLink>
        <NavLink to="/workspace/settings/your-ai/connections" className="nav-link">
          Connections
        </NavLink>
        <NavLink to="/workspace/settings/your-ai/providers" className="nav-link">
          Providers
        </NavLink>
      </nav>
      <div className="settings-subpage-content">
        <Outlet />
      </div>
    </section>
  )
}

export function YourAiOverviewPage() {
  const { connections, loadError } = useAiData()
  const workingCount = connections.filter(
    (connection) => connection.health === 'ready' || connection.health === 'untested',
  ).length
  const disabledCount = connections.filter((connection) => connection.health === 'disabled').length
  const needsAttentionCount = connections.filter(
    (connection) => connection.health === 'failing',
  ).length

  return (
    <section className="settings-section-card settings-overview-card" aria-labelledby="byoa-summary-title">
      <div className="settings-section-heading">
        <p className="eyebrow">Overview</p>
        <h3 id="byoa-summary-title">Connection overview</h3>
        <p className="text-sm text-text-muted">
          Manage the provider accounts available to your organization.
        </p>
      </div>
      {loadError ? <p className="settings-feedback" role="alert">{loadError}</p> : null}
      {!loadError ? (
        <div className="settings-overview-content">
          <div className="settings-metrics" role="group" aria-label="Connection totals">
            <div className="settings-metric">
              <p className="settings-metric-value">{workingCount}</p>
              <p className="settings-metric-label">Working providers</p>
            </div>
            <div className="settings-metric">
              <p className="settings-metric-value">{disabledCount}</p>
              <p className="settings-metric-label">Disabled</p>
            </div>
            <div className="settings-metric">
              <p className="settings-metric-value">{needsAttentionCount}</p>
              <p className="settings-metric-label">Needs attention</p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

export function YourAiProvidersPage() {
  const navigate = useNavigate()
  const { providers, connections, loadError } = useAiData()

  return (
    <section className="settings-section-card" aria-label="Supported AI providers">
      <div className="settings-section-heading">
        <p className="eyebrow">Providers</p>
        <h3>Supported and planned providers</h3>
        <p className="text-sm text-text-muted">
          Review providers available now and providers planned for future support.
        </p>
      </div>
      {loadError ? <p className="settings-feedback" role="alert">{loadError}</p> : null}
      {!loadError ? (
        <AiProviderCatalog
          providers={providers}
          connections={connections}
          onCreateConnection={() => navigate('/workspace/settings/your-ai/connections/new')}
        />
      ) : null}
    </section>
  )
}

export function YourAiConnectionsPage() {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const [providers, setProviders] = useState<readonly ProviderMetadata[]>([])
  const [connections, setConnections] = useState<readonly AiConnection[]>([])
  const [testResults, setTestResults] = useState<Readonly<Record<string, AiTestResult>>>({})
  const [testingConnectionId, setTestingConnectionId] = useState<string>()
  const [loadError, setLoadError] = useState<string | null>(null)
  const location = useLocation()
  const [actionError, setActionError] = useState<string | null>(
    (location.state as { testError?: string } | null)?.testError ?? null,
  )

  useEffect(() => {
    if (!apiClient) return
    Promise.all([listAiProviders(apiClient), listAiConnections(apiClient)])
      .then(([providerResponse, connectionResponse]) => {
        setProviders(providerResponse.providers)
        setConnections(connectionResponse.connections)
      })
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load AI connections.')
      })
  }, [apiClient])

  const getErrorMessage = (error: unknown) => {
    if (error && typeof error === 'object' && 'message' in error) {
      const apiError = error as ApiError
      return apiError.status === 429
        ? `Testing is rate limited. ${apiError.message}`
        : apiError.status === 401
          ? 'Your session expired. Sign in again before testing this connection.'
          : apiError.message
    }
    return 'Unable to test this connection.'
  }

  if (!apiClient) {
    return <p role="status">Loading your AI connections...</p>
  }

  const handleToggle = (connection: AiConnection) => {
    void updateAiConnection(apiClient, connection.id, { enabled: !connection.enabled })
      .then((updated) =>
        setConnections((current) =>
          current.map((item) => (item.id === updated.id ? updated : item)),
        ),
      )
      .catch((error: unknown) =>
        setLoadError(error instanceof Error ? error.message : 'Unable to update this connection.'),
      )
  }

  const handleDelete = (connection: AiConnection) => {
    setActionError(null)
    void deleteAiConnection(apiClient, connection.id)
      .then(() =>
        setConnections((current) => current.filter((item) => item.id !== connection.id)),
      )
      .catch((error: unknown) =>
        setActionError(error instanceof Error ? error.message : 'Unable to delete this connection.'),
      )
  }

  const handleTest = (connection: AiConnection) => {
    setActionError(null)
    setTestingConnectionId(connection.id)
    const refreshConnections = () =>
      listAiConnections(apiClient).then((connectionResponse) => {
        setConnections(connectionResponse.connections)
      })

    void testAiConnection(apiClient, connection.id)
      .then((result) => {
        setTestResults((current) => ({ ...current, [connection.id]: result }))
        setConnections((current) => current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                health: result.status === 'success' ? 'ready' : 'failing',
                lastTestedAt: result.testedAt,
                lastTestStatus: result.status,
                lastTestFailureKind: result.status === 'failure' ? result.failureKind : null,
                lastErrorSummary: result.status === 'failure' ? result.message : null,
              }
            : item,
        ))
        return refreshConnections()
          .catch((error: unknown) => {
            setActionError(
              error instanceof Error
                ? error.message
                : 'Connection test completed, but the connection list could not be refreshed.',
            )
          })
      })
      .catch((error: unknown) => {
        const result: AiTestResult = {
          status: 'failure',
          providerId: connection.providerId,
          connectionId: connection.id,
          testedAt: new Date().toISOString(),
          failureKind: 'unknown',
          message: getErrorMessage(error),
        }
        setTestResults((current) => ({ ...current, [connection.id]: result }))
        setConnections((current) => current.map((item) =>
          item.id === connection.id
            ? {
                ...item,
                health: 'failing',
                lastTestedAt: result.testedAt,
                lastTestStatus: 'failure',
                lastTestFailureKind: result.failureKind,
                lastErrorSummary: result.message,
              }
            : item,
        ))
        void refreshConnections().catch((refreshError: unknown) => {
          setActionError(
            refreshError instanceof Error
              ? refreshError.message
              : 'The test failed, but the connection list could not be refreshed.',
          )
        })
      })
      .finally(() => setTestingConnectionId(undefined))
  }

  return (
    <section className="settings-section-card" aria-labelledby="existing-connections-title">
      <div className="settings-section-heading">
        <p className="eyebrow">Connections</p>
        <h3 id="existing-connections-title">Existing connections</h3>
        <p className="text-sm text-text-muted">
          Active connections are ready for future AI workflows. Connections needing attention remain available for review.
        </p>
        <Button
          type="button"
          className="justify-self-start"
          onClick={() => navigate('/workspace/settings/your-ai/connections/new')}
        >
          Create new connection
        </Button>
      </div>
      {loadError ? <p className="settings-feedback" role="alert">{loadError}</p> : null}
      {actionError ? <p role="alert">{actionError}</p> : null}
      {!loadError ? (
        <AiConnectionList
          connections={connections}
          providers={providers}
          onEdit={(connection) =>
            navigate(`/workspace/settings/your-ai/connections/${connection.id}/edit`)
          }
          onToggle={handleToggle}
          onDelete={handleDelete}
          onTest={handleTest}
          testResults={testResults}
          testingConnectionId={testingConnectionId}
        />
      ) : null}
    </section>
  )
}

interface AiConnectionWorkflowPageProps {
  mode: 'create' | 'edit'
}

export function AiConnectionWorkflowPage({ mode }: AiConnectionWorkflowPageProps) {
  const apiClient = useContext(ApiClientContext)
  const navigate = useNavigate()
  const { id } = useParams()
  const [providers, setProviders] = useState<readonly ProviderMetadata[]>([])
  const [connection, setConnection] = useState<AiConnection | undefined>()
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    if (!apiClient) {
      return
    }

    setIsLoading(true)
    setLoadError(null)

    const load = mode === 'edit'
      ? id
        ? Promise.all([listAiProviders(apiClient), listAiConnections(apiClient)])
          .then(([providerResponse, connectionResponse]) => {
            setProviders(providerResponse.providers)
            const found = connectionResponse.connections.find((candidate) => candidate.id === id)
            if (!found) {
              throw new Error('This connection was not found.')
            }
            setConnection(found)
          })
        : Promise.reject(new Error('This connection was not found.'))
      : listAiProviders(apiClient).then((providerResponse) => {
          setProviders(providerResponse.providers)
        })

    load
      .catch((error: unknown) => {
        setLoadError(error instanceof Error ? error.message : 'Unable to load the connection form.')
      })
      .finally(() => setIsLoading(false))
  }, [apiClient, id, mode])

  const handleCancel = () => {
    navigate('/workspace/settings/your-ai/connections')
  }

  const handleSaved = async (saved: AiConnection) => {
    if (!apiClient) {
      navigate('/workspace/settings/your-ai/connections')
      return
    }
    let testError: string | undefined
    try {
      await testAiConnection(apiClient, saved.id)
    } catch (error: unknown) {
      testError = error instanceof Error ? error.message : 'The connection test could not be completed.'
    }
    navigate('/workspace/settings/your-ai/connections', testError ? { state: { testError } } : undefined)
  }

  if (!apiClient || isLoading) {
    return <p role="status">Loading connection form...</p>
  }

  if (loadError) {
    return (
      <section className="route-note" aria-labelledby="connection-form-error-title">
        <h3 id="connection-form-error-title">Connection unavailable</h3>
        <p role="alert">{loadError}</p>
        <Button type="button" variant="outline" onClick={handleCancel}>
          Back to connections
        </Button>
      </section>
    )
  }

  return (
    <section className="route-note" aria-labelledby="connection-form-title">
      <p className="eyebrow">Bring Your Own AI</p>
      <h3 id="connection-form-title">
        {mode === 'edit' ? 'Edit AI connection' : 'Create new AI connection'}
      </h3>
      <p className="text-sm text-text-muted">
        Provider credentials are write-only and are never displayed after saving.
      </p>
      <AiConnectionForm
        apiClient={apiClient}
        providers={providers}
        connection={connection}
        onSaved={handleSaved}
        onCancel={handleCancel}
      />
    </section>
  )
}
