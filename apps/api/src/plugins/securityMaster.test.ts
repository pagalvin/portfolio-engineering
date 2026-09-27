import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import { test } from 'node:test'
import type {
  Security,
  SecurityDeleteResult,
  SecurityListInput,
  SecurityStore,
  SecurityWriteResult,
} from '@portfolio-engineering/database'
import type { JwtPayload } from '@portfolio-engineering/shared-types/auth'
import { createSecurityMasterRoutes } from './securityMaster.js'

const authUser: JwtPayload = {
  sub: 'user-a',
  email: 'user-a@example.test',
  organizationId: 'org-a',
  role: 'member',
}

function security(overrides: Partial<Security> = {}): Security {
  const now = new Date('2026-09-26T00:00:00.000Z')
  return {
    id: 'security-a',
    organizationId: 'org-a',
    symbol: 'AAPL',
    symbolNormalized: 'AAPL',
    type: 'STOCK',
    name: 'Apple',
    description: null,
    exchange: 'NASDAQ',
    exchangeNormalized: 'NASDAQ',
    sector: null,
    industry: null,
    active: true,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

interface TestState {
  records: Security[]
  listInputs: SecurityListInput[]
  lastActiveInput: Record<string, unknown> | undefined
  deleteResult: SecurityDeleteResult
  createResult: SecurityWriteResult
  updateResult: SecurityWriteResult
  activeResult: SecurityWriteResult
}

function createState(): TestState {
  const record = security()
  return {
    records: [record],
    listInputs: [],
    lastActiveInput: undefined,
    deleteResult: { status: 'deleted' },
    createResult: { status: 'created', security: record },
    updateResult: { status: 'updated', security: record },
    activeResult: { status: 'updated', security: record },
  }
}

async function buildApp(state: TestState): Promise<FastifyInstance> {
  const store: SecurityStore = {
    async create() {
      return state.createResult
    },
    async list(input) {
      state.listInputs.push(input)
      return state.records.filter((record) => record.organizationId === input.organizationId)
    },
    async count(input) {
      return state.records.filter((record) => record.organizationId === input.organizationId).length
    },
    async find(input) {
      return state.records.find(
        (record) =>
          record.id === input.securityId &&
          record.organizationId === input.organizationId,
      ) ?? null
    },
    async update() {
      return state.updateResult
    },
    async setActive(input) {
      state.lastActiveInput = input
      return state.activeResult
    },
    async delete() {
      return state.deleteResult
    },
  }

  const app = Fastify({ logger: false })
  app.addHook('onRequest', async (request) => {
    request.user = authUser
  })
  await app.register(createSecurityMasterRoutes({ securityStore: store }))
  return app
}

test('lists only the verified organization and passes URL filters to the store', async () => {
  const state = createState()
  state.records.push(security({ id: 'security-b', organizationId: 'org-b', symbol: 'MSFT' }))
  const app = await buildApp(state)

  const response = await app.inject({
    method: 'GET',
    url: '/api/securities?q=app&status=inactive&type=STOCK&exchange=NASDAQ',
  })

  assert.equal(response.statusCode, 200)
  assert.deepEqual(JSON.parse(response.payload).securities.map((item: { id: string }) => item.id), ['security-a'])
  assert.equal(JSON.parse(response.payload).totalCount, 1)
  assert.deepEqual(state.listInputs[0], {
    organizationId: 'org-a',
    search: 'app',
    active: false,
    type: 'STOCK',
    exchange: 'NASDAQ',
  })
  await app.close()
})

test('rejects repeated and unknown list query parameters', async () => {
  const state = createState()
  const app = await buildApp(state)

  const repeated = await app.inject({
    method: 'GET',
    url: '/api/securities?status=active&status=inactive',
  })
  const unknown = await app.inject({
    method: 'GET',
    url: '/api/securities?unexpected=value',
  })

  assert.equal(repeated.statusCode, 400)
  assert.equal(unknown.statusCode, 400)
  assert.equal(state.listInputs.length, 0)
  await app.close()
})

test('does not reveal a same-ID record owned by another organization', async () => {
  const state = createState()
  state.records = [security({ organizationId: 'org-b' })]
  const app = await buildApp(state)

  const response = await app.inject({
    method: 'GET',
    url: '/api/securities/security-a',
  })

  assert.equal(response.statusCode, 404)
  assert.deepEqual(JSON.parse(response.payload), {
    code: 'SECURITY_NOT_FOUND',
    message: 'Security not found.',
  })
  await app.close()
})

test('maps duplicate create, lifecycle, and blocked delete outcomes', async () => {
  const state = createState()
  const app = await buildApp(state)

  const created = await app.inject({
    method: 'POST',
    url: '/api/securities',
    payload: { symbol: 'MSFT', name: 'Microsoft' },
  })
  assert.equal(created.statusCode, 201)
  assert.equal(JSON.parse(created.payload).security.id, 'security-a')

  const updated = await app.inject({
    method: 'PUT',
    url: '/api/securities/security-a',
    payload: { symbol: 'AAPL', name: 'Updated Apple' },
  })
  assert.equal(updated.statusCode, 200)
  assert.equal(JSON.parse(updated.payload).security.id, 'security-a')

  state.createResult = { status: 'duplicate_identity' }
  const duplicate = await app.inject({
    method: 'POST',
    url: '/api/securities',
    payload: { symbol: 'AAPL' },
  })
  assert.equal(duplicate.statusCode, 409)
  assert.equal(JSON.parse(duplicate.payload).code, 'SECURITY_DUPLICATE_IDENTITY')

  const deactivate = await app.inject({
    method: 'POST',
    url: '/api/securities/security-a/deactivate',
  })
  assert.equal(deactivate.statusCode, 200)
  assert.deepEqual(state.lastActiveInput, {
    organizationId: 'org-a',
    securityId: 'security-a',
    active: false,
  })

  const activate = await app.inject({
    method: 'POST',
    url: '/api/securities/security-a/activate',
  })
  assert.equal(activate.statusCode, 200)
  assert.deepEqual(state.lastActiveInput, {
    organizationId: 'org-a',
    securityId: 'security-a',
    active: true,
  })

  state.deleteResult = { status: 'blocked_by_references' }
  const deletion = await app.inject({
    method: 'DELETE',
    url: '/api/securities/security-a',
  })
  assert.equal(deletion.statusCode, 409)
  assert.equal(JSON.parse(deletion.payload).code, 'SECURITY_BLOCKED_BY_REFERENCES')

  state.deleteResult = { status: 'deleted' }
  const deleted = await app.inject({
    method: 'DELETE',
    url: '/api/securities/security-a',
  })
  assert.equal(deleted.statusCode, 200)
  assert.deepEqual(JSON.parse(deleted.payload), {
    success: true,
    deletedSecurityId: 'security-a',
  })
  await app.close()
})

test('preserves unexpected store failures', async () => {
  const state = createState()
  const app = await buildApp(state)
  const failure = new Error('database unavailable')
  state.listInputs = []
  const storeErrorApp = Fastify({ logger: false })
  storeErrorApp.addHook('onRequest', async (request) => {
    request.user = authUser
  })
  await storeErrorApp.register(createSecurityMasterRoutes({
    securityStore: {
      async create() {
        throw failure
      },
      async list() {
        throw failure
      },
      async count() {
        throw failure
      },
      async find() {
        throw failure
      },
      async update() {
        throw failure
      },
      async setActive() {
        throw failure
      },
      async delete() {
        throw failure
      },
    },
  }))

  const response = await storeErrorApp.inject({
    method: 'GET',
    url: '/api/securities',
  })

  assert.equal(response.statusCode, 500)
  await app.close()
  await storeErrorApp.close()
})
