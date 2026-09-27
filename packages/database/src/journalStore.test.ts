import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createJournalStore } from './journalStore.js'

const entry = {
  id: 'entry-a',
  organizationId: 'org-a',
  userId: 'user-a',
  localDate: new Date('2026-09-05T00:00:00.000Z'),
  content: 'Original entry',
  createdAt: new Date('2026-09-05T12:00:00.000Z'),
  updatedAt: new Date('2026-09-05T12:00:00.000Z'),
}

type JournalRow = typeof entry

function createPrismaDouble(rows: JournalRow[]) {
  const updateWhereCalls: Array<Record<string, unknown>> = []
  const deleteWhereCalls: Array<Record<string, unknown>> = []
  const matches = (row: JournalRow, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => {
      const rowValue = row[key as keyof JournalRow]
      return rowValue instanceof Date && value instanceof Date
        ? rowValue.getTime() === value.getTime()
        : rowValue === value
    })
  const model = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      const matched = rows.find((row) => matches(row, where))
      if (matched) {
        return matched
      }
      return typeof where.id === 'string'
        ? rows.find((row) => row.id === where.id) ?? null
        : null
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }) => {
      updateWhereCalls.push(where)
      const targets = rows.filter((row) => matches(row, where))
      for (const target of targets) {
        Object.assign(target, data)
      }
      return { count: targets.length }
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      deleteWhereCalls.push(where)
      const targets = rows.filter((row) => matches(row, where))
      for (const target of targets) {
        rows.splice(rows.indexOf(target), 1)
      }
      return { count: targets.length }
    },
    update: async ({
      where,
      data,
    }: {
      where: Record<string, unknown>
      data: Record<string, unknown>
    }) => {
      const target = rows.find((row) => row.id === where.id)
      if (!target) {
        throw new Error('Record not found')
      }
      Object.assign(target, data)
      return target
    },
    delete: async ({ where }: { where: Record<string, unknown> }) => {
      const index = rows.findIndex((row) => row.id === where.id)
      if (index === -1) {
        throw new Error('Record not found')
      }
      return rows.splice(index, 1)[0]
    },
  }
  const client = { journalEntry: model }
  const prisma = {
    ...client,
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>) => callback(client),
  }

  return { prisma, updateWhereCalls, deleteWhereCalls }
}

const unauthorizedScopes = [
  { organizationId: 'org-b', userId: 'user-a' },
  { organizationId: 'org-a', userId: 'user-b' },
]

test('updateEntry scopes the write by organization and user', async () => {
  for (const scope of unauthorizedScopes) {
    const row = { ...entry }
    const before = { ...row }
    const { prisma, updateWhereCalls } = createPrismaDouble([row])

    const result = await createJournalStore(prisma as never).updateEntry({
      ...scope,
      entryId: row.id,
      content: 'Unauthorized change',
    })

    assert.equal(result, null)
    assert.deepEqual(updateWhereCalls, [{ id: row.id, ...scope }])
    assert.deepEqual(row, before)
  }
})

test('moveEntry scopes the write by organization and user and preserves not-found behavior', async () => {
  for (const scope of unauthorizedScopes) {
    const row = { ...entry }
    const before = { ...row }
    const { prisma, updateWhereCalls } = createPrismaDouble([row])

    await assert.rejects(
      createJournalStore(prisma as never).moveEntry({
        ...scope,
        entryId: row.id,
        targetLocalDate: '2026-09-06',
      }),
      { message: 'Entry not found' },
    )

    assert.deepEqual(updateWhereCalls, [{ id: row.id, ...scope }])
    assert.deepEqual(row, before)
  }
})

test('deleteEntry scopes the delete by organization and user', async () => {
  for (const scope of unauthorizedScopes) {
    const row = { ...entry }
    const before = { ...row }
    const { prisma, deleteWhereCalls } = createPrismaDouble([row])

    const result = await createJournalStore(prisma as never).deleteEntry({
      ...scope,
      entryId: row.id,
    })

    assert.equal(result, null)
    assert.deepEqual(deleteWhereCalls, [{ id: row.id, ...scope }])
    assert.deepEqual(row, before)
  }
})

test('Journal mutations preserve successful results and move conflicts', async () => {
  const updateRow = { ...entry }
  const updatePrisma = createPrismaDouble([updateRow]).prisma
  const updated = await createJournalStore(updatePrisma as never).updateEntry({
    organizationId: entry.organizationId,
    userId: entry.userId,
    entryId: entry.id,
    content: 'Updated entry',
  })
  assert.equal(updated?.content, 'Updated entry')

  const moveRow = { ...entry }
  const movePrisma = createPrismaDouble([moveRow]).prisma
  const moved = await createJournalStore(movePrisma as never).moveEntry({
    organizationId: entry.organizationId,
    userId: entry.userId,
    entryId: entry.id,
    targetLocalDate: '2026-09-06',
  })
  assert.equal(moved.ok, true)
  if (moved.ok) {
    assert.equal(moved.entry.localDate.toISOString(), '2026-09-06T00:00:00.000Z')
  }

  const conflictRow = { ...entry }
  const destination = { ...entry, id: 'entry-b', localDate: new Date('2026-09-06T00:00:00.000Z') }
  const { prisma: conflictPrisma, updateWhereCalls } = createPrismaDouble([conflictRow, destination])
  const conflict = await createJournalStore(conflictPrisma as never).moveEntry({
    organizationId: entry.organizationId,
    userId: entry.userId,
    entryId: entry.id,
    targetLocalDate: '2026-09-06',
  })
  assert.deepEqual(conflict, {
    ok: false,
    reason: 'ENTRY_EXISTS',
    localDate: '2026-09-06',
  })
  assert.deepEqual(updateWhereCalls, [])

  const deleteRow = { ...entry }
  const { prisma: deletePrisma } = createPrismaDouble([deleteRow])
  const deleted = await createJournalStore(deletePrisma as never).deleteEntry({
    organizationId: entry.organizationId,
    userId: entry.userId,
    entryId: entry.id,
  })
  assert.deepEqual(deleted, deleteRow)
})
