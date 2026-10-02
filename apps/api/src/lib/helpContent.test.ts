import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bundledHelpContent, bundledHelpIndex } from './bundledHelp.js'
import {
  loadHelpContent,
  loadRemoteHelpContent,
  resolveHelpKey,
  selectEligibleEntries,
  supplementWithBundledHelp,
  validateHelpPayload,
} from './helpContent.js'

test('bundled help validates and resolves aliases and redirects', () => {
  const payload = validateHelpPayload(bundledHelpIndex, bundledHelpContent)
  assert.equal(payload.index.schemaVersion, 1)
  assert.equal(resolveHelpKey(payload.index, 'help.dashboard.overview')?.entry.key, 'help.portfolio.overview')
  assert.equal(resolveHelpKey(payload.index, 'help.legacy.dashboard')?.redirectTo, 'help.portfolio.overview')
  assert.equal(resolveHelpKey(payload.index, 'help.removed.example')?.unavailable, true)
})

test('selects the highest eligible numeric semantic version', () => {
  const index = {
    ...bundledHelpIndex,
    entries: [
      ...bundledHelpIndex.entries,
      {
        ...bundledHelpIndex.entries[1],
        minAppVersion: '1.10.0',
        path: 'content/help/pages/portfolio/overview.md',
      },
      {
        ...bundledHelpIndex.entries[1],
        minAppVersion: '2.0.0',
        path: 'content/help/pages/portfolio/overview.md',
      },
    ],
  }
  assert.equal(selectEligibleEntries(index, '1.9.0').find((entry) => entry.key === 'help.portfolio.overview')?.minAppVersion, '1.0.0')
  assert.equal(selectEligibleEntries(index, '1.10.0').find((entry) => entry.key === 'help.portfolio.overview')?.minAppVersion, '1.10.0')
  assert.equal(selectEligibleEntries(index, '2.0.0').find((entry) => entry.key === 'help.portfolio.overview')?.minAppVersion, '2.0.0')
})

test('rejects unsafe markdown, malformed references, and incompatible bundled content', () => {
  assert.throws(() =>
    validateHelpPayload(bundledHelpIndex, {
      ...bundledHelpContent,
      pages: { ...bundledHelpContent.pages, 'help.portfolio': { markdown: '[bad](javascript:alert(1))' } },
    }),
  )
  assert.throws(() =>
    validateHelpPayload({ ...bundledHelpIndex, entries: [{ ...bundledHelpIndex.entries[0], path: '../secret.md' }] }, bundledHelpContent),
  )
  assert.equal(selectEligibleEntries(bundledHelpIndex, '0.9.0').filter((entry) => entry.status === 'active').length, 0)
})

test('bundled fallback includes the Intuition Ledger page and tooltips', () => {
  const payload = validateHelpPayload(bundledHelpIndex, bundledHelpContent)
  const keys = [
    'help.learning.intuition-ledger',
    'help.learning.intuition-ledger.amended',
    'help.learning.intuition-ledger.void',
    'help.learning.intuition-ledger.calibration',
    'help.learning.intuition-ledger.grace-window',
  ]
  for (const key of keys) assert.ok(payload.index.entries.some((entry) => entry.key === key), key)
  assert.ok(payload.content.pages['help.learning.intuition-ledger'])
  for (const key of keys.slice(1)) assert.ok(payload.content.tooltips[key])
})

test('supplements an older local cache with missing bundled help keys', () => {
  const ledgerKeys = new Set([
    'help.learning.intuition-ledger',
    'help.learning.intuition-ledger.amended',
    'help.learning.intuition-ledger.void',
    'help.learning.intuition-ledger.calibration',
    'help.learning.intuition-ledger.grace-window',
  ])
  const cached = validateHelpPayload(
    { ...bundledHelpIndex, entries: bundledHelpIndex.entries.filter((entry) => !ledgerKeys.has(entry.key)) },
    {
      pages: { ...bundledHelpContent.pages, 'help.portfolio.overview': { markdown: '# Cached overview' } },
      tooltips: bundledHelpContent.tooltips,
    },
  )

  const supplemented = supplementWithBundledHelp(cached)
  assert.equal(supplemented.content.pages['help.portfolio.overview']?.markdown, '# Cached overview')
  assert.ok(supplemented.content.pages['help.learning.intuition-ledger'])
  for (const key of [...ledgerKeys].slice(1)) assert.ok(supplemented.content.tooltips[key])
})

test('falls back to validated bundled content when the source is unavailable', async () => {
  const result = await loadHelpContent('1.0.0', async () => {
    throw new Error('offline')
  })

  assert.equal(result.source.kind, 'bundled')
  assert.ok(result.content.pages['help.learning.intuition-ledger'])
  assert.ok(result.content.tooltips['help.learning.intuition-ledger.grace-window'])
  assert.equal(result.content.tooltips['help.portfolio.performance']?.text.includes('*'), false)
})

test('loads valid GitHub-shaped index and content through the fixed source paths', async () => {
  const requested: string[] = []
  const result = await loadRemoteHelpContent('1.0.0', async (url) => {
    requested.push(url)
    if (url.endsWith('index.json')) return JSON.stringify(bundledHelpIndex)
    const entry = bundledHelpIndex.entries.find((candidate) =>
      candidate.path && url.endsWith(candidate.path),
    )
    assert.ok(entry?.path)
    return entry.type === 'page'
      ? bundledHelpContent.pages[entry.key]?.markdown ?? ''
      : bundledHelpContent.tooltips[entry.key]?.text ?? ''
  })

  assert.equal(result.source.kind, 'remote')
  assert.ok(requested.every((url) => url.startsWith('https://raw.githubusercontent.com/pagalvin/portfolio-engineering/main/')))
  assert.ok(result.content.pages['help.learning.intuition-ledger'])
})

test('rejects an invalid remote payload before it can be served', async () => {
  await assert.rejects(
    loadRemoteHelpContent('1.0.0', async (url) =>
      url.endsWith('index.json')
        ? JSON.stringify(bundledHelpIndex)
        : '[unsafe](javascript:alert(1))',
    ),
    /Help content failed validation/,
  )
})
