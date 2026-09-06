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
  const user: User = {
    id: 'user-1',
    organizationId: 'org-1',
    email: 'primary-user@local.invalid',
    displayName: 'Primary User',
    role: 'member',
    lastLoginAt: loginDate,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const profile = mapUserRecordToHouseholdProfile(user)
  assert.equal(profile.id, 'user-1')
  assert.equal(profile.displayName, 'Primary User')
  assert.equal(profile.email, 'primary-user@local.invalid')
  assert.equal(profile.lastLoginAt, loginDate.toISOString())
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
