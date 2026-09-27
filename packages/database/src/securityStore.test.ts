import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Prisma } from './generated/prisma/client.js'
import {
  createSecurityStore,
  InvalidSecuritySymbolError,
  normalizeSecurityIdentity,
} from './securityStore.js'

const security = {
  id: 'security-a',
  organizationId: 'org-a',
  symbol: ' brk.a ',
  symbolNormalized: 'BRK.A',
  type: 'STOCK' as const,
  name: 'Berkshire Hathaway',
  description: null,
  exchange: ' nyse ',
  exchangeNormalized: 'NYSE',
  sector: null,
  industry: null,
  active: true,
  createdAt: new Date('2026-09-26T00:00:00.000Z'),
  updatedAt: new Date('2026-09-26T00:00:00.000Z'),
}

function knownError(code: string): Prisma.PrismaClientKnownRequestError {
  const error = Object.create(Prisma.PrismaClientKnownRequestError.prototype) as Prisma.PrismaClientKnownRequestError
  Object.assign(error, { code })
  return error
}

test('normalizes security identity with NFKC, whitespace trim, and uppercase', () => {
  assert.equal(normalizeSecurityIdentity(' Ａｂｃ  '), 'ABC')
  assert.equal(normalizeSecurityIdentity('  New  York '), 'NEW  YORK')
})

test('create preserves display values and derives normalized identity', async () => {
  let createInput: Record<string, unknown> | undefined
  const store = createSecurityStore({
    security: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createInput = data
        return security
      },
    },
  } as never)

  const result = await store.create({
    organizationId: 'org-a',
    symbol: ' brk.a ',
    type: 'STOCK',
    exchange: ' nyse ',
  })

  assert.equal(result.status, 'created')
  assert.equal(createInput?.symbol, ' brk.a ')
  assert.equal(createInput?.exchange, ' nyse ')
  assert.equal(createInput?.symbolNormalized, 'BRK.A')
  assert.equal(createInput?.exchangeNormalized, 'NYSE')
})

test('blank exchange uses one distinct normalized identity and duplicate conflicts are typed', async () => {
  let createCalls = 0
  const store = createSecurityStore({
    security: {
      create: async () => {
        createCalls += 1
        throw knownError('P2002')
      },
    },
  } as never)

  const result = await store.create({
    organizationId: 'org-a',
    symbol: ' AAPL ',
    type: 'STOCK',
    exchange: ' \t',
  })

  assert.deepEqual(result, { status: 'duplicate_identity' })
  assert.equal(createCalls, 1)
})

test('list scopes every query and applies search and filters', async () => {
  let listWhere: Record<string, unknown> | undefined
  const store = createSecurityStore({
    security: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        listWhere = where
        return [security]
      },
    },
  } as never)

  const result = await store.list({
    organizationId: 'org-a',
    search: 'Berk',
    active: true,
    type: 'STOCK',
    exchange: null,
  })

  assert.deepEqual(result, [security])
  assert.equal(listWhere?.organizationId, 'org-a')
  assert.equal(listWhere?.active, true)
  assert.equal(listWhere?.type, 'STOCK')
  assert.equal(listWhere?.exchangeNormalized, '')
  assert.deepEqual(listWhere?.OR, [
    { symbol: { contains: 'Berk', mode: 'insensitive' } },
    { name: { contains: 'Berk', mode: 'insensitive' } },
  ])
})

test('update and lifecycle operations do not cross organization boundaries', async () => {
  let updateManyWhere: Record<string, unknown> | undefined
  const store = createSecurityStore({
    security: {
      findFirst: async () => null,
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        updateManyWhere = where
        return { count: 0 }
      },
    },
  } as never)

  const updateResult = await store.update({
    organizationId: 'org-b',
    securityId: 'security-a',
    symbol: 'AAPL',
    type: 'STOCK',
  })
  const activeResult = await store.setActive({
    organizationId: 'org-b',
    securityId: 'security-a',
    active: false,
  })

  assert.deepEqual(updateResult, { status: 'not_found' })
  assert.deepEqual(activeResult, { status: 'not_found' })
  assert.deepEqual(updateManyWhere, { id: 'security-a', organizationId: 'org-b' })
})

test('delete maps restrictive reference failures and does not swallow unexpected failures', async () => {
  const blockedStore = createSecurityStore({
    security: {
      deleteMany: async () => {
        throw knownError('P2003')
      },
    },
  } as never)
  assert.deepEqual(
    await blockedStore.delete({ organizationId: 'org-a', securityId: 'security-a' }),
    { status: 'blocked_by_references' },
  )

  const unexpected = new Error('database unavailable')
  const failingStore = createSecurityStore({
    security: {
      deleteMany: async () => {
        throw unexpected
      },
    },
  } as never)
  await assert.rejects(
    failingStore.delete({ organizationId: 'org-a', securityId: 'security-a' }),
    unexpected,
  )
})

test('blank symbols are rejected before persistence', async () => {
  const store = createSecurityStore({ security: { create: async () => security } } as never)
  await assert.rejects(
    store.create({ organizationId: 'org-a', symbol: ' \u2003 ', type: 'STOCK' }),
    InvalidSecuritySymbolError,
  )
})

type SecurityRow = typeof security

function inMemoryPrisma(rows: SecurityRow[]) {
  const matches = (row: SecurityRow, where: Record<string, unknown>): boolean =>
    Object.entries(where).every(([key, value]) => row[key as keyof SecurityRow] === value)

  return {
    security: {
      count: async ({ where }: { where: Record<string, unknown> }) =>
        rows.filter((row) => matches(row, where)).length,
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        rows.find((row) => matches(row, where)) ?? null,
      findFirstOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
        const found = rows.find((row) => matches(row, where))
        if (!found) {
          throw knownError('P2025')
        }
        return found
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, unknown>
        data: Record<string, unknown>
      }) => {
        const targets = rows.filter((row) => matches(row, where))
        for (const target of targets) {
          Object.assign(target, data)
        }
        return { count: targets.length }
      },
    },
  }
}

test('count is organization scoped and excludes other organizations', async () => {
  const rows = [
    { ...security, id: 'security-a', organizationId: 'org-a' },
    { ...security, id: 'security-b', organizationId: 'org-a' },
    { ...security, id: 'security-c', organizationId: 'org-b' },
  ]
  const store = createSecurityStore(inMemoryPrisma(rows) as never)

  assert.equal(await store.count({ organizationId: 'org-a' }), 2)
  assert.equal(await store.count({ organizationId: 'org-b' }), 1)
  assert.equal(await store.count({ organizationId: 'org-c' }), 0)
})

test('update and setActive for another organization return not_found and leave the row untouched', async () => {
  const row = { ...security, id: 'security-a', organizationId: 'org-a', symbol: ' brk.a ', active: true }
  const store = createSecurityStore(inMemoryPrisma([row]) as never)

  const updateResult = await store.update({
    organizationId: 'org-b',
    securityId: 'security-a',
    symbol: 'HACK',
    type: 'ETF',
    name: 'Hijacked',
  })
  const activeResult = await store.setActive({
    organizationId: 'org-b',
    securityId: 'security-a',
    active: false,
  })

  assert.deepEqual(updateResult, { status: 'not_found' })
  assert.deepEqual(activeResult, { status: 'not_found' })
  assert.equal(row.symbol, ' brk.a ')
  assert.equal(row.symbolNormalized, 'BRK.A')
  assert.equal(row.type, 'STOCK')
  assert.equal(row.name, 'Berkshire Hathaway')
  assert.equal(row.active, true)
})

test('update within the owning organization writes and returns the scoped row', async () => {
  const row = { ...security, id: 'security-a', organizationId: 'org-a' }
  const store = createSecurityStore(inMemoryPrisma([row]) as never)

  const result = await store.update({
    organizationId: 'org-a',
    securityId: 'security-a',
    symbol: ' aapl ',
    type: 'STOCK',
    exchange: ' nasdaq ',
  })

  assert.equal(result.status, 'updated')
  assert.equal(row.symbol, ' aapl ')
  assert.equal(row.symbolNormalized, 'AAPL')
  assert.equal(row.exchangeNormalized, 'NASDAQ')
})

test('update maps duplicate identity conflicts and rethrows unexpected failures', async () => {
  const duplicateStore = createSecurityStore({
    security: {
      updateMany: async () => {
        throw knownError('P2002')
      },
    },
  } as never)
  assert.deepEqual(
    await duplicateStore.update({
      organizationId: 'org-a',
      securityId: 'security-a',
      symbol: 'AAPL',
      type: 'STOCK',
    }),
    { status: 'duplicate_identity' },
  )

  const unexpected = new Error('database unavailable')
  const failingStore = createSecurityStore({
    security: {
      updateMany: async () => {
        throw unexpected
      },
    },
  } as never)
  await assert.rejects(
    failingStore.update({
      organizationId: 'org-a',
      securityId: 'security-a',
      symbol: 'AAPL',
      type: 'STOCK',
    }),
    unexpected,
  )
})
