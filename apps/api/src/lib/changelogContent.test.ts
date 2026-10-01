import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import {
  CHANGELOG_SOURCE_PATH,
  loadChangelogContent,
  loadRemoteChangelogContent,
  resolveChangelogSourceUrl,
  validateChangelogMarkdown,
} from './changelogContent.js'
import { bundledChangelogMarkdown } from './bundledChangelog.js'
import { HELP_SOURCE_BASE_URL } from './helpContent.js'
import { bundledHelpContent, bundledHelpIndex } from './bundledHelp.js'
import { validateHelpPayload } from './helpContent.js'

test('changelog source allowlist permits only the exact root CHANGELOG.md path', async () => {
  assert.equal(
    resolveChangelogSourceUrl(CHANGELOG_SOURCE_PATH),
    `${HELP_SOURCE_BASE_URL}CHANGELOG.md`,
  )
  for (const path of [
    '../README.md',
    '/CHANGELOG.md',
    'content/CHANGELOG.md',
    'CHANGELOG.md?raw=1',
    'changelog.md',
  ]) {
    assert.throws(() => resolveChangelogSourceUrl(path), /not allowlisted/)
  }

  const requestedUrls: string[] = []
  await loadRemoteChangelogContent(async (url) => {
    requestedUrls.push(url)
    return '### 2026-09-01\n\n- One note.\n'
  })
  assert.deepEqual(requestedUrls, [`${HELP_SOURCE_BASE_URL}CHANGELOG.md`])
})

test('validates Markdown and extracts exact unique dated heading identities', () => {
  const markdown = '### 2026-09-01\n\n#### Details\n\n- One note.\n\n```\n### 2026-09-01\n```\n\n### 2026-08-31\n\n- Another note.\n'
  assert.deepEqual(validateChangelogMarkdown(markdown), {
    markdown,
    sectionIdentities: ['### 2026-09-01', '### 2026-08-31'],
  })
})

test('rejects duplicate and malformed dated section headings', () => {
  assert.throws(
    () => validateChangelogMarkdown('### 2026-09-01\n\n- A.\n\n### 2026-09-01\n\n- B.\n'),
    /duplicate dated section heading/,
  )
  for (const malformed of [
    '### 2026-02-30\n\n- Invalid date.\n',
    '### Release notes\n\n- Missing date.\n',
    '### 2026-9-1\n\n- Non-canonical date.\n',
  ]) {
    assert.throws(() => validateChangelogMarkdown(malformed), /malformed dated section heading/)
  }
  for (const headingAboveSection of [
    '# Changelog\n\n### 2026-09-01\n\n- Unexpected parent heading.\n',
    '## 2026-09-01\n\n- Wrong heading level.\n',
  ]) {
    assert.throws(
      () => validateChangelogMarkdown(headingAboveSection),
      /heading above the dated section level/,
    )
  }
  assert.throws(
    () => validateChangelogMarkdown('- No release sections.\n'),
    /at least one dated section heading/,
  )
})

test('rejects unsafe Markdown before it can be served or cached', () => {
  for (const unsafe of [
    '### 2026-09-01\n\n<script>alert(1)</script>\n',
    '### 2026-09-01\n\n[bad](javascript:alert(1))\n',
    '### 2026-09-01\n\n![bad](https://example.com/image.png)\n',
  ]) {
    assert.throws(() => validateChangelogMarkdown(unsafe), /unsafe Markdown/)
  }
})

test('changelog relative links are allowed without widening the Help markdown policy', () => {
  assert.doesNotThrow(() =>
    validateChangelogMarkdown('### 2026-09-01\n\n[Spec](docs/specs/0001-example.md)\n'),
  )
  assert.throws(() =>
    validateHelpPayload(bundledHelpIndex, {
      ...bundledHelpContent,
      pages: {
        ...bundledHelpContent.pages,
        'help.portfolio': {
          markdown: '# Portfolio\n\n[Spec](docs/specs/0001-example.md)',
        },
      },
    }),
  )
})

test('remote Markdown and identities are returned from the same validated snapshot', async () => {
  const sourceSnapshot = '### 2026-09-01\n\n- Version A.\n'
  const loaded = await loadRemoteChangelogContent(async () => sourceSnapshot)

  assert.equal(loaded.markdown, sourceSnapshot)
  assert.deepEqual(loaded.sectionIdentities, ['### 2026-09-01'])
  assert.equal(loaded.contentVersion.length, 64)
  assert.equal(loaded.source.kind, 'remote')
})

test('bundled fallback is validated and synchronized with canonical CHANGELOG.md', async () => {
  const canonical = await readFile(new URL('../../../../CHANGELOG.md', import.meta.url), 'utf8')
  const loaded = await loadChangelogContent({
    getLastValid: async () => null,
  })

  assert.equal(bundledChangelogMarkdown, canonical)
  assert.equal(loaded.markdown, canonical)
  assert.deepEqual(
    loaded.sectionIdentities,
    validateChangelogMarkdown(canonical).sectionIdentities,
  )
  assert.equal(loaded.source.kind, 'bundled')
})
