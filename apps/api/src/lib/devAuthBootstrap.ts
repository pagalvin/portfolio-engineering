import { createHash, randomUUID } from 'node:crypto'
import {
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
  mapUserRecordToSessionUser,
  OAuthProviderType,
  UserRole,
} from '@portfolio-engineering/database'
import type {
  AuthenticatedSessionResponse,
  JwtPayload,
  RefreshTokenPayload,
  SessionResponse,
} from '@portfolio-engineering/shared-types/auth'

export type DemoAuthMode = 'authenticated' | 'unauthenticated'

export interface OAuthCallbackBootstrapInput {
  organizationSlug: string
  organizationName: string
  provider: OAuthProviderType
  providerUserId: string
  email: string
  displayName: string
}

const devOrganization = {
  slug: 'portfolio-engineering-dev',
  name: 'Portfolio Engineering Development',
}

const devUser = {
  email: 'taylor.trader@example.com',
  displayName: 'Taylor Trader',
  provider: OAuthProviderType.google,
  providerUserId: 'google-dev-user-001',
  role: UserRole.admin,
}

const authStore = createAuthStore(getPrismaClient())

export function getDemoAuthMode(value: unknown): DemoAuthMode | null {
  if (value === undefined) {
    return 'unauthenticated'
  }

  if (value === 'authenticated' || value === 'unauthenticated') {
    return value
  }

  return null
}

export function getUnauthenticatedSessionResponse(): SessionResponse {
  return {
    authenticated: false,
    message: 'You must sign in before your workspace data becomes available.',
  }
}

export async function ensureDevelopmentAuthContext(): Promise<{
  jwtPayload: JwtPayload
  session: AuthenticatedSessionResponse
}> {
  const organization = await authStore.ensureOrganization(devOrganization)
  const user = await authStore.upsertUser({
    organizationId: organization.id,
    email: devUser.email,
    displayName: devUser.displayName,
    role: devUser.role,
  })

  await authStore.upsertOAuthProvider({
    organizationId: organization.id,
    userId: user.id,
    provider: devUser.provider,
    providerUserId: devUser.providerUserId,
  })
  await authStore.touchUserLogin({
    organizationId: organization.id,
    userId: user.id,
  })

  const persistedUser = await authStore.findUserById({
    organizationId: organization.id,
    userId: user.id,
  })

  if (!persistedUser) {
    throw new Error('The development auth bootstrap user could not be loaded after persistence.')
  }

  return {
    jwtPayload: createJwtPayload(persistedUser),
    session: {
      authenticated: true,
      user: mapUserRecordToSessionUser(persistedUser),
    },
  }
}

export async function ensureOAuthCallbackAuthContext(
  input: OAuthCallbackBootstrapInput,
): Promise<{
  jwtPayload: JwtPayload
  session: AuthenticatedSessionResponse
}> {
  const organization = await authStore.ensureOrganization({
    slug: input.organizationSlug,
    name: input.organizationName,
  })

  const existingOAuthUser = await authStore.findUserByOAuthIdentity({
    organizationId: organization.id,
    provider: input.provider,
    providerUserId: input.providerUserId,
  })

  let userId = existingOAuthUser?.id

  if (existingOAuthUser) {
    const updatedUser = await authStore.updateUserProfile({
      organizationId: organization.id,
      userId: existingOAuthUser.id,
      email: input.email,
      displayName: input.displayName,
      role: existingOAuthUser.role,
    })
    userId = updatedUser.id
  } else {
    const existingEmailUser = await authStore.findUserByEmail({
      organizationId: organization.id,
      email: input.email,
    })
    const roleForUser =
      existingEmailUser?.role ??
      ((await authStore.countUsersInOrganization({
        organizationId: organization.id,
      })) === 0
        ? UserRole.admin
        : UserRole.member)

    const upsertedUser = await authStore.upsertUser({
      organizationId: organization.id,
      email: input.email,
      displayName: input.displayName,
      role: roleForUser,
    })
    userId = upsertedUser.id
  }

  if (!userId) {
    throw new Error('OAuth callback auth bootstrap failed to resolve a persisted user.')
  }

  await authStore.upsertOAuthProvider({
    organizationId: organization.id,
    userId,
    provider: input.provider,
    providerUserId: input.providerUserId,
  })

  await authStore.touchUserLogin({
    organizationId: organization.id,
    userId,
  })

  const persistedUser = await authStore.findUserById({
    organizationId: organization.id,
    userId,
  })

  if (!persistedUser) {
    throw new Error('The OAuth callback user could not be loaded after persistence.')
  }

  return {
    jwtPayload: createJwtPayload(persistedUser),
    session: {
      authenticated: true,
      user: mapUserRecordToSessionUser(persistedUser),
    },
  }
}

export function createJwtPayload(input: {
  id: string
  email: string
  organizationId: string
  role: 'admin' | 'member'
}): JwtPayload {
  return {
    sub: input.id,
    email: input.email,
    organizationId: input.organizationId,
    role: input.role,
  }
}

export function createRefreshTokenPayload(
  jwtPayload: JwtPayload,
): RefreshTokenPayload {
  return {
    ...jwtPayload,
    jti: randomUUID(),
    tokenType: 'refresh',
  }
}

export function getRefreshTokenExpiresAt(now: Date = new Date()): Date {
  return new Date(now.getTime() + REFRESH_TOKEN_MAX_AGE_SECONDS * 1000)
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
