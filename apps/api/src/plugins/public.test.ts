import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getPrismaClient } from '@portfolio-engineering/database'
import { buildApp } from '../app.js'
import {
  DEV_ACCESS_TOKEN_HEADER,
  REFRESH_TOKEN_COOKIE_NAME,
} from '@portfolio-engineering/auth'
import { PROFILE_COOKIE_NAME } from './public.js'

function createUniqueLocalProfileSeed() {
  const token = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  return {
    displayName: `Alice Trader ${token}`,
    email: `alice-trader-${token}@local.invalid`,
  }
}

function extractCookie(
  headers: string | string[] | number | undefined,
  cookieName: string,
): string {
  const cookieHeaders = Array.isArray(headers) ? headers : [headers]

  for (const header of cookieHeaders) {
    if (typeof header === 'string' && header.includes(`${cookieName}=`)) {
      return header.split(';')[0] ?? ''
    }
  }

  return ''
}

test('unconfigured APP_MODE responds with UnconfiguredSessionResponse', async () => {
  const originalAppMode = process.env.APP_MODE
  delete process.env.APP_MODE

  try {
    const app = await buildApp()
    const response = await app.inject({
      method: 'GET',
      url: '/auth/session',
    })

    assert.equal(response.statusCode, 200)
    const body = JSON.parse(response.payload)
    assert.equal(body.authenticated, false)
    assert.equal(body.configured, false)
    assert.equal(body.appMode, null)
    assert.ok(Array.isArray(body.instructions))
    assert.ok(body.instructions.length > 0)
    await app.close()
  } finally {
    if (originalAppMode !== undefined) {
      process.env.APP_MODE = originalAppMode
    }
  }
})

test('APP_MODE=hosted registers OAuth callbacks and omits local profile routes (404)', async () => {
  const originalAppMode = process.env.APP_MODE
  process.env.APP_MODE = 'hosted'

  try {
    const app = await buildApp()

    // Local profile endpoints must return 404
    const profileResponse = await app.inject({
      method: 'GET',
      url: '/auth/profiles',
    })
    assert.equal(profileResponse.statusCode, 404)

    const selectProfileResponse = await app.inject({
      method: 'POST',
      url: '/auth/profiles/select',
      payload: { profileId: 'some-id' },
    })
    assert.equal(selectProfileResponse.statusCode, 404)

    // GET /auth/session when unauthenticated does NOT clear cookies
    const sessionResponse = await app.inject({
      method: 'GET',
      url: '/auth/session',
    })
    assert.equal(sessionResponse.statusCode, 200)
    const sessionBody = JSON.parse(sessionResponse.payload)
    assert.equal(sessionBody.authenticated, false)
    assert.equal(sessionBody.configured, true)
    assert.equal(sessionBody.appMode, 'hosted')
    assert.equal(sessionResponse.headers['set-cookie'], undefined)

    await app.close()
  } finally {
    if (originalAppMode !== undefined) {
      process.env.APP_MODE = originalAppMode
    }
  }
})

test('APP_MODE=hosted rejects existing local profile refresh and access tokens', async () => {
  const originalAppMode = process.env.APP_MODE
  process.env.APP_MODE = 'local'

  let refreshCookieValue = ''
  let profileCookieValue = ''
  let localAccessToken = ''

  try {
    const localApp = await buildApp()
    const listResponse = await localApp.inject({
      method: 'GET',
      url: '/auth/profiles',
    })
    assert.equal(listResponse.statusCode, 200)
    const listBody = JSON.parse(listResponse.payload)
    const localProfile = listBody.profiles[0]
    assert.ok(localProfile.id)

    const selectResponse = await localApp.inject({
      method: 'POST',
      url: '/auth/profiles/select',
      payload: {
        profileId: localProfile.id,
      },
    })
    assert.equal(selectResponse.statusCode, 200)

    refreshCookieValue = extractCookie(
      selectResponse.headers['set-cookie'],
      REFRESH_TOKEN_COOKIE_NAME,
    )
    profileCookieValue = extractCookie(
      selectResponse.headers['set-cookie'],
      PROFILE_COOKIE_NAME,
    )
    const headerToken = selectResponse.headers[DEV_ACCESS_TOKEN_HEADER]
    localAccessToken = Array.isArray(headerToken)
      ? String(headerToken[0] ?? '')
      : String(headerToken ?? '')

    assert.ok(refreshCookieValue.length > 0)
    assert.ok(profileCookieValue.length > 0)
    assert.ok(localAccessToken.length > 0)
    await localApp.close()

    process.env.APP_MODE = 'hosted'
    const hostedApp = await buildApp()
    const cookieHeader = `${refreshCookieValue}; ${profileCookieValue}`

    const sessionResponse = await hostedApp.inject({
      method: 'GET',
      url: '/auth/session',
      headers: {
        cookie: cookieHeader,
      },
    })
    assert.equal(sessionResponse.statusCode, 200)
    const sessionBody = JSON.parse(sessionResponse.payload)
    assert.equal(sessionBody.authenticated, false)
    assert.equal(sessionBody.configured, true)
    assert.equal(sessionBody.appMode, 'hosted')
    assert.ok(
      String(sessionResponse.headers['set-cookie']).includes(
        `${REFRESH_TOKEN_COOKIE_NAME}=`,
      ),
    )

    const refreshResponse = await hostedApp.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: cookieHeader,
      },
    })
    assert.equal(refreshResponse.statusCode, 401)

    const protectedResponse = await hostedApp.inject({
      method: 'GET',
      url: '/api/me',
      headers: {
        authorization: `Bearer ${localAccessToken}`,
      },
    })
    assert.equal(protectedResponse.statusCode, 401)

    await hostedApp.close()
  } finally {
    if (originalAppMode !== undefined) {
      process.env.APP_MODE = originalAppMode
    } else {
      delete process.env.APP_MODE
    }
  }
})

test('APP_MODE=local registers profile routes and permits profile selection and session recovery', async () => {
  const originalAppMode = process.env.APP_MODE
  process.env.APP_MODE = 'local'

  let createdProfileId: string | null = null
  let app: Awaited<ReturnType<typeof buildApp>> | null = null

  try {
    app = await buildApp()

    // OAuth callbacks must return 404 in local mode
    const oauthResponse = await app.inject({
      method: 'POST',
      url: '/auth/google/callback',
      payload: {
        organizationSlug: 'local-portfolio',
        organizationName: 'Local Portfolio',
        token: 'mock-token',
      },
    })
    assert.equal(oauthResponse.statusCode, 404)

    // GET /auth/profiles lists profiles (auto-bootstrapping Primary User on clean boot)
    const listResponse = await app.inject({
      method: 'GET',
      url: '/auth/profiles',
    })
    assert.equal(listResponse.statusCode, 200)
    const listBody = JSON.parse(listResponse.payload)
    assert.ok(Array.isArray(listBody.profiles))
    assert.ok(listBody.profiles.length >= 1)
    const primaryProfile = listBody.profiles[0]
    assert.ok(primaryProfile.id)
    assert.ok(primaryProfile.displayName)

    const uniqueProfile = createUniqueLocalProfileSeed()

    // POST /auth/profiles creates a new household profile with an explicit unique email so
    // test data does not leak into the shared dev database between runs.
    const createResponse = await app.inject({
      method: 'POST',
      url: '/auth/profiles',
      payload: {
        displayName: uniqueProfile.displayName,
        email: uniqueProfile.email,
      },
    })
    assert.equal(createResponse.statusCode, 200)
    const createBody = JSON.parse(createResponse.payload)
    assert.ok(
      createBody.profiles.some(
        (p: { displayName: string }) => p.displayName === uniqueProfile.displayName,
      ),
    )
    const aliceProfile = createBody.profiles.find(
      (p: { displayName: string }) => p.displayName === uniqueProfile.displayName,
    )
    assert.ok(aliceProfile)
    assert.equal(aliceProfile.email, uniqueProfile.email)
    createdProfileId = aliceProfile.id

    // POST /auth/profiles/select selects Alice Profile
    const selectResponse = await app.inject({
      method: 'POST',
      url: '/auth/profiles/select',
      payload: {
        profileId: aliceProfile.id,
      },
    })
    assert.equal(selectResponse.statusCode, 200)
    const selectBody = JSON.parse(selectResponse.payload)
    assert.equal(selectBody.authenticated, true)
    assert.equal(selectBody.appMode, 'local')
    assert.equal(selectBody.user.id, aliceProfile.id)

    // Cookies set on selection
    const cookiesHeader = selectResponse.headers['set-cookie']
    assert.ok(cookiesHeader)

    // Extract refresh cookie and profile cookie
    let refreshCookieValue = ''
    let profileCookieValue = ''

    if (Array.isArray(cookiesHeader)) {
      for (const header of cookiesHeader) {
        if (header.includes(`${REFRESH_TOKEN_COOKIE_NAME}=`)) {
          refreshCookieValue = header.split(';')[0] ?? ''
        }
        if (header.includes(`${PROFILE_COOKIE_NAME}=`)) {
          profileCookieValue = header.split(';')[0] ?? ''
        }
      }
    } else if (typeof cookiesHeader === 'string') {
      if (cookiesHeader.includes(`${REFRESH_TOKEN_COOKIE_NAME}=`)) {
        refreshCookieValue = cookiesHeader.split(';')[0] ?? ''
      }
      if (cookiesHeader.includes(`${PROFILE_COOKIE_NAME}=`)) {
        profileCookieValue = cookiesHeader.split(';')[0] ?? ''
      }
    }

    assert.ok(refreshCookieValue.length > 0)
    assert.ok(profileCookieValue.length > 0)

    // Reloading GET /auth/session with refresh cookie returns authenticated session
    const reloadedSessionResponse = await app.inject({
      method: 'GET',
      url: '/auth/session',
      headers: {
        cookie: refreshCookieValue,
      },
    })
    assert.equal(reloadedSessionResponse.statusCode, 200)
    const reloadedBody = JSON.parse(reloadedSessionResponse.payload)
    assert.equal(reloadedBody.authenticated, true)
    assert.equal(reloadedBody.appMode, 'local')
    assert.equal(reloadedBody.user.id, aliceProfile.id)

    // POST /auth/refresh rotates token
    const refreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookieValue,
      },
    })
    assert.equal(refreshResponse.statusCode, 200)
    const refreshResponseBody = JSON.parse(refreshResponse.payload)
    assert.ok(refreshResponseBody.accessToken)

    // Rotation Grace Window Test: Requesting /auth/refresh AGAIN within 30s with original token succeeds!
    const secondRefreshResponse = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      headers: {
        cookie: refreshCookieValue,
      },
    })
    assert.equal(secondRefreshResponse.statusCode, 200)
    const secondBody = JSON.parse(secondRefreshResponse.payload)
    assert.ok(secondBody.accessToken)

    // GET /auth/profiles/:id/export exports backup JSON with v1.0.0 schema
    const exportResponse = await app.inject({
      method: 'GET',
      url: `/auth/profiles/${aliceProfile.id}/export`,
    })
    assert.equal(exportResponse.statusCode, 200)
    assert.equal(
      exportResponse.headers['content-type'],
      'application/json; charset=utf-8',
    )
    assert.ok(
      (exportResponse.headers['content-disposition'] as string).includes('attachment; filename='),
    )
    const exportBody = JSON.parse(exportResponse.payload)
    assert.equal(exportBody.version, '1.0.0')
    assert.equal(exportBody.appMode, 'local')
    assert.equal(exportBody.data.profile.displayName, uniqueProfile.displayName)
    assert.ok(exportBody._meta.sections.profile)
    assert.ok(exportBody._meta.sections.investorProfile)
    assert.ok(exportBody._meta.sections.journal)

    // DELETE /auth/profiles/:id deletes profile and clears auth cookies if self-deleting
    const deleteResponse = await app.inject({
      method: 'DELETE',
      url: `/auth/profiles/${aliceProfile.id}`,
      headers: {
        cookie: profileCookieValue,
      },
    })
    assert.equal(deleteResponse.statusCode, 200)
    const deleteBody = JSON.parse(deleteResponse.payload)
    assert.deepEqual(deleteBody, {
      success: true,
      deletedProfileId: aliceProfile.id,
    })
    createdProfileId = null

    // Deleting again returns 404
    const secondDeleteResponse = await app.inject({
      method: 'DELETE',
      url: `/auth/profiles/${aliceProfile.id}`,
    })
    assert.equal(secondDeleteResponse.statusCode, 404)
  } finally {
    if (createdProfileId) {
      await getPrismaClient().user.delete({
        where: { id: createdProfileId },
      }).catch(() => undefined)
    }

    if (app) {
      await app.close()
    }

    if (originalAppMode !== undefined) {
      process.env.APP_MODE = originalAppMode
    } else {
      delete process.env.APP_MODE
    }
  }
})
