import assert from 'node:assert/strict'
import { test } from 'node:test'
import { listProviderDefinitions } from '@portfolio-engineering/ai'
import {
  AI_TEST_LIMITS,
  isAiTestEscalated,
  resetAiTestLimitState,
  reserveAiTestSlot,
} from '../lib/aiTestLimits.js'

test.beforeEach(() => {
  resetAiTestLimitState()
})

test('registers OpenAI as a usable provider with API key and model fields', () => {
  const openAi = listProviderDefinitions().find((provider) => provider.id === 'openai')

  assert.ok(openAi)
  assert.equal(openAi.isUsable, true)
  assert.deepEqual(
    openAi.fields.map(({ name, secret, required }) => ({ name, secret, required })),
    [
      { name: 'apiKey', secret: true, required: true },
      { name: 'model', secret: false, required: true },
    ],
  )
})

test('enforces the minimum interval per connection', () => {
  const first = reserveAiTestSlot('org-a', 'connection-a', 1_000)
  const second = reserveAiTestSlot('org-a', 'connection-a', 1_001)

  assert.deepEqual(first, { allowed: true })
  assert.equal(second.allowed, false)
  assert.equal(second.reason, 'minimum_interval')
  assert.equal(second.retryAt?.getTime(), 1_000 + AI_TEST_LIMITS.minimumIntervalMs)
})

test('enforces connection and organization test windows', () => {
  const start = 10_000
  for (let index = 0; index < AI_TEST_LIMITS.connectionTestsPerWindow; index += 1) {
    const result = reserveAiTestSlot(
      'org-a',
      'connection-a',
      start + index * AI_TEST_LIMITS.minimumIntervalMs,
    )
    assert.equal(result.allowed, true)
  }

  const connectionLimit = reserveAiTestSlot(
    'org-a',
    'connection-a',
    start + AI_TEST_LIMITS.connectionTestsPerWindow * AI_TEST_LIMITS.minimumIntervalMs,
  )
  assert.equal(connectionLimit.allowed, false)
  assert.equal(connectionLimit.reason, 'connection_limit')

  resetAiTestLimitState()
  for (let index = 0; index < AI_TEST_LIMITS.organizationTestsPerWindow; index += 1) {
    const result = reserveAiTestSlot(
      'org-a',
      `connection-${index}`,
      start + index * AI_TEST_LIMITS.minimumIntervalMs,
    )
    assert.equal(result.allowed, true)
  }

  const organizationLimit = reserveAiTestSlot(
    'org-a',
    'connection-final',
    start + 31 * AI_TEST_LIMITS.minimumIntervalMs,
  )
  assert.equal(organizationLimit.allowed, false)
  assert.equal(organizationLimit.reason, 'organization_limit')
})

test('escalates deterministic and repeated transient failures', () => {
  assert.equal(isAiTestEscalated({ failureKind: 'auth', consecutiveFailureCount: 1 }), true)
  assert.equal(isAiTestEscalated({ failureKind: 'not_found', consecutiveFailureCount: 1 }), true)
  assert.equal(isAiTestEscalated({ failureKind: 'network', consecutiveFailureCount: 2 }), false)
  assert.equal(isAiTestEscalated({ failureKind: 'network', consecutiveFailureCount: 3 }), true)
  assert.equal(isAiTestEscalated({ failureKind: null, consecutiveFailureCount: 10 }), false)
})
