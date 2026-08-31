import { useNavigate } from 'react-router'
import type { ScaffoldRoute } from './scaffoldRoutes'

interface PlaceholderPageProps {
  route: ScaffoldRoute
}

export function PlaceholderPage({ route }: PlaceholderPageProps) {
  const navigate = useNavigate()

  const handleNavigate = (path: string) => {
    navigate(path)
  }

  return (
    <section className="status-panel workspace-content">
      <p className="eyebrow">{route.status}</p>
      <h2>{route.title}</h2>
      <p>{route.purpose}</p>

      <ul className="placeholder-grid">
        {route.placeholderBlocks.map((block) => (
          <li key={block}>
            <h3>{block}</h3>
            <p>Placeholder block for future implementation.</p>
          </li>
        ))}
      </ul>

      {route.id === 'training' ? <TrainingPanel /> : null}
      {route.id === 'glossary' ? <GlossaryPanel /> : null}
      {route.id === 'journal' ? (
        <section className="route-note">
          <h3>Priority deep dive</h3>
          <p>
            Journaling is intentionally scaffold-only in this phase and is the first planned feature for detailed implementation in a future session.
          </p>
        </section>
      ) : null}

      {route.id === 'dashboard' ? (
        <div className="actions-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              handleNavigate('/workspace/glossary')
            }}
          >
            Open Glossary
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              handleNavigate('/workspace/training')
            }}
          >
            Open Training Hub
          </button>
        </div>
      ) : null}
    </section>
  )
}

function TrainingPanel() {
  const curatedLinks = [
    {
      title: 'Options Industry Council education',
      source: 'The Options Industry Council',
      level: 'Beginner',
    },
    {
      title: 'FINRA investor resources',
      source: 'FINRA',
      level: 'Beginner',
    },
    {
      title: 'Cboe options institute resources',
      source: 'Cboe',
      level: 'Intermediate',
    },
  ]

  return (
    <section className="route-note">
      <h3>Curated external training links</h3>
      <p>
        This section will prioritize high-quality external resources with lightweight in-app primers.
      </p>
      <ul className="definition-list">
        {curatedLinks.map((link) => (
          <li key={link.title}>
            <strong>{link.title}</strong> - {link.source} ({link.level})
          </li>
        ))}
      </ul>
    </section>
  )
}

function GlossaryPanel() {
  const terms = [
    {
      term: 'NAV',
      plainLanguage: 'Net asset value, the value of assets minus liabilities.',
      whyItMatters: 'Helps track overall portfolio value and trend over time.',
    },
    {
      term: 'Delta',
      plainLanguage: 'How much an option price may move when the stock moves by $1.',
      whyItMatters: 'Shows directional sensitivity and position bias.',
    },
    {
      term: 'Theta',
      plainLanguage: 'How much value an option may lose each day from time passing.',
      whyItMatters: 'Important for premium-selling and time-decay expectations.',
    },
    {
      term: 'Buying power',
      plainLanguage: 'Capital available to open additional positions.',
      whyItMatters: 'Constrains new orders and affects risk flexibility.',
    },
  ]

  return (
    <section className="route-note">
      <h3>Fast term definitions</h3>
      <p>
        Industry terms remain visible in the product, with plain-language support available at the point of use.
      </p>
      <ul className="definition-list">
        {terms.map((item) => (
          <li key={item.term}>
            <strong>{item.term}:</strong> {item.plainLanguage} <em>Why it matters:</em>{' '}
            {item.whyItMatters}
          </li>
        ))}
      </ul>
    </section>
  )
}
