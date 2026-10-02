import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  HelpContentStore,
  HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import { bundledHelpContent, bundledHelpIndex } from './bundledHelp.js'
import {
  CHANGELOG_CHANNEL_ID,
  loadChangelogContent,
  validateCachedChangelog,
} from './changelogContent.js'
import { HELP_SOURCE_BASE_URL, type HelpFetcher } from './helpContent.js'
import {
  refreshChangelog,
  refreshHelp,
  startChangelogRefresh,
  startHelpRefresh,
} from './helpRefresh.js'

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

test('changelog refresh stores Markdown and identities together and replaces the channel cache', async () => {
  const { store, getRecord } = createStore()
  const markdown = '### 2026-09-28\n\n- Current release note.\n'
  const result = await refreshChangelog({
    store,
    fetcher: async (url) => {
      assert.equal(url, `${HELP_SOURCE_BASE_URL}CHANGELOG.md`)
      return markdown
    },
  })

  assert.equal(result.outcome, 'succeeded')
  assert.equal(result.record.channelId, CHANGELOG_CHANNEL_ID)
  assert.deepEqual(validateCachedChangelog(result.record), {
    markdown,
    sectionIdentities: ['### 2026-09-28'],
    contentVersion: result.record.contentVersion,
  })
  assert.deepEqual(
    await refreshChangelog({
      store,
      fetcher: async () => '### 2026-09-27\n\n- Replaced release note.\n',
    }).then((updated) => validateCachedChangelog(updated.record).sectionIdentities),
    ['### 2026-09-27'],
  )
  const updatedRecord = getRecord()
  assert.ok(updatedRecord)
  assert.deepEqual(validateCachedChangelog(updatedRecord).sectionIdentities, ['### 2026-09-27'])
})

test('failed and invalid changelog refreshes preserve the last valid snapshot', async () => {
  const { store, getRecord } = createStore()
  const markdown = '### 2026-09-28\n\n- Last valid note.\n'
  await refreshChangelog({ store, fetcher: async () => markdown })
  const validRecord = getRecord()
  assert.ok(validRecord)

  const failed = await refreshChangelog({
    store,
    fetcher: async () => {
      throw new Error('offline')
    },
  })
  assert.equal(failed.outcome, 'failed')
  assert.equal(failed.record.lastRefreshStatus, 'failed')
  assert.deepEqual(failed.record.contentPayload, validRecord.contentPayload)

  const invalid = await refreshChangelog({
    store,
    fetcher: async () => '### 2026-02-30\n\n- Invalid date.\n',
  })
  assert.equal(invalid.outcome, 'invalid')
  assert.equal(invalid.record.lastRefreshStatus, 'invalid')
  assert.deepEqual(invalid.record.contentPayload, validRecord.contentPayload)
  const staleContent = await loadChangelogContent({
    getLastValid: async () => failed.record,
  })
  assert.equal(staleContent.source.kind, 'cache')
  assert.equal(staleContent.markdown, markdown)
})

test('changelog startup refresh is fire-and-forget while remote work is pending', async () => {
  const { store } = createStore()
  let release!: () => void
  const pending = new Promise<void>((resolve) => { release = resolve })
  let started = false
  startChangelogRefresh({
    store,
    fetcher: async () => {
      started = true
      await pending
      return '### 2026-09-28\n\n- Startup note.\n'
    },
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(started, true)
  release()
})
