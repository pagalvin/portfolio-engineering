import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type {
  AiConnection,
  AiConnectionInput,
  AiConnectionUpdateInput,
  ProviderMetadata,
} from '../aiConnectionApi'
import {
  createAiConnection,
  updateAiConnection,
} from '../aiConnectionApi'
import type { AuthenticatedApiClient } from '../apiClient'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Select } from './ui/select'

interface AiConnectionFormProps {
  apiClient: AuthenticatedApiClient
  providers: readonly ProviderMetadata[]
  connection?: AiConnection
  onSaved: (connection: AiConnection) => void | Promise<void>
  onCancel: () => void
}

export function AiConnectionForm({
  apiClient,
  providers,
  connection,
  onSaved,
  onCancel,
}: AiConnectionFormProps) {
  const [providerId, setProviderId] = useState(connection?.providerId ?? providers[0]?.id ?? '')
  const [label, setLabel] = useState(connection?.label ?? '')
  const [values, setValues] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const provider = useMemo(
    () => providers.find((candidate) => candidate.id === providerId),
    [providerId, providers],
  )

  useEffect(() => {
    if (connection) {
      setProviderId(connection.providerId)
      setLabel(connection.label)
      setValues(
        Object.fromEntries(
          Object.entries(connection.config).map(([key, value]) => [key, String(value)]),
        ),
      )
    }
  }, [connection])

  useEffect(() => {
    if (!connection && !providerId && providers[0]) {
      setProviderId(providers[0].id)
    }
  }, [connection, providerId, providers])

  const handleProviderChange = (nextProviderId: string) => {
    setProviderId(nextProviderId)
    setValues({})
    setErrorMessage(null)
  }

  const handleValueChange = (name: string, value: string) => {
    setValues((current) => ({ ...current, [name]: value }))
  }

  const parsedValues = useMemo(() => {
    const config: Record<string, unknown> = {}
    const secrets: Record<string, unknown> = {}

    for (const field of provider?.fields ?? []) {
      const value = values[field.name]?.trim() ?? ''
      if (!value) continue
      const parsedValue =
        field.type === 'number' ? Number(value) : field.type === 'boolean' ? value === 'true' : value
      if (field.secret) secrets[field.name] = parsedValue
      else config[field.name] = parsedValue
    }

    return { config, secrets }
  }, [provider, values])

  const hasChanges = useMemo(() => {
    if (!connection) {
      return label.trim().length > 0 || Object.keys(parsedValues.config).length > 0 || Object.keys(parsedValues.secrets).length > 0
    }

    return label.trim() !== connection.label
      || JSON.stringify(parsedValues.config) !== JSON.stringify(connection.config)
      || Object.keys(parsedValues.secrets).length > 0
  }, [connection, label, parsedValues])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!provider) {
      setErrorMessage('Select a provider before saving the connection.')
      return
    }

    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (connection) {
        const update = {
          label: label.trim(),
          config: parsedValues.config,
          // Secret inputs are write-only. Omitting them entirely when blank
          // preserves the API's distinction between "keep the stored secret"
          // and "replace it", including the connection's canonical health state.
          ...(Object.keys(parsedValues.secrets).length > 0 ? { secrets: parsedValues.secrets } : {}),
        } satisfies AiConnectionUpdateInput

        const saved = await updateAiConnection(apiClient, connection.id, update)
        await onSaved(saved)
        return
      }

      const saved = await createAiConnection(apiClient, {
        providerId,
        label: label.trim(),
        config: parsedValues.config,
        secrets: parsedValues.secrets,
      } satisfies AiConnectionInput)
      await onSaved(saved)
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to save this connection.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!provider) {
    return <p role="status">No usable AI providers are available.</p>
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <label htmlFor="ai-connection-provider">Provider</label>
        <Select
          id="ai-connection-provider"
          value={providerId}
          onChange={(event) => handleProviderChange(event.target.value)}
          disabled={Boolean(connection)}
        >
          {providers.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.displayName}
            </option>
          ))}
        </Select>
      </div>

      <div className="grid gap-2">
        <label htmlFor="ai-connection-label">Connection label</label>
        <Input
          id="ai-connection-label"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="Primary AI connection"
          required
        />
      </div>

      {provider.fields.map((field) => {
        const fieldId = `ai-connection-${field.name}`
        return (
          <div className="grid gap-2" key={field.name}>
            <label htmlFor={fieldId}>
              {field.label ?? field.name}
              {field.required ? ' (required)' : ' (optional)'}
            </label>
            <Input
              id={fieldId}
              type={field.type === 'number' ? 'number' : field.secret ? 'password' : 'text'}
              value={values[field.name] ?? ''}
              onChange={(event) => handleValueChange(field.name, event.target.value)}
              placeholder={field.secret && connection ? 'Leave blank to keep the stored secret' : field.placeholder}
              required={field.required && !connection}
              aria-describedby={field.description ? `${fieldId}-description` : undefined}
            />
            {field.description ? (
              <p id={`${fieldId}-description`} className="text-sm text-text-muted">
                {field.description}
              </p>
            ) : null}
            {field.secret && connection ? (
              <p className="text-sm text-text-muted">
                Stored securely. The current value is never displayed.
              </p>
            ) : null}
          </div>
        )
      })}

      {errorMessage ? (
        <p role="alert" className="text-sm text-state-error">
          {errorMessage}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isSaving || !hasChanges}>
          {isSaving ? 'Saving...' : connection ? 'Save changes' : 'Add connection'}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
