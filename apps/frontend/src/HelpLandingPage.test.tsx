import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { HelpIndexEntry } from '@portfolio-engineering/shared-types/help'
import { HelpLandingPage, helpGroups } from './HelpLandingPage'
import { ApiClientContext } from './apiClientContext'
import { HelpGroup } from './components/HelpGroup'
import { HelpContentStatus, helpContentStatusMessage } from './components/HelpContentStatus'

;(globalThis as { React?: typeof React }).React = React

const page = (key: string, group: string, order: number): HelpIndexEntry => ({
  key,
  title: key,
  type: 'page',
  path: `content/help/pages/${key}.md`,
  group,
  parentKey: `help.${group.toLowerCase()}`,
  order,
  minAppVersion: '1.0.0',
  aliases: [],
  status: 'active',
})

test('landing groups preserve global navigation order and show empty groups', () => {
  const groups = helpGroups([page('later', 'Portfolio', 20), page('first', 'Portfolio', 10)])
  assert.deepEqual(groups.map((group) => group.name), ['Portfolio', 'Execution', 'Risk', 'Learning', 'System'])
  assert.deepEqual(groups[0]?.entries.map((entry) => entry.key), ['first', 'later'])
  assert.match(
    renderToStaticMarkup(<HelpGroup name="Execution" entries={[]} />),
    /Help for this area is being prepared/,
  )
})

test('unauthenticated help context does not render protected content', () => {
  const markup = renderToStaticMarkup(
    <ApiClientContext.Provider value={null}>
      <HelpLandingPage />
    </ApiClientContext.Provider>,
  )
  assert.match(markup, /Help is unavailable/)
  assert.doesNotMatch(markup, /official product guidance through/)
})

test('cached and bundled states use explicit non-color status copy', () => {
  const cached = {
    source: 'cache' as const,
    freshness: 'stale' as const,
    effectiveVersion: '1.0.0',
    contentVersion: '1.0.0',
    schemaVersion: 1 as const,
    refreshStatus: 'failed' as const,
    fetchedAt: null,
    lastDownloadAttemptAt: null,
  }
  const bundled = { ...cached, source: 'bundled' as const, freshness: 'unavailable' as const }
  assert.equal(helpContentStatusMessage(cached), 'Help content may be out of date.')
  assert.match(helpContentStatusMessage(bundled) ?? '', /bundled guidance/)
  assert.match(renderToStaticMarkup(<HelpContentStatus metadata={bundled} />), /bundled guidance/)
})
