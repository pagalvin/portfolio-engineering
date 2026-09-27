import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPredictionStore } from './predictionStore.js'

const now = new Date()
const withinGraceCreatedAt = new Date(now.getTime() - 60 * 1000) // 1 minute ago
const pastGraceCreatedAt = new Date(now.getTime() - 10 * 60 * 1000) // 10 minutes ago

function basePrediction(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pred-a',
    organizationId: 'org-a',
    userId: 'user-a',
    securityId: null,
    otherSymbol: null,
    topic: null,
    symbolSnapshot: null,
    symbolNormalizedSnapshot: null,
    type: 'DIRECTION',
    direction: 'RISES',
    claimText: 'MSFT rises this week',
    eventLabel: null,
    deadline: new Date('2026-10-01T00:00:00.000Z'),
    confidence: 70,
    priceAtPrediction: null,
    predictedPrice: null,
    predictedPercent: null,
    priceCapturedAt: null,
    reasoning: 'Original reasoning',
    tags: [],
    result: null,
    resolutionDate: null,
    actualPrice: null,
    outcomeNotes: null,
    voidedAt: null,
    voidReason: null,
    amended: false,
    amendedAt: null,
    createdAt: pastGraceCreatedAt,
    updatedAt: pastGraceCreatedAt,
    ...overrides,
  }
}

type Row = Record<string, unknown>

function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    const rowValue = row[key]
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      const operators = value as Record<string, unknown>
      if ('lte' in operators) {
        return (rowValue as Date).getTime() <= (operators.lte as Date).getTime()
      }
      if ('lt' in operators) {
        return (rowValue as Date).getTime() < (operators.lt as Date).getTime()
      }
      if ('gte' in operators) {
        return (rowValue as Date).getTime() >= (operators.gte as Date).getTime()
      }
      if ('has' in operators) {
        return (rowValue as unknown[]).includes(operators.has)
      }
    }
    if (rowValue instanceof Date && value instanceof Date) {
      return rowValue.getTime() === value.getTime()
    }
    return rowValue === value
  })
}

function createDouble(seed: { predictions?: Row[]; securities?: Row[] } = {}) {
  const state = {
    predictions: (seed.predictions ?? []).map((row) => ({ ...row })),
    securities: (seed.securities ?? []).map((row) => ({ ...row })),
    predictionAmendments: [] as Row[],
    predictionResultHistory: [] as Row[],
    predictionReasoningHistory: [] as Row[],
  }
  const calls: Record<string, unknown[]> = {}
  const record = (name: string, value: unknown) => {
    ;(calls[name] ??= []).push(value)
  }
  const withResultHistory = (row: Row, include?: Row): Row => {
    const historyInclude = include?.resultHistory as { where: Row } | undefined
    if (!historyInclude) return row
    const resultHistory = state.predictionResultHistory
      .filter((entry) => entry.predictionId === row.id && matches(entry, historyInclude.where))
      .sort((left, right) => (left.changedAt as Date).getTime() - (right.changedAt as Date).getTime())
      .map(({ previousResult, newResult, changedAt }) => ({ previousResult, newResult, changedAt }))
    return { ...row, resultHistory }
  }

  const predictionModel = {
    findFirst: async ({ where, include }: { where: Record<string, unknown>; include?: Row }) => {
      record('prediction.findFirst', where)
      const prediction = state.predictions.find((row) => matches(row, where))
      return prediction ? withResultHistory(prediction, include) : null
    },
    findFirstOrThrow: async ({ where }: { where: Record<string, unknown> }) => {
      const found = state.predictions.find((row) => matches(row, where))
      if (!found) throw new Error('Record not found')
      return found
    },
    findMany: async ({ where, include }: { where: Record<string, unknown>; include?: Row }) => {
      record('prediction.findMany', include === undefined ? where : { where, include })
      return state.predictions
        .filter((row) => matches(row, where))
        .map((row) => withResultHistory(row, include))
    },
    count: async ({ where }: { where: Record<string, unknown> }) => {
      record('prediction.count', where)
      return state.predictions.filter((row) => matches(row, where)).length
    },
    create: async ({ data }: { data: Row }) => {
      const row = { id: `pred-${state.predictions.length + 1}`, createdAt: now, updatedAt: now, ...data }
      state.predictions.push(row)
      return row
    },
    updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Row }) => {
      record('prediction.updateMany', where)
      const targets = state.predictions.filter((row) => matches(row, where))
      for (const target of targets) Object.assign(target, data)
      return { count: targets.length }
    },
    deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
      record('prediction.deleteMany', where)
      const targets = state.predictions.filter((row) => matches(row, where))
      for (const target of targets) state.predictions.splice(state.predictions.indexOf(target), 1)
      return { count: targets.length }
    },
    groupBy: async ({ where }: { where: Record<string, unknown> }) => {
      const rows = state.predictions.filter((row) => matches(row, where))
      const buckets = new Map<string, { type: unknown; result: unknown; count: number }>()
      for (const row of rows) {
        const key = `${row.type}:${row.result}`
        const bucket = buckets.get(key) ?? { type: row.type, result: row.result, count: 0 }
        bucket.count += 1
        buckets.set(key, bucket)
      }
      return [...buckets.values()].map((bucket) => ({ ...bucket, _count: { _all: bucket.count } }))
    },
  }

  const securityModel = {
    findFirst: async ({ where }: { where: Record<string, unknown> }) => {
      record('security.findFirst', where)
      return state.securities.find((row) => matches(row, where)) ?? null
    },
  }

  const predictionAmendmentModel = {
    create: async ({ data }: { data: Row }) => {
      state.predictionAmendments.push(data)
      return data
    },
    findMany: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy: Row }) => {
      record('predictionAmendment.findMany', { where, orderBy })
      return state.predictionAmendments
        .filter((row) => matches(row, where))
        .sort((left, right) => (left.changedAt as Date).getTime() - (right.changedAt as Date).getTime())
    },
  }
  const predictionResultHistoryModel = {
    create: async ({ data }: { data: Row }) => {
      state.predictionResultHistory.push(data)
      return data
    },
    findMany: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy: Row }) => {
      record('predictionResultHistory.findMany', { where, orderBy })
      return state.predictionResultHistory
        .filter((row) => matches(row, where))
        .sort((left, right) => (left.changedAt as Date).getTime() - (right.changedAt as Date).getTime())
    },
  }
  const predictionReasoningHistoryModel = {
    create: async ({ data }: { data: Row }) => {
      state.predictionReasoningHistory.push(data)
      return data
    },
    findMany: async ({ where, orderBy }: { where: Record<string, unknown>; orderBy: Row }) => {
      record('predictionReasoningHistory.findMany', { where, orderBy })
      return state.predictionReasoningHistory
        .filter((row) => matches(row, where))
        .sort((left, right) => (left.changedAt as Date).getTime() - (right.changedAt as Date).getTime())
    },
  }

  const client = {
    prediction: predictionModel,
    security: securityModel,
    predictionAmendment: predictionAmendmentModel,
    predictionResultHistory: predictionResultHistoryModel,
    predictionReasoningHistory: predictionReasoningHistoryModel,
  }
  const prisma = {
    ...client,
    $transaction: async <T>(callback: (tx: typeof client) => Promise<T>) => callback(client),
    $queryRaw: async () => [],
  }

  return { prisma, state, calls }
}

const unauthorizedScopes = [
  { organizationId: 'org-b', userId: 'user-a' },
  { organizationId: 'org-a', userId: 'user-b' },
]

test('findWithHistories scopes every read and returns histories in changedAt order', async () => {
  const { prisma, state, calls } = createDouble({ predictions: [basePrediction()] })
  state.predictionAmendments.push(
    { id: 'amend-late', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', changedAt: new Date('2026-09-02T00:00:00.000Z') },
    { id: 'amend-early', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', changedAt: new Date('2026-09-01T00:00:00.000Z') },
    { id: 'amend-other-user', organizationId: 'org-a', userId: 'user-b', predictionId: 'pred-a', changedAt: new Date('2026-08-31T00:00:00.000Z') },
    { id: 'amend-other-organization', organizationId: 'org-b', userId: 'user-a', predictionId: 'pred-a', changedAt: new Date('2026-08-30T00:00:00.000Z') },
  )
  state.predictionResultHistory.push(
    { id: 'result-late', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', previousResult: null, newResult: 'INCORRECT', changedAt: new Date('2026-09-02T00:00:00.000Z') },
    { id: 'result-early', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', previousResult: 'CORRECT', newResult: null, changedAt: new Date('2026-09-01T00:00:00.000Z') },
  )
  state.predictionReasoningHistory.push(
    { id: 'reasoning-late', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', changedAt: new Date('2026-09-02T00:00:00.000Z') },
    { id: 'reasoning-early', organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a', changedAt: new Date('2026-09-01T00:00:00.000Z') },
  )
  const store = createPredictionStore(prisma as never)

  const found = await store.findWithHistories({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.deepEqual(found?.amendmentHistory.map((item) => item.id), ['amend-early', 'amend-late'])
  assert.deepEqual(found?.resultHistory.map((item) => item.id), ['result-early', 'result-late'])
  assert.equal(found?.prediction.resultChanged, true)
  assert.deepEqual(found?.reasoningHistory.map((item) => item.id), ['reasoning-early', 'reasoning-late'])
  for (const name of ['predictionAmendment.findMany', 'predictionResultHistory.findMany', 'predictionReasoningHistory.findMany']) {
    const [{ where, orderBy }] = calls[name] as Array<{ where: Row; orderBy: Row }>
    assert.deepEqual(where, { organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
    assert.deepEqual(orderBy, { changedAt: 'asc' })
  }

  const beforeUnauthorized = calls['predictionAmendment.findMany']?.length ?? 0
  const inaccessible = await store.findWithHistories({ organizationId: 'org-b', userId: 'user-a', predictionId: 'pred-a' })
  assert.equal(inaccessible, null)
  assert.equal(calls['predictionAmendment.findMany']?.length ?? 0, beforeUnauthorized)
})

test('list returns filteredCount N and unfiltered own totalCount T including voided', async () => {
  const activeMatch = basePrediction({ id: 'active-match' })
  const voidedMatch = basePrediction({ id: 'voided-match', voidedAt: new Date('2026-09-03T00:00:00.000Z') })
  const ownDifferentType = basePrediction({ id: 'own-other-type', type: 'FREEFORM' })
  const otherUser = basePrediction({ id: 'other-user', userId: 'user-b' })
  const otherOrganization = basePrediction({ id: 'other-organization', organizationId: 'org-b' })
  const { prisma, calls } = createDouble({ predictions: [activeMatch, voidedMatch, ownDifferentType, otherUser, otherOrganization] })

  const result = await createPredictionStore(prisma as never).list({
    organizationId: 'org-a',
    userId: 'user-a',
    type: 'DIRECTION',
  })

  assert.equal(result.predictions.length, 1)
  assert.equal(result.filteredCount, 1)
  assert.equal(result.totalCount, 3)
  assert.equal(result.predictions[0]?.resultChanged, false)
  const countCalls = calls['prediction.count'] as Array<Row>
  assert.deepEqual(countCalls[1], { organizationId: 'org-a', userId: 'user-a' })
})

test('list derives resultChanged from scoped history in its page query without per-row queries', async () => {
  const predictions = [
    basePrediction({ id: 'never-resolved' }),
    basePrediction({ id: 'first-result', result: 'CORRECT' }),
    basePrediction({ id: 'direct-change', result: 'INCORRECT' }),
    basePrediction({ id: 'clear-only', result: null }),
    basePrediction({ id: 'clear-rerecord', result: 'CORRECT' }),
    basePrediction({ id: 'metadata-only', result: 'CORRECT' }),
    basePrediction({ id: 'other-user-history', result: 'CORRECT' }),
  ]
  const { prisma, state, calls } = createDouble({ predictions })
  const history = (predictionId: string, previousResult: string | null, newResult: string | null, day: number, userId = 'user-a') => ({
    organizationId: 'org-a',
    userId,
    predictionId,
    previousResult,
    newResult,
    changedAt: new Date(`2026-09-${String(day).padStart(2, '0')}T00:00:00.000Z`),
  })
  state.predictionResultHistory.push(
    history('direct-change', 'CORRECT', 'INCORRECT', 1),
    history('clear-only', 'CORRECT', null, 1),
    history('clear-rerecord', 'CORRECT', null, 1),
    history('clear-rerecord', null, 'CORRECT', 2),
    history('metadata-only', 'CORRECT', 'CORRECT', 1),
    history('other-user-history', 'CORRECT', 'INCORRECT', 1, 'user-b'),
  )

  const result = await createPredictionStore(prisma as never).list({
    organizationId: 'org-a',
    userId: 'user-a',
    includeVoided: true,
  })

  assert.deepEqual(
    result.predictions.map(({ id, resultChanged }) => [id, resultChanged]),
    [
      ['never-resolved', false],
      ['first-result', false],
      ['direct-change', true],
      ['clear-only', false],
      ['clear-rerecord', true],
      ['metadata-only', false],
      ['other-user-history', false],
    ],
  )
  assert.equal(calls['prediction.findMany']?.length, 1)
  assert.equal(calls['predictionResultHistory.findMany'], undefined)
  const [{ include }] = calls['prediction.findMany'] as Array<{ include: { resultHistory: { where: Row } } }>
  assert.deepEqual(include.resultHistory.where, { organizationId: 'org-a', userId: 'user-a' })
})

test('find includes a scoped resultChanged value', async () => {
  const { prisma, state, calls } = createDouble({ predictions: [basePrediction({ result: 'INCORRECT' })] })
  state.predictionResultHistory.push({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    previousResult: 'CORRECT',
    newResult: 'INCORRECT',
    changedAt: new Date('2026-09-01T00:00:00.000Z'),
  })

  const prediction = await createPredictionStore(prisma as never).find({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
  })

  assert.equal(prediction?.resultChanged, true)
  assert.deepEqual(calls['prediction.findFirst'], [{ id: 'pred-a', organizationId: 'org-a', userId: 'user-a' }])
})

test('create resolves a Security Master subject and snapshots its symbol', async () => {
  const { prisma, state } = createDouble({
    securities: [
      {
        id: 'security-a',
        organizationId: 'org-a',
        symbol: 'MSFT',
        symbolNormalized: 'MSFT',
      },
    ],
  })

  const result = await createPredictionStore(prisma as never).create({
    organizationId: 'org-a',
    userId: 'user-a',
    securityId: 'security-a',
    type: 'DIRECTION',
    direction: 'RISES',
    claimText: 'MSFT rises',
    deadline: '2026-10-01',
    confidence: 70,
  })

  assert.equal(result.status, 'created')
  assert.equal(state.predictions[0]?.securityId, 'security-a')
  assert.equal(state.predictions[0]?.symbolSnapshot, 'MSFT')
  assert.equal(state.predictions[0]?.symbolNormalizedSnapshot, 'MSFT')
})

test('create rejects a security reference outside the organization', async () => {
  const { prisma } = createDouble({
    securities: [{ id: 'security-a', organizationId: 'org-b', symbol: 'MSFT', symbolNormalized: 'MSFT' }],
  })

  const result = await createPredictionStore(prisma as never).create({
    organizationId: 'org-a',
    userId: 'user-a',
    securityId: 'security-a',
    type: 'DIRECTION',
    direction: 'RISES',
    claimText: 'MSFT rises',
    deadline: '2026-10-01',
    confidence: 70,
  })

  assert.deepEqual(result, { status: 'invalid_security_reference' })
})

test('create normalizes an Other subject into matching otherSymbol and snapshots', async () => {
  const { state, prisma } = createDouble()

  await createPredictionStore(prisma as never).create({
    organizationId: 'org-a',
    userId: 'user-a',
    otherSymbol: '  brk.a ',
    type: 'DIRECTION',
    direction: 'RISES',
    claimText: 'BRK.A rises',
    deadline: '2026-10-01',
    confidence: 70,
  })

  assert.equal(state.predictions[0]?.otherSymbol, 'BRK.A')
  assert.equal(state.predictions[0]?.symbolSnapshot, 'BRK.A')
  assert.equal(state.predictions[0]?.symbolNormalizedSnapshot, 'BRK.A')
})

test('create stores reasoning exactly as supplied, with no trim or normalization', async () => {
  const { state, prisma } = createDouble()
  const reasoning = '  Line one\n\nLine two with trailing spaces   '

  await createPredictionStore(prisma as never).create({
    organizationId: 'org-a',
    userId: 'user-a',
    type: 'FREEFORM',
    claimText: 'A freeform claim',
    deadline: '2026-10-01',
    confidence: 60,
    reasoning,
  })

  assert.equal(state.predictions[0]?.reasoning, reasoning)
})

test('update within the grace period applies a claim change without amendment history', async () => {
  const row = basePrediction({ createdAt: withinGraceCreatedAt })
  const { prisma, state } = createDouble({ predictions: [row] })

  const result = await createPredictionStore(prisma as never).update({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    claimText: 'Updated within grace',
  })

  assert.equal(result.status, 'updated')
  if (result.status === 'updated') {
    assert.equal(result.prediction.claimText, 'Updated within grace')
    assert.equal(result.prediction.amended, false)
  }
  assert.equal(state.predictionAmendments.length, 0)
})

test('update after the grace period requires confirmation and performs no write', async () => {
  const row = basePrediction()
  const { prisma, state } = createDouble({ predictions: [row] })
  const before = { ...row }

  const result = await createPredictionStore(prisma as never).update({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    claimText: 'Changed after grace',
    confidence: 80,
  })

  assert.equal(result.status, 'amend_confirmation_required')
  if (result.status === 'amend_confirmation_required') {
    assert.deepEqual(result.changedFields.sort(), ['claimText', 'confidence'])
  }
  assert.deepEqual(row, before)
  assert.equal(state.predictionAmendments.length, 0)
})

test('confirmed amendment after the grace period writes the update and one amendment record atomically', async () => {
  const row = basePrediction()
  const { prisma, state } = createDouble({ predictions: [row] })

  const result = await createPredictionStore(prisma as never).update({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    claimText: 'Changed after grace',
    confirmAmendment: true,
  })

  assert.equal(result.status, 'updated')
  if (result.status === 'updated') {
    assert.equal(result.prediction.claimText, 'Changed after grace')
    assert.equal(result.prediction.amended, true)
    assert.ok(result.prediction.amendedAt)
  }
  assert.equal(state.predictionAmendments.length, 1)
  assert.equal(state.predictionAmendments[0]?.previousClaimText, 'MSFT rises this week')
  assert.deepEqual(state.predictionAmendments[0]?.changedFields, ['claimText'])
})

test('reasoning edit within the grace period writes no reasoning history', async () => {
  const row = basePrediction({ createdAt: withinGraceCreatedAt })
  const { prisma, state } = createDouble({ predictions: [row] })

  const result = await createPredictionStore(prisma as never).update({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    reasoning: 'Updated reasoning within grace',
  })

  assert.equal(result.status, 'updated')
  if (result.status === 'updated') {
    assert.equal(result.prediction.reasoning, 'Updated reasoning within grace')
    assert.equal(result.prediction.amended, false)
  }
  assert.equal(state.predictionReasoningHistory.length, 0)
})

test('reasoning edit after the grace period writes exactly one history entry and never sets Amended', async () => {
  const row = basePrediction()
  const { prisma, state } = createDouble({ predictions: [row] })
  const newReasoning = 'Updated reasoning after grace, byte-for-byte  '

  const result = await createPredictionStore(prisma as never).update({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    reasoning: newReasoning,
  })

  assert.equal(result.status, 'updated')
  if (result.status === 'updated') {
    assert.equal(result.prediction.reasoning, newReasoning)
    assert.equal(result.prediction.amended, false)
  }
  assert.equal(state.predictionReasoningHistory.length, 1)
  assert.equal(state.predictionReasoningHistory[0]?.previousReasoning, 'Original reasoning')
  assert.equal(state.predictionReasoningHistory[0]?.newReasoning, newReasoning)
})

test('update scopes reads and writes by organization and user and leaves other rows untouched', async () => {
  for (const scope of unauthorizedScopes) {
    const row = basePrediction()
    const before = { ...row }
    const { prisma } = createDouble({ predictions: [row] })

    const result = await createPredictionStore(prisma as never).update({
      ...scope,
      predictionId: 'pred-a',
      claimText: 'Should not apply',
    })

    assert.deepEqual(result, { status: 'not_found' })
    assert.deepEqual(row, before)
  }
})

test('recordResult creates no history on the first result and one entry on a later change', async () => {
  const row = basePrediction({
    type: 'PERCENT_MOVE',
    deadline: new Date('2026-09-01T00:00:00.000Z'),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  })
  const { prisma, state } = createDouble({ predictions: [row] })
  const store = createPredictionStore(prisma as never)

  const first = await store.recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'CORRECT',
    resolutionDate: '2026-09-05',
    asOfLocalDate: '2026-09-05',
  })
  assert.equal(first.status, 'updated')
  assert.equal(state.predictionResultHistory.length, 0)

  const second = await store.recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'INCORRECT',
    resolutionDate: '2026-09-06',
    asOfLocalDate: '2026-09-06',
  })
  assert.equal(second.status, 'updated')
  assert.equal(state.predictionResultHistory.length, 1)
  assert.equal(state.predictionResultHistory[0]?.previousResult, 'CORRECT')
  assert.equal(state.predictionResultHistory[0]?.newResult, 'INCORRECT')
})

test('recordResult allows early Correct for Percent move and Target price only', async () => {
  const row = basePrediction({ type: 'DIRECTION', deadline: new Date('2026-12-01T00:00:00.000Z') })
  const { prisma } = createDouble({ predictions: [row] })

  const blocked = await createPredictionStore(prisma as never).recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'CORRECT',
    resolutionDate: '2026-09-05',
    asOfLocalDate: '2026-09-05',
  })
  assert.deepEqual(blocked, { status: 'deadline_not_passed' })

  for (const [id, type] of [['pred-b', 'PERCENT_MOVE'], ['pred-c', 'TARGET_PRICE']] as const) {
    const earlyRow = basePrediction({
      id,
      type,
      deadline: new Date('2026-12-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    const { prisma: earlyPrisma } = createDouble({ predictions: [earlyRow] })
    const early = await createPredictionStore(earlyPrisma as never).recordResult({
      organizationId: 'org-a',
      userId: 'user-a',
      predictionId: id,
      result: 'CORRECT',
      resolutionDate: '2026-09-05',
      asOfLocalDate: '2026-09-05',
    })
    assert.equal(early.status, 'updated')
  }
})

test('recordResult bounds resolutionDate from creation date through today', async () => {
  const row = basePrediction({ deadline: new Date('2026-09-01T00:00:00.000Z') })
  const { prisma } = createDouble({ predictions: [row] })

  const future = await createPredictionStore(prisma as never).recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'CORRECT',
    resolutionDate: '2026-09-10',
    asOfLocalDate: '2026-09-05',
  })
  assert.deepEqual(future, { status: 'resolution_date_out_of_range' })

  const beforeCreation = await createPredictionStore(prisma as never).recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'CORRECT',
    resolutionDate: '2026-08-01',
    asOfLocalDate: '2026-09-05',
  })
  assert.deepEqual(beforeCreation, { status: 'resolution_date_out_of_range' })

  const createdEarlier = basePrediction({
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    deadline: new Date('2026-09-01T00:00:00.000Z'),
  })
  const { prisma: beforeDeadlinePrisma } = createDouble({ predictions: [createdEarlier] })
  const beforeDeadlineButAfterCreation = await createPredictionStore(beforeDeadlinePrisma as never).recordResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
    result: 'CORRECT',
    resolutionDate: '2026-08-01',
    asOfLocalDate: '2026-09-05',
  })
  assert.equal(beforeDeadlineButAfterCreation.status, 'updated')
})

test('clearResult writes history only when a prior result existed', async () => {
  const withoutResult = basePrediction()
  const { prisma: noResultPrisma, state: noResultState } = createDouble({ predictions: [withoutResult] })
  const clearedEmpty = await createPredictionStore(noResultPrisma as never).clearResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
  })
  assert.equal(clearedEmpty.status, 'updated')
  assert.equal(noResultState.predictionResultHistory.length, 0)

  const withResult = basePrediction({
    result: 'CORRECT',
    resolutionDate: new Date('2026-09-05T00:00:00.000Z'),
  })
  const { prisma: hasResultPrisma, state: hasResultState } = createDouble({ predictions: [withResult] })
  const cleared = await createPredictionStore(hasResultPrisma as never).clearResult({
    organizationId: 'org-a',
    userId: 'user-a',
    predictionId: 'pred-a',
  })
  assert.equal(cleared.status, 'updated')
  assert.equal(hasResultState.predictionResultHistory.length, 1)
  assert.equal(hasResultState.predictionResultHistory[0]?.previousResult, 'CORRECT')
  assert.equal(hasResultState.predictionResultHistory[0]?.newResult, null)
})

test('void and restore scope by organization/user and reject invalid lifecycle transitions', async () => {
  const row = basePrediction()
  const { prisma } = createDouble({ predictions: [row] })
  const store = createPredictionStore(prisma as never)

  const notVoided = await store.restore({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.deepEqual(notVoided, { status: 'not_voided' })

  const voided = await store.void({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.equal(voided.status, 'updated')

  const alreadyVoided = await store.void({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.deepEqual(alreadyVoided, { status: 'already_voided' })

  const restored = await store.restore({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.equal(restored.status, 'updated')
  if (restored.status === 'updated') {
    assert.equal(restored.prediction.voidedAt, null)
  }

  for (const scope of unauthorizedScopes) {
    const result = await store.void({ ...scope, predictionId: 'pred-a' })
    assert.deepEqual(result, { status: 'not_found' })
  }
})

test('delete only removes a voided prediction and is scoped by organization/user', async () => {
  const row = basePrediction()
  const { prisma, state } = createDouble({ predictions: [row] })
  const store = createPredictionStore(prisma as never)

  const blocked = await store.delete({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.deepEqual(blocked, { status: 'not_voided' })
  assert.equal(state.predictions.length, 1)

  for (const scope of unauthorizedScopes) {
    const result = await store.delete({ ...scope, predictionId: 'pred-a' })
    assert.deepEqual(result, { status: 'not_found' })
  }

  await store.void({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  const deleted = await store.delete({ organizationId: 'org-a', userId: 'user-a', predictionId: 'pred-a' })
  assert.deepEqual(deleted, { status: 'deleted' })
  assert.equal(state.predictions.length, 0)
})

test('countDue and due list exclude predictions whose deadline is today', async () => {
  const due = basePrediction({ id: 'pred-due', deadline: new Date('2026-09-01T00:00:00.000Z') })
  const deadlineToday = basePrediction({ id: 'pred-deadline-today', deadline: new Date('2026-09-05T00:00:00.000Z') })
  const notYetDue = basePrediction({ id: 'pred-not-due', deadline: new Date('2026-12-01T00:00:00.000Z') })
  const resolved = basePrediction({
    id: 'pred-resolved',
    deadline: new Date('2026-09-01T00:00:00.000Z'),
    result: 'CORRECT',
  })
  const voided = basePrediction({
    id: 'pred-voided',
    deadline: new Date('2026-09-01T00:00:00.000Z'),
    voidedAt: new Date('2026-09-02T00:00:00.000Z'),
  })
  const otherUser = basePrediction({
    id: 'pred-other-user',
    userId: 'user-b',
    deadline: new Date('2026-09-01T00:00:00.000Z'),
  })
  const { prisma } = createDouble({ predictions: [due, deadlineToday, notYetDue, resolved, voided, otherUser] })
  const store = createPredictionStore(prisma as never)

  const countOnDeadline = await store.countDue({
    organizationId: 'org-a',
    userId: 'user-a',
    asOfLocalDate: '2026-09-05',
  })
  assert.equal(countOnDeadline, 1)

  const countAfterDeadline = await store.countDue({
    organizationId: 'org-a',
    userId: 'user-a',
    asOfLocalDate: '2026-09-06',
  })
  assert.equal(countAfterDeadline, 2)

  const dueList = await store.list({
    organizationId: 'org-a',
    userId: 'user-a',
    includeVoided: false,
    dueOnly: true,
    asOfLocalDate: '2026-09-05',
  })
  assert.deepEqual(dueList.predictions.map((prediction) => prediction.id), ['pred-due'])
})

test('statsRecords returns only predictions scoped to both organization and user', async () => {
  const own = basePrediction({ id: 'pred-own' })
  const otherUser = basePrediction({ id: 'pred-other-user', userId: 'user-b' })
  const otherOrganization = basePrediction({ id: 'pred-other-organization', organizationId: 'org-b' })
  const { prisma, calls } = createDouble({ predictions: [own, otherUser, otherOrganization] })
  const records = await createPredictionStore(prisma as never).statsRecords({
    organizationId: 'org-a',
    userId: 'user-a',
  })

  assert.deepEqual(records.map((record) => record.id), ['pred-own'])
  assert.deepEqual(calls['prediction.findMany']?.at(-1), { organizationId: 'org-a', userId: 'user-a' })
})

test('statsAggregate excludes voided predictions and groups by type/result', async () => {
  const correct = basePrediction({ id: 'pred-1', result: 'CORRECT' })
  const incorrect = basePrediction({ id: 'pred-2', result: 'INCORRECT' })
  const voided = basePrediction({ id: 'pred-3', result: 'CORRECT', voidedAt: new Date() })
  const { prisma } = createDouble({ predictions: [correct, incorrect, voided] })

  const buckets = await createPredictionStore(prisma as never).statsAggregate({
    organizationId: 'org-a',
    userId: 'user-a',
  })

  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.count, 0), 2)
})
