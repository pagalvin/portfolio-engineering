import { useId, useState } from 'react'
import { Link } from 'react-router'
import type { AuthenticatedApiClient } from '../apiClient'
import { useHelpTooltip } from '../helpApi'
import { helpTopicPath } from '../helpRoutes'

interface HelpTooltipProps {
  client: AuthenticatedApiClient | null
  helpKey: string
  label: string
  relatedPageKey?: string
  fallback?: string
}

export function HelpTooltip({
  client,
  helpKey,
  label,
  relatedPageKey,
  fallback,
}: HelpTooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const { data } = useHelpTooltip(client, helpKey)
  const text =
    data?.status === 'available' && data.content && 'text' in data.content
      ? data.content.text
      : fallback
  const learnMoreKey = relatedPageKey ?? data?.entry?.relatedPageKey

  if (!text) return null

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle text-sm text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ?
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-8 z-10 w-64 rounded-md border border-border-subtle bg-surface-default p-3 text-sm text-text-primary shadow-lg"
        >
          <span>{text}</span>
          {learnMoreKey ? (
            <Link className="mt-2 block text-action-primary underline" to={helpTopicPath(learnMoreKey)}>
              Learn more
            </Link>
          ) : null}
        </span>
      ) : null}
    </span>
  )
}
