import type { HelpIndexEntry } from '@portfolio-engineering/shared-types/help'
import { HelpTopicLink } from './HelpTopicLink'

interface HelpGroupProps {
  name: string
  entries: readonly HelpIndexEntry[]
}

export function HelpGroup({ name, entries }: HelpGroupProps) {
  return (
    <section aria-labelledby={`help-group-${name.toLowerCase()}`} className="rounded-lg border border-border-subtle bg-surface-muted p-4">
      <h2 id={`help-group-${name.toLowerCase()}`} className="text-lg font-semibold text-text-strong">
        {name}
      </h2>
      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Help for this area is being prepared.</p>
      ) : (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2" aria-label={`${name} help topics`}>
          {entries.map((entry) => <HelpTopicLink key={entry.key} entry={entry} />)}
        </ul>
      )}
    </section>
  )
}
