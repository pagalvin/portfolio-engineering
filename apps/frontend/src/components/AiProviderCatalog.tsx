import type { AiConnection, ProviderMetadata } from '../aiConnectionApi'
import { Button } from './ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'

interface AiProviderCatalogProps {
  providers: readonly ProviderMetadata[]
  connections: readonly AiConnection[]
  onCreateConnection: (providerId?: string) => void
}

const plannedProviders = [
  { id: 'anthropic', name: 'Anthropic' },
  { id: 'xai', name: 'xAI' },
  { id: 'openai-compatible', name: 'OpenAI-compatible hosts' },
  { id: 'local', name: 'Local and self-hosted models' },
]

export function AiProviderCatalog({
  providers,
  connections,
  onCreateConnection,
}: AiProviderCatalogProps) {
  const availableProviders = providers.filter((provider) => provider.usable)

  return (
    <section aria-labelledby="provider-catalog-title">
      <div className="mb-4">
        <p className="eyebrow">Provider catalog</p>
        <h3 id="provider-catalog-title">Supported providers</h3>
        <p className="text-sm text-text-muted">
          Available providers are supported by this build. Planned providers are shown for direction only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="available-providers-title">
          <h4 id="available-providers-title">Available now</h4>
          <ul className="mt-2 grid gap-3">
            {availableProviders.length > 0 ? (
              availableProviders.map((provider) => (
                <li key={provider.id}>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">{provider.displayName}</CardTitle>
                      <CardDescription>Configure a connection for this provider.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button type="button" size="sm" onClick={() => onCreateConnection(provider.id)}>
                        Create connection
                      </Button>
                      {connections.some((connection) => connection.providerId === provider.id) ? (
                        <p className="mt-2 text-sm italic text-text-muted">
                          You already have a connection for this provider.
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </li>
              ))
            ) : (
              <li className="text-sm text-text-muted">No providers are available in the current build.</li>
            )}
          </ul>
        </section>

        <section aria-labelledby="planned-providers-title">
          <h4 id="planned-providers-title">Planned</h4>
          <ul className="mt-2 grid gap-3">
            {plannedProviders.map((provider) => (
              <li key={provider.id}>
                <Card aria-disabled="true" className="opacity-70">
                  <CardHeader>
                    <CardTitle className="text-base">{provider.name}</CardTitle>
                    <CardDescription>Planned provider. Connection setup is not available yet.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <span className="text-sm text-text-muted">Not available in this build</span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </section>
  )
}
