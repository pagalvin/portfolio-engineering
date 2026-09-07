import type {
  HelpRuntimeCache,
  Prisma,
  PrismaClient,
} from './generated/prisma/client.js'

export type HelpFreshnessStatus = 'fresh' | 'stale' | 'unavailable'
export type HelpRefreshStatus = 'never_attempted' | 'succeeded' | 'failed' | 'invalid'

export type HelpRuntimeCacheRecord = HelpRuntimeCache

export interface HelpContentStore {
  get(channelId: string): Promise<HelpRuntimeCacheRecord | null>
  getLastValid(channelId: string): Promise<HelpRuntimeCacheRecord | null>
  recordDownloadAttempt(input: {
    channelId: string
    attemptedAt?: Date
    status: 'failed' | 'invalid'
  }): Promise<HelpRuntimeCacheRecord>
  writeValidatedPayload(input: {
    channelId: string
    indexPayload: Prisma.InputJsonValue
    contentPayload: Prisma.InputJsonValue
    effectiveAppVersion: string
    contentVersion: string
    schemaVersion: number
    attemptedAt?: Date
    fetchedAt?: Date
  }): Promise<HelpRuntimeCacheRecord>
  markFreshness(input: {
    channelId: string
    freshnessStatus: HelpFreshnessStatus
  }): Promise<HelpRuntimeCacheRecord | null>
}

function hasCompletePayload(record: HelpRuntimeCache): boolean {
  return (
    record.indexPayload !== null &&
    record.contentPayload !== null &&
    record.effectiveAppVersion !== null &&
    record.contentVersion !== null &&
    record.schemaVersion !== null
  )
}

export function createHelpContentStore(prisma: PrismaClient): HelpContentStore {
  return {
    get(channelId) {
      return prisma.helpRuntimeCache.findUnique({
        where: { channelId },
      })
    },

    async getLastValid(channelId) {
      const record = await prisma.helpRuntimeCache.findUnique({
        where: { channelId },
      })
      return record && hasCompletePayload(record) ? record : null
    },

    async recordDownloadAttempt({ channelId, attemptedAt = new Date(), status }) {
      return prisma.$transaction(async (transaction) => {
        const existing = await transaction.helpRuntimeCache.findUnique({
          where: { channelId },
        })
        const hasPayload = existing ? hasCompletePayload(existing) : false

        return transaction.helpRuntimeCache.upsert({
          where: { channelId },
          create: {
            channelId,
            lastDownloadAttemptAt: attemptedAt,
            lastRefreshStatus: status,
            freshnessStatus: 'unavailable',
          },
          update: {
            lastDownloadAttemptAt: attemptedAt,
            lastRefreshStatus: status,
            freshnessStatus: hasPayload ? 'stale' : 'unavailable',
          },
        })
      })
    },

    writeValidatedPayload(input) {
      const attemptedAt = input.attemptedAt ?? new Date()
      const fetchedAt = input.fetchedAt ?? attemptedAt
      return prisma.helpRuntimeCache.upsert({
        where: { channelId: input.channelId },
        create: {
          channelId: input.channelId,
          indexPayload: input.indexPayload,
          contentPayload: input.contentPayload,
          effectiveAppVersion: input.effectiveAppVersion,
          contentVersion: input.contentVersion,
          schemaVersion: input.schemaVersion,
          freshnessStatus: 'fresh',
          lastRefreshStatus: 'succeeded',
          lastDownloadAttemptAt: attemptedAt,
          fetchedAt,
        },
        update: {
          indexPayload: input.indexPayload,
          contentPayload: input.contentPayload,
          effectiveAppVersion: input.effectiveAppVersion,
          contentVersion: input.contentVersion,
          schemaVersion: input.schemaVersion,
          freshnessStatus: 'fresh',
          lastRefreshStatus: 'succeeded',
          lastDownloadAttemptAt: attemptedAt,
          fetchedAt,
        },
      })
    },

    async markFreshness({ channelId, freshnessStatus }) {
      try {
        return await prisma.helpRuntimeCache.update({
          where: { channelId },
          data: { freshnessStatus },
        })
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          (error as { code?: string }).code === 'P2025'
        ) {
          return null
        }
        throw error
      }
    },
  }
}
