import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PrismaClient } from './generated/prisma/client.js'
import { createAiConnectionStore } from './aiConnectionStore.js'

const testedAt = new Date('2026-09-05T18:00:00.000Z')

function createPrismaDouble(
  updateCalls: Array<Record<string, unknown>>,
  updateWhereCalls: Array<Record<string, unknown>> = [],
) {
  const existing = {
    id: 'connection-a',
    organizationId: 'org-a',
    providerId: 'google-gemini',
    label: 'Broken Gemini',
    enabled: true,
    secretPayload: {
      version: 1,
      algorithm: 'aes-256-gcm',
      keyVersion: 'active',
      iv: 'iv',
      authTag: 'tag',
      ciphertext: 'ciphertext',
    },
    configPayload: {
      schemaVersion: 1,
      model: 'gemini-model',
    },
    lastTestedAt: testedAt,
    lastTestStatus: 'failure',
    lastTestFailureKind: 'auth',
    lastTestErrorSummary: 'The provider rejected the credentials.',
    consecutiveFailureCount: 3,
    createdAt: testedAt,
    updatedAt: testedAt,
  }
  const matches = (where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => existing[key as keyof typeof existing] === value)
  const client = {
    aiConnection: {
      findFirst: async () => existing,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => {
        updateWhereCalls.push(where)
        if (!matches(where)) {
          return { count: 0 }
        }
        updateCalls.push(data)
        Object.assign(existing, data)
        return { count: 1 }
      },
      update: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => {
        updateWhereCalls.push(where)
        if (!matches(where)) {
          throw Object.assign(new Error('Record not found'), { code: 'P2025' })
        }
        updateCalls.push(data)
        Object.assign(existing, data)
        return existing
      },
    },
  }

  return {
    prisma: {
      ...client,
      $transaction: async <T>(callback: (tx: typeof client) => Promise<T>) => callback(client),
    } as unknown as PrismaClient,
    existing,
  }
}

test('preserves failure metadata when a broken connection is edited', async () => {
  const updateCalls: Array<Record<string, unknown>> = []
  const { prisma } = createPrismaDouble(updateCalls)
  const store = createAiConnectionStore(prisma)

  const connection = await store.update({
    organizationId: 'org-a',
    connectionId: 'connection-a',
    label: 'Repaired Gemini',
    configPayload: {
      schemaVersion: 1,
      model: 'new-gemini-model',
    },
  })

  assert.equal(connection?.lastTestStatus, 'failure')
  assert.equal(connection?.lastTestFailureKind, 'auth')
  assert.equal(connection?.lastTestErrorSummary, 'The provider rejected the credentials.')
  assert.equal(connection?.consecutiveFailureCount, 3)
  assert.equal(connection?.lastTestedAt?.toISOString(), testedAt.toISOString())
  assert.equal(updateCalls.length, 1)
  assert.equal('lastTestStatus' in updateCalls[0], false)
  assert.equal('lastTestFailureKind' in updateCalls[0], false)
  assert.equal('lastTestErrorSummary' in updateCalls[0], false)
  assert.equal('consecutiveFailureCount' in updateCalls[0], false)
})

test('a successful test is the operation that clears failure metadata', async () => {
  const updateCalls: Array<Record<string, unknown>> = []
  const { prisma } = createPrismaDouble(updateCalls)
  const store = createAiConnectionStore(prisma)

  const connection = await store.updateTestMetadata({
    organizationId: 'org-a',
    connectionId: 'connection-a',
    testedAt,
    status: 'success',
  })

  assert.equal(connection?.lastTestStatus, 'success')
  assert.equal(connection?.lastTestFailureKind, null)
  assert.equal(connection?.lastTestErrorSummary, null)
  assert.equal(connection?.consecutiveFailureCount, 0)
  assert.deepEqual(updateCalls[0], {
    lastTestedAt: testedAt,
    lastTestStatus: 'success',
    lastTestFailureKind: null,
    lastTestErrorSummary: null,
    consecutiveFailureCount: 0,
  })
})


test('update for another organization returns null and leaves the connection unchanged', async () => {
  const updateCalls: Array<Record<string, unknown>> = []
  const updateWhereCalls: Array<Record<string, unknown>> = []
  const { prisma, existing } = createPrismaDouble(updateCalls, updateWhereCalls)
  const store = createAiConnectionStore(prisma)

  const result = await store.update({
    organizationId: 'org-b',
    connectionId: 'connection-a',
    label: 'Hijacked connection',
  })

  assert.equal(result, null)
  assert.deepEqual(updateWhereCalls, [{ id: 'connection-a', organizationId: 'org-b' }])
  assert.deepEqual(updateCalls, [])
  assert.equal(existing.label, 'Broken Gemini')
  assert.deepEqual(existing.configPayload, { schemaVersion: 1, model: 'gemini-model' })
  assert.equal(existing.lastTestStatus, 'failure')
})
