import { useState } from 'react'
import type { AiConnection, AiTestResult, ProviderMetadata } from '../aiConnectionApi'
import { Button } from './ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'

interface AiConnectionListProps {
  connections: readonly AiConnection[]
  providers: readonly ProviderMetadata[]
  onEdit?: (connection: AiConnection) => void
  onToggle: (connection: AiConnection) => void
  onDelete: (connection: AiConnection) => void
  onTest: (connection: AiConnection) => void
  testingConnectionId?: string
  testResults?: Readonly<Record<string, AiTestResult>>
}

function formatTestTime(value: string | null): string {
  if (!value) {
    return 'Not tested yet'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function ConnectionRow({
  connection,
  providers,
  onEdit,
  onToggle,
  onDelete,
  onTest,
  testingConnectionId,
  testResults,
}: AiConnectionListProps & { connection: AiConnection }) {
  const provider = providers.find((candidate) => candidate.id === connection.providerId)
  const testResult = testResults?.[connection.id]
  const persistedFailureMessage =
    testResult === undefined &&
    connection.health === 'failing' &&
    connection.lastTestFailureKind
      ? getFailureMessage(connection.lastTestFailureKind, connection.lastErrorSummary ?? '')
      : null

  return (
    <li className="grid gap-3 rounded border border-border-subtle bg-surface-default p-4">
      <div>
        <h4>{connection.label}</h4>
        <p className="text-sm text-text-muted">
          {provider?.displayName ?? connection.providerId} · {connection.health}
        </p>
        <p className="text-sm text-text-muted">
          Last tested: {formatTestTime(connection.lastTestedAt)}
        </p>
        {testResult?.status === 'success' ? (
          <p role="status" className="text-sm text-state-success">
            Connection succeeded in {testResult.latencyMs} ms.
            {testResult.responseText ? ` Response: ${testResult.responseText}` : ''}
          </p>
        ) : null}
        {testResult?.status === 'failure' ? (
          <p role="alert" className="text-sm text-state-error">
            {getFailureMessage(testResult.failureKind, testResult.message)}
          </p>
        ) : null}
        {persistedFailureMessage ? (
          <p role="alert" className="text-sm text-state-error">
            {persistedFailureMessage}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {onEdit ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(connection)}>
            Edit
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onTest(connection)}
          disabled={testingConnectionId === connection.id}
        >
          {testingConnectionId === connection.id ? 'Testing...' : 'Test'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => onToggle(connection)}>
          {connection.enabled ? 'Disable' : 'Enable'}
        </Button>
        <Button type="button" variant="destructive" size="sm" onClick={() => onDelete(connection)}>
          Delete
        </Button>
      </div>
    </li>
  )
}

function getFailureMessage(failureKind: string, providerMessage: string): string {
  switch (failureKind) {
    case 'auth':
      return `Authentication failed. Check the stored provider credential and try again. ${providerMessage}`
    case 'not_found':
      return `The provider endpoint or model was not found. Check the connection endpoint and model settings. ${providerMessage}`
    case 'rate_limit':
      return `The provider rate limit was reached. Wait before testing again. ${providerMessage}`
    case 'timeout':
      return `The provider did not respond in time. Check the endpoint and try again. ${providerMessage}`
    case 'network':
      return `The provider could not be reached. Check the endpoint and network access. ${providerMessage}`
    case 'bad_request':
      return `The provider rejected the configuration. Review the connection fields. ${providerMessage}`
    default:
      return `The connection test failed. Review the provider settings and try again. ${providerMessage}`
  }
}

export function AiConnectionList(props: AiConnectionListProps) {
  const [pendingDelete, setPendingDelete] = useState<AiConnection | null>(null)
  const sortByLabel = (left: AiConnection, right: AiConnection) =>
    left.label.localeCompare(right.label, undefined, { sensitivity: 'base' })
  const active = props.connections
    .filter((connection) => connection.health === 'ready' || connection.health === 'untested')
    .sort(sortByLabel)
  const needsAttention = props.connections.filter(
    (connection) => connection.health === 'failing',
  )
  const disabled = props.connections.filter((connection) => connection.health === 'disabled')

  if (props.connections.length === 0) {
    return (
      <p role="status" className="text-sm text-text-muted">
        No AI connections yet. Add one to enable provider-backed workflows.
      </p>
    )
  }

  const requestDelete = (connection: AiConnection) => setPendingDelete(connection)

  return (
    <>
      <div className="connection-groups" aria-label="AI provider connections">
      <section aria-labelledby="active-connections-title">
        <h4 id="active-connections-title">
          Active connections ({active.length})
        </h4>
        {active.length > 0 ? (
          <ul className="mt-2 grid gap-3">
            {active.map((connection) => (
              <ConnectionRow key={connection.id} {...props} onDelete={requestDelete} connection={connection} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-text-muted">
            All connections need attention. Review them below.
          </p>
        )}
      </section>

      <section aria-labelledby="needs-attention-connections-title">
        <h4 id="needs-attention-connections-title">
          Needs attention ({needsAttention.length})
        </h4>
        <div id="needs-attention-connections" className="mt-2">
          {needsAttention.length > 0 ? (
            <ul className="grid gap-3">
              {needsAttention.map((connection) => (
                <ConnectionRow key={connection.id} {...props} onDelete={requestDelete} connection={connection} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No connections need attention.</p>
          )}
        </div>
      </section>

      <section aria-labelledby="disabled-connections-title">
        <h4 id="disabled-connections-title">
          Disabled ({disabled.length})
        </h4>
        <div className="mt-2">
          {disabled.length > 0 ? (
            <ul className="grid gap-3">
              {disabled.map((connection) => (
                <ConnectionRow key={connection.id} {...props} onDelete={requestDelete} connection={connection} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-muted">No disabled connections.</p>
          )}
        </div>
      </section>

      </div>
      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete AI connection?</DialogTitle>
            <DialogDescription>
              This permanently removes {pendingDelete?.label ?? 'this connection'} and its stored provider credentials.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (!pendingDelete) return
                const connection = pendingDelete
                setPendingDelete(null)
                props.onDelete(connection)
              }}
            >
              Delete connection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
