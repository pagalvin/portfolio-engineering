export type PredictionType =
  | 'DIRECTION'
  | 'PERCENT_MOVE'
  | 'TARGET_PRICE'
  | 'EVENT_REACTION'
  | 'FREEFORM'

export type PredictionDirection = 'RISES' | 'FALLS'
export type PredictionResult = 'CORRECT' | 'INCORRECT'
export type PredictionStatus = 'open' | 'due' | 'resolved' | 'void'
export type DeadlinePreset = 'today' | 'week' | 'month'
export type DeadlinePeriod = 'week' | 'month'

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

export interface PredictionClaim {
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
  priceAtPrediction: number | string | null
  priceCapturedAt: string | null
  predictedPrice: number | string | null
  predictedPercent: number | string | null
}

export interface DerivedPredictionValues {
  predictedPrice: number
  predictedPercent: number
}

export interface TargetPriceDetails extends DerivedPredictionValues {
  direction: PredictionDirection
}

export interface ResultSuggestionInput {
  type: PredictionType
  direction: PredictionDirection | null
  priceAtPrediction: number | null
  predictedPrice: number | null
  actualPrice: number | null
}

export interface HitRate {
  numerator: number
  denominator: number
  value: number | null
}

export interface CalibrationEntry {
  confidence: number
  result: PredictionResult
}

export interface CalibrationBucket {
  bucket: '50-59' | '60-69' | '70-79' | '80-89' | '90-100'
  count: number
  correct: number
  hitRate: number | null
  lowSample: boolean
}

export interface ResolvedPrediction {
  resolutionDate: string
  result: PredictionResult
}

export interface ResolutionPeriodBucket {
  bucketStart: string
  bucketEnd: string
  correct: number
  incorrect: number
  count: number
  hitRate: number | null
}

const GRACE_PERIOD_MS = 5 * 60 * 1000
const CALIBRATION_LOW_SAMPLE_THRESHOLD = 5
const CALIBRATION_BUCKETS = [
  { bucket: '50-59', minimum: 50, maximum: 59 },
  { bucket: '60-69', minimum: 60, maximum: 69 },
  { bucket: '70-79', minimum: 70, maximum: 79 },
  { bucket: '80-89', minimum: 80, maximum: 89 },
  { bucket: '90-100', minimum: 90, maximum: 100 },
] as const

function requirePositiveFinite(value: number, name: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(name + ' must be a positive finite number.')
  }
}

function requireConfidence(value: number): void {
  if (!Number.isInteger(value) || value < 50 || value > 100) {
    throw new RangeError('Confidence must be a whole percentage from 50 to 100.')
  }
}

function parseCalendarDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new RangeError('Date must use YYYY-MM-DD format.')
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new RangeError('Date must be a real calendar date.')
  }
  return date
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function timestamp(value: Date | string | number): number {
  const result = value instanceof Date ? value.getTime() : new Date(value).getTime()
  if (!Number.isFinite(result)) {
    throw new RangeError('Timestamp must be a valid date.')
  }
  return result
}

function requireCount(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(name + ' must be a non-negative integer.')
  }
}

function decimalValueKey(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new RangeError('Decimal claim values must be strings or numbers.')
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError('Decimal claim values must be finite.')
  }

  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value))
  if (!match) throw new RangeError('Decimal claim values must be valid numbers.')
  const sign = match[1] === '-' ? '-' : ''
  const integerPart = match[2]
  const fractionalPart = match[3] ?? ''
  const exponent = Number(match[4] ?? 0)
  const digits = integerPart + fractionalPart
  const decimalPosition = integerPart.length + exponent
  let integer: string
  let fraction: string

  if (decimalPosition <= 0) {
    integer = '0'
    fraction = '0'.repeat(-decimalPosition) + digits
  } else if (decimalPosition >= digits.length) {
    integer = digits + '0'.repeat(decimalPosition - digits.length)
    fraction = ''
  } else {
    integer = digits.slice(0, decimalPosition)
    fraction = digits.slice(decimalPosition)
  }

  integer = integer.replace(/^0+(?=\d)/, '')
  fraction = fraction.replace(/0+$/, '')
  const normalized = fraction ? integer + '.' + fraction : integer
  return /^0(?:\.0*)?$/.test(normalized) ? '0' : sign + normalized
}

function dateTimeKey(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (!(value instanceof Date) && typeof value !== 'string') {
    throw new RangeError('Timestamp claim values must be dates or strings.')
  }
  return new Date(value).toISOString()
}

function calendarDateKey(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value !== 'string') throw new RangeError('Calendar date claim values must be strings.')
  return formatCalendarDate(parseCalendarDate(value))
}

function claimValuesEqual(field: PredictionClaimField, left: unknown, right: unknown): boolean {
  if (field === 'priceAtPrediction' || field === 'predictedPrice' || field === 'predictedPercent') {
    return decimalValueKey(left) === decimalValueKey(right)
  }
  if (field === 'priceCapturedAt') return dateTimeKey(left) === dateTimeKey(right)
  if (field === 'deadline') return calendarDateKey(left) === calendarDateKey(right)
  return left === right
}

export function derivePriceFromPercent(
  priceAtPrediction: number,
  percent: number,
  direction: PredictionDirection,
): number {
  requirePositiveFinite(priceAtPrediction, 'Price at prediction')
  if (!Number.isFinite(percent) || percent <= 0) {
    throw new RangeError('Move percentage must be a positive finite number.')
  }

  const factor = direction === 'RISES' ? 1 + percent / 100 : 1 - percent / 100
  const predictedPrice = priceAtPrediction * factor
  requirePositiveFinite(predictedPrice, 'Predicted price')
  return predictedPrice
}

export function derivePercentChange(priceAtPrediction: number, price: number): number {
  requirePositiveFinite(priceAtPrediction, 'Price at prediction')
  requirePositiveFinite(price, 'Price')
  return ((price - priceAtPrediction) / priceAtPrediction) * 100
}

export function deriveDirectionFromPrice(
  priceAtPrediction: number,
  predictedPrice: number,
): PredictionDirection {
  const change = derivePercentChange(priceAtPrediction, predictedPrice)
  if (change === 0) {
    throw new RangeError('Predicted price must differ from price at prediction.')
  }
  return change > 0 ? 'RISES' : 'FALLS'
}

export function derivePredictedValuesFromPercent(
  priceAtPrediction: number,
  percent: number,
  direction: PredictionDirection,
): DerivedPredictionValues {
  return {
    predictedPrice: derivePriceFromPercent(priceAtPrediction, percent, direction),
    predictedPercent: percent,
  }
}

export function deriveTargetPriceDetails(
  priceAtPrediction: number,
  targetPrice: number,
): TargetPriceDetails {
  const direction = deriveDirectionFromPrice(priceAtPrediction, targetPrice)
  return {
    direction,
    predictedPrice: targetPrice,
    predictedPercent: Math.abs(derivePercentChange(priceAtPrediction, targetPrice)),
  }
}

export function suggestPredictionResult(input: ResultSuggestionInput): PredictionResult | null {
  const { type, direction, priceAtPrediction, predictedPrice, actualPrice } = input
  if (type === 'FREEFORM' || actualPrice === null) {
    return null
  }
  requirePositiveFinite(actualPrice, 'Actual price')

  if (type === 'TARGET_PRICE' || type === 'PERCENT_MOVE' || (type === 'EVENT_REACTION' && predictedPrice !== null)) {
    if (predictedPrice === null) {
      return null
    }
    requirePositiveFinite(predictedPrice, 'Predicted price')
    const targetDirection = direction ?? deriveDirectionFromPrice(
      priceAtPrediction ?? NaN,
      predictedPrice,
    )
    const reached = targetDirection === 'RISES'
      ? actualPrice >= predictedPrice
      : actualPrice <= predictedPrice
    return reached ? 'CORRECT' : 'INCORRECT'
  }

  if (priceAtPrediction === null || direction === null) {
    return null
  }
  requirePositiveFinite(priceAtPrediction, 'Price at prediction')
  const movedInDirection = direction === 'RISES'
    ? actualPrice > priceAtPrediction
    : actualPrice < priceAtPrediction
  return movedInDirection ? 'CORRECT' : 'INCORRECT'
}

export function calculateHitRate(correct: number, incorrect: number): HitRate {
  requireCount(correct, 'Correct count')
  requireCount(incorrect, 'Incorrect count')
  const denominator = correct + incorrect
  return {
    numerator: correct,
    denominator,
    value: denominator === 0 ? null : correct / denominator,
  }
}

export function calculateCalibrationBuckets(
  predictions: readonly CalibrationEntry[],
): CalibrationBucket[] {
  const counts = CALIBRATION_BUCKETS.map(({ bucket, minimum, maximum }) => ({
    bucket,
    minimum,
    maximum,
    count: 0,
    correct: 0,
  }))

  for (const prediction of predictions) {
    requireConfidence(prediction.confidence)
    const bucket = counts.find(({ minimum, maximum }) =>
      prediction.confidence >= minimum && prediction.confidence <= maximum,
    )
    if (!bucket) {
      throw new RangeError('Confidence does not belong to a calibration bucket.')
    }
    bucket.count += 1
    if (prediction.result === 'CORRECT') {
      bucket.correct += 1
    }
  }

  return counts.map(({ bucket, count, correct }) => ({
    bucket,
    count,
    correct,
    hitRate: calculateHitRate(correct, count - correct).value,
    lowSample: count < CALIBRATION_LOW_SAMPLE_THRESHOLD,
  }))
}

export function getResolutionDateBucket(
  resolutionDate: string,
  period: DeadlinePeriod,
): { bucketStart: string; bucketEnd: string } {
  const date = parseCalendarDate(resolutionDate)
  if (period === 'week') {
    const start = addCalendarDays(date, -date.getUTCDay())
    return {
      bucketStart: formatCalendarDate(start),
      bucketEnd: formatCalendarDate(addCalendarDays(start, 6)),
    }
  }
  if (period === 'month') {
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    return { bucketStart: formatCalendarDate(start), bucketEnd: formatCalendarDate(end) }
  }
  throw new RangeError('Period must be week or month.')
}

export function groupResolvedPredictionsByPeriod(
  predictions: readonly ResolvedPrediction[],
  period: DeadlinePeriod,
): ResolutionPeriodBucket[] {
  const groups = new Map<string, Omit<ResolutionPeriodBucket, 'hitRate'>>()
  for (const prediction of predictions) {
    const bounds = getResolutionDateBucket(prediction.resolutionDate, period)
    const group = groups.get(bounds.bucketStart) ?? {
      ...bounds,
      correct: 0,
      incorrect: 0,
      count: 0,
    }
    if (prediction.result === 'CORRECT') group.correct += 1
    else group.incorrect += 1
    group.count += 1
    groups.set(bounds.bucketStart, group)
  }

  return [...groups.values()]
    .sort((left, right) => left.bucketStart.localeCompare(right.bucketStart))
    .map((group) => ({
      ...group,
      hitRate: calculateHitRate(group.correct, group.incorrect).value,
    }))
}

export function resolveDeadlinePreset(preset: DeadlinePreset, asOfLocalDate: string): string {
  const today = parseCalendarDate(asOfLocalDate)
  if (preset === 'today') {
    return formatCalendarDate(today)
  }

  if (preset === 'week') {
    const sunday = addCalendarDays(today, -today.getUTCDay())
    let friday = addCalendarDays(sunday, 5)
    if (friday < today) friday = addCalendarDays(friday, 7)
    return formatCalendarDate(friday)
  }

  if (preset === 'month') {
    const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    let lastWeekday = new Date(lastDay)
    while (lastWeekday.getUTCDay() === 0 || lastWeekday.getUTCDay() === 6) {
      lastWeekday = addCalendarDays(lastWeekday, -1)
    }
    if (lastWeekday < today) {
      lastWeekday = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 2, 0))
      while (lastWeekday.getUTCDay() === 0 || lastWeekday.getUTCDay() === 6) {
        lastWeekday = addCalendarDays(lastWeekday, -1)
      }
    }
    return formatCalendarDate(lastWeekday)
  }

  throw new RangeError('Preset must be today, week, or month.')
}

export function isTradingDay(date: string): boolean {
  const weekday = parseCalendarDate(date).getUTCDay()
  return weekday !== 0 && weekday !== 6
}

export function hasDeadlinePassed(deadline: string, asOfLocalDate: string): boolean {
  parseCalendarDate(deadline)
  parseCalendarDate(asOfLocalDate)
  return asOfLocalDate > deadline
}

export function derivePredictionStatus(input: {
  deadline: string
  asOfLocalDate: string
  hasResult: boolean
  isVoided: boolean
}): PredictionStatus {
  if (input.isVoided) return 'void'
  if (input.hasResult) return 'resolved'
  return hasDeadlinePassed(input.deadline, input.asOfLocalDate) ? 'due' : 'open'
}

export function canRecordResultEarly(
  type: PredictionType,
  result: PredictionResult,
): boolean {
  return result === 'CORRECT' && (type === 'TARGET_PRICE' || type === 'PERCENT_MOVE')
}

export function getResultRecordingBlockReason(input: {
  type: PredictionType
  result: PredictionResult
  deadline: string
  asOfLocalDate: string
}): 'deadline_not_passed' | null {
  return hasDeadlinePassed(input.deadline, input.asOfLocalDate) ||
    canRecordResultEarly(input.type, input.result)
    ? null
    : 'deadline_not_passed'
}

export function isResolutionDateInRange(input: {
  createdDate: string
  resolutionDate: string
  asOfLocalDate: string
}): boolean {
  parseCalendarDate(input.createdDate)
  parseCalendarDate(input.resolutionDate)
  parseCalendarDate(input.asOfLocalDate)
  return input.resolutionDate >= input.createdDate && input.resolutionDate <= input.asOfLocalDate
}

export function getGracePeriodEndsAt(createdAt: Date | string | number): Date {
  return new Date(timestamp(createdAt) + GRACE_PERIOD_MS)
}

export function getGracePeriodRemainingMs(
  createdAt: Date | string | number,
  now: Date | string | number,
): number {
  return Math.max(0, timestamp(getGracePeriodEndsAt(createdAt)) - timestamp(now))
}

export function isWithinGracePeriod(
  createdAt: Date | string | number,
  now: Date | string | number,
): boolean {
  const createdTime = timestamp(createdAt)
  const nowTime = timestamp(now)
  return nowTime >= createdTime && nowTime < createdTime + GRACE_PERIOD_MS
}

export function changedClaimFields(
  current: Partial<PredictionClaim>,
  updates: Partial<PredictionClaim>,
): PredictionClaimField[] {
  return PREDICTION_CLAIM_FIELDS.filter((field) =>
    Object.prototype.hasOwnProperty.call(updates, field) &&
    updates[field] !== undefined &&
    !claimValuesEqual(field, current[field], updates[field]),
  )
}

export function shouldRecordReasoningHistory(input: {
  previousReasoning: string | null
  nextReasoning: string | null
  createdAt: Date | string | number
  now: Date | string | number
}): boolean {
  return input.previousReasoning !== input.nextReasoning &&
    !isWithinGracePeriod(input.createdAt, input.now)
}

export function normalizePredictionSymbol(value: string): string {
  return value.normalize('NFKC').trim().toUpperCase()
}
