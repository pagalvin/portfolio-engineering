import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient, User } from './generated/prisma/client.js'
import {
  createAuthStore,
  generateSyntheticEmail,
  mapUserRecordToHouseholdProfile,
} from './authStore.js'

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
  assert.deepEqual(capturedScopes, [
    {
      collection: 'journalEntry',
      where: { organizationId: 'org-1', userId: 'user-to-delete' },
    },
    {
      collection: 'investorProfile',
      where: { organizationId: 'org-1', userId: 'user-to-delete' },
    },
    {
      collection: 'refreshToken',
      where: { organizationId: 'org-1', userId: 'user-to-delete' },
    },
    {
      collection: 'oAuthProvider',
      where: { organizationId: 'org-1', userId: 'user-to-delete' },
    },
    {
      collection: 'user',
      where: { id: 'user-to-delete' },
    },
  ])
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

  assert.deepEqual(capturedScopes.slice(-5), [
    {
      collection: 'journalEntry',
      where: { organizationId: 'org-1', userId: 'user-fail' },
    },
    {
      collection: 'investorProfile',
      where: { organizationId: 'org-1', userId: 'user-fail' },
    },
    {
      collection: 'refreshToken',
      where: { organizationId: 'org-1', userId: 'user-fail' },
    },
    {
      collection: 'oAuthProvider',
      where: { organizationId: 'org-1', userId: 'user-fail' },
    },
    {
      collection: 'user',
      where: { id: 'user-fail' },
    },
  ])
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
