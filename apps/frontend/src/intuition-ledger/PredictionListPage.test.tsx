import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { PredictionListItem, PredictionListResponse } from '@portfolio-engineering/shared-types/intuitionLedger'
import {
  countActiveFilters,
  listUrl,
  loadPredictionList,
  PredictionListPage,
  PredictionFlags,
  predictionFlagsText,
  predictionResultText,
  predictionStatusText,
  subjectLabel,
} from './PredictionListPage'

;(globalThis as { React?: typeof React }).React = React

const pageSource = fs.readFileSync(new URL('./PredictionListPage.tsx', import.meta.url), 'utf8')
const LIST_PATH = '/workspace/intuition-ledger/predictions'

function predictionItem(overrides: Partial<PredictionListItem> = {}): PredictionListItem {
  return {
    id: 'p1', organizationId: 'org', userId: 'user', securityId: 'sec',
    otherSymbol: null, topic: null, symbolSnapshot: 'MSFT', symbolNormalizedSnapshot: 'MSFT',
    type: 'PERCENT_MOVE', direction: 'RISES', claimText: 'MSFT rises 1.00% by Fri, Oct 2',
    eventLabel: null, deadline: '2026-10-02', confidence: 65,
    priceAtPrediction: '420', predictedPrice: '424.20', predictedPercent: '1',
    priceCapturedAt: '2026-09-25T12:00:00.000Z', reasoning: null, tags: [],
    result: null, resolutionDate: null, actualPrice: null, outcomeNotes: null,
    voidedAt: null, voidReason: null, amended: false, amendedAt: null,
    createdAt: '2026-09-25T12:00:00.000Z', updatedAt: '2026-09-25T12:00:00.000Z',
    resultChanged: false,
    ...overrides,
  }
}

function renderPage(url: string) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path={LIST_PATH} element={<PredictionListPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

// --- Pure helper functions ---

test('subjectLabel prefers the symbol snapshot, then the Freeform topic, then a placeholder', () => {
  assert.equal(subjectLabel(predictionItem({ symbolSnapshot: 'MSFT' })), 'MSFT')
  assert.equal(subjectLabel(predictionItem({ symbolSnapshot: null, topic: 'Fed rate decision' })), 'Fed rate decision')
  assert.equal(subjectLabel(predictionItem({ symbolSnapshot: null, topic: null })), 'Not provided')
})

test('predictionStatusText derives status from the same rules as the server, with icon plus text (never color alone)', () => {
  const today = '2026-09-27'
  assert.equal(predictionStatusText(predictionItem({ deadline: '2026-09-30', result: null, voidedAt: null }), today), '○ Open')
  assert.equal(predictionStatusText(predictionItem({ deadline: '2026-09-20', result: null, voidedAt: null }), today), '⏲ Due')
  assert.equal(predictionStatusText(predictionItem({ deadline: '2026-09-20', result: 'CORRECT', voidedAt: null }), today), 'Resolved')
  assert.equal(predictionStatusText(predictionItem({ deadline: '2026-09-30', result: null, voidedAt: '2026-09-26T00:00:00.000Z' }), today), '⊘ Void')
})

test('predictionResultText shows an icon and text, or an honest placeholder when not recorded', () => {
  assert.equal(predictionResultText('CORRECT'), '✓ Correct')
  assert.equal(predictionResultText('INCORRECT'), '✗ Incorrect')
  assert.equal(predictionResultText(null), 'Not recorded')
})

test('predictionFlagsText reflects only the server-provided amended and resultChanged fields', () => {
  assert.equal(predictionFlagsText(predictionItem({ amended: false, resultChanged: false })), 'None')
  assert.equal(predictionFlagsText(predictionItem({ amended: true, resultChanged: false })), 'Amended')
  assert.equal(predictionFlagsText(predictionItem({ amended: false, resultChanged: true })), 'Result changed')
  assert.equal(predictionFlagsText(predictionItem({ amended: true, resultChanged: true })), 'Amended, Result changed')
})

test('Amended list flag includes an accessible help trigger without changing other flags', () => {
  const amended = renderToStaticMarkup(<MemoryRouter><PredictionFlags prediction={predictionItem({ amended: true })} client={null} /></MemoryRouter>)
  assert.match(amended, /About Amended predictions/)
  assert.match(amended, /aria-expanded="false"/)
  assert.match(amended, />Amended</)

  const unchanged = renderToStaticMarkup(<PredictionFlags prediction={predictionItem()} client={null} />)
  assert.equal(unchanged, '<span>None</span>')
})
test('countActiveFilters counts only non-default values, treating status=active as the default', () => {
  assert.equal(countActiveFilters({ status: 'active' }), 0)
  assert.equal(countActiveFilters({}), 0)
  assert.equal(countActiveFilters({ status: 'due', q: 'msft', type: 'percent_move', symbol: 'MSFT', result: 'correct', tag: 'earnings', amended: 'only' }), 7)
})

test('listUrl preserves the current query string for returnTo', () => {
  assert.equal(listUrl(new URLSearchParams()), LIST_PATH)
  assert.equal(listUrl(new URLSearchParams('status=due')), `${LIST_PATH}?status=due`)
})

test('loadPredictionList forwards the URL query plus the local date and returns the server response unchanged', async () => {
  const response: PredictionListResponse = {
    predictions: [predictionItem({ id: 'a' }), predictionItem({ id: 'b' })],
    filteredCount: 2,
    totalCount: 41,
  }
  let received: unknown
  const signal = new AbortController().signal
  const result = await loadPredictionList({
    listPredictions: async (query, passedSignal) => {
      received = query
      assert.equal(passedSignal, signal)
      return response
    },
  }, { status: 'due', tag: 'earnings' }, '2026-09-27', signal)
  assert.deepEqual(received, { status: 'due', tag: 'earnings', asOfLocalDate: '2026-09-27' })
  assert.equal(result, response)
  assert.equal(result.filteredCount, 2)
  assert.equal(result.totalCount, 41)
})

// --- ADR 0017 structural checks (mirrors SecurityMasterPage.test.tsx conventions) ---

test('list page uses a compact page heading, not the global large h1', () => {
  assert.match(pageSource, /<h2 id="predictions-heading" className="text-xl font-semibold">All predictions<\/h2>/)
})

test('result rows have a subtle hover highlight and no other tab stop beyond the explicit View action', () => {
  assert.match(pageSource, /<tr key=\{prediction\.id\} className="border-b border-border-subtle transition-colors hover:bg-surface-muted">/)
  assert.match(pageSource, />\s*View\s*<\/Link>/)
})

test('count line is server-driven: filteredCount and totalCount come from the response, never from the local array', () => {
  assert.match(pageSource, /setFilteredCount\(response\.filteredCount\)/)
  assert.match(pageSource, /setTotalCount\(response\.totalCount\)/)
  assert.match(pageSource, /<PredictionCountStatus shown=\{filteredCount\} total=\{totalCount\} \/>/)
  assert.match(pageSource, /<PredictionCountStatus shown=\{0\} total=\{totalCount\} \/>/)
  assert.match(pageSource, /Showing \{shown\.toLocaleString\(\)\} of \{total\.toLocaleString\(\)\} \{total === 1 \? 'prediction' : 'predictions'\}/)
  assert.match(pageSource, /className="mt-3 border-t border-border-subtle pt-3 text-sm text-text-muted" role="status"/)
})

test('Status filter shows All except void when the URL has no status, and only a fixed set of Selects is used for enumerable filters', () => {
  assert.match(pageSource, /value=\{parsedList\.query\.status \?\? 'active'\}/)
  assert.match(pageSource, /<Select\s+aria-label="Type"/)
  assert.match(pageSource, /<Select\s+aria-label="Result"/)
  assert.match(pageSource, /<Select\s+aria-label="Amended"/)
})

test('Symbol and Tag are free-text filters (no fixed set of values) and always echo the raw URL value', () => {
  assert.match(pageSource, /<Input\s+aria-label="Symbol"[\s\S]*?value=\{searchParams\.get\('symbol'\) \?\? ''\}/)
  assert.match(pageSource, /<Input\s+aria-label="Tag"[\s\S]*?value=\{searchParams\.get\('tag'\) \?\? ''\}/)
})

test('the row Flags column is driven only by the server-provided resultChanged field, never updatedAt', () => {
  assert.match(pageSource, /prediction\.resultChanged/)
  assert.doesNotMatch(pageSource, /prediction\.updatedAt/)
})

test('invalid, error, loading, and empty states are distinct and never render one as another', () => {
  assert.match(pageSource, /role="alert"[\s\S]*?Invalid filters/)
  assert.match(pageSource, /role="status"[\s\S]*?Loading predictions/)
  assert.match(pageSource, /role="alert"[\s\S]*?Unable to load predictions/)
  assert.match(pageSource, /No predictions yet/)
  assert.match(pageSource, /No predictions match your filters/)
})

test('the row action carries a validated returnTo back to the current filtered list', () => {
  assert.match(pageSource, /returnTo=\$\{encodeURIComponent\(listUrl\(searchParams\)\)\}/)
})

// --- Rendered behavior (synchronous initial render; filter values need no fetch to display) ---

test('an invalid filter shows the actionable invalid-filter state with Clear filters, not an empty grid', () => {
  const html = renderPage(`${LIST_PATH}?status=bogus`)
  assert.match(html, /Invalid filters/)
  assert.match(html, /Status must be active, open, due, resolved, void, or all\./)
  assert.match(html, />Clear filters<\/button>/)
  assert.doesNotMatch(html, /Loading predictions/)
})

test('an unlisted tag or symbol is shown as the current value rather than silently cleared', () => {
  const html = renderPage(`${LIST_PATH}?tag=unlisted-tag&symbol=ZZZZ`)
  assert.match(html, /value="unlisted-tag"/)
  assert.match(html, /value="ZZZZ"/)
  assert.doesNotMatch(html, /Invalid filters/)
})

test('the mobile filter disclosure reports how many filters are active', () => {
  assert.match(renderPage(LIST_PATH), /Filters \(0 active\)/)
  assert.match(renderPage(`${LIST_PATH}?tag=earnings&result=correct`), /Filters \(2 active\)/)
})

test('the list shows a loading status before the response arrives', () => {
  assert.match(renderPage(LIST_PATH), /role="status"[^>]*>\s*Loading predictions/)
})
