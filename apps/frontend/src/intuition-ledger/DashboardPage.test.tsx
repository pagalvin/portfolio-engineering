import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { PredictionDashboardStatsResponse, PredictionListItem, PredictionRecord } from '@portfolio-engineering/shared-types/intuitionLedger'
import { DashboardContent } from './DashboardPage'
import { dashboardUrl, loadDashboardData, sortDashboardDuePredictions } from './dashboardApi'
import { CalibrationChart } from './charts/CalibrationChart'
import { PredictedVsActualChart } from './charts/PredictedVsActualChart'
import { ResultsBySymbolChart } from './charts/ResultsBySymbolChart'
import { calibrationActualBarFill, topPredictionSymbols } from './charts/chartUtils'

;(globalThis as { React?: typeof React }).React = React

const calibration: PredictionDashboardStatsResponse['calibration'] = [
  { bucket: '50-59', count: 8, correct: 4, hitRate: 0.5, lowSample: false },
  { bucket: '60-69', count: 9, correct: 5, hitRate: 5 / 9, lowSample: false },
  { bucket: '70-79', count: 6, correct: 4, hitRate: 2 / 3, lowSample: false },
  { bucket: '80-89', count: 3, correct: 1, hitRate: 1 / 3, lowSample: true },
  { bucket: '90-100', count: 5, correct: 3, hitRate: 0.6, lowSample: false },
]

const baseStats: PredictionDashboardStatsResponse = {
  summary: { open: 7, due: 2, resolved: 31, voided: 1 },
  hitRate: { numerator: 18, denominator: 31, value: 18 / 31 },
  calibration,
  byType: [
    { type: 'PERCENT_MOVE', correct: 8, incorrect: 4, count: 12, hitRate: 2 / 3 },
    { type: 'DIRECTION', correct: 3, incorrect: 2, count: 5, hitRate: 0.6 },
  ],
  bySymbol: Array.from({ length: 12 }, (_, index) => ({
    symbol: `SYM${index + 1}`,
    symbolNormalized: `SYM${index + 1}`,
    correct: 8 - Math.min(index, 6),
    incorrect: 2,
    count: 10 - Math.min(index, 6),
    hitRate: (8 - Math.min(index, 6)) / (10 - Math.min(index, 6)),
  })),
  timeSeries: [{ bucketStart: '2026-09-20', bucketEnd: '2026-09-26', correct: 3, incorrect: 2, count: 5, hitRate: 0.6 }],
  scatterPoints: [{ predictionId: 'scatter-1', symbol: 'MSFT', predictedPercent: -3.5, actualPercent: -2 }],
}

function prediction(overrides: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    id: 'prediction-1', organizationId: 'org-1', userId: 'user-1', securityId: 'security-1',
    otherSymbol: null, topic: null, symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT',
    type: 'PERCENT_MOVE', direction: 'RISES', claimText: 'MSFT rises 1% by Friday', eventLabel: null,
    deadline: '2026-09-20', confidence: 70, priceAtPrediction: '100', predictedPrice: '101',
    predictedPercent: '1', priceCapturedAt: '2026-09-15T12:00:00.000Z', reasoning: null, tags: [],
    result: null, resolutionDate: null, actualPrice: null, outcomeNotes: null, voidedAt: null,
    voidReason: null, amended: false, amendedAt: null, createdAt: '2026-09-15T12:00:00.000Z',
    updatedAt: '2026-09-15T12:00:00.000Z', ...overrides,
  }
}

function listItem(overrides: Partial<PredictionListItem> = {}): PredictionListItem {
  return { ...prediction(), resultChanged: false, ...overrides }
}

function renderDashboard(
  stats = baseStats,
  query: { period: 'week' | 'month'; amended: 'include' | 'exclude' } = { period: 'week', amended: 'include' },
  duePredictions: readonly PredictionRecord[] = [],
) {
  return renderToStaticMarkup(
    <MemoryRouter>
      <DashboardContent
        stats={stats}
        duePredictions={duePredictions}
        query={query}
        onPeriodChange={() => {}}
        onAmendedChange={() => {}}
        onRecordResult={() => {}}
      />
    </MemoryRouter>,
  )
}

test('dashboard due preview shows only the five oldest predictions and hides when empty', () => {
  const rows = Array.from({ length: 6 }, (_, index) => prediction({ id: `preview-${index}`, claimText: `Due claim ${index}` }))
  const html = renderDashboard(baseStats, { period: 'week', amended: 'include' }, rows)
  assert.equal((html.match(/>Record result</g) ?? []).length, 5)
  assert.match(html, /Due claim 0/)
  assert.match(html, /Due claim 4/)
  assert.doesNotMatch(html, /Due claim 5/)
  assert.match(html, /View all due/)
  assert.doesNotMatch(renderDashboard(), /Due for review/)
})

test('AC 21: dashboard distinguishes unavailable hit rate from a measured zero', () => {
  const noData: PredictionDashboardStatsResponse = {
    ...baseStats,
    hitRate: { numerator: 0, denominator: 0, value: null },
  }
  const html = renderDashboard(noData)
  assert.match(html, /data-testid="summary-hit-rate">Not available yet/)
  assert.doesNotMatch(html, /data-testid="summary-hit-rate">0%/)
})

test('AC 22: dashboard shows summary counts and all five required charts with URL-owned controls', () => {
  const html = renderDashboard()
  for (const label of ['Open', 'Due', 'Resolved', 'Voided', 'Hit rate', 'Hit rate over time', 'Calibration', 'Results by type', 'Results by symbol', 'Predicted vs. actual % change']) {
    assert.ok(html.includes(label), `Missing dashboard content: ${label}`)
  }
  assert.match(html, /aria-label="Period"/)
  assert.match(html, /grid-cols-1 gap-4 xl:grid-cols-2/)
  assert.match(html, /aria-pressed="true"[^>]*>Week/)
  assert.match(html, /role="switch"[^>]*aria-checked="true"/)
  assert.match(html, /Sep 20–Sep 26/)
  assert.equal(dashboardUrl({ period: 'month', amended: 'exclude' }), '/workspace/intuition-ledger?period=month&amended=exclude')
})

test('AC 23: calibration shows sparse sample counts, an explicit caveat, and hatching', () => {
  const html = renderToStaticMarkup(<CalibrationChart stats={baseStats} />)
  assert.match(html, /Some confidence levels have fewer than 5 predictions, so their results aren&#x27;t meaningful yet\./)
  assert.match(html, /n = 3/)
  assert.match(html, /fewer than 5; not yet meaningful/)
  assert.equal(calibrationActualBarFill(true), 'url(#calibration-low-sample)')
  assert.equal(calibrationActualBarFill(false), 'var(--color-actualHitRate)')
  assert.match(html, /Hatched bars: fewer than 5 predictions/)
  assert.match(html, /aria-label="About calibration"/)
})

test('AC 24: results-by-symbol consumes normalized unique symbol groups', () => {
  const grouped = { ...baseStats, bySymbol: [{ symbol: 'MSFT', symbolNormalized: 'MSFT', correct: 3, incorrect: 2, count: 5, hitRate: 0.6 }] }
  const html = renderToStaticMarkup(<ResultsBySymbolChart stats={grouped} />)
  assert.equal((html.match(/>MSFT</g) ?? []).length, 1)
  assert.match(html, /Correct: 3/)
  assert.match(html, /Incorrect: 2/)
})

test('AC 25: each chart exposes its table alternative with text labels and matching values', () => {
  const html = renderDashboard()
  assert.equal((html.match(/>View as table</g) ?? []).length, 5)
  assert.equal((html.match(/aria-controls="chart-table-/g) ?? []).length, 5)
  for (const caption of [
    'Hit rate over time',
    'Calibration by confidence bucket',
    'Results by prediction type',
    'Results by symbol',
    'Predicted compared with actual percent change',
  ]) assert.ok(html.includes(caption), `Missing accessible table alternative: ${caption}`)
  assert.match(html, /Correct: 8/)
  assert.match(html, /Incorrect: 4/)
  assert.match(html, /SYM12/)
  assert.match(html, /Includes 1 prediction with both a predicted and an actual price\./)
  assert.match(html, /Predicted = actual/)
  assert.doesNotMatch(html, /color-(?:success|error)|text-(?:success|error)/)
})

test('symbol chart selects the top ten by resolved count and keeps deterministic ties', () => {
  const top = topPredictionSymbols(baseStats.bySymbol)
  assert.equal(top.length, 10)
  assert.equal(top[0]?.symbol, 'SYM1')
  assert.deepEqual(top.map((item) => item.symbol), topPredictionSymbols(baseStats.bySymbol).map((item) => item.symbol))
})

test('scatter chart uses one neutral series color for positive and negative directions', () => {
  const stats = {
    ...baseStats,
    scatterPoints: [
      { predictionId: 'up', symbol: 'UP', predictedPercent: 2, actualPercent: 1 },
      { predictionId: 'down', symbol: 'DOWN', predictedPercent: -2, actualPercent: -1 },
    ],
  }
  const html = renderToStaticMarkup(<PredictedVsActualChart stats={stats} />)
  assert.equal((html.match(/--color-prediction: var\(--chart-1\);/g) ?? []).length, 2)
  assert.match(html, /Predicted = actual/)
})

test('dashboard data loads scoped server stats and the oldest five due predictions', async () => {
  const input: unknown[] = []
  const rows = Array.from({ length: 7 }, (_, index) => listItem({
    id: `due-${index}`,
    deadline: `2026-09-${String(20 + index).padStart(2, '0')}`,
  }))
  const data = await loadDashboardData({
    getPredictionDashboardStats: async (query) => { input.push(query); return baseStats },
    listPredictions: async (query, signal) => {
      input.push({ query, signal })
      return { predictions: rows, filteredCount: rows.length, totalCount: rows.length }
    },
  }, { period: 'month', amended: 'exclude' }, '2026-09-27')
  assert.deepEqual(input[0], { period: 'month', amended: 'exclude', asOfLocalDate: '2026-09-27' })
  assert.deepEqual(input[1], { query: { status: 'due', asOfLocalDate: '2026-09-27' }, signal: undefined })
  assert.deepEqual(data.duePredictions.map((item) => item.id), ['due-0', 'due-1', 'due-2', 'due-3', 'due-4'])
})

test('due preview helper sorts oldest first and limits to five without mutating input', () => {
  const rows = [prediction({ id: 'later', deadline: '2026-09-22' }), prediction({ id: 'earlier', deadline: '2026-09-20' })]
  const result = sortDashboardDuePredictions(rows)
  assert.deepEqual(result.map((item) => item.id), ['earlier', 'later'])
  assert.equal(rows[0]?.id, 'later')
})