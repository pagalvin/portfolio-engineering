import { Link, NavLink, Outlet, useLocation } from 'react-router'
import type { HelpIndexEntry } from '@portfolio-engineering/shared-types/help'
import { HelpTopicLink } from '../components/HelpTopicLink'
import { useIntuitionLedgerDueCount } from './intuitionLedgerDueCount'

const intuitionLedgerHelpEntry: HelpIndexEntry = {
  key: 'help.learning.intuition-ledger',
  title: 'Help: Intuition Ledger',
  type: 'page',
  path: 'content/help/pages/intuition-ledger.md',
  group: 'Learning',
  order: 30,
  minAppVersion: '1.0.0',
  aliases: [],
  status: 'active',
}

const LEDGER_PATH = '/workspace/intuition-ledger'

export function IntuitionLedgerLayout() {
  const { count } = useIntuitionLedgerDueCount()
  const { pathname } = useLocation()
  const showCreate = pathname === LEDGER_PATH ||
    pathname === `${LEDGER_PATH}/due` ||
    pathname === `${LEDGER_PATH}/predictions`
  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex rounded-md px-3 py-2 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${isActive ? 'bg-surface-muted text-text-primary' : 'text-text-muted hover:bg-surface-muted hover:text-text-primary'}`

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Intuition Ledger</h1>
          <p className="mt-1 text-sm text-text-muted">Record predictions, review what is due, and reflect on outcomes.</p>
        </div>
        <ul aria-label="Intuition Ledger help" className="m-0 list-none p-0">
          <HelpTopicLink entry={intuitionLedgerHelpEntry} />
        </ul>
        {showCreate && (
          <Link
            to={`${LEDGER_PATH}/predictions/new`}
            className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            New prediction
          </Link>
        )}
      </header>
      <nav aria-label="Intuition Ledger views" className="flex flex-wrap gap-2 border-b border-border-subtle pb-3">
        <NavLink to={LEDGER_PATH} end className={tabClass}>Overview</NavLink>
        <NavLink to={`${LEDGER_PATH}/due`} className={tabClass}>
          {count === null ? 'Due' : `Due (${count})`}
        </NavLink>
        <NavLink to={`${LEDGER_PATH}/predictions`} end className={tabClass}>All predictions</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
