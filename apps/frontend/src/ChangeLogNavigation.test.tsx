import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { matchRoutes, MemoryRouter } from 'react-router'
import { ChangeLogNavigation, CHANGELOG_UNKNOWN_STATUS } from './ChangeLogNavigation'
import { scaffoldRoutes } from './scaffoldRoutes'

;(globalThis as { React?: typeof React }).React = React

function renderNavigation(hasUnread: boolean | null, requestFailed = false): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={['/change-log']}>
      <ul>
        <ChangeLogNavigation
          state={{ userId: 'user-a', hasUnread, requestFailed }}
        />
      </ul>
    </MemoryRouter>,
  )
}

function renderedStatusText(markup: string): string {
  const status = /<span[^>]*role="status"[^>]*>(.*?)<\/span>/.exec(markup)
  assert.ok(status)
  return status[1].replaceAll('&#x27;', "'")
}

test('Change Log is a System destination at the direct /change-log route', () => {
  const route = scaffoldRoutes.find((candidate) => candidate.id === 'change-log')
  assert.ok(route)
  assert.equal(route.title, 'Change Log')
  assert.equal(route.path, '/change-log')
  assert.equal(route.navGroup, 'System')
  assert.equal(
    matchRoutes([{ path: route.path }], '/change-log')?.[0]?.route.path,
    route.path,
  )
})

test('confirmed unread state renders one visible New label in the Change Log link', () => {
  const markup = renderNavigation(true)
  assert.match(markup, /href="\/change-log"/)
  assert.match(markup, />Change Log<span[^>]*>New<\/span><\/a>/)
})

test('confirmed read state omits New', () => {
  assert.doesNotMatch(renderNavigation(false), />New</)
})

test('initial unknown state shows adjacent polite status without a New label', () => {
  const markup = renderNavigation(null, true)
  assert.doesNotMatch(markup, />New</)
  assert.match(markup, /role="status" aria-live="polite"/)
  assert.equal(renderedStatusText(markup), CHANGELOG_UNKNOWN_STATUS)
})

test('later request failure preserves confirmed unread and read states with the same status', () => {
  const unreadMarkup = renderNavigation(true, true)
  const readMarkup = renderNavigation(false, true)
  assert.match(unreadMarkup, />New<\/span>/)
  assert.match(readMarkup, /href="\/change-log"/)
  assert.doesNotMatch(readMarkup, />New<\/span>/)
  assert.equal(renderedStatusText(unreadMarkup), CHANGELOG_UNKNOWN_STATUS)
  assert.equal(renderedStatusText(readMarkup), CHANGELOG_UNKNOWN_STATUS)
})

test('status is non-interactive and navigation has one keyboard stop with visible focus', () => {
  const markup = renderNavigation(null, true)
  const anchors = markup.match(/<a\b/g) ?? []
  assert.equal(anchors.length, 1)
  assert.match(markup, /focus-visible:outline/)
  const status = /<span[^>]*role="status"[^>]*>(.*?)<\/span>/.exec(markup)?.[0]
  assert.ok(status)
  assert.doesNotMatch(status, /<(?:a|button|input|select|textarea)\b/)
  assert.doesNotMatch(status, /tabindex=/i)
  assert.doesNotMatch(markup, /<(?:button|input|select|textarea)\b/)
})
