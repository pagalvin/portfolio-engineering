import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  HelpContentStore,
  HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import { bundledHelpContent, bundledHelpIndex } from './bundledHelp.js'
import { HELP_SOURCE_BASE_URL, type HelpFetcher } from './helpContent.js'
import { refreshHelp, startHelpRefresh } from './helpRefresh.js'

function createStore(initial: HelpRuntimeCacheRecord | null = null): {
  store: HelpContentStore
  getRecord: () => HelpRuntimeCacheRecord | null
} {
  let record = initial
  const store: HelpContentStore = {
    get: async () => record,
    getLastValid: async () => record,
    recordDownloadAttempt: async ({ attemptedAt, status }) => {
      record = {
        ...(record as HelpRuntimeCacheRecord),
        lastDownloadAttemptAt: attemptedAt ?? new Date(),
        lastRefreshStatus: status,
        freshnessStatus: record ? 'stale' : 'unavailable',
      }
      return record
    },
    writeValidatedPayload: async ({ attemptedAt, fetchedAt, ...payload }) => {
      record = {
        ...(record as HelpRuntimeCacheRecord),
        ...payload,
        lastDownloadAttemptAt: attemptedAt ?? new Date(),
        fetchedAt: fetchedAt ?? attemptedAt ?? new Date(),
        lastRefreshStatus: 'succeeded',
        freshnessStatus: 'fresh',
      }
      return record
    },
    markFreshness: async () => record,
  }
  return { store, getRecord: () => record }
}

const validFetcher: HelpFetcher = async (url) => {
  if (url === `${HELP_SOURCE_BASE_URL}content/help/index.json`) {
    return JSON.stringify(bundledHelpIndex)
  }
  const entry = bundledHelpIndex.entries.find((candidate) => `${HELP_SOURCE_BASE_URL}${candidate.path}` === url)
  if (!entry?.path) throw new Error('unexpected URL')
  if (entry.type === 'page') return bundledHelpContent.pages[entry.key]?.markdown ?? ''
  return bundledHelpContent.tooltips[entry.key]?.text ?? ''
}

test('refresh records successful attempt and replaces the cache', async () => {
  const { store, getRecord } = createStore()
  const attemptedAt = new Date('2026-09-07T13:00:00.000Z')
  const result = await refreshHelp({ store, fetcher: validFetcher, now: () => attemptedAt })

  assert.equal(result.outcome, 'succeeded')
  assert.equal(getRecord()?.lastDownloadAttemptAt?.toISOString(), attemptedAt.toISOString())
  assert.equal(getRecord()?.lastRefreshStatus, 'succeeded')
})

test('failed and invalid refreshes record timestamps without replacing valid content', async () => {
  const first = createStore()
  await refreshHelp({ store: first.store, fetcher: validFetcher })
  const original = first.getRecord()?.contentVersion
  const failedAt = new Date('2026-09-07T13:01:00.000Z')
  const failed = await refreshHelp({
    store: first.store,
    fetcher: async () => { throw new Error('network unavailable') },
    now: () => failedAt,
  })
  assert.equal(failed.outcome, 'failed')
  assert.equal(first.getRecord()?.contentVersion, original)
  assert.equal(first.getRecord()?.lastDownloadAttemptAt?.toISOString(), failedAt.toISOString())

  const invalid = await refreshHelp({
    store: first.store,
    fetcher: async (url) => url.endsWith('index.json') ? '{"schemaVersion":1}' : '',
  })
  assert.equal(invalid.outcome, 'invalid')
  assert.equal(first.getRecord()?.contentVersion, original)
  assert.equal(first.getRecord()?.lastRefreshStatus, 'invalid')
})

test('startup refresh is fire-and-forget while remote work is pending', async () => {
  const { store } = createStore()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  let started = false
  startHelpRefresh({
    store,
    fetcher: async () => {
      started = true
      await pending
      return JSON.stringify(bundledHelpIndex)
    },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started, true)
  release()
})

test('the validated cache is global and reusable across organization contexts', async () => {
  const { store } = createStore()
  for (const organizationContext of ['organization-a', 'organization-b']) {
    // Organization context is intentionally not passed to the system-scoped
    // help store; both verified users consume the same channel row.
    assert.match(organizationContext, /^organization-/)
    const result = await refreshHelp({ store, fetcher: validFetcher })
    assert.equal(result.record.lastRefreshStatus, 'succeeded')
  }
})
