import { useCallback, useEffect, useRef, useState, createContext } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useNavigate,
} from 'react-router'
import './App.css'
import {
  exchangeGoogleTokenForSession,
  getGoogleClientId,
  type SessionResponse,
  getSessionEndpoint,
  getAccessToken,
  setAccessToken,
  refreshAccessToken,
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
import { createAuthenticatedApiClient, type AuthenticatedApiClient } from './apiClient'
import { PlaceholderPage } from './PlaceholderPage'
import { NotFoundPage } from './NotFoundPage'
import { JournalPage } from './JournalPage'

export const ApiClientContext = createContext<AuthenticatedApiClient | null>(null)

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

function AppContent() {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(true)
  const [session, setSession] = useState<SessionResponse | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isGoogleReady, setIsGoogleReady] = useState(false)
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [signInErrorMessage, setSignInErrorMessage] = useState<string | null>(null)
  const [apiClient, setApiClient] = useState<AuthenticatedApiClient | null>(null)
  const googleSignInButtonRef = useRef<HTMLDivElement | null>(null)
  const googleClientId = getGoogleClientId()

  /**
   * Handle session expiry: clear stored token and refresh session
   */
  const handleSessionExpired = useCallback(() => {
    setAccessToken(null)
    setSession(null)
    setApiClient(null)
  }, [])

  /**
   * Create API client when session authenticates
   */
  const createApiClient = useCallback(() => {
    return createAuthenticatedApiClient({
      getAccessToken,
      onSessionExpired: handleSessionExpired,
    })
  }, [handleSessionExpired])

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
        setAccessToken(null)
        setApiClient(null)
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
      
      // Extract access token from response headers (dev) or try refresh
      const headerToken = response.headers.get('x-dev-access-token')
      if (headerToken) {
        setAccessToken(headerToken)
        setApiClient(createApiClient())
      } else {
        // Try to refresh access token using refresh token cookie
        const refreshedToken = await refreshAccessToken()
        if (refreshedToken) {
          setApiClient(createApiClient())
        }
      }
      
      setIsLoading(false)
    }

    loadSession().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return
      }

      setSession(null)
      setAccessToken(null)
      setApiClient(null)
      setIsLoading(false)
      setErrorMessage(getErrorMessage(error, 'Unable to load the current session.'))
    })

    return () => {
      controller.abort()
    }
  }, [createApiClient])

  const handleGoogleCredential = useCallback(async (idToken: string) => {
    setIsSigningIn(true)
    setSignInErrorMessage(null)

    try {
      const authenticatedSession = await exchangeGoogleTokenForSession(idToken)
      setSession(authenticatedSession)
      setApiClient(createApiClient())
    } catch (error) {
      setSignInErrorMessage(
        getErrorMessage(error, 'Unable to complete Google sign-in.'),
      )
    } finally {
      setIsSigningIn(false)
    }
  }, [createApiClient])

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

  // Redirect authenticated users at root to default workspace route
  useEffect(() => {
    if (session?.authenticated && window.location.pathname === '/') {
      navigate(defaultWorkspaceRoute, { replace: true })
    }
  }, [session?.authenticated, navigate])

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
      <ApiClientContext.Provider value={apiClient}>
        <WorkspaceShell
          userDisplayName={session.user.displayName}
        />
      </ApiClientContext.Provider>
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

interface WorkspaceShellProps {
  userDisplayName: string
}

function WorkspaceShell({ userDisplayName }: WorkspaceShellProps) {
  const navGroups = buildNavGroups(scaffoldRoutes)

  return (
    <section className="workspace-shell">
      <header className="status-panel authenticated-panel workspace-header">
        <p className="eyebrow">Authenticated workspace</p>
        <h2>Welcome back, {userDisplayName}.</h2>
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
                {group.routes.map((route) => (
                  <li key={route.id}>
                    <NavLink to={route.path} className="nav-link">
                      {route.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        <Routes>
          <Route path="/workspace/journal" element={<JournalPage />} />
          {scaffoldRoutes.map((route) => (
            <Route
              key={route.id}
              path={route.path}
              element={<PlaceholderPage route={route} />}
            />
          ))}
          <Route path="/" element={<Navigate to={defaultWorkspaceRoute} replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </div>
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
