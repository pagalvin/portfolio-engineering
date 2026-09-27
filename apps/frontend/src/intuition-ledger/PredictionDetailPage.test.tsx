import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type {
  PredictionAmendmentRecord,
  PredictionDetailResponse,
  PredictionListItem,
  PredictionResultHistoryRecord,
  PredictionReasoningHistoryRecord,
} from '@portfolio-engineering/shared-types/intuitionLedger'
import {
  buildVoidPredictionRequest,
  deletePredictionErrorMessage,
  detailLoadErrorMessage,
  loadPredictionDetail,
  predictionStatusLabel,
  PredictionDetailContent,
  restorePredictionDetail,
} from './PredictionDetailPage'

;(globalThis as { React?: typeof React }).React = React

function prediction(overrides: Partial<PredictionListItem> = {}): PredictionListItem {
  return {
    id: 'prediction-1', organizationId: 'org-1', userId: 'user-1',
    securityId: 'security-1', otherSymbol: null, topic: null,
    symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT', type: 'PERCENT_MOVE',
    direction: 'RISES', claimText: 'MSFT rises 1% by Sep 30', eventLabel: null,
    deadline: '2026-09-30', confidence: 65, priceAtPrediction: '420.00',
    predictedPrice: '424.20', predictedPercent: '1',
    priceCapturedAt: '2026-09-25T12:00:00.000Z', reasoning: 'The **current thesis**.', tags: ['earnings'],
    result: 'CORRECT', resolutionDate: '2026-10-01', actualPrice: '425.10',
    outcomeNotes: 'Outcome **confirmed**.', voidedAt: null, voidReason: null,
    amended: false, amendedAt: null, resultChanged: true,
    createdAt: '2026-09-25T12:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z',
    ...overrides,
  }
}

const amendment: PredictionAmendmentRecord = {
  id: 'amend-1', predictionId: 'prediction-1', previousSecurityId: 'security-1',
  previousOtherSymbol: null, previousTopic: null, previousSymbolSnapshot: 'MSFT',
  previousSymbolNormalizedSnapshot: 'MSFT', previousType: 'PERCENT_MOVE',
  previousDirection: 'RISES', previousClaimText: 'MSFT rises 1% by Sep 25',
  previousEventLabel: null, previousDeadline: '2026-09-25', previousConfidence: 60,
  previousPriceAtPrediction: '420.00', previousPriceCapturedAt: '2026-09-25T12:00:00.000Z',
  previousPredictedPrice: '424.20', previousPredictedPercent: '1',
  changedFields: ['deadline', 'confidence'], changedAt: '2026-09-26T12:00:00.000Z',
}

const resultChange: PredictionResultHistoryRecord = {
  id: 'result-1', predictionId: 'prediction-1', previousResult: 'INCORRECT',
  previousResolutionDate: '2026-10-01', previousActualPrice: '423.00',
  previousOutcomeNotes: 'Earlier note.', newResult: 'CORRECT', newResolutionDate: '2026-10-01',
  newActualPrice: '425.10', newOutcomeNotes: 'Outcome **confirmed**.',
  changedAt: '2026-10-02T12:00:00.000Z',
}

const reasoningEdit: PredictionReasoningHistoryRecord = {
  id: 'reasoning-1', predictionId: 'prediction-1',
  previousReasoning: 'The **original thesis**.', newReasoning: 'The **current thesis**.',
  changedAt: '2026-09-27T12:00:00.000Z',
}

function detail(overrides: Partial<PredictionDetailResponse> = {}): PredictionDetailResponse {
  return {
    prediction: prediction(), amendmentHistory: [amendment], resultHistory: [resultChange],
    reasoningHistory: [reasoningEdit], gracePeriodEndsAt: '2026-09-25T12:05:00.000Z',
    ...overrides,
  }
}

function renderDetail(value: PredictionDetailResponse) {
  return renderToStaticMarkup(<MemoryRouter><PredictionDetailContent
    detail={value} asOfLocalDate="2026-10-03" returnTo="/workspace/intuition-ledger/predictions"
    onRecordResult={() => {}} onVoid={() => {}} onRestore={() => {}} onDelete={() => {}} busy={false}
  /></MemoryRouter>)
}

test('AC 12b: detail renders reasoning Markdown and its history without an Amended badge', () => {
  const html = renderDetail(detail({ prediction: prediction({ amended: false }) }))
  assert.match(html, /Why I predicted this/)
  assert.match(html, /<strong>current thesis<\/strong>/)
  assert.match(html, /Reasoning history \(1\).*Reasoning edited on/)
  assert.match(html, /Original reasoning/)
  assert.match(html, /<strong>original thesis<\/strong>/)
  assert.doesNotMatch(html, />Amended<\/span>/)
})

test('AC 17: result change date, result history, Markdown notes, and price details render', () => {
  const html = renderDetail(detail())
  assert.match(html, /Result history \(1\).*Result changed on/)
  assert.match(html, /Incorrect[^<]*→[^<]*✓ Correct/)
  assert.match(html, /<strong>confirmed<\/strong>/)
  assert.match(html, /Suggested result/)
  assert.match(html, /Actual move/)
  assert.doesNotMatch(html, /\$425\.10/)
  assert.match(html, /Amendment history/)
  assert.match(html, /Original claim/)
})

test('AC 19: voided predictions expose restore and permanent delete, not void or record actions', () => {
  const html = renderDetail(detail({ prediction: prediction({ voidedAt: '2026-10-03T12:00:00.000Z', voidReason: 'No longer relevant' }) }))
  assert.match(html, /⊘ Void/)
  assert.match(html, />Restore</)
  assert.match(html, /Delete permanently/)
  assert.match(html, /Void reason: No longer relevant/)
  assert.doesNotMatch(html, />Void</)
  assert.doesNotMatch(html, /Record result/)
  assert.equal(deletePredictionErrorMessage({ status: 409, code: 'not_voided' }), 'Void this prediction before deleting it.')
  assert.equal(buildVoidPredictionRequest('  no longer relevant  ').voidReason, 'no longer relevant')
  assert.equal(buildVoidPredictionRequest('  ').voidReason, null)
})

test('restore refetches the server state, preserving its previous resolution', async () => {
  let current = detail({ prediction: prediction({ voidedAt: '2026-10-03T12:00:00.000Z' }) })
  const received: string[] = []
  const signal = new AbortController().signal
  const restored = await restorePredictionDetail({
    restorePrediction: async (id) => { received.push(`restore:${id}`); current = detail({ prediction: prediction({ result: 'INCORRECT', voidedAt: null }) }); return { prediction: current.prediction } },
    getPrediction: async (id, passedSignal) => { received.push(`get:${id}:${passedSignal === signal}`); return current },
  }, 'prediction-1', signal)
  assert.deepEqual(received, ['restore:prediction-1', 'get:prediction-1:true'])
  assert.equal(restored.prediction.voidedAt, null)
  assert.equal(restored.prediction.result, 'INCORRECT')
  assert.equal(predictionStatusLabel(restored.prediction, '2026-10-03'), 'Resolved')
})

test('detail fetch preserves route ID and abort signal; foreign or missing IDs show generic not-found', async () => {
  const signal = new AbortController().signal
  let requestedId = ''
  assert.deepEqual(await loadPredictionDetail({ getPrediction: async (id, passedSignal) => { requestedId = `${id}:${passedSignal === signal}`; return detail() } }, 'opaque-id', signal), detail())
  assert.equal(requestedId, 'opaque-id:true')
  assert.equal(detailLoadErrorMessage({ status: 404, message: 'Internal scoped identifier' }), 'Prediction not found.')
})