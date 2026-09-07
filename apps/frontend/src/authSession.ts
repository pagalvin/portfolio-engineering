import type {
  AuthenticatedSessionResponse,
  ErrorMessageResponse,
  SessionResponse,
  AccessTokenResponse,
  ProfileBackupPayload,
  DeleteProfileResponse,
} from '@portfolio-engineering/shared-types/auth'

const DEFAULT_ORGANIZATION_SLUG = 'portfolio-engineering-dev'
const DEFAULT_ORGANIZATION_NAME = 'Portfolio Engineering Development'

/**
 * Session storage key for access token
 * Stored in memory (not localStorage) for security: cleared on page unload
 */
let accessTokenInMemory: string | null = null
let refreshPromise: Promise<string | null> | null = null

function readTrimmedEnvValue(name: string): string | null {
  const value = import.meta.env[name]?.trim()
  return value && value.length > 0 ? value : null
}

export function getSessionEndpoint(): string {
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

/**
 * Store access token in memory (cleared on page unload)
 */
export function setAccessToken(token: string | null): void {
  accessTokenInMemory = token
}

/**
 * Retrieve the current access token
 * Returns null if no token is stored or session has expired
 */
export function getAccessToken(): string | null {
  return accessTokenInMemory
}

/**
 * Extract access token from response headers or body
 * Checks both x-dev-access-token header (dev) and body.accessToken field
 */
function extractAccessTokenFromResponse(
  response: Response,
  body: unknown,
): string | null {
  // Check for dev header first
  const headerToken = response.headers.get('x-dev-access-token')
  if (headerToken) {
    return headerToken
  }

  // Check for accessToken in response body
  if (body && typeof body === 'object' && 'accessToken' in body) {
    const token = (body as { accessToken?: unknown }).accessToken
    if (typeof token === 'string') {
      return token
    }
  }

  return null
}

/**
 * Refresh the access token by calling POST /auth/refresh
 * Requires refresh token cookie to be present (httpOnly)
 * Updates in-memory access token if successful
 * Shares single in-flight refresh promise across concurrent callers
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    try {
      const response = await fetch('/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        // 401 means refresh token expired; session is gone
        setAccessToken(null)
        return null
      }

      const body = (await response.json()) as Partial<AccessTokenResponse>
      const token = extractAccessTokenFromResponse(response, body)

      if (token) {
        setAccessToken(token)
        return token
      }

      setAccessToken(null)
      return null
    } catch {
      // Network error or parse error; clear token
      setAccessToken(null)
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
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

  const body = (await response.json()) as AuthenticatedSessionResponse

  // Extract and store access token from response
  const accessToken = extractAccessTokenFromResponse(response, body)
  if (accessToken) {
    setAccessToken(accessToken)
  }

  return body
}

export async function logoutSession(): Promise<void> {
  await fetch('/auth/logout', {
    method: 'POST',
    credentials: 'include',
  })
  setAccessToken(null)
}

export function downloadProfileBackupJson(
  payload: ProfileBackupPayload,
  customFilename?: string,
): void {
  const jsonStr = JSON.stringify(payload, null, 2)
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const slug =
    payload.data.profile.displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'profile'
  const dateStr = new Date().toISOString().slice(0, 10)
  const filename = customFilename || `profile-${slug}-backup-${dateStr}.json`

  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.position = 'fixed'
  link.style.opacity = '0'
  document.body.appendChild(link)
  link.click()

  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export async function fetchLocalProfileBackup(
  profileId: string,
): Promise<ProfileBackupPayload> {
  const response = await fetch(`/auth/profiles/${profileId}/export`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to export profile backup (${response.status})`)
  }

  return (await response.json()) as ProfileBackupPayload
}

export async function deleteLocalProfile(
  profileId: string,
): Promise<DeleteProfileResponse> {
  const response = await fetch(`/auth/profiles/${profileId}`, {
    method: 'DELETE',
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(errorData.message || `Failed to delete profile (${response.status})`)
  }

  return (await response.json()) as DeleteProfileResponse
}

export type { SessionResponse }
