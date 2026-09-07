import assert from 'node:assert/strict'
import { test } from 'node:test'
import { fetchAppVersion } from './helpApi'
import { DEFAULT_EFFECTIVE_APP_VERSION } from './helpTypes'

function clientReturning(version: string) {
  return {
    getAppVersion: async () => ({ version }),
  } as never
}

test('fetchAppVersion uses the API version and falls back for invalid responses', async () => {
  assert.deepEqual(await fetchAppVersion(clientReturning('1.2.3')), {
    version: '1.2.3',
  })
  assert.deepEqual(await fetchAppVersion(clientReturning('not-a-version')), {
    version: DEFAULT_EFFECTIVE_APP_VERSION,
  })
})

test('fetchAppVersion uses the effective fallback when the API is unavailable', async () => {
  const client = {
    getAppVersion: async () => {
      throw new Error('offline')
    },
  } as never

  assert.deepEqual(await fetchAppVersion(client), {
    version: DEFAULT_EFFECTIVE_APP_VERSION,
  })
})
