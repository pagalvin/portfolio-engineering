import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const [appCss, baseCss, alertSource, listSource, chartSource, pickerSource, helpTooltipSource] = await Promise.all([
  readFile(new URL('../App.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.css', import.meta.url), 'utf8'),
  readFile(new URL('../components/EmptyProfileAlert.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./PredictionListPage.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./charts/ChartCard.tsx', import.meta.url), 'utf8'),
  readFile(new URL('./SubjectPicker.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../components/HelpTooltip.tsx', import.meta.url), 'utf8'),
])

test('workspace tracks and header allow narrow reflow', () => {
  assert.match(appCss, /\.workspace-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s)
  assert.match(appCss, /\.workspace-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s)
  assert.match(appCss, /\.workspace-header,\s*\.workspace-layout,\s*\.workspace-main\s*\{\s*min-width:\s*0;/)
  assert.match(appCss, /@media \(max-width: 767px\)[\s\S]*?\.workspace-header\s*\{[^}]*flex-wrap:\s*wrap;[\s\S]*?\.workspace-logo\s*\{[^}]*width:\s*min\(100%, 14rem\);[\s\S]*?\.workspace-welcome-title\s*\{[^}]*white-space:\s*normal;/)
  assert.doesNotMatch(baseCss, /body\s*\{[^}]*min-width:\s*320px/)
  assert.match(alertSource, /flex flex-wrap items-center justify-between/)
})

test('wide tables and picker content stay inside their own responsive containers', () => {
  assert.match(listSource, /<div className="overflow-x-auto">\s*<table className="w-full min-w-\[60rem\]/)
  assert.match(chartSource, /className="w-full overflow-x-auto"/)
  assert.match(pickerSource, /w-\[var\(--radix-popover-trigger-width\)\] max-w-\[calc\(100vw-3rem\)\]/)
  assert.match(helpTooltipSource, /className="fixed left-0 top-0 z-50 w-64 max-w-\[calc\(100vw-2rem\)\]/)
  assert.match(helpTooltipSource, /window\.innerWidth - tooltipRect\.width - margin/)
})