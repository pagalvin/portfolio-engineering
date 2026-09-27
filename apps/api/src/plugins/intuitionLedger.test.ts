import assert from 'node:assert/strict'
import Fastify, { type FastifyInstance } from 'fastify'
import { test } from 'node:test'
import type {
  CreatePredictionInput,
  CreatePredictionResult,
  DeletePredictionOutcome,
  Prediction,
  PredictionAmendment,
  PredictionReasoningHistory,
  PredictionResultHistory,
  PredictionStatsRecord,
  PredictionStore,
  RecordResultInput,
  RecordResultOutcome,
  Security,
  SecurityStore,
  UpdatePredictionInput,
  UpdatePredictionResult,
  VoidPredictionOutcome,
} from '@portfolio-engineering/database'
import type { JwtPayload } from '@portfolio-engineering/shared-types/auth'
import { createIntuitionLedgerRoutes } from './intuitionLedger.js'

const authUser: JwtPayload = {
  sub: 'user-a',
  email: 'user-a@example.test',
  organizationId: 'org-a',
  role: 'member',
}

function prediction(overrides: Partial<Prediction> = {}): Prediction {
  const now = new Date()
  return {
    id: 'prediction-a',
    organizationId: 'org-a',
    userId: 'user-a',
    securityId: null,
    otherSymbol: 'MSFT',
    topic: null,
    symbolSnapshot: 'MSFT',
    symbolNormalizedSnapshot: 'MSFT',
    type: 'FREEFORM',
    direction: null,
    claimText: 'MSFT will rise.',
    eventLabel: null,
    deadline: new Date('2026-09-26T00:00:00.000Z'),
    confidence: 70,
    priceAtPrediction: null,
    predictedPrice: null,
    predictedPercent: null,
    priceCapturedAt: null,
    reasoning: null,
    tags: [],
    result: null,
    resolutionDate: null,
    actualPrice: null,
    outcomeNotes: null,
    voidedAt: null,
    voidReason: null,
    amended: false,
    amendedAt: null,
    createdAt: new Date(now.getTime() - 6 * 60 * 1000),
    updatedAt: now,
    ...overrides,
  }
}

type PredictionReadRecord = Prediction & { resultChanged: boolean }

function predictionRecord(overrides: Partial<PredictionReadRecord> = {}): PredictionReadRecord {
  return { ...prediction(), resultChanged: false, ...overrides }
}

function statsRecord(overrides: Partial<PredictionStatsRecord> = {}): PredictionStatsRecord {
  const current = prediction()
  return {
    id: current.id,
    organizationId: current.organizationId,
    userId: current.userId,
    type: current.type,
    result: current.result,
    voidedAt: current.voidedAt,
    amended: current.amended,
    deadline: current.deadline,
    confidence: current.confidence,
    resolutionDate: current.resolutionDate,
    symbolSnapshot: current.symbolSnapshot,
    symbolNormalizedSnapshot: current.symbolNormalizedSnapshot,
    otherSymbol: current.otherSymbol,
    direction: current.direction,
    priceAtPrediction: null,
    predictedPrice: null,
    predictedPercent: null,
    actualPrice: null,
    ...overrides,
  }
}

function security(overrides: Partial<Security> = {}): Security {
  const now = new Date()
  return {
    id: 'security-a',
    organizationId: 'org-a',
    symbol: 'MSFT',
    symbolNormalized: 'MSFT',
    type: 'STOCK',
    name: 'Microsoft',
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
  current: Prediction
  currentResultChanged: boolean
  listRecords: PredictionReadRecord[]
  totalCount: number
  histories: {
    amendmentHistory: PredictionAmendment[]
    resultHistory: PredictionResultHistory[]
    reasoningHistory: PredictionReasoningHistory[]
  }
  createInput?: CreatePredictionInput
  updateInputs: UpdatePredictionInput[]
  resultInput?: RecordResultInput
  listInput?: Parameters<PredictionStore['list']>[0]
  countInput?: Parameters<PredictionStore['countDue']>[0]
  otherSuggestionInput?: Parameters<PredictionStore['suggestOtherSymbols']>[0]
  tagSuggestionInput?: Parameters<PredictionStore['suggestTags']>[0]
  statsInput?: Parameters<PredictionStore['statsRecords']>[0]
  statsRecords: PredictionStatsRecord[]
  statsFailure?: Error
  createOutcome: CreatePredictionResult
  updateOutcome: UpdatePredictionResult
  resultOutcome: RecordResultOutcome
  voidOutcome: VoidPredictionOutcome
  restoreOutcome: { status: 'updated'; prediction: Prediction } | { status: 'not_found' } | { status: 'not_voided' }
  deleteOutcome: DeletePredictionOutcome
  listFailure?: Error
  securityRecord: Security | null
  dueCount: number
}

function createState(): TestState {
  const current = prediction()
  return {
    current,
    currentResultChanged: false,
    listRecords: [predictionRecord()],
    totalCount: 8,
    histories: { amendmentHistory: [], resultHistory: [], reasoningHistory: [] },
    createOutcome: { status: 'created', prediction: current },
    updateOutcome: { status: 'updated', prediction: current },
    resultOutcome: { status: 'updated', prediction: current },
    voidOutcome: { status: 'updated', prediction: current },
    restoreOutcome: { status: 'updated', prediction: current },
    deleteOutcome: { status: 'deleted' },
    securityRecord: security(),
    dueCount: 2,
    statsRecords: [],
    updateInputs: [],
  }
}

function createStores(state: TestState): { predictionStore: PredictionStore; securityStore: SecurityStore } {
  const predictionStore: PredictionStore = {
    async create(input) {
      state.createInput = input
      return state.createOutcome
    },
    async list(input) {
      state.listInput = input
      if (state.listFailure) throw state.listFailure
      return {
        predictions: state.listRecords,
        filteredCount: state.listRecords.length,
        totalCount: state.totalCount,
      }
    },
    async find(input) {
      return input.organizationId === state.current.organizationId &&
        input.userId === state.current.userId && input.predictionId === state.current.id
        ? state.current
        : null
    },
    async findWithHistories(input) {
      if (input.organizationId !== state.current.organizationId ||
        input.userId !== state.current.userId || input.predictionId !== state.current.id) return null
      return { prediction: { ...state.current, resultChanged: state.currentResultChanged }, ...state.histories }
    },
    async update(input) {
      state.updateInputs.push(input)
      return state.updateOutcome
    },
    async recordResult(input) {
      state.resultInput = input
      return state.resultOutcome
    },
    async clearResult() {
      return { status: 'updated', prediction: state.current }
    },
    async void() {
      return state.voidOutcome
    },
    async restore() {
      return state.restoreOutcome
    },
    async delete() {
      return state.deleteOutcome
    },
    async countDue(input) {
      state.countInput = input
      return state.dueCount
    },
    async suggestOtherSymbols(input) {
      state.otherSuggestionInput = input
      return ['NVDA', 'ONDS']
    },
    async suggestTags(input) {
      state.tagSuggestionInput = input
      return ['earnings', 'macro']
    },
    async statsRecords(input) {
      state.statsInput = input
      if (state.statsFailure) throw state.statsFailure
      return state.statsRecords.filter((record) =>
        record.organizationId === input.organizationId && record.userId === input.userId,
      )
    },
    async statsAggregate() {
      return []
    },
  }

  const securityStore: SecurityStore = {
    async create() { return { status: 'created', security: state.securityRecord ?? security() } },
    async list() { return state.securityRecord ? [state.securityRecord] : [] },
    async count() { return state.securityRecord ? 1 : 0 },
    async find(input) {
      return input.organizationId === state.securityRecord?.organizationId &&
        input.securityId === state.securityRecord?.id
        ? state.securityRecord
        : null
    },
    async update() { return state.securityRecord ? { status: 'updated', security: state.securityRecord } : { status: 'not_found' } },
    async setActive() { return state.securityRecord ? { status: 'updated', security: state.securityRecord } : { status: 'not_found' } },
    async delete() { return { status: 'deleted' } },
  }
  return { predictionStore, securityStore }
}

async function buildApp(state: TestState, now = new Date()): Promise<FastifyInstance> {
  const { predictionStore, securityStore } = createStores(state)
  const app = Fastify({ logger: false })
  app.addHook('onRequest', async (request) => {
    request.user = authUser
  })
  await app.register(createIntuitionLedgerRoutes({
    predictionStore,
    securityStore,
    now: () => now,
  }))
  return app
}

function requestBody(overrides: Record<string, unknown> = {}) {
  return {
    type: 'PERCENT_MOVE',
    otherSymbol: ' msft ',
    direction: 'RISES',
    claimText: 'Microsoft will rise 10%.',
    deadline: '2026-10-02',
    confidence: 80,
    priceAtPrediction: '100',
    priceCapturedAt: '2026-09-27T12:00:00.000Z',
    predictedPercent: '10',
    reasoning: '  **because**\n',
    tags: ['earnings'],
    ...overrides,
  }
}

test('creates a prediction with authenticated scope, normalized symbol, derived values, and raw reasoning', async () => {
  const state = createState()
  const app = await buildApp(state)
  const response = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions',
    payload: requestBody(),
  })

  assert.equal(response.statusCode, 201)
  assert.equal(state.createInput?.organizationId, 'org-a')
  assert.equal(state.createInput?.userId, 'user-a')
  assert.equal(state.createInput?.otherSymbol, 'MSFT')
  assert.equal(state.createInput?.predictedPrice, '110')
  assert.equal(state.createInput?.predictedPercent, '10')
  assert.equal(state.createInput?.reasoning, '  **because**\n')
  await app.close()
})

test('rejects client ownership fields and inactive or foreign security selections', async () => {
  const state = createState()
  const app = await buildApp(state)
  const suppliedScope = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions',
    payload: requestBody({ organizationId: 'org-b', userId: 'user-b' }),
  })
  assert.equal(suppliedScope.statusCode, 400)
  assert.equal(state.createInput, undefined)

  state.securityRecord = security({ active: false })
  const inactive = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions',
    payload: requestBody({ securityId: 'security-a', otherSymbol: null }),
  })
  assert.equal(inactive.statusCode, 400)
  assert.equal(JSON.parse(inactive.payload).code, 'invalid_security_reference')

  state.securityRecord = security({ organizationId: 'org-b' })
  const foreign = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions',
    payload: requestBody({ securityId: 'security-a', otherSymbol: null }),
  })
  assert.equal(foreign.statusCode, 400)
  assert.equal(JSON.parse(foreign.payload).code, 'invalid_security_reference')

  state.current = prediction()
  state.securityRecord = security({ active: false })
  const inactiveSubjectChange = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { securityId: 'security-a', otherSymbol: null },
  })
  assert.equal(inactiveSubjectChange.statusCode, 400)
  assert.equal(JSON.parse(inactiveSubjectChange.payload).code, 'invalid_security_reference')

  state.securityRecord = security({ organizationId: 'org-b' })
  const foreignSubjectChange = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { securityId: 'security-a', otherSymbol: null },
  })
  assert.equal(foreignSubjectChange.statusCode, 400)
  assert.equal(JSON.parse(foreignSubjectChange.payload).code, 'invalid_security_reference')

  state.securityRecord = security({ active: true })
  const activeSubjectChange = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { securityId: 'security-a', otherSymbol: null },
  })
  assert.equal(activeSubjectChange.statusCode, 200)
  assert.equal(state.updateInputs.at(-1)?.securityId, 'security-a')
  await app.close()
})

test('lists with the caller scope, user-local status derivation, and filtered N versus unfiltered T', async () => {
  const state = createState()
  const today = new Date().toISOString().slice(0, 10)
  state.listRecords = [
    predictionRecord({ id: 'due', deadline: new Date(Date.now() - 86400000), resultChanged: true }),
    predictionRecord({ id: 'open', deadline: new Date(Date.now() + 3 * 86400000) }),
    predictionRecord({ id: 'void', voidedAt: new Date() }),
    predictionRecord({ id: 'resolved', result: 'CORRECT', resolutionDate: new Date() }),
  ]
  state.totalCount = 23
  const app = await buildApp(state)
  const response = await app.inject({
    method: 'GET',
    url: `/api/intuition-ledger/predictions?status=all&asOfLocalDate=${today}`,
  })
  const payload = JSON.parse(response.payload)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(payload.predictions.map((item: { id: string }) => item.id), ['due', 'open', 'void', 'resolved'])
  assert.equal(payload.filteredCount, 4)
  assert.equal(payload.totalCount, 23)
  assert.equal(payload.predictions[0].resultChanged, true)
  assert.equal(payload.predictions[1].resultChanged, false)
  assert.equal(state.listInput?.organizationId, 'org-a')
  assert.equal(state.listInput?.userId, 'user-a')
  assert.equal(state.listInput?.includeVoided, true)
  assert.equal(state.listInput?.q, undefined)
  const search = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions?q=reasoning+or+outcome' })
  assert.equal(search.statusCode, 200)
  assert.equal(state.listInput?.q, 'reasoning or outcome')
  await app.close()
})

test('rejects repeated, unknown, missing-local-date, and out-of-window list queries', async () => {
  const state = createState()
  const app = await buildApp(state)
  const repeated = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions?status=open&status=due&asOfLocalDate=2026-09-27' })
  const unknown = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions?unexpected=1' })
  const missingDate = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions?status=due' })
  const oldDate = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions?asOfLocalDate=2000-01-01' })

  assert.equal(repeated.statusCode, 400)
  assert.equal(unknown.statusCode, 400)
  assert.equal(missingDate.statusCode, 400)
  assert.equal(oldDate.statusCode, 400)
  assert.equal(state.listInput, undefined)

  const invalidPrice = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions', payload: requestBody({ priceAtPrediction: '0' }) })
  const invalidConfidence = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions', payload: requestBody({ confidence: 101 }) })
  const signedMove = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions', payload: requestBody({ predictedPercent: '-1' }) })
  assert.equal(invalidPrice.statusCode, 400)
  assert.equal(invalidConfidence.statusCode, 400)
  assert.equal(signedMove.statusCode, 400)
  await app.close()
})

test('returns all scoped prediction histories and server-computed grace-period end', async () => {
  const state = createState()
  const earlier = new Date('2026-09-26T12:00:00.000Z')
  const later = new Date('2026-09-26T12:01:00.000Z')
  state.current = prediction({ result: 'INCORRECT', resolutionDate: new Date('2026-09-26T00:00:00.000Z') })
  state.histories = {
    amendmentHistory: [{
      id: 'amend-1', predictionId: 'prediction-a', previousSecurityId: null,
      previousOtherSymbol: 'MSFT', previousTopic: null, previousSymbolSnapshot: 'MSFT',
      previousSymbolNormalizedSnapshot: 'MSFT', previousType: 'DIRECTION', previousDirection: 'RISES',
      previousClaimText: 'Old', previousEventLabel: null, previousDeadline: new Date('2026-09-26T00:00:00.000Z'),
      previousConfidence: 70, previousPriceAtPrediction: null, previousPriceCapturedAt: null,
      previousPredictedPrice: null, previousPredictedPercent: null, changedFields: ['claimText'], changedAt: earlier,
    }],
    resultHistory: [{
      id: 'result-1', predictionId: 'prediction-a', previousResult: 'CORRECT',
      previousResolutionDate: new Date('2026-09-25T00:00:00.000Z'), previousActualPrice: null, previousOutcomeNotes: null,
      newResult: 'INCORRECT', newResolutionDate: new Date('2026-09-26T00:00:00.000Z'),
      newActualPrice: null, newOutcomeNotes: null, changedAt: later,
    }],
    reasoningHistory: [{
      id: 'reasoning-1', predictionId: 'prediction-a', previousReasoning: 'old',
      newReasoning: 'new', changedAt: later,
    }],
  }
  state.histories.amendmentHistory.push({
    ...state.histories.amendmentHistory[0],
    id: 'amend-2',
    changedAt: later,
  })
  state.histories.resultHistory.unshift({
    ...state.histories.resultHistory[0],
    id: 'result-older',
    changedAt: earlier,
  })
  state.histories.reasoningHistory.unshift({
    ...state.histories.reasoningHistory[0],
    id: 'reasoning-older',
    changedAt: earlier,
  })
  state.currentResultChanged = true
  const app = await buildApp(state)
  const response = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions/prediction-a' })
  const payload = JSON.parse(response.payload)

  assert.equal(response.statusCode, 200)
  assert.equal(payload.prediction.resultChanged, true)
  assert.deepEqual(payload.amendmentHistory.map((history: { id: string }) => history.id), ['amend-1', 'amend-2'])
  assert.deepEqual(payload.resultHistory.map((history: { id: string }) => history.id), ['result-older', 'result-1'])
  assert.deepEqual(payload.reasoningHistory.map((history: { id: string }) => history.id), ['reasoning-older', 'reasoning-1'])
  assert.equal(payload.gracePeriodEndsAt, new Date(state.current.createdAt.getTime() + 5 * 60000).toISOString())

  state.current = prediction({ organizationId: 'org-b' })
  const otherOrganization = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions/prediction-a' })
  assert.equal(otherOrganization.statusCode, 404)
  assert.deepEqual(JSON.parse(otherOrganization.payload), { code: 'not_found', message: 'Prediction not found.' })

  state.current = prediction({ userId: 'user-b' })
  const otherUser = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions/prediction-a' })
  assert.equal(otherUser.statusCode, 404)
  await app.close()
})

test('maps amendment confirmation, then passes confirmed and reasoning-only updates to the store', async () => {
  const state = createState()
  const app = await buildApp(state)
  state.current = prediction({ createdAt: new Date(Date.now() - 4 * 60 * 1000) })
  state.updateOutcome = { status: 'updated', prediction: state.current }
  const withinGrace = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { claimText: 'Corrected during the grace window' },
  })
  assert.equal(withinGrace.statusCode, 200)
  assert.equal(state.updateInputs[0].confirmAmendment, undefined)

  state.current = prediction({ createdAt: new Date(Date.now() - 6 * 60 * 1000) })
  state.updateOutcome = { status: 'amend_confirmation_required', changedFields: ['claimText'] }
  const claimEdit = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { claimText: 'Changed claim' },
  })
  assert.equal(claimEdit.statusCode, 409)
  assert.deepEqual(JSON.parse(claimEdit.payload).changedFields, ['claimText'])
  assert.equal(state.updateInputs[1].confirmAmendment, undefined)

  state.updateOutcome = { status: 'updated', prediction: state.current }
  const confirmed = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { claimText: 'Changed claim', confirmAmend: true },
  })
  assert.equal(confirmed.statusCode, 200)
  assert.equal(state.updateInputs[2].confirmAmendment, true)

  const reasoning = '  unchanged whitespace **matters**\n'
  const reasoningOnly = await app.inject({
    method: 'PATCH',
    url: '/api/intuition-ledger/predictions/prediction-a',
    payload: { reasoning },
  })
  assert.equal(reasoningOnly.statusCode, 200)
  assert.equal(JSON.parse(reasoningOnly.payload).prediction.amended, false)
  assert.equal(state.updateInputs[3].reasoning, reasoning)
  assert.equal(state.updateInputs[3].confirmAmendment, undefined)
  await app.close()
})

test('derives target-price direction and rejects equal or direction-inconsistent targets', async () => {
  const state = createState()
  const app = await buildApp(state)
  const body = requestBody({
    type: 'TARGET_PRICE',
    direction: undefined,
    predictedPercent: undefined,
    predictedPrice: '110',
  })
  const created = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions', payload: body })
  assert.equal(created.statusCode, 201)
  assert.equal(state.createInput?.direction, 'RISES')
  assert.equal(state.createInput?.predictedPercent, '10')

  const equalTarget = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions',
    payload: { ...body, predictedPrice: '100' },
  })
  assert.equal(equalTarget.statusCode, 400)
  assert.equal(JSON.parse(equalTarget.payload).code, 'validation_error')
  await app.close()
})

test('records results with validated local date and maps store eligibility/date conflicts', async () => {
  const state = createState()
  const today = new Date().toISOString().slice(0, 10)
  const app = await buildApp(state)
  state.resultOutcome = { status: 'deadline_not_passed' }
  const early = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions/prediction-a/result',
    payload: { result: 'INCORRECT', resolutionDate: today, asOfLocalDate: today },
  })
  assert.equal(early.statusCode, 409)
  assert.equal(JSON.parse(early.payload).code, 'deadline_not_passed')
  const earlyCorrect = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions/prediction-a/result',
    payload: { result: 'CORRECT', resolutionDate: today, asOfLocalDate: today },
  })
  assert.equal(earlyCorrect.statusCode, 409)
  assert.equal(JSON.parse(earlyCorrect.payload).code, 'deadline_not_passed')
  assert.equal(state.resultInput?.organizationId, 'org-a')
  assert.equal(state.resultInput?.userId, 'user-a')

  state.resultOutcome = { status: 'resolution_date_out_of_range' }
  const outOfRange = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions/prediction-a/result',
    payload: { result: 'CORRECT', resolutionDate: today, asOfLocalDate: today },
  })
  assert.equal(outOfRange.statusCode, 400)
  assert.equal(JSON.parse(outOfRange.payload).code, 'resolution_date_out_of_range')

  const invalidLocalDate = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions/prediction-a/result',
    payload: { result: 'CORRECT', resolutionDate: today, asOfLocalDate: '2000-01-01' },
  })
  assert.equal(invalidLocalDate.statusCode, 400)
  assert.equal(JSON.parse(invalidLocalDate.payload).code, 'validation_error')

  state.resultOutcome = { status: 'updated', prediction: state.current }
  const recorded = await app.inject({
    method: 'POST',
    url: '/api/intuition-ledger/predictions/prediction-a/result',
    payload: { result: 'CORRECT', resolutionDate: today, asOfLocalDate: today, outcomeNotes: '  raw **notes**  ' },
  })
  assert.equal(recorded.statusCode, 200)
  assert.equal(state.resultInput?.outcomeNotes, '  raw **notes**  ')
  await app.close()
})

test('maps lifecycle, result clearing, and delete conflict outcomes', async () => {
  const state = createState()
  const app = await buildApp(state)
  const clear = await app.inject({ method: 'DELETE', url: '/api/intuition-ledger/predictions/prediction-a/result' })
  assert.equal(clear.statusCode, 200)

  state.voidOutcome = { status: 'already_voided' }
  const alreadyVoid = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions/prediction-a/void', payload: {} })
  assert.equal(alreadyVoid.statusCode, 409)
  assert.equal(JSON.parse(alreadyVoid.payload).code, 'already_voided')

  state.voidOutcome = { status: 'updated', prediction: state.current }
  const voided = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions/prediction-a/void', payload: { voidReason: '  no longer useful  ' } })
  assert.equal(voided.statusCode, 200)

  state.restoreOutcome = { status: 'updated', prediction: state.current }
  const restored = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions/prediction-a/restore', payload: {} })
  assert.equal(restored.statusCode, 200)

  state.restoreOutcome = { status: 'not_voided' }
  const restore = await app.inject({ method: 'POST', url: '/api/intuition-ledger/predictions/prediction-a/restore', payload: {} })
  assert.equal(restore.statusCode, 409)
  assert.equal(JSON.parse(restore.payload).code, 'not_voided')

  state.deleteOutcome = { status: 'not_voided' }
  const remove = await app.inject({ method: 'DELETE', url: '/api/intuition-ledger/predictions/prediction-a' })
  assert.equal(remove.statusCode, 409)
  assert.equal(JSON.parse(remove.payload).code, 'not_voided')

  state.deleteOutcome = { status: 'deleted' }
  const deleted = await app.inject({ method: 'DELETE', url: '/api/intuition-ledger/predictions/prediction-a' })
  assert.equal(deleted.statusCode, 200)
  assert.deepEqual(JSON.parse(deleted.payload), { success: true, deletedPredictionId: 'prediction-a' })
  await app.close()
})

test('scopes suggestions and due counts to verified auth and validates their queries', async () => {
  const state = createState()
  const app = await buildApp(state)
  const symbols = await app.inject({ method: 'GET', url: '/api/intuition-ledger/suggestions/other-symbols?q= nvda ' })
  assert.equal(symbols.statusCode, 200)
  assert.deepEqual(JSON.parse(symbols.payload).symbols, ['NVDA', 'ONDS'])
  assert.equal(state.otherSuggestionInput?.organizationId, 'org-a')
  assert.equal(state.otherSuggestionInput?.userId, 'user-a')
  assert.equal(state.otherSuggestionInput?.query, 'NVDA')

  const tags = await app.inject({ method: 'GET', url: '/api/intuition-ledger/suggestions/tags?q=ear&limit=5' })
  assert.equal(tags.statusCode, 200)
  assert.equal(state.tagSuggestionInput?.limit, 5)

  const today = new Date().toISOString().slice(0, 10)
  const due = await app.inject({ method: 'GET', url: `/api/intuition-ledger/due-count?asOfLocalDate=${today}` })
  assert.equal(due.statusCode, 200)
  assert.deepEqual(JSON.parse(due.payload), { dueCount: 2 })
  assert.equal(state.countInput?.organizationId, 'org-a')
  assert.equal(state.countInput?.userId, 'user-a')

  const repeated = await app.inject({ method: 'GET', url: `/api/intuition-ledger/due-count?asOfLocalDate=${today}&asOfLocalDate=${today}` })
  assert.equal(repeated.statusCode, 400)
  await app.close()
})

test('returns scoped dashboard stats and groups Security Master and Other symbols together', async () => {
  const state = createState()
  state.statsRecords = [
    statsRecord({
      id: 'correct-msft', type: 'DIRECTION', result: 'CORRECT', resolutionDate: new Date('2026-09-27T00:00:00.000Z'),
      confidence: 80, symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT', direction: 'RISES',
      priceAtPrediction: '100', predictedPrice: '110', predictedPercent: '10', actualPrice: '111',
    }),
    statsRecord({
      id: 'amended-other-msft', type: 'PERCENT_MOVE', result: 'INCORRECT', resolutionDate: new Date('2026-09-27T00:00:00.000Z'),
      amended: true, confidence: 90, otherSymbol: 'MSFT', symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT', direction: 'FALLS',
      priceAtPrediction: '100', predictedPrice: '90', predictedPercent: '10', actualPrice: '95',
    }),
    statsRecord({
      id: 'voided', result: 'CORRECT', voidedAt: new Date('2026-09-27T00:00:00.000Z'),
      resolutionDate: new Date('2026-09-27T00:00:00.000Z'), confidence: 70,
    }),
    statsRecord({ id: 'due', deadline: new Date('2026-09-26T00:00:00.000Z') }),
    statsRecord({ id: 'open', deadline: new Date('2026-09-28T00:00:00.000Z') }),
    statsRecord({ id: 'other-user', organizationId: 'org-a', userId: 'user-b', result: 'CORRECT', resolutionDate: new Date('2026-09-27T00:00:00.000Z'), symbolNormalizedSnapshot: 'NVDA' }),
    statsRecord({ id: 'other-organization', organizationId: 'org-b', userId: 'user-a', result: 'CORRECT', resolutionDate: new Date('2026-09-27T00:00:00.000Z'), symbolNormalizedSnapshot: 'TSLA' }),
  ]
  const app = await buildApp(state, new Date('2026-09-27T12:00:00.000Z'))
  const response = await app.inject({
    method: 'GET',
    url: '/api/intuition-ledger/stats?period=week&amended=include&asOfLocalDate=2026-09-27',
  })
  const payload = JSON.parse(response.payload)

  assert.equal(response.statusCode, 200)
  assert.deepEqual(state.statsInput, { organizationId: 'org-a', userId: 'user-a' })
  assert.deepEqual(payload.summary, { open: 1, due: 1, resolved: 2, voided: 1 })
  assert.deepEqual(payload.hitRate, { numerator: 1, denominator: 2, value: 0.5 })
  assert.deepEqual(payload.bySymbol, [{
    symbol: 'MSFT', symbolNormalized: 'MSFT', correct: 1, incorrect: 1, count: 2, hitRate: 0.5,
  }])
  assert.deepEqual(payload.timeSeries, [{
    bucketStart: '2026-09-27', bucketEnd: '2026-10-03', correct: 1, incorrect: 1, count: 2, hitRate: 0.5,
  }])
  assert.equal(payload.calibration.find((bucket: { bucket: string }) => bucket.bucket === '80-89').count, 1)
  assert.equal(payload.calibration.find((bucket: { bucket: string }) => bucket.bucket === '80-89').lowSample, true)
  assert.deepEqual(payload.scatterPoints.map((point: { predictedPercent: number; actualPercent: number }) => [point.predictedPercent, point.actualPercent]), [[10, 11], [-10, -5]])

  const excludingAmended = await app.inject({
    method: 'GET',
    url: '/api/intuition-ledger/stats?period=month&amended=exclude&asOfLocalDate=2026-09-27',
  })
  const excludedPayload = JSON.parse(excludingAmended.payload)
  assert.equal(excludingAmended.statusCode, 200)
  assert.deepEqual(excludedPayload.hitRate, { numerator: 1, denominator: 1, value: 1 })
  assert.deepEqual(excludedPayload.summary, payload.summary)
  assert.deepEqual(excludedPayload.bySymbol.map((item: { symbolNormalized: string }) => item.symbolNormalized), ['MSFT'])
  assert.equal(excludedPayload.timeSeries[0].bucketStart, '2026-09-01')
  assert.equal(excludedPayload.scatterPoints.length, 1)
  await app.close()
})

test('empty dashboard stats are explicitly unavailable and reject invalid queries', async () => {
  const state = createState()
  const app = await buildApp(state, new Date('2026-09-27T12:00:00.000Z'))
  const empty = await app.inject({
    method: 'GET',
    url: '/api/intuition-ledger/stats?period=week&asOfLocalDate=2026-09-27',
  })
  const payload = JSON.parse(empty.payload)
  assert.equal(empty.statusCode, 200)
  assert.deepEqual(payload.hitRate, { numerator: 0, denominator: 0, value: null })
  assert.equal(payload.calibration.length, 5)
  assert.ok(payload.calibration.every((bucket: { count: number; hitRate: number | null; lowSample: boolean }) =>
    bucket.count === 0 && bucket.hitRate === null && bucket.lowSample,
  ))
  assert.deepEqual(payload.byType, [])
  assert.deepEqual(payload.bySymbol, [])
  assert.deepEqual(payload.timeSeries, [])
  assert.deepEqual(payload.scatterPoints, [])

  const repeated = await app.inject({ method: 'GET', url: '/api/intuition-ledger/stats?period=week&period=month&asOfLocalDate=2026-09-27' })
  const unknown = await app.inject({ method: 'GET', url: '/api/intuition-ledger/stats?period=week&asOfLocalDate=2026-09-27&unexpected=1' })
  const invalidDate = await app.inject({ method: 'GET', url: '/api/intuition-ledger/stats?period=week&asOfLocalDate=2000-01-01' })
  assert.equal(repeated.statusCode, 400)
  assert.equal(unknown.statusCode, 400)
  assert.equal(invalidDate.statusCode, 400)
  await app.close()
})

test('propagates unexpected store failures as server errors', async () => {
  const state = createState()
  state.listFailure = new Error('database unavailable')
  const app = await buildApp(state)
  const response = await app.inject({ method: 'GET', url: '/api/intuition-ledger/predictions' })
  assert.equal(response.statusCode, 500)
  state.statsFailure = new Error('stats unavailable')
  const stats = await app.inject({ method: 'GET', url: '/api/intuition-ledger/stats?period=week&asOfLocalDate=' + new Date().toISOString().slice(0, 10) })
  assert.equal(stats.statusCode, 500)
  await app.close()
})