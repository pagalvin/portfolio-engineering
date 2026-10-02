import { createHash } from 'node:crypto'
import type {
  HelpFreshnessStatus,
  HelpRefreshStatus,
  HelpContentStore,
  HelpRuntimeCacheRecord,
} from '@portfolio-engineering/database'
import { bundledChangelogMarkdown } from './bundledChangelog.js'
import {
  DEFAULT_APP_VERSION,
  HELP_SOURCE_BASE_URL,
  fetchRawGithubContent,
  isSafeRuntimeMarkdown,
  type HelpFetcher,
} from './helpContent.js'

export const CHANGELOG_CHANNEL_ID = 'changelog'
export const CHANGELOG_SOURCE_PATH = 'CHANGELOG.md'
export const CHANGELOG_SCHEMA_VERSION = 1
export const MAX_CHANGELOG_BYTES = 1024 * 1024

const datedHeadingPattern = /^### (\d{4}-\d{2}-\d{2})$/
const markdownHeadingPattern = /^(#{1,6})(?:\s|$)/

export interface ChangelogSnapshot {
  markdown: string
  sectionIdentities: string[]
}

export interface ChangelogSource {
  kind: 'remote' | 'bundled' | 'cache'
  fetchedAt?: Date
}

export interface LoadedChangelog extends ChangelogSnapshot {
  source: ChangelogSource
  contentVersion: string
  metadata: {
    freshness: HelpFreshnessStatus
    refreshStatus: HelpRefreshStatus
    fetchedAt: Date | null
    lastDownloadAttemptAt: Date | null
  }
}

export class ChangelogContentValidationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ChangelogContentValidationError'
  }
}

function contentVersion(markdown: string): string {
  return createHash('sha256').update(markdown, 'utf8').digest('hex')
}

function freshnessStatus(value: string): HelpFreshnessStatus {
  return value === 'fresh' || value === 'stale' || value === 'unavailable'
    ? value
    : 'unavailable'
}

function refreshStatus(value: string): HelpRefreshStatus {
  return value === 'never_attempted' || value === 'succeeded' || value === 'failed' || value === 'invalid'
    ? value
    : 'never_attempted'
}

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateChangelogMarkdown(input: unknown): ChangelogSnapshot {
  if (typeof input !== 'string' || input.length === 0) {
    throw new ChangelogContentValidationError('Changelog must be a non-empty Markdown document.')
  }
  if (Buffer.byteLength(input, 'utf8') > MAX_CHANGELOG_BYTES) {
    throw new ChangelogContentValidationError('Changelog exceeds the permitted size.')
  }
  if (!isSafeRuntimeMarkdown(input, true)) {
    throw new ChangelogContentValidationError('Changelog contains unsafe Markdown.')
  }

  const sectionIdentities: string[] = []
  const seenIdentities = new Set<string>()
  let fencedCodeMarker: '`' | '~' | null = null
  let fencedCodeLength = 0
  for (const line of input.split(/\r?\n/)) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line)
    if (fencedCodeMarker) {
      const closingFence = fenceMatch?.[1]
      if (
        closingFence?.startsWith(fencedCodeMarker) &&
        closingFence.length >= fencedCodeLength &&
        /^\s*$/.test(fenceMatch?.[2] ?? '')
      ) {
        fencedCodeMarker = null
        fencedCodeLength = 0
      }
      continue
    }
    if (fenceMatch) {
      fencedCodeMarker = fenceMatch[1]?.startsWith('~') ? '~' : '`'
      fencedCodeLength = fenceMatch[1]?.length ?? 0
      continue
    }
    const markdownHeading = markdownHeadingPattern.exec(line)
    if (!markdownHeading) continue
    const headingLevel = markdownHeading[1]?.length ?? 0
    if (headingLevel < 3) {
      throw new ChangelogContentValidationError('Changelog contains a heading above the dated section level.')
    }
    if (headingLevel > 3) continue
    const headingMatch = datedHeadingPattern.exec(line)
    if (!headingMatch || !isValidDate(headingMatch[1] ?? '')) {
      throw new ChangelogContentValidationError('Changelog contains a malformed dated section heading.')
    }
    const identity = line
    if (seenIdentities.has(identity)) {
      throw new ChangelogContentValidationError(`Changelog contains a duplicate dated section heading: ${identity}`)
    }
    seenIdentities.add(identity)
    sectionIdentities.push(identity)
  }
  if (sectionIdentities.length === 0) {
    throw new ChangelogContentValidationError('Changelog must contain at least one dated section heading.')
  }

  return { markdown: input, sectionIdentities }
}

export function resolveChangelogSourceUrl(path: string): string {
  if (path !== CHANGELOG_SOURCE_PATH) {
    throw new Error('Changelog source path is not allowlisted.')
  }
  return `${HELP_SOURCE_BASE_URL}${CHANGELOG_SOURCE_PATH}`
}

export interface RemoteChangelogContent extends LoadedChangelog {
  source: { kind: 'remote'; fetchedAt: Date }
}

export async function loadRemoteChangelogContent(
  fetcher: HelpFetcher = fetchRawGithubContent,
): Promise<RemoteChangelogContent> {
  const markdown = await fetcher(resolveChangelogSourceUrl(CHANGELOG_SOURCE_PATH))
  let snapshot: ChangelogSnapshot
  try {
    snapshot = validateChangelogMarkdown(markdown)
  } catch (error) {
    throw new ChangelogContentValidationError('Changelog content failed validation.', { cause: error })
  }
  const fetchedAt = new Date()
  return {
    ...snapshot,
    contentVersion: contentVersion(snapshot.markdown),
    source: { kind: 'remote', fetchedAt },
    metadata: {
      freshness: 'fresh',
      refreshStatus: 'succeeded',
      fetchedAt,
      lastDownloadAttemptAt: fetchedAt,
    },
  }
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

export function validateCachedChangelog(
  record: HelpRuntimeCacheRecord,
): ChangelogSnapshot & { contentVersion: string } {
  const indexPayload = objectRecord(record.indexPayload)
  const contentPayload = objectRecord(record.contentPayload)
  if (
    record.channelId !== CHANGELOG_CHANNEL_ID ||
    record.schemaVersion !== CHANGELOG_SCHEMA_VERSION ||
    !indexPayload ||
    indexPayload.schemaVersion !== CHANGELOG_SCHEMA_VERSION ||
    indexPayload.sourcePath !== CHANGELOG_SOURCE_PATH ||
    typeof indexPayload.contentVersion !== 'string' ||
    record.contentVersion !== indexPayload.contentVersion ||
    !contentPayload ||
    typeof contentPayload.markdown !== 'string' ||
    !Array.isArray(contentPayload.sectionIdentities) ||
    !contentPayload.sectionIdentities.every((identity) => typeof identity === 'string')
  ) {
    throw new ChangelogContentValidationError('Cached changelog payload has an invalid shape.')
  }

  const snapshot = validateChangelogMarkdown(contentPayload.markdown)
  if (
    JSON.stringify(snapshot.sectionIdentities) !== JSON.stringify(contentPayload.sectionIdentities) ||
    indexPayload.contentVersion !== contentVersion(snapshot.markdown)
  ) {
    throw new ChangelogContentValidationError('Cached changelog identities do not match the validated Markdown snapshot.')
  }
  return { ...snapshot, contentVersion: indexPayload.contentVersion }
}

export async function loadChangelogContent(
  store: Pick<HelpContentStore, 'getLastValid'>,
): Promise<LoadedChangelog> {
  let record: HelpRuntimeCacheRecord | null = null
  try {
    record = await store.getLastValid(CHANGELOG_CHANNEL_ID)
    if (record) {
      const validated = validateCachedChangelog(record)
      return {
        ...validated,
        source: {
          kind: 'cache',
          ...(record.fetchedAt ? { fetchedAt: record.fetchedAt } : {}),
        },
        metadata: {
          freshness: freshnessStatus(record.freshnessStatus),
          refreshStatus: refreshStatus(record.lastRefreshStatus),
          fetchedAt: record.fetchedAt,
          lastDownloadAttemptAt: record.lastDownloadAttemptAt,
        },
      }
    }
  } catch {
    // Match Help's cached-content fallback: never expose invalid cache payloads.
  }

  const snapshot = validateChangelogMarkdown(bundledChangelogMarkdown)
  return {
    ...snapshot,
    contentVersion: contentVersion(snapshot.markdown),
    source: { kind: 'bundled' },
    metadata: {
      freshness: 'unavailable',
      refreshStatus: 'never_attempted',
      fetchedAt: null,
      lastDownloadAttemptAt: null,
    },
  }
}

export const CHANGELOG_EFFECTIVE_APP_VERSION = DEFAULT_APP_VERSION
