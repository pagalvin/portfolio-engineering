import { useContext, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiClientContext } from './apiClientContext'
import { useHelpIndex, useHelpStatus, useHelpTopic } from './helpApi'
import { HelpContentStatus } from './components/HelpContentStatus'
import { MarkdownViewer } from './components/MarkdownViewer'
import { canonicalHelpRedirectPath } from './helpRoutes'

export function HelpTopicPage() {
  const client = useContext(ApiClientContext)
  const { helpKey } = useParams()
  const navigate = useNavigate()
  const topic = useHelpTopic(client, helpKey)
  const index = useHelpIndex(client)
  const status = useHelpStatus(client)
  const knownEntry = index.data?.index.entries.find((entry) => entry.key === helpKey)

  useEffect(() => {
    const redirectPath = topic.data
      ? canonicalHelpRedirectPath(topic.data.status, topic.data.redirectTo)
      : null
    if (redirectPath) {
      navigate(redirectPath, { replace: true })
    }
  }, [navigate, topic.data])

  if (topic.loading) {
    return <TopicState title={knownEntry?.title ?? 'Loading help topic'} message="Loading official guidance." />
  }

  if (topic.error || !topic.data) {
    return <TopicState title="Help topic unavailable" message="This help topic could not be loaded. Return to Help to browse available topics." error />
  }

  if (topic.data.status === 'redirect') {
    return <TopicState title="Opening help topic" message="Taking you to the current topic." />
  }

  if (topic.data.status === 'unavailable' || !topic.data.entry) {
    return (
      <TopicState
        title="Help topic unavailable"
        message="This topic is no longer available. Return to Help to browse available guidance."
        error
      />
    )
  }

  const markdown = topic.data.content && 'markdown' in topic.data.content
    ? topic.data.content.markdown
    : ''

  return (
    <article className="workspace-content" aria-labelledby="help-topic-heading">
      <Link to="/help" className="text-sm text-action-primary underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        ← Back to Help
      </Link>
      <header className="status-panel">
        <p className="eyebrow">Official guidance</p>
        <h1 id="help-topic-heading">{topic.data.entry.title ?? topic.data.helpKey}</h1>
      </header>
      <HelpContentStatus metadata={topic.data.metadata} status={status.data ?? undefined} />
      <MarkdownViewer value={markdown} label={`${topic.data.entry.title ?? 'Help topic'} content`} />
      <p className="text-sm text-text-muted">
        If something looks wrong, <a className="text-action-primary underline" href="https://github.com/pagalvin/portfolio-engineering/issues" target="_blank" rel="noopener noreferrer">create a GitHub issue</a>.
      </p>
    </article>
  )
}

interface TopicStateProps {
  title: string
  message: string
  error?: boolean
}

function TopicState({ title, message, error = false }: TopicStateProps) {
  return (
    <section className={`status-panel ${error ? 'error-panel' : ''}`} aria-live="polite" role={error ? 'alert' : undefined}>
      <p className="eyebrow">Help</p>
      <h1>{title}</h1>
      <p>{message}</p>
      <Link to="/help" className="mt-4 inline-block text-action-primary underline">Return to Help</Link>
    </section>
  )
}
