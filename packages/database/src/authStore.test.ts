import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient, User } from './generated/prisma/client.js'
import {
  createAuthStore,
  generateSyntheticEmail,
  mapUserRecordToHouseholdProfile,
} from './authStore.js'
import { createPrismaClient } from './client.js'
import { createPredictionStore } from './predictionStore.js'
import { createSecurityStore } from './securityStore.js'

interface CapturedData {
  organizationId?: string
  displayName?: string
  email?: string
  role?: string
  revokedAt?: unknown
  OR?: unknown[]
  [key: string]: unknown
}

test('generateSyntheticEmail produces valid <slug>@local.invalid address', () => {
  assert.equal(generateSyntheticEmail('Primary User'), 'primary-user@local.invalid')
  assert.equal(generateSyntheticEmail(' Alice  Bob! '), 'alice-bob@local.invalid')
  assert.equal(generateSyntheticEmail('!!!'), 'profile@local.invalid')
})

test('mapUserRecordToHouseholdProfile converts user record into HouseholdProfile contract', () => {
  const loginDate = new Date('2026-09-06T12:00:00.000Z')
  const user = {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'primary-user@local.invalid',
    displayName: 'Primary User',
    role: 'member' as const,
    lastLoginAt: loginDate,
    createdAt: new Date(),
    updatedAt: new Date(),
    _count: {
      journalEntries: 5,
      investorProfiles: 1,
    },
  }

  const profile = mapUserRecordToHouseholdProfile(user)
  assert.equal(profile.id, 'user-1')
  assert.equal(profile.displayName, 'Primary User')
  assert.equal(profile.email, 'primary-user@local.invalid')
  assert.equal(profile.lastLoginAt, loginDate.toISOString())
  assert.equal(profile.journalEntryCount, 5)
  assert.equal(profile.hasInvestorProfile, true)
})

test('listProfilesInOrganization queries users filtered by organizationId and sorted correctly', async () => {
  let queriedArgs: Record<string, unknown> | null = null

  const mockPrisma = {
    user: {
      findMany: async (args: Record<string, unknown>) => {
        queriedArgs = args
        return []
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  await store.listProfilesInOrganization({ organizationId: 'org-123' })

  assert.deepEqual(queriedArgs, {
    where: { organizationId: 'org-123' },
    include: {
      _count: {
        select: {
          journalEntries: true,
          investorProfiles: true,
        },
      },
    },
    orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'asc' }],
  })
})

test('createLocalProfile generates synthetic email when omitted', async () => {
  const createCalls: CapturedData[] = []
  let findFirstCalls = 0

  const mockPrisma = {
    user: {
      findFirst: async () => {
        findFirstCalls++
        return null
      },
      create: async (args: { data: Record<string, unknown> }) => {
        createCalls.push(args.data)
        return {
          id: 'user-new',
          ...args.data,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as User
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const profile = await store.createLocalProfile({
    organizationId: 'org-local',
    displayName: ' Household Member ',
  })

  assert.equal(createCalls[0]?.organizationId, 'org-local')
  assert.equal(createCalls[0]?.displayName, 'Household Member')
  assert.equal(createCalls[0]?.email, 'household-member@local.invalid')
  assert.equal(createCalls[0]?.role, 'member')
  assert.equal(profile.displayName, 'Household Member')
  assert.equal(findFirstCalls, 1)
})

test('createLocalProfile uses supplied email when provided', async () => {
  const createCalls: CapturedData[] = []

  const mockPrisma = {
    user: {
      create: async (args: { data: Record<string, unknown> }) => {
        createCalls.push(args.data)
        return {
          id: 'user-new',
          ...args.data,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as User
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  await store.createLocalProfile({
    organizationId: 'org-local',
    displayName: 'Alice',
    email: 'alice@example.com',
  })

  assert.equal(createCalls[0]?.email, 'alice@example.com')
})

test('createLocalProfile resolves synthetic email collisions with numbered suffixes', async () => {
  const createCalls: CapturedData[] = []
  let existingCheckCount = 0

  const mockPrisma = {
    user: {
      findFirst: async (args: { where: { email: string } }) => {
        existingCheckCount++
        if (args.where.email === 'primary-user@local.invalid') {
          return { id: 'existing-1' } as User
        }
        return null
      },
      create: async (args: { data: Record<string, unknown> }) => {
        createCalls.push(args.data)
        return {
          id: 'user-2',
          ...args.data,
          lastLoginAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as unknown as User
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  await store.createLocalProfile({
    organizationId: 'org-local',
    displayName: 'Primary User',
  })

  assert.equal(existingCheckCount, 2)
  assert.equal(createCalls[0]?.email, 'primary-user-1@local.invalid')
})

test('findActiveRefreshTokenByHash enforces strict unrevoked status when graceWindowMs is zero or omitted', async () => {
  const whereCalls: CapturedData[] = []
  const now = new Date('2026-09-06T12:00:00.000Z')

  const mockPrisma = {
    refreshToken: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        whereCalls.push(args.where)
        return null
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  await store.findActiveRefreshTokenByHash({
    organizationId: 'org-1',
    userId: 'user-1',
    tokenHash: 'hash-abc',
    now,
  })

  assert.equal(whereCalls[0]?.revokedAt, null)
})

test('findActiveRefreshTokenByHash includes grace window cutoff when graceWindowMs is supplied', async () => {
  const whereCalls: CapturedData[] = []
  const now = new Date('2026-09-06T12:00:00.000Z')
  const graceWindowMs = 30_000 // 30 seconds

  const mockPrisma = {
    refreshToken: {
      findFirst: async (args: { where: Record<string, unknown> }) => {
        whereCalls.push(args.where)
        return null
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  await store.findActiveRefreshTokenByHash({
    organizationId: 'org-1',
    userId: 'user-1',
    tokenHash: 'hash-abc',
    now,
    graceWindowMs,
  })

  const expectedCutoff = new Date(now.getTime() - graceWindowMs)
  assert.deepEqual(whereCalls[0]?.OR, [
    { revokedAt: null },
    { revokedAt: { gte: expectedCutoff } },
  ])
})

test('getProfileBackup returns structured backup payload for existing user', async () => {
  const userCreatedAt = new Date('2026-01-01T10:00:00.000Z')
  const entryCreatedAt = new Date('2026-08-01T10:00:00.000Z')
  const entryDate = new Date('2026-08-01T00:00:00.000Z')
  const predictionCreatedAt = new Date('2026-08-05T09:00:00.000Z')
  const predictionDeadline = new Date('2026-09-05T00:00:00.000Z')
  const changedAt = new Date('2026-08-06T09:00:00.000Z')

  const mockPrisma = {
    user: {
      findFirst: async (args: { where: { id: string; organizationId: string } }) => {
        if (args.where.id === 'user-1' && args.where.organizationId === 'org-1') {
          return {
            id: 'user-1',
            organizationId: 'org-1',
            displayName: 'Alex',
            email: 'alex@local.invalid',
            role: 'member',
            createdAt: userCreatedAt,
            investorProfiles: [
              {
                id: 'inv-1',
                organizationId: 'org-1',
                userId: 'user-1',
                preferredName: 'Alex',
                experienceLevel: 'intermediate',
                portfolioContext: ['taxable'],
                primaryObjective: 'growth',
                strategyPresets: ['covered_calls'],
                customStrategyDescription: 'Core strategy',
                freeformAiContext: 'Focus on dividend growth',
                createdAt: userCreatedAt,
                updatedAt: userCreatedAt,
              },
            ],
            journalEntries: [
              {
                id: 'entry-1',
                organizationId: 'org-1',
                userId: 'user-1',
                localDate: entryDate,
                content: 'First journal entry.',
                createdAt: entryCreatedAt,
                updatedAt: entryCreatedAt,
              },
            ],
            predictions: [
              {
                id: 'pred-1',
                organizationId: 'org-1',
                userId: 'user-1',
                securityId: 'sec-1',
                otherSymbol: null,
                topic: null,
                symbolSnapshot: 'MSFT',
                symbolNormalizedSnapshot: 'MSFT',
                type: 'DIRECTION',
                direction: 'RISES',
                claimText: 'MSFT rises before earnings.',
                eventLabel: null,
                deadline: predictionDeadline,
                confidence: 70,
                priceAtPrediction: { toString: () => '410.12340000' },
                predictedPrice: null,
                predictedPercent: null,
                priceCapturedAt: predictionCreatedAt,
                reasoning: 'Momentum looks strong.',
                tags: ['tech'],
                result: 'CORRECT',
                resolutionDate: predictionDeadline,
                actualPrice: { toString: () => '420.00000000' },
                outcomeNotes: 'Beat expectations.',
                voidedAt: null,
                voidReason: null,
                amended: true,
                amendedAt: changedAt,
                createdAt: predictionCreatedAt,
                updatedAt: changedAt,
                amendments: [
                  {
                    id: 'amend-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    predictionId: 'pred-1',
                    previousSecurityId: 'sec-1',
                    previousOtherSymbol: null,
                    previousTopic: null,
                    previousSymbolSnapshot: 'MSFT',
                    previousSymbolNormalizedSnapshot: 'MSFT',
                    previousType: 'DIRECTION',
                    previousDirection: 'RISES',
                    previousClaimText: 'MSFT rises before earnings (original).',
                    previousEventLabel: null,
                    previousDeadline: predictionDeadline,
                    previousConfidence: 65,
                    previousPriceAtPrediction: { toString: () => '405.00000000' },
                    previousPriceCapturedAt: predictionCreatedAt,
                    previousPredictedPrice: null,
                    previousPredictedPercent: null,
                    changedFields: ['claimText', 'confidence'],
                    changedAt,
                  },
                ],
                resultHistory: [
                  {
                    id: 'result-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    predictionId: 'pred-1',
                    previousResult: null,
                    previousResolutionDate: null,
                    previousActualPrice: null,
                    previousOutcomeNotes: null,
                    newResult: 'CORRECT',
                    newResolutionDate: predictionDeadline,
                    newActualPrice: { toString: () => '420.00000000' },
                    newOutcomeNotes: 'Beat expectations.',
                    changedAt,
                  },
                ],
                reasoningHistory: [
                  {
                    id: 'reason-1',
                    organizationId: 'org-1',
                    userId: 'user-1',
                    predictionId: 'pred-1',
                    previousReasoning: 'Momentum looked strong (draft).',
                    newReasoning: 'Momentum looks strong.',
                    changedAt,
                  },
                ],
              },
            ],
          }
        }
        return null
      },
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const backup = await store.getProfileBackup({
    organizationId: 'org-1',
    userId: 'user-1',
    appVersion: '0.1.0',
    appMode: 'local',
  })

  assert.ok(backup)
  assert.equal(backup.version, '1.0.0')
  assert.equal(backup.appMode, 'local')
  assert.equal(backup.data.profile.displayName, 'Alex')
  assert.equal(backup.data.profile.email, 'alex@local.invalid')
  assert.equal(backup.data.investorProfile?.preferredName, 'Alex')
  assert.equal(backup.data.journal.count, 1)
  assert.equal(backup.data.journal.entries[0]?.content, 'First journal entry.')
  assert.equal(backup.data.journal.entries[0]?.localDate, '2026-08-01')

  // _meta.sections carries manifest descriptions for all four intuitionLedger subsections.
  assert.equal(typeof backup._meta.sections.intuitionLedger.predictions, 'string')
  assert.ok(backup._meta.sections.intuitionLedger.predictions.length > 0)
  assert.ok(backup._meta.sections.intuitionLedger.amendmentHistory.length > 0)
  assert.ok(backup._meta.sections.intuitionLedger.resultHistory.length > 0)
  assert.ok(backup._meta.sections.intuitionLedger.reasoningHistory.length > 0)

  assert.equal(backup.data.intuitionLedger.predictions.count, 1)
  const predictionRecord = backup.data.intuitionLedger.predictions.records[0]
  assert.equal(predictionRecord?.id, 'pred-1')
  assert.equal(predictionRecord?.claimText, 'MSFT rises before earnings.')
  assert.equal(predictionRecord?.priceAtPrediction, '410.12340000')
  assert.equal(predictionRecord?.deadline, '2026-09-05')
  assert.equal(predictionRecord?.tags[0], 'tech')

  assert.equal(backup.data.intuitionLedger.amendmentHistory.count, 1)
  assert.equal(backup.data.intuitionLedger.amendmentHistory.records[0]?.predictionId, 'pred-1')
  assert.equal(
    backup.data.intuitionLedger.amendmentHistory.records[0]?.previousClaimText,
    'MSFT rises before earnings (original).',
  )

  assert.equal(backup.data.intuitionLedger.resultHistory.count, 1)
  assert.equal(backup.data.intuitionLedger.resultHistory.records[0]?.newResult, 'CORRECT')
  assert.equal(backup.data.intuitionLedger.resultHistory.records[0]?.newActualPrice, '420.00000000')

  assert.equal(backup.data.intuitionLedger.reasoningHistory.count, 1)
  assert.equal(
    backup.data.intuitionLedger.reasoningHistory.records[0]?.newReasoning,
    'Momentum looks strong.',
  )
})

test('getProfileBackup returns null when user does not exist or org mismatches', async () => {
  const mockPrisma = {
    user: {
      findFirst: async () => null,
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const backup = await store.getProfileBackup({
    organizationId: 'org-1',
    userId: 'user-nonexistent',
  })

  assert.equal(backup, null)
})

test('getProfileBackup returns empty intuitionLedger sections when the user has no predictions', async () => {
  const userCreatedAt = new Date('2026-01-01T10:00:00.000Z')

  const mockPrisma = {
    user: {
      findFirst: async () => ({
        id: 'user-2',
        organizationId: 'org-1',
        displayName: 'Sam',
        email: 'sam@local.invalid',
        role: 'member',
        createdAt: userCreatedAt,
        investorProfiles: [],
        journalEntries: [],
        predictions: [],
      }),
    },
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const backup = await store.getProfileBackup({
    organizationId: 'org-1',
    userId: 'user-2',
  })

  assert.ok(backup)
  assert.equal(backup.data.intuitionLedger.predictions.count, 0)
  assert.equal(backup.data.intuitionLedger.amendmentHistory.count, 0)
  assert.equal(backup.data.intuitionLedger.resultHistory.count, 0)
  assert.equal(backup.data.intuitionLedger.reasoningHistory.count, 0)
})


test('deleteProfile deletes user and all organization-scoped child rows inside a transaction', async () => {
  const capturedScopes: Array<{ collection: string; where: Record<string, unknown> }> = []
  let deletedUserId: string | null = null

  const tx = {
    user: {
      findFirst: async (args: { where: { id: string; organizationId: string } }) => {
        if (args.where.id === 'user-to-delete' && args.where.organizationId === 'org-1') {
          return { id: 'user-to-delete', organizationId: 'org-1' }
        }
        return null
      },
      delete: async (args: { where: { id: string } }) => {
        deletedUserId = args.where.id
        capturedScopes.push({ collection: 'user', where: { id: args.where.id } })
        return { id: args.where.id }
      },
    },
    predictionReasoningHistory: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionReasoningHistory', where: args.where })
        return { count: 1 }
      },
    },
    predictionResultHistory: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionResultHistory', where: args.where })
        return { count: 1 }
      },
    },
    predictionAmendment: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionAmendment', where: args.where })
        return { count: 1 }
      },
    },
    prediction: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'prediction', where: args.where })
        return { count: 1 }
      },
    },
    journalEntry: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'journalEntry', where: args.where })
        return { count: 2 }
      },
    },
    investorProfile: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'investorProfile', where: args.where })
        return { count: 1 }
      },
    },
    refreshToken: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'refreshToken', where: args.where })
        return { count: 3 }
      },
    },
    oAuthProvider: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'oAuthProvider', where: args.where })
        return { count: 2 }
      },
    },
  }

  const mockPrisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const result = await store.deleteProfile({
    organizationId: 'org-1',
    userId: 'user-to-delete',
  })

  assert.deepEqual(result, { deleted: true, deletedUserId: 'user-to-delete' })
  assert.equal(deletedUserId, 'user-to-delete')

  // Prediction-tree deletes (leaf histories, then amendments, then predictions)
  // must run before the existing profile-related deletes and the user delete.
  const predictionTreeOrder = capturedScopes
    .map((scope) => scope.collection)
    .filter((collection) =>
      [
        'predictionReasoningHistory',
        'predictionResultHistory',
        'predictionAmendment',
        'prediction',
      ].includes(collection),
    )
  assert.deepEqual(predictionTreeOrder, [
    'predictionReasoningHistory',
    'predictionResultHistory',
    'predictionAmendment',
    'prediction',
  ])
  assert.ok(
    capturedScopes.findIndex((scope) => scope.collection === 'prediction') <
      capturedScopes.findIndex((scope) => scope.collection === 'journalEntry'),
  )
  assert.equal(capturedScopes.at(-1)?.collection, 'user')

  for (const scope of capturedScopes) {
    if (scope.collection === 'user') continue
    assert.deepEqual(scope.where, { organizationId: 'org-1', userId: 'user-to-delete' })
  }
})

test('deleteProfile rejects the transaction when the delete fails so no partial result is returned', async () => {
  const capturedScopes: Array<{ collection: string; where: Record<string, unknown> }> = []

  const tx = {
    user: {
      findFirst: async () => ({ id: 'user-fail', organizationId: 'org-1' }),
      delete: async (args: { where: { id: string } }) => {
        capturedScopes.push({ collection: 'user', where: { id: args.where.id } })
        throw new Error('delete failed')
      },
    },
    predictionReasoningHistory: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionReasoningHistory', where: args.where })
        return { count: 1 }
      },
    },
    predictionResultHistory: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionResultHistory', where: args.where })
        return { count: 1 }
      },
    },
    predictionAmendment: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'predictionAmendment', where: args.where })
        return { count: 1 }
      },
    },
    prediction: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'prediction', where: args.where })
        return { count: 1 }
      },
    },
    journalEntry: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'journalEntry', where: args.where })
        return { count: 1 }
      },
    },
    investorProfile: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'investorProfile', where: args.where })
        return { count: 1 }
      },
    },
    refreshToken: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'refreshToken', where: args.where })
        return { count: 2 }
      },
    },
    oAuthProvider: {
      deleteMany: async (args: { where: Record<string, unknown> }) => {
        capturedScopes.push({ collection: 'oAuthProvider', where: args.where })
        return { count: 3 }
      },
    },
  }

  const mockPrisma = {
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)

  await assert.rejects(
    () =>
      store.deleteProfile({
        organizationId: 'org-1',
        userId: 'user-fail',
      }),
    /delete failed/,
  )

  // Every delete ran (in order) before the failing user.delete; the mock
  // $transaction propagates the throw, matching Prisma's real rollback
  // behavior for interactive transactions (no partial success is reported).
  assert.deepEqual(
    capturedScopes.map((scope) => scope.collection),
    [
      'predictionReasoningHistory',
      'predictionResultHistory',
      'predictionAmendment',
      'prediction',
      'journalEntry',
      'investorProfile',
      'refreshToken',
      'oAuthProvider',
      'user',
    ],
  )
})

test('deleteProfile returns deleted: false when user is not found or in different organization', async () => {
  let deleteCalled = false

  const mockPrisma = {
    $transaction: async (callback: (transaction: {
      user: {
        findFirst: () => Promise<null>
        delete: () => Promise<unknown>
      }
    }) => Promise<unknown>) => callback({
      user: {
        findFirst: async () => null,
        delete: async () => {
          deleteCalled = true
          return {}
        },
      },
    }),
  } as unknown as PrismaClient

  const store = createAuthStore(mockPrisma)
  const result = await store.deleteProfile({
    organizationId: 'org-1',
    userId: 'user-other-org',
  })

  assert.deepEqual(result, { deleted: false, deletedUserId: null })
  assert.equal(deleteCalled, false)
})

  test('getProfileBackup and deleteProfile: real database round trip proves atomic, scoped predictions cleanup', async () => {
    const prisma = createPrismaClient()
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const organization = await prisma.organization.create({
      data: { slug: `auth-ledger-org-${suffix}`, name: 'Auth Ledger Test Org' },
    })
    const userToDelete = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `auth-ledger-delete-${suffix}@local.invalid`,
        displayName: 'Ledger Delete Target',
        role: 'member',
      },
    })
    const otherUser = await prisma.user.create({
      data: {
        organizationId: organization.id,
        email: `auth-ledger-keep-${suffix}@local.invalid`,
        displayName: 'Ledger Keep Target',
        role: 'member',
      },
    })

    const securityStore = createSecurityStore(prisma)
    const createdSecurity = await securityStore.create({
      organizationId: organization.id,
      symbol: `LEDGER${suffix}`,
      type: 'STOCK',
    })
    assert.equal(createdSecurity.status, 'created')
    const securityId = createdSecurity.status === 'created' ? createdSecurity.security.id : ''

    const predictionStore = createPredictionStore(prisma)

    const ownedPredictionResult = await predictionStore.create({
      organizationId: organization.id,
      userId: userToDelete.id,
      securityId,
      type: 'DIRECTION',
      direction: 'RISES',
      claimText: 'This prediction and its histories must be deleted with the profile.',
      deadline: '2026-12-31',
      confidence: 60,
      priceAtPrediction: '100.0000',
      priceCapturedAt: '2026-01-01T00:00:00.000Z',
      reasoning: 'Initial reasoning.',
    })
    assert.equal(ownedPredictionResult.status, 'created')
    const ownedPredictionId =
      ownedPredictionResult.status === 'created' ? ownedPredictionResult.prediction.id : ''

    const otherPredictionResult = await predictionStore.create({
      organizationId: organization.id,
      userId: otherUser.id,
      securityId,
      type: 'DIRECTION',
      direction: 'FALLS',
      claimText: 'Another user prediction that must survive the delete.',
      deadline: '2026-12-31',
      confidence: 55,
      priceAtPrediction: '50.0000',
      priceCapturedAt: '2026-01-01T00:00:00.000Z',
    })
    assert.equal(otherPredictionResult.status, 'created')
    const otherPredictionId =
      otherPredictionResult.status === 'created' ? otherPredictionResult.prediction.id : ''

    // Insert history rows directly (bypassing the grace-window timing rules in
    // predictionStore.update) so the backup/delete coverage exercises real rows
    // in all three history tables.
    const amendment = await prisma.predictionAmendment.create({
      data: {
        organizationId: organization.id,
        userId: userToDelete.id,
        predictionId: ownedPredictionId,
        previousSecurityId: securityId,
        previousSymbolSnapshot: `LEDGER${suffix}`,
        previousSymbolNormalizedSnapshot: `LEDGER${suffix}`,
        previousType: 'DIRECTION',
        previousDirection: 'RISES',
        previousClaimText: 'Original claim text.',
        previousDeadline: new Date('2026-12-31T00:00:00.000Z'),
        previousConfidence: 55,
        previousPriceAtPrediction: '99.0000',
        previousPriceCapturedAt: new Date('2026-01-01T00:00:00.000Z'),
        changedFields: ['claimText', 'confidence'],
      },
    })
    const resultHistory = await prisma.predictionResultHistory.create({
      data: {
        organizationId: organization.id,
        userId: userToDelete.id,
        predictionId: ownedPredictionId,
        newResult: 'CORRECT',
        newResolutionDate: new Date('2026-12-31T00:00:00.000Z'),
        newActualPrice: '110.0000',
      },
    })
    const reasoningHistory = await prisma.predictionReasoningHistory.create({
      data: {
        organizationId: organization.id,
        userId: userToDelete.id,
        predictionId: ownedPredictionId,
        previousReasoning: 'Initial reasoning.',
        newReasoning: 'Updated reasoning after review.',
      },
    })

    const authStore = createAuthStore(prisma)

    try {
      const backup = await authStore.getProfileBackup({
        organizationId: organization.id,
        userId: userToDelete.id,
      })

      assert.ok(backup)
      assert.equal(backup._meta.sections.intuitionLedger.predictions.length > 0, true)
      assert.equal(backup._meta.sections.intuitionLedger.amendmentHistory.length > 0, true)
      assert.equal(backup._meta.sections.intuitionLedger.resultHistory.length > 0, true)
      assert.equal(backup._meta.sections.intuitionLedger.reasoningHistory.length > 0, true)

      assert.equal(backup.data.intuitionLedger.predictions.count, 1)
      assert.equal(backup.data.intuitionLedger.predictions.records[0]?.id, ownedPredictionId)
      assert.equal(backup.data.intuitionLedger.amendmentHistory.count, 1)
      assert.equal(backup.data.intuitionLedger.amendmentHistory.records[0]?.id, amendment.id)
      assert.equal(backup.data.intuitionLedger.resultHistory.count, 1)
      assert.equal(backup.data.intuitionLedger.resultHistory.records[0]?.id, resultHistory.id)
      assert.equal(backup.data.intuitionLedger.reasoningHistory.count, 1)
      assert.equal(backup.data.intuitionLedger.reasoningHistory.records[0]?.id, reasoningHistory.id)

      const deleteResult = await authStore.deleteProfile({
        organizationId: organization.id,
        userId: userToDelete.id,
      })
      assert.deepEqual(deleteResult, { deleted: true, deletedUserId: userToDelete.id })

      // The deleted user's prediction tree is gone.
      assert.equal(
        await prisma.prediction.findUnique({ where: { id: ownedPredictionId } }),
        null,
      )
      assert.equal(
        await prisma.predictionAmendment.findUnique({ where: { id: amendment.id } }),
        null,
      )
      assert.equal(
        await prisma.predictionResultHistory.findUnique({ where: { id: resultHistory.id } }),
        null,
      )
      assert.equal(
        await prisma.predictionReasoningHistory.findUnique({ where: { id: reasoningHistory.id } }),
        null,
      )
      assert.equal(await prisma.user.findUnique({ where: { id: userToDelete.id } }), null)

      // Another user's prediction and the security remain untouched.
      const survivingPrediction = await prisma.prediction.findUnique({
        where: { id: otherPredictionId },
      })
      assert.ok(survivingPrediction)
      assert.equal(survivingPrediction?.userId, otherUser.id)

      const survivingSecurity = await prisma.security.findUnique({ where: { id: securityId } })
      assert.ok(survivingSecurity)
    } finally {
      await prisma.predictionReasoningHistory.deleteMany({ where: { organizationId: organization.id } })
      await prisma.predictionResultHistory.deleteMany({ where: { organizationId: organization.id } })
      await prisma.predictionAmendment.deleteMany({ where: { organizationId: organization.id } })
      await prisma.prediction.deleteMany({ where: { organizationId: organization.id } })
      await prisma.security.deleteMany({ where: { organizationId: organization.id } })
      await prisma.user.deleteMany({ where: { organizationId: organization.id } })
      await prisma.organization.deleteMany({ where: { id: organization.id } })
      await prisma.$disconnect()
    }
  })
