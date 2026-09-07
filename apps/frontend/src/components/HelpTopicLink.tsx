import { Link } from 'react-router'
import type { HelpIndexEntry } from '@portfolio-engineering/shared-types/help'

interface HelpTopicLinkProps {
  entry: HelpIndexEntry
}

export function HelpTopicLink({ entry }: HelpTopicLinkProps) {
  return (
    <li>
      <Link
        to={`/help/${encodeURIComponent(entry.key)}`}
        className="block rounded-md border border-border-subtle bg-surface-default p-3 text-text-primary transition hover:border-action-primary hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-semibold text-text-strong">{entry.title ?? entry.key}</span>
        {entry.parentKey ? (
          <span className="mt-1 block text-sm text-text-muted">More about this area</span>
        ) : null}
      </Link>
    </li>
  )
}
