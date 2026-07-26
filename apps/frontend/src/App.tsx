import { useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import {
  exchangeGoogleTokenForSession,
  getGoogleClientId,
  type SessionResponse,
  getSessionEndpoint,
} from './authSession'
import type { AuthenticatedSessionResponse } from '@portfolio-engineering/shared-types/auth'
import {
  initializeGoogleSignIn,
  loadGoogleIdentityScript,
  renderGoogleSignInButton,
} from './googleIdentity'
import {
  defaultWorkspaceRoute,
  scaffoldRoutes,
  type ScaffoldRoute,
} from './scaffoldRoutes'

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInErrorMessage, setSignInErrorMessage] = useState<string | null>(null)
  const googleSignInButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = getGoogleClientId()
  const [currentPathname, setCurrentPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const controller = new AbortController()

    async function loadSession() {
      setIsLoading(true)
      setErrorMessage(null)

      const response = await fetch(getSessionEndpoint(), {
        credentials: 'include',
        signal: controller.signal,
      })

      if (response.status === 401) {
        const unauthenticatedSession =
          (await response.json()) as SessionResponse
        setSession(unauthenticatedSession)
        setIsLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error(
          `Unable to load the current session (${response.status} ${response.statusText})`,
        )
      }

      const authenticatedSession =
        (await response.json()) as AuthenticatedSessionResponse
      setSession(authenticatedSession)
      setIsLoading(false)
    }

    loadSession().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return
      }

      setSession(null)
      setIsLoading(false)
      setErrorMessage(getErrorMessage(error, 'Unable to load the current session.'))
    })

    return () => {
      controller.abort()
    }
  }, [])

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setIsSigningIn(true)
    setSignInErrorMessage(null)

    try {
      const authenticatedSession = await exchangeGoogleTokenForSession(idToken)
      setSession(authenticatedSession)
    } catch (error) {
      setSignInErrorMessage(
        getErrorMessage(error, 'Unable to complete Google sign-in.'),
      )
    } finally {
      setIsSigningIn(false)
    }
  }, [])

  useEffect(() => {
    if (isLoading || session?.authenticated !== false) {
      return
    }

    if (!googleClientId) {
      setSignInErrorMessage(
        'Google sign-in is not configured. Set VITE_GOOGLE_CLIENT_ID in your frontend environment.',
      )
      return
    }

    let isMounted = true
    const googleSignInButtonElement = googleSignInButtonRef.current
    setIsGoogleReady(false)
    setSignInErrorMessage(null)

    loadGoogleIdentityScript()
      .then(() => {
        if (!isMounted) {
          return
        }

        initializeGoogleSignIn(googleClientId, (idToken) => {
          void handleGoogleCredential(idToken)
        }, (message) => {
          if (!isMounted) {
            return
          }
          setSignInErrorMessage(message)
        })

        if (!googleSignInButtonElement) {
          return
        }

        renderGoogleSignInButton(googleSignInButtonElement)
        setIsGoogleReady(true)
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return
        }

        setSignInErrorMessage(
          getErrorMessage(error, 'Unable to load Google sign-in.'),
        )
      })

    return () => {
      isMounted = false
      if (googleSignInButtonElement) {
        googleSignInButtonElement.innerHTML = ''
      }
    }
  }, [googleClientId, handleGoogleCredential, isLoading, session?.authenticated])

  useEffect(() => {
    function handlePopState() {
      setCurrentPathname(window.location.pathname)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  useEffect(() => {
    if (!session?.authenticated || currentPathname !== '/') {
      return
    }

    window.history.replaceState(null, '', defaultWorkspaceRoute)
    setCurrentPathname(defaultWorkspaceRoute)
  }, [currentPathname, session?.authenticated])

  const handleNavigate = useCallback((path: string) => {
    if (window.location.pathname === path) {
      return
    }

    window.history.pushState(null, '', path)
    setCurrentPathname(path)
  }, [])

  const demoAuthHint = import.meta.env.DEV ? window.location.origin : null

  let content = null

  if (isLoading) {
    content = (
      <div className="status-panel" aria-live="polite">
        <p className="eyebrow">Session status</p>
        <h2>Checking your session...</h2>
        <p>Loading the current auth/session contract before the app renders user-specific content.</p>
      </div>
    )
  } else if (errorMessage) {
    content = (
      <div className="status-panel error-panel" role="alert">
        <p className="eyebrow">Session status</p>
        <h2>We could not load your session.</h2>
        <p>{errorMessage}</p>
      </div>
    )
  } else if (session?.authenticated) {
    content = (
      <WorkspaceShell
        currentPathname={currentPathname}
        onNavigate={handleNavigate}
        userDisplayName={session.user.displayName}
      />
    )
  } else {
    content = (
      <div className="status-panel unauthenticated-panel">
        <p className="eyebrow">Unauthenticated</p>
        <h2>Please log in.</h2>
        <p>{session?.message ?? 'You must sign in before the app can show your portfolio workspace.'}</p>
        <div className="sign-in-panel">
          <p className="helper-copy">
            Use Google sign-in to establish an authenticated session backed by the API callback route.
          </p>
          <div
            ref={googleSignInButtonRef}
            className="google-signin-button"
            aria-label="Sign in with Google"
          />
          {isGoogleReady || !googleClientId ? null : (
            <p className="sign-in-status">Loading Google sign-in...</p>
          )}
          {isSigningIn ? <p className="sign-in-status">Signing you in...</p> : null}
          {signInErrorMessage ? (
            <p className="sign-in-error" role="alert">
              {signInErrorMessage}
            </p>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Portfolio Engineering</p>
        <h1>Portfolio OS scaffold workspace</h1>
        <p className="hero-copy">
          This frontend now includes URL-addressable placeholder routes for every major feature so the product can evolve feature-by-feature without losing navigation continuity.
        </p>
        {demoAuthHint ? (
          <p className="helper-copy">
            For local development, open <code>{demoAuthHint}/?demoAuth=authenticated</code> or <code>{demoAuthHint}/?demoAuth=unauthenticated</code> to preview both session states against the JWT-backed development endpoint.
          </p>
        ) : null}
      </section>

      {content}
    </main>
  )
}

function WorkspaceShell(props: {
  currentPathname: string
  onNavigate: (path: string) => void
  userDisplayName: string
}) {
  const routeByPath = new Map<string, ScaffoldRoute>(
    scaffoldRoutes.map((route) => [route.path, route]),
  )
  const activeRoute = routeByPath.get(props.currentPathname) ?? null
  const navGroups = buildNavGroups(scaffoldRoutes)

  return (
    <section className="workspace-shell">
      <header className="status-panel authenticated-panel workspace-header">
        <p className="eyebrow">Authenticated workspace</p>
        <h2>Welcome back, {props.userDisplayName}.</h2>
        <p>
          Major features are scaffolded as direct routes so refresh and browser history preserve your place.
        </p>
      </header>

      <div className="workspace-layout">
        <nav className="status-panel workspace-nav" aria-label="Primary workspace navigation">
          {navGroups.map((group) => (
            <section key={group.name} className="nav-group">
              <h3>{group.name}</h3>
              <ul>
                {group.routes.map((route) => {
                  const isActive = route.path === props.currentPathname
                  const className = isActive ? 'nav-link active' : 'nav-link'

                  return (
                    <li key={route.id}>
                      <a
                        href={route.path}
                        className={className}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={(event) => {
                          event.preventDefault()
                          props.onNavigate(route.path)
                        }}
                      >
                        {route.title}
                      </a>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </nav>

        {activeRoute ? (
          <PlaceholderPage route={activeRoute} onNavigate={props.onNavigate} />
        ) : (
          <section className="status-panel error-panel">
            <p className="eyebrow">Route status</p>
            <h2>Route not found.</h2>
            <p>
              The current route is not mapped to a scaffold page yet. Use the workspace navigation or return to the dashboard.
            </p>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                props.onNavigate(defaultWorkspaceRoute)
              }}
            >
              Go to Dashboard
            </button>
          </section>
        )}
      </div>
    </section>
  )
}

function PlaceholderPage(props: {
  route: ScaffoldRoute
  onNavigate: (path: string) => void
}) {
  return (
    <section className="status-panel workspace-content">
      <p className="eyebrow">{props.route.status}</p>
      <h2>{props.route.title}</h2>
      <p>{props.route.purpose}</p>

      <ul className="placeholder-grid">
        {props.route.placeholderBlocks.map((block) => (
          <li key={block}>
            <h3>{block}</h3>
            <p>Placeholder block for future implementation.</p>
          </li>
        ))}
      </ul>

      {props.route.id === 'training' ? <TrainingPanel /> : null}
      {props.route.id === 'glossary' ? <GlossaryPanel /> : null}
      {props.route.id === 'journal' ? (
        <section className="route-note">
          <h3>Priority deep dive</h3>
          <p>
            Journaling is intentionally scaffold-only in this phase and is the first planned feature for detailed implementation in a future session.
          </p>
        </section>
      ) : null}

      {props.route.id === 'dashboard' ? (
        <div className="actions-row">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              props.onNavigate('/workspace/glossary')
            }}
          >
            Open Glossary
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              props.onNavigate('/workspace/training')
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

function buildNavGroups(routes: readonly ScaffoldRoute[]) {
  const navGroups = new Map<string, ScaffoldRoute[]>()

  for (const route of routes) {
    const groupRoutes = navGroups.get(route.navGroup)
    if (groupRoutes) {
      groupRoutes.push(route)
      continue
    }

    navGroups.set(route.navGroup, [route])
  }

  return Array.from(navGroups.entries()).map(([name, groupedRoutes]) => ({
    name,
    routes: groupedRoutes,
  }))
}

export default App
