import { createRemoteJWKSet, jwtVerify } from 'jose'
import { OAuthProviderType } from '@portfolio-engineering/database'

export interface OAuthIdentity {
  providerUserId: string
  email: string
  displayName: string
}

export class OAuthVerificationError extends Error {
  readonly statusCode: number

  constructor(message: string, statusCode = 401) {
    super(message)
    this.name = 'OAuthVerificationError'
    this.statusCode = statusCode
  }
}

const googleJwks = createRemoteJWKSet(
  new URL('https://www.googleapis.com/oauth2/v3/certs'),
)
const microsoftJwks = createRemoteJWKSet(
  new URL('https://login.microsoftonline.com/common/discovery/v2.0/keys'),
)

function requireEnv(name: string): string {
  const value = process.env[name]?.trim()

  if (!value) {
    throw new OAuthVerificationError(
      `Missing required OAuth configuration: ${name}`,
      500,
    )
  }

  return value
}

function requireIdentityField(
  value: unknown,
  fieldName: string,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new OAuthVerificationError(
      `Provider token is missing required field: ${fieldName}.`,
    )
  }

  return value.trim()
}

async function verifyGoogleToken(token: string): Promise<OAuthIdentity> {
  const audience = requireEnv('GOOGLE_CLIENT_ID')
  const verification = await jwtVerify(token, googleJwks, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience,
  })

  return {
    providerUserId: requireIdentityField(verification.payload.sub, 'sub'),
    email: requireIdentityField(verification.payload.email, 'email'),
    displayName:
      typeof verification.payload.name === 'string' &&
      verification.payload.name.trim().length > 0
        ? verification.payload.name.trim()
        : requireIdentityField(verification.payload.email, 'email'),
  }
}

async function verifyMicrosoftToken(token: string): Promise<OAuthIdentity> {
  const audience = requireEnv('MICROSOFT_CLIENT_ID')
  const verification = await jwtVerify(token, microsoftJwks, {
    audience,
  })

  const issuer = requireIdentityField(verification.payload.iss, 'iss')
  const tenantId = requireIdentityField(verification.payload.tid, 'tid')
  const expectedIssuer = `https://login.microsoftonline.com/${tenantId}/v2.0`

  if (issuer !== expectedIssuer) {
    throw new OAuthVerificationError('Microsoft token issuer did not match tenant.')
  }

  return {
    providerUserId: requireIdentityField(verification.payload.sub, 'sub'),
    email: requireIdentityField(
      verification.payload.preferred_username ?? verification.payload.email,
      'preferred_username',
    ),
    displayName:
      typeof verification.payload.name === 'string' &&
      verification.payload.name.trim().length > 0
        ? verification.payload.name.trim()
        : requireIdentityField(
            verification.payload.preferred_username ?? verification.payload.email,
            'preferred_username',
          ),
  }
}

interface FacebookDebugTokenResponse {
  data?: {
    is_valid?: boolean
    app_id?: string
    user_id?: string
  }
}

interface FacebookMeResponse {
  id?: string
  name?: string
  email?: string
}

async function verifyFacebookToken(token: string): Promise<OAuthIdentity> {
  const appId = requireEnv('FACEBOOK_APP_ID')
  const appSecret = requireEnv('FACEBOOK_APP_SECRET')
  const appAccessToken = `${appId}|${appSecret}`

  const debugResponse = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccessToken)}`,
  )
  if (!debugResponse.ok) {
    throw new OAuthVerificationError('Facebook token verification request failed.')
  }

  const debugPayload = (await debugResponse.json()) as FacebookDebugTokenResponse
  if (!debugPayload.data?.is_valid) {
    throw new OAuthVerificationError('Facebook token is invalid.')
  }
  if (debugPayload.data.app_id !== appId) {
    throw new OAuthVerificationError('Facebook token app_id does not match configuration.')
  }

  const meResponse = await fetch(
    `https://graph.facebook.com/me?fields=id,name,email&access_token=${encodeURIComponent(token)}`,
  )
  if (!meResponse.ok) {
    throw new OAuthVerificationError('Facebook user profile request failed.')
  }

  const mePayload = (await meResponse.json()) as FacebookMeResponse
  return {
    providerUserId: requireIdentityField(
      mePayload.id ?? debugPayload.data.user_id,
      'id',
    ),
    email: requireIdentityField(mePayload.email, 'email'),
    displayName:
      typeof mePayload.name === 'string' && mePayload.name.trim().length > 0
        ? mePayload.name.trim()
        : requireIdentityField(mePayload.email, 'email'),
  }
}

export async function verifyOAuthToken(
  provider: OAuthProviderType,
  token: string,
): Promise<OAuthIdentity> {
  try {
    if (provider === OAuthProviderType.google) {
      return await verifyGoogleToken(token)
    }
    if (provider === OAuthProviderType.microsoft) {
      return await verifyMicrosoftToken(token)
    }
    if (provider === OAuthProviderType.facebook) {
      return await verifyFacebookToken(token)
    }

    throw new OAuthVerificationError('Unsupported OAuth provider.')
  } catch (error) {
    if (error instanceof OAuthVerificationError) {
      throw error
    }

    throw new OAuthVerificationError('OAuth token verification failed.')
  }
}
