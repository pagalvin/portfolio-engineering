import { createHash, randomUUID } from 'node:crypto'
import {
  getAppMode,
  REFRESH_TOKEN_MAX_AGE_SECONDS,
} from '@portfolio-engineering/auth'
import {
  createAuthStore,
  getPrismaClient,
  mapUserRecordToSessionUser,
  OAuthProviderType,
  UserRole,
  type Organization,
  type User,
} from '@portfolio-engineering/database'
import type {
  AuthenticatedSessionResponse,
  JwtPayload,
  RefreshTokenPayload,
  SessionResponse,
  UnconfiguredSessionResponse,
} from '@portfolio-engineering/shared-types/auth'

export interface OAuthCallbackBootstrapInput {
  organizationSlug: string
  organizationName: string
  provider: OAuthProviderType
  providerUserId: string
  email: string
  displayName: string
}

export const LOCAL_ORGANIZATION = {
  slug: 'local-portfolio',
  name: 'Local Portfolio',
}

const authStore = createAuthStore(getPrismaClient())

export function getUnauthenticatedSessionResponse(
  message = 'You must sign in before your workspace data becomes available.',
): SessionResponse {
  return {
    authenticated: false,
    appMode: getAppMode() ?? undefined,
    message,
  }
}

export function getUnconfiguredSessionResponse(
  message = 'Server-side APP_MODE environment variable is not configured or server initialization failed.',
  instructions = [
    'Set server-side APP_MODE=local or APP_MODE=hosted in your root .env file or API server environment variables. Do not prefix this value with VITE_.',
    'Restart the application server.',
  ],
): UnconfiguredSessionResponse {
  return {
    authenticated: false,
    configured: false,
    appMode: null,
    message,
    instructions,
  }
}

export async function ensureLocalDefaultProfile(): Promise<{
  organization: Organization
  defaultProfile: User
}> {
  // Prefer the dedicated local-mode organization so local household profiles are never
  // accidentally resolved from OAuth-backed hosted users in the legacy development org.
  const organization = await authStore.ensureOrganization(LOCAL_ORGANIZATION)
  const userCount = await authStore.countUsersInOrganization({
    organizationId: organization.id,
  })

  if (userCount > 0) {
    const profiles = await authStore.listProfilesInOrganization({
      organizationId: organization.id,
    })
    const defaultProfile = profiles[0]
    if (!defaultProfile) {
      throw new Error('Failed to resolve local default profile in local-portfolio organization.')
    }
    return {
      organization,
      defaultProfile,
    }
  }

  await authStore.createLocalProfile({
    organizationId: organization.id,
    displayName: 'Primary User',
    email: 'primary-user@local.invalid',
    role: UserRole.admin,
  })

  const profiles = await authStore.listProfilesInOrganization({
    organizationId: organization.id,
  })

  const defaultProfile = profiles[0]
  if (!defaultProfile) {
    throw new Error('Failed to resolve or create local default profile.')
  }

  return {
    organization,
    defaultProfile,
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
      appMode: getAppMode() ?? 'hosted',
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
