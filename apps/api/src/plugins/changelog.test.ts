import assert from 'node:assert/strict'
import { test } from 'node:test'
import fastifyJwt from '@fastify/jwt'
import Fastify, { type FastifyInstance } from 'fastify'
import type {
  ChangelogAcknowledgmentStore,
  HelpContentStore,
  HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import type { JwtPayload } from '@portfolio-engineering/shared-types/auth'
import {
  CHANGELOG_CHANNEL_ID,
  CHANGELOG_SOURCE_PATH,
  loadChangelogContent,
  validateChangelogMarkdown,
  type LoadedChangelog,
} from '../lib/changelogContent.js'
import { createChangelogRoutes } from './changelog.js'
import { refreshChangelog } from '../lib/helpRefresh.js'
import { HELP_SOURCE_BASE_URL } from '../lib/helpContent.js'

const jwtSecret = 'changelog-route-test-secret-which-is-long-enough'

interface TestState {
  readonly acknowledgments: Map<string, Set<string>>
  readonly readScopes: Array<{ organizationId: string; userId: string }>
  readonly writeScopes: Array<{
    organizationId: string
    userId: string
    sectionIdentities: string[]
  }>
  failReads: boolean
  failWrites: boolean
}

function scopeKey(organizationId: string, userId: string): string {
  return `${organizationId}\u0000${userId}`
}

function createState(): TestState {
  return {
    acknowledgments: new Map(),
    readScopes: [],
    writeScopes: [],
    failReads: false,
    failWrites: false,
  }
}

function createAcknowledgmentStore(state: TestState): ChangelogAcknowledgmentStore {
  return {
    async listAcknowledgedSectionIdentities(input) {
      state.readScopes.push(input)
      if (state.failReads) throw new Error('private database diagnostic')
      return [...(state.acknowledgments.get(scopeKey(input.organizationId, input.userId)) ?? [])]
    },
    async acknowledgeSections(input) {
      state.writeScopes.push(input)
      if (state.failWrites) throw new Error('private database diagnostic')
      const key = scopeKey(input.organizationId, input.userId)
      const existing = state.acknowledgments.get(key) ?? new Set<string>()
      for (const identity of input.sectionIdentities) existing.add(identity)
      state.acknowledgments.set(key, existing)
      return input.sectionIdentities.length
    },
  }
}

async function createBundledContent(): Promise<LoadedChangelog> {
  return loadChangelogContent({ getLastValid: async () => null })
}

async function buildApp(
  state: TestState,
  loadContent = createBundledContent,
  refresh?: () => ReturnType<typeof refreshChangelog>,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(fastifyJwt, { secret: jwtSecret })
  app.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify()
    } catch {
      reply.code(401)
      return reply.send({ message: 'Unauthorized.' })
    }
  })
  await app.register(createChangelogRoutes({
    acknowledgmentStore: createAcknowledgmentStore(state),
    contentStore: { getLastValid: async () => null },
    loadContent,
    ...(refresh ? { refresh } : {}),
  }))
  await app.ready()
  return app
}

function tokenFor(app: FastifyInstance, user: JwtPayload): string {
  return app.jwt.sign(user)
}

function authHeader(app: FastifyInstance, user: JwtPayload) {
  return { authorization: `Bearer ${tokenFor(app, user)}` }
}

function user(sub: string, organizationId: string): JwtPayload {
  return {
    sub,
    organizationId,
    email: `${sub}@example.test`,
    role: 'member',
  }
}

test('changelog content and acknowledgments require authentication', async () => {
  const app = await buildApp(createState())
  try {
    const read = await app.inject({ method: 'GET', url: '/api/changelog' })
    const acknowledge = await app.inject({
      method: 'POST',
      url: '/api/changelog/acknowledgments',
      payload: { contentVersion: '0'.repeat(64), sectionIdentities: ['### 2026-09-01'] },
    })
    const refresh = await app.inject({
      method: 'POST',
      url: '/api/changelog/refresh',
    })

    assert.equal(read.statusCode, 401)
    assert.equal(acknowledge.statusCode, 401)
    assert.equal(refresh.statusCode, 401)
  } finally {
    await app.close()
  }
})

function createRuntimeStore(initial: HelpRuntimeCacheRecord | null = null): {
  store: HelpContentStore
  getRecord: () => HelpRuntimeCacheRecord | null
  writeChannels: string[]
  attemptChannels: string[]
} {
  type PersistedJson = HelpRuntimeCacheRecord['indexPayload']
  type WritePayload = Parameters<HelpContentStore['writeValidatedPayload']>[0]

  function isPersistedJson(value: unknown): value is PersistedJson {
    if (
      value === null ||
      typeof value === 'string' ||
      typeof value === 'boolean' ||
      typeof value === 'number'
    ) {
      return true
    }
    if (Array.isArray(value)) return value.every(isPersistedJson)
    if (typeof value !== 'object') return false
    return Object.values(value).every(isPersistedJson)
  }

  function toPersistedJson(value: WritePayload['indexPayload']): PersistedJson {
    const serialized = JSON.stringify(value)
    if (serialized === undefined) {
      throw new Error('Expected a JSON-serializable runtime-content payload.')
    }
    const parsed: unknown = JSON.parse(serialized)
    if (!isPersistedJson(parsed)) {
      throw new Error('Runtime-content payload did not serialize to persisted JSON.')
    }
    return parsed
  }

  let record = initial
  const writeChannels: string[] = []
  const attemptChannels: string[] = []
  const store: HelpContentStore = {
    async get(channelId) {
      return record?.channelId === channelId ? record : null
    },
    async getLastValid(channelId) {
      if (
        !record ||
        record.channelId !== channelId ||
        record.indexPayload === null ||
        record.contentPayload === null ||
        record.contentVersion === null ||
        record.schemaVersion === null
      ) {
        return null
      }
      return record
    },
    async recordDownloadAttempt({ channelId, attemptedAt = new Date(), status }) {
      attemptChannels.push(channelId)
      const now = new Date()
      record = {
        id: record?.id ?? 'runtime-cache-test',
        channelId,
        indexPayload: record?.indexPayload ?? null,
        contentPayload: record?.contentPayload ?? null,
        effectiveAppVersion: record?.effectiveAppVersion ?? null,
        contentVersion: record?.contentVersion ?? null,
        schemaVersion: record?.schemaVersion ?? null,
        freshnessStatus: record?.contentPayload ? 'stale' : 'unavailable',
        lastRefreshStatus: status,
        fetchedAt: record?.fetchedAt ?? null,
        lastDownloadAttemptAt: attemptedAt,
        createdAt: record?.createdAt ?? now,
        updatedAt: now,
      }
      return record
    },
    async writeValidatedPayload(input) {
      writeChannels.push(input.channelId)
      const now = new Date()
      const writtenRecord: HelpRuntimeCacheRecord = {
        id: record?.id ?? 'runtime-cache-test',
        channelId: input.channelId,
        indexPayload: toPersistedJson(input.indexPayload),
        contentPayload: toPersistedJson(input.contentPayload),
        effectiveAppVersion: input.effectiveAppVersion,
        contentVersion: input.contentVersion,
        schemaVersion: input.schemaVersion,
        freshnessStatus: 'fresh',
        lastRefreshStatus: 'succeeded',
        fetchedAt: input.fetchedAt ?? now,
        lastDownloadAttemptAt: input.attemptedAt ?? now,
        createdAt: record?.createdAt ?? now,
        updatedAt: now,
      }
      record = writtenRecord
      return writtenRecord
    },
    async markFreshness({ freshnessStatus }) {
      if (record) record = { ...record, freshnessStatus }
      return record
    },
  }
  return {
    store,
    getRecord: () => record,
    writeChannels,
    attemptChannels,
  }
}

test('authenticated manual refresh stores the validated snapshot through the existing changelog channel store', async () => {
  const state = createState()
  const runtime = createRuntimeStore()
  const markdown = '### 2026-09-28\n\n- Published through manual refresh.\n'
  const requestedUrls: string[] = []
  const app = await buildApp(
    state,
    createBundledContent,
    () => refreshChangelog({
      store: runtime.store,
      fetcher: async (url) => {
        requestedUrls.push(url)
        return markdown
      },
    }),
  )
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/changelog/refresh',
      headers: authHeader(app, user('user-a', 'org-a')),
    })
    const record = runtime.getRecord()

    assert.equal(response.statusCode, 200)
    assert.equal(JSON.parse(response.payload).refreshStatus, 'succeeded')
    assert.equal(JSON.parse(response.payload).freshness, 'fresh')
    assert.ok(record)
    assert.equal(record.channelId, CHANGELOG_CHANNEL_ID)
    assert.deepEqual(record.contentPayload, {
      markdown,
      sectionIdentities: ['### 2026-09-28'],
    })
    assert.deepEqual(record.indexPayload, {
      schemaVersion: 1,
      contentVersion: record.contentVersion,
      sourcePath: CHANGELOG_SOURCE_PATH,
    })
    assert.deepEqual(requestedUrls, [`${HELP_SOURCE_BASE_URL}${CHANGELOG_SOURCE_PATH}`])
    assert.deepEqual(runtime.writeChannels, [CHANGELOG_CHANNEL_ID])
    assert.deepEqual(runtime.attemptChannels, [])
  } finally {
    await app.close()
  }
})

test('failed and invalid manual refreshes report status while preserving last-valid content', async () => {
  const state = createState()
  const runtime = createRuntimeStore()
  const originalMarkdown = '### 2026-09-28\n\n- Previously valid release.\n'
  let remoteResponse:
    | { kind: 'markdown'; markdown: string }
    | { kind: 'failure' } = { kind: 'markdown', markdown: originalMarkdown }
  const requestedUrls: string[] = []
  const app = await buildApp(
    state,
    createBundledContent,
    () => refreshChangelog({
      store: runtime.store,
      fetcher: async (url) => {
        requestedUrls.push(url)
        if (remoteResponse.kind === 'failure') throw new Error('remote unavailable')
        return remoteResponse.markdown
      },
    }),
  )
  try {
    const headers = authHeader(app, user('user-a', 'org-a'))
    const callRefresh = () => app.inject({
      method: 'POST',
      url: '/api/changelog/refresh',
      headers,
    })

    const successful = await callRefresh()
    assert.equal(successful.statusCode, 200)
    const validRecord = runtime.getRecord()
    assert.ok(validRecord)
    assert.deepEqual(validRecord.contentPayload, {
      markdown: originalMarkdown,
      sectionIdentities: ['### 2026-09-28'],
    })

    remoteResponse = { kind: 'failure' }
    const failed = await callRefresh()
    assert.equal(failed.statusCode, 200)
    const failedBody = JSON.parse(failed.payload)
    assert.equal(failedBody.freshness, 'stale')
    assert.equal(failedBody.refreshStatus, 'failed')
    assert.equal(failedBody.fetchedAt, validRecord.fetchedAt?.toISOString() ?? null)
    assert.equal(typeof failedBody.lastDownloadAttemptAt, 'string')
    assert.deepEqual(runtime.getRecord()?.contentPayload, validRecord.contentPayload)
    assert.equal((await loadChangelogContent(runtime.store)).markdown, originalMarkdown)

    remoteResponse = {
      kind: 'markdown',
      markdown: '### 2026-02-30\n\n- Invalid date.\n',
    }
    const invalid = await callRefresh()
    assert.equal(invalid.statusCode, 200)
    const invalidBody = JSON.parse(invalid.payload)
    assert.equal(invalidBody.freshness, 'stale')
    assert.equal(invalidBody.refreshStatus, 'invalid')
    assert.equal(invalidBody.fetchedAt, validRecord.fetchedAt?.toISOString() ?? null)
    assert.equal(typeof invalidBody.lastDownloadAttemptAt, 'string')
    assert.deepEqual(runtime.getRecord()?.contentPayload, validRecord.contentPayload)
    assert.equal((await loadChangelogContent(runtime.store)).markdown, originalMarkdown)
    assert.deepEqual(requestedUrls, Array(3).fill(`${HELP_SOURCE_BASE_URL}${CHANGELOG_SOURCE_PATH}`))
    assert.deepEqual(runtime.writeChannels, [CHANGELOG_CHANNEL_ID])
    assert.deepEqual(runtime.attemptChannels, [CHANGELOG_CHANNEL_ID, CHANGELOG_CHANNEL_ID])
  } finally {
    await app.close()
  }
})

test('returns matching validated Markdown, identities, freshness metadata, and active-user unread state', async () => {
  const state = createState()
  const app = await buildApp(state)
  const activeUser = user('user-a', 'org-a')
  try {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    assert.equal(initial.statusCode, 200)
    const initialBody = JSON.parse(initial.payload)
    assert.deepEqual(
      initialBody.sectionIdentities,
      validateChangelogMarkdown(initialBody.markdown).sectionIdentities,
    )
    assert.equal(initialBody.contentVersion, initialBody.metadata.contentVersion)
    assert.equal(initialBody.metadata.source, 'bundled')
    assert.equal(initialBody.metadata.freshness, 'unavailable')
    assert.deepEqual(initialBody.unreadSectionIdentities, initialBody.sectionIdentities)

    const firstIdentity = initialBody.sectionIdentities[0] as string
    state.acknowledgments.set(scopeKey('org-a', 'user-a'), new Set([firstIdentity]))
    const afterAcknowledgment = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    const afterBody = JSON.parse(afterAcknowledgment.payload)
    assert.equal(afterAcknowledgment.statusCode, 200)
    assert.deepEqual(
      afterBody.unreadSectionIdentities,
      initialBody.sectionIdentities.filter((identity: string) => identity !== firstIdentity),
    )
    assert.deepEqual(state.readScopes.at(-1), { organizationId: 'org-a', userId: 'user-a' })
  } finally {
    await app.close()
  }
})

test('returns cached freshness and source metadata with the validated snapshot', async () => {
  const state = createState()
  const bundled = await createBundledContent()
  const fetchedAt = new Date('2026-09-28T12:00:00.000Z')
  const app = await buildApp(state, async () => ({
    ...bundled,
    source: { kind: 'cache', fetchedAt },
    metadata: {
      freshness: 'stale',
      refreshStatus: 'failed',
      fetchedAt,
      lastDownloadAttemptAt: fetchedAt,
    },
  }))
  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, user('user-a', 'org-a')),
    })

    assert.equal(response.statusCode, 200)
    assert.deepEqual(JSON.parse(response.payload).metadata, {
      source: 'cache',
      freshness: 'stale',
      refreshStatus: 'failed',
      contentVersion: bundled.contentVersion,
      fetchedAt: fetchedAt.toISOString(),
      lastDownloadAttemptAt: fetchedAt.toISOString(),
    })
  } finally {
    await app.close()
  }
})

test('acknowledgments are isolated by both verified user and organization scope', async () => {
  const state = createState()
  const app = await buildApp(state)
  try {
    const responseA = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, user('user-a', 'org-a')),
    })
    const bodyA = JSON.parse(responseA.payload)
    const firstIdentity = bodyA.sectionIdentities[0] as string
    const acknowledge = async (principal: JwtPayload) =>
      app.inject({
        method: 'POST',
        url: '/api/changelog/acknowledgments',
        headers: authHeader(app, principal),
        payload: {
          contentVersion: bodyA.contentVersion,
          sectionIdentities: [firstIdentity],
        },
      })

    assert.equal((await acknowledge(user('user-a', 'org-a'))).statusCode, 200)

    for (const principal of [user('user-b', 'org-a'), user('user-a', 'org-b')]) {
      const isolated = await app.inject({
        method: 'GET',
        url: '/api/changelog',
        headers: authHeader(app, principal),
      })
      const isolatedBody = JSON.parse(isolated.payload)
      assert.ok(isolatedBody.unreadSectionIdentities.includes(firstIdentity))
    }

    assert.deepEqual(state.writeScopes, [{
      organizationId: 'org-a',
      userId: 'user-a',
      sectionIdentities: [firstIdentity],
    }])
  } finally {
    await app.close()
  }
})

test('rejects malformed, unknown, and stale-snapshot identities before writing', async () => {
  const state = createState()
  const app = await buildApp(state)
  const activeUser = user('user-a', 'org-a')
  try {
    const contentResponse = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    const content = JSON.parse(contentResponse.payload)
    const request = (contentVersion: string, sectionIdentities: string[]) =>
      app.inject({
        method: 'POST',
        url: '/api/changelog/acknowledgments',
        headers: authHeader(app, activeUser),
        payload: { contentVersion, sectionIdentities },
      })

    const malformed = await request(content.contentVersion, ['### 2026-02-30'])
    const unknown = await request(content.contentVersion, ['### 2000-01-01'])
    const mismatch = await request('f'.repeat(64), [content.sectionIdentities[0]])
    const clientScope = await app.inject({
      method: 'POST',
      url: '/api/changelog/acknowledgments',
      headers: authHeader(app, activeUser),
      payload: {
        contentVersion: content.contentVersion,
        sectionIdentities: [content.sectionIdentities[0]],
        organizationId: 'org-b',
        userId: 'user-b',
      },
    })

    assert.equal(malformed.statusCode, 400)
    assert.equal(unknown.statusCode, 400)
    assert.equal(JSON.parse(unknown.payload).code, 'VALIDATION_ERROR')
    assert.equal(mismatch.statusCode, 409)
    assert.equal(JSON.parse(mismatch.payload).code, 'SNAPSHOT_MISMATCH')
    assert.equal(clientScope.statusCode, 400)
    assert.equal(state.writeScopes.length, 0)
  } finally {
    await app.close()
  }
})

test('duplicate and concurrent acknowledgments succeed idempotently', async () => {
  const state = createState()
  const app = await buildApp(state)
  const activeUser = user('user-a', 'org-a')
  try {
    const contentResponse = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    const content = JSON.parse(contentResponse.payload)
    const identity = content.sectionIdentities[0] as string
    const acknowledge = () =>
      app.inject({
        method: 'POST',
        url: '/api/changelog/acknowledgments',
        headers: authHeader(app, activeUser),
        payload: {
          contentVersion: content.contentVersion,
          sectionIdentities: [identity, identity],
        },
      })

    const responses = await Promise.all([acknowledge(), acknowledge()])
    assert.deepEqual(responses.map((response) => response.statusCode), [200, 200])
    assert.deepEqual([...state.acknowledgments.get(scopeKey('org-a', 'user-a')) ?? []], [identity])
    assert.deepEqual(state.writeScopes.map((input) => input.sectionIdentities), [[identity], [identity]])
    for (const response of responses) {
      assert.deepEqual(JSON.parse(response.payload).acknowledgedSectionIdentities, [identity])
    }
  } finally {
    await app.close()
  }
})

test('returns safe persistence failures without exposing another user or database diagnostics', async () => {
  const state = createState()
  const app = await buildApp(state)
  const activeUser = user('user-a', 'org-a')
  try {
    state.failReads = true
    const read = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    assert.equal(read.statusCode, 503)
    assert.deepEqual(JSON.parse(read.payload), {
      code: 'PERSISTENCE_ERROR',
      message: 'Changelog reading status is temporarily unavailable.',
    })
    assert.equal(read.payload.includes('private database diagnostic'), false)

    state.failReads = false
    state.failWrites = true
    const contentResponse = await app.inject({
      method: 'GET',
      url: '/api/changelog',
      headers: authHeader(app, activeUser),
    })
    const content = JSON.parse(contentResponse.payload)
    const write = await app.inject({
      method: 'POST',
      url: '/api/changelog/acknowledgments',
      headers: authHeader(app, activeUser),
      payload: {
        contentVersion: content.contentVersion,
        sectionIdentities: [content.sectionIdentities[0]],
      },
    })
    assert.equal(write.statusCode, 503)
    assert.deepEqual(JSON.parse(write.payload), {
      code: 'PERSISTENCE_ERROR',
      message: 'Changelog reading status could not be saved.',
    })
    assert.equal(write.payload.includes('private database diagnostic'), false)
  } finally {
    await app.close()
  }
})
