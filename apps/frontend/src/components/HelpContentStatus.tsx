import type { HelpResponseMetadata, HelpStatusResponse } from '../helpTypes'

interface HelpContentStatusProps {
  metadata?: Pick<HelpResponseMetadata, 'freshness' | 'source'>
  status?: Pick<HelpStatusResponse, 'freshness' | 'source'>
  contentName?: string
}

export function HelpContentStatus({
  metadata,
  status,
  contentName = 'Help',
}: HelpContentStatusProps) {
  const freshness = metadata?.freshness ?? status?.freshness
  const source = metadata?.source ?? status?.source
  if (freshness === 'fresh' && source === 'cache') return null

  const message =
    source === 'bundled'
      ? contentName === 'Help'
        ? 'Help content could not be refreshed. Showing compatible bundled guidance.'
        : `${contentName} content could not be refreshed. Showing compatible bundled content.`
      : freshness === 'stale'
        ? `${contentName} content may be out of date.`
        : `${contentName} content availability is limited.`

  return (
    <p role="status" className="rounded-md border border-border-subtle bg-surface-muted p-3 text-sm text-text-muted">
      {message}
    </p>
  )
}

export function helpContentStatusMessage(
  metadata?: Pick<HelpResponseMetadata, 'freshness' | 'source'>,
  status?: Pick<HelpStatusResponse, 'freshness' | 'source'>,
  contentName = 'Help',
): string | null {
  const freshness = metadata?.freshness ?? status?.freshness
  const source = metadata?.source ?? status?.source
  if (freshness === 'fresh' && source === 'cache') return null
  return source === 'bundled'
    ? contentName === 'Help'
      ? 'Help content could not be refreshed. Showing compatible bundled guidance.'
      : `${contentName} content could not be refreshed. Showing compatible bundled content.`
    : freshness === 'stale'
      ? `${contentName} content may be out of date.`
      : `${contentName} content availability is limited.`
}
