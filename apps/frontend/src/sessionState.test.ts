import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  buildActiveProfileDeletionReset,
  buildUnauthenticatedSession,
  getUnauthenticatedRootPath,
} from './sessionState.ts'

test('buildUnauthenticatedSession preserves mode and clears active authentication', () => {
  assert.deepEqual(
    buildUnauthenticatedSession('hosted', 'Please log in.'),
    {
      authenticated: false,
      configured: true,
      appMode: 'hosted',
      message: 'Please log in.',
    },
  )

  assert.deepEqual(
    buildUnauthenticatedSession(undefined),
    {
      authenticated: false,
      configured: true,
      appMode: 'local',
      message: 'Select a profile or sign in again to continue.',
    },
  )
})

test('getUnauthenticatedRootPath returns the root route for local and hosted modes', () => {
  assert.equal(getUnauthenticatedRootPath('local'), '/')
  assert.equal(getUnauthenticatedRootPath('hosted'), '/')
})

test('buildActiveProfileDeletionReset resets session state and uses replace-safe root navigation', () => {
  const localReset = buildActiveProfileDeletionReset('local')
  assert.deepEqual(localReset.nextSession, {
    authenticated: false,
    configured: true,
    appMode: 'local',
    message: 'Select a profile or sign in again to continue.',
  })
  assert.equal(localReset.destination, '/')

  const hostedReset = buildActiveProfileDeletionReset('hosted')
  assert.deepEqual(hostedReset.nextSession, {
    authenticated: false,
    configured: true,
    appMode: 'hosted',
    message: 'Select a profile or sign in again to continue.',
  })
  assert.equal(hostedReset.destination, '/')
})
