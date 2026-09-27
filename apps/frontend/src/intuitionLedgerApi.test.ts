import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSafeIntuitionLedgerReturnTo,
  isSafeIntuitionLedgerReturnTo,
  LOCALE_DECIMAL_ERROR,
  parseLocaleDecimal,
  parsePredictionDashboardQuery,
  parsePredictionListQuery,
  serializePredictionDashboardQuery,
  serializePredictionListQuery,
  suggestPredictionResult,
} from './intuitionLedgerApi'
import { AuthenticatedApiClient } from './apiClient'

test('list query parsing applies the default active filter and serializes that default by omission', () => {
  assert.deepEqual(parsePredictionListQuery('').query, { status: 'active' })
  assert.equal(serializePredictionListQuery({ status: 'active' }).toString(), '')
  assert.equal(serializePredictionListQuery({}).toString(), '')
  assert.equal(
    serializePredictionListQuery({
      q: 'chip makers',
      status: 'due',
      type: 'percent_move',
      symbol: 'MSFT',
      result: 'correct',
      tag: 'earnings',
      amended: 'exclude',
    }).toString(),
    'q=chip+makers&status=due&type=percent_move&symbol=MSFT&result=correct&tag=earnings&amended=exclude',
  )
})

test('list query parsing rejects repeated, unknown, empty, and malformed filters', () => {
  assert.match(parsePredictionListQuery('?q=one&q=two').error ?? '', /only appear once/)
  assert.match(parsePredictionListQuery('?unexpected=value').error ?? '', /Unknown filter/)
  assert.match(parsePredictionListQuery('?tag=').error ?? '', /cannot be empty/)
  assert.match(parsePredictionListQuery('?status=active-ish').error ?? '', /Status must/)
  assert.match(parsePredictionListQuery('?type=other').error ?? '', /Type must/)
  assert.match(parsePredictionListQuery('?result=maybe').error ?? '', /Result must/)
  assert.match(parsePredictionListQuery('?amended=all').error ?? '', /Amended must/)
  assert.match(parsePredictionListQuery('?q=%E0%A4%A').error ?? '', /malformed percent-encoding/)
})

test('dashboard query parsing and serialization preserve defaults by omission', () => {
  assert.deepEqual(parsePredictionDashboardQuery('').query, {
    period: 'week',
    amended: 'include',
  })
  assert.equal(
    serializePredictionDashboardQuery({ period: 'week', amended: 'include' }).toString(),
    '',
  )
  assert.equal(
    serializePredictionDashboardQuery({ period: 'month', amended: 'exclude' }).toString(),
    'period=month&amended=exclude',
  )
  assert.match(parsePredictionDashboardQuery('?period=day').error ?? '', /Period must/)
  assert.match(parsePredictionDashboardQuery('?period=week&period=month').error ?? '', /once/)
  assert.match(parsePredictionDashboardQuery('?other=x').error ?? '', /Unknown filter/)
  assert.match(parsePredictionDashboardQuery('?amended=').error ?? '', /cannot be empty/)
})

test('returnTo accepts only same-origin dashboard, due, and valid list destinations', () => {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  })

  try {
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger?period=month'), true)
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger/due'), true)
    assert.equal(
      isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger/predictions?status=resolved'),
      true,
    )
    assert.equal(isSafeIntuitionLedgerReturnTo('https://external.example/workspace/intuition-ledger'), false)
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/settings'), false)
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger?unexpected=x'), false)
    assert.equal(
      isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger/predictions?q=one&q=two'),
      false,
    )
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger/due?period=week'), false)
    assert.equal(
      isSafeIntuitionLedgerReturnTo('http://user@localhost/workspace/intuition-ledger'),
      false,
    )
    assert.equal(isSafeIntuitionLedgerReturnTo('/workspace/intuition-ledger#section'), false)
    assert.equal(
      getSafeIntuitionLedgerReturnTo('https://external.example/'),
      '/workspace/intuition-ledger',
    )
  } finally {
    if (previousWindow) {
      Object.defineProperty(globalThis, 'window', previousWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
})
test('locale decimal parsing normalizes valid grouping and decimals and rejects ambiguity', () => {
  assert.deepEqual(parseLocaleDecimal('1,234.56', 'en-US'), { value: '1234.56', error: null })
  assert.deepEqual(parseLocaleDecimal('1\u202f234,56', 'fr-FR'), { value: '1234.56', error: null })
  assert.deepEqual(parseLocaleDecimal('1234,56', 'de-DE'), { value: '1234.56', error: null })
  assert.deepEqual(parseLocaleDecimal('١٬٢٣٤٫٥٦', 'ar-EG'), { value: '1234.56', error: null })
  assert.deepEqual(parseLocaleDecimal('1.234,5', 'en-US'), {
    value: null,
    error: LOCALE_DECIMAL_ERROR,
  })
  assert.equal(parseLocaleDecimal('12,34.5', 'en-US').value, null)
  assert.equal(parseLocaleDecimal('1.2.3', 'en-US').value, null)
  assert.equal(parseLocaleDecimal('', 'en-US').value, null)
})

test('prediction result suggestions are delegated to the shared domain rules', () => {
  assert.equal(
    suggestPredictionResult({
      type: 'TARGET_PRICE',
      direction: 'RISES',
      priceAtPrediction: 100,
      predictedPrice: 110,
      actualPrice: 110,
    }),
    'CORRECT',
  )
})

test('authenticated Intuition Ledger methods use typed routes, query, and bodies', async () => {
  const calls: Array<{ url: URL; method: string; body?: string }> = []
  const previousFetch = globalThis.fetch
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  })
  globalThis.fetch = async (input, init) => {
    calls.push({
      url: new URL(String(input)),
      method: init?.method ?? 'GET',
      body: typeof init?.body === 'string' ? init.body : undefined,
    })
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const client = new AuthenticatedApiClient({
      getAccessToken: () => 'test-token',
      onSessionExpired: () => assert.fail('unexpected session expiry'),
      baseUrl: 'http://localhost/api',
    })
    await client.listPredictions({ status: 'active', q: 'MSFT', asOfLocalDate: '2026-09-27' })
    await client.getPrediction('prediction/1')
    await client.createPrediction({
      type: 'FREEFORM',
      claimText: 'A claim',
      deadline: '2026-10-01',
      confidence: 70,
    })
    await client.updatePrediction('prediction/1', { confirmAmend: true, reasoning: 'unchanged field name' })
    await client.recordPredictionResult('prediction/1', {
      result: 'CORRECT',
      resolutionDate: '2026-10-01',
      asOfLocalDate: '2026-10-02',
    })
    await client.clearPredictionResult('prediction/1')
    await client.voidPrediction('prediction/1', { voidReason: 'Not scorable' })
    await client.restorePrediction('prediction/1')
    await client.deletePrediction('prediction/1')
    await client.getPredictionDueCount({ asOfLocalDate: '2026-10-02' })
    await client.getPredictionDashboardStats({ period: 'week', asOfLocalDate: '2026-10-02' })
    await client.listPredictionOtherSymbolSuggestions({ q: 'M', limit: 5 })
    await client.listPredictionTagSuggestions({ q: 'earn' })

    assert.deepEqual(calls.map(({ method, url }) => [method, url.pathname]), [
      ['GET', '/api/intuition-ledger/predictions'],
      ['GET', '/api/intuition-ledger/predictions/prediction%2F1'],
      ['POST', '/api/intuition-ledger/predictions'],
      ['PATCH', '/api/intuition-ledger/predictions/prediction%2F1'],
      ['POST', '/api/intuition-ledger/predictions/prediction%2F1/result'],
      ['DELETE', '/api/intuition-ledger/predictions/prediction%2F1/result'],
      ['POST', '/api/intuition-ledger/predictions/prediction%2F1/void'],
      ['POST', '/api/intuition-ledger/predictions/prediction%2F1/restore'],
      ['DELETE', '/api/intuition-ledger/predictions/prediction%2F1'],
      ['GET', '/api/intuition-ledger/due-count'],
      ['GET', '/api/intuition-ledger/stats'],
      ['GET', '/api/intuition-ledger/suggestions/other-symbols'],
      ['GET', '/api/intuition-ledger/suggestions/tags'],
    ])
    assert.equal(calls[0]?.url.searchParams.get('asOfLocalDate'), '2026-09-27')
    assert.equal(calls[0]?.url.searchParams.get('q'), 'MSFT')
    assert.equal(JSON.parse(calls[3]?.body ?? '{}').confirmAmend, true)
    assert.equal(JSON.parse(calls[3]?.body ?? '{}').confirmAmendment, undefined)
    assert.equal(JSON.parse(calls[6]?.body ?? '{}').voidReason, 'Not scorable')
  } finally {
    globalThis.fetch = previousFetch
    if (previousWindow) {
      Object.defineProperty(globalThis, 'window', previousWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
})