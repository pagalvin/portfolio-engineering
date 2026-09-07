import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { HelpRuntimeCache, PrismaClient } from './generated/prisma/client.js'
import { createHelpContentStore } from './helpContentStore.js'

function createMockPrisma() {
  let record: HelpRuntimeCache | null = null
  let nextId = 1
  const now = () => new Date()

  const client = {} as {
    helpRuntimeCache: {
      findUnique: () => Promise<HelpRuntimeCache | null>
      upsert: (input: {
        create: Partial<HelpRuntimeCache>
        update: Partial<HelpRuntimeCache>
      }) => Promise<HelpRuntimeCache>
      update: (input: {
        data: Partial<HelpRuntimeCache>
      }) => Promise<HelpRuntimeCache>
    }
    $transaction: <T>(callback: (transaction: typeof client) => Promise<T>) => Promise<T>
  }

  client.helpRuntimeCache = {
      findUnique: async () => record,
      upsert: async ({ create, update }: { create: Partial<HelpRuntimeCache>; update: Partial<HelpRuntimeCache> }) => {
        const timestamp = now()
        if (record) {
          record = { ...record, ...update, updatedAt: timestamp }
        } else {
          record = {
            ...(create as HelpRuntimeCache),
            indexPayload: create.indexPayload ?? null,
            contentPayload: create.contentPayload ?? null,
            effectiveAppVersion: create.effectiveAppVersion ?? null,
            contentVersion: create.contentVersion ?? null,
            schemaVersion: create.schemaVersion ?? null,
            fetchedAt: create.fetchedAt ?? null,
            lastDownloadAttemptAt: create.lastDownloadAttemptAt ?? null,
            id: `help-${nextId++}`,
            createdAt: timestamp,
            updatedAt: timestamp,
          }
        }
        return record
      },
      update: async ({ data }: { data: Partial<HelpRuntimeCache> }) => {
        if (!record) {
          const error = Object.assign(new Error('missing'), { code: 'P2025' })
          throw error
        }
        record = { ...record, ...data, updatedAt: now() }
        return record
      },
  }
  client.$transaction = async <T>(callback: (transaction: typeof client) => Promise<T>) =>
    callback(client)

  return client as unknown as PrismaClient
}

test('helpContentStore preserves valid payload on failed refresh', async () => {
  const store = createHelpContentStore(createMockPrisma())
  const fetchedAt = new Date('2026-09-07T12:00:00.000Z')

  const valid = await store.writeValidatedPayload({
    channelId: 'help',
    indexPayload: { entries: [] },
    contentPayload: { pages: {}, tooltips: {} },
    effectiveAppVersion: '1.0.0',
    contentVersion: '1.0.0',
    schemaVersion: 1,
    fetchedAt,
  })
  const attemptedAt = new Date('2026-09-07T12:05:00.000Z')
  const afterFailure = await store.recordDownloadAttempt({
    channelId: 'help',
    attemptedAt,
    status: 'failed',
  })

  assert.deepEqual(afterFailure.indexPayload, valid.indexPayload)
  assert.equal(afterFailure.fetchedAt?.toISOString(), fetchedAt.toISOString())
  assert.equal(afterFailure.lastDownloadAttemptAt?.toISOString(), attemptedAt.toISOString())
  assert.equal(afterFailure.freshnessStatus, 'stale')
  assert.equal((await store.getLastValid('help'))?.contentVersion, '1.0.0')
})

test('helpContentStore creates an attempt-only row without content', async () => {
  const store = createHelpContentStore(createMockPrisma())
  const record = await store.recordDownloadAttempt({
    channelId: 'help',
    status: 'invalid',
  })

  assert.equal(record.indexPayload, null)
  assert.equal(record.lastRefreshStatus, 'invalid')
  assert.equal(await store.getLastValid('help'), null)
})

test('helpContentStore replaces validated content and records success metadata', async () => {
  const store = createHelpContentStore(createMockPrisma())
  const attemptedAt = new Date('2026-09-07T12:10:00.000Z')
  const fetchedAt = new Date('2026-09-07T12:09:00.000Z')
  const record = await store.writeValidatedPayload({
    channelId: 'help',
    indexPayload: { schemaVersion: 1, contentVersion: '1.1.0', entries: [] },
    contentPayload: { pages: {}, tooltips: {} },
    effectiveAppVersion: '1.0.0',
    contentVersion: '1.1.0',
    schemaVersion: 1,
    attemptedAt,
    fetchedAt,
  })

  assert.equal(record.lastRefreshStatus, 'succeeded')
  assert.equal(record.freshnessStatus, 'fresh')
  assert.equal(record.lastDownloadAttemptAt?.toISOString(), attemptedAt.toISOString())
  assert.equal(record.fetchedAt?.toISOString(), fetchedAt.toISOString())
  assert.equal((await store.getLastValid('help'))?.contentVersion, '1.1.0')
})
