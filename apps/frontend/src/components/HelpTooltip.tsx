import { useEffect, useId, useRef, useState } from 'react'
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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const tooltipRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return

    const updatePosition = () => {
      const trigger = triggerRef.current
      const tooltip = tooltipRef.current
      if (!trigger || !tooltip) return

      const triggerRect = trigger.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const margin = 8
      const left = Math.max(margin, Math.min(triggerRect.left, window.innerWidth - tooltipRect.width - margin))
      const below = triggerRect.bottom + tooltipRect.height + margin <= window.innerHeight - margin
      const top = below
        ? triggerRect.bottom + margin
        : Math.max(margin, triggerRect.top - tooltipRect.height - margin)

      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
      tooltip.style.visibility = 'visible'
    }

    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  const text =
    data?.status === 'available' && data.content && 'text' in data.content
      ? data.content.text
      : fallback
  const learnMoreKey = relatedPageKey ?? data?.entry?.relatedPageKey

  if (!text) return null

  const tooltipVisibility = open ? { visibility: 'hidden' as const } : undefined

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        ref={triggerRef}
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
          ref={tooltipRef}
          id={id}
          role="tooltip"
          style={tooltipVisibility}
          className="fixed left-0 top-0 z-50 w-64 max-w-[calc(100vw-2rem)] max-h-[calc(100vh-2rem)] overflow-y-auto rounded-md border border-border-subtle bg-surface-default p-3 text-sm text-text-primary shadow-lg"
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
