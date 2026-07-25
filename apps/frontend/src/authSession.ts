import type {
  AuthenticatedSessionResponse,
  ErrorMessageResponse,
  SessionResponse,
} from '@portfolio-engineering/shared-types/auth'

const DEFAULT_ORGANIZATION_SLUG = 'portfolio-engineering-dev'
const DEFAULT_ORGANIZATION_NAME = 'Portfolio Engineering Development'

function readTrimmedEnvValue(name: string): string | null {
  const value = import.meta.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

export function getSessionEndpoint(): string {
  if (!import.meta.env.DEV) {
    return '/auth/session'
  }

  const url = new URL(window.location.href)
  const demoAuth = url.searchParams.get('demoAuth')

  if (demoAuth === 'authenticated' || demoAuth === 'unauthenticated') {
    return `/auth/session?demoAuth=${demoAuth}`
  }

  return '/auth/session'
}

export function getGoogleClientId(): string | null {
  return readTrimmedEnvValue('VITE_GOOGLE_CLIENT_ID')
}

function getOAuthOrganizationSlug(): string {
  return (
    readTrimmedEnvValue('VITE_OAUTH_ORGANIZATION_SLUG') ??
    DEFAULT_ORGANIZATION_SLUG
  )
}

function getOAuthOrganizationName(): string {
  return (
    readTrimmedEnvValue('VITE_OAUTH_ORGANIZATION_NAME') ??
    DEFAULT_ORGANIZATION_NAME
  )
}

async function getErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? ''

  if (contentType.includes('application/json')) {
    const payload = (await response.json()) as Partial<ErrorMessageResponse>
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message
    }
  }

  return `Google sign-in failed (${response.status} ${response.statusText}).`
}

export async function exchangeGoogleTokenForSession(
  token: string,
): Promise<AuthenticatedSessionResponse> {
  const response = await fetch('/auth/google/callback', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organizationSlug: getOAuthOrganizationSlug(),
      organizationName: getOAuthOrganizationName(),
      token,
    }),
  })

  if (!response.ok) {
    throw new Error(await getErrorMessage(response))
  }

  return (await response.json()) as AuthenticatedSessionResponse
}

export type { SessionResponse }
