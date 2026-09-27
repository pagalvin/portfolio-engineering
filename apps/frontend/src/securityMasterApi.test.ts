import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getExchangeFilterChoices,
  getSecurityDetailPath,
  isSafeSecurityReturnTo,
  parseSecurityListQuery,
} from './securityMasterApi'

test('accepts the supported list query contract', () => {
  const parsed = parseSecurityListQuery('?q=apple&status=active&type=STOCK&exchange=NYSE')
  assert.equal(parsed.error, null)
  assert.deepEqual(parsed.query, {
    q: 'apple',
    status: 'active',
    type: 'STOCK',
    exchange: 'NYSE',
  })
})

test('status filter defaults to active and still allows all explicitly', () => {
  assert.equal(parseSecurityListQuery('').query.status, 'active')
  assert.equal(parseSecurityListQuery('?q=chip').query.status, 'active')
  assert.equal(parseSecurityListQuery('?status=all').query.status, 'all')
})

test('rejects malformed, repeated, and unknown list filters', () => {
  assert.match(parseSecurityListQuery('?status=unknown').error ?? '', /Status/)
  assert.match(parseSecurityListQuery('?q=one&q=two').error ?? '', /once/)
  assert.match(parseSecurityListQuery('?unexpected=value').error ?? '', /Unknown/)
  assert.match(parseSecurityListQuery('?exchange=').error ?? '', /empty/)
})

test('only accepts same-origin list returnTo URLs with supported parameters', () => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  })

  assert.equal(
    isSafeSecurityReturnTo('http://localhost/workspace/security-master?q=apple&status=active'),
    true,
  )
  assert.equal(
    isSafeSecurityReturnTo('https://external.example/workspace/security-master'),
    false,
  )
  assert.equal(
    isSafeSecurityReturnTo('http://localhost/workspace/security-master?unknown=value'),
    false,
  )
  assert.equal(
    isSafeSecurityReturnTo('http://localhost/workspace/security-master?q=one&q=two'),
    false,
  )
  assert.equal(
    isSafeSecurityReturnTo('http://localhost/workspace/settings'),
    false,
  )
})

test('security detail return path preserves the originating list context', () => {
  const listUrl = '/workspace/security-master?q=chip&status=inactive'

  assert.equal(
    getSecurityDetailPath('security/123', listUrl),
    '/workspace/security-master/security%2F123?returnTo=%2Fworkspace%2Fsecurity-master%3Fq%3Dchip%26status%3Dinactive',
  )
})

test('exchange filter choices include the fixed venues and retain an unlisted current filter', () => {
  assert.deepEqual(
    getExchangeFilterChoices('').map(({ value }) => value),
    ['', 'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX', 'OTHER'],
  )

  const legacyChoices = getExchangeFilterChoices('CBOE')
  assert.deepEqual(
    legacyChoices.map(({ value }) => value),
    ['', 'CBOE', 'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX', 'OTHER'],
  )
  assert.equal(legacyChoices[1]?.label, 'Other (current filter: CBOE)')
})
