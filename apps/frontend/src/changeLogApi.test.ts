import assert from 'node:assert/strict'
import { test } from 'node:test'
import type {
  ChangelogAcknowledgmentRequest,
  ChangelogResponse,
} from '@portfolio-engineering/shared-types'
import { AuthenticatedApiClient } from './apiClient'
import {
  changelogUnreadStateForUser,
  loadChangelogUnreadState,
  recordChangelogUnreadFailure,
  recordChangelogUnreadSuccess,
} from './changeLogApi'

const changelogResponse: ChangelogResponse = {
  markdown: '### 2026-09-28\n\n- Release note.\n',
  sectionIdentities: ['### 2026-09-28'],
  contentVersion: 'a'.repeat(64),
  unreadSectionIdentities: ['### 2026-09-28'],
  metadata: {
    source: 'cache',
    freshness: 'fresh',
    refreshStatus: 'succeeded',
    contentVersion: 'a'.repeat(64),
    fetchedAt: '2026-09-28T00:00:00.000Z',
    lastDownloadAttemptAt: '2026-09-28T00:00:00.000Z',
  },
}

function createApiClient() {
  return new AuthenticatedApiClient({
    getAccessToken: () => 'test-access-token',
    onSessionExpired: () => {},
    refreshAccessToken: async () => null,
  })
}

async function withMockedFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
  run: () => Promise<void>,
): Promise<void> {
  const originalFetch = globalThis.fetch
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  globalThis.fetch = handler
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { origin: 'http://localhost' } },
  })
  try {
    await run()
  } finally {
    globalThis.fetch = originalFetch
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow)
    } else {
      Reflect.deleteProperty(globalThis, 'window')
    }
  }
}

test('authenticated client reads changelog and sends typed snapshot acknowledgments', async () => {
  const requests: Array<{ url: string; method: string; body?: string }> = []
  await withMockedFetch(async (input, init) => {
    requests.push({
      url: String(input),
      method: init?.method ?? 'GET',
      ...(typeof init?.body === 'string' ? { body: init.body } : {}),
    })
    const body = init?.method === 'POST'
      ? { acknowledgedSectionIdentities: ['### 2026-09-28'], unreadSectionIdentities: [] }
      : changelogResponse
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }, async () => {
    const client = createApiClient()
    assert.deepEqual(await client.getChangelog(), changelogResponse)

    const acknowledgment: ChangelogAcknowledgmentRequest = {
      contentVersion: changelogResponse.contentVersion,
      sectionIdentities: ['### 2026-09-28'],
    }
    assert.deepEqual(await client.acknowledgeChangelog(acknowledgment), {
      acknowledgedSectionIdentities: ['### 2026-09-28'],
      unreadSectionIdentities: [],
    })
  })

  assert.deepEqual(requests, [
    {
      url: 'http://localhost/api/changelog',
      method: 'GET',
    },
    {
      url: 'http://localhost/api/changelog/acknowledgments',
      method: 'POST',
      body: JSON.stringify({
        contentVersion: changelogResponse.contentVersion,
        sectionIdentities: ['### 2026-09-28'],
      }),
    },
  ])
})

test('confirmed unread state shows New and a later request failure preserves it', () => {
  const confirmed = recordChangelogUnreadSuccess(
    'user-a',
    changelogResponse,
  )
  assert.deepEqual(confirmed, {
    userId: 'user-a',
    hasUnread: true,
    requestFailed: false,
  })
  assert.deepEqual(recordChangelogUnreadFailure(confirmed, 'user-a'), {
    userId: 'user-a',
    hasUnread: true,
    requestFailed: true,
  })
})

test('confirmed read state stays read on later failure and is cleared on user switch', () => {
  const confirmedRead = recordChangelogUnreadSuccess(
    'user-a',
    { ...changelogResponse, unreadSectionIdentities: [] },
  )
  assert.deepEqual(recordChangelogUnreadFailure(confirmedRead, 'user-a'), {
    userId: 'user-a',
    hasUnread: false,
    requestFailed: true,
  })
  assert.deepEqual(changelogUnreadStateForUser(confirmedRead, 'user-b'), {
    userId: 'user-b',
    hasUnread: null,
    requestFailed: false,
  })
  assert.deepEqual(recordChangelogUnreadFailure(confirmedRead, 'user-b'), {
    userId: 'user-b',
    hasUnread: null,
    requestFailed: true,
  })
})

test('an initial API failure remains unknown rather than implying read or acknowledging notes', async () => {
  const initial = { userId: null, hasUnread: null, requestFailed: false }
  let acknowledgmentRequests = 0
  const failedClient = {
    async getChangelog(): Promise<ChangelogResponse> {
      throw new Error('offline')
    },
    async acknowledgeChangelog() {
      acknowledgmentRequests += 1
      return { acknowledgedSectionIdentities: [], unreadSectionIdentities: [] }
    },
  }
  const unknown = await loadChangelogUnreadState(failedClient, 'user-a', initial)
  assert.deepEqual(unknown, {
    userId: 'user-a',
    hasUnread: null,
    requestFailed: true,
  })
  assert.equal(unknown.hasUnread, null)
  assert.equal(acknowledgmentRequests, 0)
})
