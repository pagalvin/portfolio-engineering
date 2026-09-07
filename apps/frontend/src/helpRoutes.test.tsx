import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { matchRoutes } from 'react-router'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { HelpTopicPage } from './HelpTopicPage'
import {
  HELP_LANDING_ROUTE,
  HELP_TOPIC_ROUTE,
  canonicalHelpRedirectPath,
  helpRouteDefinitions,
  helpTopicPath,
} from './helpRoutes'

;(globalThis as { React?: typeof React }).React = React

test('the authenticated help route contract owns direct loads and refresh URLs', () => {
  const landingMatch = matchRoutes(helpRouteDefinitions, '/help')
  const topicMatch = matchRoutes(helpRouteDefinitions, '/help/getting-started')
  const refreshedTopicMatch = matchRoutes(helpRouteDefinitions, '/help/getting-started')

  assert.equal(landingMatch?.[0]?.route.path, HELP_LANDING_ROUTE)
  assert.equal(topicMatch?.[0]?.route.path, HELP_TOPIC_ROUTE)
  assert.deepEqual(
    refreshedTopicMatch?.[0]?.route.path,
    topicMatch?.[0]?.route.path,
  )
  assert.equal(landingMatch?.[0]?.route.handle?.requiresAuthentication, true)
  assert.equal(topicMatch?.[0]?.route.handle?.requiresAuthentication, true)
  assert.equal(matchRoutes(helpRouteDefinitions, '/workspace/settings'), null)
})

test('canonical topic paths encode keys and remain owned by the topic route', () => {
  const path = helpTopicPath('risk & margin')
  const match = matchRoutes(helpRouteDefinitions, path)

  assert.equal(path, '/help/risk%20%26%20margin')
  assert.equal(match?.[0]?.route.path, HELP_TOPIC_ROUTE)
})

test('canonical alias responses resolve to a replacing topic URL', () => {
  assert.equal(
    canonicalHelpRedirectPath('redirect', 'getting started'),
    '/help/getting%20started',
  )
  assert.equal(canonicalHelpRedirectPath('available', 'current'), null)
})

test('topic page uses router Link navigation for its return path', () => {
  const markup = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/help/missing']}>
      <HelpTopicPage />
    </MemoryRouter>,
  )

  assert.match(markup, /Help topic unavailable/)
  assert.match(markup, /href="\/help"/)
})
