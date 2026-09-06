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
  logoutSession,
} from './authSession'
import type {
  AuthenticatedSessionResponse,
  UnconfiguredSessionResponse,
  AppMode,
} from '@portfolio-engineering/shared-types/auth'
import {
  initializeGoogleSignIn,
  loadGoogleIdentityScript,
  renderGoogleSignInButton,
} from './googleIdentity'
import {
  defaultWorkspaceRoute,
  scaffoldRoutes,
  type ScaffoldRoute,
  settingsThemeRoute,
} from './scaffoldRoutes'
import { createAuthenticatedApiClient, type AuthenticatedApiClient } from './apiClient'
import { PlaceholderPage } from './PlaceholderPage'
import { NotFoundPage } from './NotFoundPage'
import { JournalPage } from './JournalPage'
import {
  AiConnectionWorkflowPage,
  YourAiConnectionsPage,
  YourAiOverviewPage,
  YourAiPage,
  YourAiProvidersPage,
} from './YourAiPage'
import { SettingsShell } from './SettingsShell'
import { InvestorProfilePage } from './InvestorProfilePage'
import { ConfigurationErrorPanel } from './components/ConfigurationErrorPanel'
import { ProfilePicker } from './components/ProfilePicker'
import { ProfileSwitcher } from './components/ProfileSwitcher'
import { EmptyProfileAlert } from './components/EmptyProfileAlert'

export const ApiClientContext = createContext<AuthenticatedApiClient | null>(null)

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message
  }

  return fallbackMessage
}

const SESSION_LOAD_RETRY_DELAYS_MS = [
  250,
  500,
  1000,
  1500,
  2000,
  2500,
  3000,
  4000,
  5000,
] as const

function isRetriableSessionStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504
}

function waitForSessionRetryDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Session load was aborted.'))
      return
    }

    const timeoutId = window.setTimeout(resolve, delayMs)
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(timeoutId)
        reject(new Error('Session load was aborted.'))
      },
      { once: true },
    )
  })
}

async function fetchSessionWithStartupRetry(
  signal?: AbortSignal,
): Promise<Response> {
  let lastError: unknown = null

  for (let attempt = 0; attempt <= SESSION_LOAD_RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetch(getSessionEndpoint(), {
        credentials: 'include',
        signal,
      })

      if (response.ok) {
        const sessionBody = (await response.clone().json().catch(() => null)) as
          | { configured?: unknown }
          | null

        if (
          sessionBody &&
          typeof sessionBody === 'object' &&
          sessionBody.configured === false
        ) {
          lastError = new Error('The API is still starting up without a configured APP_MODE.')
        } else {
          return response
        }
      } else if (!isRetriableSessionStatus(response.status)) {
        return response
      } else {
        lastError = new Error(
          `Unable to load the current session (${response.status} ${response.statusText})`,
        )
      }
    } catch (error) {
      if (signal?.aborted) {
        throw error
      }

      lastError = error
    }

    const retryDelay = SESSION_LOAD_RETRY_DELAYS_MS[attempt]
    if (retryDelay !== undefined) {
      await waitForSessionRetryDelay(retryDelay, signal)
    }
  }

  if (lastError instanceof Error) {
    throw lastError
  }

  throw new Error('Unable to load the current session.')
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
    setSession((previousSession) => {
      if (previousSession?.authenticated) {
        return {
          authenticated: false,
          configured: true,
          appMode: previousSession.appMode,
          message: 'Your session expired. Select a profile or sign in again to continue.',
        }
      }

      return previousSession
    })
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

  const loadSession = useCallback(
    async (signal?: AbortSignal) => {
      setIsLoading(true)
      setErrorMessage(null)

      try {
        const response = await fetchSessionWithStartupRetry(signal)

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

        const sessionData = (await response.json()) as SessionResponse
        setSession(sessionData)

        if (sessionData.authenticated) {
          // Extract access token from response headers (dev) or try refresh
          const headerToken = response.headers.get('x-dev-access-token')
          if (headerToken) {
            setAccessToken(headerToken)
          } else {
            // Try to refresh access token using refresh token cookie
            await refreshAccessToken()
          }
          setApiClient(createApiClient())
        } else {
          setAccessToken(null)
          setApiClient(null)
        }
      } catch (error: unknown) {
        if (signal?.aborted) {
          return
        }

        setSession(null)
        setAccessToken(null)
        setApiClient(null)
        setErrorMessage(
          getErrorMessage(error, 'Unable to load the current session.'),
        )
      } finally {
        setIsLoading(false)
      }
    },
    [createApiClient],
  )

  useEffect(() => {
    const controller = new AbortController()
    loadSession(controller.signal)

    return () => {
      controller.abort()
    }
  }, [loadSession])

  const handleSelectLocalProfile = useCallback(
    async (profileId: string) => {
      setIsLoading(true)
      setErrorMessage(null)
      try {
        const response = await fetch('/auth/profiles/select', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profileId }),
        })

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData.message || 'Failed to select profile')
        }

        const authSession = (await response.json()) as AuthenticatedSessionResponse
        setSession(authSession)

        const headerToken = response.headers.get('x-dev-access-token')
        if (headerToken) {
          setAccessToken(headerToken)
        } else {
          await refreshAccessToken()
        }
        setApiClient(createApiClient())
      } catch (err) {
        setErrorMessage(getErrorMessage(err, 'Failed to select household profile.'))
      } finally {
        setIsLoading(false)
      }
    },
    [createApiClient],
  )

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

  const handleSignOut = useCallback(async () => {
    await logoutSession()
    setSession((previousSession) => {
      const appMode = previousSession?.authenticated
        ? previousSession.appMode
        : previousSession?.appMode

      return appMode
        ? {
            authenticated: false,
            configured: true,
            appMode,
            message: 'Select a profile or sign in again to continue.',
          }
        : {
        authenticated: false,
        configured: true,
        message: 'Select a profile or sign in again to continue.',
          }
    })
    setApiClient(null)
  }, [])

  useEffect(() => {
    if (isLoading || session?.authenticated !== false) {
      return
    }

    if (session.appMode !== 'hosted') {
      setIsGoogleReady(false)
      setSignInErrorMessage(null)
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
  }, [
    googleClientId,
    handleGoogleCredential,
    isLoading,
    session?.authenticated,
    session?.authenticated === false ? session.appMode : undefined,
  ])

  // Redirect authenticated users at root to default workspace route
  useEffect(() => {
    if (session?.authenticated && window.location.pathname === '/') {
      navigate(defaultWorkspaceRoute, { replace: true })
    }
  }, [session?.authenticated, navigate])

  let content = null

  if (isLoading) {
    content = (
      <div className="status-panel" aria-live="polite">
        <p className="eyebrow">Session status</p>
        <h2>Checking your session...</h2>
        <p>Loading the current auth/session contract before the app renders user-specific content.</p>
      </div>
    )
  } else if (session?.configured === false) {
    const unconfigured = session as UnconfiguredSessionResponse
    content = (
      <ConfigurationErrorPanel
        message={unconfigured.message}
        instructions={unconfigured.instructions}
      />
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
          userEmail={session.user.email}
          appMode={session.appMode}
          onProfileSwitched={() => void loadSession()}
          onSignOut={() => void handleSignOut()}
        />
      </ApiClientContext.Provider>
    )
  } else if (session?.appMode === 'local') {
    content = (
      <ProfilePicker onSelectProfile={handleSelectLocalProfile} />
    )
  } else if (session?.appMode === 'hosted') {
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
  } else {
    content = (
      <ConfigurationErrorPanel
        message="The frontend could not determine whether the API is running in local or hosted mode."
        instructions={[
          'Confirm the API server is running and reachable at http://127.0.0.1:3001.',
          'Confirm the root .env file sets server-side APP_MODE=local or APP_MODE=hosted.',
          'Refresh the browser after the API has finished starting.',
        ]}
      />
    )
  }

  return (
    <main className="app-shell">
      {content}
    </main>
  )
}

interface WorkspaceShellProps {
  userDisplayName: string
  userEmail?: string
  appMode?: AppMode
  onProfileSwitched: () => void
  onSignOut: () => void
}

function WorkspaceShell({
  userDisplayName,
  userEmail,
  appMode,
  onProfileSwitched,
  onSignOut,
}: WorkspaceShellProps) {
  const navGroups = buildNavGroups(scaffoldRoutes)

  return (
    <section className="workspace-shell">
      <header className="status-panel authenticated-panel workspace-header flex items-center justify-between">
        <div>
          <p className="eyebrow">
            Authenticated workspace ({appMode ?? 'local'} mode)
          </p>
          <h2>Welcome back, {userDisplayName}.</h2>
          <p>
            Major features are scaffolded as direct routes so refresh and browser history preserve your place.
          </p>
        </div>
        <div className="ml-4 flex-shrink-0">
          <ProfileSwitcher
            currentDisplayName={userDisplayName}
            currentEmail={userEmail}
            appMode={appMode}
            onProfileSwitched={onProfileSwitched}
            onSignOut={onSignOut}
          />
        </div>
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

        <div className="workspace-main flex-1">
          <EmptyProfileAlert />
          <Routes>
          <Route path="/workspace/journal" element={<JournalPage />} />
          <Route path="/workspace/settings" element={<SettingsShell />}>
            <Route index element={<Navigate to="your-ai" replace />} />
            <Route
              path="your-ai"
              element={
                <YourAiPage />
              }
            >
              <Route index element={<Navigate to="overview" replace />} />
              <Route path="overview" element={<YourAiOverviewPage />} />
              <Route path="connections" element={<YourAiConnectionsPage />} />
              <Route path="providers" element={<YourAiProvidersPage />} />
              <Route path="connections/new" element={<AiConnectionWorkflowPage mode="create" />} />
              <Route path="connections/:id/edit" element={<AiConnectionWorkflowPage mode="edit" />} />
            </Route>
            <Route
              path="profile"
              element={<InvestorProfilePage />}
            />
            <Route
              path="preferences"
              element={<PlaceholderPage route={settingsThemeRoute} />}
            />
          </Route>
          {scaffoldRoutes.map((route) => (
            route.id === 'settings' ? null : (
              <Route
                key={route.id}
                path={route.path}
                element={<PlaceholderPage route={route} />}
              />
            )
          ))}
          <Route path="/" element={<Navigate to={defaultWorkspaceRoute} replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        </div>
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
