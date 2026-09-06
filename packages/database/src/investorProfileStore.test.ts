import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { InvestorProfile, PrismaClient } from './generated/prisma/client.js'
import { createInvestorProfileStore } from './investorProfileStore.js'

function createMockPrisma() {
  const profiles = new Map<string, InvestorProfile>()

  return {
    investorProfile: {
      findUnique: async ({
        where,
      }: {
        where: { organizationId_userId: { organizationId: string; userId: string } }
      }) => {
        const key = `${where.organizationId_userId.organizationId}:${where.organizationId_userId.userId}`
        return profiles.get(key) ?? null
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { organizationId_userId: { organizationId: string; userId: string } }
        create: Omit<InvestorProfile, 'id' | 'createdAt' | 'updatedAt'>
        update: Partial<InvestorProfile>
      }) => {
        const key = `${where.organizationId_userId.organizationId}:${where.organizationId_userId.userId}`
        const existing = profiles.get(key)
        const now = new Date()

        if (existing) {
          const updated: InvestorProfile = {
            ...existing,
            ...update,
            updatedAt: now,
          }
          profiles.set(key, updated)
          return updated
        }

        const created: InvestorProfile = {
          id: 'profile-1',
          createdAt: now,
          updatedAt: now,
          preferredName: create.preferredName ?? null,
          experienceLevel: create.experienceLevel ?? null,
          portfolioContext: create.portfolioContext ?? null,
          primaryObjective: create.primaryObjective ?? null,
          strategyPresets: create.strategyPresets ?? null,
          customStrategyDescription: create.customStrategyDescription ?? null,
          freeformAiContext: create.freeformAiContext ?? null,
          organizationId: create.organizationId,
          userId: create.userId,
        }
        profiles.set(key, created)
        return created
      },
    },
  } as unknown as PrismaClient
}

test('investorProfileStore returns null when no profile exists', async () => {
  const store = createInvestorProfileStore(createMockPrisma())
  const profile = await store.getProfile({
    organizationId: 'org-1',
    userId: 'user-1',
  })
  assert.equal(profile, null)
})

test('investorProfileStore creates and updates profile cleanly', async () => {
  const store = createInvestorProfileStore(createMockPrisma())

  const created = await store.upsertProfile({
    organizationId: 'org-1',
    userId: 'user-1',
    preferredName: 'Alex',
    experienceLevel: 'BEGINNER',
    primaryObjective: 'STEADY_INCOME',
    strategyPresets: ['COVERED_CALLS', 'THE_WHEEL'],
    customStrategyDescription: 'Deep ITM Covered Calls overlay',
  })

  assert.equal(created.preferredName, 'Alex')
  assert.equal(created.experienceLevel, 'BEGINNER')
  assert.equal(created.primaryObjective, 'STEADY_INCOME')
  assert.deepEqual(created.strategyPresets, ['COVERED_CALLS', 'THE_WHEEL'])
  assert.equal(created.customStrategyDescription, 'Deep ITM Covered Calls overlay')

  const fetched = await store.getProfile({
    organizationId: 'org-1',
    userId: 'user-1',
  })
  assert.notEqual(fetched, null)
  assert.equal(fetched?.preferredName, 'Alex')

  const updated = await store.upsertProfile({
    organizationId: 'org-1',
    userId: 'user-1',
    preferredName: 'Alexander',
    experienceLevel: 'INTERMEDIATE',
    primaryObjective: 'STEADY_INCOME',
    strategyPresets: ['COVERED_CALLS', 'THE_WHEEL'],
    freeformAiContext: 'Tax considerations: IRA account',
  })

  assert.equal(updated.preferredName, 'Alexander')
  assert.equal(updated.experienceLevel, 'INTERMEDIATE')
  assert.equal(updated.freeformAiContext, 'Tax considerations: IRA account')
})
