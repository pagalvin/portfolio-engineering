import { z } from 'zod'
import { localDateSchema } from './journal.js'

export const predictionTypeSchema = z.enum([
  'DIRECTION',
  'PERCENT_MOVE',
  'TARGET_PRICE',
  'EVENT_REACTION',
  'FREEFORM',
])

export const predictionDirectionSchema = z.enum(['RISES', 'FALLS'])
export const predictionResultSchema = z.enum(['CORRECT', 'INCORRECT'])

export const predictionClaimFields = [
  'securityId',
  'otherSymbol',
  'topic',
  'symbolSnapshot',
  'symbolNormalizedSnapshot',
  'type',
  'direction',
  'claimText',
  'eventLabel',
  'deadline',
  'confidence',
  'priceAtPrediction',
  'priceCapturedAt',
  'predictedPrice',
  'predictedPercent',
] as const

export const predictionClaimFieldSchema = z.enum(predictionClaimFields)

const predictionInputDecimalSchema = z
  .string()
  .regex(/^(?:\d+(?:\.\d+)?|\.\d+)$/, 'Enter a locale-normalized decimal number')
  .refine((value) => /[1-9]/.test(value), 'Value must be greater than zero')
  .refine((value) => {
    const [integerPart = '', fractionalPart = ''] = value.split('.')
    return integerPart.replace(/^0+/, '').length <= 12 && fractionalPart.length <= 8
  }, 'Value exceeds the supported decimal precision')

const storedDecimalSchema = z.string().regex(/^-?(?:\d+(?:\.\d+)?|\.\d+)$/)
const positiveStoredDecimalSchema = storedDecimalSchema.refine(
  (value) => !value.startsWith('-') && /[1-9]/.test(value),
)
const optionalNullableText = z.string().nullable().optional()
const optionalNullableDecimal = predictionInputDecimalSchema.nullable().optional()
const optionalNullableTimestamp = z.iso.datetime({ offset: true }).nullable().optional()
const predictionIdSchema = z.string().min(1)
const emptyRequestSchema = z.object({}).strict()

const predictionClaimInputShape = {
  securityId: predictionIdSchema.nullable().optional(),
  otherSymbol: optionalNullableText,
  topic: optionalNullableText,
  type: predictionTypeSchema.optional(),
  direction: predictionDirectionSchema.nullable().optional(),
  claimText: z.string().optional(),
  eventLabel: optionalNullableText,
  deadline: localDateSchema.optional(),
  confidence: z.number().int().min(50).max(100).optional(),
  priceAtPrediction: optionalNullableDecimal,
  priceCapturedAt: optionalNullableTimestamp,
  predictedPrice: optionalNullableDecimal,
  predictedPercent: optionalNullableDecimal,
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null
}

function addIssue(ctx: z.RefinementCtx, path: string, message: string): void {
  ctx.addIssue({ code: 'custom', path: [path], message })
}

function validateCreateClaim(
  value: {
    type: z.infer<typeof predictionTypeSchema>
    securityId?: string | null
    otherSymbol?: string | null
    topic?: string | null
    direction?: z.infer<typeof predictionDirectionSchema> | null
    priceAtPrediction?: string | null
    priceCapturedAt?: string | null
    predictedPrice?: string | null
    predictedPercent?: string | null
  },
  ctx: z.RefinementCtx,
): void {
  const subjectCount = [value.securityId, value.otherSymbol, value.topic].filter(hasValue).length
  const hasSecurity = hasValue(value.securityId)
  const hasOtherSymbol = hasValue(value.otherSymbol)
  const hasTopic = hasValue(value.topic)
  const hasPrice = hasValue(value.priceAtPrediction)
  const hasCapturedAt = hasValue(value.priceCapturedAt)
  const hasPredictedPrice = hasValue(value.predictedPrice)
  const hasPredictedPercent = hasValue(value.predictedPercent)

  if (subjectCount > 1) {
    addIssue(ctx, 'securityId', 'Choose only one subject')
  }
  if (subjectCount === 0 && value.type !== 'FREEFORM') {
    addIssue(ctx, 'securityId', 'A subject is required for this prediction type')
  }
  if (hasTopic && value.type !== 'FREEFORM') {
    addIssue(ctx, 'topic', 'A topic is only valid for a Freeform prediction')
  }
  if (value.type === 'EVENT_REACTION' && !hasSecurity && !hasOtherSymbol) {
    addIssue(ctx, 'securityId', 'Event reaction predictions require a security or symbol')
  }

  const measurable = value.type !== 'FREEFORM'
  if (measurable && !hasPrice) {
    addIssue(ctx, 'priceAtPrediction', 'A price at prediction is required')
  }
  if (measurable && !hasCapturedAt) {
    addIssue(ctx, 'priceCapturedAt', 'A price-captured timestamp is required')
  }
  if (!measurable && (hasPrice || hasCapturedAt || hasPredictedPrice || hasPredictedPercent)) {
    addIssue(ctx, 'priceAtPrediction', 'Freeform predictions do not accept price fields')
  }

  if (value.type === 'DIRECTION' && (hasPredictedPrice || hasPredictedPercent)) {
    addIssue(ctx, 'predictedPrice', 'Direction predictions do not accept a target or move size')
  }
  if (value.type === 'PERCENT_MOVE' && hasPredictedPrice === hasPredictedPercent) {
    addIssue(ctx, 'predictedPercent', 'Provide exactly one move size or predicted price')
  }
  if (value.type === 'TARGET_PRICE') {
    if (!hasPredictedPrice) {
      addIssue(ctx, 'predictedPrice', 'A target price is required')
    }
    if (hasPredictedPercent) {
      addIssue(ctx, 'predictedPercent', 'Target price predictions derive their move size')
    }
    if (hasValue(value.direction)) {
      addIssue(ctx, 'direction', 'Target price direction is derived from its target price')
    }
  }
  if (value.type === 'EVENT_REACTION' && hasPredictedPrice && hasPredictedPercent) {
    addIssue(ctx, 'predictedPercent', 'Provide a move size or predicted price, not both')
  }
  if (value.type === 'FREEFORM' && hasValue(value.direction)) {
    addIssue(ctx, 'direction', 'Freeform predictions do not have a direction')
  }
  if (
    (value.type === 'DIRECTION' || value.type === 'PERCENT_MOVE' || value.type === 'EVENT_REACTION') &&
    !hasValue(value.direction)
  ) {
    addIssue(ctx, 'direction', 'A direction is required for this prediction type')
  }
}

export const createPredictionSchema = z
  .object({
    ...predictionClaimInputShape,
    type: predictionTypeSchema,
    claimText: z.string(),
    deadline: localDateSchema,
    confidence: z.number().int().min(50).max(100),
    reasoning: optionalNullableText,
    tags: z.array(z.string()).optional(),
  })
  .strict()
  .superRefine(validateCreateClaim)

export const updatePredictionSchema = z
  .object({
    ...predictionClaimInputShape,
    reasoning: optionalNullableText,
    tags: z.array(z.string()).optional(),
    confirmAmend: z.boolean().optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Object.keys(value).every((field) => field === 'confirmAmend')) {
      addIssue(ctx, 'claimText', 'At least one prediction field must be provided')
    }
    if (hasValue(value.predictedPrice) && hasValue(value.predictedPercent)) {
      addIssue(ctx, 'predictedPercent', 'Provide a move size or predicted price, not both')
    }
  })

export const predictionIdParamsSchema = z.object({
  predictionId: predictionIdSchema,
}).strict()

export const recordPredictionResultSchema = z
  .object({
    result: predictionResultSchema,
    resolutionDate: localDateSchema,
    actualPrice: optionalNullableDecimal,
    outcomeNotes: optionalNullableText,
    asOfLocalDate: localDateSchema,
  })
  .strict()

export const clearPredictionResultSchema = emptyRequestSchema

export const voidPredictionSchema = z.object({
  voidReason: optionalNullableText,
}).strict()

export const restorePredictionSchema = emptyRequestSchema
export const deletePredictionSchema = emptyRequestSchema

export const predictionStatusQuerySchema = z.enum([
  'active',
  'open',
  'due',
  'resolved',
  'void',
  'all',
])

export const predictionTypeFilterSchema = z.enum([
  'direction',
  'percent_move',
  'target_price',
  'event_reaction',
  'freeform',
])

export const predictionListQuerySchema = z
  .object({
    q: z.string().optional(),
    status: predictionStatusQuerySchema.optional(),
    type: predictionTypeFilterSchema.optional(),
    symbol: z.string().optional(),
    result: z.enum(['correct', 'incorrect']).optional(),
    tag: z.string().optional(),
    amended: z.enum(['only', 'exclude']).optional(),
    asOfLocalDate: localDateSchema.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if ((value.status === 'open' || value.status === 'due') && !value.asOfLocalDate) {
      addIssue(ctx, 'asOfLocalDate', 'A local date is required for this status filter')
    }
  })

export const predictionSuggestionQuerySchema = z.object({
  q: z.string(),
  limit: z.coerce.number().int().positive().max(100).optional(),
}).strict()

export const predictionDueCountQuerySchema = z.object({
  asOfLocalDate: localDateSchema,
}).strict()

export const predictionDashboardStatsQuerySchema = z.object({
  period: z.enum(['week', 'month']),
  amended: z.enum(['include', 'exclude']).optional(),
  asOfLocalDate: localDateSchema,
}).strict()

const predictionDateSchema = localDateSchema
const predictionTimestampSchema = z.iso.datetime()
const nullableStoredDecimalSchema = storedDecimalSchema.nullable()
const nullablePositiveDecimalSchema = positiveStoredDecimalSchema.nullable()
const nullablePredictionDirectionSchema = predictionDirectionSchema.nullable()
const nullablePredictionResultSchema = predictionResultSchema.nullable()

export const predictionRecordSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  userId: z.string(),
  securityId: z.string().nullable(),
  otherSymbol: z.string().nullable(),
  topic: z.string().nullable(),
  symbolSnapshot: z.string().nullable(),
  symbolNormalizedSnapshot: z.string().nullable(),
  type: predictionTypeSchema,
  direction: nullablePredictionDirectionSchema,
  claimText: z.string(),
  eventLabel: z.string().nullable(),
  deadline: predictionDateSchema,
  confidence: z.number().int().min(50).max(100),
  priceAtPrediction: nullablePositiveDecimalSchema,
  predictedPrice: nullablePositiveDecimalSchema,
  predictedPercent: nullableStoredDecimalSchema,
  priceCapturedAt: predictionTimestampSchema.nullable(),
  reasoning: z.string().nullable(),
  tags: z.array(z.string()),
  result: nullablePredictionResultSchema,
  resolutionDate: predictionDateSchema.nullable(),
  actualPrice: nullablePositiveDecimalSchema,
  outcomeNotes: z.string().nullable(),
  voidedAt: predictionTimestampSchema.nullable(),
  voidReason: z.string().nullable(),
  amended: z.boolean(),
  amendedAt: predictionTimestampSchema.nullable(),
  createdAt: predictionTimestampSchema,
  updatedAt: predictionTimestampSchema,
}).strict()

export const predictionAmendmentRecordSchema = z.object({
  id: z.string(),
  predictionId: z.string(),
  previousSecurityId: z.string().nullable(),
  previousOtherSymbol: z.string().nullable(),
  previousTopic: z.string().nullable(),
  previousSymbolSnapshot: z.string().nullable(),
  previousSymbolNormalizedSnapshot: z.string().nullable(),
  previousType: predictionTypeSchema,
  previousDirection: nullablePredictionDirectionSchema,
  previousClaimText: z.string(),
  previousEventLabel: z.string().nullable(),
  previousDeadline: predictionDateSchema,
  previousConfidence: z.number().int().min(50).max(100),
  previousPriceAtPrediction: nullablePositiveDecimalSchema,
  previousPriceCapturedAt: predictionTimestampSchema.nullable(),
  previousPredictedPrice: nullablePositiveDecimalSchema,
  previousPredictedPercent: nullableStoredDecimalSchema,
  changedFields: z.array(predictionClaimFieldSchema),
  changedAt: predictionTimestampSchema,
}).strict()

export const predictionResultHistoryRecordSchema = z.object({
  id: z.string(),
  predictionId: z.string(),
  previousResult: nullablePredictionResultSchema,
  previousResolutionDate: predictionDateSchema.nullable(),
  previousActualPrice: nullablePositiveDecimalSchema,
  previousOutcomeNotes: z.string().nullable(),
  newResult: nullablePredictionResultSchema,
  newResolutionDate: predictionDateSchema.nullable(),
  newActualPrice: nullablePositiveDecimalSchema,
  newOutcomeNotes: z.string().nullable(),
  changedAt: predictionTimestampSchema,
}).strict()

export const predictionReasoningHistoryRecordSchema = z.object({
  id: z.string(),
  predictionId: z.string(),
  previousReasoning: z.string().nullable(),
  newReasoning: z.string().nullable(),
  changedAt: predictionTimestampSchema,
}).strict()

export const predictionListItemSchema = predictionRecordSchema.extend({
  resultChanged: z.boolean(),
}).strict()

export const predictionListResponseSchema = z.object({
  predictions: z.array(predictionListItemSchema),
  filteredCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
}).strict()

export const predictionMutationResponseSchema = z.object({
  prediction: predictionRecordSchema,
}).strict()

export const predictionDetailResponseSchema = z.object({
  prediction: predictionListItemSchema,
  amendmentHistory: z.array(predictionAmendmentRecordSchema),
  resultHistory: z.array(predictionResultHistoryRecordSchema),
  reasoningHistory: z.array(predictionReasoningHistoryRecordSchema),
  gracePeriodEndsAt: predictionTimestampSchema,
}).strict()

export const predictionDeleteResponseSchema = z.object({
  success: z.literal(true),
  deletedPredictionId: z.string(),
}).strict()

export const predictionDueCountResponseSchema = z.object({
  dueCount: z.number().int().nonnegative(),
}).strict()

export const predictionOtherSymbolSuggestionsResponseSchema = z.object({
  symbols: z.array(z.string()),
}).strict()

export const predictionTagSuggestionsResponseSchema = z.object({
  tags: z.array(z.string()),
}).strict()

export const predictionHitRateSchema = z.object({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  value: z.number().min(0).max(1).nullable(),
}).strict()

export const predictionCalibrationBucketSchema = z.object({
  bucket: z.enum(['50-59', '60-69', '70-79', '80-89', '90-100']),
  count: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  hitRate: z.number().min(0).max(1).nullable(),
  lowSample: z.boolean(),
}).strict()

export const predictionDashboardStatsResponseSchema = z.object({
  summary: z.object({
    open: z.number().int().nonnegative(),
    due: z.number().int().nonnegative(),
    resolved: z.number().int().nonnegative(),
    voided: z.number().int().nonnegative(),
  }).strict(),
  hitRate: predictionHitRateSchema,
  calibration: z.array(predictionCalibrationBucketSchema),
  byType: z.array(z.object({
    type: predictionTypeSchema,
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(1).nullable(),
  }).strict()),
  bySymbol: z.array(z.object({
    symbol: z.string(),
    symbolNormalized: z.string(),
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(1).nullable(),
  }).strict()),
  timeSeries: z.array(z.object({
    bucketStart: predictionDateSchema,
    bucketEnd: predictionDateSchema,
    correct: z.number().int().nonnegative(),
    incorrect: z.number().int().nonnegative(),
    count: z.number().int().nonnegative(),
    hitRate: z.number().min(0).max(1).nullable(),
  }).strict()),
  scatterPoints: z.array(z.object({
    predictionId: z.string(),
    symbol: z.string().nullable(),
    predictedPercent: z.number(),
    actualPercent: z.number(),
  }).strict()),
}).strict()

const predictionErrorCodeSchema = z.enum([
  'validation_error',
  'invalid_security_reference',
  'not_found',
  'amend_confirmation_required',
  'deadline_not_passed',
  'resolution_date_out_of_range',
  'already_voided',
  'not_voided',
])

export const predictionErrorResponseSchema = z.discriminatedUnion('code', [
  z.object({
    code: z.literal('validation_error'),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }).strict(),
  z.object({
    code: z.literal('invalid_security_reference'),
    message: z.string(),
  }).strict(),
  z.object({
    code: z.literal('not_found'),
    message: z.string(),
  }).strict(),
  z.object({
    code: z.literal('amend_confirmation_required'),
    message: z.string(),
    changedFields: z.array(predictionClaimFieldSchema),
  }).strict(),
  z.object({
    code: z.literal('deadline_not_passed'),
    message: z.string(),
  }).strict(),
  z.object({
    code: z.literal('resolution_date_out_of_range'),
    message: z.string(),
  }).strict(),
  z.object({
    code: z.literal('already_voided'),
    message: z.string(),
  }).strict(),
  z.object({
    code: z.literal('not_voided'),
    message: z.string(),
  }).strict(),
])

export type CreatePredictionRequest = z.infer<typeof createPredictionSchema>
export type UpdatePredictionRequest = z.infer<typeof updatePredictionSchema>
export type RecordPredictionResultRequest = z.infer<typeof recordPredictionResultSchema>
export type PredictionListQuery = z.infer<typeof predictionListQuerySchema>
export type PredictionSuggestionQuery = z.infer<typeof predictionSuggestionQuerySchema>
export type PredictionDueCountQuery = z.infer<typeof predictionDueCountQuerySchema>
export type PredictionDashboardStatsQuery = z.infer<typeof predictionDashboardStatsQuerySchema>
export type PredictionErrorCode = z.infer<typeof predictionErrorCodeSchema>