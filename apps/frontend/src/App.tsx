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
      <div className="status-panel authenticated-panel">
        <p className="eyebrow">Authenticated</p>
        <h2>Welcome back, {session.user.displayName}.</h2>
        <p>Your first auth-aware page is wired to the session endpoint and now receives its development session from the JWT-backed API slice.</p>
        <dl className="user-details">
          <div>
            <dt>User ID</dt>
            <dd>{session.user.id}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.user.email}</dd>
          </div>
        </dl>
      </div>
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
        <h1>Initial auth-aware app bootstrap</h1>
        <p className="hero-copy">
          This frontend now targets a single session endpoint contract backed by the Fastify API, so the auth boundary stays stable as the implementation gets more real.
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

export default App
