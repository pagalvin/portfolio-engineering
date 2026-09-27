export type PredictionType =
  | 'DIRECTION'
  | 'PERCENT_MOVE'
  | 'TARGET_PRICE'
  | 'EVENT_REACTION'
  | 'FREEFORM'

export type PredictionDirection = 'RISES' | 'FALLS'
export type PredictionResult = 'CORRECT' | 'INCORRECT'
export type PredictionStatus = 'active' | 'open' | 'due' | 'resolved' | 'void' | 'all'
export type PredictionTypeFilter =
  | 'direction'
  | 'percent_move'
  | 'target_price'
  | 'event_reaction'
  | 'freeform'
export type PredictionClaimField =
  | 'securityId'
  | 'otherSymbol'
  | 'topic'
  | 'symbolSnapshot'
  | 'symbolNormalizedSnapshot'
  | 'type'
  | 'direction'
  | 'claimText'
  | 'eventLabel'
  | 'deadline'
  | 'confidence'
  | 'priceAtPrediction'
  | 'priceCapturedAt'
  | 'predictedPrice'
  | 'predictedPercent'

export interface PredictionClaimFields {
  securityId?: string | null
  otherSymbol?: string | null
  topic?: string | null
  type?: PredictionType
  direction?: PredictionDirection | null
  claimText?: string
  eventLabel?: string | null
  deadline?: string
  confidence?: number
  priceAtPrediction?: string | null
  priceCapturedAt?: string | null
  predictedPrice?: string | null
  predictedPercent?: string | null
}

export interface CreatePredictionRequest extends PredictionClaimFields {
  type: PredictionType
  claimText: string
  deadline: string
  confidence: number
  reasoning?: string | null
  tags?: string[]
}

export interface UpdatePredictionRequest extends PredictionClaimFields {
  reasoning?: string | null
  tags?: string[]
  confirmAmend?: boolean
}

export interface RecordPredictionResultRequest {
  result: PredictionResult
  resolutionDate: string
  actualPrice?: string | null
  outcomeNotes?: string | null
  asOfLocalDate: string
}

export interface PredictionListQuery {
  q?: string
  status?: PredictionStatus
  type?: PredictionTypeFilter
  symbol?: string
  result?: 'correct' | 'incorrect'
  tag?: string
  amended?: 'only' | 'exclude'
  asOfLocalDate?: string
}

export interface PredictionSuggestionQuery {
  q: string
  limit?: number
}

export interface PredictionDueCountQuery {
  asOfLocalDate: string
}

export interface PredictionDashboardStatsQuery {
  period: 'week' | 'month'
  amended?: 'include' | 'exclude'
  asOfLocalDate: string
}

export interface PredictionRecord {
  id: string
  organizationId: string
  userId: string
  securityId: string | null
  otherSymbol: string | null
  topic: string | null
  symbolSnapshot: string | null
  symbolNormalizedSnapshot: string | null
  type: PredictionType
  direction: PredictionDirection | null
  claimText: string
  eventLabel: string | null
  deadline: string
  confidence: number
  priceAtPrediction: string | null
  predictedPrice: string | null
  predictedPercent: string | null
  priceCapturedAt: string | null
  reasoning: string | null
  tags: string[]
  result: PredictionResult | null
  resolutionDate: string | null
  actualPrice: string | null
  outcomeNotes: string | null
  voidedAt: string | null
  voidReason: string | null
  amended: boolean
  amendedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface PredictionAmendmentRecord {
  id: string
  predictionId: string
  previousSecurityId: string | null
  previousOtherSymbol: string | null
  previousTopic: string | null
  previousSymbolSnapshot: string | null
  previousSymbolNormalizedSnapshot: string | null
  previousType: PredictionType
  previousDirection: PredictionDirection | null
  previousClaimText: string
  previousEventLabel: string | null
  previousDeadline: string
  previousConfidence: number
  previousPriceAtPrediction: string | null
  previousPriceCapturedAt: string | null
  previousPredictedPrice: string | null
  previousPredictedPercent: string | null
  changedFields: PredictionClaimField[]
  changedAt: string
}

export interface PredictionResultHistoryRecord {
  id: string
  predictionId: string
  previousResult: PredictionResult | null
  previousResolutionDate: string | null
  previousActualPrice: string | null
  previousOutcomeNotes: string | null
  newResult: PredictionResult | null
  newResolutionDate: string | null
  newActualPrice: string | null
  newOutcomeNotes: string | null
  changedAt: string
}

export interface PredictionReasoningHistoryRecord {
  id: string
  predictionId: string
  previousReasoning: string | null
  newReasoning: string | null
  changedAt: string
}

export interface PredictionListItem extends PredictionRecord {
  resultChanged: boolean
}

export interface PredictionListResponse {
  predictions: PredictionListItem[]
  filteredCount: number
  totalCount: number
}

export interface PredictionMutationResponse {
  prediction: PredictionRecord
}

export interface PredictionDetailResponse {
  prediction: PredictionListItem
  amendmentHistory: PredictionAmendmentRecord[]
  resultHistory: PredictionResultHistoryRecord[]
  reasoningHistory: PredictionReasoningHistoryRecord[]
  gracePeriodEndsAt: string
}

export interface PredictionDeleteResponse {
  success: true
  deletedPredictionId: string
}

export interface PredictionDueCountResponse {
  dueCount: number
}

export interface PredictionOtherSymbolSuggestionsResponse {
  symbols: string[]
}

export interface PredictionTagSuggestionsResponse {
  tags: string[]
}

export interface PredictionHitRate {
  numerator: number
  denominator: number
  value: number | null
}

export interface PredictionCalibrationBucket {
  bucket: '50-59' | '60-69' | '70-79' | '80-89' | '90-100'
  count: number
  correct: number
  hitRate: number | null
  lowSample: boolean
}

export interface PredictionTypeStats {
  type: PredictionType
  correct: number
  incorrect: number
  count: number
  hitRate: number | null
}

export interface PredictionSymbolStats {
  symbol: string
  symbolNormalized: string
  correct: number
  incorrect: number
  count: number
  hitRate: number | null
}

export interface PredictionTimeSeriesBucket {
  bucketStart: string
  bucketEnd: string
  correct: number
  incorrect: number
  count: number
  hitRate: number | null
}

export interface PredictionScatterPoint {
  predictionId: string
  symbol: string | null
  predictedPercent: number
  actualPercent: number
}

export interface PredictionDashboardStatsResponse {
  summary: {
    open: number
    due: number
    resolved: number
    voided: number
  }
  hitRate: PredictionHitRate
  calibration: PredictionCalibrationBucket[]
  byType: PredictionTypeStats[]
  bySymbol: PredictionSymbolStats[]
  timeSeries: PredictionTimeSeriesBucket[]
  scatterPoints: PredictionScatterPoint[]
}

export type PredictionErrorCode =
  | 'validation_error'
  | 'invalid_security_reference'
  | 'not_found'
  | 'amend_confirmation_required'
  | 'deadline_not_passed'
  | 'resolution_date_out_of_range'
  | 'already_voided'
  | 'not_voided'

export type PredictionErrorResponse =
  | {
      code: 'validation_error'
      message: string
      fieldErrors?: Record<string, string[]>
    }
  | {
      code: 'amend_confirmation_required'
      message: string
      changedFields: PredictionClaimField[]
    }
  | {
      code: Exclude<PredictionErrorCode, 'validation_error' | 'amend_confirmation_required'>
      message: string
    }