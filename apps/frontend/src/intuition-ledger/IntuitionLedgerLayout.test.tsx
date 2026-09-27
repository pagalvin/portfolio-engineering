import assert from 'node:assert/strict'
import test from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  createMemoryRouter,
  createRoutesFromChildren,
  matchRoutes,
  MemoryRouter,
  RouterProvider,
  Routes,
} from 'react-router'
import { scaffoldRoutes } from '../scaffoldRoutes'
import { getEnvironmentTimezone } from '../journalApi'
import { getTodayInTimezone } from '../journalDates'
import {
  fetchIntuitionLedgerDueCount,
  IntuitionLedgerDueCountContext,
  intuitionLedgerNavLabel,
} from './intuitionLedgerDueCount'

;(globalThis as { React?: typeof React }).React = React
const { intuitionLedgerRoutes } = await import('./intuitionLedgerRoutes')

const routes = createRoutesFromChildren(intuitionLedgerRoutes)
const root = '/workspace/intuition-ledger'
const destinations = [
  [root, 'Overview'],
] as const

const formDestinations = [
  `${root}/predictions/new?returnTo=%2Fworkspace%2Fintuition-ledger%2Fdue`,
  `${root}/predictions/prediction-1/edit`,
] as const

function renderRoute(url: string, count: number | null = null) {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <IntuitionLedgerDueCountContext.Provider value={{ count, refresh: () => {} }}>
        <Routes>{intuitionLedgerRoutes}</Routes>
      </IntuitionLedgerDueCountContext.Provider>
    </MemoryRouter>,
  )
}

test('Learning navigation places Intuition Ledger immediately after Journal', () => {
  const learning = scaffoldRoutes.filter((route) => route.navGroup === 'Learning')
  const journalIndex = learning.findIndex((route) => route.id === 'journal')
  assert.equal(learning[journalIndex + 1]?.id, 'intuition-ledger')
  assert.equal(learning[journalIndex + 1]?.status, 'in-progress')
})

test('overview, due, and unknown URLs resolve to their real route shells', () => {
  for (const [url, title] of destinations) {
    assert.ok(matchRoutes(routes, url), `No route for ${url}`)
    const html = renderRoute(url)
    assert.match(html, new RegExp(`<h2 id="ledger-view-title"[^>]*>${title}</h2>`))
    assert.equal(renderRoute(url), html, `Refresh changed ${url}`)
    assert.doesNotMatch(html, /Not Yet Implemented|NotYetImplemented|placeholder-only/)
  }
  assert.match(renderRoute(`${root}/due`), /Due for review<\/h2>/)
  assert.equal(matchRoutes(routes, `${root}/unrecognized`), null)
})

test('prediction detail route resolves to the API-backed detail page', () => {
  const url = `${root}/predictions/prediction-1?returnTo=%2Fworkspace%2Fintuition-ledger`
  assert.ok(matchRoutes(routes, url), `No route for ${url}`)
  const html = renderRoute(url)
  assert.match(html, /role="status"[^>]*>Loading prediction/)
  assert.doesNotMatch(html, /Prediction details and history are not available/)
})
test('predictions resolves to the real list page, not the placeholder shell', () => {
  const url = `${root}/predictions`
  assert.ok(matchRoutes(routes, url), `No route for ${url}`)
  const html = renderRoute(url)
  assert.match(html, /All predictions<\/h2>/)
  assert.equal(renderRoute(url), html, `Refresh changed ${url}`)
  assert.doesNotMatch(html, /Not Yet Implemented|NotYetImplemented|placeholder-only|searchable prediction list is being built/)
  assert.match(html, /role="status"[^>]*>Loading predictions/)
})

test('new and edit resolve to the real prediction form, not the placeholder shell', () => {
  for (const url of formDestinations) {
    assert.ok(matchRoutes(routes, url), `No route for ${url}`)
    const html = renderRoute(url)
    assert.doesNotMatch(html, /ledger-view-title|Nothing can be (saved|changed) from this view yet/)
    assert.doesNotMatch(html, /Not Yet Implemented|NotYetImplemented|placeholder-only/)
    // Form-instance timestamps (e.g. price captured-at) legitimately vary per mount, unlike the static
    // placeholder shells above; assert structural stability instead of byte-for-byte equality.
    assert.match(renderRoute(url), /Prediction type|Loading prediction for editing…/)
  }
  assert.match(renderRoute(formDestinations[0]), /Prediction type/)
})

test('tabs use navigable links and back/forward restores the URL-selected view', async () => {
  const router = createMemoryRouter(routes, { initialEntries: [`${root}?period=month`] })
  const render = () => renderToStaticMarkup(
    <IntuitionLedgerDueCountContext.Provider value={{ count: 3, refresh: () => {} }}>
      <RouterProvider router={router} />
    </IntuitionLedgerDueCountContext.Provider>,
  )
  try {
    assert.match(render(), /href="\/workspace\/intuition-ledger\/due"[^>]*>Due \(3\)/)
    assert.match(render(), /href="\/workspace\/intuition-ledger\/predictions"/)
    await router.navigate(`${root}/due`)
    assert.equal(router.state.location.pathname, `${root}/due`)
    assert.match(render(), /Due for review<\/h2>/)
    await router.navigate(`${root}/predictions?status=resolved`)
    assert.match(render(), /All predictions<\/h2>/)
    await router.navigate(-1)
    assert.equal(router.state.location.pathname, `${root}/due`)
    assert.match(render(), /Due for review<\/h2>/)
    await router.navigate(-1)
    assert.equal(router.state.location.search, '?period=month')
    assert.match(render(), /Overview<\/h2>/)
    await router.navigate(1)
    assert.equal(router.state.location.pathname, `${root}/due`)
    const detailUrl = `${root}/predictions/prediction-1?returnTo=${encodeURIComponent(`${root}/due`)}`
    await router.navigate(detailUrl)
    assert.equal(router.state.location.pathname, `${root}/predictions/prediction-1`)
    assert.match(render(), /Loading prediction/)
    await router.navigate(-1)
    assert.equal(router.state.location.pathname, `${root}/due`)
    await router.navigate(1)
    assert.equal(router.state.location.pathname, `${root}/predictions/prediction-1`)
    assert.match(render(), /Loading prediction/)
  } finally {
    await router.dispose()
  }
})

test('due count is text for positive values; zero or failure never implies due items in primary nav', async () => {
  const date = getTodayInTimezone(getEnvironmentTimezone())
  for (const count of [3, 0]) {
    const received: string[] = []
    const value = await fetchIntuitionLedgerDueCount({
      getPredictionDueCount: async ({ asOfLocalDate }) => {
        received.push(asOfLocalDate)
        return { dueCount: count }
      },
    })
    assert.deepEqual(received, [date])
    assert.equal(intuitionLedgerNavLabel(value), count ? `Intuition Ledger, ${count} due` : 'Intuition Ledger')
    assert.match(renderRoute(`${root}/due`, value), new RegExp(`Due \\(${count}\\)`))
  }
  await assert.rejects(fetchIntuitionLedgerDueCount({
    getPredictionDueCount: async () => { throw new Error('API unavailable') },
  }), /API unavailable/)
  await assert.rejects(fetchIntuitionLedgerDueCount({
    getPredictionDueCount: async () => ({ dueCount: -1 }),
  }), /Invalid Intuition Ledger due count/)
  assert.equal(intuitionLedgerNavLabel(null), 'Intuition Ledger')
  assert.match(renderRoute(`${root}/due`), />Due<\/a>/)
  assert.doesNotMatch(renderRoute(`${root}/due`), /Due \(0\)|due<\/a>/)
})
