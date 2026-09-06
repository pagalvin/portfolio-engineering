export type AppMode = 'local' | 'hosted'

export const DEV_JWT_SECRET = 'portfolio-engineering-dev-secret'
export const DEV_ACCESS_TOKEN_HEADER = 'x-dev-access-token'
export const REFRESH_TOKEN_COOKIE_NAME = 'portfolio_engineering_refresh_token'
export const PROFILE_COOKIE_NAME = 'portfolio_engineering_profile_id'

export const ACCESS_TOKEN_EXPIRES_IN = '15m'
export const REFRESH_TOKEN_EXPIRES_IN = '7d'
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const DEFAULT_LOCAL_SESSION_TTL_DAYS = 365
export const DEFAULT_HOSTED_SESSION_TTL_DAYS = 7
export const DEFAULT_ACCESS_TOKEN_TTL_MINUTES = 15

export interface AuthConfiguration {
  appMode: AppMode | null
  sessionTtlDays: number
  accessTokenTtlMinutes: number
  refreshTokenMaxAgeSeconds: number
  accessTokenExpiresIn: string
  refreshTokenExpiresIn: string
  jwtSecret: string
}

export function getJwtSecret(
  environment: NodeJS.ProcessEnv = process.env,
): string {
  const configuredSecret = environment.JWT_SECRET?.trim()

  if (configuredSecret) {
    return configuredSecret
  }

  return DEV_JWT_SECRET
}

export function getAppMode(
  environment: NodeJS.ProcessEnv = process.env,
): AppMode | null {
  const mode = environment.APP_MODE?.trim().toLowerCase()

  if (mode === 'local' || mode === 'hosted') {
    return mode
  }

  return null
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (!value) {
    return null
  }

  const parsed = Number.parseInt(value.trim(), 10)
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed
  }

  return null
}

export function getAuthConfiguration(
  environment: NodeJS.ProcessEnv = process.env,
): AuthConfiguration {
  const appMode = getAppMode(environment)

  const defaultSessionTtl =
    appMode === 'local'
      ? DEFAULT_LOCAL_SESSION_TTL_DAYS
      : DEFAULT_HOSTED_SESSION_TTL_DAYS

  const sessionTtlDays =
    parsePositiveInteger(environment.SESSION_TTL_DAYS) ?? defaultSessionTtl

  const accessTokenTtlMinutes =
    parsePositiveInteger(environment.ACCESS_TOKEN_TTL_MINUTES) ??
    DEFAULT_ACCESS_TOKEN_TTL_MINUTES

  const refreshTokenMaxAgeSeconds = sessionTtlDays * 24 * 60 * 60

  return {
    appMode,
    sessionTtlDays,
    accessTokenTtlMinutes,
    refreshTokenMaxAgeSeconds,
    accessTokenExpiresIn: `${accessTokenTtlMinutes}m`,
    refreshTokenExpiresIn: `${sessionTtlDays}d`,
    jwtSecret: getJwtSecret(environment),
  }
}

export function getRefreshTokenCookieOptions(
  environment: NodeJS.ProcessEnv = process.env,
  customMaxAgeSeconds?: number,
): {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: 'lax'
  secure: boolean
} {
  const maxAge =
    typeof customMaxAgeSeconds === 'number' && customMaxAgeSeconds > 0
      ? customMaxAgeSeconds
      : getAuthConfiguration(environment).refreshTokenMaxAgeSeconds

  return {
    httpOnly: true,
    maxAge,
    path: '/',
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
  }
}

