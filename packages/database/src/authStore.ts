import type { HouseholdProfile, ProfileBackupPayload, SessionUser } from '@portfolio-engineering/shared-types/auth'
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

export type ProfileUserRecord = Prisma.UserGetPayload<{
  include: {
    _count: {
      select: {
        journalEntries: true
        investorProfiles: true
      }
    }
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
  listProfilesInOrganization(input: {
    organizationId: string
  }): Promise<ProfileUserRecord[]>
  createLocalProfile(input: {
    organizationId: string
    displayName: string
    email?: string
    role?: UserRole
  }): Promise<User>
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
    graceWindowMs?: number
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
  getProfileBackup(input: {
    organizationId: string
    userId: string
    appVersion?: string
    appMode?: 'local' | 'hosted'
  }): Promise<ProfileBackupPayload | null>
  deleteProfile(input: {
    organizationId: string
    userId: string
  }): Promise<{ deleted: boolean; deletedUserId: string | null }>
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
    async listProfilesInOrganization(input) {
      return prisma.user.findMany({
        where: {
          organizationId: input.organizationId,
        },
        include: {
          _count: {
            select: {
              journalEntries: true,
              investorProfiles: true,
            },
          },
        },
        orderBy: [
          { lastLoginAt: 'desc' },
          { createdAt: 'asc' },
        ],
      })
    },
    async createLocalProfile(input) {
      let email = input.email?.trim()
      if (!email) {
        const baseEmail = generateSyntheticEmail(input.displayName)
        let candidateEmail = baseEmail
        let attempt = 1
        while (
          await prisma.user.findFirst({
            where: {
              organizationId: input.organizationId,
              email: candidateEmail,
            },
          })
        ) {
          const slug = baseEmail.replace(/@local\.invalid$/, '')
          candidateEmail = `${slug}-${attempt}@local.invalid`
          attempt++
        }
        email = candidateEmail
      }

      return prisma.user.create({
        data: {
          organizationId: input.organizationId,
          displayName: input.displayName.trim(),
          email,
          role: input.role ?? ('member' as UserRole),
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
      const revokedCondition =
        input.graceWindowMs && input.graceWindowMs > 0
          ? {
              OR: [
                { revokedAt: null },
                { revokedAt: { gte: new Date(input.now.getTime() - input.graceWindowMs) } },
              ],
            }
          : { revokedAt: null }

      return prisma.refreshToken.findFirst({
        where: {
          organizationId: input.organizationId,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: {
            gt: input.now,
          },
          ...revokedCondition,
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
    async getProfileBackup(input) {
      const user = await prisma.user.findFirst({
        where: {
          id: input.userId,
          organizationId: input.organizationId,
        },
        include: {
          investorProfiles: {
            where: {
              organizationId: input.organizationId,
            },
          },
          journalEntries: {
            where: {
              organizationId: input.organizationId,
            },
            orderBy: {
              localDate: 'asc',
            },
          },
        },
      })

      if (!user) {
        return null
      }

      const investorProfileRecord = user.investorProfiles[0] ?? null
      const investorProfileData = investorProfileRecord
        ? {
            preferredName: investorProfileRecord.preferredName,
            experienceLevel: investorProfileRecord.experienceLevel,
            portfolioContext: investorProfileRecord.portfolioContext,
            primaryObjective: investorProfileRecord.primaryObjective,
            strategyPresets: investorProfileRecord.strategyPresets,
            customStrategyDescription: investorProfileRecord.customStrategyDescription,
            freeformAiContext: investorProfileRecord.freeformAiContext,
          }
        : null

      const entries = user.journalEntries.map((entry) => {
        const localDateStr =
          entry.localDate instanceof Date
            ? entry.localDate.toISOString().slice(0, 10)
            : String(entry.localDate).slice(0, 10)

        return {
          localDate: localDateStr,
          content: entry.content,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        }
      })

      const backup: ProfileBackupPayload = {
        $schema: 'https://portfolio-engineering.org/schemas/v1/profile-backup.json',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        appVersion: input.appVersion ?? '0.1.0',
        appMode: input.appMode ?? 'local',
        _meta: {
          description: 'Portfolio Engineering (P/OS) Profile and User Data Backup',
          sections: {
            profile: 'Core user identity and display attributes',
            investorProfile: 'Investor persona, strategy preferences, and AI context parameters',
            journal: 'Complete chronological journal entries and daily reflections',
          },
        },
        data: {
          profile: {
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt.toISOString(),
          },
          investorProfile: investorProfileData,
          journal: {
            count: entries.length,
            entries,
          },
        },
      }

      return backup
    },
    async deleteProfile(input) {
      return prisma.$transaction(async (tx) => {
        const user = await tx.user.findFirst({
          where: {
            id: input.userId,
            organizationId: input.organizationId,
          },
        })

        if (!user) {
          return { deleted: false, deletedUserId: null }
        }

        await Promise.all([
          tx.journalEntry.deleteMany({
            where: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          }),
          tx.investorProfile.deleteMany({
            where: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          }),
          tx.refreshToken.deleteMany({
            where: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          }),
          tx.oAuthProvider.deleteMany({
            where: {
              organizationId: input.organizationId,
              userId: user.id,
            },
          }),
        ])

        const deletedUser = await tx.user.delete({
          where: {
            id: user.id,
          },
        })

        return { deleted: true, deletedUserId: deletedUser.id }
      })
    },
  }
}

export function generateSyntheticEmail(displayName: string): string {
  const slug = displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'profile'
  return `${slug}@local.invalid`
}

export function mapUserRecordToSessionUser(user: Pick<User, 'id' | 'displayName' | 'email'>): SessionUser {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
  }
}

export function mapUserRecordToHouseholdProfile(
  user: Pick<User, 'id' | 'displayName' | 'email' | 'lastLoginAt'> & {
    _count?: {
      journalEntries?: number
      investorProfiles?: number
    }
  },
): HouseholdProfile {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email,
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    journalEntryCount: user._count?.journalEntries ?? 0,
    hasInvestorProfile: Boolean(user._count?.investorProfiles && user._count.investorProfiles > 0),
  }
}
