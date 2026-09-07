import { useContext, useMemo } from 'react'
import { useHelpIndex, useHelpStatus } from './helpApi'
import { ApiClientContext } from './apiClientContext'
import { HelpContentStatus } from './components/HelpContentStatus'
import { HelpGroup } from './components/HelpGroup'

const HELP_GROUPS = ['Portfolio', 'Execution', 'Risk', 'Learning', 'System'] as const

export function helpGroups(entries: readonly import('@portfolio-engineering/shared-types/help').HelpIndexEntry[]) {
  const activePages = entries.filter((entry) => entry.type === 'page' && entry.status === 'active')
  return HELP_GROUPS.map((name) => ({
    name,
    entries: activePages
      .filter((entry) => entry.group === name)
      .sort((left, right) => (left.order ?? 0) - (right.order ?? 0)),
  }))
}

export function HelpLandingPage() {
  const client = useContext(ApiClientContext)
  const index = useHelpIndex(client)
  const status = useHelpStatus(client)
  const groups = useMemo(() => {
    return helpGroups(index.data?.index.entries ?? [])
  }, [index.data])

  if (index.loading) {
    return <HelpState title="Loading Help" message="Loading official Portfolio OS guidance." />
  }

  if (index.error || !index.data) {
    return (
      <HelpState
        title="Help is unavailable"
        message="We could not load help content right now. Please try again later."
        error
      />
    )
  }

  return (
    <section className="workspace-content" aria-labelledby="help-heading">
      <header className="status-panel">
        <p className="eyebrow">Official guidance</p>
        <h1 id="help-heading">Help</h1>
        <p>Learn how to use Portfolio OS through official product guidance.</p>
      </header>
      <HelpContentStatus metadata={index.data.metadata} status={status.data ?? undefined} />
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((group) => <HelpGroup key={group.name} {...group} />)}
      </div>
    </section>
  )
}

interface HelpStateProps {
  title: string
  message: string
  error?: boolean
}

function HelpState({ title, message, error = false }: HelpStateProps) {
  return (
    <section className={`status-panel ${error ? 'error-panel' : ''}`} aria-live="polite" role={error ? 'alert' : undefined}>
      <p className="eyebrow">Help</p>
      <h1>{title}</h1>
      <p>{message}</p>
    </section>
  )
}
