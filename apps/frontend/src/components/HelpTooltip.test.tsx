import assert from 'node:assert/strict'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { HelpTooltip } from './HelpTooltip'

;(globalThis as { React?: typeof React }).React = React

test('missing tooltip content leaves the host render intact', () => {
  const markup = renderToStaticMarkup(
    <div data-host="preserved">
      <HelpTooltip client={null} helpKey="help.missing" label="More information" />
    </div>,
  )

  assert.match(markup, /data-host="preserved"/)
  assert.doesNotMatch(markup, /role="tooltip"/)
})

test('fallback tooltip content is plain text and has an accessible trigger', () => {
  const markup = renderToStaticMarkup(
    <HelpTooltip
      client={null}
      helpKey="help.example"
      label="Explain this field"
      fallback={'Use <strong>plain text</strong>'}
    />,
  )

  assert.match(markup, /aria-label="Explain this field"/)
  assert.match(markup, />\?</)
  assert.doesNotMatch(markup, /<strong>/)
})
