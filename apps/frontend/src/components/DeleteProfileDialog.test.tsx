import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DeleteProfileDialog } from './DeleteProfileDialog.js'

test('DeleteProfileDialog component is defined and exported', () => {
  assert.equal(typeof DeleteProfileDialog, 'function')
})
