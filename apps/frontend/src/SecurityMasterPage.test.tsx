import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import {
  exchangeChoices,
  getExchangeDropdownChoices,
} from './securityMasterApi'

const pageSource = fs.readFileSync(new URL('./SecurityMasterPage.tsx', import.meta.url), 'utf8')
const selectSource = fs.readFileSync(new URL('./components/ui/select.tsx', import.meta.url), 'utf8')
const apiClientSource = fs.readFileSync(new URL('./apiClient.ts', import.meta.url), 'utf8')

test('Exchange dropdown offers blank, fixed choices, and Other as a literal value', () => {
  const choices = getExchangeDropdownChoices('')

  assert.deepEqual(exchangeChoices, ['NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX'])
  assert.deepEqual(choices.map(({ value }) => value), ['', 'NYSE', 'NASDAQ', 'AMEX', 'LSE', 'TSX', 'OTHER'])
  assert.equal(choices.at(-1)?.label, 'Other')
})

test('Security Master list heading uses a compact page-title size', () => {
  assert.match(pageSource, /<h1 id="security-master-title" className="text-2xl font-semibold">Security Master<\/h1>/)
})

test('Security Master result rows have a subtle hover highlight', () => {
  assert.match(pageSource, /<tr key=\{item\.id\} className="border-b border-border-subtle transition-colors hover:bg-surface-muted">/)
})

test('Security Master filters align in one desktop row and Exchange uses a dropdown', () => {
  assert.match(pageSource, /<form className="status-panel grid gap-4 sm:grid-cols-2 lg:grid-cols-\[2fr_1fr_1fr_1fr\]"/)
  assert.match(pageSource, /Exchange<Select aria-label="Exchange" value=\{searchParams\.get\('exchange'\) \?\? ''\}/)
  assert.doesNotMatch(pageSource, /Exchange<Input aria-label="Exchange"/)
})

test('Status filter shows Active when the URL has no status', () => {
  assert.match(pageSource, /<Select aria-label="Status" value=\{searchParams\.get\('status'\) \?\? 'active'\}/)
})

test('Security Master grid ends with a shown-of-total count status line', () => {
  assert.match(pageSource, /setTotalCount\(response\.totalCount\)/)
  assert.match(pageSource, /Showing \{shown\.toLocaleString\(\)\} of \{total\.toLocaleString\(\)\} \{total === 1 \? 'security' : 'securities'\}/)
  assert.match(pageSource, /<\/table><\/div><SecurityCountStatus shown=\{records\.length\} total=\{totalCount\} \/>/)
  assert.match(pageSource, /<SecurityCountStatus shown=\{0\} total=\{totalCount\} \/>/)
})

test('Exchange dropdown preserves an unlisted existing value as a legacy choice', () => {
  const choices = getExchangeDropdownChoices('CBOE')

  assert.equal(choices[1]?.value, 'CBOE')
  assert.equal(choices[1]?.label, 'Other (existing value: CBOE)')
  assert.equal(choices[1]?.legacy, true)
  assert.deepEqual(choices.filter(({ value }) => value === 'CBOE').map(({ value }) => value), ['CBOE'])
})

test('Exchange form uses the shared native select without custom-entry behavior', () => {
  assert.match(pageSource, /function ExchangeSelect/)
  assert.match(pageSource, /<ExchangeSelect value=\{form\.exchange \?\? ''\}/)
  assert.match(pageSource, /return <label className="grid gap-1">Exchange \(optional\)\s*<Select id="security-exchange" aria-invalid=\{Boolean\(error\)\}/)
  assert.doesNotMatch(pageSource, /ExchangeCombobox|role="combobox"|custom value/)
  assert.match(selectSource, /<select/)
  assert.match(selectSource, /focus-visible:ring-2/)
})

test('Security detail uses label/value columns, bold labels, preserves description line breaks, and places audit times last', () => {
  assert.match(pageSource, /<dl className="status-panel grid gap-1">/)
  assert.match(pageSource, /<Detail label="Description" value=\{record\.description\} preserveWhitespace \/>/)
  assert.match(pageSource, /whitespace-pre-wrap break-words/)
  assert.match(pageSource, /<dt className="text-sm font-semibold text-text-primary">/)
  assert.match(pageSource, /<div className="grid grid-cols-\[minmax\(6rem,7rem\)_minmax\(0,1fr\)\] items-start gap-x-3 rounded-md px-3 py-2 transition-colors hover:bg-surface-muted sm:grid-cols-\[8rem_minmax\(0,1fr\)\]">/)
  assert.match(pageSource, /<dt className="text-sm font-semibold text-text-primary">\{label\}<\/dt>\s*<dd/)
  assert.doesNotMatch(pageSource, /fullWidth|md:col-span-2/)

  const detailListStart = pageSource.indexOf('<dl className="status-panel grid gap-1">')
  const detailListEnd = pageSource.indexOf('</dl>')
  const timestampFooterStart = pageSource.indexOf('<footer className="mt-4')
  const dialogStart = pageSource.indexOf('<Dialog open={confirmDelete}')
  const detailFields = pageSource.slice(detailListStart, detailListEnd)

  assert.ok(detailListStart >= 0 && detailListEnd > detailListStart)
  assert.ok(timestampFooterStart > detailListEnd && dialogStart > timestampFooterStart)
  assert.doesNotMatch(detailFields, /label="Created"|label="Updated"/)
  assert.match(pageSource, /className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-text-muted" aria-label="Record timestamps"/)
  assert.match(pageSource, /<time dateTime=\{new Date\(record\.createdAt\)\.toISOString\(\)\}>/)
  assert.match(pageSource, /<time dateTime=\{new Date\(record\.updatedAt\)\.toISOString\(\)\}>/)
})

test('Security detail header presents symbol, name, and lifecycle status together', () => {
  assert.match(pageSource, /<h1 id="security-detail-title" className="flex flex-wrap items-baseline gap-x-2 text-2xl font-semibold">/)
  assert.match(pageSource, /<span>\{record\.symbol\}<\/span><span aria-hidden="true" className="text-text-muted">-<\/span><span>\{formatValue\(record\.name\)\}<\/span><span aria-hidden="true" className="text-text-muted">-<\/span><span className="text-base font-semibold">\{record\.active \? 'Active' : 'Inactive'\}<\/span>/)
  assert.doesNotMatch(pageSource, /<p className="eyebrow">\{record\.active \? 'Active security' : 'Inactive security'\}<\/p>/)
})

test('editing a security saves, cancels, and returns through its read-only detail route', () => {
  assert.match(pageSource, /const detailPath = \(id: string\) => getSecurityDetailPath\(id, returnTo\)/)
  assert.match(pageSource, /navigate\(detailPath\(response\.security\.id\), \{ replace: true \}\)/)
  assert.match(pageSource, /const cancelPath = mode === 'edit' && securityId \? detailPath\(securityId\) : returnTo/)
  assert.match(pageSource, /const cancel = \(\) => navigate\(cancelPath\)/)
  assert.match(pageSource, /onCancel=\{cancel\} cancelPath=\{cancelPath\}/)
  assert.match(pageSource, /mode === 'edit' \? 'Back to security details' : 'Back to Security Master'/)
  assert.match(pageSource, /to=\{cancelPath\} onClick=\{\(event\) => \{ event\.preventDefault\(\); cancel\(\) \}\}/)
})

test('new security form starts blank and clears stale values when create mode opens', () => {
  assert.match(pageSource, /function emptySecurityForm\(\): FormValues \{\s*return \{\s*symbol: '', name: '', description: '', exchange: '', sector: '', industry: '',\s*\}/)
  assert.match(pageSource, /useState<FormValues>\(emptySecurityForm\)/)
  assert.match(pageSource, /useLayoutEffect\(\(\) => \{\s*if \(mode !== 'create'\) return\s*setRecord\(null\)\s*setLoadedSecurityId\(null\)\s*setMutationError\(null\)\s*setForm\(emptySecurityForm\(\)\)\s*\}, \[mode\]\)/)
  assert.match(pageSource, /value=\{form\.type \?\? ''\} onChange=/)
  assert.match(pageSource, /<option value="">Select type \(optional\)<\/option>/)
  assert.doesNotMatch(pageSource, /symbol: '', type: 'OTHER'/)
})


test('edit mode waits for a loaded record and offers retry and return after a failed load', () => {
  assert.match(pageSource, /if \(mode === 'edit' && editLoading\)[\s\S]*?role="status">Loading security for editing/)
  assert.match(pageSource, /if \(mode === 'edit' && \(editLoadError \|\| !editRecordLoaded\)\)[\s\S]*?role="alert"[\s\S]*?Try again[\s\S]*?Back to Security Master/)
  assert.match(pageSource, /if \(mode === 'edit' && \(!record \|\| loadedSecurityId !== securityId \|\| loading \|\| error \|\| !securityId\)\) return/)
  assert.match(pageSource, /const editRecordLoaded = Boolean\(securityId && loadedSecurityId === securityId && record\)/)
})

test('form validation is announced at its field and focuses the first invalid control', () => {
  assert.match(pageSource, /const errors = \{ symbol: 'Symbol is required\.' \}[\s\S]*?focusFirstInvalidField\(errors\)/)
  assert.match(pageSource, /id="security-symbol" aria-invalid=\{Boolean\(fieldErrors\.symbol\)\} aria-describedby=\{fieldErrors\.symbol \? 'security-symbol-error' : undefined\}/)
  assert.match(pageSource, /SECURITY_DUPLICATE_IDENTITY'[\s\S]*?symbol: 'This symbol is already used with this exchange\.'[\s\S]*?exchange: 'This exchange conflicts with an existing security using this symbol\.'/)
  assert.match(pageSource, /setFieldErrors\(errors\)[\s\S]*?focusFirstInvalidField\(errors\)/)
  assert.match(pageSource, /<SecurityFieldError id="security-exchange-error" message=\{error\} \/>/)
  assert.match(pageSource, /error \? <div className="error-panel" role="alert">/)
})

test('empty states distinguish an organization with no securities from filtered zero matches', () => {
  assert.match(pageSource, /totalCount === 0 \? 'No securities yet' : 'No securities match your filters'/)
  assert.match(pageSource, /totalCount > 0 \? <Button variant="outline" className="mt-4" onClick=\{\(\) => navigate\('\/workspace\/security-master'\)\}>Clear filters/)
  assert.match(pageSource, /<SecurityCountStatus shown=\{0\} total=\{totalCount\} \/>/)
})

test('aborted list and detail loads cannot overwrite newer page state', () => {
  assert.match(pageSource, /await apiClient\.listSecurities\(parsedList\.query, controller\.signal\)\s*if \(controller\.signal\.aborted\) return\s*setRecords\(response\.securities\)\s*setTotalCount\(response\.totalCount\)/)
  assert.match(pageSource, /await apiClient\.getSecurity\(securityId, controller\.signal\)\)\.security\s*if \(controller\.signal\.aborted\) return\s*setRecord\(next\)\s*setLoadedSecurityId\(securityId\)\s*setForm\(/)
  assert.match(apiClientSource, /signal\?: AbortSignal/)
  assert.match(apiClientSource, /signal: options\?\.signal/)
})

test('Add security carries the validated current list URL as returnTo', () => {
  assert.match(pageSource, /getSafeSecurityReturnTo\(listUrl\(searchParams\)\)/)
  assert.match(pageSource, /to=\{`\/workspace\/security-master\/new\?returnTo=\$\{encodeURIComponent\(getSafeSecurityReturnTo\(listUrl\(searchParams\)\)\)\}`\}/)
  assert.match(pageSource, /const cancelPath = mode === 'edit' && securityId \? detailPath\(securityId\) : returnTo/)
  assert.match(pageSource, /navigate\(detailPath\(response\.security\.id\), \{ replace: true \}\)/)
})
