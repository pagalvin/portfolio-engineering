import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { HelpTopicPage } from './HelpTopicPage'
import { helpTopicPath } from './helpRoutes'

;(globalThis as { React?: typeof React }).React = React

test('known and alias topic URLs remain URL-addressable and encoded', () => {
  assert.equal(helpTopicPath('help.dashboard.overview'), '/help/help.dashboard.overview')
  assert.equal(helpTopicPath('risk & margin'), '/help/risk%20%26%20margin')
})

test('unavailable topic has recovery navigation and no unrelated content', () => {
  const markup = renderToStaticMarkup(
    <MemoryRouter initialEntries={['/help/removed-topic']}>
      <HelpTopicPage />
    </MemoryRouter>,
  )
  assert.match(markup, /Help topic unavailable/)
  assert.match(markup, /Return to Help/)
  assert.doesNotMatch(markup, /MarkdownViewer/)
})
