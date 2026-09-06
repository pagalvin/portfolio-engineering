import type {
  InvestorProfile,
  Prisma,
  PrismaClient,
} from './generated/prisma/client.js'

export interface UpsertInvestorProfileInput {
  organizationId: string
  userId: string
  preferredName?: string | null
  experienceLevel?: string | null
  portfolioContext?: string[] | Prisma.InputJsonValue | null
  primaryObjective?: string | null
  strategyPresets?: string[] | Prisma.InputJsonValue | null
  customStrategyDescription?: string | null
  freeformAiContext?: string | null
}

export interface InvestorProfileStore {
  getProfile(input: {
    organizationId: string
    userId: string
  }): Promise<InvestorProfile | null>

  upsertProfile(
    input: UpsertInvestorProfileInput
  ): Promise<InvestorProfile>
}

export function createInvestorProfileStore(
  prisma: PrismaClient
): InvestorProfileStore {
  return {
    async getProfile({ organizationId, userId }) {
      return prisma.investorProfile.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      })
    },

    async upsertProfile(input) {
      const {
        organizationId,
        userId,
        preferredName,
        experienceLevel,
        portfolioContext,
        primaryObjective,
        strategyPresets,
        customStrategyDescription,
        freeformAiContext,
      } = input

      const dataToSave = {
        preferredName: preferredName ?? null,
        experienceLevel: experienceLevel ?? null,
        portfolioContext: (portfolioContext as Prisma.InputJsonValue) ?? null,
        primaryObjective: primaryObjective ?? null,
        strategyPresets: (strategyPresets as Prisma.InputJsonValue) ?? null,
        customStrategyDescription: customStrategyDescription ?? null,
        freeformAiContext: freeformAiContext ?? null,
      }

      return prisma.investorProfile.upsert({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        create: {
          organizationId,
          userId,
          ...dataToSave,
        },
        update: dataToSave,
      })
    },
  }
}
