import assert from 'node:assert/strict'
import test from 'node:test'
import { formatAttemptDate, refreshAnnouncement } from './helpRefreshFormatting'

test('shows the no-previous-attempt state', () => {
  assert.equal(formatAttemptDate(null), 'Help content has not been refreshed yet.')
})

test('formats a refresh attempt using the user locale', () => {
  const value = formatAttemptDate('2026-09-07T13:57:29.246Z')
  assert.match(value, /^Last help refresh attempted: /)
  assert.notEqual(value, 'Last help refresh attempted: 2026-09-07T13:57:29.246Z')
})

test('refresh announcements cover progress, success, and failed refresh recovery', () => {
  assert.equal(refreshAnnouncement('refreshing'), 'Refreshing help content.')
  assert.equal(refreshAnnouncement('success'), 'Help content refreshed.')
  assert.equal(
    refreshAnnouncement('failure'),
    'Help content could not be refreshed. Existing help remains available.',
  )
})
