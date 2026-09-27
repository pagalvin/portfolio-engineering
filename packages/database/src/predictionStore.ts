/**
 * Prediction Store
 *
 * Data access layer for the Intuition Ledger. Every read, write, update,
 * delete, and aggregate is scoped by both organizationId and userId, with the
 * scope carried in the write predicate itself (updateMany/deleteMany), per
 * ADR 0001 and the TD-018 lesson recorded in plan 0009 T-01.1.
 *
 * Design source: docs/plans/0009-intuition-ledger.md, T-01.1 Notes.
 */

import {
  getResultRecordingBlockReason,
  isResolutionDateInRange,
} from '@portfolio-engineering/domain'
import { normalizeSecurityIdentity } from './securityStore.js'
import { Prisma } from './generated/prisma/client.js'
import type {
  Prediction,
  PredictionAmendment,
  PredictionDirection,
  PredictionReasoningHistory,
  PredictionResultHistory,
  PredictionResult,
  PredictionType,
  PrismaClient,
} from './generated/prisma/client.js'

/** The server-derived free-edit window measured from the prediction's own createdAt (FR 19a). */
const GRACE_PERIOD_MS = 5 * 60 * 1000

function isKnownRequestError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
}

/** Convert a `YYYY-MM-DD` calendar date to the UTC-midnight Date Prisma requires for `@db.Date` columns. */
function localDateToPrismaDate(localDate: string): Date {
  return new Date(`${localDate}T00:00:00.000Z`)
}

function toDecimalOrNull(value: string | number | null | undefined): Prisma.Decimal | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Prisma.Decimal(value)
}

function decimalKey(value: Prisma.Decimal | null | undefined): string {
  return value === null || value === undefined ? '' : value.toString()
}

function dateKey(value: Date | null | undefined): string {
  return value === null || value === undefined ? '' : value.toISOString()
}

/** Subject fields supplied by the caller; exactly one of these (or none) may be present. */
export interface PredictionSubjectInput {
  securityId?: string | null
  otherSymbol?: string | null
  topic?: string | null
}

/** Claim fields that participate in Amended tracking. Reasoning, tags, and outcome fields are excluded. */
export interface PredictionClaimInput extends PredictionSubjectInput {
  type?: PredictionType
  direction?: PredictionDirection | null
  claimText?: string
  eventLabel?: string | null
  deadline?: string // YYYY-MM-DD
  confidence?: number
  priceAtPrediction?: string | number | null
  priceCapturedAt?: string | null // ISO datetime
  predictedPrice?: string | number | null
  predictedPercent?: string | number | null
}

export const PREDICTION_CLAIM_FIELDS = [
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

export type PredictionClaimField = (typeof PREDICTION_CLAIM_FIELDS)[number]

export interface CreatePredictionInput extends PredictionClaimInput {
  organizationId: string
  userId: string
  type: PredictionType
  claimText: string
  deadline: string
  confidence: number
  reasoning?: string | null
  tags?: string[]
}

export type CreatePredictionResult =
  | { status: 'created'; prediction: Prediction }
  | { status: 'invalid_security_reference' }

export interface PredictionListInput {
  organizationId: string
  userId: string
  type?: PredictionType
  result?: PredictionResult | 'open'
  amended?: boolean
  includeVoided?: boolean
  symbolNormalized?: string
  tag?: string
  q?: string
  dueOnly?: boolean
  asOfLocalDate?: string // YYYY-MM-DD, required when dueOnly is true
  orderBy?: 'deadline_asc' | 'deadline_desc' | 'createdAt_desc'
  limit?: number
  offset?: number
}

export type PredictionRecord = Prediction & {
  resultChanged: boolean
}

export interface PredictionListOutput {
  predictions: PredictionRecord[]
  filteredCount: number
  totalCount: number
}

export type PredictionFindResult = PredictionRecord | null

export interface PredictionWithHistories {
  prediction: PredictionRecord
  amendmentHistory: PredictionAmendment[]
  resultHistory: PredictionResultHistory[]
  reasoningHistory: PredictionReasoningHistory[]
}

export interface UpdatePredictionInput extends PredictionClaimInput {
  organizationId: string
  userId: string
  predictionId: string
  reasoning?: string | null
  tags?: string[]
  /** Must be true to apply a claim change discovered outside the grace window; see amend_confirmation_required. */
  confirmAmendment?: boolean
}

export type UpdatePredictionResult =
  | { status: 'updated'; prediction: Prediction }
  | { status: 'not_found' }
  | { status: 'amend_confirmation_required'; changedFields: PredictionClaimField[] }
  | { status: 'invalid_security_reference' }

export interface RecordResultInput {
  organizationId: string
  userId: string
  predictionId: string
  result: PredictionResult
  resolutionDate: string // YYYY-MM-DD
  actualPrice?: string | number | null
  outcomeNotes?: string | null
  /** Validated user local date used to enforce FR 24 resolution-date bounds. */
  asOfLocalDate: string
}

export type RecordResultOutcome =
  | { status: 'updated'; prediction: Prediction }
  | { status: 'not_found' }
  | { status: 'deadline_not_passed' }
  | { status: 'resolution_date_out_of_range' }

export interface ClearResultInput {
  organizationId: string
  userId: string
  predictionId: string
}

export type ClearResultOutcome =
  | { status: 'updated'; prediction: Prediction }
  | { status: 'not_found' }

export interface VoidPredictionInput {
  organizationId: string
  userId: string
  predictionId: string
  voidReason?: string | null
}

export type VoidPredictionOutcome =
  | { status: 'updated'; prediction: Prediction }
  | { status: 'not_found' }
  | { status: 'already_voided' }

export interface RestorePredictionInput {
  organizationId: string
  userId: string
  predictionId: string
}

export type RestorePredictionOutcome =
  | { status: 'updated'; prediction: Prediction }
  | { status: 'not_found' }
  | { status: 'not_voided' }

export interface DeletePredictionInput {
  organizationId: string
  userId: string
  predictionId: string
}

export type DeletePredictionOutcome =
  | { status: 'deleted' }
  | { status: 'not_found' }
  | { status: 'not_voided' }

export interface PredictionStatsBucket {
  type: PredictionType
  result: PredictionResult | null
  count: number
}

export interface PredictionStatsInput {
  organizationId: string
  userId: string
  includeAmended?: boolean
}

export type PredictionStatsRecord = Omit<
  Pick<Prediction,
    | 'id'
    | 'organizationId'
    | 'userId'
    | 'type'
    | 'result'
    | 'voidedAt'
    | 'amended'
    | 'deadline'
    | 'confidence'
    | 'resolutionDate'
    | 'symbolSnapshot'
    | 'symbolNormalizedSnapshot'
    | 'otherSymbol'
    | 'direction'
    | 'priceAtPrediction'
    | 'predictedPrice'
    | 'predictedPercent'
    | 'actualPrice'
  >,
  'priceAtPrediction' | 'predictedPrice' | 'predictedPercent' | 'actualPrice'
> & {
  priceAtPrediction: string | null
  predictedPrice: string | null
  predictedPercent: string | null
  actualPrice: string | null
}

export interface PredictionStore {
  create(input: CreatePredictionInput): Promise<CreatePredictionResult>
  list(input: PredictionListInput): Promise<PredictionListOutput>
  find(input: { organizationId: string; userId: string; predictionId: string }): Promise<PredictionFindResult>
  findWithHistories(input: { organizationId: string; userId: string; predictionId: string }): Promise<PredictionWithHistories | null>
  update(input: UpdatePredictionInput): Promise<UpdatePredictionResult>
  recordResult(input: RecordResultInput): Promise<RecordResultOutcome>
  clearResult(input: ClearResultInput): Promise<ClearResultOutcome>
  void(input: VoidPredictionInput): Promise<VoidPredictionOutcome>
  restore(input: RestorePredictionInput): Promise<RestorePredictionOutcome>
  delete(input: DeletePredictionInput): Promise<DeletePredictionOutcome>
  countDue(input: { organizationId: string; userId: string; asOfLocalDate: string }): Promise<number>
  suggestOtherSymbols(input: { organizationId: string; userId: string; query: string; limit?: number }): Promise<string[]>
  suggestTags(input: { organizationId: string; userId: string; query: string; limit?: number }): Promise<string[]>
  statsRecords(input: Pick<PredictionStatsInput, 'organizationId' | 'userId'>): Promise<PredictionStatsRecord[]>
  statsAggregate(input: PredictionStatsInput): Promise<PredictionStatsBucket[]>
}

interface ResolvedSubject {
  securityId: string | null
  otherSymbol: string | null
  topic: string | null
  symbolSnapshot: string | null
  symbolNormalizedSnapshot: string | null
}

/**
 * Derives the four subject snapshot fields from caller-supplied subject input. Returns
 * `null` when a securityId is supplied but does not resolve within the organization, so the
 * caller can report `invalid_security_reference` without relying solely on the database FK error.
 */
async function resolveSubject(
  prisma: PrismaClient,
  organizationId: string,
  subject: PredictionSubjectInput,
): Promise<ResolvedSubject | null> {
  if (subject.securityId) {
    const security = await prisma.security.findFirst({
      where: { id: subject.securityId, organizationId },
    })
    if (!security) {
      return null
    }
    return {
      securityId: security.id,
      otherSymbol: null,
      topic: null,
      symbolSnapshot: security.symbol,
      symbolNormalizedSnapshot: security.symbolNormalized,
    }
  }

  if (subject.otherSymbol) {
    const normalized = normalizeSecurityIdentity(subject.otherSymbol)
    return {
      securityId: null,
      otherSymbol: normalized,
      topic: null,
      symbolSnapshot: normalized,
      symbolNormalizedSnapshot: normalized,
    }
  }

  if (subject.topic) {
    return {
      securityId: null,
      otherSymbol: null,
      topic: subject.topic,
      symbolSnapshot: null,
      symbolNormalizedSnapshot: null,
    }
  }

  return {
    securityId: null,
    otherSymbol: null,
    topic: null,
    symbolSnapshot: null,
    symbolNormalizedSnapshot: null,
  }
}

/** Builds the immutable previous-claim snapshot recorded on `PredictionAmendment`. */
function claimSnapshotOf(prediction: Prediction) {
  return {
    previousSecurityId: prediction.securityId,
    previousOtherSymbol: prediction.otherSymbol,
    previousTopic: prediction.topic,
    previousSymbolSnapshot: prediction.symbolSnapshot,
    previousSymbolNormalizedSnapshot: prediction.symbolNormalizedSnapshot,
    previousType: prediction.type,
    previousDirection: prediction.direction,
    previousClaimText: prediction.claimText,
    previousEventLabel: prediction.eventLabel,
    previousDeadline: prediction.deadline,
    previousConfidence: prediction.confidence,
    previousPriceAtPrediction: prediction.priceAtPrediction,
    previousPriceCapturedAt: prediction.priceCapturedAt,
    previousPredictedPrice: prediction.predictedPrice,
    previousPredictedPercent: prediction.predictedPercent,
  }
}

/**
 * Compares only the claim fields explicitly present on `input` against `current`, returning
 * the subset that changed. Fields omitted from `input` are treated as untouched.
 */
function diffClaimFields(
  current: Prediction,
  resolvedSubject: ResolvedSubject | undefined,
  input: PredictionClaimInput,
): PredictionClaimField[] {
  const changed: PredictionClaimField[] = []

  if (resolvedSubject) {
    if (resolvedSubject.securityId !== current.securityId) changed.push('securityId')
    if (resolvedSubject.otherSymbol !== current.otherSymbol) changed.push('otherSymbol')
    if (resolvedSubject.topic !== current.topic) changed.push('topic')
    if (resolvedSubject.symbolSnapshot !== current.symbolSnapshot) changed.push('symbolSnapshot')
    if (resolvedSubject.symbolNormalizedSnapshot !== current.symbolNormalizedSnapshot) {
      changed.push('symbolNormalizedSnapshot')
    }
  }
  if (input.type !== undefined && input.type !== current.type) changed.push('type')
  if (input.direction !== undefined && input.direction !== current.direction) changed.push('direction')
  if (input.claimText !== undefined && input.claimText !== current.claimText) changed.push('claimText')
  if (input.eventLabel !== undefined && input.eventLabel !== current.eventLabel) changed.push('eventLabel')
  if (input.deadline !== undefined && localDateToPrismaDate(input.deadline).getTime() !== current.deadline.getTime()) {
    changed.push('deadline')
  }
  if (input.confidence !== undefined && input.confidence !== current.confidence) changed.push('confidence')
  if (
    input.priceAtPrediction !== undefined &&
    decimalKey(toDecimalOrNull(input.priceAtPrediction)) !== decimalKey(current.priceAtPrediction)
  ) {
    changed.push('priceAtPrediction')
  }
  if (
    input.priceCapturedAt !== undefined &&
    dateKey(input.priceCapturedAt ? new Date(input.priceCapturedAt) : null) !== dateKey(current.priceCapturedAt)
  ) {
    changed.push('priceCapturedAt')
  }
  if (
    input.predictedPrice !== undefined &&
    decimalKey(toDecimalOrNull(input.predictedPrice)) !== decimalKey(current.predictedPrice)
  ) {
    changed.push('predictedPrice')
  }
  if (
    input.predictedPercent !== undefined &&
    decimalKey(toDecimalOrNull(input.predictedPercent)) !== decimalKey(current.predictedPercent)
  ) {
    changed.push('predictedPercent')
  }

  return changed
}

type ResultChangeHistoryEntry = Pick<PredictionResultHistory, 'previousResult' | 'newResult' | 'changedAt'>

type PredictionWithResultChangeHistory = Prediction & { resultHistory: ResultChangeHistoryEntry[] }

function scopedResultHistoryInclude(organizationId: string, userId: string) {
  return {
    resultHistory: {
      where: { organizationId, userId },
      orderBy: { changedAt: 'asc' as const },
      select: { previousResult: true, newResult: true, changedAt: true },
    },
  } satisfies Prisma.PredictionInclude
}

function hasResultChanged(history: readonly ResultChangeHistoryEntry[]): boolean {
  let resultWasCleared = false
  for (const entry of history) {
    if (
      entry.previousResult !== null &&
      entry.newResult !== null &&
      entry.previousResult !== entry.newResult
    ) {
      return true
    }
    if (resultWasCleared && entry.newResult !== null) return true
    if (entry.previousResult !== null && entry.newResult === null) resultWasCleared = true
  }
  return false
}

function toPredictionRecord({ resultHistory, ...prediction }: PredictionWithResultChangeHistory): PredictionRecord {
  return { ...prediction, resultChanged: hasResultChanged(resultHistory) }
}

export function createPredictionStore(prisma: PrismaClient): PredictionStore {
  return {
    async create(input) {
      const subject = await resolveSubject(prisma, input.organizationId, input)
      if (!subject) {
        return { status: 'invalid_security_reference' }
      }

      try {
        const prediction = await prisma.prediction.create({
          data: {
            organizationId: input.organizationId,
            userId: input.userId,
            securityId: subject.securityId,
            otherSymbol: subject.otherSymbol,
            topic: subject.topic,
            symbolSnapshot: subject.symbolSnapshot,
            symbolNormalizedSnapshot: subject.symbolNormalizedSnapshot,
            type: input.type,
            direction: input.direction ?? null,
            claimText: input.claimText,
            eventLabel: input.eventLabel ?? null,
            deadline: localDateToPrismaDate(input.deadline),
            confidence: input.confidence,
            priceAtPrediction: toDecimalOrNull(input.priceAtPrediction) ?? null,
            predictedPrice: toDecimalOrNull(input.predictedPrice) ?? null,
            predictedPercent: toDecimalOrNull(input.predictedPercent) ?? null,
            priceCapturedAt: input.priceCapturedAt ? new Date(input.priceCapturedAt) : null,
            reasoning: input.reasoning ?? null,
            tags: input.tags ?? [],
          },
        })
        return { status: 'created', prediction }
      } catch (error: unknown) {
        if (isKnownRequestError(error, 'P2003')) {
          return { status: 'invalid_security_reference' }
        }
        throw error
      }
    },

    async list(input) {
      const where: Prisma.PredictionWhereInput = {
        organizationId: input.organizationId,
        userId: input.userId,
        ...(input.includeVoided ? {} : { voidedAt: null }),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.result === undefined
          ? {}
          : input.result === 'open'
            ? { result: null }
            : { result: input.result }),
        ...(input.amended === undefined ? {} : { amended: input.amended }),
        ...(input.symbolNormalized === undefined
          ? {}
          : { symbolNormalizedSnapshot: normalizeSecurityIdentity(input.symbolNormalized) }),
        ...(input.tag === undefined ? {} : { tags: { has: input.tag } }),
        ...(input.q?.trim()
          ? {
              OR: [
                { claimText: { contains: input.q.trim(), mode: 'insensitive' } },
                { reasoning: { contains: input.q.trim(), mode: 'insensitive' } },
                { outcomeNotes: { contains: input.q.trim(), mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(input.dueOnly && input.asOfLocalDate
          ? { result: null, deadline: { lt: localDateToPrismaDate(input.asOfLocalDate) } }
          : {}),
      }

      const orderBy: Prisma.PredictionOrderByWithRelationInput =
        input.orderBy === 'deadline_desc'
          ? { deadline: 'desc' }
          : input.orderBy === 'createdAt_desc'
            ? { createdAt: 'desc' }
            : { deadline: 'asc' }

      const [predictions, filteredCount, totalCount] = await Promise.all([
        prisma.prediction.findMany({
          where,
          orderBy,
          take: input.limit,
          skip: input.offset,
          include: scopedResultHistoryInclude(input.organizationId, input.userId),
        }),
        prisma.prediction.count({ where }),
        prisma.prediction.count({
          where: { organizationId: input.organizationId, userId: input.userId },
        }),
      ])

      return { predictions: predictions.map(toPredictionRecord), filteredCount, totalCount }
    },

    async find({ organizationId, userId, predictionId }) {
      const prediction = await prisma.prediction.findFirst({
        where: { id: predictionId, organizationId, userId },
        include: scopedResultHistoryInclude(organizationId, userId),
      })
      return prediction ? toPredictionRecord(prediction) : null
    },

    async findWithHistories({ organizationId, userId, predictionId }) {
      const scope = { organizationId, userId, predictionId }
      const prediction = await prisma.prediction.findFirst({
        where: { id: predictionId, organizationId, userId },
      })
      if (!prediction) return null

      const [amendmentHistory, resultHistory, reasoningHistory] = await Promise.all([
        prisma.predictionAmendment.findMany({
          where: scope,
          orderBy: { changedAt: 'asc' },
        }),
        prisma.predictionResultHistory.findMany({
          where: scope,
          orderBy: { changedAt: 'asc' },
        }),
        prisma.predictionReasoningHistory.findMany({
          where: scope,
          orderBy: { changedAt: 'asc' },
        }),
      ])
      return {
        prediction: { ...prediction, resultChanged: hasResultChanged(resultHistory) },
        amendmentHistory,
        resultHistory,
        reasoningHistory,
      }
    },

    async update(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }

      const subjectTouched =
        input.securityId !== undefined || input.otherSymbol !== undefined || input.topic !== undefined
      let subject: ResolvedSubject | undefined
      if (subjectTouched) {
        const resolved = await resolveSubject(prisma, input.organizationId, input)
        if (!resolved) {
          return { status: 'invalid_security_reference' }
        }
        subject = resolved
      }

      const changedClaimFields = diffClaimFields(current, subject, input)
      const reasoningProvided = input.reasoning !== undefined
      const reasoningChanged = reasoningProvided && input.reasoning !== current.reasoning
      const withinGracePeriod = Date.now() - current.createdAt.getTime() < GRACE_PERIOD_MS

      if (changedClaimFields.length > 0 && !withinGracePeriod && !input.confirmAmendment) {
        return { status: 'amend_confirmation_required', changedFields: changedClaimFields }
      }

      const claimData: Prisma.PredictionUpdateInput = {
        ...(subject
          ? {
              securityId: subject.securityId,
              otherSymbol: subject.otherSymbol,
              topic: subject.topic,
              symbolSnapshot: subject.symbolSnapshot,
              symbolNormalizedSnapshot: subject.symbolNormalizedSnapshot,
            }
          : {}),
        ...(input.type === undefined ? {} : { type: input.type }),
        ...(input.direction === undefined ? {} : { direction: input.direction }),
        ...(input.claimText === undefined ? {} : { claimText: input.claimText }),
        ...(input.eventLabel === undefined ? {} : { eventLabel: input.eventLabel }),
        ...(input.deadline === undefined ? {} : { deadline: localDateToPrismaDate(input.deadline) }),
        ...(input.confidence === undefined ? {} : { confidence: input.confidence }),
        ...(input.priceAtPrediction === undefined
          ? {}
          : { priceAtPrediction: toDecimalOrNull(input.priceAtPrediction) }),
        ...(input.priceCapturedAt === undefined
          ? {}
          : { priceCapturedAt: input.priceCapturedAt ? new Date(input.priceCapturedAt) : null }),
        ...(input.predictedPrice === undefined ? {} : { predictedPrice: toDecimalOrNull(input.predictedPrice) }),
        ...(input.predictedPercent === undefined
          ? {}
          : { predictedPercent: toDecimalOrNull(input.predictedPercent) }),
        ...(input.tags === undefined ? {} : { tags: input.tags }),
        ...(reasoningProvided ? { reasoning: input.reasoning } : {}),
      }

      const recordsAmendment = changedClaimFields.length > 0 && !withinGracePeriod
      const recordsReasoningHistory = reasoningChanged && !withinGracePeriod

      if (recordsAmendment) {
        claimData.amended = true
        claimData.amendedAt = new Date()
      }

      try {
        return await prisma.$transaction(async (tx) => {
          if (recordsAmendment) {
            await tx.predictionAmendment.create({
              data: {
                organizationId: input.organizationId,
                userId: input.userId,
                predictionId: input.predictionId,
                ...claimSnapshotOf(current),
                changedFields: changedClaimFields,
              },
            })
          }
          if (recordsReasoningHistory) {
            await tx.predictionReasoningHistory.create({
              data: {
                organizationId: input.organizationId,
                userId: input.userId,
                predictionId: input.predictionId,
                previousReasoning: current.reasoning,
                newReasoning: input.reasoning ?? null,
              },
            })
          }

          const result = await tx.prediction.updateMany({
            where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
            data: claimData,
          })
          if (result.count === 0) {
            throw new Error('not_found')
          }

          const updated = await tx.prediction.findFirst({
            where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
          })
          if (!updated) {
            throw new Error('not_found')
          }
          return { status: 'updated', prediction: updated } as const
        })
      } catch (error: unknown) {
        if (error instanceof Error && error.message === 'not_found') {
          return { status: 'not_found' }
        }
        if (isKnownRequestError(error, 'P2003')) {
          return { status: 'invalid_security_reference' }
        }
        throw error
      }
    },

    async recordResult(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }

      if (getResultRecordingBlockReason({
        type: current.type,
        result: input.result,
        deadline: current.deadline.toISOString().slice(0, 10),
        asOfLocalDate: input.asOfLocalDate,
      })) {
        return { status: 'deadline_not_passed' }
      }

      if (!isResolutionDateInRange({
        createdDate: current.createdAt.toISOString().slice(0, 10),
        resolutionDate: input.resolutionDate,
        asOfLocalDate: input.asOfLocalDate,
      })) {
        return { status: 'resolution_date_out_of_range' }
      }
      const resolutionDate = localDateToPrismaDate(input.resolutionDate)

      const hadPriorResult = current.result !== null

      const prediction = await prisma.$transaction(async (tx) => {
        if (hadPriorResult) {
          await tx.predictionResultHistory.create({
            data: {
              organizationId: input.organizationId,
              userId: input.userId,
              predictionId: input.predictionId,
              previousResult: current.result,
              previousResolutionDate: current.resolutionDate,
              previousActualPrice: current.actualPrice,
              previousOutcomeNotes: current.outcomeNotes,
              newResult: input.result,
              newResolutionDate: resolutionDate,
              newActualPrice: toDecimalOrNull(input.actualPrice) ?? null,
              newOutcomeNotes: input.outcomeNotes ?? null,
            },
          })
        }

        await tx.prediction.updateMany({
          where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
          data: {
            result: input.result,
            resolutionDate,
            actualPrice: toDecimalOrNull(input.actualPrice) ?? null,
            outcomeNotes: input.outcomeNotes ?? null,
          },
        })

        return tx.prediction.findFirstOrThrow({
          where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
        })
      })

      return { status: 'updated', prediction }
    },

    async clearResult(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }

      const hadPriorResult = current.result !== null

      const prediction = await prisma.$transaction(async (tx) => {
        if (hadPriorResult) {
          await tx.predictionResultHistory.create({
            data: {
              organizationId: input.organizationId,
              userId: input.userId,
              predictionId: input.predictionId,
              previousResult: current.result,
              previousResolutionDate: current.resolutionDate,
              previousActualPrice: current.actualPrice,
              previousOutcomeNotes: current.outcomeNotes,
              newResult: null,
              newResolutionDate: null,
              newActualPrice: null,
              newOutcomeNotes: null,
            },
          })
        }

        await tx.prediction.updateMany({
          where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
          data: { result: null, resolutionDate: null, actualPrice: null, outcomeNotes: null },
        })

        return tx.prediction.findFirstOrThrow({
          where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
        })
      })

      return { status: 'updated', prediction }
    },

    async void(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }
      if (current.voidedAt !== null) {
        return { status: 'already_voided' }
      }

      const result = await prisma.prediction.updateMany({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
        data: { voidedAt: new Date(), voidReason: input.voidReason ?? null },
      })
      if (result.count === 0) {
        return { status: 'not_found' }
      }

      const prediction = await prisma.prediction.findFirstOrThrow({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      return { status: 'updated', prediction }
    },

    async restore(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }
      if (current.voidedAt === null) {
        return { status: 'not_voided' }
      }

      const result = await prisma.prediction.updateMany({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
        data: { voidedAt: null, voidReason: null },
      })
      if (result.count === 0) {
        return { status: 'not_found' }
      }

      const prediction = await prisma.prediction.findFirstOrThrow({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      return { status: 'updated', prediction }
    },

    async delete(input) {
      const current = await prisma.prediction.findFirst({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      if (!current) {
        return { status: 'not_found' }
      }
      if (current.voidedAt === null) {
        return { status: 'not_voided' }
      }

      const result = await prisma.prediction.deleteMany({
        where: { id: input.predictionId, organizationId: input.organizationId, userId: input.userId },
      })
      return result.count === 0 ? { status: 'not_found' } : { status: 'deleted' }
    },

    countDue({ organizationId, userId, asOfLocalDate }) {
      return prisma.prediction.count({
        where: {
          organizationId,
          userId,
          voidedAt: null,
          result: null,
          deadline: { lt: localDateToPrismaDate(asOfLocalDate) },
        },
      })
    },

    async suggestOtherSymbols({ organizationId, userId, query, limit }) {
      const normalizedQuery = normalizeSecurityIdentity(query)
      if (!normalizedQuery) return []

      const rows = await prisma.prediction.findMany({
        where: {
          organizationId,
          userId,
          otherSymbol: { startsWith: normalizedQuery },
        },
        distinct: ['otherSymbol'],
        select: { otherSymbol: true },
        orderBy: { otherSymbol: 'asc' },
        take: limit ?? 10,
      })
      return rows
        .map((row) => row.otherSymbol)
        .filter((symbol): symbol is string => symbol !== null)
    },

    async suggestTags({ organizationId, userId, query, limit }) {
      const trimmedQuery = query.trim()
      const rows = await prisma.$queryRaw<Array<{ tag: string }>>(Prisma.sql`
        SELECT DISTINCT tag
        FROM "predictions", unnest("tags") AS tag
        WHERE "organizationId" = ${organizationId}
          AND "userId" = ${userId}
          AND tag ILIKE ${trimmedQuery + '%'}
        ORDER BY tag ASC
        LIMIT ${limit ?? 10}
      `)
      return rows.map((row) => row.tag)
    },

    async statsRecords({ organizationId, userId }) {
      const records = await prisma.prediction.findMany({
        where: { organizationId, userId },
        select: {
          id: true,
          organizationId: true,
          userId: true,
          type: true,
          result: true,
          voidedAt: true,
          amended: true,
          deadline: true,
          confidence: true,
          resolutionDate: true,
          symbolSnapshot: true,
          symbolNormalizedSnapshot: true,
          otherSymbol: true,
          direction: true,
          priceAtPrediction: true,
          predictedPrice: true,
          predictedPercent: true,
          actualPrice: true,
        },
      })
      return records.map((record) => ({
        ...record,
        priceAtPrediction: record.priceAtPrediction?.toString() ?? null,
        predictedPrice: record.predictedPrice?.toString() ?? null,
        predictedPercent: record.predictedPercent?.toString() ?? null,
        actualPrice: record.actualPrice?.toString() ?? null,
      }))
    },

    async statsAggregate({ organizationId, userId, includeAmended }) {
      const grouped = await prisma.prediction.groupBy({
        by: ['type', 'result'],
        where: {
          organizationId,
          userId,
          voidedAt: null,
          ...(includeAmended === false ? { amended: false } : {}),
        },
        _count: { _all: true },
      })

      return grouped.map((row) => ({
        type: row.type,
        result: row.result,
        count: row._count._all,
      }))
    },
  }
}