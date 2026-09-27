import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateCalibrationBuckets,
  calculateHitRate,
  canRecordResultEarly,
  changedClaimFields,
  deriveDirectionFromPrice,
  derivePercentChange,
  derivePredictionStatus,
  derivePriceFromPercent,
  deriveTargetPriceDetails,
  getGracePeriodRemainingMs,
  getResolutionDateBucket,
  getResultRecordingBlockReason,
  groupResolvedPredictionsByPeriod,
  hasDeadlinePassed,
  isResolutionDateInRange,
  isTradingDay,
  normalizePredictionSymbol,
  resolveDeadlinePreset,
  shouldRecordReasoningHistory,
  suggestPredictionResult,
} from './intuitionLedgerRules.js'

test('derives prices and percentages for measurable predictions (AC 7)', () => {
  assert.equal(derivePriceFromPercent(420, 1, 'RISES'), 424.2)
  assert.deepEqual(deriveTargetPriceDetails(140, 150), {
    direction: 'RISES',
    predictedPrice: 150,
    predictedPercent: derivePercentChange(140, 150),
  })
  assert.equal(deriveDirectionFromPrice(140, 130), 'FALLS')
})

test('resolves deadline presets using local calendar dates and weekdays (AC 10)', () => {
  assert.equal(resolveDeadlinePreset('today', '2026-09-27'), '2026-09-27')
  assert.equal(resolveDeadlinePreset('week', '2026-09-27'), '2026-10-02')
  assert.equal(resolveDeadlinePreset('week', '2026-10-03'), '2026-10-09')
  assert.equal(resolveDeadlinePreset('month', '2026-09-01'), '2026-09-30')
  assert.equal(resolveDeadlinePreset('month', '2026-02-28'), '2026-03-31')
  assert.equal(isTradingDay('2026-10-02'), true)
  assert.equal(isTradingDay('2026-10-03'), false)
})

test('only Target price and Percent move Correct results are eligible before deadline (AC 13)', () => {
  assert.equal(canRecordResultEarly('TARGET_PRICE', 'CORRECT'), true)
  assert.equal(canRecordResultEarly('PERCENT_MOVE', 'CORRECT'), true)
  assert.equal(canRecordResultEarly('DIRECTION', 'CORRECT'), false)
  assert.equal(canRecordResultEarly('TARGET_PRICE', 'INCORRECT'), false)
  assert.equal(getResultRecordingBlockReason({
    type: 'TARGET_PRICE', result: 'CORRECT', deadline: '2026-09-28', asOfLocalDate: '2026-09-27',
  }), null)
  assert.equal(getResultRecordingBlockReason({
    type: 'EVENT_REACTION', result: 'CORRECT', deadline: '2026-09-28', asOfLocalDate: '2026-09-27',
  }), 'deadline_not_passed')
  assert.equal(getResultRecordingBlockReason({
    type: 'PERCENT_MOVE', result: 'INCORRECT', deadline: '2026-09-28', asOfLocalDate: '2026-09-27',
  }), 'deadline_not_passed')
})

test('suggests results from actual price using threshold and direction rules (AC 15, AC 16, A2)', () => {
  assert.equal(suggestPredictionResult({
    type: 'PERCENT_MOVE', direction: 'RISES', priceAtPrediction: 420,
    predictedPrice: 424.2, actualPrice: 423,
  }), 'INCORRECT')
  assert.equal(suggestPredictionResult({
    type: 'TARGET_PRICE', direction: 'RISES', priceAtPrediction: 140,
    predictedPrice: 150, actualPrice: 150,
  }), 'CORRECT')
  assert.equal(suggestPredictionResult({
    type: 'TARGET_PRICE', direction: 'FALLS', priceAtPrediction: 140,
    predictedPrice: 130, actualPrice: 130,
  }), 'CORRECT')
  assert.equal(suggestPredictionResult({
    type: 'DIRECTION', direction: 'RISES', priceAtPrediction: 420,
    predictedPrice: null, actualPrice: 420,
  }), 'INCORRECT')
  assert.equal(suggestPredictionResult({
    type: 'FREEFORM', direction: null, priceAtPrediction: null,
    predictedPrice: null, actualPrice: 42,
  }), null)
})

test('returns unavailable hit rate and calibration buckets with low-sample indicators', () => {
  assert.deepEqual(calculateHitRate(0, 0), { numerator: 0, denominator: 0, value: null })
  assert.deepEqual(calculateHitRate(3, 1), { numerator: 3, denominator: 4, value: 0.75 })
  const buckets = calculateCalibrationBuckets([
    { confidence: 50, result: 'CORRECT' },
    { confidence: 59, result: 'INCORRECT' },
    { confidence: 100, result: 'CORRECT' },
  ])
  assert.deepEqual(buckets[0], {
    bucket: '50-59', count: 2, correct: 1, hitRate: 0.5, lowSample: true,
  })
  assert.deepEqual(buckets[4], {
    bucket: '90-100', count: 1, correct: 1, hitRate: 1, lowSample: true,
  })
})

test('groups time series by Sunday-through-Saturday weeks and resolution month (ADR 0006, A9)', () => {
  assert.deepEqual(getResolutionDateBucket('2026-10-03', 'week'), {
    bucketStart: '2026-09-27', bucketEnd: '2026-10-03',
  })
  assert.deepEqual(getResolutionDateBucket('2026-02-28', 'month'), {
    bucketStart: '2026-02-01', bucketEnd: '2026-02-28',
  })
  assert.deepEqual(groupResolvedPredictionsByPeriod([
    { resolutionDate: '2026-10-03', result: 'INCORRECT' },
    { resolutionDate: '2026-09-27', result: 'CORRECT' },
  ], 'week'), [{
    bucketStart: '2026-09-27', bucketEnd: '2026-10-03',
    correct: 1, incorrect: 1, count: 2, hitRate: 0.5,
  }])
})

test('keeps deadline status open through the deadline date (FR 37, A1)', () => {
  assert.equal(hasDeadlinePassed('2026-09-27', '2026-09-27'), false)
  assert.equal(hasDeadlinePassed('2026-09-27', '2026-09-28'), true)
  assert.equal(derivePredictionStatus({
    deadline: '2026-09-27', asOfLocalDate: '2026-09-27', hasResult: false, isVoided: false,
  }), 'open')
  assert.equal(derivePredictionStatus({
    deadline: '2026-09-27', asOfLocalDate: '2026-09-28', hasResult: false, isVoided: false,
  }), 'due')
  assert.equal(derivePredictionStatus({
    deadline: '2026-09-27', asOfLocalDate: '2026-09-28', hasResult: true, isVoided: true,
  }), 'void')
})

test('enforces resolution-date bounds against creation and today (FR 24)', () => {
  assert.equal(isResolutionDateInRange({
    createdDate: '2026-09-20', resolutionDate: '2026-09-19', asOfLocalDate: '2026-09-27',
  }), false)
  assert.equal(isResolutionDateInRange({
    createdDate: '2026-09-20', resolutionDate: '2026-09-21', asOfLocalDate: '2026-09-27',
  }), true)
  assert.equal(isResolutionDateInRange({
    createdDate: '2026-09-20', resolutionDate: '2026-09-28', asOfLocalDate: '2026-09-27',
  }), false)
})

test('normalizes symbols using Unicode compatibility normalization', () => {
  assert.equal(normalizePredictionSymbol(' \uFF21\uFF42\uFF43 '), 'ABC')
})

test('tracks grace time and records only changed post-window reasoning (FR 18-19a)', () => {
  const createdAt = '2026-09-27T12:00:00.000Z'
  assert.equal(getGracePeriodRemainingMs(createdAt, '2026-09-27T12:04:59.000Z'), 1000)
  assert.equal(getGracePeriodRemainingMs(createdAt, '2026-09-27T12:05:00.000Z'), 0)
  assert.equal(shouldRecordReasoningHistory({
    previousReasoning: 'Original', nextReasoning: 'Changed', createdAt,
    now: '2026-09-27T12:04:59.000Z',
  }), false)
  assert.equal(shouldRecordReasoningHistory({
    previousReasoning: 'Original', nextReasoning: 'Changed', createdAt,
    now: '2026-09-27T12:05:00.000Z',
  }), true)
  assert.equal(shouldRecordReasoningHistory({
    previousReasoning: 'Same', nextReasoning: 'Same', createdAt,
    now: '2026-09-27T12:06:00.000Z',
  }), false)
})

test('compares only supplied claim fields, never non-claim data', () => {
  assert.deepEqual(changedClaimFields(
    { claimText: 'Original', confidence: 70 },
    { claimText: 'Changed', confidence: 70 },
  ), ['claimText'])
  assert.deepEqual(changedClaimFields(
    {
      priceAtPrediction: '420.00', predictedPrice: '424.2000', predictedPercent: 1,
      priceCapturedAt: '2026-09-27T12:00:00.000Z', deadline: '2026-09-27',
    },
    {
      priceAtPrediction: '420', predictedPrice: 424.2, predictedPercent: '1.000',
      priceCapturedAt: '2026-09-27T14:00:00.000+02:00', deadline: '2026-09-27',
    },
  ), [])
  assert.deepEqual(changedClaimFields(
    { priceAtPrediction: '420.00' },
    { priceAtPrediction: '421.00' },
  ), ['priceAtPrediction'])
})
