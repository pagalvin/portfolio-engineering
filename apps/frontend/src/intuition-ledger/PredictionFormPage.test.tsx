import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  buildClaimSummary,
  computePricePreview,
  describeChangedClaimFields,
  formatGraceCountdown,
  formatPredictionDate,
  getFirstInvalidFieldId,
  mapPredictionFieldErrors,
  predictionTypeOptions,
  resolveDeadlineChoice,
  validateClaimForSubmit,
} from './PredictionFormPage'
import { emptyPredictionSubject, findOtherSymbolMatch, describeSecurityOption } from './SubjectPicker'
import type { SecurityRecord } from '@portfolio-engineering/shared-types/securityMaster'

const formSource = fs.readFileSync(new URL('./PredictionFormPage.tsx', import.meta.url), 'utf8')
const routesSource = fs.readFileSync(new URL('./intuitionLedgerRoutes.tsx', import.meta.url), 'utf8')

function security(overrides: Partial<SecurityRecord> = {}): SecurityRecord {
  return {
    id: 'sec-1',
    organizationId: 'org-1',
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    type: 'EQUITY',
    exchange: 'NASDAQ',
    description: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as SecurityRecord
}

// --- AC 1: all five prediction types are offered ---
test('AC 1: create form offers all five prediction types', () => {
  assert.deepEqual(
    predictionTypeOptions.map((option) => option.value),
    ['DIRECTION', 'PERCENT_MOVE', 'TARGET_PRICE', 'EVENT_REACTION', 'FREEFORM'],
  )
  assert.match(formSource, /min=\{50\}\s*\n?\s*max=\{100\}/)
  assert.match(formSource, /useState\(60\)/)
})

// --- AC 2: security dropdown is active-only, existing inactive references still display ---
test('AC 2: SubjectPicker is wired with only active securities and shows an inactive current value', () => {
  assert.match(formSource, /listSecurities\(\{ status: 'active' \}/)
  assert.match(formSource, /currentInactiveSecurityLabel=\{currentInactiveSecurityLabel\}/)
  assert.match(formSource, /\(inactive\)/)
})

// --- AC 3 & AC 4: Other symbol trimmed for submission, Security Master match offered ---
test('AC 3/4: Other symbol is sent trimmed (server normalizes case) and a Security Master match is detected', () => {
  assert.match(formSource, /subject\.otherSymbol\.trim\(\)\) base\.otherSymbol = subject\.otherSymbol\.trim\(\)/)
  const securities = [security({ symbol: 'MSFT' })]
  assert.equal(findOtherSymbolMatch('msft', securities)?.symbol, 'MSFT')
  assert.equal(findOtherSymbolMatch('goog', securities), null)
  assert.equal(describeSecurityOption(security({ name: null })), 'MSFT')
  assert.equal(describeSecurityOption(security()), 'MSFT — Microsoft Corporation')
})

// --- AC 5: Event reaction requires a security or symbol; Freeform allows a topic ---
test('AC 5: Event reaction requires a security/symbol, Freeform allows a topic', () => {
  assert.match(formSource, /allowTopic=\{type === 'FREEFORM'\}/)
  const errors = validateClaimForSubmit({
    type: 'EVENT_REACTION',
    subject: { ...emptyPredictionSubject, mode: 'topic', topic: 'Fed meeting' },
    direction: 'RISES',
    claimText: '',
    eventLabel: 'Fed meeting',
    deadline: '2026-10-02',
    confidence: 60,
    priceAtPrediction: 100,
    percentSource: 'percent',
    percentValue: 1,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  assert.equal(errors.securityId, 'Choose a security, or pick Other symbol.')
})

// --- AC 6: a measurable prediction cannot be saved without a price greater than zero ---
test('AC 6: measurable predictions require a price at prediction greater than zero', () => {
  const withoutPrice = validateClaimForSubmit({
    type: 'PERCENT_MOVE',
    subject: { ...emptyPredictionSubject, securityId: 'sec-1' },
    direction: 'RISES',
    claimText: '',
    eventLabel: '',
    deadline: '2026-10-02',
    confidence: 60,
    priceAtPrediction: null,
    percentSource: 'percent',
    percentValue: 1,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  assert.equal(withoutPrice.priceAtPrediction, 'Enter a price greater than 0.')

  const withoutMoveSize = validateClaimForSubmit({
    type: 'PERCENT_MOVE',
    subject: { ...emptyPredictionSubject, securityId: 'sec-1' },
    direction: 'RISES',
    claimText: '',
    eventLabel: '',
    deadline: '2026-10-02',
    confidence: 60,
    priceAtPrediction: 420,
    percentSource: 'percent',
    percentValue: null,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  assert.equal(withoutMoveSize.predictedPercent, 'Enter a move size greater than 0.')

  const withoutTarget = validateClaimForSubmit({
    type: 'TARGET_PRICE',
    subject: { ...emptyPredictionSubject, securityId: 'sec-1' },
    direction: null,
    claimText: '',
    eventLabel: '',
    deadline: '2026-10-02',
    confidence: 60,
    priceAtPrediction: 140,
    percentSource: 'percent',
    percentValue: null,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  assert.equal(withoutTarget.predictedPrice, 'Enter a target price.')
})

// --- AC 7: MSFT 420 Rises 1% -> 424.20; NVDA 140 -> 150 target -> "rises 7.14%" ---
test('AC 7: predicted price and move-size derivations match the spec examples', () => {
  const percentMove = computePricePreview({
    type: 'PERCENT_MOVE',
    direction: 'RISES',
    priceAtPrediction: 420,
    percentSource: 'percent',
    percentValue: 1,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  assert.ok(percentMove)
  assert.equal(percentMove.predictedPrice.toFixed(2), '424.20')
  assert.match(percentMove.text, /424\.20/)
  assert.doesNotMatch(percentMove.text, /[$€£]/)

  const targetPrice = computePricePreview({
    type: 'TARGET_PRICE',
    direction: null,
    priceAtPrediction: 140,
    percentSource: 'percent',
    percentValue: null,
    predictedPriceValue: null,
    targetPriceValue: 150,
  })
  assert.ok(targetPrice)
  assert.equal(targetPrice.direction, 'RISES')
  assert.equal(targetPrice.predictedPercent.toFixed(2), '7.14')
  assert.match(targetPrice.text, /rises 7\.14%/)
  assert.doesNotMatch(targetPrice.text, /[$€£]/)
})

// --- AC 8: move size has no sign, direction is chosen or derived, contradictions are rejected ---
test('AC 8: a contradictory direction cannot be entered when deriving from a predicted price', () => {
  const errors = validateClaimForSubmit({
    type: 'PERCENT_MOVE',
    subject: { ...emptyPredictionSubject, securityId: 'sec-1' },
    direction: 'FALLS',
    claimText: '',
    eventLabel: '',
    deadline: '2026-10-02',
    confidence: 60,
    priceAtPrediction: 100,
    percentSource: 'price',
    percentValue: null,
    predictedPriceValue: 110,
    targetPriceValue: null,
  })
  assert.equal(errors.predictedPrice, 'A contradictory direction cannot be entered.')
  assert.match(formSource, /inputMode="decimal"/)
  assert.doesNotMatch(formSource, /type="number"[^>]*prediction-move/)
})

// --- AC 9: price input reuses the shared locale-decimal parser (no reimplementation) ---
test('AC 9: price fields reuse the shared locale-decimal parser', () => {
  assert.match(formSource, /import \{ getSafeIntuitionLedgerReturnTo, parseLocaleDecimal \} from '..\/intuitionLedgerApi'/)
  assert.match(formSource, /parseLocaleDecimal\(priceAtPredictionInput, navigatorLocale\(\)\)/)
})

// --- AC 10: resolved deadline is shown before saving; non-trading-day hint on custom dates ---
test('AC 10: resolveDeadlineChoice surfaces a resolved date and a non-trading-day hint for custom dates', () => {
  const week = resolveDeadlineChoice('week', '', '2026-09-28')
  assert.ok(week.deadline)
  assert.equal(week.hint, null)

  const saturday = resolveDeadlineChoice('custom', '2026-10-03', '2026-09-28')
  assert.equal(saturday.deadline, '2026-10-03')
  assert.match(saturday.hint ?? '', /isn't a trading day/)

  const weekday = resolveDeadlineChoice('custom', '2026-10-02', '2026-09-28')
  assert.equal(weekday.hint, null)
  assert.equal(formatPredictionDate('2026-10-02'), 'Fri, Oct 2')
})

// --- AC 11: grace countdown, Amended dialog, and cancel-saves-nothing ---
test('AC 11: grace countdown formats minutes:seconds and the edit view wires a timer + Amended dialog', () => {
  assert.equal(formatGraceCountdown(5 * 60 * 1000), '5:00')
  assert.equal(formatGraceCountdown(4 * 60 * 1000 + 12_000), '4:12')
  assert.equal(formatGraceCountdown(500), '0:01')
  assert.equal(formatGraceCountdown(0), '0:00')

  assert.match(formSource, /role="timer" aria-live="off"/)
  assert.match(formSource, /amend_confirmation_required/)
  assert.match(formSource, /Save and mark Amended/)
  assert.match(formSource, /<AlertDialogCancel onClick=\{\(\) => setAmendDialog\(null\)\}>Keep editing<\/AlertDialogCancel>/)

  const changed = describeChangedClaimFields(['direction', 'priceAtPrediction', 'predictedPrice'])
  assert.equal(changed, 'Direction, Price at prediction, Predicted price')
})

// --- AC 12: reasoning/tags/outcome-only edits are never marked Amended client-side (server-enforced) ---
test('AC 12: the client never reimplements Amended detection; the server decides via amend_confirmation_required', () => {
  assert.doesNotMatch(formSource, /changedClaimFields/)
  assert.match(formSource, /await apiClient\.updatePrediction\(id, payload\)/)
  assert.doesNotMatch(formSource, /confirmAmend: true(?![\s\S]*payload)/)
})

// --- AC 12a: reasoning is always visible, optional, labelled, and sent exactly as typed ---
test('AC 12a: reasoning textarea is always visible, optional, and saved exactly as typed', () => {
  assert.match(
    formSource,
    /Why do you think this will happen\? <span className="font-normal text-text-muted">\(optional\)<\/span>/,
  )
  assert.match(formSource, /Markdown formatting is supported\./)
  assert.match(formSource, /<Textarea\s*\n\s*id="prediction-reasoning"/)
  assert.doesNotMatch(formSource, /<details[^>]*reasoning/i)
  // Not gated behind any disclosure/expander, and no toolbar/WYSIWYG import exists.
  assert.doesNotMatch(formSource, /Toolbar|WYSIWYG|MarkdownEditor/)
  assert.match(formSource, /reasoning: reasoning\.trim\(\) \? reasoning : null/)
})

// --- Field-level server error mapping ---
test('server field errors and known error codes map to form fields', () => {
  const fieldErrors = mapPredictionFieldErrors({
    status: 400,
    code: 'validation_error',
    message: 'Invalid',
    fieldErrors: { predictedPrice: ['The predicted price must differ from the price at prediction.'] },
  })
  assert.deepEqual(fieldErrors, { predictedPrice: 'The predicted price must differ from the price at prediction.' })

  const securityError = mapPredictionFieldErrors({
    status: 400,
    code: 'invalid_security_reference',
    message: 'Choose an active security in this organization.',
  })
  assert.deepEqual(securityError, { securityId: 'Choose an active security in this organization.' })

  assert.equal(getFirstInvalidFieldId({ predictedPrice: 'x' }), 'prediction-predictedPrice')
  assert.equal(getFirstInvalidFieldId({}), null)
})

// --- Claim summary generation (used for non-Freeform claimText) ---
test('buildClaimSummary produces a readable sentence per type', () => {
  const preview = computePricePreview({
    type: 'PERCENT_MOVE',
    direction: 'RISES',
    priceAtPrediction: 420,
    percentSource: 'percent',
    percentValue: 1,
    predictedPriceValue: null,
    targetPriceValue: null,
  })
  const summary = buildClaimSummary({
    type: 'PERCENT_MOVE',
    subjectLabel: 'MSFT',
    direction: 'RISES',
    deadline: '2026-10-02',
    eventLabel: '',
    preview,
    claimText: '',
  })
  assert.match(summary, /^MSFT will rises 1\.00% by Fri, Oct 2$/)

  const freeform = buildClaimSummary({
    type: 'FREEFORM',
    subjectLabel: 'This topic',
    direction: null,
    deadline: null,
    eventLabel: '',
    preview: null,
    claimText: '  My exact freeform claim  ',
  })
  assert.equal(freeform, 'My exact freeform claim')
})

// --- Routing (replaces the T-04.3 placeholder shell for new/edit) ---
test('new and edit routes render the real PredictionFormPage, not the placeholder shell', () => {
  assert.match(routesSource, /path="predictions\/new" element=\{<PredictionFormPage mode="create" \/>\}/)
  assert.match(routesSource, /path="predictions\/:predictionId\/edit" element=\{<PredictionFormPage mode="edit" \/>\}/)
  assert.doesNotMatch(routesSource, /view="new"|view="edit"/)
})
