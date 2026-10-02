import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { matchRoutes, MemoryRouter } from 'react-router'
import type {
  ChangelogAcknowledgmentRequest,
  ChangelogAcknowledgmentResponse,
  ChangelogResponse,
} from '@portfolio-engineering/shared-types'
import {
  CHANGELOG_ACKNOWLEDGMENT_FAILURE,
  CHANGELOG_ROUTE,
  ChangeLogPageContent,
} from './ChangeLogPage'
import {
  acknowledgeRenderedChangelog,
  isChangelogResponse,
} from './changeLogHelpers'
import { ChangeLogNavigation } from './ChangeLogNavigation'
import {
  recordChangelogUnreadFailure,
  recordChangelogUnreadSuccess,
} from './changeLogApi'
import { scaffoldRoutes } from './scaffoldRoutes'

;(globalThis as { React?: typeof React }).React = React

const response: ChangelogResponse = {
  markdown: '### 2026-09-28\n\n- First release note.\n\n### 2026-09-29\n\n- Second release note.\n',
  sectionIdentities: ['### 2026-09-28', '### 2026-09-29'],
  contentVersion: 'a'.repeat(64),
  unreadSectionIdentities: ['### 2026-09-29'],
  metadata: {
    source: 'cache',
    freshness: 'fresh',
    refreshStatus: 'succeeded',
    contentVersion: 'a'.repeat(64),
    fetchedAt: '2026-09-29T00:00:00.000Z',
    lastDownloadAttemptAt: '2026-09-29T00:00:00.000Z',
  },
}

function renderPage(
  page: {
    data: ChangelogResponse | null
    loading: boolean
    error: boolean
  },
  acknowledgmentPending = false,
  acknowledgmentFailed = false,
): string {
  return renderToStaticMarkup(
    <ChangeLogPageContent
      page={page}
      acknowledgmentPending={acknowledgmentPending}
      acknowledgmentFailed={acknowledgmentFailed}
      onRetry={() => {}}
    />,
  )
}

test('Change Log is registered at its direct-loadable System route', () => {
  assert.equal(
    matchRoutes([{ path: CHANGELOG_ROUTE }], '/change-log')?.[0]?.route.path,
    CHANGELOG_ROUTE,
  )
  const route = scaffoldRoutes.find((candidate) => candidate.id === 'change-log')
  assert.ok(route)
  assert.equal(route.navGroup, 'System')
  assert.equal(route.path, CHANGELOG_ROUTE)
})

test('loading and unavailable states have explicit accessible feedback and recovery', () => {
  const loadingMarkup = renderPage({ data: null, loading: true, error: false })
  assert.match(loadingMarkup, /<h1[^>]*>Change Log<\/h1>/)
  assert.match(loadingMarkup, /role="status" aria-live="polite"/)
  assert.match(loadingMarkup, /Loading the change log\./)

  const unavailableMarkup = renderPage({ data: null, loading: false, error: true })
  assert.match(unavailableMarkup, /role="alert"/)
  assert.match(unavailableMarkup, /The change log couldn&#x27;t be loaded\./)
  assert.match(unavailableMarkup, />Try again<\/button>/)
  assert.doesNotMatch(unavailableMarkup, /Change Log content/)
})

test('valid content renders in published order in a named Markdown region', () => {
  const markup = renderPage({ data: response, loading: false, error: false })
  assert.match(markup, /See what&#x27;s changed in Portfolio OS\./)
  assert.match(markup, /aria-label="Change Log content"/)
  assert.ok(markup.indexOf('First release note.') < markup.indexOf('Second release note.'))
  assert.match(markup, /<h3>2026-09-28<\/h3>/)
})

test('stale cache and bundled content use the shared freshness status pattern', () => {
  const staleResponse = {
    ...response,
    metadata: { ...response.metadata, freshness: 'stale' as const },
  }
  assert.match(
    renderPage({ data: staleResponse, loading: false, error: false }),
    /Change log content may be out of date\./,
  )

  const bundledResponse = {
    ...response,
    metadata: { ...response.metadata, source: 'bundled' as const },
  }
  assert.match(
    renderPage({ data: bundledResponse, loading: false, error: false }),
    /Showing compatible bundled content\./,
  )
})

test('empty valid content is explicit and is not represented as an unavailable error', () => {
  const emptyResponse: ChangelogResponse = {
    ...response,
    markdown: '',
    sectionIdentities: [],
    unreadSectionIdentities: [],
  }
  const markup = renderPage({ data: emptyResponse, loading: false, error: false })
  assert.match(markup, /No change log entries are available yet\./)
  assert.doesNotMatch(markup, /role="alert"/)
  assert.doesNotMatch(markup, /Change Log content/)
})

test('a perceptibly delayed acknowledgment is announced politely without blocking the content', () => {
  const markup = renderPage(
    { data: response, loading: false, error: false },
    true,
  )
  assert.match(markup, /Recording your view\./)
  assert.match(markup, /role="status" aria-live="polite"/)
  assert.match(markup, /First release note\./)
})

test('acknowledgment posts exactly the rendered snapshot identities and refreshes nav only after confirmation', async () => {
  const requests: ChangelogAcknowledgmentRequest[] = []
  let refreshed = false
  const client = {
    async acknowledgeChangelog(
      input: ChangelogAcknowledgmentRequest,
    ): Promise<ChangelogAcknowledgmentResponse> {
      requests.push(input)
      return {
        acknowledgedSectionIdentities: [...input.sectionIdentities],
        unreadSectionIdentities: [],
      }
    },
  }

  const result = await acknowledgeRenderedChangelog(
    client,
    response,
    () => {
      refreshed = true
    },
  )
  assert.deepEqual(requests, [{
    contentVersion: response.contentVersion,
    sectionIdentities: response.sectionIdentities,
  }])
  assert.deepEqual(result?.unreadSectionIdentities, [])
  assert.equal(refreshed, true)
})

test('stale content acknowledges only the section identities in its snapshot', async () => {
  const staleSnapshot = {
    ...response,
    sectionIdentities: ['### 2026-09-28'],
    unreadSectionIdentities: ['### 2026-09-28'],
  }
  let posted: ChangelogAcknowledgmentRequest | null = null
  await acknowledgeRenderedChangelog(
    {
      async acknowledgeChangelog(input) {
        posted = input
        return {
          acknowledgedSectionIdentities: input.sectionIdentities,
          unreadSectionIdentities: ['### 2026-09-29'],
        }
      },
    },
    staleSnapshot,
  )
  assert.deepEqual(posted, {
    contentVersion: response.contentVersion,
    sectionIdentities: ['### 2026-09-28'],
  })
})

test('unavailable, malformed, and empty content never acknowledge sections', async () => {
  let requestCount = 0
  const client = {
    async acknowledgeChangelog() {
      requestCount += 1
      return {
        acknowledgedSectionIdentities: [],
        unreadSectionIdentities: [],
      }
    },
  }

  assert.equal(await acknowledgeRenderedChangelog(client, null), null)
  assert.equal(
    await acknowledgeRenderedChangelog(client, { ...response, contentVersion: '' }),
    null,
  )
  assert.equal(
    await acknowledgeRenderedChangelog(client, {
      ...response,
      sectionIdentities: [],
      unreadSectionIdentities: [],
    }),
    null,
  )
  assert.equal(requestCount, 0)
})

test('new sections remain unread after acknowledging an older rendered snapshot', async () => {
  const result = await acknowledgeRenderedChangelog(
    {
      async acknowledgeChangelog(input) {
        return {
          acknowledgedSectionIdentities: [...input.sectionIdentities],
          unreadSectionIdentities: ['### 2026-09-30'],
        }
      },
    },
    response,
  )
  assert.deepEqual(result?.unreadSectionIdentities, ['### 2026-09-30'])
})

test('failed acknowledgment leaves the known New navigation state visible', async () => {
  const unreadState = recordChangelogUnreadSuccess('user-a', response)
  const requestsFailingState = recordChangelogUnreadFailure(unreadState, 'user-a')
  let refreshed = false
  const markup = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/change-log']}>
      <ul>
        <ChangeLogNavigation state={requestsFailingState} />
      </ul>
    </MemoryRouter>,
  )

  await assert.rejects(
    acknowledgeRenderedChangelog(
      {
        async acknowledgeChangelog() {
          throw new Error('persistence unavailable')
        },
      },
      response,
      () => {
        refreshed = true
      },
    ),
  )
  assert.equal(refreshed, false)
  assert.match(markup, />New<\/span>/)
  assert.ok(renderPage(
    { data: response, loading: false, error: false },
    false,
    true,
  ).replaceAll('&#x27;', "'").includes(CHANGELOG_ACKNOWLEDGMENT_FAILURE))
})

test('invalid API payloads are rejected rather than treated as empty content', () => {
  assert.equal(isChangelogResponse({ ...response, contentVersion: 'invalid' }), false)
  assert.equal(
    isChangelogResponse({
      ...response,
      sectionIdentities: ['duplicate', 'duplicate'],
      unreadSectionIdentities: [],
    }),
    false,
  )
  assert.equal(
    isChangelogResponse({
      ...response,
      sectionIdentities: ['### 2026-09-30'],
    }),
    false,
  )
  assert.equal(
    isChangelogResponse({
      ...response,
      unreadSectionIdentities: ['### 2026-09-30'],
    }),
    false,
  )
})
