import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import { test } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import Fastify, { type FastifyInstance } from 'fastify'
import type {
  ProviderDefinition,
  StreamTextEvent,
} from '@portfolio-engineering/ai'
import type { SafeAiConnectionRecord } from '@portfolio-engineering/database'
import type { JwtPayload } from '@portfolio-engineering/shared-types/auth'
import {
  JOURNAL_ANALYSIS_LIMITS,
  reserveJournalAnalysisSlot,
  resetJournalAnalysisLimitState,
} from '../lib/journalAnalysisLimits.js'
import { createJournalAnalysisRoutes } from './journalAnalysis.js'

const analysisInput = {
  organizationId: 'org-a',
  userId: 'user-a',
  entryId: 'entry-a',
  connectionId: 'connection-a',
}

test.beforeEach(() => {
  resetJournalAnalysisLimitState()
})

interface JsonErrorResponse {
  readonly code: string
  readonly message: string
}

interface ParsedSseEvent {
  readonly event: string
  readonly data: {
    readonly type: string
    readonly text?: string
    readonly code?: string
    readonly message?: string
  }
}

interface StoreLookupInput {
  readonly organizationId: string
  readonly userId?: string
  readonly entryId?: string
  readonly connectionId?: string
}

interface TestEntry {
  readonly localDate: Date
  readonly content: string
}

interface TestState {
  readonly entryLookups: StoreLookupInput[]
  readonly connectionLookups: StoreLookupInput[]
  readonly decryptCalls: StoreLookupInput[]
  readonly limitCalls: StoreLookupInput[]
  readonly adapterConfigs: Record<string, unknown>[]
  readonly prompts: string[]
  readonly streamConnectionIds: string[]
  readonly maxOutputTokens: number[]
  entry: TestEntry | null
  connection: SafeAiConnectionRecord | null
  providerDefinition: ProviderDefinition | undefined
  secretPayload: Record<string, unknown> | string
  limitResult: { readonly allowed: true } | {
    readonly allowed: false
    readonly reason: 'minimum_interval' | 'organization_limit'
    readonly retryAt: Date
  }
  streamEvents: StreamTextEvent[]
  streamError: Error | null
  streamSignal: AbortSignal | null
}

const authUser: JwtPayload = {
  sub: 'user-a',
  email: 'user-a@example.test',
  organizationId: 'org-a',
  role: 'member',
}

function createConnection(
  overrides: Partial<SafeAiConnectionRecord> = {},
): SafeAiConnectionRecord {
  const now = new Date('2026-09-05T12:00:00.000Z')

  return {
    id: 'connection-a',
    organizationId: 'org-a',
    providerId: 'test-provider',
    label: 'Test Provider',
    enabled: true,
    configPayload: {
      schemaVersion: 1,
      model: 'test-model',
    },
    lastTestedAt: now,
    lastTestStatus: 'success',
    lastTestFailureKind: null,
    lastTestErrorSummary: null,
    consecutiveFailureCount: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function createTestState(
  overrides: Partial<TestState> = {},
): TestState {
  const state: TestState = {
    entryLookups: [],
    connectionLookups: [],
    decryptCalls: [],
    limitCalls: [],
    adapterConfigs: [],
    prompts: [],
    streamConnectionIds: [],
    maxOutputTokens: [],
    entry: {
      localDate: new Date('2026-09-05T00:00:00.000Z'),
      content: 'private journal content',
    },
    connection: createConnection(),
    providerDefinition: undefined,
    secretPayload: { apiKey: 'secret-token' },
    limitResult: { allowed: true },
    streamEvents: [
      { type: 'chunk', text: 'Analysis chunk.' },
      { type: 'done' },
    ],
    streamError: null,
    streamSignal: null,
    ...overrides,
  }

  state.providerDefinition ??= createProviderDefinition(state)

  return state
}

function createProviderDefinition(state: TestState): ProviderDefinition {
  return {
    id: 'test-provider',
    displayName: 'Test Provider',
    fields: [],
    isUsable: true,
    adapterFactory: (config) => {
      state.adapterConfigs.push(config)

      return {
        async *streamText(
          prompt: string,
          options: {
            readonly connectionId: string
            readonly signal: AbortSignal
            readonly maxOutputTokens: number
          },
        ): AsyncGenerator<StreamTextEvent> {
          state.prompts.push(prompt)
          state.streamConnectionIds.push(options.connectionId)
          state.maxOutputTokens.push(options.maxOutputTokens)
          state.streamSignal = options.signal

          if (state.streamError) {
            throw state.streamError
          }

          yield* state.streamEvents
        },
      }
    },
  }
}

async function buildRouteTestApp(state: TestState): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  app.addHook('onRequest', async (request) => {
    request.user = authUser
  })

  await app.register(createJournalAnalysisRoutes({
    journalStore: {
      async getEntryById(input) {
        state.entryLookups.push(input)
        return state.entry
      },
    },
    aiConnectionStore: {
      async findById(input) {
        state.connectionLookups.push(input)
        return state.connection
      },
      async decryptSecretForInvocation(input) {
        state.decryptCalls.push(input)
        return state.secretPayload
      },
    },
    getProviderDefinition(providerId) {
      assert.equal(providerId, state.connection?.providerId ?? 'test-provider')
      return state.providerDefinition
    },
    reserveJournalAnalysisSlot(input) {
      state.limitCalls.push(input)
      return state.limitResult
    },
  }))

  return app
}

function parseJsonError(payload: string): JsonErrorResponse {
  return JSON.parse(payload) as JsonErrorResponse
}

function parseSseEvents(payload: string): ParsedSseEvent[] {
  return payload
    .trim()
    .split('\n\n')
    .filter((frame) => frame.length > 0)
    .map((frame) => {
      const eventLine = frame.split('\n').find((line) => line.startsWith('event: '))
      const dataLine = frame.split('\n').find((line) => line.startsWith('data: '))

      assert.ok(eventLine)
      assert.ok(dataLine)

      return {
        event: eventLine.slice('event: '.length),
        data: JSON.parse(dataLine.slice('data: '.length)) as ParsedSseEvent['data'],
      }
    })
}

async function closeApp(app: FastifyInstance): Promise<void> {
  await app.close()
}

async function waitFor(
  predicate: () => boolean,
  message: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (predicate()) {
      return
    }

    await delay(25)
  }

  assert.fail(message)
}

test('allows the first Journal analysis start', () => {
  const result = reserveJournalAnalysisSlot(analysisInput, 1_000)

  assert.deepEqual(result, { allowed: true })
})

test('enforces the minimum interval for the same organization, user, entry, and connection', () => {
  const first = reserveJournalAnalysisSlot(analysisInput, 1_000)
  const second = reserveJournalAnalysisSlot(analysisInput, 1_001)

  assert.deepEqual(first, { allowed: true })
  assert.equal(second.allowed, false)
  assert.equal(second.reason, 'minimum_interval')
  assert.equal(second.retryAt?.getTime(), 1_000 + JOURNAL_ANALYSIS_LIMITS.minimumIntervalMs)
})

test('does not apply the minimum interval across different scoped analysis keys', () => {
  assert.deepEqual(reserveJournalAnalysisSlot(analysisInput, 1_000), { allowed: true })
  assert.deepEqual(reserveJournalAnalysisSlot({
    ...analysisInput,
    userId: 'user-b',
  }, 1_001), { allowed: true })
  assert.deepEqual(reserveJournalAnalysisSlot({
    ...analysisInput,
    entryId: 'entry-b',
  }, 1_002), { allowed: true })
  assert.deepEqual(reserveJournalAnalysisSlot({
    ...analysisInput,
    connectionId: 'connection-b',
  }, 1_003), { allowed: true })
})

test('enforces the per-organization Journal analysis window', () => {
  const start = 10_000

  for (
    let index = 0;
    index < JOURNAL_ANALYSIS_LIMITS.organizationStartsPerWindow;
    index += 1
  ) {
    const result = reserveJournalAnalysisSlot({
      organizationId: 'org-a',
      userId: `user-${index}`,
      entryId: `entry-${index}`,
      connectionId: `connection-${index}`,
    }, start + index)

    assert.equal(result.allowed, true)
  }

  const limited = reserveJournalAnalysisSlot({
    organizationId: 'org-a',
    userId: 'user-final',
    entryId: 'entry-final',
    connectionId: 'connection-final',
  }, start + JOURNAL_ANALYSIS_LIMITS.organizationStartsPerWindow)

  assert.equal(limited.allowed, false)
  assert.equal(limited.reason, 'organization_limit')
  assert.equal(limited.retryAt?.getTime(), start + JOURNAL_ANALYSIS_LIMITS.windowMs)
})

test('does not apply the per-organization window across independent organizations', () => {
  const start = 20_000

  for (
    let index = 0;
    index < JOURNAL_ANALYSIS_LIMITS.organizationStartsPerWindow;
    index += 1
  ) {
    const result = reserveJournalAnalysisSlot({
      organizationId: 'org-a',
      userId: `user-${index}`,
      entryId: `entry-${index}`,
      connectionId: `connection-${index}`,
    }, start + index)

    assert.equal(result.allowed, true)
  }

  assert.deepEqual(reserveJournalAnalysisSlot({
    organizationId: 'org-b',
    userId: 'user-a',
    entryId: 'entry-a',
    connectionId: 'connection-a',
  }, start + JOURNAL_ANALYSIS_LIMITS.organizationStartsPerWindow), { allowed: true })
})

test('analysis route rejects invalid body before store or provider access', async () => {
  const state = createTestState()
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: {
        connectionId: 'connection-a',
        prompt: 'client supplied prompt is not allowed',
      },
    })

    assert.equal(response.statusCode, 400)
    assert.equal(parseJsonError(response.payload).code, 'VALIDATION_ERROR')
    assert.equal(state.entryLookups.length, 0)
    assert.equal(state.connectionLookups.length, 0)
    assert.equal(state.limitCalls.length, 0)
    assert.equal(state.decryptCalls.length, 0)
    assert.equal(state.adapterConfigs.length, 0)
    assert.equal(state.prompts.length, 0)
  } finally {
    await closeApp(app)
  }
})

test('analysis route returns 404 for missing or cross-user entries using authenticated scope', async () => {
  const state = createTestState({ entry: null })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })

    assert.equal(response.statusCode, 404)
    assert.equal(parseJsonError(response.payload).code, 'NOT_FOUND')
    assert.deepEqual(state.entryLookups, [{
      organizationId: 'org-a',
      userId: 'user-a',
      entryId: 'entry-a',
    }])
    assert.equal(state.connectionLookups.length, 0)
    assert.equal(state.decryptCalls.length, 0)
    assert.equal(state.adapterConfigs.length, 0)
  } finally {
    await closeApp(app)
  }
})

test('analysis route returns 404 for missing scoped connection without provider contact', async () => {
  const state = createTestState({ connection: null })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })

    assert.equal(response.statusCode, 404)
    assert.equal(parseJsonError(response.payload).code, 'NOT_FOUND')
    assert.deepEqual(state.connectionLookups, [{
      organizationId: 'org-a',
      connectionId: 'connection-a',
    }])
    assert.equal(state.limitCalls.length, 0)
    assert.equal(state.decryptCalls.length, 0)
    assert.equal(state.adapterConfigs.length, 0)
  } finally {
    await closeApp(app)
  }
})

test('analysis route rejects not-ready connections before limiter or provider contact', async () => {
  const state = createTestState({
    connection: createConnection({
      lastTestStatus: 'failure',
      lastTestFailureKind: 'auth',
      lastTestErrorSummary: 'stored safe summary',
    }),
  })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })

    assert.equal(response.statusCode, 400)
    assert.equal(parseJsonError(response.payload).code, 'CONNECTION_NOT_READY')
    assert.equal(state.limitCalls.length, 0)
    assert.equal(state.decryptCalls.length, 0)
    assert.equal(state.adapterConfigs.length, 0)
    assert.equal(state.prompts.length, 0)
  } finally {
    await closeApp(app)
  }
})

test('analysis route rate limits before decrypting credentials or invoking the provider', async () => {
  const retryAt = new Date('2026-09-05T12:01:00.000Z')
  const state = createTestState({
    limitResult: {
      allowed: false,
      reason: 'organization_limit',
      retryAt,
    },
  })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })

    assert.equal(response.statusCode, 429)
    assert.equal(parseJsonError(response.payload).code, 'RATE_LIMITED')
    assert.deepEqual(state.limitCalls, [{
      organizationId: 'org-a',
      userId: 'user-a',
      entryId: 'entry-a',
      connectionId: 'connection-a',
    }])
    assert.equal(state.decryptCalls.length, 0)
    assert.equal(state.adapterConfigs.length, 0)
    assert.equal(state.prompts.length, 0)
  } finally {
    await closeApp(app)
  }
})

test('analysis route streams chunk and done SSE envelopes for valid requests', async () => {
  const state = createTestState()
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })
    const events = parseSseEvents(response.payload)

    assert.equal(response.statusCode, 200)
    assert.match(response.headers['content-type']?.toString() ?? '', /text\/event-stream/)
    assert.deepEqual(events, [
      {
        event: 'chunk',
        data: { type: 'chunk', text: 'Analysis chunk.' },
      },
      {
        event: 'done',
        data: { type: 'done' },
      },
    ])
    assert.equal(state.decryptCalls.length, 1)
    assert.deepEqual(state.adapterConfigs, [{
      model: 'test-model',
      apiKey: 'secret-token',
    }])
    assert.equal(state.streamConnectionIds[0], 'connection-a')
    assert.equal(state.maxOutputTokens[0], 4_000)
    assert.equal(state.prompts.length, 1)
    assert.match(state.prompts[0] ?? '', /helpful financial analyst/)
    assert.doesNotMatch(response.payload, /private journal content|secret-token/)
  } finally {
    await closeApp(app)
  }
})

test('analysis route streams safe error envelopes without raw provider details', async () => {
  const state = createTestState({
    streamEvents: [{
      type: 'error',
      failureKind: 'provider_error',
      message: 'The provider returned an error.',
    }],
  })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })
    const events = parseSseEvents(response.payload)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(events, [{
      event: 'error',
      data: {
        type: 'error',
        code: 'provider_error',
        message: 'The provider returned an error.',
      },
    }])
    assert.doesNotMatch(response.payload, /private journal content|secret-token|raw provider/)
  } finally {
    await closeApp(app)
  }
})

test('analysis route converts thrown stream failures to safe SSE errors', async () => {
  const state = createTestState({
    streamError: new Error('raw provider failure with secret-token'),
  })
  const app = await buildRouteTestApp(state)

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/journal/entries/entry-a/analyze',
      payload: { connectionId: 'connection-a' },
    })
    const events = parseSseEvents(response.payload)

    assert.equal(response.statusCode, 200)
    assert.deepEqual(events, [{
      event: 'error',
      data: {
        type: 'error',
        code: 'provider_error',
        message: 'The provider stopped responding before the analysis finished.',
      },
    }])
    assert.doesNotMatch(response.payload, /raw provider failure|private journal content|secret-token/)
  } finally {
    await closeApp(app)
  }
})

test('analysis route aborts provider signal when the client aborts streaming', async () => {
  const state = createTestState()
  state.providerDefinition = {
    id: 'test-provider',
    displayName: 'Test Provider',
    fields: [],
    isUsable: true,
    adapterFactory: () => ({
      async *streamText(
        _prompt: string,
        options: {
          readonly connectionId: string
          readonly signal: AbortSignal
          readonly maxOutputTokens: number
        },
      ): AsyncGenerator<StreamTextEvent> {
        state.streamConnectionIds.push(options.connectionId)
        state.maxOutputTokens.push(options.maxOutputTokens)
        state.streamSignal = options.signal
        yield { type: 'chunk', text: 'partial output' }
        await new Promise<void>((resolve) => {
          options.signal.addEventListener('abort', () => resolve(), { once: true })
        })
      },
    }),
  }
  const app = await buildRouteTestApp(state)

  try {
    await app.listen({ host: '127.0.0.1', port: 0 })
    const address = app.server.address() as AddressInfo
    const controller = new AbortController()
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/journal/entries/entry-a/analyze`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ connectionId: 'connection-a' }),
        signal: controller.signal,
      },
    )

    assert.equal(response.status, 200)
    const reader = response.body?.getReader()
    assert.ok(reader)
    const firstChunk = await reader.read()
    assert.equal(firstChunk.done, false)

    await reader.cancel()
    controller.abort()

    await waitFor(
      () => state.streamSignal?.aborted === true,
      'expected provider abort signal after client abort',
    )
  } finally {
    await closeApp(app)
  }
})
