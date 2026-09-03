export const DEV_JWT_SECRET = 'portfolio-engineering-dev-secret'
export const DEV_ACCESS_TOKEN_HEADER = 'x-dev-access-token'
export const ACCESS_TOKEN_EXPIRES_IN = '1d'
export const REFRESH_TOKEN_EXPIRES_IN = '7d'
export const REFRESH_TOKEN_COOKIE_NAME = 'portfolio_engineering_refresh_token'
export const REFRESH_TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export function getJwtSecret(environment: NodeJS.ProcessEnv = process.env): string {
  const configuredSecret = environment.JWT_SECRET?.trim()

  if (configuredSecret) {
    return configuredSecret
  }

  return DEV_JWT_SECRET
}

export function getRefreshTokenCookieOptions(
  environment: NodeJS.ProcessEnv = process.env,
): {
  httpOnly: boolean
  maxAge: number
  path: string
  sameSite: 'lax'
  secure: boolean
} {
  return {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax',
    secure: environment.NODE_ENV === 'production',
  }
}
