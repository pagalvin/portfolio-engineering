import { NavLink } from 'react-router'
import type { ChangelogUnreadState } from './changeLogApi'

export const CHANGELOG_UNKNOWN_STATUS =
  "New changelog status couldn't be checked."

interface ChangeLogNavigationProps {
  state: ChangelogUnreadState
}

export function ChangeLogNavigation({ state }: ChangeLogNavigationProps) {
  return (
    <li>
      <NavLink
        to="/change-log"
        className="nav-link focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-action-primary)]"
      >
        Change Log
        {state.hasUnread ? (
          <span className="ml-2 rounded bg-[var(--color-surface-emphasis)] px-1.5 py-0.5 text-xs font-semibold text-[var(--color-text-strong)]">
            New
          </span>
        ) : null}
      </NavLink>
      {state.requestFailed ? (
        <span className="ml-2 block text-sm text-[var(--color-text-muted)]" role="status" aria-live="polite">
          {CHANGELOG_UNKNOWN_STATUS}
        </span>
      ) : null}
    </li>
  )
}
