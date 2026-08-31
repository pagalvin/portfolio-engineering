import type { ReactNode } from 'react'

export interface NotYetImplementedLink {
  label: string
  href: string
  title?: string
}

export interface NotYetImplementedProps {
  featureName: string
  description: ReactNode
  links?: NotYetImplementedLink[]
}

const DEFAULT_LINKS: NotYetImplementedLink[] = [
  {
    label: 'Portfolio Engineering subreddit',
    href: 'https://www.reddit.com/r/PortfolioEngineering/',
    title: 'Community discussion on Reddit'
  }
]

/**
 * NotYetImplemented: Reusable placeholder for intentionally visible, unavailable capabilities.
 *
 * This component presents planned features with:
 * - Clear "coming soon" messaging
 * - Feature-specific title and description (passed as props)
 * - Community prioritization links (defaults to subreddit)
 * - Fully keyboard-accessible and screen-reader friendly
 * - No API calls, service invocations, or data mutations
 *
 * Follows ADR 0003: Use a shared placeholder for planned features.
 * Uses semantic HTML and adheres to accessible practices.
 */
export function NotYetImplemented({
  featureName,
  description,
  links = DEFAULT_LINKS,
}: NotYetImplementedProps) {
  const allLinks = links.length > 0 ? links : DEFAULT_LINKS

  return (
    <div
      className="rounded-lg border border-amber-200 bg-amber-50 p-6"
      role="status"
      aria-label={`${featureName} is not yet implemented`}
    >
      <div className="mb-4">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">
          {featureName} <span className="text-sm font-normal text-gray-600">(coming soon)</span>
        </h3>
        <p className="text-gray-700">{description}</p>
      </div>

      <div className="space-y-3 border-t border-amber-200 pt-4">
        <p className="text-sm font-medium text-gray-900">Interested in this feature?</p>
        <ul className="space-y-2">
          {allLinks.map((link, index) => (
            <li key={index}>
              <a
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                title={link.title}
                className="inline-flex items-center gap-2 rounded px-2 py-1 text-sm text-action-primary hover:underline focus:outline-none focus:ring-2 focus:ring-action-primary focus:ring-offset-2"
              >
                {link.label}
                <span aria-hidden="true">→</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
