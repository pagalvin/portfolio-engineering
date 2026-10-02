import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import type { PredictionRecord } from '@portfolio-engineering/shared-types/intuitionLedger'
import { getResultRecordingBlockReason } from '@portfolio-engineering/domain'
import {
  buildResultPayload, initialResolutionDate, predictionCreatedDate, resolveResultChoice,
  resultSuggestion, restoreResultDialogFocus, validateResultDraft,
} from './RecordResultDialog'
import { DueEmptyState, DuePage, focusDueTarget, loadDuePredictions, nextDueFocusId } from './DuePage'
import { IntuitionLedgerDueCountContext } from './intuitionLedgerDueCount'

;(globalThis as { React?: typeof React }).React = React

function prediction(overrides: Partial<PredictionRecord> = {}): PredictionRecord {
  return {
    id: 'first', organizationId: 'org', userId: 'user', securityId: 'sec',
    otherSymbol: null, topic: null, symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT',
    type: 'PERCENT_MOVE', direction: 'RISES', claimText: 'MSFT rises 1% by deadline',
    eventLabel: null, deadline: '2026-09-30', confidence: 65,
    priceAtPrediction: '420', predictedPrice: '424.20', predictedPercent: '1',
    priceCapturedAt: '2026-09-25T12:00:00.000Z', reasoning: null, tags: [],
    result: null, resolutionDate: null, actualPrice: null, outcomeNotes: null,
    voidedAt: null, voidReason: null, amended: false, amendedAt: null,
    createdAt: '2026-09-25T12:00:00.000Z', updatedAt: '2026-09-25T12:00:00.000Z',
    ...overrides,
  }
}

test('closing a result dialog restores focus only to a connected trigger', () => {
  let focused = 0
  const trigger = { isConnected: true, focus: () => { focused += 1 } }
  restoreResultDialogFocus(trigger)
  trigger.isConnected = false
  restoreResultDialogFocus(trigger)
  restoreResultDialogFocus(null)
  assert.equal(focused, 1)
})

const today = '2026-09-27'

test('AC 13: only early Correct for Percent move or Target price; deadline day is not past', () => {
  for (const type of ['PERCENT_MOVE', 'TARGET_PRICE', 'DIRECTION', 'EVENT_REACTION', 'FREEFORM'] as const) {
    for (const result of ['CORRECT', 'INCORRECT'] as const) {
      assert.equal(getResultRecordingBlockReason({ type, result, deadline: '2026-09-30', asOfLocalDate: today }),
        (type === 'PERCENT_MOVE' || type === 'TARGET_PRICE') && result === 'CORRECT' ? null : 'deadline_not_passed')
    }
    assert.equal(getResultRecordingBlockReason({ type, result: 'INCORRECT', deadline: '2026-09-27', asOfLocalDate: today }), 'deadline_not_passed')
    assert.equal(getResultRecordingBlockReason({ type, result: 'INCORRECT', deadline: '2026-09-26', asOfLocalDate: today }), null)
  }
  assert.equal(validateResultDraft({ prediction: prediction(), result: 'INCORRECT', resolutionDate: today, actualPrice: '', today, locale: 'en-US' }).errors.result, "The deadline hasn't passed yet.")
  assert.equal(validateResultDraft({ prediction: prediction({ type: 'DIRECTION' }), result: 'CORRECT', resolutionDate: today, actualPrice: '', today, locale: 'en-US' }).errors.result, "The deadline hasn't passed yet.")
  assert.equal(validateResultDraft({ prediction: prediction({ type: 'TARGET_PRICE' }), result: 'CORRECT', resolutionDate: today, actualPrice: '', today, locale: 'en-US' }).errors.result, undefined)
})

test('AC 14: actual price is optional, suggestions preselect until user chooses, and Markdown is sent unchanged', () => {
  const record = prediction({ deadline: '2026-09-26' })
  assert.deepEqual(validateResultDraft({ prediction: record, result: 'CORRECT', resolutionDate: today, actualPrice: '', today, locale: 'en-US' }), { errors: {}, price: null })
  assert.equal(resultSuggestion(record, '425.10'), 'CORRECT')
  assert.equal(resolveResultChoice(null, resultSuggestion(record, '425.10')), 'CORRECT')
  assert.equal(resolveResultChoice('INCORRECT', resultSuggestion(record, '425.10')), 'INCORRECT')
  assert.equal(resolveResultChoice('INCORRECT', resultSuggestion(record, '423.00')), 'INCORRECT')
  const notes = '  **My judgment**\nsecond line  '
  assert.deepEqual(buildResultPayload({ result: 'INCORRECT', resolutionDate: today, actualPrice: null, notes, asOfLocalDate: today }), {
    result: 'INCORRECT', resolutionDate: today, actualPrice: null, outcomeNotes: notes, asOfLocalDate: today,
  })
  assert.equal(validateResultDraft({ prediction: record, result: 'CORRECT', resolutionDate: today, actualPrice: '1,234.5678', today, locale: 'en-US' }).price, '1234.5678')
  assert.equal(validateResultDraft({ prediction: record, result: 'CORRECT', resolutionDate: today, actualPrice: '-3', today, locale: 'en-US' }).errors.actualPrice, 'Enter a price greater than 0.')
})

test('AC 15: a right-direction move short of the predicted price suggests Incorrect', () => {
  assert.equal(resultSuggestion(prediction(), '423'), 'INCORRECT')
  assert.equal(resultSuggestion(prediction(), '424.20'), 'CORRECT')
})

test('AC 16: rising target high or falling target low touching the target suggests Correct', () => {
  assert.equal(resultSuggestion(prediction({ type: 'TARGET_PRICE', predictedPrice: '150', priceAtPrediction: '140' }), '150'), 'CORRECT')
  assert.equal(resultSuggestion(prediction({ type: 'TARGET_PRICE', direction: 'FALLS', predictedPrice: '130', priceAtPrediction: '140' }), '130'), 'CORRECT')
  assert.equal(resultSuggestion(prediction({ type: 'TARGET_PRICE', direction: 'FALLS', predictedPrice: '130', priceAtPrediction: '140' }), '131'), 'INCORRECT')
  assert.equal(resultSuggestion(prediction({ type: 'FREEFORM' }), '150'), null)
})

test('resolution date defaults to earlier deadline or today and is bounded by local creation day and today', () => {
  const record = prediction({ deadline: '2026-09-26' })
  assert.match(predictionCreatedDate(record), /^2026-09-2[45]$/)
  assert.equal(initialResolutionDate(record, today), '2026-09-26')
  assert.equal(initialResolutionDate(prediction(), today), today)
  assert.equal(initialResolutionDate(prediction({ createdAt: '2026-09-29T12:00:00.000Z', deadline: '2026-09-27' }), '2026-09-29'), '2026-09-29')
  for (const resolutionDate of ['2026-09-23', '2026-09-28', 'bad']) {
    assert.equal(validateResultDraft({ prediction: record, result: 'CORRECT', resolutionDate, actualPrice: '', today, locale: 'en-US' }).errors.resolutionDate, 'Choose a date between creation and today.')
  }
})

test('due API requests due status and local date, sorts oldest first without mutating the response', async () => {
  const later = prediction({ id: 'later', deadline: '2026-09-26' })
  const earlier = prediction({ id: 'earlier', deadline: '2026-09-25' })
  const source = [later, earlier]
  const signal = new AbortController().signal
  const sorted = await loadDuePredictions({ listPredictions: async (query, passedSignal) => {
    assert.deepEqual(query, { status: 'due', asOfLocalDate: today })
    assert.equal(passedSignal, signal)
    return { predictions: source, filteredCount: 2, totalCount: 2 }
  } }, today, signal)
  assert.deepEqual(sorted.map((item) => item.id), ['earlier', 'later'])
  assert.deepEqual(source.map((item) => item.id), ['later', 'earlier'])
  assert.equal(nextDueFocusId(sorted, 'earlier'), 'later')
  assert.equal(nextDueFocusId(sorted, 'later'), 'earlier')
  assert.equal(nextDueFocusId([earlier], 'earlier'), null)
  await assert.rejects(loadDuePredictions({ listPredictions: async () => { throw new Error('Offline') } }, today), /Offline/)
})

test('due route renders a loading status before the response and retains a usable heading', () => {
  const html = renderToStaticMarkup(<MemoryRouter><IntuitionLedgerDueCountContext.Provider value={{ count: null, refresh() {} }}><DuePage /></IntuitionLedgerDueCountContext.Provider></MemoryRouter>)
  assert.match(html, /Due for review<\/h2>/)
  assert.match(html, /role="status">Loading due predictions/)
})

test('empty due queue gives an honest state and a route to create a prediction', () => {
  const html = renderToStaticMarkup(<MemoryRouter><DueEmptyState /></MemoryRouter>)
  assert.match(html, /Nothing is due. Predictions appear here after their deadline passes./)
  assert.match(html, /href="\/workspace\/intuition-ledger\/predictions\/new"/)
})

test('resolving moves focus to the next row, previous last row, or empty heading', () => {
  const focused: string[] = []
  const buttons = ['earlier', 'later'].map((dueResultId) => ({ dataset: { dueResultId }, focus: () => focused.push(dueResultId) }))
  const heading = { focus: () => focused.push('heading') }
  focusDueTarget(nextDueFocusId([prediction({ id: 'earlier' }), prediction({ id: 'later' })], 'earlier'), buttons, heading)
  focusDueTarget(nextDueFocusId([prediction({ id: 'earlier' }), prediction({ id: 'later' })], 'later'), buttons, heading)
  focusDueTarget(nextDueFocusId([prediction()], 'first'), [], heading)
  assert.deepEqual(focused, ['later', 'earlier', 'heading'])
})
