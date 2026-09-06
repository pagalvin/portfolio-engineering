import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildApp } from '../app.js'

test('investor profile API endpoints require authentication or handle requests gracefully', async () => {
  const app = await buildApp()

  // Unauthenticated request should be rejected
  const getResponse = await app.inject({
    method: 'GET',
    url: '/api/investor-profile',
  })
  assert.equal(getResponse.statusCode, 401)

  const catalogsResponse = await app.inject({
    method: 'GET',
    url: '/api/investor-profile/catalogs',
  })
  assert.equal(catalogsResponse.statusCode, 401)

  await app.close()
})
