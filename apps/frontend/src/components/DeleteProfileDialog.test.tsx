import assert from 'node:assert/strict'
import { test } from 'node:test'
import { INTUITION_LEDGER_PROFILE_DATA_COVERAGE } from '../profileDeletionCopy.js'

test('profile deletion coverage names predictions and all prediction histories', () => {
  assert.equal(
    INTUITION_LEDGER_PROFILE_DATA_COVERAGE,
    'Intuition Ledger predictions with their amendment, result, and reasoning histories',
  )
})