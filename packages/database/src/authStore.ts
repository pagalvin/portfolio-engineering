import type { SessionUser } from '@portfolio-engineering/shared-types/auth'
import type {
  Organization,
  OAuthProviderType,
  OAuthProvider,
  Prisma,
  PrismaClient,
  RefreshToken,
  User,
  UserRole,
} from './generated/prisma/client.js'

export type AuthUserRecord = Prisma.UserGetPayload<{
  include: {
    organization: true
    oauthProviders: true
  }
}>

export interface AuthStore {
  ensureOrganization(input: {
    slug: string
    name: string
  }): Promise<Organization>
  upsertUser(input: {
    organizationId: string
    email: string
    displayName: string
    role: UserRole
  }): Promise<User>
  upsertOAuthProvider(input: {
    organizationId: string
    userId: string
    provider: OAuthProviderType
    providerUserId: string
  }): Promise<OAuthProvider>
  touchUserLogin(input: {
    organizationId: string
    userId: string
    occurredAt?: Date
  }): Promise<User>
  findUserById(input: {
    organizationId: string
    userId: string
  }): Promise<AuthUserRecord | null>
  findUserByOAuthIdentity(
    input: {
      organizationId: string
      provider: OAuthProviderType
      providerUserId: string
    },
  ): Promise<AuthUserRecord | null>
  findUserByEmail(input: {
    organizationId: string
    email: string
  }): Promise<User | null>
  countUsersInOrganization(input: {
    organizationId: string
  }): Promise<number>
  updateUserProfile(input: {
    organizationId: string
    userId: string
    email: string
    displayName: string
    role: UserRole
  }): Promise<User>
  findActiveRefreshTokenByHash(input: {
    organizationId: string
    userId: string
    tokenHash: string
    now: Date
  }): Promise<RefreshToken | null>
  saveRefreshToken(input: {
    organizationId: string
    userId: string
    tokenHash: string
    expiresAt: Date
  }): Promise<RefreshToken>
  revokeRefreshToken(input: {
    organizationId: string
    tokenHash: string
  }): Promise<RefreshToken | null>
}

export function createAuthStore(prisma: PrismaClient): AuthStore {
  return {
    async ensureOrganization(input) {
      return prisma.organization.upsert({
        where: {
          slug: input.slug,
        },
        update: {
          name: input.name,
        },
        create: {
          slug: input.slug,
          name: input.name,
        },
      })
    },
    async upsertUser(input) {
      return prisma.user.upsert({
        where: {
          organizationId_email: {
            organizationId: input.organizationId,
            email: input.email,
          },
        },
        update: {
          displayName: input.displayName,
          role: input.role,
        },
        create: {
          organizationId: input.organizationId,
          email: input.email,
          displayName: input.displayName,
          role: input.role,
        },
      })
    },
    async upsertOAuthProvider(input) {
      const existingByUserAndProvider = await prisma.oAuthProvider.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          provider: input.provider,
        },
      })

      if (existingByUserAndProvider) {
        return prisma.oAuthProvider.update({
          where: {
            id: existingByUserAndProvider.id,
          },
          data: {
            providerUserId: input.providerUserId,
          },
        })
      }

      return prisma.oAuthProvider.upsert({
        where: {
          organizationId_provider_providerUserId: {
            organizationId: input.organizationId,
            provider: input.provider,
            providerUserId: input.providerUserId,
          },
        },
        update: {
          userId: input.userId,
        },
        create: {
          organizationId: input.organizationId,
          userId: input.userId,
          provider: input.provider,
          providerUserId: input.providerUserId,
        },
      })
    },
    async touchUserLogin(input) {
      const currentUser = await prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
      })

      if (!currentUser) {
        throw new Error('The requested user was not found in the expected organization.')
      }

      return prisma.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          lastLoginAt: input.occurredAt ?? new Date(),
        },
      })
    },
    async findUserById(input) {
      return prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
        include: {
          organization: true,
          oauthProviders: true,
        },
      })
    },
    async findUserByOAuthIdentity(input) {
      return prisma.user.findFirst({
        where: {
          organizationId: input.organizationId,
          oauthProviders: {
            some: {
              organizationId: input.organizationId,
              provider: input.provider,
              providerUserId: input.providerUserId,
            },
          },
        },
        include: {
          organization: true,
          oauthProviders: true,
        },
      })
    },
    async findUserByEmail(input) {
      return prisma.user.findFirst({
        where: {
          organizationId: input.organizationId,
          email: input.email,
        },
      })
    },
    async countUsersInOrganization(input) {
      return prisma.user.count({
        where: {
          organizationId: input.organizationId,
        },
      })
    },
    async updateUserProfile(input) {
      const currentUser = await prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
      })

      if (!currentUser) {
        throw new Error('The requested user profile could not be found in the expected organization.')
      }

      return prisma.user.update({
        where: {
          id: currentUser.id,
        },
        data: {
          email: input.email,
          displayName: input.displayName,
          role: input.role,
        },
      })
    },
    async findActiveRefreshTokenByHash(input) {
      return prisma.refreshToken.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          revokedAt: null,
          expiresAt: {
            gt: input.now,
          },
        },
      })
    },
    async saveRefreshToken(input) {
      return prisma.refreshToken.create({
        data: {
          organizationId: input.organizationId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
        },
      })
    },
    async revokeRefreshToken(input) {
      const refreshToken = await prisma.refreshToken.findFirst({
        where: {
          organizationId: input.organizationId,
          tokenHash: input.tokenHash,
          revokedAt: null,
        },
      })

      if (!refreshToken) {
        return null
      }

      return prisma.refreshToken.update({
        where: { id: refreshToken.id },
        data: {
          revokedAt: new Date(),
        },
      })
    },
  }
}

export function mapUserRecordToSessionUser(user: Pick<User, 'id' | 'displayName' | 'email'>): SessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  }
}
