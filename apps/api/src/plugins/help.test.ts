import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEV_ACCESS_TOKEN_HEADER } from '@portfolio-engineering/auth'
import { buildApp } from '../app.js'

test('help and app-version endpoints reject unauthenticated reads and refresh', async () => {
  const originalMode = process.env.APP_MODE
  process.env.APP_MODE = 'local'
  try {
    const app = await buildApp()
    for (const url of ['/api/app-version', '/api/help/index', '/api/help/topics/help.portfolio.overview', '/api/help/status']) {
      const response = await app.inject({ method: 'GET', url })
      assert.equal(response.statusCode, 401, url)
    }
    const refresh = await app.inject({ method: 'POST', url: '/api/help/refresh' })
    assert.equal(refresh.statusCode, 401)
    await app.close()
  } finally {
    if (originalMode === undefined) delete process.env.APP_MODE
    else process.env.APP_MODE = originalMode
  }
})

test('authenticated help reads return safe version, status, aliases, and unavailable states', async () => {
  const originalMode = process.env.APP_MODE
  process.env.APP_MODE = 'local'
  try {
    const app = await buildApp()
    const profiles = await app.inject({ method: 'GET', url: '/auth/profiles' })
    assert.equal(profiles.statusCode, 200)
    const profile = JSON.parse(profiles.payload).profiles[0]
    const session = await app.inject({
      method: 'POST',
      url: '/auth/profiles/select',
      payload: { profileId: profile.id },
    })
    assert.equal(session.statusCode, 200)
    const tokenHeader = session.headers[DEV_ACCESS_TOKEN_HEADER]
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader
    assert.ok(token)
    const headers = { authorization: `Bearer ${token}` }

    const version = await app.inject({ method: 'GET', url: '/api/app-version', headers })
    assert.deepEqual(JSON.parse(version.payload), { version: '1.0.0' })

    const index = await app.inject({ method: 'GET', url: '/api/help/index', headers })
    assert.equal(index.statusCode, 200)
    const indexBody = JSON.parse(index.payload)
    assert.equal(indexBody.metadata.effectiveVersion, '1.0.0')
    assert.equal(indexBody.index.entries.some((entry: { path?: string }) => entry.path), false)

    const status = await app.inject({ method: 'GET', url: '/api/help/status', headers })
    assert.equal(status.statusCode, 200)
    const statusBody = JSON.parse(status.payload)
    assert.ok(['cache', 'bundled'].includes(statusBody.source))
    assert.ok(statusBody.lastDownloadAttemptAt === null || typeof statusBody.lastDownloadAttemptAt === 'string')

    const alias = await app.inject({
      method: 'GET',
      url: '/api/help/topics/help.dashboard.overview',
      headers,
    })
    const aliasBody = JSON.parse(alias.payload)
    assert.equal(aliasBody.status, 'redirect')
    assert.equal(aliasBody.redirectTo, 'help.portfolio.overview')
    assert.equal(aliasBody.canonicalKey, 'help.portfolio.overview')

    const removed = await app.inject({
      method: 'GET',
      url: '/api/help/topics/help.removed.example',
      headers,
    })
    assert.equal(JSON.parse(removed.payload).status, 'unavailable')

    const refresh = await app.inject({ method: 'POST', url: '/api/help/refresh', headers })
    assert.equal(refresh.statusCode, 200)
    const refreshBody = JSON.parse(refresh.payload)
    assert.ok(['succeeded', 'failed', 'invalid'].includes(refreshBody.refreshStatus))
    assert.equal(typeof refreshBody.lastDownloadAttemptAt, 'string')
    await app.close()
  } finally {
    if (originalMode === undefined) delete process.env.APP_MODE
    else process.env.APP_MODE = originalMode
  }
})
