import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import {
  createPredictionStore,
  createSecurityStore,
  getPrismaClient,
  type Prediction,
  type PredictionAmendment,
  type PredictionReasoningHistory,
  type PredictionResultHistory,
  type PredictionStatsRecord,
  type PredictionStore,
  type SecurityStore,
} from '@portfolio-engineering/database'
import {
  derivePercentChange,
  derivePredictedValuesFromPercent,
  deriveTargetPriceDetails,
  deriveDirectionFromPrice,
  derivePredictionStatus,
  getGracePeriodEndsAt,
  calculateCalibrationBuckets,
  calculateHitRate,
  groupResolvedPredictionsByPeriod,
  normalizePredictionSymbol,
} from '@portfolio-engineering/domain'
import type {
  CreatePredictionRequest,
  PredictionDashboardStatsQuery,
  PredictionDashboardStatsResponse,
  PredictionType,
} from '@portfolio-engineering/shared-types/intuitionLedger'
import {
  clearPredictionResultSchema,
  createPredictionSchema,

  predictionDeleteResponseSchema,
  deletePredictionSchema,
  predictionDetailResponseSchema,
  predictionDueCountQuerySchema,
  predictionDueCountResponseSchema,
  predictionDashboardStatsQuerySchema,
  predictionDashboardStatsResponseSchema,
  predictionErrorResponseSchema,
  predictionIdParamsSchema,
  predictionListQuerySchema,
  predictionListResponseSchema,
  predictionMutationResponseSchema,
  predictionOtherSymbolSuggestionsResponseSchema,
  predictionSuggestionQuerySchema,
  predictionTagSuggestionsResponseSchema,
  recordPredictionResultSchema,
  restorePredictionSchema,
  updatePredictionSchema,
  voidPredictionSchema,
} from '@portfolio-engineering/validation/intuitionLedger'

const defaultPredictionStore = createPredictionStore(getPrismaClient())
const defaultSecurityStore = createSecurityStore(getPrismaClient())
const DAY_MS = 24 * 60 * 60 * 1000

type RouteOptions = {
  predictionStore?: PredictionStore
  securityStore?: SecurityStore
  now?: () => Date
}

function validationError(
  error: { issues: Array<{ message: string; path: PropertyKey[] }> },
  reply: FastifyReply,
) {
  reply.code(400)
  const fieldErrors: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? '_form')
    ;(fieldErrors[field] ??= []).push(issue.message)
  }
  return predictionErrorResponseSchema.parse({
    code: 'validation_error',
    message: error.issues.map((issue) => issue.message).join('; '),
    fieldErrors,
  })
}

function errorResponse(
  reply: FastifyReply,
  status: number,
  code: 'invalid_security_reference' | 'not_found' | 'amend_confirmation_required' | 'deadline_not_passed' | 'resolution_date_out_of_range' | 'already_voided' | 'not_voided',
  message: string,
  changedFields?: string[],
) {
  reply.code(status)
  return predictionErrorResponseSchema.parse({
    code,
    message,
    ...(changedFields === undefined ? {} : { changedFields }),
  })
}

function readRawQuery(request: { query: unknown; raw: { url?: string } }): Record<string, unknown> {
  const input = request.query !== null && typeof request.query === 'object'
    ? { ...(request.query as Record<string, unknown>) }
    : {}
  if (!request.raw.url) return input

  try {
    const searchParams = new URL(request.raw.url, 'http://localhost').searchParams
    for (const key of new Set(searchParams.keys())) {
      const values = searchParams.getAll(key)
      input[key] = values.length === 1 ? values[0] : values
    }
    return input
  } catch {
    return { __invalidQuery: true }
  }
}

function isPlausibleLocalDate(value: string, now: Date): boolean {
  const serverDate = now.toISOString().slice(0, 10)
  const lower = new Date(`${serverDate}T00:00:00.000Z`)
  const upper = new Date(lower)
  lower.setTime(lower.getTime() - DAY_MS)
  upper.setTime(upper.getTime() + DAY_MS)
  const earliest = lower.toISOString().slice(0, 10)
  const latest = upper.toISOString().slice(0, 10)
  return value >= earliest && value <= latest
}

function validateLocalDate(value: string | undefined, now: Date, reply: FastifyReply) {
  if (value !== undefined && !isPlausibleLocalDate(value, now)) {
    reply.code(400)
    return predictionErrorResponseSchema.parse({
      code: 'validation_error',
      message: 'The local date must be within one day of the current server date.',
      fieldErrors: { asOfLocalDate: ['The local date is outside the allowed range.'] },
    })
  }
  return null
}

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function timestamp(value: Date | null): string | null {
  return value?.toISOString() ?? null
}

function decimalString(value: { toString(): string } | null): string | null {
  return value?.toString() ?? null
}

function mapPrediction(prediction: Prediction) {
  return {
    id: prediction.id,
    organizationId: prediction.organizationId,
    userId: prediction.userId,
    securityId: prediction.securityId,
    otherSymbol: prediction.otherSymbol,
    topic: prediction.topic,
    symbolSnapshot: prediction.symbolSnapshot,
    symbolNormalizedSnapshot: prediction.symbolNormalizedSnapshot,
    type: prediction.type,
    direction: prediction.direction,
    claimText: prediction.claimText,
    eventLabel: prediction.eventLabel,
    deadline: dateOnly(prediction.deadline),
    confidence: prediction.confidence,
    priceAtPrediction: decimalString(prediction.priceAtPrediction),
    predictedPrice: decimalString(prediction.predictedPrice),
    predictedPercent: decimalString(prediction.predictedPercent),
    priceCapturedAt: timestamp(prediction.priceCapturedAt),
    reasoning: prediction.reasoning,
    tags: prediction.tags,
    result: prediction.result,
    resolutionDate: prediction.resolutionDate ? dateOnly(prediction.resolutionDate) : null,
    actualPrice: decimalString(prediction.actualPrice),
    outcomeNotes: prediction.outcomeNotes,
    voidedAt: timestamp(prediction.voidedAt),
    voidReason: prediction.voidReason,
    amended: prediction.amended,
    amendedAt: timestamp(prediction.amendedAt),
    createdAt: prediction.createdAt.toISOString(),
    updatedAt: prediction.updatedAt.toISOString(),
  }
}

function mapPredictionReadRecord(prediction: Prediction & { resultChanged: boolean }) {
  return {
    ...mapPrediction(prediction),
    resultChanged: prediction.resultChanged,
  }
}

function mapAmendment(history: PredictionAmendment) {
  return {
    id: history.id,
    predictionId: history.predictionId,
    previousSecurityId: history.previousSecurityId,
    previousOtherSymbol: history.previousOtherSymbol,
    previousTopic: history.previousTopic,
    previousSymbolSnapshot: history.previousSymbolSnapshot,
    previousSymbolNormalizedSnapshot: history.previousSymbolNormalizedSnapshot,
    previousType: history.previousType,
    previousDirection: history.previousDirection,
    previousClaimText: history.previousClaimText,
    previousEventLabel: history.previousEventLabel,
    previousDeadline: dateOnly(history.previousDeadline),
    previousConfidence: history.previousConfidence,
    previousPriceAtPrediction: decimalString(history.previousPriceAtPrediction),
    previousPriceCapturedAt: timestamp(history.previousPriceCapturedAt),
    previousPredictedPrice: decimalString(history.previousPredictedPrice),
    previousPredictedPercent: decimalString(history.previousPredictedPercent),
    changedFields: history.changedFields,
    changedAt: history.changedAt.toISOString(),
  }
}

function mapResultHistory(history: PredictionResultHistory) {
  return {
    id: history.id,
    predictionId: history.predictionId,
    previousResult: history.previousResult,
    previousResolutionDate: history.previousResolutionDate ? dateOnly(history.previousResolutionDate) : null,
    previousActualPrice: decimalString(history.previousActualPrice),
    previousOutcomeNotes: history.previousOutcomeNotes,
    newResult: history.newResult,
    newResolutionDate: history.newResolutionDate ? dateOnly(history.newResolutionDate) : null,
    newActualPrice: decimalString(history.newActualPrice),
    newOutcomeNotes: history.newOutcomeNotes,
    changedAt: history.changedAt.toISOString(),
  }
}

function mapReasoningHistory(history: PredictionReasoningHistory) {
  return {
    id: history.id,
    predictionId: history.predictionId,
    previousReasoning: history.previousReasoning,
    newReasoning: history.newReasoning,
    changedAt: history.changedAt.toISOString(),
  }
}

function normalizeOtherSymbol<T extends { otherSymbol?: string | null }>(input: T): T | null {
  if (input.otherSymbol === undefined || input.otherSymbol === null) return input
  const symbol = normalizePredictionSymbol(input.otherSymbol)
  return symbol ? { ...input, otherSymbol: symbol } : null
}

function derivedDecimal(value: number): string {
  return Number(value.toFixed(8)).toString()
}

function deriveClaim(input: CreatePredictionRequest): CreatePredictionRequest {
  const price = input.priceAtPrediction === undefined || input.priceAtPrediction === null
    ? null
    : Number(input.priceAtPrediction)
  let direction = input.direction ?? null
  let predictedPrice = input.predictedPrice ?? null
  let predictedPercent = input.predictedPercent ?? null

  if (input.type === 'TARGET_PRICE' && price !== null && predictedPrice !== null) {
    const target = deriveTargetPriceDetails(price, Number(predictedPrice))
    direction = target.direction
    predictedPercent = derivedDecimal(target.predictedPercent)
  } else if (
    (input.type === 'PERCENT_MOVE' || input.type === 'EVENT_REACTION') &&
    price !== null
  ) {
    if (predictedPercent !== null && direction !== null) {
      const derived = derivePredictedValuesFromPercent(price, Number(predictedPercent), direction)
      predictedPrice = derivedDecimal(derived.predictedPrice)
      predictedPercent = derivedDecimal(derived.predictedPercent)
    } else if (predictedPrice !== null && direction !== null) {
      const targetDirection = deriveDirectionFromPrice(price, Number(predictedPrice))
      if (targetDirection !== direction) {
        throw new RangeError('Predicted price does not match the selected direction.')
      }
      predictedPercent = derivedDecimal(Math.abs(derivePercentChange(price, Number(predictedPrice))))
    }
  }

  return { ...input, direction, predictedPrice, predictedPercent }
}

function domainValidationError(error: unknown, reply: FastifyReply) {
  if (!(error instanceof RangeError)) throw error
  reply.code(400)
  return predictionErrorResponseSchema.parse({
    code: 'validation_error',
    message: error.message,
    fieldErrors: { predictedPrice: [error.message] },
  })
}

function typeFromFilter(type: string | undefined): PredictionType | undefined {
  switch (type) {
    case 'direction': return 'DIRECTION'
    case 'percent_move': return 'PERCENT_MOVE'
    case 'target_price': return 'TARGET_PRICE'
    case 'event_reaction': return 'EVENT_REACTION'
    case 'freeform': return 'FREEFORM'
    default: return undefined
  }
}

function resultFromFilter(result: string | undefined) {
  switch (result) {
    case 'correct': return 'CORRECT'
    case 'incorrect': return 'INCORRECT'
    default: return undefined
  }
}

function dashboardStats(
  records: PredictionStatsRecord[],
  query: PredictionDashboardStatsQuery,
): PredictionDashboardStatsResponse {
  const summary = { open: 0, due: 0, resolved: 0, voided: 0 }
  for (const record of records) {
    const status = derivePredictionStatus({
      deadline: dateOnly(record.deadline),
      asOfLocalDate: query.asOfLocalDate,
      hasResult: record.result !== null,
      isVoided: record.voidedAt !== null,
    })
    if (status === 'void') summary.voided += 1
    else summary[status] += 1
  }

  const analytics = records.filter((record) =>
    record.voidedAt === null && (query.amended !== 'exclude' || !record.amended),
  )
  const resolved = analytics.flatMap((record) =>
    record.result !== null && record.resolutionDate !== null
      ? [{ record, result: record.result, resolutionDate: dateOnly(record.resolutionDate) }]
      : [],
  )
  const correct = resolved.filter((item) => item.result === 'CORRECT').length
  const incorrect = resolved.length - correct
  const hitRate = calculateHitRate(correct, incorrect)
  const calibration = calculateCalibrationBuckets(resolved.map(({ record, result }) => ({
    confidence: record.confidence,
    result,
  })))

  const typeGroups = new Map<PredictionType, { correct: number; incorrect: number }>()
  const symbolGroups = new Map<string, { correct: number; incorrect: number }>()
  for (const { record, result } of resolved) {
    const typeGroup = typeGroups.get(record.type) ?? { correct: 0, incorrect: 0 }
    typeGroup[result === 'CORRECT' ? 'correct' : 'incorrect'] += 1
    typeGroups.set(record.type, typeGroup)

    const symbol = record.symbolNormalizedSnapshot ?? record.symbolSnapshot ?? record.otherSymbol
    const symbolNormalized = symbol === null ? '' : normalizePredictionSymbol(symbol)
    if (symbolNormalized) {
      const symbolGroup = symbolGroups.get(symbolNormalized) ?? { correct: 0, incorrect: 0 }
      symbolGroup[result === 'CORRECT' ? 'correct' : 'incorrect'] += 1
      symbolGroups.set(symbolNormalized, symbolGroup)
    }
  }

  const byType = [...typeGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([type, counts]) => ({
      type,
      ...counts,
      count: counts.correct + counts.incorrect,
      hitRate: calculateHitRate(counts.correct, counts.incorrect).value,
    }))
  const bySymbol = [...symbolGroups.entries()]
    .map(([symbolNormalized, counts]) => ({
      symbol: symbolNormalized,
      symbolNormalized,
      ...counts,
      count: counts.correct + counts.incorrect,
      hitRate: calculateHitRate(counts.correct, counts.incorrect).value,
    }))
    .sort((left, right) => right.count - left.count || left.symbolNormalized.localeCompare(right.symbolNormalized))
  const timeSeries = groupResolvedPredictionsByPeriod(
    resolved.map(({ resolutionDate, result }) => ({ resolutionDate, result })),
    query.period,
  )
  const scatterPoints = analytics.flatMap((record) => {
    const priceAtPrediction = record.priceAtPrediction === null ? null : Number(record.priceAtPrediction.toString())
    const predictedPrice = record.predictedPrice === null ? null : Number(record.predictedPrice.toString())
    const predictedPercent = record.predictedPercent === null ? null : Number(record.predictedPercent.toString())
    const actualPrice = record.actualPrice === null ? null : Number(record.actualPrice.toString())
    if (
      record.result === null ||
      priceAtPrediction === null ||
      predictedPrice === null ||
      predictedPercent === null ||
      actualPrice === null ||
      record.direction === null
    ) return []
    const symbol = record.symbolNormalizedSnapshot ?? record.symbolSnapshot ?? record.otherSymbol
    return [{
      predictionId: record.id,
      symbol: symbol === null ? null : normalizePredictionSymbol(symbol) || null,
      predictedPercent: Math.abs(predictedPercent) * (record.direction === 'FALLS' ? -1 : 1),
      actualPercent: derivePercentChange(priceAtPrediction, actualPrice),
    }]
  })

  return {
    summary,
    hitRate,
    calibration: calibration.map(({ bucket, count, correct, hitRate: bucketHitRate, lowSample }) => ({
      bucket, count, correct, hitRate: bucketHitRate, lowSample,
    })),
    byType,
    bySymbol,
    timeSeries,
    scatterPoints,
  }
}

export function createIntuitionLedgerRoutes(options: RouteOptions = {}): FastifyPluginAsync {
  const predictionStore = options.predictionStore ?? defaultPredictionStore
  const securityStore = options.securityStore ?? defaultSecurityStore
  const now = options.now ?? (() => new Date())

  return async (app) => {
    app.get<{ Querystring: Record<string, unknown> }>(
      '/api/intuition-ledger/predictions',
      async (request, reply) => {
        const parsed = predictionListQuerySchema.safeParse(readRawQuery(request))
        if (!parsed.success) return validationError(parsed.error, reply)
        const localDateError = validateLocalDate(parsed.data.asOfLocalDate, now(), reply)
        if (localDateError) return localDateError

        const result = await predictionStore.list({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          type: typeFromFilter(parsed.data.type),
          amended: parsed.data.amended === 'only' ? true : parsed.data.amended === 'exclude' ? false : undefined,
          symbolNormalized: parsed.data.symbol,
          tag: parsed.data.tag,
          q: parsed.data.q,
          includeVoided: true,
          orderBy: 'deadline_asc',
        })

        const status = parsed.data.status ?? 'active'
        const predictions = result.predictions.filter((prediction) => {
          const predictionStatus = parsed.data.asOfLocalDate
            ? derivePredictionStatus({
                deadline: dateOnly(prediction.deadline),
                asOfLocalDate: parsed.data.asOfLocalDate,
                hasResult: prediction.result !== null,
                isVoided: prediction.voidedAt !== null,
              })
            : prediction.voidedAt !== null
              ? 'void'
              : prediction.result !== null
                ? 'resolved'
                : 'open'
          if (status === 'active' && predictionStatus === 'void') return false
          if (status !== 'active' && status !== 'all' && predictionStatus !== status) return false
          if (parsed.data.result && prediction.result !== resultFromFilter(parsed.data.result)) return false
          return true
        })

        return predictionListResponseSchema.parse({
          predictions: predictions.map(mapPredictionReadRecord),
          filteredCount: predictions.length,
          totalCount: result.totalCount,
        })
      },
    )

    app.get<{ Params: Record<string, unknown> }>(
      '/api/intuition-ledger/predictions/:predictionId',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        if (!params.success) return validationError(params.error, reply)
        const result = await predictionStore.findWithHistories({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
        })
        if (!result) return errorResponse(reply, 404, 'not_found', 'Prediction not found.')

        return predictionDetailResponseSchema.parse({
          prediction: mapPredictionReadRecord(result.prediction),
          amendmentHistory: result.amendmentHistory.map(mapAmendment),
          resultHistory: result.resultHistory.map(mapResultHistory),
          reasoningHistory: result.reasoningHistory.map(mapReasoningHistory),
          gracePeriodEndsAt: getGracePeriodEndsAt(result.prediction.createdAt).toISOString(),
        })
      },
    )

    app.post<{ Body: unknown }>('/api/intuition-ledger/predictions', async (request, reply) => {
      const parsed = createPredictionSchema.safeParse(request.body)
      if (!parsed.success) return validationError(parsed.error, reply)
      const normalized = normalizeOtherSymbol(parsed.data)
      if (!normalized) {
        reply.code(400)
        return predictionErrorResponseSchema.parse({
          code: 'validation_error',
          message: 'Other symbol must not be blank.',
          fieldErrors: { otherSymbol: ['Enter a symbol.'] },
        })
      }
      if (normalized.securityId) {
        const security = await securityStore.find({
          organizationId: request.user.organizationId,
          securityId: normalized.securityId,
        })
        if (!security?.active) {
          return errorResponse(reply, 400, 'invalid_security_reference', 'Choose an active security in this organization.')
        }
      }

      let derived: CreatePredictionRequest
      try {
        derived = deriveClaim(normalized)
      } catch (error) {
        return domainValidationError(error, reply)
      }
      const result = await predictionStore.create({
        organizationId: request.user.organizationId,
        userId: request.user.sub,
        ...derived,
      })
      if (result.status === 'invalid_security_reference') {
        return errorResponse(reply, 400, 'invalid_security_reference', 'Choose an active security in this organization.')
      }

      reply.code(201)
      return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
    })

    app.patch<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = updatePredictionSchema.safeParse(request.body)
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)

        const current = await predictionStore.find({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
        })
        if (!current) return errorResponse(reply, 404, 'not_found', 'Prediction not found.')

        const { confirmAmend, ...updates } = body.data
        if (updates.type === 'TARGET_PRICE' && updates.direction !== undefined && updates.direction !== null) {
          reply.code(400)
          return predictionErrorResponseSchema.parse({
            code: 'validation_error',
            message: 'Target price direction is derived from its target price.',
            fieldErrors: { direction: ['Target price direction is derived from its target price.'] },
          })
        }
        const candidate = {
          securityId: current.securityId,
          otherSymbol: current.otherSymbol,
          topic: current.topic,
          type: current.type,
          direction: current.type === 'TARGET_PRICE' ? null : current.direction,
          claimText: current.claimText,
          eventLabel: current.eventLabel,
          deadline: dateOnly(current.deadline),
          confidence: current.confidence,
          priceAtPrediction: decimalString(current.priceAtPrediction),
          priceCapturedAt: timestamp(current.priceCapturedAt),
          predictedPrice: decimalString(current.predictedPrice),
          predictedPercent: decimalString(current.predictedPercent),
          reasoning: current.reasoning,
          tags: current.tags,
          ...updates,
        }
        if (candidate.type === 'TARGET_PRICE' && updates.direction === undefined) candidate.direction = null
        const validated = createPredictionSchema.safeParse(candidate)
        if (!validated.success) return validationError(validated.error, reply)
        const normalized = normalizeOtherSymbol(validated.data)
        if (!normalized) {
          reply.code(400)
          return predictionErrorResponseSchema.parse({
            code: 'validation_error',
            message: 'Other symbol must not be blank.',
            fieldErrors: { otherSymbol: ['Enter a symbol.'] },
          })
        }

        if (normalized.securityId) {
          const security = await securityStore.find({
            organizationId: request.user.organizationId,
            securityId: normalized.securityId,
          })
          if (!security || (normalized.securityId !== current.securityId && !security.active)) {
            return errorResponse(reply, 400, 'invalid_security_reference', 'Choose an active security in this organization.')
          }
        }

        let derived: CreatePredictionRequest
        try {
          derived = deriveClaim(normalized)
        } catch (error) {
          return domainValidationError(error, reply)
        }
        const result = await predictionStore.update({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
          ...derived,
          confirmAmendment: confirmAmend,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        if (result.status === 'invalid_security_reference') {
          return errorResponse(reply, 400, 'invalid_security_reference', 'Choose a security in this organization.')
        }
        if (result.status === 'amend_confirmation_required') {
          return errorResponse(
            reply,
            409,
            'amend_confirmation_required',
            'Confirm that this claim change should mark the prediction Amended.',
            result.changedFields,
          )
        }
        return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
      },
    )

    app.post<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId/result',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = recordPredictionResultSchema.safeParse(request.body)
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)
        const localDateError = validateLocalDate(body.data.asOfLocalDate, now(), reply)
        if (localDateError) return localDateError

        const result = await predictionStore.recordResult({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
          ...body.data,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        if (result.status === 'deadline_not_passed') {
          return errorResponse(reply, 409, 'deadline_not_passed', 'The deadline has not passed yet.')
        }
        if (result.status === 'resolution_date_out_of_range') {
          return errorResponse(reply, 400, 'resolution_date_out_of_range', 'Resolution date must be between prediction creation and today.')
        }
        return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
      },
    )

    app.delete<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId/result',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = clearPredictionResultSchema.safeParse(request.body ?? {})
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)
        const result = await predictionStore.clearResult({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
      },
    )

    app.post<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId/void',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = voidPredictionSchema.safeParse(request.body ?? {})
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)
        const result = await predictionStore.void({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
          ...body.data,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        if (result.status === 'already_voided') return errorResponse(reply, 409, 'already_voided', 'Prediction is already voided.')
        return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
      },
    )

    app.post<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId/restore',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = restorePredictionSchema.safeParse(request.body ?? {})
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)
        const result = await predictionStore.restore({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        if (result.status === 'not_voided') return errorResponse(reply, 409, 'not_voided', 'Prediction is not voided.')
        return predictionMutationResponseSchema.parse({ prediction: mapPrediction(result.prediction) })
      },
    )

    app.delete<{ Params: Record<string, unknown>; Body: unknown }>(
      '/api/intuition-ledger/predictions/:predictionId',
      async (request, reply) => {
        const params = predictionIdParamsSchema.safeParse(request.params)
        const body = deletePredictionSchema.safeParse(request.body ?? {})
        if (!params.success) return validationError(params.error, reply)
        if (!body.success) return validationError(body.error, reply)
        const result = await predictionStore.delete({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          predictionId: params.data.predictionId,
        })
        if (result.status === 'not_found') return errorResponse(reply, 404, 'not_found', 'Prediction not found.')
        if (result.status === 'not_voided') return errorResponse(reply, 409, 'not_voided', 'Void this prediction before deleting it.')
        return predictionDeleteResponseSchema.parse({ success: true, deletedPredictionId: params.data.predictionId })
      },
    )

    app.get<{ Querystring: Record<string, unknown> }>(
      '/api/intuition-ledger/suggestions/other-symbols',
      async (request, reply) => {
        const query = predictionSuggestionQuerySchema.safeParse(readRawQuery(request))
        if (!query.success) return validationError(query.error, reply)
        const symbols = await predictionStore.suggestOtherSymbols({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          query: normalizePredictionSymbol(query.data.q),
          limit: query.data.limit,
        })
        return predictionOtherSymbolSuggestionsResponseSchema.parse({ symbols })
      },
    )

    app.get<{ Querystring: Record<string, unknown> }>(
      '/api/intuition-ledger/suggestions/tags',
      async (request, reply) => {
        const query = predictionSuggestionQuerySchema.safeParse(readRawQuery(request))
        if (!query.success) return validationError(query.error, reply)
        const tags = await predictionStore.suggestTags({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          query: query.data.q,
          limit: query.data.limit,
        })
        return predictionTagSuggestionsResponseSchema.parse({ tags })
      },
    )

    app.get<{ Querystring: Record<string, unknown> }>(
      '/api/intuition-ledger/stats',
      async (request, reply) => {
        const query = predictionDashboardStatsQuerySchema.safeParse(readRawQuery(request))
        if (!query.success) return validationError(query.error, reply)
        const localDateError = validateLocalDate(query.data.asOfLocalDate, now(), reply)
        if (localDateError) return localDateError

        const records = await predictionStore.statsRecords({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
        })
        return predictionDashboardStatsResponseSchema.parse(dashboardStats(records, query.data))
      },
    )

    app.get<{ Querystring: Record<string, unknown> }>(
      '/api/intuition-ledger/due-count',
      async (request, reply) => {
        const query = predictionDueCountQuerySchema.safeParse(readRawQuery(request))
        if (!query.success) return validationError(query.error, reply)
        const localDateError = validateLocalDate(query.data.asOfLocalDate, now(), reply)
        if (localDateError) return localDateError
        const dueCount = await predictionStore.countDue({
          organizationId: request.user.organizationId,
          userId: request.user.sub,
          asOfLocalDate: query.data.asOfLocalDate,
        })
        return predictionDueCountResponseSchema.parse({ dueCount })
      },
    )
  }
}

export const intuitionLedgerRoutes = createIntuitionLedgerRoutes()