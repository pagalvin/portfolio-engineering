import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createChangelogAcknowledgmentStore,
  type ChangelogAcknowledgmentPrisma,
} from './changelogAcknowledgmentStore.js'

function createMockPrisma() {
  const records = new Map<string, { organizationId: string; userId: string; sectionIdentity: string }>()
  const readScopes: Array<{ organizationId: string; userId: string }> = []
  const writeRows: Array<{ organizationId: string; userId: string; sectionIdentity: string }> = []

  const prisma: ChangelogAcknowledgmentPrisma = {
    changelogAcknowledgment: {
      findMany: async ({ where }) => {
        readScopes.push(where)
        return [...records.values()]
          .filter(
            (record) =>
              record.organizationId === where.organizationId &&
              record.userId === where.userId,
          )
          .map(({ sectionIdentity }) => ({ sectionIdentity }))
          .sort((left, right) => left.sectionIdentity.localeCompare(right.sectionIdentity))
      },
      createMany: async ({ data }) => {
        let count = 0
        for (const record of data) {
          writeRows.push(record)
          const key = `${record.organizationId}\u0000${record.userId}\u0000${record.sectionIdentity}`
          if (!records.has(key)) {
            records.set(key, record)
            count++
          }
        }
        return { count }
      },
    },
  }

  return { prisma, readScopes, writeRows }
}

test('changelog acknowledgments read only the requested organization and user', async () => {
  const { prisma, readScopes } = createMockPrisma()
  const store = createChangelogAcknowledgmentStore(prisma)

  await store.acknowledgeSections({
    organizationId: 'org-1',
    userId: 'user-1',
    sectionIdentities: ['## 2026-09-01'],
  })
  await store.acknowledgeSections({
    organizationId: 'org-1',
    userId: 'user-2',
    sectionIdentities: ['## 2026-09-02'],
  })
  await store.acknowledgeSections({
    organizationId: 'org-2',
    userId: 'user-1',
    sectionIdentities: ['## 2026-09-03'],
  })

  assert.deepEqual(
    await store.listAcknowledgedSectionIdentities({
      organizationId: 'org-1',
      userId: 'user-1',
    }),
    ['## 2026-09-01'],
  )
  assert.deepEqual(readScopes, [{ organizationId: 'org-1', userId: 'user-1' }])
})

test('changelog acknowledgments write both scope fields and isolate users and organizations', async () => {
  const { prisma, writeRows } = createMockPrisma()
  const store = createChangelogAcknowledgmentStore(prisma)

  await store.acknowledgeSections({
    organizationId: 'org-1',
    userId: 'user-1',
    sectionIdentities: ['## 2026-09-01'],
  })
  await store.acknowledgeSections({
    organizationId: 'org-1',
    userId: 'user-2',
    sectionIdentities: ['## 2026-09-02'],
  })
  await store.acknowledgeSections({
    organizationId: 'org-2',
    userId: 'user-1',
    sectionIdentities: ['## 2026-09-03'],
  })

  assert.deepEqual(writeRows, [
    { organizationId: 'org-1', userId: 'user-1', sectionIdentity: '## 2026-09-01' },
    { organizationId: 'org-1', userId: 'user-2', sectionIdentity: '## 2026-09-02' },
    { organizationId: 'org-2', userId: 'user-1', sectionIdentity: '## 2026-09-03' },
  ])
  assert.deepEqual(
    await store.listAcknowledgedSectionIdentities({
      organizationId: 'org-1',
      userId: 'user-2',
    }),
    ['## 2026-09-02'],
  )
  assert.deepEqual(
    await store.listAcknowledgedSectionIdentities({
      organizationId: 'org-2',
      userId: 'user-1',
    }),
    ['## 2026-09-03'],
  )
})

test('duplicate and concurrent changelog acknowledgments merge idempotently', async () => {
  const { prisma } = createMockPrisma()
  const store = createChangelogAcknowledgmentStore(prisma)

  const results = await Promise.all([
    store.acknowledgeSections({
      organizationId: 'org-1',
      userId: 'user-1',
      sectionIdentities: ['## 2026-09-01', '## 2026-09-02'],
    }),
    store.acknowledgeSections({
      organizationId: 'org-1',
      userId: 'user-1',
      sectionIdentities: ['## 2026-09-02', '## 2026-09-03'],
    }),
    store.acknowledgeSections({
      organizationId: 'org-1',
      userId: 'user-1',
      sectionIdentities: ['## 2026-09-01'],
    }),
  ])

  assert.equal(results.reduce((total, count) => total + count, 0), 3)
  assert.deepEqual(
    await store.listAcknowledgedSectionIdentities({
      organizationId: 'org-1',
      userId: 'user-1',
    }),
    ['## 2026-09-01', '## 2026-09-02', '## 2026-09-03'],
  )
})

test('changelog acknowledgments reject empty identities and no-op on an empty set', async () => {
  const { prisma } = createMockPrisma()
  const store = createChangelogAcknowledgmentStore(prisma)

  await assert.rejects(
    store.acknowledgeSections({
      organizationId: 'org-1',
      userId: 'user-1',
      sectionIdentities: [''],
    }),
    /must not be empty/,
  )
  assert.equal(
    await store.acknowledgeSections({
      organizationId: 'org-1',
      userId: 'user-1',
      sectionIdentities: [],
    }),
    0,
  )
})
