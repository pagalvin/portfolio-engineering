import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  clearInvestorProfileCatalogsCache,
  getInvestorProfileCatalogs,
} from './investorProfileContent.js'

test('getInvestorProfileCatalogs loads and validates bundled objectives and strategies', async () => {
  clearInvestorProfileCatalogsCache()
  const catalogs = await getInvestorProfileCatalogs()

  assert.ok(Array.isArray(catalogs.objectives))
  assert.ok(Array.isArray(catalogs.strategies))
  assert.ok(catalogs.objectives.length > 0)
  assert.ok(catalogs.strategies.length > 0)

  const firstObjective = catalogs.objectives[0]
  assert.ok(firstObjective?.id)
  assert.ok(firstObjective?.title)
  assert.ok(firstObjective?.description)

  const firstStrategy = catalogs.strategies[0]
  assert.ok(firstStrategy?.id)
  assert.ok(firstStrategy?.title)
  assert.ok(firstStrategy?.description)
})
