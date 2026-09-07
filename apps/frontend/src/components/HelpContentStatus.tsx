import type { HelpResponseMetadata, HelpStatusResponse } from '../helpTypes'

interface HelpContentStatusProps {
  metadata?: HelpResponseMetadata
  status?: HelpStatusResponse
}

export function HelpContentStatus({ metadata, status }: HelpContentStatusProps) {
  const freshness = metadata?.freshness ?? status?.freshness
  const source = metadata?.source ?? status?.source
  if (freshness === 'fresh' && source === 'cache') return null

  const message =
    source === 'bundled'
      ? 'Help content could not be refreshed. Showing compatible bundled guidance.'
      : freshness === 'stale'
        ? 'Help content may be out of date.'
        : 'Help content availability is limited.'

  return (
    <p role="status" className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-text-muted">
      {message}
    </p>
  )
}

export function helpContentStatusMessage(
  metadata?: HelpResponseMetadata,
  status?: HelpStatusResponse,
): string | null {
  const freshness = metadata?.freshness ?? status?.freshness
  const source = metadata?.source ?? status?.source
  if (freshness === 'fresh' && source === 'cache') return null
  return source === 'bundled'
    ? 'Help content could not be refreshed. Showing compatible bundled guidance.'
    : freshness === 'stale'
      ? 'Help content may be out of date.'
      : 'Help content availability is limited.'
}
